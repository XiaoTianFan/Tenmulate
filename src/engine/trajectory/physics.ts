import { COURT, type SurfaceId } from '../../domain/court';
import { add, cross, magnitude, scale, subtract, vec3, type Vec3 } from '../../domain/vector';
import type { PracticeShotType } from './practiceProfiles';

const GRAVITY = vec3(0, -9.81, 0);
const FIXED_STEP = 1 / 240;
const BALL_MASS_KG = 0.0577;
const BALL_AREA_M2 = Math.PI * COURT.ballRadius ** 2;
const AIR_DENSITY_KG_M3 = 1.225;
const DRAG_COEFFICIENT = 0.55;
const LIFT_COEFFICIENT_SLOPE = 0.6;
const MAX_LIFT_COEFFICIENT = 0.35;
const SPIN_DECAY_PER_M = -Math.log(0.98) / 6.4;
const BALL_INERTIA_FACTOR = 0.55;
const CONTACT_VELOCITY_COUPLING = BALL_INERTIA_FACTOR / (1 + BALL_INERTIA_FACTOR);
const AERODYNAMIC_ACCELERATION_FACTOR = 0.5 * AIR_DENSITY_KG_M3 * BALL_AREA_M2 / BALL_MASS_KG;
const MAX_SIMULATION_SECONDS = 10;
export const POST_BOUNCE_SIMULATION_SECONDS = 3;

export type SpinKind = 'flat' | 'topspin' | 'slice' | 'kick' | 'sidespin';

export type SurfaceProfile = Readonly<{
  id: SurfaceId;
  normalRestitution: number;
  friction: number;
  rollingResistance: number;
}>;

export const SURFACE_PROFILES: Record<SurfaceId, SurfaceProfile> = {
  hard: { id: 'hard', normalRestitution: 0.67, friction: 0.56, rollingResistance: 1.8 },
  clay: { id: 'clay', normalRestitution: 0.71, friction: 0.68, rollingResistance: 2.2 },
  grass: { id: 'grass', normalRestitution: 0.60, friction: 0.42, rollingResistance: 1.45 },
};

export type ShotIntent = Readonly<{
  source: Vec3;
  target: Readonly<{ x: number; z: number }>;
  aimDirectionDeg?: number;
  launchSpeedKmh: number;
  spin: SpinKind;
  spinRateRpm?: number;
  shotType?: PracticeShotType;
  family?: string;
  opponentHand?: 'left' | 'right';
  surface: SurfaceId;
  receiverZ?: number;
  minimumNetClearanceM?: number;
  windVelocity?: Vec3;
  bounceFactor?: number;
}>;

export type FlightSample = Readonly<{
  time: number;
  position: Vec3;
  velocity: Vec3;
  bounced: boolean;
}>;

export type TrajectoryEvent = Readonly<{
  type: 'net-crossing' | 'bounce' | 'receiver-plane';
  time: number;
  position: Vec3;
  speedKmh: number;
  postSpeedKmh?: number;
}>;

export type ResolvedTrajectory = Readonly<{
  intent: ShotIntent;
  launchVelocity: Vec3;
  samples: readonly FlightSample[];
  events: readonly TrajectoryEvent[];
  apexHeight: number;
  resolved: Readonly<{
    launchSpeedKmh: number;
    launchAngleDeg: number;
    spinRateRpm: number;
    spinParameter: number;
  }>;
}>;

const trajectoryShotType = (intent: Pick<ShotIntent, 'shotType' | 'family'>): PracticeShotType => {
  if (intent.shotType) return intent.shotType;
  if (intent.family === 'serve') return 'serve';
  if (intent.family === 'volley') return 'volley';
  if (intent.family === 'lob' || intent.family === 'overhead') return 'lob';
  return 'groundstroke';
};

const radiansPerSecondFromRpm = (rpm: number): number => rpm * Math.PI * 2 / 60;
const rpmFromRadiansPerSecond = (radiansPerSecond: number): number => radiansPerSecond * 60 / (Math.PI * 2);

const defaultSpinRateRpm = (intent: Pick<ShotIntent, 'spin' | 'shotType' | 'family'>): number => {
  const shotType = trajectoryShotType(intent);
  if (shotType === 'volley') return 0;
  if (shotType === 'serve') {
    if (intent.spin === 'flat') return 1179;
    if (intent.spin === 'slice') return 2212;
    if (intent.spin === 'kick' || intent.spin === 'topspin') return 3220;
    return 1814;
  }
  if (shotType === 'lob') {
    if (intent.spin === 'topspin' || intent.spin === 'kick') return 1199;
    if (intent.spin === 'slice') return 819;
    return 0;
  }
  if (intent.spin === 'topspin') return 1814;
  if (intent.spin === 'slice') return 1253;
  if (intent.spin === 'kick') return 2285;
  if (intent.spin === 'sidespin') return 1432;
  return 0;
};

const spinAxisWeights = (
  intent: Pick<ShotIntent, 'spin' | 'shotType' | 'family' | 'opponentHand'>,
): Readonly<{ topspin: number; sidespin: number }> => {
  const handDirection = intent.opponentHand === 'left' ? -1 : 1;
  const shotType = trajectoryShotType(intent);
  if (shotType === 'volley') return { topspin: 0, sidespin: 0 };
  if (shotType === 'serve') {
    switch (intent.spin) {
      case 'flat':
        return { topspin: 45, sidespin: handDirection * 115 };
      case 'slice':
        return { topspin: 55, sidespin: handDirection * 225 };
      case 'kick':
      case 'topspin':
        return { topspin: 285, sidespin: handDirection * 180 };
      default:
        return { topspin: 0, sidespin: handDirection * 190 };
    }
  }
  if (shotType === 'lob') {
    switch (intent.spin) {
      case 'topspin':
      case 'kick':
        return { topspin: 125, sidespin: handDirection * 12 };
      case 'slice':
        return { topspin: -85, sidespin: handDirection * 12 };
      default:
        return { topspin: 1, sidespin: 0 };
    }
  }
  switch (intent.spin) {
    case 'topspin':
      return { topspin: 1, sidespin: 0 };
    case 'slice':
      return { topspin: -130, sidespin: handDirection * 18 };
    case 'kick':
      return { topspin: 235, sidespin: handDirection * 45 };
    case 'sidespin':
      return { topspin: 0, sidespin: handDirection };
    default:
      return { topspin: 1, sidespin: 0 };
  }
};

const spinVector = (
  intent: Pick<ShotIntent, 'spin' | 'spinRateRpm' | 'shotType' | 'family' | 'opponentHand'>,
  launchVelocity: Vec3,
): Vec3 => {
  if (trajectoryShotType(intent) === 'volley') return vec3();
  const rateRpm = typeof intent.spinRateRpm === 'number' && Number.isFinite(intent.spinRateRpm)
    ? Math.max(0, intent.spinRateRpm)
    : defaultSpinRateRpm(intent);
  if (rateRpm <= 0) return vec3();
  const horizontalSpeed = Math.hypot(launchVelocity.x, launchVelocity.z);
  const speed = magnitude(launchVelocity);
  if (horizontalSpeed < 0.001 || speed < 0.001) return vec3();
  const topAxis = vec3(launchVelocity.z / horizontalSpeed, 0, -launchVelocity.x / horizontalSpeed);
  const velocityDirection = scale(launchVelocity, 1 / speed);
  const sideAxis = cross(velocityDirection, topAxis);
  const weights = spinAxisWeights(intent);
  const weightedAxis = add(scale(topAxis, weights.topspin), scale(sideAxis, weights.sidespin));
  const axisMagnitude = magnitude(weightedAxis);
  return axisMagnitude > 0
    ? scale(weightedAxis, radiansPerSecondFromRpm(rateRpm) / axisMagnitude)
    : vec3();
};

const decaySpin = (spin: Vec3, distanceM: number): Vec3 => (
  scale(spin, Math.exp(-SPIN_DECAY_PER_M * Math.max(0, distanceM)))
);

const acceleration = (velocity: Vec3, spin: Vec3, windVelocity = vec3()): Vec3 => {
  const airVelocity = subtract(velocity, windVelocity);
  const speed = magnitude(airVelocity);
  if (speed < 0.001) return GRAVITY;
  const drag = scale(airVelocity, -AERODYNAMIC_ACCELERATION_FACTOR * DRAG_COEFFICIENT * speed);
  const spinMagnitude = magnitude(spin);
  const spinParameter = COURT.ballRadius * spinMagnitude / speed;
  const liftCoefficient = Math.min(MAX_LIFT_COEFFICIENT, LIFT_COEFFICIENT_SLOPE * spinParameter);
  const spinCrossVelocity = cross(spin, airVelocity);
  const crossMagnitude = magnitude(spinCrossVelocity);
  const magnus = crossMagnitude > 0
    ? scale(spinCrossVelocity, AERODYNAMIC_ACCELERATION_FACTOR * liftCoefficient * speed ** 2 / crossMagnitude)
    : vec3();
  return add(GRAVITY, add(drag, magnus));
};

const lowArcVelocity = (intent: ShotIntent): Vec3 => {
  const dx = intent.target.x - intent.source.x;
  const dz = intent.target.z - intent.source.z;
  const distance = Math.hypot(dx, dz);
  const speed = Math.max(8, intent.launchSpeedKmh / 3.6);
  const deltaY = COURT.ballRadius - intent.source.y;
  const speedSquared = speed * speed;
  const discriminant = Math.max(
    0,
    speedSquared * speedSquared - 9.81 * (9.81 * distance * distance + 2 * deltaY * speedSquared),
  );
  const angle = Math.atan((speedSquared - Math.sqrt(discriminant)) / (9.81 * distance));
  const horizontal = speed * Math.cos(Number.isFinite(angle) ? angle : 0.18);
  const directionX = dx / distance;
  const directionZ = dz / distance;
  return vec3(
    directionX * horizontal,
    speed * Math.sin(Number.isFinite(angle) ? angle : 0.18),
    directionZ * horizontal,
  );
};

const firstBounce = (intent: ShotIntent, initialVelocity: Vec3): FlightSample => {
  let position = intent.source;
  let velocity = initialVelocity;
  let spin = spinVector(intent, initialVelocity);

  for (let index = 1; index < 5 / FIXED_STEP; index += 1) {
    const nextVelocity = add(velocity, scale(acceleration(velocity, spin), FIXED_STEP));
    const nextPosition = add(position, scale(nextVelocity, FIXED_STEP));
    spin = decaySpin(spin, magnitude(nextVelocity) * FIXED_STEP);
    if (nextPosition.y <= COURT.ballRadius && nextVelocity.y < 0) {
      return {
        time: index * FIXED_STEP,
        position: vec3(nextPosition.x, COURT.ballRadius, nextPosition.z),
        velocity: nextVelocity,
        bounced: true,
      };
    }
    position = nextPosition;
    velocity = nextVelocity;
  }

  return { time: 5, position, velocity, bounced: false };
};

const firstNetCrossing = (intent: ShotIntent, initialVelocity: Vec3): FlightSample | null => {
  let position = intent.source;
  let velocity = initialVelocity;
  let spin = spinVector(intent, initialVelocity);

  for (let index = 1; index < 3 / FIXED_STEP; index += 1) {
    const nextVelocity = add(velocity, scale(acceleration(velocity, spin), FIXED_STEP));
    const nextPosition = add(position, scale(nextVelocity, FIXED_STEP));
    spin = decaySpin(spin, magnitude(nextVelocity) * FIXED_STEP);
    if (position.z > 0 && nextPosition.z <= 0) {
      return {
        time: index * FIXED_STEP,
        position: nextPosition,
        velocity: nextVelocity,
        bounced: false,
      };
    }
    position = nextPosition;
    velocity = nextVelocity;
  }
  return null;
};

const firstFlight = (intent: ShotIntent, initialVelocity: Vec3): Readonly<{
  bounce: FlightSample;
  netCrossing: FlightSample | null;
}> => {
  let position = intent.source;
  let velocity = initialVelocity;
  let spin = spinVector(intent, initialVelocity);
  let netCrossing: FlightSample | null = null;

  for (let index = 1; index < 5 / FIXED_STEP; index += 1) {
    const nextVelocity = add(velocity, scale(acceleration(velocity, spin), FIXED_STEP));
    const nextPosition = add(position, scale(nextVelocity, FIXED_STEP));
    spin = decaySpin(spin, magnitude(nextVelocity) * FIXED_STEP);
    if (!netCrossing && position.z > 0 && nextPosition.z <= 0) {
      netCrossing = { time: index * FIXED_STEP, position: nextPosition, velocity: nextVelocity, bounced: false };
    }
    if (nextPosition.y <= COURT.ballRadius && nextVelocity.y < 0) {
      return {
        bounce: { time: index * FIXED_STEP, position: vec3(nextPosition.x, COURT.ballRadius, nextPosition.z), velocity: nextVelocity, bounced: true },
        netCrossing,
      };
    }
    position = nextPosition;
    velocity = nextVelocity;
  }
  return { bounce: { time: 5, position, velocity, bounced: false }, netCrossing };
};

const directedVelocity = (intent: ShotIntent): Vec3 => {
  const direction = Math.min(35, Math.max(-35, intent.aimDirectionDeg ?? 0)) * Math.PI / 180;
  const speed = Math.max(8, intent.launchSpeedKmh / 3.6);
  const shotType = trajectoryShotType(intent);
  const defaultClearance = shotType === 'lob' ? 1.2 : shotType === 'serve' || shotType === 'volley' ? 0.08 : 0.12;
  const clearance = Math.min(shotType === 'lob' ? 6 : 1.8, Math.max(0.04, intent.minimumNetClearanceM ?? defaultClearance));
  const minimumAngle = (shotType === 'lob' ? 25 : shotType === 'volley' ? -14 : -5) * Math.PI / 180;
  const maximumAngle = (shotType === 'lob' ? 78 : shotType === 'volley' ? 52 : 58) * Math.PI / 180;
  const calmIntent = { ...intent, windVelocity: undefined };
  const sampleCount = 48;
  const angleStep = (maximumAngle - minimumAngle) / sampleCount;
  type Candidate = Readonly<{ angle: number; velocity: Vec3; score: number; bounceZ: number }>;
  let best: Candidate | null = null;
  let fallback: Candidate | null = null;

  const candidateAt = (angle: number, requireNetClearance: boolean): Candidate | null => {
    const velocity = velocityForDirectionAndAngle(speed, direction, angle);
    const { bounce, netCrossing } = firstFlight(calmIntent, velocity);
    const score = Math.hypot(bounce.position.x - intent.target.x, bounce.position.z - intent.target.z);
    if (!fallback || bounce.position.z < fallback.bounceZ) {
      fallback = { angle, velocity, score, bounceZ: bounce.position.z };
    }
    if (!requireNetClearance) return { angle, velocity, score, bounceZ: bounce.position.z };
    const crossing = netCrossing;
    if (!crossing || crossing.time >= bounce.time) return null;
    if (crossing.position.y < netHeightAt(crossing.position.x) + clearance) return null;
    return { angle, velocity, score, bounceZ: bounce.position.z };
  };

  const prefer = (candidate: Candidate, current: Candidate | null): boolean => {
    if (!current || candidate.score < current.score - 0.001) return true;
    return shotType === 'lob' && Math.abs(candidate.score - current.score) <= 0.03 && candidate.angle > current.angle;
  };

  for (let index = 0; index <= sampleCount; index += 1) {
    const candidate = candidateAt(minimumAngle + angleStep * index, true);
    if (candidate && prefer(candidate, best)) best = candidate;
  }

  if (!best) return (fallback as Candidate | null)?.velocity ?? velocityForDirectionAndAngle(speed, direction, maximumAngle);

  let lowerAngle = Math.max(minimumAngle, best.angle - angleStep);
  let upperAngle = Math.min(maximumAngle, best.angle + angleStep);
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const lowerThird = lowerAngle + (upperAngle - lowerAngle) / 3;
    const upperThird = upperAngle - (upperAngle - lowerAngle) / 3;
    const lowerCandidate = candidateAt(lowerThird, true);
    const upperCandidate = candidateAt(upperThird, true);
    if (lowerCandidate && prefer(lowerCandidate, best)) best = lowerCandidate;
    if (upperCandidate && prefer(upperCandidate, best)) best = upperCandidate;
    if (!upperCandidate || (lowerCandidate && lowerCandidate.score <= upperCandidate.score)) upperAngle = upperThird;
    else lowerAngle = lowerThird;
  }
  return best.velocity;
};

const velocityForDirectionAndAngle = (speed: number, direction: number, angle: number): Vec3 => {
  const horizontalSpeed = speed * Math.cos(angle);
  return vec3(
    Math.sin(direction) * horizontalSpeed,
    speed * Math.sin(angle),
    -Math.cos(direction) * horizontalSpeed,
  );
};

const minimumNetClearingAngle = (intent: ShotIntent, speed: number, direction: number): number => {
  const clearance = Math.min(1.8, Math.max(0.04, intent.minimumNetClearanceM ?? 0.08));
  let lowerAngle = -14 * Math.PI / 180;
  let upperAngle = 42 * Math.PI / 180;
  for (let iteration = 0; iteration < 26; iteration += 1) {
    const angle = (lowerAngle + upperAngle) / 2;
    const crossing = firstNetCrossing({ ...intent, windVelocity: undefined }, velocityForDirectionAndAngle(speed, direction, angle));
    const requiredHeight = crossing
      ? netHeightAt(crossing.position.x) + clearance
      : COURT.netCenterHeight + clearance;
    if (crossing && crossing.position.y >= requiredHeight) upperAngle = angle;
    else lowerAngle = angle;
  }
  return upperAngle;
};

const serveVelocity = (intent: ShotIntent): Vec3 => {
  const speed = Math.max(8, intent.launchSpeedKmh / 3.6);
  let direction = Math.atan2(intent.target.x - intent.source.x, intent.source.z - intent.target.z);
  let velocity = velocityForDirectionAndAngle(speed, direction, 0);

  for (let headingIteration = 0; headingIteration < 8; headingIteration += 1) {
    const minimumAngle = minimumNetClearingAngle(intent, speed, direction);
    const maximumAngle = 38 * Math.PI / 180;
    const minimumVelocity = velocityForDirectionAndAngle(speed, direction, minimumAngle);
    const maximumVelocity = velocityForDirectionAndAngle(speed, direction, maximumAngle);
    const minimumBounce = firstBounce(intent, minimumVelocity);
    const maximumBounce = firstBounce(intent, maximumVelocity);
    let launchAngle = Math.abs(minimumBounce.position.z - intent.target.z) <= Math.abs(maximumBounce.position.z - intent.target.z)
      ? minimumAngle
      : maximumAngle;

    if (
      intent.target.z <= Math.max(minimumBounce.position.z, maximumBounce.position.z)
      && intent.target.z >= Math.min(minimumBounce.position.z, maximumBounce.position.z)
    ) {
      let lowerAngle = minimumAngle;
      let upperAngle = maximumAngle;
      const fartherAtUpper = maximumBounce.position.z < minimumBounce.position.z;
      for (let iteration = 0; iteration < 24; iteration += 1) {
        const angle = (lowerAngle + upperAngle) / 2;
        const bounce = firstBounce(intent, velocityForDirectionAndAngle(speed, direction, angle));
        const needsFarther = bounce.position.z > intent.target.z;
        if (needsFarther === fartherAtUpper) lowerAngle = angle;
        else upperAngle = angle;
      }
      launchAngle = (lowerAngle + upperAngle) / 2;
    }

    velocity = velocityForDirectionAndAngle(speed, direction, launchAngle);
    const bounce = firstBounce(intent, velocity);
    const errorX = intent.target.x - bounce.position.x;
    if (Math.abs(errorX) < 0.005) break;
    direction += Math.atan2(errorX, Math.max(4, intent.source.z - intent.target.z)) * 0.75;
  }

  return velocity;
};

export const aimDirectionToCourtPoint = (
  source: Readonly<{ x: number; z: number }>,
  point: Readonly<{ x: number; z: number }>,
): number => {
  const direction = Math.atan2(point.x - source.x, source.z - point.z) * 180 / Math.PI;
  return Math.min(35, Math.max(-35, direction));
};

export const netHeightAt = (x: number): number => {
  const postX = COURT.doublesWidth / 2 + 0.15;
  const normalized = Math.min(1, Math.abs(x) / postX);
  return COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7;
};

const targetAdjustedVelocity = (intent: ShotIntent): Vec3 => {
  if (trajectoryShotType(intent) === 'serve') return serveVelocity(intent);
  if (intent.aimDirectionDeg !== undefined) return directedVelocity(intent);
  let velocity = lowArcVelocity(intent);
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const bounce = firstBounce(intent, velocity);
    const time = Math.max(0.2, bounce.time);
    const errorX = intent.target.x - bounce.position.x;
    const errorZ = intent.target.z - bounce.position.z;
    const net = firstNetCrossing(intent, velocity);
    const clearance = Math.min(1.8, Math.max(0.04, intent.minimumNetClearanceM ?? 0.12));
    const requiredNetY = net ? netHeightAt(net.position.x) + clearance : COURT.netCenterHeight + clearance;
    const verticalCorrection = net && net.position.y < requiredNetY
      ? ((requiredNetY - net.position.y) / Math.max(0.18, net.time)) * 1.08
      : 0;
    velocity = vec3(
      velocity.x + (errorX / time) * 0.72,
      velocity.y + verticalCorrection,
      velocity.z + (errorZ / time) * 0.72,
    );
  }
  return velocity;
};

export const resolveTrajectory = (intent: ShotIntent): ResolvedTrajectory => {
  const launchVelocity = targetAdjustedVelocity(intent);
  const surface = SURFACE_PROFILES[intent.surface];
  const initialSpin = spinVector(intent, launchVelocity);
  let spin = initialSpin;
  const receiverZ = intent.receiverZ ?? -(COURT.halfLength + 0.65);
  const samples: FlightSample[] = [
    { time: 0, position: intent.source, velocity: launchVelocity, bounced: false },
  ];
  const events: TrajectoryEvent[] = [];
  let position = intent.source;
  let velocity = launchVelocity;
  let bounced = false;
  let firstBounceTime: number | null = null;
  let receiverRecorded = false;
  let grounded = false;
  let apexHeight = position.y;
  let previousZ = position.z;

  for (let index = 1; index <= MAX_SIMULATION_SECONDS / FIXED_STEP; index += 1) {
    const time = index * FIXED_STEP;
    if (grounded) {
      const rollingRetention = Math.exp(-surface.rollingResistance * FIXED_STEP);
      velocity = vec3(velocity.x * rollingRetention, 0, velocity.z * rollingRetention);
      position = vec3(
        position.x + velocity.x * FIXED_STEP,
        COURT.ballRadius,
        position.z + velocity.z * FIXED_STEP,
      );
    } else {
      velocity = add(velocity, scale(acceleration(velocity, spin, intent.windVelocity), FIXED_STEP));
      position = add(position, scale(velocity, FIXED_STEP));
      spin = decaySpin(spin, magnitude(velocity) * FIXED_STEP);
    }
    apexHeight = Math.max(apexHeight, position.y);

    if (previousZ > 0 && position.z <= 0) {
      events.push({ type: 'net-crossing', time, position, speedKmh: magnitude(velocity) * 3.6 });
    }

    if (!grounded && position.y <= COURT.ballRadius && velocity.y < 0) {
      const firstGroundContact = !bounced;
      const preBounceSpeed = magnitude(velocity) * 3.6;
      position = vec3(position.x, COURT.ballRadius, position.z);
      const normalImpactSpeed = -velocity.y;
      const speedCorrection = Math.min(1.04, Math.max(0.82, 1.04 - Math.max(0, normalImpactSpeed - 4) * 0.012));
      const effectiveRestitution = surface.normalRestitution * speedCorrection;
      const practiceBounceFactor = firstGroundContact
        ? Math.min(1.4, Math.max(0.6, intent.bounceFactor ?? 1))
        : 1;
      const reboundSpeed = normalImpactSpeed * effectiveRestitution * practiceBounceFactor;
      const contactVelocityX = velocity.x + COURT.ballRadius * spin.z;
      const contactVelocityZ = velocity.z - COURT.ballRadius * spin.x;
      const requiredDeltaX = -contactVelocityX * CONTACT_VELOCITY_COUPLING;
      const requiredDeltaZ = -contactVelocityZ * CONTACT_VELOCITY_COUPLING;
      const requiredDelta = Math.hypot(requiredDeltaX, requiredDeltaZ);
      const maximumFrictionDelta = surface.friction * (1 + effectiveRestitution) * normalImpactSpeed;
      const frictionScale = requiredDelta > maximumFrictionDelta && requiredDelta > 0
        ? maximumFrictionDelta / requiredDelta
        : 1;
      const deltaVelocityX = requiredDeltaX * frictionScale;
      const deltaVelocityZ = requiredDeltaZ * frictionScale;
      velocity = vec3(
        velocity.x + deltaVelocityX,
        reboundSpeed,
        velocity.z + deltaVelocityZ,
      );
      spin = vec3(
        spin.x - deltaVelocityZ / (BALL_INERTIA_FACTOR * COURT.ballRadius),
        spin.y,
        spin.z + deltaVelocityX / (BALL_INERTIA_FACTOR * COURT.ballRadius),
      );
      bounced = true;
      if (firstGroundContact) {
        firstBounceTime = time;
        events.push({ type: 'bounce', time, position, speedKmh: preBounceSpeed, postSpeedKmh: magnitude(velocity) * 3.6 });
      }
      if (reboundSpeed < 0.65) {
        grounded = true;
        velocity = vec3(velocity.x, 0, velocity.z);
      }
    }

    if (!receiverRecorded && bounced && previousZ > receiverZ && position.z <= receiverZ) {
      events.push({ type: 'receiver-plane', time, position, speedKmh: magnitude(velocity) * 3.6 });
      receiverRecorded = true;
    }

    const completedPostBounceWindow = firstBounceTime !== null
      && time >= firstBounceTime + POST_BOUNCE_SIMULATION_SECONDS;
    if (index % 4 === 0 || completedPostBounceWindow) {
      samples.push({ time, position, velocity, bounced });
    }
    previousZ = position.z;
    if (completedPostBounceWindow) break;
  }

  const launchSpeed = magnitude(launchVelocity);
  const spinMagnitude = magnitude(initialSpin);
  return {
    intent,
    launchVelocity,
    samples,
    events,
    apexHeight,
    resolved: {
      launchSpeedKmh: launchSpeed * 3.6,
      launchAngleDeg: Math.atan2(launchVelocity.y, Math.hypot(launchVelocity.x, launchVelocity.z)) * 180 / Math.PI,
      spinRateRpm: rpmFromRadiansPerSecond(spinMagnitude),
      spinParameter: launchSpeed > 0 ? COURT.ballRadius * spinMagnitude / launchSpeed : 0,
    },
  };
};

export const sampleTrajectoryAt = (
  trajectory: ResolvedTrajectory,
  time: number,
  loop = true,
): Vec3 => {
  const samples = trajectory.samples;
  if (samples.length === 0) return trajectory.intent.source;
  const duration = samples[samples.length - 1]?.time ?? 0;
  const wrapped = duration > 0
    ? loop
      ? ((time % duration) + duration) % duration
      : Math.min(Math.max(time, 0), duration)
    : 0;

  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    const left = samples[index - 1];
    if (!left || !right || wrapped > right.time) continue;
    const span = right.time - left.time;
    const alpha = span <= 0 ? 0 : (wrapped - left.time) / span;
    return vec3(
      left.position.x + (right.position.x - left.position.x) * alpha,
      left.position.y + (right.position.y - left.position.y) * alpha,
      left.position.z + (right.position.z - left.position.z) * alpha,
    );
  }

  return samples[samples.length - 1]?.position ?? trajectory.intent.source;
};
