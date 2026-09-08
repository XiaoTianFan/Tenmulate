import { describe, expect, it } from 'vitest';
import { solveLocomotion, LOCOMOTION_LIMITS } from '../src/engine/session/locomotion';
import { sampleTravel, travelDuration, planRecovery } from '../src/engine/session/opponentMovement';
import { motionEvent, OPPONENT_MOTION } from '../src/engine/session/opponentTimeline';
import { SHOTS } from '../src/content/bundled';

const origin = { x: 0, y: 0, z: 13 };
describe('speed and cadence based locomotion', () => {
  it.each([.7, .8, .9])('uses an athletic gait for the reproduced quick %s m adjustment', distance => {
    const duration = travelDuration(origin, { ...origin, x: distance }, 7.2, 12);
    const gait = solveLocomotion(distance, duration, 1);
    // Previously all three legal movements selected only walk-forward at
    // 1.48–1.68x source rate because none reached the 1.1 m distance gate.
    expect(gait.gait).toBe('jog'); expect(gait.run).toBeGreaterThan(.9);
    expect(gait.peakCadenceHz * OPPONENT_MOTION.clips['run-forward'].duration).toBeLessThan(1.1);
  });
  it('retains slow walking, short lateral adjustment and full running as distinct cases', () => {
    expect(solveLocomotion(3, 3 / (.7 * .85), 0).gait).toBe('walk');
    expect(solveLocomotion(.4, .4 / (.7 * .7), 1).gait).toBe('adjust');
    expect(solveLocomotion(7, travelDuration(origin, { ...origin, x: 7 }), 1).gait).toBe('run');
  });
  it('has no gait or stride jump across the former distance thresholds', () => {
    for (const distance of [.65, 1.1]) {
      const a = solveLocomotion(distance - .00001, (distance - .00001) / (.7 * 1.4), 1);
      const b = solveLocomotion(distance + .00001, (distance + .00001) / (.7 * 1.4), 1);
      for (const key of ['run', 'walk', 'adjust', 'stride', 'stance', 'lift'] as const) expect(Math.abs(a[key] - b[key])).toBeLessThan(.0001);
    }
  });
  it('bounds active clip rates and changes step length continuously over the speed range', () => {
    for (const distance of [.4, .8, 4]) for (const lateral of [0, 1]) {
      let previous = solveLocomotion(distance, distance / (.7 * .2), lateral);
      for (let speed = .21; speed <= 7.2; speed += .01) {
        const gait = solveLocomotion(distance, distance / (.7 * speed), lateral);
        expect(gait.run + gait.walk + gait.adjust).toBeCloseTo(1, 9);
        expect(Math.abs(gait.stride - previous.stride)).toBeLessThan(.035);
        for (const [weight, clip, ceiling] of [[gait.walk, 'walk-forward', LOCOMOTION_LIMITS.walkRate],
          [gait.adjust, 'move-left', LOCOMOTION_LIMITS.adjustmentRate], [gait.run, 'run-forward', LOCOMOTION_LIMITS.runRate]] as const) {
          if (weight > .001) expect(gait.peakCadenceHz * OPPONENT_MOTION.clips[clip].duration).toBeLessThanOrEqual(ceiling + .00001);
        }
        previous = gait;
      }
    }
  });
  it.each(['left', 'right'] as const)('keeps a single phase for pose and feet and is invariant to seeks (%s)', hand => {
    const leg = { from: origin, to: { ...origin, x: .9 }, start: 0,
      end: travelDuration(origin, { ...origin, x: .9 }, 7.2, 12), fromYaw: Math.PI, toYaw: Math.PI, stage: 'approach' as const };
    for (let time = .15; time < leg.end - .15; time += 1 / 120) {
      const pose = sampleTravel(leg, time, hand);
      sampleTravel(leg, time + 5, hand);
      expect(sampleTravel(leg, time, hand)).toEqual(pose);
      for (const layer of pose.layers.filter(l => l.weight > .001 && l.clip !== 'ready'))
        expect(layer.time / OPPONENT_MOTION.clips[layer.clip].duration).toBeCloseTo(pose.movement!.phase % 1, 8);
      expect(pose.layers.reduce((sum, l) => sum + l.weight, 0)).toBeCloseTo(1, 8);
    }
  });
  it('uses the next shot movement preference for approach without accelerating the preceding recovery', () => {
    const a = motionEvent({ index: 0, startTime: 3, movementRate: .65,
      shot: { ...SHOTS[0]!, source: { x: 3, y: 1.1, z: 12.8 } } });
    const b = motionEvent({ index: 1, startTime: 25, movementRate: .65,
      shot: { ...SHOTS[0]!, source: { x: -3, y: 1.1, z: 12.8 } } });
    const slow = planRecovery(a, b), fast = planRecovery(a, { ...b, movementRate: 2.5 });
    expect(fast.recover).toEqual(slow.recover);
    expect(fast.approach!.end - fast.approach!.start).toBeLessThan(slow.approach!.end - slow.approach!.start);
    expect(fast.approach!.end).toBeCloseTo(b.start, 8);
  });
});
