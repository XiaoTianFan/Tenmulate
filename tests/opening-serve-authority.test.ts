import { expect, it } from 'vitest';
import type { DrillDefinitionV2 } from '../src/content/types';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { playerDrillForHand } from '../src/content/playerHandedness';
import { defaultDrillSettings } from '../src/app/defaults';
import { compilePlayerDrill } from '../src/engine/session/compilePlayerDrill';
import { sampleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { motionEvent } from '../src/engine/session/opponentTimeline';
import { landsInZone } from '../src/engine/session/courtFlight';

// Stable reproduction of the edited Crosscourt serve returns opening. The wide
// zone used to make the receiver fitter reduce 173 km/h to about 103 km/h.
function fixture(): DrillDefinitionV2 {
  const drill = structuredClone(PLAYER_DRILLS.find(drill => drill.id === 'return-practice')!);
  const launch: DrillDefinitionV2['launch'] = { ...drill.launch, position: { x: 1.25, z: 12.4 },
    ball: { ...drill.launch.ball, paceKmh: 173, spin: 'flat', spinRateRpm: 600, variationPercent: 0, netClearanceM: .18 },
    landingZone: { minX: -3.7846113057676645, maxX: -.8947848517581987, minZ: -6.152598381467976, maxZ: -4.72182141988329 } };
  const events = drill.events.map((event, index) => index ? event : { ...event, camera: {
    eyeHeight: 1.7, behindBaseline: 2.5224715545495786, lateral: -3.205955147103643,
    yaw: 11.733395996093918, pitch: -2.0259582519527157, fov: 70 } });
  return { ...drill, launch, events };
}
const settings = (drill: ReturnType<typeof fixture>) => ({ ...defaultDrillSettings(drill), repetitions: 2, restSeconds: 0, seed: '18427' });

it.each(['right', 'left'] as const)('preserves opening serve speed and every authored camera component for %s-handed returns', hand => {
  const drill = playerDrillForHand(fixture(), hand);
  let previousArrival = Infinity;
  for (const speed of [100, 130, 150, 173]) {
    const changed = { ...drill, launch: { ...drill.launch, ball: { ...drill.launch.ball, paceKmh: speed } } };
    const session = compilePlayerDrill(changed, settings(changed));
    expect(session.planningIssues).toEqual([]);
    expect(session.cameraTimeline.initial).toEqual(changed.events[0]!.camera);
    expect(session.repetitions[0]!.trajectory.resolved.launchSpeedKmh).toBeCloseTo(speed, 8);
    expect(landsInZone(session.repetitions[0]!.trajectory)).toBe(true);
    const arrival = session.playerEvents![0]!.startTime - session.repetitions[0]!.startTime;
    expect(arrival).toBeLessThan(previousArrival); previousArrival = arrival;
    for (const event of session.playerEvents!) {
      const rep = session.repetitions[event.incomingIndex]!, start = motionEvent(rep).start;
      expect(event.contactCamera).toEqual(event.event.camera);
      for (let time = start; time <= event.startTime; time += 1 / 240) {
        expect(sampleCameraTimeline(session.cameraTimeline, time, { x: -2, y: 0, z: 12 })).toEqual(event.event.camera);
      }
      expect(event.trajectory.intent.source).toEqual(rep.reachability.contact!.position);
    }
    const isolated = compilePlayerDrill(changed, settings(changed), { eventId: changed.events[0]!.id, opening: true, initialOpening: true });
    expect(isolated.repetitions[0]!.trajectory.resolved).toEqual(session.repetitions[0]!.trajectory.resolved);
  }
});

it('does not refit the opening serve to satisfy the illustrative player return phase or pace', () => {
  const base = fixture(), original = compilePlayerDrill(base, settings(base));
  for (const timing of ['rise', 'apex', 'descent'] as const) {
    const drill = { ...base, events: base.events.map(event => ({ ...event, ball: { ...event.ball, contactTiming: timing, paceKmh: 100 } })) };
    const session = compilePlayerDrill(drill, settings(drill));
    expect(session.repetitions[0]!.trajectory).toEqual(original.repetitions[0]!.trajectory);
    expect(session.cameraTimeline.initial).toEqual(base.events[0]!.camera);
  }
});

it('keeps speed variation explicit and reports an infeasible fast serve without reducing its pace', () => {
  const base = fixture();
  const varied = { ...base, launch: { ...base.launch, ball: { ...base.launch.ball, variationPercent: 5 } } };
  const session = compilePlayerDrill(varied, settings(varied)), rep = session.repetitions[0]!;
  expect(rep.trajectory.resolved.launchSpeedKmh).toBeCloseTo(rep.shot.paceKmh, 8);
  expect(rep.shot.paceKmh).toBeGreaterThanOrEqual(173 * .95);
  expect(rep.shot.paceKmh).toBeLessThanOrEqual(173 * 1.05);
  const fast = { ...base, launch: { ...base.launch, ball: { ...base.launch.ball, paceKmh: 250 } } };
  const invalid = compilePlayerDrill(fast, settings(fast));
  expect(invalid.repetitions[0]!.trajectory.resolved.launchSpeedKmh).toBeCloseTo(250, 8);
  expect(invalid.planningIssues![0]!.message).toContain('speed cannot reach this landing zone');
  expect(invalid.cameraTimeline.initial).toEqual(fast.events[0]!.camera);
});
