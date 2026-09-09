import type { DrillBall, DrillDefinition, DrillDefinitionV1, DrillDefinitionV2, DrillEventV1, OpeningFeed, PlayerShotEventV2, SavedShotV1, SavedShotV2 } from './types';
import { SHOT_BY_ID, drillShotPace } from './bundled';
import { eventCamera, materializeEvents, snapshotShot } from './editing';
import { DEFAULT_DRILL_CAMERA } from '../engine/session/cameraTimeline';
import { DEFAULT_RETURN_LANDING_ZONE } from '../engine/session/returnLandingZone';
import { resolveReturnShot, RETURN_SHOT_PROFILES } from '../engine/session/returnShot';
import { normalizeLandingZone, resolveLandingZone } from '../engine/trajectory/landingZone';
import { ballDefaults, normalizeDrillBall } from './playerShots';
import { parseDrillJson } from './validation';
import { validatePlayerDrill } from './playerValidation';

const safeId = (value: string, fallback: string) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(value) ? value : fallback;
function oldIncoming(event: DrillEventV1, drill: DrillDefinitionV1): OpeningFeed {
  const shot = SHOT_BY_ID.get(event.shotId)!;
  const full = snapshotShot(event, drill, eventCamera(event));
  const position = event.opponentPosition ?? { x: shot.source.x, z: shot.source.z };
  const ball: DrillBall = normalizeDrillBall({ ...ballDefaults(shot.family),
    stroke: full.stroke ?? 'forehand', hand: full.opponentHand!, paceKmh: full.paceKmh ?? drillShotPace(shot),
    spin: full.spin && full.spin !== 'preset' ? full.spin : shot.spin, spinRateRpm: full.spinRateRpm!,
    variationPercent: full.variationPercent!, bounceFactor: full.bounceFactor!, trajectoryMode: full.trajectoryMode!,
    netClearanceM: full.netClearanceM ?? ballDefaults(shot.family).netClearanceM,
    serveRhythm: full.serveRhythm === 'compact' ? 'compact' : 'normal' });
  return { ball, position, landingZone: resolveLandingZone(event.target ?? shot.target,
    normalizeLandingZone(event.landingZone, shot.family), shot.family, position) };
}
/** Preserve world-space role ownership. This is not a geometric mirroring of an old drill. */
export function migratePlayerDrill(drill: DrillDefinition): DrillDefinitionV2 {
  if (drill.schemaVersion === 2) return structuredClone({ ...drill,
    launch: { ...drill.launch, ball: normalizeDrillBall(drill.launch.ball) },
    events: drill.events.map(event => normalizePlayerShot(event)) });
  const old = materializeEvents(drill);
  let camera = DEFAULT_DRILL_CAMERA;
  const events: PlayerShotEventV2[] = old.map((event, index) => {
    const next = old[(index + 1) % old.length]!, nextShot = SHOT_BY_ID.get(next.shotId)!;
    const returned = resolveReturnShot(event.returnShot, nextShot.family), profile = RETURN_SHOT_PROFILES[returned.type];
    camera = eventCamera(event, camera);
    const incoming = oldIncoming(next, drill), ownIncoming = oldIncoming(event, drill);
    const label = `Reply to ${event.label ?? SHOT_BY_ID.get(event.shotId)!.label}`.slice(0, 60);
    const { position: _position, ...opponentReturn } = incoming;
    return { id: safeId(event.id, `migrated-event-${index + 1}`), label, cue: returned.type.toUpperCase(), camera,
      ball: { ...ballDefaults(returned.type), spin: returned.spin, spinRateRpm: returned.spinRateRpm!, paceKmh: profile.pace, contactTiming: returned.contactTiming },
      landingZone: event.returnLandingZone ?? DEFAULT_RETURN_LANDING_ZONE,
      opponentReturn: nextShot.family === 'serve' ? { ball: ballDefaults(), landingZone: ownIncoming.landingZone } : opponentReturn,
      intervalSeconds: event.intervalSeconds, rhythmPercent: event.rhythmPercent, movementPercent: event.movementPercent,
      ...(index > 0 && SHOT_BY_ID.get(event.shotId)!.family === 'serve' ? { openingFeed: ownIncoming } : {}),
    };
  });
  const opening = oldIncoming(old[0]!, drill);
  // An old opening volley/smash had no preceding ball. Preserve its placement and
  // flight settings as an explicitly initiated groundstroke rather than inventing a rally.
  const launch: OpeningFeed = { ...opening, ball: { ...opening.ball, family: opening.ball.family === 'serve' ? 'serve' : 'groundstroke' } };
  return { schemaVersion: 2, id: drill.id, title: drill.title, description: drill.description, category: drill.category,
    launch, events, defaultInterval: drill.defaultInterval, defaultRepetitions: drill.defaultRepetitions,
    defaultRhythmPercent: drill.defaultRhythmPercent, defaultMovementPercent: drill.defaultMovementPercent };
}
export function migratePlayerSavedShot(saved: SavedShotV1 | SavedShotV2): SavedShotV2 {
  if ('schemaVersion' in saved && saved.schemaVersion === 2) return structuredClone({ ...saved, event: normalizePlayerShot(saved.event) });
  const old = saved as SavedShotV1;
  const drill = migratePlayerDrill({ schemaVersion: 1, id: 'saved-migration', title: old.name, description: '', category: 'Custom',
    events: [old.event], shotIds: [old.event.shotId], defaultInterval: old.event.intervalSeconds ?? 4,
    defaultRhythmPercent: old.event.rhythmPercent ?? 100, defaultMovementPercent: old.event.movementPercent ?? 100, defaultRepetitions: 1 });
  const event = drill.events[0]!;
  return { schemaVersion: 2, id: old.id, name: `Reply to ${old.name}`.slice(0, 60), event: { ...event, label: `Reply to ${old.name}`.slice(0, 60) } };
}
export function parsePlayerDrillJson(source: string): DrillDefinitionV2 {
  if (source.length > 500_000) throw new Error('Drill JSON exceeds the 500 KB import limit.');
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error('The selected file is not valid JSON.'); }
  if (value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 2) {
    const checked = validatePlayerDrill(value);
    if (!checked.valid) throw new Error(checked.errors.join(' '));
    return migratePlayerDrill(value as DrillDefinitionV2);
  }
  const migrated = migratePlayerDrill(parseDrillJson(source)), checked = validatePlayerDrill(migrated);
  if (!checked.valid) throw new Error(`Legacy drill could not be converted: ${checked.errors.join(' ')}`);
  return migrated;
}
export function copyPlayerDrill(drill: DrillDefinitionV2): DrillDefinitionV2 {
  const copy = structuredClone(drill), id = `drill-${crypto.randomUUID()}`;
  return { ...copy, id, title: `${copy.title} copy`.slice(0, 100), category: 'Custom',
    events: copy.events.map(event => ({ ...event, id: `event-${crypto.randomUUID()}` })), defaultRepetitions: copy.events.length };
}
export function snapshotPlayerShot(event: PlayerShotEventV2, drill: DrillDefinitionV2): PlayerShotEventV2 {
  return structuredClone({ ...normalizePlayerShot(event), intervalSeconds: event.intervalSeconds ?? drill.defaultInterval,
    rhythmPercent: event.rhythmPercent ?? drill.defaultRhythmPercent ?? 100,
    movementPercent: event.movementPercent ?? drill.defaultMovementPercent ?? 100 });
}
function normalizePlayerShot(event: PlayerShotEventV2): PlayerShotEventV2 {
  return { ...event, ball: normalizeDrillBall(event.ball),
    opponentReturn: { ...event.opponentReturn, ball: normalizeDrillBall(event.opponentReturn.ball) },
    ...(event.openingFeed ? { openingFeed: { ...event.openingFeed, ball: normalizeDrillBall(event.openingFeed.ball) } } : {}) };
}
