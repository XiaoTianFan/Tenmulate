import { describe, expect, it } from 'vitest';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { defaultDrillSettings } from '../src/app/defaults';
import { compilePlayerDrill } from '../src/engine/session/compilePlayerDrill';
import { landsInZone, playerContactAnchor } from '../src/engine/session/courtFlight';
import { playerDrillForHand } from '../src/content/playerHandedness';
import type { DrillDefinitionV2 } from '../src/content/types';

const original = PLAYER_DRILLS.find(drill => drill.id === 'tactical-pattern')!;
function preview(drill = original, index = 0, surface: 'hard' | 'clay' = 'hard', opening = false) {
  return compilePlayerDrill(drill, { ...defaultDrillSettings(drill), surface, repetitions: drill.events.length, restSeconds: 0 },
    { eventId: drill.events[index]!.id, opening });
}
const edit = () => structuredClone(original) as { -readonly [K in keyof DrillDefinitionV2]: DrillDefinitionV2[K] } & { events: Array<DrillDefinitionV2['events'][number]> };

describe('selected shot physics independent of sequence validation', () => {
  it('updates the current response zone, actual bounce and flight together even if the next camera is unreachable', () => {
    const before = preview(), drill = edit(), event = drill.events[0]!;
    drill.events[0] = { ...event, opponentReturn: { ...event.opponentReturn, landingZone: { minX: 1.5, maxX: 3.5, minZ: -10.5, maxZ: -8.5 } } };
    const after = preview(drill), paths = after.shotPreview!;
    expect(after.planningIssues).toEqual([]);
    expect(paths.opponent!.intent.landingZone).toEqual(drill.events[0]!.opponentReturn.landingZone);
    expect(paths.opponent!.intent.target).not.toEqual(before.shotPreview!.opponent!.intent.target);
    expect(landsInZone(paths.opponent!)).toBe(true);
    expect(paths.player).toEqual(before.shotPreview!.player);
    const full = compilePlayerDrill(drill, { ...defaultDrillSettings(drill), repetitions: drill.events.length });
    expect(full.planningIssues!.length).toBeGreaterThan(0);
    expect(full.shotPreview).toBeUndefined();
  });

  it('recomputes the opponent contact from the edited player flight and preserves the handoff', () => {
    const before = preview(), drill = edit(), event = drill.events[0]!;
    drill.events[0] = { ...event, landingZone: { minX: -1, maxX: 1, minZ: 7, maxZ: 9 } };
    const after = preview(drill), paths = after.shotPreview!;
    expect(after.planningIssues).toEqual([]);
    expect(landsInZone(paths.player!)).toBe(true);
    expect(landsInZone(paths.opponent!)).toBe(true);
    expect(paths.opponent!.intent.source).not.toEqual(before.shotPreview!.opponent!.intent.source);
    const [player, response] = after.scheduledFlights!;
    expect(player!.trajectory.samples.at(-1)!.position).toEqual(response!.trajectory.intent.source);
    expect(player!.endTime).toBe(response!.startTime);
  });

  it('responds to both ball settings, camera position and surface without resampling the target', () => {
    const before = preview(), drill = edit(), event = drill.events[0]!;
    drill.events[0] = { ...event, ball: { ...event.ball, spin: 'flat', spinRateRpm: 400, paceKmh: 80 },
      opponentReturn: { ...event.opponentReturn, ball: { ...event.opponentReturn.ball, spin: 'topspin', spinRateRpm: 1800, paceKmh: 85 } },
      camera: { ...event.camera, lateral: event.camera.lateral + .4 } };
    const after = preview(drill), paths = after.shotPreview!;
    expect(after.planningIssues).toEqual([]);
    expect(paths.player!.intent.source).toEqual(playerContactAnchor(drill.events[0]!));
    expect(paths.player!.intent.target).toEqual(before.shotPreview!.player!.intent.target);
    expect(paths.player!.intent.spin).toBe('flat');
    expect(paths.opponent!.intent.spin).toBe('topspin');
    expect(paths.opponent!.samples).not.toEqual(before.shotPreview!.opponent!.samples);
    const clay = preview(drill, 0, 'clay').shotPreview!;
    expect(clay.player!.intent.surface).toBe('clay');
    expect(clay.player!.samples).not.toEqual(paths.player!.samples);
  });

  it('previews a final shot and its reusable response despite an unreachable preceding opening', () => {
    const drill = edit();
    drill.launch = { ...drill.launch, landingZone: { minX: 1, maxX: 3, minZ: -3, maxZ: -1 } };
    const result = preview(drill, drill.events.length - 1);
    expect(result.planningIssues).toEqual([]);
    expect(result.shotPreview!.player).toBeDefined();
    expect(result.shotPreview!.opponent).toBeDefined();
    expect(result.scheduledFlights!.map(flight => flight.phase)).toEqual(['player', 'response']);
  });

  it('refreshes an opening independently and mirrors target quantiles deterministically', () => {
    const drill = edit();
    drill.launch = { ...drill.launch, landingZone: { minX: 1, maxX: 3, minZ: -9, maxZ: -7 } };
    const opening = preview(drill, 0, 'hard', true);
    expect(opening.shotPreview!.opponent!.intent.landingZone).toEqual(drill.launch.landingZone);
    expect(landsInZone(opening.shotPreview!.opponent!)).toBe(true);
    const right = preview().shotPreview!, left = preview(playerDrillForHand(original, 'left')).shotPreview!;
    expect(left.player!.intent.target.x).toBeCloseTo(-right.player!.intent.target.x, 8);
    expect(left.opponent!.intent.target.x).toBeCloseTo(-right.opponent!.intent.target.x, 8);
    expect(left.opponent!.intent.opponentHand).toBe(right.opponent!.intent.opponentHand);
    expect(preview().shotPreview).toEqual(right);
  });

  it('reports an impossible response without retaining another event’s trajectory', () => {
    const drill = edit(), event = drill.events[0]!;
    drill.events[0] = { ...event, ball: { ...event.ball, spin: 'slice', spinRateRpm: 1800, paceKmh: 95 } };
    const result = preview(drill);
    expect(result.planningIssues!.length).toBeGreaterThan(0);
    expect(result.shotPreview!.player!.intent.spin).toBe('slice');
    expect(result.shotPreview!.opponent).toBeUndefined();
    expect(result.repetitions).toEqual([]);
    expect(result.scheduledFlights!.map(flight => flight.owner)).toEqual(['player']);
  });
});
