import { describe, expect, it } from 'vitest';
import { correctLens, distortLens, MAX_LENS } from '../src/video-comparison/speed/lens';

describe('radial correction coordinates', () => {
  it.each([
    [1920, 1080],
    [1080, 1920],
    [900, 900]
  ])(
    'is invertible for both signs on a %sx%s image, including outside-frame projections',
    (width, height) => {
      for (const lens of [-MAX_LENS, -0.35, 0, 0.35, MAX_LENS]) {
        for (let y = -0.5; y <= 1.5; y += 0.1)
          for (let x = -0.5; x <= 1.5; x += 0.1) {
            const p = { x, y },
              result = distortLens(correctLens(p, lens, width, height), lens, width, height);
            expect(result.x).toBeCloseTo(x, 9);
            expect(result.y).toBeCloseTo(y, 9);
          }
        expect(correctLens({ x: 0.5, y: 0.5 }, lens, width, height)).toEqual({
          x: 0.5,
          y: 0.5
        });
      }
    }
  );
  it('keeps the complete source within the corrected canvas and is monotone radially', () => {
    for (const lens of [-MAX_LENS, MAX_LENS]) {
      let previous = 0;
      for (let x = 0.5; x <= 1; x += 0.001) {
        const p = correctLens({ x, y: x }, lens, 1920, 1080);
        expect(p.x).toBeGreaterThanOrEqual(previous);
        expect(p.x).toBeLessThanOrEqual(1);
        previous = p.x;
      }
    }
  });
});
