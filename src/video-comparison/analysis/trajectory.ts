import type { FrameIndex } from '../timeline';
import { emptySeries, ESTIMATED, MANUAL, OBSERVED, putSample, type Anchor, type MotionSeries } from './types';
export type TrackingPoint = { x: number; y: number; confidence: number };
export type TrackingPass = (TrackingPoint | null)[];
const distance = (a: TrackingPoint, b: TrackingPoint, width: number, height: number) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
const median = (values: number[]) => { const sorted = values.slice().sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

export function trackingBounds(anchors: readonly Anchor[]) {
  const start = anchors.find(a => a.role === 'start'), end = anchors.find(a => a.role === 'end');
  if (!start || !end || end.frame <= start.frame) return null;
  return { start: start.frame, end: end.frame };
}
export function setTrackAnchor(anchors: readonly Anchor[], anchor: Anchor, role: 'start' | 'end' | 'correction'): Anchor[] {
  const opposite = anchors.find(a => a.role === (role === 'start' ? 'end' : 'start'));
  if (role !== 'correction' && opposite && (role === 'start' ? anchor.frame >= opposite.frame : anchor.frame <= opposite.frame)) return [...anchors];
  const existing = anchors.find(a => a.frame === anchor.frame);
  if (role === 'correction' && existing?.role && existing.role !== 'correction') role = existing.role;
  return [...anchors.filter(a => a.frame !== anchor.frame && (role === 'correction' || a.role !== role)), { ...anchor, role }].sort((a, b) => a.frame - b.frame);
}

/** A short excursion followed by a return to the previous trend is different
 * from a lasting velocity change. Never reject a manual anchor or marked impact. */
export function rejectExcursions(points: TrackingPass, times: Float64Array, start: number, width: number, height: number, protectedFrames: ReadonlySet<number>): number {
  const original = points.slice(), rejected = new Set<number>();
  const step = median(Array.from({ length: points.length - 1 }, (_, i) => times[start + i + 1] - times[start + i]));
  const maxLength = Math.min(60, Math.max(1, Math.ceil(.16 / Math.max(step, .001))));
  const protectedCount = new Uint32Array(points.length + 1);
  for (let i = 0; i < points.length; i++) protectedCount[i + 1] = protectedCount[i] + Number(protectedFrames.has(start + i));
  for (let length = 1; length <= maxLength; length++) for (let i = 2; i + length + 1 < points.length; i++) {
    const j = i + length - 1, left = original[i - 1], right = original[j + 1], before = original[i - 2], after = original[j + 2];
    if (!left || !right || !before || !after) continue;
    if (protectedCount[j + 2] !== protectedCount[i - 1]) continue;
    const t = (f: number) => times[start + f], dt = t(j + 1) - t(i - 1);
    if (!(dt > 0) || (length > 1 && dt > .16)) continue;
    const vx = (left.x - before.x) * width / (t(i - 1) - t(i - 2)), vy = (left.y - before.y) * height / (t(i - 1) - t(i - 2));
    const wx = (after.x - right.x) * width / (t(j + 2) - t(j + 1)), wy = (after.y - right.y) * height / (t(j + 2) - t(j + 1));
    const speed = Math.hypot(vx, vy), nextSpeed = Math.hypot(wx, wy), step = Math.max(speed, nextSpeed) * dt / (length + 1);
    // A bounce/strike changes the sustained before/after motion; do not flatten it.
    if (vx * wx + vy * wy < -.1 * speed * nextSpeed || Math.max(speed, nextSpeed) > 6 * Math.min(speed, nextSpeed) + 20) continue;
    if (Math.hypot(vx - wx, vy - wy) > Math.max(30, .5 * Math.max(speed, nextSpeed))) continue;
    const expected = { x: left.x + (vx + wx) * .5 * dt / width, y: left.y + (vy + wy) * .5 * dt / height, confidence: 1 };
    if (distance(expected, right, width, height) > Math.max(4, step * .9)) continue;
    const threshold = Math.max(3, step * .8);
    const excursions: number[] = [];
    for (let f = i; f <= j; f++) {
      const p = original[f]; if (!p) continue;
      const u = (t(f) - t(i - 1)) / dt;
      const h0 = 2 * u ** 3 - 3 * u ** 2 + 1, h1 = u ** 3 - 2 * u ** 2 + u, h2 = -2 * u ** 3 + 3 * u ** 2, h3 = u ** 3 - u ** 2;
      const expected = { x: h0 * left.x + h1 * dt * vx / width + h2 * right.x + h3 * dt * wx / width, y: h0 * left.y + h1 * dt * vy / height + h2 * right.y + h3 * dt * wy / height, confidence: 1 };
      if (distance(p, expected, width, height) > threshold) excursions.push(f);
    }
    for (const f of excursions) rejected.add(f);
  }
  for (const f of rejected) points[f] = null;
  return rejected.size;
}

/** Preserve an unmarked impact only when both one-sided velocities are stable.
 * An isolated bad match creates alternating velocities and fails this check. */
function motionCorners(points: TrackingPass, times: Float64Array, start: number, width: number, height: number) {
  const result: number[] = [];
  const velocity = (a: number, b: number) => {
    const dt = times[start + b] - times[start + a];
    return { x: (points[b]!.x - points[a]!.x) * width / dt, y: (points[b]!.y - points[a]!.y) * height / dt, confidence: 1 };
  };
  for (let i = 2; i + 2 < points.length; i++) {
    if (![i - 2, i - 1, i, i + 1, i + 2].every(f => points[f] && points[f]!.confidence >= .7)) continue;
    const before = velocity(i - 2, i - 1), incoming = velocity(i - 1, i), outgoing = velocity(i, i + 1), after = velocity(i + 1, i + 2);
    const variation = Math.max(distance(before, incoming, 1, 1), distance(outgoing, after, 1, 1));
    const change = distance(incoming, outgoing, 1, 1);
    if (change > Math.max(100, variation * 4, Math.min(Math.hypot(incoming.x, incoming.y), Math.hypot(outgoing.x, outgoing.y)) * .6)) result.push(start + i);
  }
  return result;
}

/** Symmetric positive-definite band solve, O(frames) memory and work.
 * Fits observations while penalizing acceleration; anchors are exact constraints.
 * At impacts the acceleration penalty is removed, allowing a real velocity jump. */
function smooth(values: number[], weights: number[], times: Float64Array, start: number, fixed: Map<number, number>, corners: ReadonlySet<number>, seconds: number): number[] {
  const n = values.length, diagonal = Float64Array.from(weights), lower1 = new Float64Array(n), lower2 = new Float64Array(n), rhs = Float64Array.from(values, (v, i) => v * weights[i]);
  const h = median(Array.from({ length: n - 1 }, (_, i) => times[start + i + 1] - times[start + i]));
  const lambda = Math.min(100000, Math.max(.05, (seconds / Math.max(h, 1e-5)) ** 4 / 16));
  for (let i = 1; i + 1 < n; i++) {
    if (corners.has(start + i)) continue;
    const a = times[start + i] - times[start + i - 1], b = times[start + i + 1] - times[start + i];
    if (!(a > 0 && b > 0)) continue;
    const c = [2 * h * h / (a * (a + b)), -2 * h * h / (a * b), 2 * h * h / (b * (a + b))];
    for (let k = 0; k < 3; k++) diagonal[i + k - 1] += lambda * c[k] ** 2;
    lower1[i] += lambda * c[0] * c[1]; lower1[i + 1] += lambda * c[1] * c[2]; lower2[i + 1] += lambda * c[0] * c[2];
  }
  for (const [at, value] of fixed) {
    for (const delta of [-2, -1, 1, 2]) {
      const other = at + delta; if (other < 0 || other >= n) continue;
      const row = Math.max(at, other), band = Math.abs(delta) === 1 ? lower1 : lower2;
      rhs[other] -= band[row] * value; band[row] = 0;
    }
    diagonal[at] = 1; rhs[at] = value;
  }
  const d = new Float64Array(n), l1 = new Float64Array(n), l2 = new Float64Array(n), y = new Float64Array(n), out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if (i > 1) l2[i] = lower2[i] / d[i - 2];
    if (i > 0) l1[i] = (lower1[i] - (i > 1 ? l2[i] * l1[i - 1] : 0)) / d[i - 1];
    d[i] = Math.sqrt(Math.max(1e-12, diagonal[i] - l1[i] ** 2 - l2[i] ** 2));
    y[i] = (rhs[i] - (i > 0 ? l1[i] * y[i - 1] : 0) - (i > 1 ? l2[i] * y[i - 2] : 0)) / d[i];
  }
  for (let i = n - 1; i >= 0; i--) out[i] = (y[i] - (i + 1 < n ? l1[i + 1] * out[i + 1] : 0) - (i + 2 < n ? l2[i + 2] * out[i + 2] : 0)) / d[i];
  for (const [at, value] of fixed) out[at] = value;
  return out;
}

/** Reconcile independent directions, remove return-to-trend outliers, then solve
 * one continuous path. No frames outside the two chosen endpoints are invented. */
export function reconstructTrajectory(index: FrameIndex, anchors: readonly Anchor[], forward: TrackingPass, backward: TrackingPass, width: number, height: number, contact: number | null, smoothing = .06): MotionSeries {
  const bounds = trackingBounds(anchors);
  if (!bounds) throw new Error('Choose a start and end position on two different frames.');
  const { start, end } = bounds, n = end - start + 1;
  const manual = anchors.filter(a => a.frame >= start && a.frame <= end).sort((a, b) => a.frame - b.frame);
  const protectedFrames = new Set(manual.map(a => a.frame)), corners = new Set(manual.filter(a => a.corner).map(a => a.frame));
  // Contact permits a real velocity change; it is not a trusted position measurement.
  if (contact !== null && contact > start && contact < end) corners.add(contact);
  const fwd = forward.slice(), back = backward.slice();
  rejectExcursions(fwd, index.timestamps, start, width, height, protectedFrames);
  rejectExcursions(back, index.timestamps, start, width, height, protectedFrames);
  const points: TrackingPass = Array(n).fill(null); let segment = 0;
  for (let i = 0; i < n; i++) {
    const f = start + i; while (segment + 1 < manual.length - 1 && f > manual[segment + 1].frame) segment++;
    const a = manual[segment], b = manual[segment + 1], left = fwd[i], right = back[i];
    const u = (index.timestamps[f] - index.timestamps[a.frame]) / (index.timestamps[b.frame] - index.timestamps[a.frame]);
    const tolerance = Math.max(3, Math.min(12, Math.hypot(a.width * width, a.height * height) * .3));
    if (left && right) {
      if (distance(left, right, width, height) > tolerance) continue;
      const wl = (1 - u) ** 2 * left.confidence, wr = u ** 2 * right.confidence, total = wl + wr || 1;
      points[i] = { x: (left.x * wl + right.x * wr) / total, y: (left.y * wl + right.y * wr) / total, confidence: Math.min(left.confidence, right.confidence) };
    } else points[i] = left ?? right;
  }
  for (const a of manual) points[a.frame - start] = { x: a.x, y: a.y, confidence: 1 };
  for (const f of motionCorners(points, index.timestamps, start, width, height)) { corners.add(f); protectedFrames.add(f); }
  const rejected = rejectExcursions(points, index.timestamps, start, width, height, protectedFrames);
  // Interpolation supplies a weak prior, not a fabricated high-confidence observation.
  const xs = new Array<number>(n), ys = new Array<number>(n), weights = new Array<number>(n), estimated = new Uint8Array(n);
  let previous = 0;
  for (let i = 0; i < n; i++) if (points[i]) {
    const p = points[i]!;
    for (let j = previous; j <= i; j++) {
      const left = points[previous]!, u = i === previous ? 0 : (index.timestamps[start + j] - index.timestamps[start + previous]) / (index.timestamps[start + i] - index.timestamps[start + previous]);
      const observation = points[j]; xs[j] = observation?.x ?? left.x + (p.x - left.x) * u; ys[j] = observation?.y ?? left.y + (p.y - left.y) * u;
      weights[j] = observation ? Math.max(.05, observation.confidence ** 2) : .001; estimated[j] = observation ? 0 : 1;
    }
    previous = i;
  }
  const fixedX = new Map(manual.map(a => [a.frame - start, a.x])), fixedY = new Map(manual.map(a => [a.frame - start, a.y]));
  const x = smooth(xs, weights, index.timestamps, start, fixedX, corners, smoothing), y = smooth(ys, weights, index.timestamps, start, fixedY, corners, smoothing);
  const result = emptySeries(start, end, 1, width, height, 'Anchored bidirectional color/LK + robust trajectory');
  result.continuous = true; result.corners = [...corners]; result.rejected = rejected;
  for (let i = 0; i < n; i++) {
    const isManual = fixedX.has(i), moved = Math.hypot((x[i] - xs[i]) * width, (y[i] - ys[i]) * height) > 2;
    putSample(result, start + i, 0, x[i], y[i], estimated[i] ? .15 : points[i]!.confidence, isManual ? MANUAL : estimated[i] || moved ? ESTIMATED : OBSERVED);
  }
  return result;
}

export function estimatedRanges(series: MotionSeries | undefined) {
  const ranges: { start: number; end: number }[] = []; if (!series) return ranges;
  for (let i = 0; i < series.states.length; i++) if (series.states[i] === ESTIMATED) {
    const frame = series.start + i, last = ranges.at(-1);
    if (last?.end === frame - 1) last.end = frame; else ranges.push({ start: frame, end: frame });
  }
  return ranges;
}
