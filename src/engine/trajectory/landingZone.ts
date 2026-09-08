import { COURT } from '../../domain/court';

export type LandingZoneSize = Readonly<{ width: number; depth: number }>;
export type LandingZone = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
export const defaultLandingZone = (family?: string): LandingZoneSize =>
  family === 'serve' ? { width: .9, depth: 1.2 } : { width: 1.6, depth: 2 };

export function normalizeLandingZone(value: unknown, family?: string): LandingZoneSize {
  const size = value as Partial<LandingZoneSize> | null, fallback = defaultLandingZone(family);
  const dimension = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(.2, Math.min(6, value)) : fallback;
  return { width: dimension(size?.width, fallback.width), depth: dimension(size?.depth, fallback.depth) };
}

/** Intersect the rectangle BEFORE sampling, preserving uniform area density even
 * at court edges. A serve uses the diagonal service box from its authored source. */
export function resolveLandingZone(center: Readonly<{ x: number; z: number }>, size: LandingZoneSize,
  family: string, source: Readonly<{ x: number }>): LandingZone {
  const margin = .12, side = COURT.singlesWidth / 2 - margin;
  const serve = family === 'serve';
  const limits = { minX: serve && source.x < 0 ? margin : -side,
    maxX: serve && source.x >= 0 ? -margin : side,
    minZ: -(serve ? COURT.serviceLineFromNet : COURT.halfLength) + margin, maxZ: -margin };
  const x = Math.max(limits.minX, Math.min(limits.maxX, center.x));
  const z = Math.max(limits.minZ, Math.min(limits.maxZ, center.z));
  return { minX: Math.max(limits.minX, x - size.width / 2), maxX: Math.min(limits.maxX, x + size.width / 2),
    minZ: Math.max(limits.minZ, z - size.depth / 2), maxZ: Math.min(limits.maxZ, z + size.depth / 2) };
}

export const landingZoneCenter = (zone: LandingZone) => ({ x: (zone.minX + zone.maxX) / 2, z: (zone.minZ + zone.maxZ) / 2 });
export const sampleLandingZone = (zone: LandingZone, random: () => number) => ({
  x: zone.minX + random() * (zone.maxX - zone.minX), z: zone.minZ + random() * (zone.maxZ - zone.minZ),
});

/** Uniform within the supported parameter interval; no clamped samples at edges. */
export const sampleParameter = (nominal: number, fraction: number, min: number, max: number, random: () => number) => {
  const center = Math.max(min, Math.min(max, nominal));
  const low = Math.max(min, center * (1 - fraction)), high = Math.min(max, center * (1 + fraction));
  return low + random() * (high - low);
};
