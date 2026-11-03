import { expect, it } from 'vitest';
import { reconstructTrajectory, rejectExcursions, trackingBounds, setTrackAnchor, type TrackingPass } from '../src/video-comparison/analysis/trajectory';
import { createFrameIndex } from '../src/video-comparison/timeline';
import { ESTIMATED, MANUAL, newMotion, sampleAt, type Anchor, type MotionSeries } from '../src/video-comparison/analysis/types';
import { plotData } from '../src/video-comparison/analysis/series';
const index = createFrameIndex(Array.from({ length: 121 }, (_, i) => ({ timestamp: i / 60, duration: 1 / 60 })));
const point = (f: number) => ({ x: .15 + f / 600, y: .7 - .4 * f / 60 + .16 * (f / 60) ** 2, confidence: .95 });
const anchor = (frame: number, role: Anchor['role']): Anchor => ({ ...point(frame), frame, role, width: .02, height: .02 });
const anchors = [anchor(0, 'start'), anchor(120, 'end')];
const pass = (): TrackingPass => Array.from({ length: 121 }, (_, i) => point(i));
const result = (fwd: TrackingPass, back: TrackingPass, contact: number | null = null) => reconstructTrajectory(index, anchors, fwd, back, 1000, 1000, contact);
function metrics(series: MotionSeries, metric: 'x' | 'y' | 'vx' | 'vy' | 'ax' | 'ay' | 'speed') {
  const m = newMotion(); m.tracks = [{ id: 'ball', name: 'ball', color: '#fff', anchors, visible: true, revision: 1, result: series }];
  return plotData(m, { id: 'plot', target: 'track:ball', metric, smoothing: .1 }, index).values;
}
it('requires explicit ordered endpoint roles and preserves corrections when replacing an endpoint', () => {
  expect(trackingBounds([anchors[0]])).toBeNull();
  expect(trackingBounds([anchor(30, 'start'), anchor(10, 'end')])).toBeNull();
  expect(trackingBounds(anchors)).toEqual({ start: 0, end: 120 });
  const edited = setTrackAnchor([...anchors, anchor(40, 'correction')], anchor(100, 'end'), 'end');
  expect(edited.map(a => a.frame)).toEqual([0, 40, 100]);
});
it('fills an occlusion continuously between exact manual anchors and marks inferred samples', () => {
  const f = pass(), b = pass(); for (let i = 35; i <= 45; i++) f[i] = b[i] = null;
  const r = result(f, b);
  for (let i = 0; i <= 120; i++) expect(sampleAt(r, i)).not.toBeNull();
  expect(sampleAt(r, 40)?.state).toBe(ESTIMATED); expect(sampleAt(r, 40)?.confidence).toBeLessThan(.25);
  expect(sampleAt(r, 0)?.state).toBe(MANUAL); expect(sampleAt(r, 120)?.x).toBeCloseTo(point(120).x, 6);
  expect(sampleAt(r, 40)!.y).toBeCloseTo(point(40).y, 2);
  const vx = metrics(r, 'vx'); expect(vx.slice(10, 111).every(v => v !== null && Math.abs(v - 100) < .2)).toBe(true);
});
it('uses an explicitly estimated continuous path when both images offer no evidence, never extrapolating outside endpoints', () => {
  const r = result(Array(121).fill(null), Array(121).fill(null));
  expect(sampleAt(r, 60)?.state).toBe(ESTIMATED); expect(sampleAt(r, 60)?.confidence).toBe(.15000000596046448);
  expect(sampleAt(r, 60)?.x).toBeCloseTo((point(0).x + point(120).x) / 2, 5);
  expect(sampleAt(r, -1)).toBeNull(); expect(sampleAt(r, 121)).toBeNull();
});
it('rejects short outward-and-back spikes before deriving velocity and acceleration', () => {
  const f = pass(), b = pass(); for (const i of [22, 60, 61, 62, 95]) { f[i] = { ...point(i), x: point(i).x + .17 }; b[i] = { ...f[i]! }; }
  const r = result(f, b);
  for (const i of [22, 61, 95]) { expect(Math.abs(sampleAt(r, i)!.x - point(i).x) * 1000).toBeLessThan(1); expect(sampleAt(r, i)?.state).toBe(ESTIMATED); }
  expect(Math.max(...metrics(r, 'vx').slice(5, 116).map(v => Math.abs(v! - 100)))).toBeLessThan(1);
  expect(Math.max(...metrics(r, 'ax').slice(5, 116).map(v => Math.abs(v!)))).toBeLessThan(2);
});
it('does not splice disagreeing forward/backward matches into a teleport', () => {
  const f = pass(), b = pass(); for (let i = 45; i < 65; i++) f[i] = { ...point(i), x: .8, y: .1 };
  const r = result(f, b);
  for (let i = 45; i < 65; i++) expect(Math.abs(sampleAt(r, i)!.x - point(i).x) * 1000).toBeLessThan(1);
  expect(sampleAt(r, 55)?.state).toBe(ESTIMATED);
});
it('preserves a genuine persistent speed change at contact with one-sided velocity and no fictitious finite impact acceleration', () => {
  const p: TrackingPass = Array.from({ length: 121 }, (_, i) => ({ x: .1 + Math.min(i, 60) / 600 + Math.max(0, i - 60) / 120, y: .5, confidence: 1 }));
  const a: Anchor[] = [{ ...anchors[0], ...p[0]! }, { ...anchors[1], ...p[120]! }];
  const r = reconstructTrajectory(index, a, p, p, 1000, 1000, 60), vx = metrics(r, 'vx'), ax = metrics(r, 'ax');
  expect(vx[58]).toBeCloseTo(100, 1); expect(vx[60]).toBeCloseTo(500, 1); expect(vx[62]).toBeCloseTo(500, 1); expect(ax[60]).toBeNull();
  for (let i = 0; i < p.length; i++) expect(sampleAt(r, i)!.x).toBeCloseTo(p[i]!.x, 4);
});
it('keeps a real reversal instead of confusing it with an isolated spike', () => {
  const p: TrackingPass = Array.from({ length: 121 }, (_, i) => ({ x: .2 + Math.min(i, 120 - i) / 400, y: .5, confidence: 1 }));
  const removed = rejectExcursions(p, index.timestamps, 0, 1000, 1000, new Set());
  expect(removed).toBe(0); expect(p.every(Boolean)).toBe(true);
});
it('reports rising height and positive vertical velocity for upward image motion, including exports which share plotData', () => {
  const r = result(pass(), pass()), y = metrics(r, 'y'), vy = metrics(r, 'vy');
  expect(y[20]).toBeGreaterThan(y[10]!); expect(vy[10]).toBeGreaterThan(0); expect(vy[110]).toBeLessThan(0);
  expect(y[0]).toBeCloseTo(300, 3);
});
it('supports irregular frame timestamps and internal correction anchors without gaps', () => {
  const times = Array.from({ length: 121 }, (_, i) => i / 60 + (i % 2) * .003), vfr = createFrameIndex(times.map(timestamp => ({ timestamp, duration: .016 })));
  const p = times.map(t => ({ x: .1 + .2 * t, y: .4, confidence: 1 }));
  const a: Anchor[] = [0, 55, 120].map((frame, i) => ({ ...p[frame], frame, width: .02, height: .02, role: i === 0 ? 'start' : i === 2 ? 'end' : 'correction' }));
  const r = reconstructTrajectory(vfr, a, p, p, 1000, 1000, null);
  for (let f = 0; f <= 120; f++) expect(sampleAt(r, f)?.x).toBeCloseTo(p[f].x, 5);
  expect(sampleAt(r, 55)?.state).toBe(MANUAL);
});
it('preserves an unmarked persistent strike and a smooth curved toss without fabricating impacts', () => {
  const p: TrackingPass = Array.from({ length: 121 }, (_, i) => ({ x: .1 + Math.min(i, 60) / 600 + Math.max(0, i - 60) / 120, y: .5, confidence: 1 }));
  const a = [{ ...anchors[0], ...p[0]! }, { ...anchors[1], ...p[120]! }];
  const r = reconstructTrajectory(index, a, p, p, 1000, 1000, null);
  expect(r.corners).toContain(60); expect(metrics(r, 'vx')[60]).toBeCloseTo(500, 1);
  const arc = result(pass(), pass()); expect(arc.corners).toEqual([]);
  for (let f = 5; f < 116; f++) expect(sampleAt(arc, f)!.y).toBeCloseTo(point(f).y, 4);
});
it('does not delete an endpoint when a correction is placed on it or when endpoints would be inverted', () => {
  const edited = setTrackAnchor(anchors, { ...anchors[0], x: .2 }, 'correction');
  expect(edited[0].role).toBe('start'); expect(trackingBounds(edited)).toEqual({ start: 0, end: 120 });
  expect(setTrackAnchor(anchors, anchor(0, 'end'), 'end')).toEqual(anchors);
});
it('marks derivatives influenced by inferred neighbors without changing an observed position into an estimate', () => {
  const f = pass(), b = pass(); f[30] = b[30] = null;
  const r = result(f, b), m = newMotion(); m.tracks = [{ id: 'ball', name: 'ball', color: '#fff', anchors, visible: true, revision: 1, result: r }];
  const plot = { id: 'p', target: 'track:ball', metric: 'vx' as const, smoothing: .1 };
  expect(plotData(m, plot, index).estimated[29]).toBe(true);
  expect(plotData(m, { ...plot, metric: 'x' }, index).estimated[29]).toBe(false);
});
it('rejects a 75 ms excursion at high frame rates using source time rather than a fixed frame count', () => {
  const fast = createFrameIndex(Array.from({ length: 241 }, (_, i) => ({ timestamp: i / 240, duration: 1 / 240 })));
  const points: TrackingPass = Array.from(fast.timestamps, t => ({ x: .1 + t * .2, y: .4, confidence: 1 }));
  for (let i = 80; i < 98; i++) points[i] = { ...points[i]!, x: points[i]!.x + .12 };
  const a: Anchor[] = [0, 240].map((frame, i) => ({ ...points[frame]!, frame, role: i === 0 ? 'start' : 'end', width: .02, height: .02 }));
  const r = reconstructTrajectory(fast, a, points, points, 1000, 1000, null);
  for (let i = 80; i < 98; i++) { expect(sampleAt(r, i)?.state).toBe(ESTIMATED); expect(sampleAt(r, i)?.x).toBeCloseTo(.1 + i / 240 * .2, 4); }
});
it('does not treat the contact marker as proof that a bad image match is valid', () => {
  const f = pass(), b = pass(); f[60] = b[60] = { ...point(60), x: .8 };
  const r = result(f, b, 60);
  expect(sampleAt(r, 60)?.state).toBe(ESTIMATED); expect(sampleAt(r, 60)?.x).toBeCloseTo(point(60).x, 4);
  expect(metrics(r, 'vx')[60]).toBeCloseTo(100, 1);
});
