import { describe, expect, it } from 'vitest';
import { advanceBallFocus, ballFocusWeight, DEFAULT_BALL_FOCUS, normalizeBallFocus } from '../src/engine/rendering/ballFocus';

describe('optional camera-relative ball focus', () => {
  it('defaults off and bounds malformed or imported preferences', () => {
    for (const value of [undefined, null, [], { enabled: 'true', maxBlurPx: NaN }]) expect(normalizeBallFocus(value)).toEqual(DEFAULT_BALL_FOCUS);
    expect(normalizeBallFocus({ enabled: true, maxBlurPx: Infinity })).toEqual({ enabled: true, maxBlurPx: 3 });
    expect(normalizeBallFocus({ enabled: true, maxBlurPx: 60 }).maxBlurPx).toBe(6);
    expect(normalizeBallFocus({ enabled: true, maxBlurPx: -2 }).maxBlurPx).toBe(0);
  });
  it('increases smoothly with approach and releases at the view boundary', () => {
    let previous = 0;
    for (let distance = 25; distance >= 2; distance -= .01) {
      const weight = ballFocusWeight(distance, distance, 0, 0);
      expect(weight).toBeGreaterThanOrEqual(previous);
      expect(weight - previous).toBeLessThan(.002);
      previous = weight;
    }
    expect(previous).toBe(1);
    expect(ballFocusWeight(2, -1, 0, 0)).toBe(0);
    expect(ballFocusWeight(2, 2, 1.2, 0)).toBe(0);
    expect(ballFocusWeight(2, 2, 0, -1.2)).toBe(0);
    expect(ballFocusWeight(NaN, 2, 0, 0)).toBe(0);
    expect(ballFocusWeight(2, .4, 0, 0)).toBeCloseTo(.5);
    expect(ballFocusWeight(2, 2, 1.01, 0)).toBeCloseTo(.5);
  });
  it('fades handoffs without a cut and converges independently of frame rate', () => {
    const run = (fps: number, start: number, target: number) => {
      let value = start;
      for (let i = 0; i < fps; i++) value = advanceBallFocus(value, target, 1 / fps);
      return value;
    };
    expect(run(30, 0, 1)).toBeCloseTo(run(144, 0, 1), 10);
    expect(run(30, 1, 0)).toBeCloseTo(run(144, 1, 0), 10);
    expect(advanceBallFocus(1, 0, 1 / 60)).toBeGreaterThan(.9);
    expect(run(60, 1, 0)).toBeLessThan(.011);
  });
});
