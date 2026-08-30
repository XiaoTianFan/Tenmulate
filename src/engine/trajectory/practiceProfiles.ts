import { COURT } from '../../domain/court';
import type { SpinKind } from './physics';

export type PracticeShotType = 'groundstroke' | 'serve' | 'volley';

export type PracticeShotProfile = Readonly<{
  label: string;
  contactHeight: number;
  opponentPosition: Readonly<{ x: number; z: number }>;
  defaultPaceKmh: number;
  paceRangeKmh: Readonly<{ min: number; max: number }>;
  defaultNetClearanceM: number;
  defaultSpin: SpinKind;
  spins: readonly SpinKind[];
}>;

export const PRACTICE_SHOT_PROFILES: Readonly<Record<PracticeShotType, PracticeShotProfile>> = {
  groundstroke: {
    label: 'Groundstroke',
    contactHeight: 1.15,
    opponentPosition: { x: 0, z: COURT.halfLength - 0.65 },
    defaultPaceKmh: 78,
    paceRangeKmh: { min: 35, max: 140 },
    defaultNetClearanceM: 0.36,
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
    defaultSpin: 'flat',
    spins: ['flat'],
  },
};

export const isPracticeShotType = (value: unknown): value is PracticeShotType => (
  value === 'groundstroke' || value === 'serve' || value === 'volley'
);

export const spinForPracticeShot = (shotType: PracticeShotType, spin: unknown): SpinKind => {
  const profile = PRACTICE_SHOT_PROFILES[shotType];
  return profile.spins.includes(spin as SpinKind) ? spin as SpinKind : profile.defaultSpin;
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
