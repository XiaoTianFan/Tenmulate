import { describe, expect, it } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { DEFAULT_RETURN_LANDING_ZONE, isReturnLandingZone, RETURN_LANDING_LIMITS } from '../src/engine/session/returnLandingZone';
import { editLandingZone } from '../src/engine/trajectory/landingZone';
import { isSavedShot, parseDrillJson, validateDrill } from '../src/content/validation';
import { snapshotShot } from '../src/content/editing';
import { DEFAULT_DRILL_CAMERA } from '../src/engine/session/cameraTimeline';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { MAX_OPPONENT_SPEED } from '../src/engine/session/opponentMovement';

const settings: SessionSettings = { repetitions: 3, mode: 'drill', shotIntervalSeconds: 3.5, rhythmPercent: 100,
  variationPercent: 0, timingVariationPercent: 0, launchSpeedKmh: 75, surface: 'hard', seed: 'return-zones',
  spin: 'preset', opponentHand: 'right', workBlockSize: 50, restSeconds: 0, serveRhythm: 'normal', cameraMotionScale: 0 };
const left = { minX: -3.2, maxX: -1.8, minZ: 7, maxZ: 9 };
const right = { ...left, minX: 1.8, maxX: 3.2 };
const drill = (zone = left) => ({ ...DRILLS[0]!, shotIds: ['body-neutral'],
  events: [{ id: 'a', shotId: 'body-neutral', returnLandingZone: zone, cameraMotion: null }] });

describe('opponent-side return landing zones', () => {
  it('derives the next emitter from the returned flight and responds to moving the zone', () => {
    const a = compileSession(drill(), settings), b = compileSession(drill(right), settings);
    expect(a.repetitions[0]!.trajectory).toEqual(b.repetitions[0]!.trajectory);
    expect(a.repetitions[0]!.rallyReturn).toBeDefined(); expect(b.repetitions[0]!.rallyReturn).toBeDefined();
    expect(a.repetitions[1]!.shot.source.x).toBeLessThan(-1);
    expect(b.repetitions[1]!.shot.source.x).toBeGreaterThan(1);
    for (const session of [a, b]) {
      for (const rep of session.repetitions.filter(rep => rep.rallyReturn)) {
        const rally = rep.rallyReturn!, next = session.repetitions[rep.index + 1]!;
        expect(rally.trajectory.samples.at(-1)!.position).toEqual(next.trajectory.intent.source);
        expect(next.shot.source).toEqual(next.trajectory.intent.source);
        expect(rep.startTime + rally.contactTime + rally.duration).toBeCloseTo(next.startTime, 8);
        const bounce = rally.trajectory.events.find(e => e.type === 'bounce')!;
        expect(Math.hypot(bounce.position.x-rally.trajectory.intent.target.x, bounce.position.z-rally.trajectory.intent.target.z)).toBeLessThan(.04);
      }
      const events = session.repetitions.map(motionEvent);
      let previous = sampleOpponentTimeline(events, 0)!;
      for (let time = 1/120; time < session.duration; time += 1/120) {
        const current = sampleOpponentTimeline(events, time)!;
        expect(Math.hypot(current.root.x-previous.root.x, current.root.z-previous.root.z)*120).toBeLessThan(MAX_OPPONENT_SPEED+.02);
        previous = current;
      }
    }
  });
  it('does not translate the return with the camera or legacy opponent coordinates', () => {
    const a = compileSession(drill(), settings);
    const b = compileSession({ ...drill(), returnZone: { forward: .5, width: .4, depth: .2 },
      events: [{ ...drill().events[0]!, opponentPosition: { x: 7, z: 17 } }] },
      { ...settings, camera: { ...DEFAULT_DRILL_CAMERA, lateral: 6, behindBaseline: -8, yaw: 130 } });
    expect(a.repetitions.map(rep => rep.rallyReturn)).toEqual(b.repetitions.map(rep => rep.rallyReturn));
    expect(a.repetitions.map(rep => rep.shot.source)).toEqual(b.repetitions.map(rep => rep.shot.source));
    expect(a).toEqual(compileSession(drill(), settings));
  });
  it('keeps the sampled return target stable when rhythm changes', () => {
    const a = compileSession(drill(), settings), b = compileSession(drill(), { ...settings, shotIntervalSeconds: 3 });
    expect(a.repetitions[0]!.rallyReturn?.trajectory.intent.target).toEqual(b.repetitions[0]!.rallyReturn?.trajectory.intent.target);
  });
  it('round-trips both zones in saved presets and validates opponent-side dimensions', () => {
    const event = { ...drill().events[0]!, target: { x: -1, z: -9 }, landingZone: { width: 2, depth: 3 } };
    const snapshot = snapshotShot(event, drill(), DEFAULT_DRILL_CAMERA);
    expect(snapshot.returnLandingZone).toEqual(left); expect(snapshot.landingZone).toEqual(event.landingZone);
    expect(isSavedShot({ id: 'zone-preset', name: 'Wide rally', event: snapshot })).toBe(true);
    expect(parseDrillJson(JSON.stringify({ ...drill(), events: [snapshot] })).events![0]).toEqual(snapshot);
    for (const zone of [{ ...left, minZ: -1 }, { ...left, maxX: 7 }, { ...left, maxZ: Infinity }, { ...left, maxZ: 7.1 }, { ...left, camera: 1 }]) {
      expect(isReturnLandingZone(zone)).toBe(false);
      expect(validateDrill({ ...drill(), events: [{ ...event, returnLandingZone: zone }] }).valid).toBe(false);
    }
    const resized = editLandingZone(DEFAULT_RETURN_LANDING_ZONE, { x: 1, z: 1 }, 100, 100, RETURN_LANDING_LIMITS);
    expect(isReturnLandingZone(resized)).toBe(true);
    expect(resized.minX).toBe(DEFAULT_RETURN_LANDING_ZONE.minX);
    expect(resized.minZ).toBe(DEFAULT_RETURN_LANDING_ZONE.minZ);
  });
});
