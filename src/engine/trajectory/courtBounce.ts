import { COURT, type SurfaceId } from '../../domain/court';
import { vec3, type Vec3 } from '../../domain/vector';

const BALL_INERTIA_FACTOR = 0.55;
const CONTACT_VELOCITY_COUPLING = BALL_INERTIA_FACTOR / (1 + BALL_INERTIA_FACTOR);
const TANGENTIAL_RESTITUTION = 0.1;

export type SurfaceProfile = Readonly<{
  id: SurfaceId;
  /** Normal impact COR at 7 m/s, before the oblique-impact correction. */
  normalRestitution: number;
  obliqueRestitutionGain: number;
  /** Effective forward offset of the normal impulse when the ball deforms. */
  normalImpulseOffsetM: number;
  friction: number;
  rollingResistance: number;
}>;

export const SURFACE_PROFILES: Record<SurfaceId, SurfaceProfile> = {
  hard: { id: 'hard', normalRestitution: 0.775, obliqueRestitutionGain: 0.085, normalImpulseOffsetM: 0.007, friction: 0.56, rollingResistance: 1.8 },
  clay: { id: 'clay', normalRestitution: 0.78, obliqueRestitutionGain: 0.12, normalImpulseOffsetM: 0.009, friction: 0.68, rollingResistance: 2.2 },
  grass: { id: 'grass', normalRestitution: 0.65, obliqueRestitutionGain: 0.055, normalImpulseOffsetM: 0.003, friction: 0.42, rollingResistance: 1.45 },
};

/** Calibrated collision response, not a multiplier on the drawn arc. The hard
 * reference reproduces the ITF 2.54 m drop with air drag included. Cross's court
 * measurements show higher COR for oblique impacts than vertical drops. Blend
 * continuously by impact angle, using normal (not total) impact speed.
 * See docs/development/ball-bounce-research-2026-09-11.md for data and limits. */
export const surfaceRestitution = (surface: SurfaceProfile, velocity: Vec3): number => {
  const normalSpeed = Math.max(0, -velocity.y);
  const horizontalSpeedSquared = velocity.x ** 2 + velocity.z ** 2;
  const obliquity = horizontalSpeedSquared / Math.max(1e-9, horizontalSpeedSquared + normalSpeed ** 2);
  const impactCorrection = Math.min(0.07, Math.max(-0.12, (7 - normalSpeed) * 0.012));
  return Math.min(0.93, Math.max(0.5,
    surface.normalRestitution + impactCorrection + surface.obliqueRestitutionGain * obliquity));
};

/** Impulses per unit mass. Spin is radians/second, velocity metres/second.
 * A deformable ball bites rather than immediately becoming a rigid rolling
 * sphere. A forward normal impulse opposes rolling spin; elastic grip avoids
 * the old universal 0.645 horizontal speed retention when friction saturates.
 * bounceFactor retains the explicit first-bounce vertical-speed override. */
export function resolveCourtBounce(velocity: Vec3, spin: Vec3, surface: SurfaceProfile, bounceFactor = 1): { velocity: Vec3; spin: Vec3 } {
  const normalSpeed = Math.max(0, -velocity.y);
  const restitution = surfaceRestitution(surface, velocity);
  const normalImpulse = (1 + restitution) * normalSpeed;
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  const forwardX = horizontalSpeed > 1e-9 ? velocity.x / horizontalSpeed : 0;
  const forwardZ = horizontalSpeed > 1e-9 ? velocity.z / horizontalSpeed : 0;
  // Fade the offset for nearly vertical impacts instead of inventing an axis.
  const offset = surface.normalImpulseOffsetM * horizontalSpeed / Math.max(1e-9, Math.hypot(horizontalSpeed, normalSpeed));
  const normalSpinDelta = offset * normalImpulse / (BALL_INERTIA_FACTOR * COURT.ballRadius ** 2);
  const contactVelocityX = velocity.x + COURT.ballRadius * spin.z;
  const contactVelocityZ = velocity.z - COURT.ballRadius * spin.x;
  const requiredDeltaX = -((1 + TANGENTIAL_RESTITUTION) * contactVelocityX + COURT.ballRadius * normalSpinDelta * forwardX) * CONTACT_VELOCITY_COUPLING;
  const requiredDeltaZ = -((1 + TANGENTIAL_RESTITUTION) * contactVelocityZ + COURT.ballRadius * normalSpinDelta * forwardZ) * CONTACT_VELOCITY_COUPLING;
  const requiredDelta = Math.hypot(requiredDeltaX, requiredDeltaZ);
  const maximumFrictionDelta = surface.friction * normalImpulse;
  const frictionScale = requiredDelta > maximumFrictionDelta && requiredDelta > 0 ? maximumFrictionDelta / requiredDelta : 1;
  const deltaVelocityX = requiredDeltaX * frictionScale;
  const deltaVelocityZ = requiredDeltaZ * frictionScale;
  return {
    velocity: vec3(velocity.x + deltaVelocityX, normalSpeed * restitution * Math.min(1.4, Math.max(0.6, bounceFactor)), velocity.z + deltaVelocityZ),
    spin: vec3(spin.x - deltaVelocityZ / (BALL_INERTIA_FACTOR * COURT.ballRadius) - normalSpinDelta * forwardZ,
      spin.y, spin.z + deltaVelocityX / (BALL_INERTIA_FACTOR * COURT.ballRadius) + normalSpinDelta * forwardX),
  };
}
