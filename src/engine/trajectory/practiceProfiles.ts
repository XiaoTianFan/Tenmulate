import { COURT } from '../../domain/court';
import type { SpinKind } from './physics';

export type PracticeShotType = 'groundstroke' | 'serve' | 'volley' | 'lob';

export type PracticeShotProfile = Readonly<{
  label: string;
  contactHeight: number;
  opponentPosition: Readonly<{ x: number; z: number }>;
  defaultPaceKmh: number;
  paceRangeKmh: Readonly<{ min: number; max: number }>;
  defaultNetClearanceM: number;
  netClearanceRangeM: Readonly<{ min: number; max: number }>;
  defaultLandingDepthM: number;
  landingDepthRangeM: Readonly<{ min: number; max: number }>;
  defaultSpin: SpinKind;
  spins: readonly SpinKind[];
}>;

export const PRACTICE_SHOT_PROFILES: Readonly<Record<PracticeShotType, PracticeShotProfile>> = {
  groundstroke: {
    label: 'Groundstroke',
    contactHeight: 1.15,
    opponentPosition: { x: 0, z: COURT.halfLength - 0.65 },
    defaultPaceKmh: 68,
    paceRangeKmh: { min: 45, max: 140 },
    defaultNetClearanceM: 0.36,
    netClearanceRangeM: { min: 0.08, max: 1.8 },
    defaultLandingDepthM: 9.5,
    landingDepthRangeM: { min: 1.2, max: COURT.halfLength - 0.25 },
    defaultSpin: 'topspin',
    spins: ['flat', 'topspin', 'slice'],
  },
  serve: {
    label: 'Serve',
    contactHeight: 2.75,
    opponentPosition: { x: 1.25, z: COURT.halfLength - 0.18 },
    defaultPaceKmh: 135,
    paceRangeKmh: { min: 80, max: 200 },
    defaultNetClearanceM: 0.18,
    netClearanceRangeM: { min: 0.04, max: 1.2 },
    defaultLandingDepthM: 5.05,
    landingDepthRangeM: { min: 1.2, max: COURT.serviceLineFromNet - 0.12 },
    defaultSpin: 'flat',
    spins: ['flat', 'slice', 'kick'],
  },
  volley: {
    label: 'Volley',
    contactHeight: 1.32,
    opponentPosition: { x: 0, z: 3.7 },
    defaultPaceKmh: 62,
    paceRangeKmh: { min: 30, max: 105 },
    defaultNetClearanceM: 0.16,
    netClearanceRangeM: { min: 0.04, max: 1.2 },
    defaultLandingDepthM: 4.5,
    landingDepthRangeM: { min: 1.2, max: 9.5 },
    defaultSpin: 'flat',
    spins: ['flat'],
  },
  lob: {
    label: 'Lob',
    contactHeight: 1.05,
    opponentPosition: { x: 1.1, z: 6.0 },
    defaultPaceKmh: 52,
    paceRangeKmh: { min: 35, max: 105 },
    defaultNetClearanceM: 3.2,
    netClearanceRangeM: { min: 1.2, max: 6 },
    defaultLandingDepthM: 9.3,
    landingDepthRangeM: { min: 3.5, max: COURT.halfLength - 0.25 },
    defaultSpin: 'topspin',
    spins: ['flat', 'topspin', 'slice'],
  },
};

export const isPracticeShotType = (value: unknown): value is PracticeShotType => (
  value === 'groundstroke' || value === 'serve' || value === 'volley' || value === 'lob'
);

export const spinForPracticeShot = (shotType: PracticeShotType, spin: unknown): SpinKind => {
  const profile = PRACTICE_SHOT_PROFILES[shotType];
  return profile.spins.includes(spin as SpinKind) ? spin as SpinKind : profile.defaultSpin;
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
  paceKmh: number,
  netClearanceM: number,
  spin: SpinKind,
): Readonly<{ x: number; z: number }> => {
  const baseDepth = spin === 'kick' ? -4.05 : spin === 'slice' ? -4.65 : -5.05;
  const depth = Math.min(-1.2, Math.max(
    -(COURT.serviceLineFromNet - 0.12),
    baseDepth - (paceKmh - PRACTICE_SHOT_PROFILES.serve.defaultPaceKmh) * 0.012
      + (netClearanceM - PRACTICE_SHOT_PROFILES.serve.defaultNetClearanceM) * 0.7,
  ));
  const direction = Math.min(35, Math.max(-35, aimDirectionDeg)) * Math.PI / 180;
  const projectedX = source.x + Math.tan(direction) * (source.z - depth);
  const halfWidth = COURT.singlesWidth / 2 - 0.12;
  const centerMargin = 0.12;
  const minX = source.x >= 0 ? -halfWidth : centerMargin;
  const maxX = source.x >= 0 ? -centerMargin : halfWidth;
  return { x: Math.min(maxX, Math.max(minX, projectedX)), z: depth };
};
