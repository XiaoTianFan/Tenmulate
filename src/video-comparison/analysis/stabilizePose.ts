import type { FrameIndex } from '../timeline';
import { fillDraft } from './series';
import { repairPose } from './poseSeries';
import { jointSignal } from './poseAngles';
import { JOINTS, OBSERVED, sampleAt, type MotionSeries } from './types';

/** Reject only brief out-and-back landmark excursions supported on both sides.
 * The model observations are retained separately; sustained motion is never
 * clipped to a fixed speed/acceleration limit. Runs span at most two detections. */
export function stabilizePose(raw: MotionSeries, index: FrameIndex, frames: readonly number[]): MotionSeries {
  const clean = { ...raw, values: raw.values.slice(), states: raw.states.slice() };
  const observed = { ...raw, values: raw.values.slice(), states: raw.states.slice() };
  fillDraft(observed, frames, index);
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * raw.width, (a.y - b.y) * raw.height);
  for (let p = 0; p < raw.points; p++) for (let i = 2; i + 2 < frames.length; i++) {
    for (let count = 1; count <= 2 && i + count + 1 < frames.length; count++) {
      const before = sampleAt(raw, frames[i - 2], p), left = sampleAt(raw, frames[i - 1], p), right = sampleAt(raw, frames[i + count], p), after = sampleAt(raw, frames[i + count + 1], p);
      if (!before || !left || !right || !after || Math.min(before.confidence, left.confidence, right.confidence, after.confidence) < .45) continue;
      const ta = index.timestamps[frames[i - 1]], tb = index.timestamps[frames[i + count]], dt = tb - ta;
      if (dt > .22 || dt <= 0) continue;
      const f = frames[i], shoulder = sampleAt(raw, f, 5) ?? sampleAt(raw, f, 6), hip = sampleAt(raw, f, 11) ?? sampleAt(raw, f, 12);
      const scale = shoulder && hip ? distance(shoulder, hip) : Math.min(raw.width, raw.height) * .15;
      const localMotion = Math.max(distance(before, left), distance(right, after));
      const threshold = Math.max(5, scale * .12, localMotion * 2.5);
      let reject = true;
      for (let j = i; j < i + count; j++) {
        const point = sampleAt(raw, frames[j], p);
        if (!point || point.state !== OBSERVED) { reject = false; break; }
        const t = (index.timestamps[frames[j]] - ta) / dt, expected = { x: left.x + (right.x - left.x) * t, y: left.y + (right.y - left.y) * t };
        const outAndBack = ((point.x - left.x) * (right.x - point.x) * raw.width ** 2 + (point.y - left.y) * (right.y - point.y) * raw.height ** 2) < 0;
        if (!outAndBack || distance(point, expected) <= threshold || distance(left, point) + distance(point, right) < distance(left, right) * 2.5) { reject = false; break; }
      }
      if (reject) { for (let j = i; j < i + count; j++) clean.states[(frames[j] - raw.start) * raw.points + p] = 0; break; }
    }
  }
  fillDraft(clean, frames, index);
  const result = repairPose(clean, index, { interpolate: .25, extrapolate: .12 });
  result.observations = { values: observed.values, states: observed.states };
  // Prepare the default curves in the analysis worker, never during playback.
  const angles = Object.fromEntries(Object.keys(JOINTS).map(joint => [joint, jointSignal(result, index, joint)]));
  result.angles = angles;
  return result;
}
