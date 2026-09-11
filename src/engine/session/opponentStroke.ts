import type { StrokeChoice, StrokeSide } from '../../content/types';
import { motionEvent, withPreparedApproach, type MotionRepetition } from './opponentTimeline';
import { planRecovery } from './opponentMovement';

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Resolve an immutable incoming contact into the cheapest feasible racket side.
 * Both compilers use the same rigid contact anchors and recovery planner. The
 * ball is never moved to satisfy a preferred side, and explicit drills keep it. */
export function opponentStrokeOptions<T extends MotionRepetition>(previous: MotionRepetition | null, draft: T,
  choice: StrokeChoice = 'auto'): readonly Readonly<{ repetition: T; score: number; feasible: boolean }>[] {
  const sides: readonly StrokeSide[] = choice === 'auto' && draft.shot.family !== 'serve'
    ? ['forehand', 'backhand'] : [choice === 'backhand' ? 'backhand' : 'forehand'];
  const previousEvent = previous ? motionEvent(previous) : null;
  return sides.map(stroke => {
    const repetition = withPreparedApproach(previous, { ...draft, shot: { ...draft.shot, stroke } });
    const event = motionEvent(repetition);
    if (!previousEvent || !previous) {
      const origin = draft.home ?? { x: 0, y: 0, z: event.root.z };
      return { repetition, score: distance(origin, event.root), feasible: true };
    }
    // Check feasibility at the physical ceiling before comparing convenience.
    const a = motionEvent({ ...previous, motionRate: 3, movementRate: 3 });
    const b = motionEvent(withPreparedApproach({ ...previous, motionRate: 3, movementRate: 3 },
      { ...repetition, motionRate: 3, movementRate: 3 }));
    const fastest = planRecovery(a, b);
    const deficit = Math.max(0, fastest.end - b.start);
    const route = planRecovery(previousEvent, event);
    const travel = distance(route.recover.from, route.recover.to)
      + (route.approach ? distance(route.approach.from, route.approach.to) : 0);
    const direct = distance(previousEvent.root, event.root);
    // Small hysteresis avoids changing stroke over millimetres around the body.
    // It never wins against a meaningfully shorter route or a feasible deadline.
    const switchCost = previous.shot.stroke === stroke ? 0 : .12;
    const score = travel + direct * .35 + Math.max(0, travel - direct) * .25
      + route.requiredDuration * .15 + switchCost;
    return { repetition, score: score + deficit * 1000, feasible: deficit < 1e-7 };
  }).sort((a, b) => Number(b.feasible) - Number(a.feasible) || a.score - b.score);
}

export function resolveOpponentStroke<T extends MotionRepetition>(previous: MotionRepetition | null, draft: T,
  choice: StrokeChoice = 'auto'): T {
  return opponentStrokeOptions(previous, draft, choice)[0]!.repetition;
}
