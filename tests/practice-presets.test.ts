import { describe, expect, it } from 'vitest';
import { PRACTICE_PRESETS } from '../src/components/SetupScreen';
import { DEFAULT_RALLY_OPPONENT_POSITION } from '../src/domain/court';
import { RETURN_SERVE_PATTERN, returnServeTarget, returnServerPosition } from '../src/domain/returnPractice';
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

  it('starts Return from the left receiver corner with a legal opposite-side server', () => {
    const returnPreset = PRACTICE_PRESETS.find((preset) => preset.id === 'return');
    const leftCamera = DEFAULT_CAMERA_POSITION_PRESETS.find((preset) => preset.id === returnPreset?.cameraPresetId);
    const rightCamera = DEFAULT_CAMERA_POSITION_PRESETS.find((preset) => preset.id === 'position-right');

    expect(returnPreset).toMatchObject({
      cameraPresetId: 'position-left',
      opponent: returnServerPosition('left'),
      shotType: 'serve',
      returnReceiverSide: 'left',
    });
    expect(leftCamera?.position.lateral).toBeGreaterThan(0);
    expect(rightCamera?.position.lateral).toBeLessThan(0);
    expect(returnPreset?.opponent.z).toBeGreaterThan(11.885);
  });

  it('mirrors the T, body, and wide service-box targets for either receiver corner', () => {
    const leftTargets = RETURN_SERVE_PATTERN.map((placement) => returnServeTarget('left', placement, 5.05));
    const rightTargets = RETURN_SERVE_PATTERN.map((placement) => returnServeTarget('right', placement, 5.05));

    expect(RETURN_SERVE_PATTERN).toEqual(['t', 'body', 'wide']);
    expect(leftTargets.map((target) => target.x)).toEqual([...leftTargets.map((target) => target.x)].sort((a, b) => a - b));
    expect(rightTargets).toEqual(leftTargets.map((target) => ({ x: -target.x, z: target.z })));
    expect(leftTargets.every((target) => target.x > 0 && target.x < 4.115 && target.z >= -6.4 && target.z < 0)).toBe(true);
    expect(returnServerPosition('left').x).toBeLessThan(0);
    expect(returnServerPosition('right').x).toBeGreaterThan(0);
  });
});
