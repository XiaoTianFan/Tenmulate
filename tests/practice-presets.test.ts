import { describe, expect, it } from 'vitest';
import { PRACTICE_PRESETS } from '../src/components/SetupScreen';
import { DEFAULT_RALLY_OPPONENT_POSITION } from '../src/domain/court';
import { PRACTICE_SHOT_PROFILES } from '../src/engine/trajectory/practiceProfiles';
import { DEFAULT_CAMERA_POSITION_PRESETS } from '../src/storage/appStorage';

describe('Quick Practice setup presets', () => {
  it('keeps Volley as a net-side receiver setup with a baseline groundstroke feed', () => {
    const volley = PRACTICE_PRESETS.find((preset) => preset.id === 'volley');
    const netCamera = DEFAULT_CAMERA_POSITION_PRESETS.find((preset) => preset.id === volley?.cameraPresetId);

    expect(volley).toMatchObject({
      cameraPresetId: 'position-net',
      opponent: DEFAULT_RALLY_OPPONENT_POSITION,
      shotType: 'groundstroke',
    });
    expect(netCamera?.position.behindBaseline).toBeLessThan(0);
    expect(netCamera?.position.eyeHeight).toBeCloseTo(1.66, 8);
  });

  it('leaves the explicit opponent Volley shot profile available outside the rail preset', () => {
    expect(PRACTICE_PRESETS.some((preset) => preset.shotType === 'volley')).toBe(false);
    expect(PRACTICE_SHOT_PROFILES.volley).toMatchObject({
      opponentPosition: { x: 0, z: 3.7 },
      defaultSpin: 'flat',
    });
  });
});
