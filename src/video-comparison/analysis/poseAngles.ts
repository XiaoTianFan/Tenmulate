import type { FrameIndex } from '../timeline';
import { ESTIMATED, JOINTS, OBSERVED, sampleAt, type JointSignal, type MotionSeries } from './types';

export const POSE_SMOOTHING = .1;
export function jointAngle(series: MotionSeries | undefined, frame: number, joint: string): number | null {
  const ids = JOINTS[joint]?.points;
  if (!ids || !series) return null;
  const [a, b, c] = ids.map(p => sampleAt(series, frame, p));
  if (!a || !b || !c) return null;
  const ax = (a.x - b.x) * series.width, ay = (a.y - b.y) * series.height;
  const cx = (c.x - b.x) * series.width, cy = (c.y - b.y) * series.height;
  const ab = Math.hypot(ax, ay), cb = Math.hypot(cx, cy);
  // Collapsed/projected limbs do not provide a meaningful angle.
  return Math.min(ab, cb) < 2 ? null : Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / (ab * cb)))) * 180 / Math.PI;
}

/** Confidence-weighted curvature regularization on irregular source timestamps.
 * The SPD system is pentadiagonal: O(n) storage/solve, independent of clip fps.
 * Data quadrature and physical seconds make the smoothing scale fps-invariant. */
function smooth(times: Float64Array, values: number[], weights: number[], window: number): number[] {
  if (!window || values.length < 3) return [...values];
  const n = values.length, diagonal = new Float64Array(n), lower1 = new Float64Array(n), lower2 = new Float64Array(n), rhs = new Float64Array(n);
  const lambda = (window / 3) ** 4;
  for (let i = 0; i < n; i++) {
    const dt = (times[Math.min(n - 1, i + 1)] - times[Math.max(0, i - 1)]) / 2;
    diagonal[i] = Math.max(.01, weights[i]) * dt; rhs[i] = diagonal[i] * values[i];
  }
  for (let i = 1; i + 1 < n; i++) {
    const h0 = times[i] - times[i - 1], h1 = times[i + 1] - times[i], weight = lambda * 2 / (h0 + h1);
    const a = 1 / h0, b = -a - 1 / h1, c = 1 / h1;
    diagonal[i - 1] += weight * a * a; diagonal[i] += weight * b * b; diagonal[i + 1] += weight * c * c;
    lower1[i] += weight * a * b; lower1[i + 1] += weight * b * c; lower2[i + 1] += weight * a * c;
  }
  // Banded Cholesky, followed by forward/back substitution.
  for (let i = 0; i < n; i++) {
    if (i >= 2) lower2[i] /= diagonal[i - 2];
    if (i >= 1) lower1[i] = (lower1[i] - (i >= 2 ? lower2[i] * lower1[i - 1] : 0)) / diagonal[i - 1];
    diagonal[i] = Math.sqrt(Math.max(1e-15, diagonal[i] - lower1[i] ** 2 - lower2[i] ** 2));
    rhs[i] = (rhs[i] - (i >= 1 ? lower1[i] * rhs[i - 1] : 0) - (i >= 2 ? lower2[i] * rhs[i - 2] : 0)) / diagonal[i];
  }
  const result = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) result[i] = (rhs[i] - (i + 1 < n ? lower1[i + 1] * result[i + 1] : 0) - (i + 2 < n ? lower2[i + 2] * result[i + 2] : 0)) / diagonal[i];
  return result;
}

/** First and second derivatives of ONE natural cubic curve through the filtered
 * angles, rather than separate finite differences of noisy coordinates. */
function derivatives(times: Float64Array, values: number[]) {
  const n = values.length, second = new Float64Array(n), upper = new Float64Array(n), rhs = new Float64Array(n), velocity = new Float64Array(n).fill(NaN);
  for (let i = 1; i + 1 < n; i++) {
    const a = times[i] - times[i - 1], b = times[i + 1] - times[i], diagonal = 2 * (a + b) - a * upper[i - 1];
    upper[i] = b / diagonal; rhs[i] = (6 * ((values[i + 1] - values[i]) / b - (values[i] - values[i - 1]) / a) - a * rhs[i - 1]) / diagonal;
  }
  for (let i = n - 2; i > 0; i--) second[i] = rhs[i] - upper[i] * second[i + 1];
  for (let i = 0; i + 1 < n; i++) {
    const h = times[i + 1] - times[i], slope = (values[i + 1] - values[i]) / h;
    velocity[i] = slope - h * (2 * second[i] + second[i + 1]) / 6;
    if (i === n - 2) velocity[i + 1] = slope + h * (second[i] + 2 * second[i + 1]) / 6;
  }
  // Natural boundary conditions are not measured endpoint accelerations.
  second[0] = second[n - 1] = NaN;
  return { velocity, acceleration: second };
}

const cache = new WeakMap<MotionSeries, WeakMap<FrameIndex, Map<string, JointSignal>>>();
export function jointSignal(series: MotionSeries, index: FrameIndex, joint: string, window = POSE_SMOOTHING): JointSignal {
  if (window === POSE_SMOOTHING && series.angles?.[joint]) return series.angles[joint];
  let byIndex = cache.get(series); if (!byIndex) { byIndex = new WeakMap(); cache.set(series, byIndex); }
  let entries = byIndex.get(index); if (!entries) { entries = new Map(); byIndex.set(index, entries); }
  const key = `${joint}:${window}`, cached = entries.get(key); if (cached) return cached;
  const source = window === 0 && series.observations ? { ...series, ...series.observations } : series;
  const n = series.end - series.start + 1, angles = new Float64Array(n).fill(NaN), velocity = angles.slice(), acceleration = angles.slice(), states = new Uint8Array(n), derivativeStates = new Uint8Array(n), confidence = new Float64Array(n);
  const ids = JOINTS[joint]?.points;
  for (let i = 0; i < n && ids; i++) {
    const f = series.start + i, angle = jointAngle(source, f, joint), points = ids.map(p => sampleAt(source, f, p));
    if (angle === null) continue;
    angles[i] = angle; states[i] = points.some(p => p!.state === ESTIMATED) ? ESTIMATED : OBSERVED;
    confidence[i] = Math.min(...points.map(p => p!.confidence));
  }
  for (let start = 0; start < n;) {
    if (!states[start]) { start++; continue; }
    let end = start + 1;
    while (end < n && states[end] && index.timestamps[series.start + end] - index.timestamps[series.start + end - 1] <= .2) end++;
    const times = index.timestamps.slice(series.start + start, series.start + end), raw = Array.from(angles.subarray(start, end));
    const weights = raw.map((_, i) => Math.max(.05, confidence[start + i] ** 2) * (states[start + i] === ESTIMATED ? .35 : 1));
    // Downweight isolated excursions, not sustained changes or broad real turns.
    if (window) for (let i = 2; i + 2 < raw.length; i++) {
      const left = raw[i - 1] - raw[i - 2], right = raw[i + 2] - raw[i + 1];
      const t = (times[i] - times[i - 1]) / (times[i + 1] - times[i - 1]);
      const predicted = raw[i - 1] * (1 - t) + raw[i + 1] * t, error = Math.abs(raw[i] - predicted);
      const outward = raw[i] - raw[i - 1], returning = raw[i + 1] - raw[i];
      if (outward * returning < 0 && error > Math.max(15, 4 * Math.max(Math.abs(left), Math.abs(right)))) { weights[i] *= .02; states[start + i] = ESTIMATED; }
    }
    const fitted = smooth(times, raw, weights, window).map(value => Math.max(0, Math.min(180, value))), rate = derivatives(times, fitted);
    const uncertain = states.slice(start, end);
    for (let i = 0; i < fitted.length; i++) {
      angles[start + i] = fitted[i]; velocity[start + i] = rate.velocity[i]; acceleration[start + i] = rate.acceleration[i];
      if (window) for (let j = i; j >= 0 && times[i] - times[j] <= window; j--) if (uncertain[j] === ESTIMATED) { states[start + i] = ESTIMATED; break; }
      if (window) for (let j = i + 1; j < fitted.length && times[j] - times[i] <= window; j++) if (uncertain[j] === ESTIMATED) { states[start + i] = ESTIMATED; break; }
    }
    for (let i = start; i < end; i++) derivativeStates[i] = states.subarray(Math.max(start, i - 1), Math.min(end, i + 2)).includes(ESTIMATED) ? ESTIMATED : states[i];
    start = end;
  }
  const result = { values: angles, velocity, acceleration, states, derivativeStates }; entries.set(key, result); return result;
}
