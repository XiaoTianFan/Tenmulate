import { describe, expect, it } from 'vitest';
import { SHOTS, DRILL_BY_CATEGORY } from '../src/content/bundled';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { validatePlayerDrill } from '../src/content/playerValidation';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { motionEvent, type MotionRepetition } from '../src/engine/session/opponentTimeline';
import { resolveOpponentStroke } from '../src/engine/session/opponentStroke';
import { planRecovery, sampleTravel, travelDuration } from '../src/engine/session/opponentMovement';
import { defaultReturnShot } from '../src/engine/session/returnShot';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';

const base: MotionRepetition = { index: 0, startTime: 3, recoveryPolicy: 'direct',
  shot: { ...SHOTS[0]!, family: 'groundstroke', stroke: 'forehand', source: { x: .95, y: 1.1, z: 12.8 }, target: { x: 0, z: -9 } } };
const settings: SessionSettings = { mode: 'quick-practice', practiceShotType: 'groundstroke', practiceStroke: 'auto',
  repetitions: 6, workBlockSize: 6, restSeconds: 0, shotIntervalSeconds: 5, rhythmPercent: 100, movementPercent: 100,
  variationPercent: 0, timingVariationPercent: 0, launchSpeedKmh: 70, spin: 'topspin', spinRateRpm: 1103, surface: 'hard',
  seed: 'automatic-side', opponentHand: 'right', serveRhythm: 'normal', landingDepthM: 8.5, opponentPosition: { x: 0, z: 12.9 },
  rally: { landingZone: DEFAULT_RETURN_LANDING_ZONE, shot: defaultReturnShot('groundstroke'), opponentContactTiming: 'descent' } };

describe('shared opponent stroke selection and economical footwork', () => {
  it.each(['right', 'left'] as const)('chooses the nearby racket side relative to the body, independent of court origin or event parity (%s)', hand => {
    for (const courtX of [-3, 0, 3]) for (const side of ['forehand', 'backhand'] as const) {
      const a = { ...base, shot: { ...base.shot, opponentHand: hand, source: { ...base.shot.source, x: courtX } } };
      const root = motionEvent(a).root;
      const x = root.x + (side === 'forehand' ? .95 : -.95) * (hand === 'right' ? 1 : -1);
      const draft = { ...a, index: 1, startTime: 9, shot: { ...a.shot, source: { x, y: 1.1, z: 12.8 } } };
      const chosen = resolveOpponentStroke(a, draft);
      expect(chosen.shot.stroke).toBe(side);
      expect(resolveOpponentStroke(a, { ...draft, index: 12 }).shot.stroke).toBe(side);
      expect(chosen.shot.source).toEqual(draft.shot.source);
      expect(chosen.startTime).toBe(draft.startTime);
      expect(resolveOpponentStroke(a, draft, side === 'forehand' ? 'backhand' : 'forehand').shot.stroke).not.toBe(side);
    }
  });

  it('repeats a convenient side in a rally and maps legacy alternate to automatic', () => {
    const drill = DRILL_BY_CATEGORY.get('Quick Rally')!;
    const session = compileSession(drill, settings);
    expect(session.planningIssues ?? []).toEqual([]);
    expect(session.repetitions).toHaveLength(6);
    expect(session.repetitions.slice(1).some((r, i) => r.shot.stroke === session.repetitions[i]!.shot.stroke)).toBe(true);
    expect(compileSession(drill, { ...settings, practiceStroke: 'alternate' }).repetitions).toEqual(session.repetitions);
    for (const side of ['forehand', 'backhand'] as const) {
      const forced = compileSession(drill, { ...settings, practiceStroke: side });
      expect(forced.planningIssues ?? []).toEqual([]);
      expect(forced.repetitions.every(r => r.shot.stroke === side)).toBe(true);
    }
  });

  it('saves automatic opponents but retains explicit player shot identity', () => {
    const drill = structuredClone(PLAYER_DRILLS[0]!);
    expect(drill.events.every(e => e.opponentReturn.ball.stroke === 'auto')).toBe(true);
    expect(validatePlayerDrill(drill).valid).toBe(true);
    (drill.events[0]!.ball as { stroke: string }).stroke = 'auto';
    expect(validatePlayerDrill(drill).valid).toBe(false);
  });

  it.each(['right', 'left'] as const)('uses the same automatic reception in a player-authored corner drill (%s)', hand => {
    const drill = structuredClone(PLAYER_DRILLS.find(d => d.id === 'baseline-corner-switch')!);
    drill.launch.ball.hand = hand;
    for (const event of drill.events) event.opponentReturn.ball.hand = hand;
    const session = compileSession(drill, { ...settings, mode: 'drill', rally: undefined, repetitions: drill.events.length });
    expect(session.planningIssues ?? []).toEqual([]);
    expect(session.repetitions.slice(1).map(r => r.shot.stroke)).toEqual(hand === 'right'
      ? ['forehand', 'backhand'] : ['backhand', 'forehand']);
    expect(session.repetitions.slice(1).every(r => r.incomingContact?.phase === 'descent')).toBe(true);
  });

  it.each(['left', 'right'] as const)('uses finite small adjustments in every direction and running for urgent long travel (%s)', hand => {
    const from = { x: 0, y: 0, z: 13 };
    for (const [x, z] of [[.25, 0], [-.25, 0], [0, .25], [0, -.25], [.2, .2]]) {
      const to = { x: x!, y: 0, z: 13 + z! }, duration = travelDuration(from, to, 3.2, 4.4);
      const leg = { from, to, start: 0, end: duration, fromYaw: Math.PI, toYaw: Math.PI, stage: 'approach' as const };
      const mid = sampleTravel(leg, duration / 2, hand), end = sampleTravel(leg, duration, hand);
      expect(mid.movement!.gait).toBe('adjust');
      expect(mid.layers.some(l => l.clip.startsWith('move-') && l.weight > .9)).toBe(true);
      expect(mid.layers.some(l => l.clip === 'walk-forward' && l.weight > .01)).toBe(false);
      expect(mid.yaw).toBeCloseTo(Math.PI, 7);
      expect(end.root.x).toBeCloseTo(to.x, 8);
      expect(end.root.z).toBeCloseTo(to.z, 8);
      for (const foot of Object.values(mid.footTargets!)) expect(Math.hypot(foot.x - mid.root.x, foot.z - mid.root.z)).toBeLessThan(.8);
    }
    const to = { x: 5, y: 0, z: 13 }, duration = travelDuration(from, to);
    const pose = sampleTravel({ from, to, start: 0, end: duration, fromYaw: Math.PI, toYaw: Math.PI, stage: 'approach' }, duration / 2, hand);
    expect(pose.movement!.gait).toBe('run');
    expect(pose.layers.find(l => l.clip === 'run-forward')!.weight).toBeGreaterThan(.95);
  });

  it('holds a nearby neutral position and spends spare receiving time ready before a concise approach', () => {
    const a = { ...motionEvent(base), root: { x: .4, y: 0, z: 13.4 }, recoveryPolicy: 'auto' as const };
    const b = { ...a, index: 1, root: { x: .65, y: 0, z: 13.4 }, start: 9, end: 11, contactTime: 9.5,
      incomingContact: { releaseTime: 6, contactTime: 9.5, phase: 'descent' as const } };
    const plan = planRecovery(a, b);
    expect(plan.recover.from).toEqual(plan.recover.to);
    expect(plan.approach!.start).toBeGreaterThan(plan.splitEnd + 1);
    expect(plan.approach!.end).toBe(9);
    expect(plan.approach!.end - plan.approach!.start).toBeLessThan(1);
  });
});
