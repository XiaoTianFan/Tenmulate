import { describe, expect, it } from 'vitest';
import {
  COURT,
  DEFAULT_RALLY_OPPONENT_POSITION,
  OPPONENT_POSITION_PRESETS,
  OPPONENT_POSITION_LIMITS,
  cameraMovementDelta,
  cameraMovementForKeys,
  clampOpponentPosition,
  playerViewHorizontalToWorldX,
  worldXToPlayerViewHorizontal,
} from '../src/domain/court';

describe('player-view court controls', () => {
  it('maps A to player-view left and D to player-view right', () => {
    expect(cameraMovementDelta('a', 0.16)).toEqual({ behindBaseline: 0, lateral: 0.16, eyeHeight: 0 });
    expect(cameraMovementDelta('d', 0.16)).toEqual({ behindBaseline: 0, lateral: -0.16, eyeHeight: 0 });
  });

  it('normalizes held-key movement so diagonals are smooth and repeat-rate independent', () => {
    expect(cameraMovementForKeys(new Set(['w']), 0.2)).toEqual({ behindBaseline: -0.2, lateral: 0, eyeHeight: 0 });
    const diagonal = cameraMovementForKeys(new Set(['w', 'a']), 0.2);
    expect(Math.hypot(diagonal.behindBaseline, diagonal.lateral)).toBeCloseTo(0.2, 8);
    expect(diagonal.behindBaseline).toBeLessThan(0);
    expect(diagonal.lateral).toBeGreaterThan(0);
    expect(cameraMovementForKeys(new Set(['w', 's']), 0.2)).toEqual({ behindBaseline: 0, lateral: 0, eyeHeight: 0 });
  });

  it('rotates horizontal movement with the current camera yaw', () => {
    expect(cameraMovementForKeys(new Set(['w']), 0.2, 90)).toEqual({ behindBaseline: 0, lateral: 0.2, eyeHeight: 0 });
    expect(cameraMovementForKeys(new Set(['w']), 0.2, -90)).toEqual({ behindBaseline: 0, lateral: -0.2, eyeHeight: 0 });
    expect(cameraMovementForKeys(new Set(['a']), 0.2, 90)).toEqual({ behindBaseline: 0.2, lateral: 0, eyeHeight: 0 });
  });

  it('reserves Ctrl+W/S for camera height without horizontal drift', () => {
    expect(cameraMovementForKeys(new Set(['w']), 0.2, 137, true)).toEqual({ behindBaseline: 0, lateral: 0, eyeHeight: 0.2 });
    expect(cameraMovementForKeys(new Set(['s']), 0.2, -48, true)).toEqual({ behindBaseline: 0, lateral: 0, eyeHeight: -0.2 });
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

  it('uses the ITF international-competition runoff as the opponent placement envelope', () => {
    expect(OPPONENT_POSITION_LIMITS.halfWidth).toBeCloseTo(COURT.doublesWidth / 2 + 3.66, 8);
    expect(OPPONENT_POSITION_LIMITS.halfLength).toBeCloseTo(COURT.halfLength + 6.4, 8);
    expect(clampOpponentPosition({ x: 99, z: -99 })).toEqual({
      x: OPPONENT_POSITION_LIMITS.halfWidth,
      z: -OPPONENT_POSITION_LIMITS.halfLength,
    });
  });

  it('places the default rally opponent one metre behind the far baseline', () => {
    expect(DEFAULT_RALLY_OPPONENT_POSITION).toEqual({ x: 0, z: COURT.halfLength + 1 });
    expect(OPPONENT_POSITION_PRESETS.find((preset) => preset.name === 'Baseline center')?.point).toEqual(DEFAULT_RALLY_OPPONENT_POSITION);
  });
});
