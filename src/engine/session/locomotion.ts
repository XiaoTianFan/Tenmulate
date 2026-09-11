import library from '../../content/opponent-motion.json';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (low: number, high: number, value: number) => {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Product calibrations in world meters/seconds and source-seconds per second.
 * These describe the current clips, not universal human walk/run boundaries. */
export const LOCOMOTION_LIMITS = Object.freeze({
  jogStartMps: 1.05, jogFullMps: 1.65,
  walkRate: 1.25, adjustmentRate: 1.35, runRate: 1.8,
  maxStrideM: 2.4,
});

export type LocomotionPlan = Readonly<{
  gait: 'adjust' | 'walk' | 'jog' | 'run';
  walk: number; run: number; adjust: number;
  stride: number; stance: number; lift: number; headingWeight: number;
  shortRun: number;
  /** Finite two-foot adjustment instead of a partial looping gait. */
  placement: number;
  peakSpeed: number; peakAcceleration: number; peakCadenceHz: number;
}>;

/** Solve one distance clock for both the blended pose and its foot plants.
 * Selection is stable for the leg; changing speed/stride every frame would move
 * planted feet and cause gait flicker during braking or backwards seeks. */
export function solveLocomotion(distance: number, duration: number, _lateral: number): LocomotionPlan {
  const peakSpeed = duration > 0 ? distance / (.7 * duration) : 0;
  const peakAcceleration = duration > 0 ? Math.PI * distance / (1.4 * .26 * duration * duration) : 0;
  const walk = library.clips['walk-forward'], run = library.clips['run-forward'], adjust = library.clips['move-left'];
  const walkingRate = peakSpeed * walk.duration / walk.locomotion.cycleDistance;
  // Hard push-offs recruit athletic footwork earlier, including short moves.
  // Cadence demand prevents accelerating a walk indefinitely below a speed gate.
  const urgency = smooth(6, 9, peakAcceleration) * smooth(.8, 1.2, peakSpeed);
  const runWeight = Math.max(smooth(LOCOMOTION_LIMITS.jogStartMps, LOCOMOTION_LIMITS.jogFullMps, peakSpeed),
    smooth(1.05, 1.5, walkingRate), urgency) * Math.max(smooth(.3, .65, distance), smooth(1.8, 2.6, peakSpeed))
    * Math.max(smooth(.65, 1.5, distance), smooth(1.4, 2, peakSpeed), smooth(8, 9, peakAcceleration));
  // Nudge in all four directions, including diagonals and retreating. A small
  // forward/backward correction must not rotate into a walking loop.
  const adjustWeight = (1 - runWeight) * (1 - smooth(.65, 1.5, distance));
  const walkWeight = 1 - runWeight - adjustWeight;
  const runningStride = mix(1.05, run.locomotion.cycleDistance, smooth(1.25, 3.6, peakSpeed));
  const preferredStride = walkWeight * walk.locomotion.cycleDistance + runWeight * runningStride
    + adjustWeight * adjust.locomotion.cycleDistance;
  // A shared phase synchronizes both source clips with IK. Increase step length
  // before allowing an active walking/adjustment layer to exceed its rate budget.
  const cyclicStride = Math.min(LOCOMOTION_LIMITS.maxStrideM, Math.max(preferredStride,
    mix(preferredStride, peakSpeed * walk.duration / LOCOMOTION_LIMITS.walkRate, 1 - smooth(1.45, 2.6, peakSpeed)),
    peakSpeed * adjust.duration / LOCOMOTION_LIMITS.adjustmentRate,
    peakSpeed * run.duration / LOCOMOTION_LIMITS.runRate));
  // Short urgent routes are a two-foot placement action, not a truncated loop.
  // Only replace the cycle once walking/adjustment have completely faded out.
  const cycleRate = distance > 0 ? peakSpeed * run.duration / distance : 0;
  const shortRun = smooth(1.2, 1.4, peakSpeed) * smooth(9, 12, peakAcceleration)
    * smooth(.4, .65, distance) * (1 - smooth(1.1, 1.8, distance)) * (1 - smooth(1.5, LOCOMOTION_LIMITS.runRate, cycleRate));
  const placement = Math.max(shortRun, (1 - smooth(.75, 1.1, distance)) * adjustWeight);
  const finiteStride = Math.max(distance, peakSpeed * run.duration / LOCOMOTION_LIMITS.runRate,
    ...(walkWeight > .001 ? [peakSpeed * walk.duration / LOCOMOTION_LIMITS.walkRate] : []),
    ...(adjustWeight > .001 ? [peakSpeed * adjust.duration / LOCOMOTION_LIMITS.adjustmentRate] : []));
  const stride = mix(cyclicStride, finiteStride, placement);
  const runForm = Math.max(smooth(1.3, 3.2, peakSpeed), urgency);
  const stance = walkWeight * walk.locomotion.stanceFraction + adjustWeight * adjust.locomotion.stanceFraction
    + runWeight * mix(.5, run.locomotion.stanceFraction, runForm);
  const lift = walkWeight * walk.locomotion.footLift + adjustWeight * adjust.locomotion.footLift
    + runWeight * mix(.085, run.locomotion.footLift, runForm);
  return {
    gait: runWeight >= .5 ? peakSpeed >= 2.8 || shortRun >= .5 ? 'run' : 'jog' : adjustWeight > walkWeight ? 'adjust' : 'walk',
    walk: walkWeight, run: runWeight, adjust: adjustWeight, stride, stance, lift,
    shortRun, placement, headingWeight: walkWeight + runWeight, peakSpeed, peakAcceleration, peakCadenceHz: peakSpeed / stride,
  };
}
