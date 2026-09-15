import { describe, expect, it } from 'vitest';
import { DRILL_BY_CATEGORY } from '../src/content/bundled';
import { PRACTICE_PRESETS } from '../src/components/SetupScreen';
import { DEFAULT_RALLY_OPPONENT_POSITION } from '../src/domain/court';
import { RETURN_SERVE_PATTERN, returnServeTarget, returnServerPosition } from '../src/domain/returnPractice';
import { PRACTICE_SHOT_PROFILES } from '../src/engine/trajectory/practiceProfiles';
import { DEFAULT_CAMERA_POSITION_PRESETS } from '../src/storage/appStorage';
import bundledConfigs from '../src/content/project-configs.json';
import { validateProjectConfigs } from '../src/storage/projectConfigs';
import { practiceLandingTarget } from '../src/engine/trajectory/practiceProfiles';
import { resolveLandingZone } from '../src/engine/trajectory/landingZone';

describe('Quick Practice setup presets', () => {
  it('ships an independent 170 km/h Return with a wide legal service-box zone', () => {
    const config = validateProjectConfigs(bundledConfigs).practiceConfigs['Return Practice']!;
    expect(config).toMatchObject({ shotType: 'serve', spin: 'flat', launchSpeedKmh: 170,
      serveRhythm: 'compact', returnTargetMode: 'custom' });
    const zone = resolveLandingZone(practiceLandingTarget(config.opponentPosition, config.aimDirectionDeg,
      config.landingDepthM), config.landingZone, config.shotType, config.opponentPosition);
    expect(zone.minX).toBeCloseTo(.12);
    expect(zone.maxX).toBeCloseTo(3.97);
    expect(zone.minZ).toBeCloseTo(-6.2);
    expect(zone.maxZ).toBeCloseTo(-4.9);
    expect(config.camera.lateral).toBeGreaterThan(0);
  });
  it('uses the reference recreational Groundstroke ball defaults for Rally', () => {
    expect(PRACTICE_SHOT_PROFILES.groundstroke).toMatchObject({
      defaultLaunchSpeedKmh: 70,
      defaultLandingDepthM: 8.5,
      defaultSpin: 'topspin',
      spinRates: { topspin: { defaultRpm: 1103 } },
    });
    expect(DRILL_BY_CATEGORY.get('Quick Rally')?.defaultInterval).toBe(3.5);
  });

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
