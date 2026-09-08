import { describe, expect, it } from 'vitest';
import { advanceFocusDistance, lensBlurRadius } from '../src/engine/rendering/lensFocus';

describe('lens focus', () => {
  it('keeps the focal plane sharp and separates near/far circles of confusion', () => {
    expect(lensBlurRadius(4, 4, 6)).toBe(0);
    expect(lensBlurRadius(2, 4, 6)).toBe(-6);
    expect(lensBlurRadius(8, 4, 6)).toBe(3);
    expect(lensBlurRadius(16, 4, 6)).toBe(4.5);
    expect(lensBlurRadius(1000, 4, 6)).toBeLessThan(6);
  });
  it('adapts to focus distance without exceeding the selected pixel radius', () => {
    for (const focus of [1, 2.5, 6, 12]) for (const depth of [.1, 1, 2.5, 4, 12, 30, 350]) {
      expect(Math.abs(lensBlurRadius(depth, focus, 6))).toBeLessThanOrEqual(6);
      expect(lensBlurRadius(depth, focus, 0)).toBe(0);
    }
    expect(lensBlurRadius(12, 4, 6)).toBeGreaterThan(lensBlurRadius(12, 8, 6));
    for (const depth of [0, -1, NaN, Infinity]) expect(lensBlurRadius(depth, 4, 6)).toBe(0);
  });
  it('racks focus without overshooting or depending on refresh rate', () => {
    const run = (fps: number) => {
      let distance = 14;
      for (let i = 0; i < fps; i++) {
        const next = advanceFocusDistance(distance, 2.5, 1 / fps);
        expect(next).toBeLessThan(distance); expect(next).toBeGreaterThan(2.5); distance = next;
      }
      return distance;
    };
    expect(run(30)).toBeCloseTo(run(144), 10);
    expect(advanceFocusDistance(4, 2, 0)).toBe(4);
  });
});
