import { COURT, DEFAULT_RALLY_OPPONENT_POSITION, DEUCE_SERVE_OPPONENT_POSITION } from '../../domain/court';
import type { SpinKind } from './physics';
import { GROUNDSTROKE_FLAT_SPIN_PROFILE, GROUNDSTROKE_TOPSPIN_DEFAULT_RPM } from './spinCalibration';
import { normalizeShotSpin } from '../../domain/shotKinds';

export type PracticeShotType = 'groundstroke' | 'serve' | 'volley' | 'lob' | 'overhead' | 'drop-shot';

export type SpinRateProfile = Readonly<{
  defaultRpm: number;
  minRpm: number;
  maxRpm: number;
}>;

export type PracticeShotProfile = Readonly<{
  label: string;
  contactHeight: number;
  opponentPosition: Readonly<{ x: number; z: number }>;
  defaultLaunchSpeedKmh: number;
  launchSpeedRangeKmh: Readonly<{ min: number; max: number }>;
  minimumNetClearanceM: number;
  defaultLandingDepthM: number;
  landingDepthRangeM: Readonly<{ min: number; max: number }>;
  defaultSpin: SpinKind;
  spins: readonly SpinKind[];
  spinRates: Readonly<Partial<Record<SpinKind, SpinRateProfile>>>;
}>;

export const PRACTICE_SHOT_PROFILES: Readonly<Record<PracticeShotType, PracticeShotProfile>> = {
  'drop-shot': {
    label: 'Drop shot', contactHeight: .9, opponentPosition: { x: 0, z: 5.5 },
    defaultLaunchSpeedKmh: 38, launchSpeedRangeKmh: { min: 20, max: 100 },
    minimumNetClearanceM: .12, defaultLandingDepthM: 2.8,
    landingDepthRangeM: { min: 1.2, max: COURT.halfLength - .25 },
    defaultSpin: 'slice', spins: ['topspin', 'flat', 'slice'],
    spinRates: { flat: { defaultRpm: 120, minRpm: 0, maxRpm: 500 },
      topspin: { defaultRpm: 600, minRpm: 0, maxRpm: 2500 }, slice: { defaultRpm: 1400, minRpm: 0, maxRpm: 3500 } },
  },
  overhead: {
    label: 'Overhead', contactHeight: 2.7, opponentPosition: { x: 0, z: 4.5 },
    defaultLaunchSpeedKmh: 90, launchSpeedRangeKmh: { min: 50, max: 150 },
    minimumNetClearanceM: .12, defaultLandingDepthM: 8.5,
    landingDepthRangeM: { min: 3, max: COURT.halfLength - .25 },
    defaultSpin: 'flat', spins: ['flat', 'topspin', 'slice'],
    spinRates: { flat: { defaultRpm: 760, minRpm: 250, maxRpm: 1600 }, topspin: { defaultRpm: 1103, minRpm: 300, maxRpm: 3000 }, slice: { defaultRpm: 1000, minRpm: 0, maxRpm: 3000 } },
  },
  groundstroke: {
    label: 'Groundstroke',
    contactHeight: 1.15,
    opponentPosition: DEFAULT_RALLY_OPPONENT_POSITION,
    defaultLaunchSpeedKmh: 70,
    launchSpeedRangeKmh: { min: 45, max: 140 },
    minimumNetClearanceM: 0.12,
    defaultLandingDepthM: 8.5,
    landingDepthRangeM: { min: 1.2, max: COURT.halfLength - 0.25 },
    defaultSpin: 'topspin',
    spins: ['flat', 'topspin', 'slice'],
    spinRates: {
      flat: GROUNDSTROKE_FLAT_SPIN_PROFILE,
      topspin: { defaultRpm: GROUNDSTROKE_TOPSPIN_DEFAULT_RPM, minRpm: 300, maxRpm: 4000 },
      slice: { defaultRpm: 1253, minRpm: 300, maxRpm: 3000 },
    },
  },
  serve: {
    label: 'Serve',
    contactHeight: 2.75,
    opponentPosition: DEUCE_SERVE_OPPONENT_POSITION,
    defaultLaunchSpeedKmh: 135,
    launchSpeedRangeKmh: { min: 80, max: 200 },
    minimumNetClearanceM: 0.08,
    defaultLandingDepthM: 5.05,
    landingDepthRangeM: { min: 1.2, max: COURT.serviceLineFromNet - 0.12 },
    defaultSpin: 'flat',
    spins: ['flat', 'topspin', 'slice', 'kick', 'sidespin'],
    spinRates: {
      flat: { defaultRpm: 1179, minRpm: 400, maxRpm: 2200 },
      slice: { defaultRpm: 2212, minRpm: 800, maxRpm: 3500 },
      kick: { defaultRpm: 3220, minRpm: 1200, maxRpm: 4000 },
      topspin: { defaultRpm: 3220, minRpm: 1200, maxRpm: 4000 },
      sidespin: { defaultRpm: 1814, minRpm: 400, maxRpm: 4000 },
    },
  },
  volley: {
    label: 'Volley',
    contactHeight: 1.5,
    opponentPosition: { x: 0, z: 3.7 },
    defaultLaunchSpeedKmh: 62,
    launchSpeedRangeKmh: { min: 30, max: 105 },
    minimumNetClearanceM: 0.08,
    defaultLandingDepthM: 4.5,
    landingDepthRangeM: { min: 1.2, max: 9.5 },
    defaultSpin: 'flat',
    spins: ['flat', 'topspin', 'slice'],
    spinRates: {
      flat: { defaultRpm: 0, minRpm: 0, maxRpm: 0 },
      topspin: { defaultRpm: 600, minRpm: 0, maxRpm: 2500 },
      slice: { defaultRpm: 650, minRpm: 0, maxRpm: 2500 },
    },
  },
  lob: {
    label: 'Lob',
    contactHeight: 1.05,
    opponentPosition: { x: 1.1, z: 6.0 },
    defaultLaunchSpeedKmh: 52,
    launchSpeedRangeKmh: { min: 35, max: 105 },
    minimumNetClearanceM: 3.2,
    defaultLandingDepthM: 9.3,
    landingDepthRangeM: { min: 3.5, max: COURT.halfLength - 0.25 },
    defaultSpin: 'topspin',
    spins: ['flat', 'topspin', 'slice'],
    spinRates: {
      flat: { defaultRpm: 0, minRpm: 0, maxRpm: 1000 },
      topspin: { defaultRpm: 1199, minRpm: 300, maxRpm: 3000 },
      slice: { defaultRpm: 819, minRpm: 200, maxRpm: 2200 },
    },
  },
};

export const isPracticeShotType = (value: unknown): value is PracticeShotType => (
  value === 'groundstroke' || value === 'serve' || value === 'volley' || value === 'lob' || value === 'overhead' || value === 'drop-shot'
);

export const spinForPracticeShot = (shotType: PracticeShotType, spin: unknown): SpinKind => {
  const profile = PRACTICE_SHOT_PROFILES[shotType];
  const normalized = normalizeShotSpin(shotType, spin as SpinKind);
  return profile.spins.includes(normalized) ? normalized : profile.defaultSpin;
};

export const spinRateProfileForPracticeShot = (
  shotType: PracticeShotType,
  spin: SpinKind,
): SpinRateProfile => {
  const profile = PRACTICE_SHOT_PROFILES[shotType];
  return profile.spinRates[spin] ?? profile.spinRates[profile.defaultSpin] ?? { defaultRpm: 0, minRpm: 0, maxRpm: 0 };
};

export const spinRateForPracticeShot = (
  shotType: PracticeShotType,
  spin: SpinKind,
  rateRpm: unknown,
): number => {
  const profile = spinRateProfileForPracticeShot(shotType, spin);
  return typeof rateRpm === 'number' && Number.isFinite(rateRpm)
    ? Math.min(profile.maxRpm, Math.max(profile.minRpm, Math.round(rateRpm)))
    : profile.defaultRpm;
};

export const practiceLandingTarget = (
  source: Readonly<{ x: number; z: number }>,
  aimDirectionDeg: number,
  landingDepthM: number,
): Readonly<{ x: number; z: number }> => {
  const direction = Math.min(35, Math.max(-35, aimDirectionDeg)) * Math.PI / 180;
  const z = -Math.min(COURT.halfLength - 0.12, Math.max(0.4, landingDepthM));
  return { x: source.x + Math.tan(direction) * (source.z - z), z };
};

export const legalServeTarget = (
  source: Readonly<{ x: number; z: number }>,
  aimDirectionDeg: number,
  landingDepthM: number,
): Readonly<{ x: number; z: number }> => {
  const depth = -Math.min(COURT.serviceLineFromNet - 0.12, Math.max(1.2, landingDepthM));
  const direction = Math.min(35, Math.max(-35, aimDirectionDeg)) * Math.PI / 180;
  const projectedX = source.x + Math.tan(direction) * (source.z - depth);
  const halfWidth = COURT.singlesWidth / 2 - 0.12;
  const centerMargin = 0.12;
  const minX = source.x >= 0 ? -halfWidth : centerMargin;
  const maxX = source.x >= 0 ? -centerMargin : halfWidth;
  return { x: Math.min(maxX, Math.max(minX, projectedX)), z: depth };
};
