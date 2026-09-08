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
  const limits = landingZoneLimits(family, source);
  const x = Math.max(limits.minX, Math.min(limits.maxX, center.x));
  const z = Math.max(limits.minZ, Math.min(limits.maxZ, center.z));
  return { minX: Math.max(limits.minX, x - size.width / 2), maxX: Math.min(limits.maxX, x + size.width / 2),
    minZ: Math.max(limits.minZ, z - size.depth / 2), maxZ: Math.min(limits.maxZ, z + size.depth / 2) };
}

export function landingZoneLimits(family: string, source: Readonly<{ x: number }>): LandingZone {
  const margin = .12, side = COURT.singlesWidth / 2 - margin;
  const serve = family === 'serve';
  return { minX: serve && source.x < 0 ? margin : -side,
    maxX: serve && source.x >= 0 ? -margin : side,
    minZ: -(serve ? COURT.serviceLineFromNet : COURT.halfLength) + margin, maxZ: -margin };
}

export type ZoneHandle = Readonly<{ x: -1 | 0 | 1; z: -1 | 0 | 1 }>;

/** Opposite edges stay anchored while resizing; translation preserves dimensions. */
export function editLandingZone(zone: LandingZone, handle: ZoneHandle, dx: number, dz: number, limits: LandingZone): LandingZone {
  const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
  if (!handle.x && !handle.z) {
    dx = clamp(dx, limits.minX - zone.minX, limits.maxX - zone.maxX);
    dz = clamp(dz, limits.minZ - zone.minZ, limits.maxZ - zone.maxZ);
    return { minX: zone.minX + dx, maxX: zone.maxX + dx, minZ: zone.minZ + dz, maxZ: zone.maxZ + dz };
  }
  return {
    minX: handle.x === -1 ? clamp(zone.minX + dx, Math.max(limits.minX, zone.maxX - 6), zone.maxX - .2) : zone.minX,
    maxX: handle.x === 1 ? clamp(zone.maxX + dx, zone.minX + .2, Math.min(limits.maxX, zone.minX + 6)) : zone.maxX,
    minZ: handle.z === -1 ? clamp(zone.minZ + dz, Math.max(limits.minZ, zone.maxZ - 6), zone.maxZ - .2) : zone.minZ,
    maxZ: handle.z === 1 ? clamp(zone.maxZ + dz, zone.minZ + .2, Math.min(limits.maxZ, zone.minZ + 6)) : zone.maxZ,
  };
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
