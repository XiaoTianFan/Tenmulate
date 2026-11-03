import type { FrameIndex } from '../timeline';
import { emptySeries, ESTIMATED, JOINTS, MANUAL, putSample, sampleAt, type ClipMotion, type Metric, type MotionPlot, type MotionSeries, type MotionTrack } from './types';

export function manualSeries(track: MotionTrack, width: number, height: number): MotionSeries | undefined {
  if (!track.anchors.length) return;
  const frames = track.anchors.map(a => a.frame);
  if (Math.max(...frames) - Math.min(...frames) >= 7200) return;
  const result = emptySeries(Math.min(...frames), Math.max(...frames), 1, width, height, 'manual');
  for (const a of track.anchors) putSample(result, a.frame, 0, a.x, a.y, 1, MANUAL);
  return result;
}
/** Interpolate only short gaps explicitly introduced by draft pose sampling. */
export function fillDraft(series: MotionSeries, frames: readonly number[], index: FrameIndex) {
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i], dt = index.timestamps[b] - index.timestamps[a];
    if (dt > 0.12 || dt <= 0) continue;
    for (let p = 0; p < series.points; p++) {
      const left = sampleAt(series, a, p), right = sampleAt(series, b, p);
      if (!left || !right) continue;
      for (let f = a + 1; f < b; f++) {
        const t = (index.timestamps[f] - index.timestamps[a]) / dt;
        putSample(series, f, p, left.x + (right.x - left.x) * t, left.y + (right.y - left.y) * t, Math.min(left.confidence, right.confidence), ESTIMATED);
      }
    }
  }
}
export function jointAngle(series: MotionSeries | undefined, frame: number, joint: string) {
  const indices = JOINTS[joint]?.points;
  if (!indices || !series) return null;
  const [a, b, c] = indices.map(i => sampleAt(series, frame, i));
  if (!a || !b || !c) return null;
  const ax = (a.x - b.x) * series.width, ay = (a.y - b.y) * series.height, cx = (c.x - b.x) * series.width, cy = (c.y - b.y) * series.height;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  return length < 1e-8 ? null : Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / length))) * 180 / Math.PI;
}
/** Local quadratic least squares in actual source seconds (supports VFR).
 * Missing samples and manual correction boundaries break the fitting window. */
function fit(times: Float64Array, values: (number | null)[], states: Uint8Array, offset: number, at: number, window: number): [number, number | null, number | null] {
  const value = values[at];
  if (value === null) return [NaN, null, null];
  let left = at, right = at;
  const radius = window > 0 ? window / 2 : Infinity, countLimit = window > 0 ? 60 : 1;
  while (left > 0 && at - left < countLimit && values[left - 1] !== null && states[left] !== MANUAL && times[offset + at] - times[offset + left - 1] <= radius) left--;
  while (right + 1 < values.length && right - at < countLimit && values[right + 1] !== null && states[right + 1] !== MANUAL && times[offset + right + 1] - times[offset + at] <= radius) right++;
  if (right - left < 2) return [value, null, null];
  const sums = [0, 0, 0, 0, 0], rhs = [0, 0, 0];
  // Scale time for a well-conditioned solve even at 240 fps.
  const scale = Math.max(times[offset + right] - times[offset + left], 1e-6);
  for (let i = left; i <= right; i++) {
    const t = (times[offset + i] - times[offset + at]) / scale, v = values[i]!;
    for (let k = 0; k <= 4; k++) sums[k] += t ** k;
    for (let k = 0; k < 3; k++) rhs[k] += v * t ** k;
  }
  const a = [[sums[0], sums[1], sums[2], rhs[0]], [sums[1], sums[2], sums[3], rhs[1]], [sums[2], sums[3], sums[4], rhs[2]]];
  for (let c = 0; c < 3; c++) {
    let pivot = c; for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[pivot], a[c]] = [a[c], a[pivot]];
    if (Math.abs(a[c][c]) < 1e-10) return [value, null, null];
    const d = a[c][c]; for (let j = c; j < 4; j++) a[c][j] /= d;
    for (let r = 0; r < 3; r++) if (r !== c) { const m = a[r][c]; for (let j = c; j < 4; j++) a[r][j] -= m * a[c][j]; }
  }
  return [window > 0 ? a[0][3] : value, a[1][3] / scale, 2 * a[2][3] / scale ** 2];
}
export type PlotData = { start: number; values: (number | null)[]; estimated: boolean[]; min: number; max: number };
export function plotData(motion: ClipMotion, plot: MotionPlot, index: FrameIndex): PlotData {
  const [type, id] = plot.target.split(':');
  const series = type === 'track' ? motion.tracks.find(t => t.id === id)?.result : motion.pose.result;
  if (!series) return { start: 0, values: [], estimated: [], min: 0, max: 1 };
  const count = series.end - series.start + 1, states = new Uint8Array(count), xs: (number | null)[] = [], ys: (number | null)[] = [], conf: (number | null)[] = [];
  for (let i = 0; i < count; i++) {
    const frame = series.start + i, p = sampleAt(series, frame, type === 'pose' ? Number(id) : 0);
    if (type === 'joint') {
      const joint = JOINTS[id], samples = joint?.points.map(p => sampleAt(series, frame, p));
      xs.push(jointAngle(series, frame, id)); ys.push(null); conf.push(null);
      states[i] = samples?.every(Boolean) ? samples.some(p => p?.state === ESTIMATED) ? ESTIMATED : 1 : 0;
    } else { xs.push(p ? p.x * series.width : null); ys.push(p ? p.y * series.height : null); conf.push(p?.confidence ?? null); states[i] = p?.state ?? 0; }
  }
  const values = xs.map((x, i) => {
    if (x === null) return null;
    const a = fit(index.timestamps, xs, states, series.start, i, plot.smoothing), b = type === 'joint' ? a : fit(index.timestamps, ys, states, series.start, i, plot.smoothing);
    const metric: Metric = plot.metric;
    if (metric === 'confidence') return conf[i];
    if (metric === 'x' || metric === 'angle') return a[0]; if (metric === 'y') return b[0];
    if (metric === 'vx' || metric === 'angularVelocity') return a[1]; if (metric === 'vy') return b[1];
    if (metric === 'ax' || metric === 'angularAcceleration') return a[2]; if (metric === 'ay') return b[2];
    const order = metric === 'speed' ? 1 : 2;
    return a[order] === null || b[order] === null ? null : Math.hypot(a[order]!, b[order]!);
  });
  let min = Infinity, max = -Infinity; for (const v of values) if (v !== null && Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
  if (!Number.isFinite(min)) { min = 0; max = 1; } if (min === max) { min -= 1; max += 1; }
  return { start: series.start, values, estimated: Array.from(states, s => s === ESTIMATED), min, max };
}

/** Missing ranges stay compact even when a long source has only a few anchors. */
export function trackCoverage(series: MotionSeries | undefined, range: { start: number; end: number }) {
  const gaps: { start: number; end: number }[] = []; let found = 0, cursor = range.start;
  if (series) for (let f = Math.max(range.start, series.start); f <= Math.min(range.end, series.end); f++) {
    if (!sampleAt(series, f)) continue;
    if (cursor < f) gaps.push({ start: cursor, end: f - 1 }); found++; cursor = f + 1;
  }
  if (cursor <= range.end) gaps.push({ start: cursor, end: range.end });
  return { found, gaps };
}
