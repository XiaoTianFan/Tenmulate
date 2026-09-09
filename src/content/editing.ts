import type { DrillDefinitionV1, DrillEventV1 } from './types';
import { SHOT_BY_ID, drillShotPace } from './bundled';
import { DEFAULT_DRILL_CAMERA } from '../engine/session/cameraTimeline';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { defaultSpinRateRpm } from '../engine/trajectory/physics';
import { normalizeLandingZone } from '../engine/trajectory/landingZone';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';
import { strokeForShot } from '../engine/session/opponentTimeline';
import { DEFAULT_RETURN_LANDING_ZONE } from '../engine/session/returnLandingZone';
import { resolveReturnShot } from '../engine/session/returnShot';
import { normalizeShotSpin } from '../domain/shotKinds';

export const eventCamera = (event: DrillEventV1, previous = DEFAULT_DRILL_CAMERA): CameraConfiguration => {
  const motion = event.cameraMotion === undefined ? SHOT_BY_ID.get(event.shotId)?.cameraMotion : event.cameraMotion;
  return event.camera ?? (motion ? {...previous,...motion.to} : previous);
};

/** Resolve inherited defaults before saving, so reuse in another drill is stable. */
export function snapshotShot(event: DrillEventV1, drill: DrillDefinitionV1, camera: CameraConfiguration): DrillEventV1 {
  const shot = SHOT_BY_ID.get(event.shotId)!;
  const spin = normalizeShotSpin(shot.family, event.spin && event.spin !== 'preset' ? event.spin : shot.spin);
  const index = Math.max(0,materializeEvents(drill).findIndex(item=>item.id===event.id));
  const clip = strokeForShot({...shot,stroke:event.stroke??shot.stroke,spin,
    opponentHand:event.opponentHand??shot.opponentHand},index);
  return structuredClone({...event, label:event.label ?? shot.label,
    paceKmh:event.paceKmh ?? drillShotPace(shot), spin, spinRateRpm:event.spinRateRpm ?? defaultSpinRateRpm({...shot,spin}),
    target:event.target ?? shot.target, landingZone:normalizeLandingZone(event.landingZone,shot.family), variationPercent:event.variationPercent ?? 8,
    returnLandingZone:event.returnLandingZone ?? DEFAULT_RETURN_LANDING_ZONE,
    returnShot:resolveReturnShot(event.returnShot, SHOT_BY_ID.get(materializeEvents(drill)[(index + 1) % materializeEvents(drill).length]!.shotId)?.family),
    opponentPosition:undefined, opponentHand:event.opponentHand ?? shot.opponentHand,
    stroke:shot.family==='serve'?undefined:clip.startsWith('backhand')?'backhand':'forehand', serveRhythm:event.serveRhythm === 'preset' ? shot.serveRhythm : event.serveRhythm ?? shot.serveRhythm,
    netClearanceM:event.netClearanceM ?? shot.netClearanceM, cue:event.cue ?? shot.cue,
    bounceFactor:event.bounceFactor ?? 1, trajectoryMode:event.trajectoryMode ?? 'natural',
    rhythmPercent:event.rhythmPercent ?? drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval),
    movementPercent:event.movementPercent ?? drill.defaultMovementPercent ?? 100, intervalSeconds:event.intervalSeconds ?? drill.defaultInterval,
    camera, cameraMotion:null});
}

export const copyShotEvent = (event: DrillEventV1): DrillEventV1 => ({...structuredClone(event),id:`event-${crypto.randomUUID()}`});

export const materializeEvents = (drill: DrillDefinitionV1): readonly DrillEventV1[] =>
  drill.events?.length
    ? drill.events
    : drill.shotIds.map((shotId, index) => ({ id: `${drill.id}-event-${index + 1}`, shotId }));

export const createEditableCopy = (drill: DrillDefinitionV1): DrillDefinitionV1 => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const id = `${drill.id.replace(/-(copy|starter)(-[a-z0-9]+)?$/, '')}-copy-${suffix}`.slice(0, 64);
  const events = materializeEvents(drill).map((event, index) => ({ ...event, id: `${id}-event-${index + 1}` }));
  return {
    ...drill,
    id,
    title: `${drill.title} copy`,
    category: 'Custom',
    events,
    shotIds: events.map((event) => event.shotId),
    defaultRepetitions: events.length,
  };
};
