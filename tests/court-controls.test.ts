import { describe, expect, it } from 'vitest';
import {
  OPPONENT_POSITION_PRESETS,
  cameraMovementDelta,
  playerViewHorizontalToWorldX,
  worldXToPlayerViewHorizontal,
} from '../src/domain/court';

describe('player-view court controls', () => {
  it('maps A to player-view left and D to player-view right', () => {
    expect(cameraMovementDelta('a', 0.16)).toEqual({ behindBaseline: 0, lateral: 0.16 });
    expect(cameraMovementDelta('d', 0.16)).toEqual({ behindBaseline: 0, lateral: -0.16 });
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
