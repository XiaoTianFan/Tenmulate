import type { FrameIndex } from '../timeline';
import { ESTIMATED, OBSERVED, putSample, sampleAt, type MotionSeries } from './types';

// Only limbs/face with a currently visible parent can be extrapolated. The torso
// itself is never invented, and estimates never become seeds for more estimates.
const PARENT = [5, 0, 0, 1, 2, 11, 12, 5, 6, 7, 8, 5, 6, 11, 12, 13, 14];
const TORSO = [5, 6, 11, 12];
/** Repair brief missing detections in source seconds. Valid model observations
 * (including low-confidence ones) and draft samples remain byte-for-byte intact. */
export function repairPose(series: MotionSeries, index: FrameIndex): MotionSeries {
  const result = { ...series, values: series.values.slice(), states: series.states.slice() };
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * series.width, (a.y - b.y) * series.height);
  const bodyScale = (f: number) => {
    const shoulder = sampleAt(series, f, 5) ?? sampleAt(series, f, 6), hip = sampleAt(series, f, 11) ?? sampleAt(series, f, 12);
    return shoulder && hip && shoulder.confidence >= .35 && hip.confidence >= .35 ? Math.max(12, distance(shoulder, hip)) : 0;
  };
  const trusted = (f: number, p: number) => { const v = sampleAt(series, f, p); return v && v.state === OBSERVED && v.confidence >= .5 ? v : null; };
  for (let p = 0; p < series.points; p++) {
    const observed: number[] = [];
    for (let f = series.start; f <= series.end; f++) if (trusted(f, p)) observed.push(f);
    let right = 0;
    for (let f = series.start; f <= series.end; f++) {
      while (right < observed.length && observed[right] <= f) right++;
      if (sampleAt(series, f, p)) continue;
      const a = observed[right - 1], b = observed[right], scale = bodyScale(f);
      if (a === undefined || !scale) continue;
      const parent = PARENT[p], currentParent = sampleAt(series, f, parent), parentA = sampleAt(series, a, parent), left = trusted(a, p)!;
      if (!currentParent || !parentA || Math.min(currentParent.confidence, parentA.confidence) < .35) continue;
      const t = index.timestamps[f], ta = index.timestamps[a], age = t - ta;
      let x: number, y: number, confidence: number;
      if (b !== undefined && index.timestamps[b] - ta <= .16 + 1e-6) {
        const rightPoint = trusted(b, p)!, parentB = sampleAt(series, b, parent), dt = index.timestamps[b] - ta;
        if (!parentB || parentB.confidence < .35 || dt <= 0 || distance(parentA, parentB) > scale * 2) continue;
        const offsetA = { x: left.x - parentA.x, y: left.y - parentA.y }, offsetB = { x: rightPoint.x - parentB.x, y: rightPoint.y - parentB.y };
        if (distance(offsetA, offsetB) > scale * 1.8) continue;
        const weight = age / dt;
        x = currentParent.x + offsetA.x * (1 - weight) + offsetB.x * weight;
        y = currentParent.y + offsetA.y * (1 - weight) + offsetB.y * weight;
        confidence = Math.min(left.confidence, rightPoint.confidence, currentParent.confidence) * .7;
      } else {
        const previous = observed[right - 2];
        if (TORSO.includes(p) || previous === undefined || age <= 0 || age > .08 + 1e-6) continue;
        const prev = trusted(previous, p)!, parentPrev = sampleAt(series, previous, parent), dt = ta - index.timestamps[previous];
        if (!parentPrev || parentPrev.confidence < .35 || dt <= 0 || dt > .12 || distance(currentParent, parentA) > scale) continue;
        const dx = ((left.x - parentA.x) - (prev.x - parentPrev.x)) * age / dt;
        const dy = ((left.y - parentA.y) - (prev.y - parentPrev.y)) * age / dt;
        if (Math.hypot(dx * series.width, dy * series.height) > scale * .6) continue;
        x = currentParent.x + left.x - parentA.x + dx; y = currentParent.y + left.y - parentA.y + dy;
        confidence = Math.min(left.confidence, currentParent.confidence) * .5 * (1 - age / .12);
      }
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) putSample(result, f, p, x, y, confidence, ESTIMATED);
    }
  }
  return result;
}
