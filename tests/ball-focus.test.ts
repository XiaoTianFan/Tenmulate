import { describe, expect, it } from 'vitest';
import { ballFocusWeight, DEFAULT_BALL_FOCUS, normalizeBallFocus } from '../src/engine/rendering/ballFocus';

describe('approaching ball highlight', () => {
  it('defaults off and discards legacy blur settings while preserving the toggle', () => {
    expect(DEFAULT_BALL_FOCUS).toEqual({ enabled: false });
    for (const value of [undefined, null, [], { enabled: 'true', maxBlurPx: NaN }]) expect(normalizeBallFocus(value)).toEqual(DEFAULT_BALL_FOCUS);
    for (const maxBlurPx of [0, 1.5, 5, 6, NaN, Infinity]) {
      expect(normalizeBallFocus({ enabled: true, maxBlurPx })).toEqual({ enabled: true });
      expect(normalizeBallFocus({ enabled: false, maxBlurPx })).toEqual({ enabled: false });
    }
  });

  it('begins strictly after the net, even for cameras near the service line', () => {
    for (const cameraZ of [-15, -5.4, 15, 5.4]) {
      const sourceZ = -Math.sign(cameraZ) * 12;
      expect(ballFocusWeight(sourceZ, sourceZ, cameraZ, 20)).toBe(0);
      expect(ballFocusWeight(0, sourceZ, cameraZ, 12)).toBe(0);
      expect(ballFocusWeight(Math.sign(cameraZ) * .001, sourceZ, cameraZ, 12)).toBeGreaterThan(0);
      expect(ballFocusWeight(Math.sign(cameraZ) * -.001, sourceZ, cameraZ, 12)).toBe(0);
    }
  });

  it('rises exponentially, concentrating the strongest change near the player', () => {
    const weight = (progress: number) => ballFocusWeight(-15 * progress, 12, -15, 15 * (1 - progress));
    let previous = 0, previousGain = 0;
    for (let i = 1; i < 1000; i++) {
      const next = weight(i / 1000), gain = next - previous;
      expect(gain).toBeGreaterThan(previousGain);
      expect(gain).toBeLessThan(.005);
      previous = next; previousGain = gain;
    }
    expect(weight(.25)).toBeLessThan(.04);
    expect(weight(.5)).toBeLessThan(.13);
    expect(weight(.75)).toBeLessThan(.36);
    expect(weight(.9)).toBeGreaterThan(.65);
    expect(weight(.9999)).toBeGreaterThan(.999);
    // The curve scales to each actual camera depth, including volley positions.
    expect(ballFocusWeight(-2.7, 12, -5.4, 2.7)).toBeCloseTo(weight(.5), 12);
  });

  it('cuts to zero at the camera with no pre-crossing taper or release history', () => {
    expect(ballFocusWeight(-14.999, 12, -15, .001)).toBeGreaterThan(.999);
    expect(ballFocusWeight(-15, 12, -15, .5)).toBe(0);
    expect(ballFocusWeight(-15.1, 12, -15, .4)).toBe(0);
    // An angled camera can place the ball behind its view plane before that court depth.
    expect(ballFocusWeight(-14, 12, -15, 0)).toBe(0);
    expect(ballFocusWeight(-14, 12, -15, -.1)).toBe(0);
  });

  it('does not refocus on outgoing returns, tosses or malformed positions', () => {
    expect(ballFocusWeight(-13, -14, -15, 2)).toBe(0);
    expect(ballFocusWeight(12, 12, -15, 27)).toBe(0);
    expect(ballFocusWeight(-13, 0, -15, 2)).toBe(0);
    expect(ballFocusWeight(-1, 12, 0, 1)).toBe(0);
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(ballFocusWeight(invalid, 12, -15, 2)).toBe(0);
      expect(ballFocusWeight(-13, invalid, -15, 2)).toBe(0);
      expect(ballFocusWeight(-13, 12, invalid, 2)).toBe(0);
      expect(ballFocusWeight(-13, 12, -15, invalid)).toBe(0);
    }
  });
});
