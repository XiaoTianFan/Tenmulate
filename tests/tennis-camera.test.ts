import { describe, expect, it } from 'vitest';
import { planTennisCamera, sampleTennisCamera, tennisCameraPhase, TENNIS_CAMERA, type TennisCameraPlanInput } from '../src/engine/session/tennisCamera';
import { sampleCameraTimeline, scaleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../src/domain/camera';
import { mirrorPlayerCamera } from '../src/content/playerHandedness';
import { resolveCourtFlight } from '../src/engine/session/courtFlight';
import { sampleTrajectoryAt } from '../src/engine/trajectory/physics';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';

const from = { lateral: -3, behindBaseline: 1.2, eyeHeight: 1.7, yaw: -5, pitch: -2, fov: 70 };
const input: TennisCameraPlanInput = { start: 0, opponentContact: 2, end: 4.5, from,
  to: { ...from, lateral: 3, yaw: 7 }, playerTarget: { x: 2.5, z: 10 }, currentFamily: 'groundstroke', nextFamily: 'groundstroke' };
const opponent = { x: 2.8, y: 0, z: 12.5 };
const sample = (plan: ReturnType<typeof planTennisCamera>, time: number, root = opponent) =>
  sampleTennisCamera(plan.from, plan.legs, { exchanges: [plan], motionScale: 1 }, time, root);
const settings: SessionSettings = { repetitions: 4, workBlockSize: 50, restSeconds: 0, mode: 'drill',
  launchSpeedKmh: 78, surface: 'hard', seed: '18427', variationPercent: 0, timingVariationPercent: 0,
  spin: 'preset', opponentHand: 'right', serveRhythm: 'normal' };

describe('tennis camera decisions and attention', () => {
  it('does not reveal the future lateral target, framing or flight time before the reaction', () => {
    const a = planTennisCamera(input), b = planTennisCamera({ ...input, end: 5.5, to: { ...input.to, lateral: -5, yaw: -110, pitch: 35 } });
    for (let time = .12; time <= a.reactAt; time += .02) expect(sample(a, time)).toEqual(sample(b, time));
    expect(sample(a, 1.8).yaw).toBeCloseTo(cameraLookAtCourtPoint(sample(a, 1.8), { ...opponent, y: 1.35 }).yaw, 8);
    expect(a.ready.lateral).toBeGreaterThan(from.lateral);
    expect(Math.abs(a.ready.lateral)).toBeLessThan(1.25);
    expect(a.legs.at(-1)!.start).toBeGreaterThan(input.opponentContact);
  });
  it('holds the ready position through the split and uses a small continuous eye dip', () => {
    const plan = planTennisCamera(input), contact = sample(plan, 2.04);
    expect(tennisCameraPhase(plan, 2.04)).toBe('split');
    expect(contact.lateral).toBe(plan.ready.lateral);
    expect(contact.eyeHeight).toBeLessThan(from.eyeHeight);
    expect(contact.eyeHeight).toBeGreaterThanOrEqual(from.eyeHeight - TENNIS_CAMERA.splitCompression);
    expect(sample(plan, plan.reactAt).eyeHeight).toBeCloseTo(from.eyeHeight, 10);
    expect(tennisCameraPhase(plan, 2.3)).toBe('receive');
  });
  it('carries a deliberate approach forward without predicting the next lateral volley', () => {
    const approach = { ...input, from: { ...from, behindBaseline: -3.8 }, to: { ...from, lateral: -1.6, behindBaseline: -7.5 }, nextFamily: 'volley' };
    const a = planTennisCamera(approach), b = planTennisCamera({ ...approach, to: { ...approach.to, lateral: 2 } });
    expect(a.strategy).toBe('approach'); expect(a.feasible).toBe(true);
    for (let time = .12; time <= 2.1; time += .02) expect(sample(a, time)).toEqual(sample(b, time));
    expect(sample(a, 1).behindBaseline).toBeLessThan(approach.from.behindBaseline);
    expect(sample(a, a.end).behindBaseline).toBe(approach.to.behindBaseline);
  });
  it('uses the known outgoing angle for recovery and keeps net players near the net', () => {
    const net = planTennisCamera({ ...input, from: { ...from, behindBaseline: -8 }, to: { ...input.to, behindBaseline: -8 } });
    expect(net.ready.behindBaseline).toBe(-8);
    const mirrored = planTennisCamera({ ...input, from: mirrorPlayerCamera(from), to: mirrorPlayerCamera(input.to), playerTarget: { ...input.playerTarget, x: -input.playerTarget.x } });
    const original = planTennisCamera(input);
    for (const time of [.4, 1.2, 2, 2.6, 3.8, 4.5]) {
      const a = sample(original, time), b = sample(mirrored, time, { ...opponent, x: -opponent.x });
      expect(b.lateral).toBeCloseTo(-a.lateral, 9); expect(b.yaw).toBeCloseTo(-a.yaw, 9);
      expect(b.pitch).toBeCloseTo(a.pitch, 9); expect(b.behindBaseline).toBe(a.behindBaseline);
    }
  });
  it('shifts toward the actual incoming ball while retaining the opponent inside the fixed view', () => {
    const plan = planTennisCamera(input), incoming = resolveCourtFlight({ source: { ...opponent, y: 1.05 }, target: { x: -3, z: -9 },
      landingZone: { minX: -3.5, maxX: -2.5, minZ: -9.5, maxZ: -8.5 }, family: 'groundstroke', spin: 'flat', spinRateRpm: 0,
      launchSpeedKmh: 70, minimumNetClearanceM: .25, trajectoryMode: 'natural', surface: 'hard' });
    const time = 2.9, observed = sample({ ...plan, incoming }, time), watch = sample(plan, time);
    const ball = sampleTrajectoryAt(incoming, time - plan.opponentContact, false), ballLook = cameraLookAtCourtPoint(observed, ball);
    expect(Math.abs(wrapCameraAngle(observed.yaw - ballLook.yaw))).toBeLessThan(Math.abs(wrapCameraAngle(watch.yaw - ballLook.yaw)));
    expect(Math.abs(wrapCameraAngle(observed.yaw - cameraLookAtCourtPoint(observed, opponent).yaw))).toBeLessThan(from.fov / 2);
    for (const aspect of [.6, 1.77, 3.5]) for (const t of [1, 2.2, 2.9, 4.3])
      expect(sampleTennisCamera(from, plan.legs, { exchanges: [{ ...plan, incoming }], motionScale: 1 }, t, opponent, aspect).fov).toBe(from.fov);
  });
  it('settles into the authored contact view and samples identically after seeking', () => {
    const plan = planTennisCamera(input), expected = sample(plan, 3.1);
    for (const time of [4.5, .02, 2.45, 1.8]) sample(plan, time);
    expect(sample(plan, 3.1)).toEqual(expected);
    expect(sample(plan, 0)).toEqual(from);
    expect(sample(plan, plan.settleAt)).toEqual(plan.to);
    expect(sample(plan, plan.end)).toEqual(plan.to);
  });
  it('rejects impossible post-contact travel instead of moving before the hit', () => {
    const plan = planTennisCamera({ ...input, end: 2.5, to: { ...input.to, lateral: 7, behindBaseline: 6 } });
    expect(plan.feasible).toBe(false);
    expect(plan.legs.at(-1)!.start).toBeGreaterThan(input.opponentContact);
  });
});

describe('compiled camera and rally integration', () => {
  it.each(['quick-rally', 'serve-volley', 'net-overhead', 'baseline-short-deep'])('keeps %s continuous at 240 Hz across every shot boundary', id => {
    const drill = PLAYER_DRILLS.find(d => d.id === id)!, session = compileSession(drill, { ...settings, repetitions: drill.events.length });
    expect(session.planningIssues).toEqual([]);
    const motion = session.repetitions.map(motionEvent), dt = 1 / 240;
    let previous = sampleCameraTimeline(session.cameraTimeline, 0), velocity = { x: 0, z: 0 };
    for (let time = dt; time <= session.duration; time += dt) {
      const pose = sampleCameraTimeline(session.cameraTimeline, time, sampleOpponentTimeline(motion, time)?.root);
      const v = { x: (pose.lateral - previous.lateral) / dt, z: (pose.behindBaseline - previous.behindBaseline) / dt };
      expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(TENNIS_CAMERA.maxSpeed + .01);
      expect(Math.hypot(v.x - velocity.x, v.z - velocity.z) / dt).toBeLessThanOrEqual(TENNIS_CAMERA.maxAcceleration + .1);
      expect(Math.abs(wrapCameraAngle(pose.yaw - previous.yaw)) / dt).toBeLessThan(110);
      expect(Math.abs(pose.pitch - previous.pitch) / dt).toBeLessThan(110);
      previous = pose; velocity = v;
    }
  });
  it('keeps old per-shot zoom values out of playback and supports reduced motion without recompiling physics', () => {
    const base = PLAYER_DRILLS[0]!, drill = { ...base, events: base.events.map((event, i) => ({ ...event, camera: { ...event.camera, fov: i ? 130 : 50 } })) };
    const session = compileSession(drill, settings), fixed = scaleCameraTimeline(session.cameraTimeline, 0);
    expect(session.planningIssues).toEqual([]);
    for (let time = 0; time < session.duration; time += .05) {
      expect(sampleCameraTimeline(session.cameraTimeline, time, opponent).fov).toBe(50);
      expect(sampleCameraTimeline(fixed, time, opponent)).toEqual(session.cameraTimeline.initial);
    }
    expect(session.playerEvents!.map(event => event.event.camera.fov)).toEqual([50, 50, 50, 50]);
    expect(drill.events[1]!.camera.fov).toBe(130);
  });
});
