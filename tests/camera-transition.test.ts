import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrillCameraTransition } from '../src/content/types';
import { planTennisCamera, sampleTennisCamera, TENNIS_CAMERA, type TennisCameraPlanInput } from '../src/engine/session/tennisCamera';
import { sampleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../src/domain/camera';
import { resolveCourtFlight } from '../src/engine/session/courtFlight';
import { sampleTrajectoryAt } from '../src/engine/trajectory/physics';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { compileSession } from '../src/engine/session/compileSession';
import { defaultDrillSettings } from '../src/app/defaults';
import { mirrorCameraTransition, playerDrillForHand } from '../src/content/playerHandedness';
import { copyPlayerDrill, parsePlayerDrillJson, snapshotPlayerShot } from '../src/content/playerMigration';
import { validatePlayerDrill, isPlayerSavedShot } from '../src/content/playerValidation';
import { DEFAULT_APP_DATA, loadAppData, saveAppData } from '../src/storage/appStorage';

const from = { lateral: -2, behindBaseline: 1.2, eyeHeight: 1.7, yaw: 0, pitch: -1, fov: 70 };
const input: TennisCameraPlanInput = { start: 0, opponentContact: 3, end: 6, from, to: { ...from, lateral: 2, yaw: 10 },
  playerTarget: { x: 2, z: 10 }, currentFamily: 'groundstroke', nextFamily: 'groundstroke' };
const root = { x: 2, y: 0, z: 12 };
const sample = (plan: ReturnType<typeof planTennisCamera>, time: number) => sampleTennisCamera(from, plan.legs, { exchanges: [plan], motionScale: 1 }, time, root);
const configured = (configuration: DrillCameraTransition) => planTennisCamera({ ...input, configuration });
const fixture: DrillCameraTransition = { movement: { destination: 'waypoint', start: 'player-hit', resume: 'after-split',
  delaySeconds: .1, resumeDelaySeconds: .05, pacePercent: 120, waypoint: { lateral: -.8, behindBaseline: 1.1, eyeHeight: 1.7 } },
  focus: { beforeReturn: { mode: 'direction', direction: { yaw: 18, pitch: -4 } }, afterReturn: { mode: 'point', point: { x: -2, y: 1.2, z: 9 } } } };
afterEach(() => vi.unstubAllGlobals());

describe('authored camera routes', () => {
  it('keeps every Automatic choice identical to the existing causal path', () => {
    const auto = planTennisCamera(input), explicit = configured({ movement: { destination: 'auto', start: 'auto', resume: 'auto' },
      focus: { beforeReturn: { mode: 'auto' }, afterReturn: { mode: 'auto' } } });
    for (let t = 0; t <= 6; t += .017) expect(sample(explicit, t)).toEqual(sample(auto, t));
  });
  it('allows direct early movement or movement delayed until after the split independently of focus', () => {
    const early = configured({ movement: { destination: 'next-shot', start: 'player-hit' } });
    const late = configured({ movement: { destination: 'next-shot', start: 'after-split', delaySeconds: .25 } });
    expect(early.feasible).toBe(true); expect(late.feasible).toBe(true);
    expect(sample(early, 1).lateral).toBeGreaterThan(from.lateral);
    expect(sample(late, 3.3).lateral).toBe(from.lateral);
    expect(late.legs[0]!.start).toBeCloseTo(3.4);
    expect(sample(early, 6)).toEqual(early.to); expect(sample(late, 6)).toEqual(late.to);
  });
  it('reaches and holds the exact waypoint, then resumes without cuts or excess acceleration', () => {
    const plan = configured(fixture);
    expect(plan.feasible).toBe(true); expect(plan.legs).toHaveLength(2);
    const [first, second] = plan.legs;
    expect(sample(plan, (first!.end + second!.start) / 2)).toMatchObject(fixture.movement!.waypoint!);
    expect(second!.start).toBeCloseTo(3.2);
    const dt = 1 / 240;
    let previous = sample(plan, 0), vx = 0, vz = 0;
    for (let time = dt; time <= 6; time += dt) {
      const pose = sample(plan, time), x = (pose.lateral - previous.lateral) / dt, z = (pose.behindBaseline - previous.behindBaseline) / dt;
      expect(Math.hypot(x, z)).toBeLessThan(TENNIS_CAMERA.maxSpeed + .01);
      expect(Math.hypot(x - vx, z - vz) / dt).toBeLessThan(TENNIS_CAMERA.maxAcceleration + .1);
      vx = x; vz = z; previous = pose;
    }
    expect(sample(plan, plan.settleAt)).toEqual(plan.to);
  });
  it('uses pace for both legs and rejects impossible routes instead of skipping a waypoint', () => {
    const a = configured({ ...fixture, movement: { ...fixture.movement!, pacePercent: 60 } });
    const b = configured({ ...fixture, movement: { ...fixture.movement!, pacePercent: 160 } });
    expect(a.legs[0]!.end).toBeGreaterThan(b.legs[0]!.end);
    expect(a.legs[1]!.end - a.legs[1]!.start).toBeGreaterThan(b.legs[1]!.end - b.legs[1]!.start);
    const impossible = planTennisCamera({ ...input, end: 3.6, configuration: fixture });
    expect(impossible.feasible).toBe(false);
    expect(impossible.ready).toMatchObject(fixture.movement!.waypoint!);
  });
});

describe('independent focus targets', () => {
  it.each(['opponent', 'next-shot', 'direction', 'point'] as const)('resolves %s without changing movement, shot endpoints or zoom', mode => {
    const choice = { mode, direction: { yaw: 16, pitch: -3 }, point: { x: -3, y: 1.5, z: 9 } };
    const base = planTennisCamera(input), plan = configured({ focus: { beforeReturn: choice, afterReturn: choice } });
    expect(plan.legs).toEqual(base.legs);
    const pose = sample(plan, 1.8);
    const expected = mode === 'opponent' ? cameraLookAtCourtPoint(pose, { ...root, y: 1.35 })
      : mode === 'next-shot' ? plan.to : mode === 'direction' ? choice.direction : cameraLookAtCourtPoint(pose, choice.point);
    expect(pose.yaw).toBeCloseTo(expected.yaw, 8); expect(pose.pitch).toBeCloseTo(expected.pitch, 8);
    expect(pose.fov).toBe(from.fov); expect(sample(plan, 0)).toEqual(from); expect(sample(plan, 6)).toEqual(plan.to);
  });
  it('follows the actual outgoing and incoming ball, smoothly changing at the physical contact', () => {
    const outgoing = resolveCourtFlight({ source: { x: -2, y: 1, z: -12 }, target: { x: 2, z: 10 },
      landingZone: { minX: 1, maxX: 3, minZ: 9, maxZ: 11 }, family: 'groundstroke', spin: 'flat', spinRateRpm: 0,
      launchSpeedKmh: 70, minimumNetClearanceM: .25, trajectoryMode: 'natural', surface: 'hard' });
    const incoming = resolveCourtFlight({ ...outgoing.intent, source: { x: 2, y: 1, z: 12 }, target: { x: -2, z: -10 },
      landingZone: { minX: -3, maxX: -1, minZ: -11, maxZ: -9 }, family: 'groundstroke', spin: 'flat', spinRateRpm: 0,
      launchSpeedKmh: 70, minimumNetClearanceM: .25, trajectoryMode: 'natural', surface: 'hard' });
    const plan = { ...configured({ focus: { beforeReturn: { mode: 'ball' }, afterReturn: { mode: 'ball' } } }), outgoing, incoming };
    const pose = sample(plan, 1.8), aim = cameraLookAtCourtPoint(pose, sampleTrajectoryAt(outgoing, 1.8, false));
    expect(pose.yaw).toBeCloseTo(aim.yaw, 8); expect(pose.pitch).toBeCloseTo(aim.pitch, 8);
    const before = sample(plan, 3 - 1e-5), after = sample(plan, 3 + 1e-5);
    expect(Math.abs(wrapCameraAngle(after.yaw - before.yaw))).toBeLessThan(.01);
    expect(Math.abs(after.pitch - before.pitch)).toBeLessThan(.01);
    const received = sample(plan, 4), receivedAim = cameraLookAtCourtPoint(received, sampleTrajectoryAt(incoming, 1, false));
    expect(received.yaw).toBeCloseTo(receivedAim.yaw, 8);
  });
  it('changes targets on a smooth angular branch across opponent contact', () => {
    const plan = configured({ focus: { beforeReturn: { mode: 'direction', direction: { yaw: 18, pitch: -3 } },
      afterReturn: { mode: 'direction', direction: { yaw: -20, pitch: -5 } } } });
    expect(sample(plan, 3).yaw).toBeCloseTo(18, 8);
    expect(sample(plan, 4).yaw).toBeCloseTo(-20, 8);
    const a = sample(plan, 3 - 1e-5), b = sample(plan, 3 + 1e-5);
    expect(Math.abs(wrapCameraAngle(a.yaw - b.yaw))).toBeLessThan(.01);
  });
  it('does not cut when a custom focus pan crosses the +/-180 degree boundary', () => {
    const plan = configured({ focus: { beforeReturn: { mode: 'direction', direction: { yaw: 179, pitch: -3 } },
      afterReturn: { mode: 'direction', direction: { yaw: -179, pitch: -3 } } } });
    let previous = sample(plan, 0);
    for (let time = 1 / 240; time <= 6; time += 1 / 240) {
      const pose = sample(plan, time);
      expect(Math.abs(wrapCameraAngle(pose.yaw - previous.yaw))).toBeLessThan(1);
      previous = pose;
    }
    expect(sample(plan, 6)).toEqual(plan.to);
  });
});

describe('drill, preset and handedness contracts', () => {
  it('persists transition settings in local drills and saved shots and mirrors only court coordinates', () => {
    const source = PLAYER_DRILLS[0]!, event = { ...source.events[0]!, cameraTransition: fixture };
    const drill = { ...source, events: [event, ...source.events.slice(1)] };
    const shot = { schemaVersion: 2 as const, id: 'saved-transition', name: event.label, event: snapshotPlayerShot(event, drill) };
    expect(isPlayerSavedShot(shot)).toBe(true);
    const data = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    saveAppData({ ...DEFAULT_APP_DATA, customDrills: [drill], savedShots: [shot] });
    expect(loadAppData().customDrills[0]!.events[0]!.cameraTransition).toEqual(fixture);
    expect(loadAppData().savedShots[0]!.event.cameraTransition).toEqual(fixture);
    expect(parsePlayerDrillJson(JSON.stringify(drill)).events[0]!.cameraTransition).toEqual(fixture);
    expect(copyPlayerDrill(drill).events[0]!.cameraTransition).toEqual(fixture);
    const left = playerDrillForHand(drill, 'left');
    expect(left.events[0]!.cameraTransition).toEqual(mirrorCameraTransition(fixture));
    expect(left.events[0]!.opponentReturn.ball.hand).toBe(event.opponentReturn.ball.hand);
    expect(playerDrillForHand(left, 'right').events[0]).toEqual(event);
    expect(mirrorCameraTransition(mirrorCameraTransition(fixture))).toEqual(fixture);
  });
  it.each([
    { movement: { destination: 'teleport' } }, { movement: { destination: 'waypoint' } },
    { movement: { destination: 'neutral', delaySeconds: NaN } }, { movement: { destination: 'neutral', pacePercent: 900 } },
    { movement: { destination: 'neutral', waypoint: { lateral: 0, behindBaseline: 0, eyeHeight: 1.7, fov: 20 } } },
    { focus: { beforeReturn: { mode: 'direction' } } }, { focus: { afterReturn: { mode: 'point', point: { x: Infinity, y: 1, z: 0 } } } },
    { focus: { afterReturn: { mode: 'zoom', fov: 20 } } },
  ])('rejects invalid configuration %j', cameraTransition => {
    const source = PLAYER_DRILLS[0]!;
    expect(validatePlayerDrill({ ...source, events: [{ ...source.events[0], cameraTransition }] }).valid).toBe(false);
  });
  it('compiles custom movement into the connected rally and keeps focus-only timing identical', () => {
    const base = PLAYER_DRILLS[0]!, settings = { ...defaultDrillSettings(base), repetitions: base.events.length, restSeconds: 0 };
    const a = compileSession(base, settings);
    const withFocus = { ...base, events: base.events.map(event => ({ ...event, cameraTransition: { focus: fixture.focus } })) };
    const b = compileSession(withFocus, settings);
    expect(b.planningIssues).toEqual([]);
    expect(b.playerEvents!.map(event => event.startTime)).toEqual(a.playerEvents!.map(event => event.startTime));
    const withRoute = { ...base, events: base.events.map(event => ({ ...event,
      cameraTransition: { movement: { destination: 'next-shot' as const, start: 'player-hit' as const } } })) };
    const c = compileSession(withRoute, settings);
    expect(c.planningIssues).toEqual([]);
    expect(c.cameraTimeline.tennis!.exchanges.filter(exchange => exchange.strategy === 'custom')).toHaveLength(base.events.length - 1);
    for (const exchange of c.cameraTimeline.tennis!.exchanges) expect(sampleCameraTimeline(c.cameraTimeline, exchange.end, root)).toEqual(exchange.to);
  });
  it('applies authored transitions across a new-point opening as well as continuous rallies', () => {
    const base = PLAYER_DRILLS.find(drill => drill.id === 'return-practice')!;
    const drill = { ...base, events: base.events.map(event => ({ ...event,
      cameraTransition: { movement: { destination: 'next-shot' as const, start: 'player-hit' as const }, focus: fixture.focus } })) };
    const session = compileSession(drill, { ...defaultDrillSettings(drill), repetitions: drill.events.length, restSeconds: 0 });
    expect(session.planningIssues).toEqual([]);
    const transition = session.cameraTimeline.tennis!.exchanges.find(exchange => exchange.start === session.playerEvents![0]!.startTime)!;
    expect(transition.strategy).toBe('custom'); expect(transition.configuration).toEqual(drill.events[0]!.cameraTransition);
    expect(transition.outgoing).toBeDefined(); expect(transition.incoming).toBeDefined();
    expect(sampleCameraTimeline(session.cameraTimeline, transition.end, root)).toEqual(drill.events[1]!.camera);
  });
  it('keeps the reset route and physical timing when only new-point focus is customized', () => {
    const base = PLAYER_DRILLS.find(drill => drill.id === 'return-practice')!;
    const settings = { ...defaultDrillSettings(base), repetitions: base.events.length, restSeconds: 0 };
    const original = compileSession(base, settings);
    const changed = compileSession({ ...base, events: base.events.map(event => ({ ...event, cameraTransition: { focus: fixture.focus } })) }, settings);
    expect(changed.planningIssues).toEqual([]);
    expect(changed.cameraTimeline.transitions).toEqual(original.cameraTimeline.transitions);
    expect(changed.playerEvents!.map(e => e.startTime)).toEqual(original.playerEvents!.map(e => e.startTime));
  });
});
