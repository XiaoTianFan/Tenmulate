import { describe, expect, it } from 'vitest';
import {
  OPPONENT_POSITION_PRESETS,
  cameraMovementDelta,
  cameraMovementForKeys,
  playerViewHorizontalToWorldX,
  worldXToPlayerViewHorizontal,
} from '../src/domain/court';

describe('player-view court controls', () => {
  it('maps A to player-view left and D to player-view right', () => {
    expect(cameraMovementDelta('a', 0.16)).toEqual({ behindBaseline: 0, lateral: 0.16 });
    expect(cameraMovementDelta('d', 0.16)).toEqual({ behindBaseline: 0, lateral: -0.16 });
  });

  it('normalizes held-key movement so diagonals are smooth and repeat-rate independent', () => {
    expect(cameraMovementForKeys(new Set(['w']), 0.2)).toEqual({ behindBaseline: -0.2, lateral: 0 });
    const diagonal = cameraMovementForKeys(new Set(['w', 'a']), 0.2);
    expect(Math.hypot(diagonal.behindBaseline, diagonal.lateral)).toBeCloseTo(0.2, 8);
    expect(diagonal.behindBaseline).toBeLessThan(0);
    expect(diagonal.lateral).toBeGreaterThan(0);
    expect(cameraMovementForKeys(new Set(['w', 's']), 0.2)).toEqual({ behindBaseline: 0, lateral: 0 });
  });

  it('mirrors world x into the FPV horizontal direction and round-trips it', () => {
    expect(worldXToPlayerViewHorizontal(2.5)).toBe(-2.5);
    expect(playerViewHorizontalToWorldX(-2.5)).toBe(2.5);
  });

  it('provides opponent-side deuce and ad serving positions', () => {
    const deuce = OPPONENT_POSITION_PRESETS.find((preset) => preset.name === 'Deuce serve');
    const ad = OPPONENT_POSITION_PRESETS.find((preset) => preset.name === 'Ad serve');
    expect(deuce?.point.x).toBeGreaterThan(0);
    expect(ad?.point.x).toBeLessThan(0);
    expect(deuce?.point.z).toBe(ad?.point.z);
  });
});
