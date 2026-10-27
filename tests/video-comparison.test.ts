import { describe, expect, it } from 'vitest';
import { comparisonRange, comparisonTime, createFrameIndex, frameAt, frameSeekTime, mediaTime, stepComparison } from '../src/video-comparison/timeline';

const cfr = (fps: number, count = fps * 3) => createFrameIndex(Array.from({ length: count }, (_, i) => ({ timestamp: i / fps, duration: 1 / fps })));
describe('local video comparison timeline', () => {
  it('indexes presentation order, discards negative/duplicate timestamps, and identifies VFR', () => {
    const index = createFrameIndex([0.1, -1, 0.04, 0, 0.04, 0.12].map(timestamp => ({ timestamp, duration: 0.02 })));
    expect([...index.timestamps]).toEqual([0, 0.04, 0.1, 0.12]);
    expect(index.variable).toBe(true);
    expect(frameAt(index, 0.099)).toBe(1);
    expect(frameAt(index, 0.1)).toBe(2);
    expect(frameAt(index, -4)).toBe(0);
    expect(frameAt(index, 999)).toBe(3);
    expect(frameAt(index, frameSeekTime(index, 3))).toBe(3);
  });
  it('detects fractional FPS without interpreting millisecond container rounding as VFR', () => {
    expect(cfr(30).fps).toBeCloseTo(30);
    expect(cfr(60_000 / 1001, 180).fps).toBeCloseTo(59.94, 2);
    const webm = createFrameIndex(Array.from({ length: 90 }, (_, i) => ({ timestamp: Math.round(i * 1000 / 30) / 1000, duration: 0.033 })));
    expect(webm.variable).toBe(false);
  });
  it('aligns different contact frames, frame rates and speed factors bidirectionally', () => {
    const a = { index: cfr(30), contact: 30, speed: 1 };
    const b = { index: cfr(120), contact: 240, speed: 0.5 };
    expect(mediaTime(a, 0)).toBe(1); expect(mediaTime(b, 0)).toBe(2);
    expect(mediaTime(a, 0.5)).toBe(1.5); expect(mediaTime(b, 0.5)).toBe(2.25);
    expect(comparisonTime(b, 270)).toBe(0.5);
    expect(comparisonRange([a, b])).toEqual({ start: -4, end: 119 / 60 });
    expect(stepComparison([a, b], 0, 1)).toBeCloseTo(1 / 60);
    expect(stepComparison([a, b], 0, -1)).toBeCloseTo(-1 / 60);
  });
  it('steps every distinct VFR boundary and holds clips outside their coverage', () => {
    const clip = { index: createFrameIndex([0.2, 0.24, 0.3, 0.32].map(timestamp => ({ timestamp, duration: 0.02 }))), contact: 1, speed: 2 };
    expect(stepComparison([clip], 0, 1)).toBeCloseTo(0.03);
    expect(stepComparison([clip], 0.039, -1)).toBeCloseTo(0.03);
    expect(frameAt(clip.index, mediaTime(clip, -2))).toBe(0);
    expect(frameAt(clip.index, mediaTime(clip, 2))).toBe(3);
    expect(stepComparison([clip], 0.04, 1)).toBe(0.04);
  });
});
