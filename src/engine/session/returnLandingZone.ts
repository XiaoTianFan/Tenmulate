import { COURT } from '../../domain/court';
import type { LandingZone } from '../trajectory/landingZone';

/** Court coordinates, independent of the player's view. Each event owns the
 * intended bounce of its return; the following event intercepts that flight. */
export const RETURN_LANDING_LIMITS: LandingZone = Object.freeze({
  minX: -COURT.singlesWidth / 2 + .12, maxX: COURT.singlesWidth / 2 - .12,
  minZ: .12, maxZ: COURT.halfLength - .12,
});
export const DEFAULT_RETURN_LANDING_ZONE: LandingZone = Object.freeze({
  minX: -.8, maxX: .8, minZ: 7, maxZ: 9,
});

export function isReturnLandingZone(value: unknown): value is LandingZone {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const zone = value as Record<string, unknown>;
  if (Object.keys(zone).some(key => !(key in RETURN_LANDING_LIMITS))
    || !Object.keys(RETURN_LANDING_LIMITS).every(key => typeof zone[key] === 'number' && Number.isFinite(zone[key]))) return false;
  const z = value as LandingZone, width = z.maxX - z.minX, depth = z.maxZ - z.minZ;
  return z.minX >= RETURN_LANDING_LIMITS.minX && z.maxX <= RETURN_LANDING_LIMITS.maxX
    && z.minZ >= RETURN_LANDING_LIMITS.minZ && z.maxZ <= RETURN_LANDING_LIMITS.maxZ
    && width >= .2 - 1e-8 && width <= 6 + 1e-8 && depth >= .2 - 1e-8 && depth <= 6 + 1e-8;
}
