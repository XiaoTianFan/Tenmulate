import { COURT, type SurfaceId } from '../../domain/court';
import { add, cross, magnitude, scale, subtract, vec3, type Vec3 } from '../../domain/vector';
import type { PracticeShotType } from './practiceProfiles';
import type { LandingZone } from './landingZone';
import { GROUNDSTROKE_FLAT_SPIN_PROFILE, GROUNDSTROKE_TOPSPIN_DEFAULT_RPM } from './spinCalibration';
import { normalizeShotSpin } from '../../domain/shotKinds';

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
/** Metres above the net tape; a preference, never a trajectory clamp. */
export const GROUNDSTROKE_SOFT_NET_CLEARANCE_M = 3.5;

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
  landingZone?: LandingZone;
  aimDirectionDeg?: number;
  /** Natural permits bounded speed/spin adjustment; exact preserves both. */
  trajectoryMode?: 'natural' | 'exact';
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
  type: 'net-crossing' | 'bounce' | 'second-bounce' | 'receiver-plane';
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
  solution?: Readonly<{ mode: 'natural' | 'exact'; status: 'matched' | 'adjusted' | 'unreachable'; targetErrorM: number }>;
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
  if (intent.family === 'lob') return 'lob';
  if (intent.family === 'overhead') return 'overhead';
  if (intent.family === 'drop-shot') return 'drop-shot';
  return 'groundstroke';
};

const radiansPerSecondFromRpm = (rpm: number): number => rpm * Math.PI * 2 / 60;
const rpmFromRadiansPerSecond = (radiansPerSecond: number): number => radiansPerSecond * 60 / (Math.PI * 2);

export const defaultSpinRateRpm = (intent: Pick<ShotIntent, 'spin' | 'shotType' | 'family'>): number => {
  const shotType = trajectoryShotType(intent);
  if (shotType === 'volley') return intent.spin === 'slice' ? 650 : intent.spin === 'topspin' ? 600 : 0;
  if (shotType === 'drop-shot') return intent.spin === 'slice' ? 1400 : intent.spin === 'topspin' ? 600 : 120;
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
  if (intent.spin === 'topspin') return GROUNDSTROKE_TOPSPIN_DEFAULT_RPM;
  if (intent.spin === 'slice') return 1253;
  if (intent.spin === 'kick') return 2285;
  if (intent.spin === 'sidespin') return 1432;
  return GROUNDSTROKE_FLAT_SPIN_PROFILE.defaultRpm;
};

const spinAxisWeights = (
  intent: Pick<ShotIntent, 'spin' | 'shotType' | 'family' | 'opponentHand'>,
): Readonly<{ topspin: number; sidespin: number }> => {
  const handDirection = intent.opponentHand === 'left' ? -1 : 1;
  const shotType = trajectoryShotType(intent);
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
    case 'flat':
      return { topspin: 1, sidespin: 0 };
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
  const requestedRateRpm = typeof intent.spinRateRpm === 'number' && Number.isFinite(intent.spinRateRpm)
    ? Math.max(0, intent.spinRateRpm)
    : defaultSpinRateRpm(intent);
  const rateRpm = trajectoryShotType(intent) === 'groundstroke' && intent.spin === 'flat'
    ? Math.min(GROUNDSTROKE_FLAT_SPIN_PROFILE.maxRpm, Math.max(GROUNDSTROKE_FLAT_SPIN_PROFILE.minRpm, requestedRateRpm))
    : requestedRateRpm;
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

type MutableVec3 = { x: number; y: number; z: number };

// The inverse probes and final playback share these forces. Reusing a vector
// in the probe avoids allocating dozens of temporary objects per integration step.
const accelerationInto = (velocity: Vec3, spin: Vec3, windVelocity: Vec3 | undefined, out: MutableVec3): Vec3 => {
  const x = velocity.x - (windVelocity?.x ?? 0), y = velocity.y - (windVelocity?.y ?? 0), z = velocity.z - (windVelocity?.z ?? 0);
  const speed = Math.sqrt(x * x + y * y + z * z);
  if (speed < .001) { out.x = 0; out.y = -9.81; out.z = 0; return out; }
  const drag = -AERODYNAMIC_ACCELERATION_FACTOR * DRAG_COEFFICIENT * speed;
  const spinMagnitude = Math.sqrt(spin.x * spin.x + spin.y * spin.y + spin.z * spin.z);
  const spinParameter = COURT.ballRadius * spinMagnitude / speed;
  const liftCoefficient = Math.min(MAX_LIFT_COEFFICIENT, LIFT_COEFFICIENT_SLOPE * spinParameter);
  const crossX = spin.y * z - spin.z * y, crossY = spin.z * x - spin.x * z, crossZ = spin.x * y - spin.y * x;
  const crossMagnitude = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  const magnus = crossMagnitude > 0 ? AERODYNAMIC_ACCELERATION_FACTOR * liftCoefficient * speed ** 2 / crossMagnitude : 0;
  out.x = drag * x + magnus * crossX;
  out.y = GRAVITY.y + (drag * y + magnus * crossY);
  out.z = drag * z + magnus * crossZ;
  return out;
};
const acceleration = (velocity: Vec3, spin: Vec3, windVelocity?: Vec3): Vec3 =>
  accelerationInto(velocity, spin, windVelocity, { x: 0, y: 0, z: 0 });

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
  const position = { ...intent.source };
  const velocity = { ...initialVelocity };
  const spin = { ...spinVector(intent, initialVelocity) };
  const force = { x: 0, y: 0, z: 0 };
  let netCrossing: FlightSample | null = null;

  for (let index = 1; index < 5 / FIXED_STEP; index += 1) {
    accelerationInto(velocity, spin, intent.windVelocity, force);
    velocity.x += force.x * FIXED_STEP; velocity.y += force.y * FIXED_STEP; velocity.z += force.z * FIXED_STEP;
    const previousZ = position.z;
    position.x += velocity.x * FIXED_STEP; position.y += velocity.y * FIXED_STEP; position.z += velocity.z * FIXED_STEP;
    const decay = Math.exp(-SPIN_DECAY_PER_M * Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) * FIXED_STEP);
    spin.x *= decay; spin.y *= decay; spin.z *= decay;
    if (!netCrossing && previousZ > 0 && position.z <= 0) {
      netCrossing = { time: index * FIXED_STEP, position: { ...position }, velocity: { ...velocity }, bounced: false };
    }
    if (position.y <= COURT.ballRadius && velocity.y < 0) {
      return {
        bounce: { time: index * FIXED_STEP, position: vec3(position.x, COURT.ballRadius, position.z), velocity, bounced: true },
        netCrossing,
      };
    }
  }
  return { bounce: { time: 5, position, velocity, bounced: false }, netCrossing };
};

const directedVelocity = (intent: ShotIntent, stopAtTarget = false): Vec3 => {
  const direction = Math.min(35, Math.max(-35, intent.aimDirectionDeg ?? 0)) * Math.PI / 180;
  const speed = Math.max(8, intent.launchSpeedKmh / 3.6);
  const shotType = trajectoryShotType(intent);
  const defaultClearance = shotType === 'lob' ? 1.2 : shotType === 'serve' || shotType === 'volley' ? 0.08 : 0.12;
  const clearance = Math.min(shotType === 'groundstroke' ? Infinity : shotType === 'lob' ? 6 : 1.8,
    Math.max(0.04, intent.minimumNetClearanceM ?? defaultClearance));
  const minimumAngle = (shotType === 'lob' ? 25 : shotType === 'volley' || shotType === 'overhead' ? -25 : -5) * Math.PI / 180;
  const maximumAngle = (shotType === 'lob' ? 78 : shotType === 'volley' ? 52 : 58) * Math.PI / 180;
  const calmIntent = { ...intent, windVelocity: undefined };
  const sampleCount = 32;
  const angleStep = (maximumAngle - minimumAngle) / sampleCount;
  type Candidate = Readonly<{ angle: number; velocity: Vec3; score: number; bounceZ: number }>;
  let best: Candidate | null = null;
  let fallback: Candidate | null = null;
  const flights = new Map<number, ReturnType<typeof firstFlight>>();

  const candidateAt = (angle: number, requireNetClearance: boolean): Candidate | null => {
    const velocity = velocityForDirectionAndAngle(speed, direction, angle);
    const flight = flights.get(angle) ?? firstFlight(calmIntent, velocity);
    flights.set(angle,flight);
    const { bounce, netCrossing } = flight;
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

  // Range has two angle roots. Follow only the ascending-range branch for
  // ordinary shots; a tiny heading change must never select the lob root.
  let previousDepth = Infinity;
  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = minimumAngle + angleStep * index;
    const raw = candidateAt(angle, false)!;
    if (shotType !== 'lob' && raw.bounceZ > previousDepth + .015) break;
    previousDepth = raw.bounceZ;
    const candidate = candidateAt(angle, true);
    if (candidate && prefer(candidate, best)) best = candidate;
    // The groundstroke inverse search only needs the first range root. Its
    // local refinement brackets this crossing without scanning the whole arc.
    if (stopAtTarget && candidate && raw.bounceZ < intent.target.z - .04) break;
  }

  if (!best) return (fallback as Candidate | null)?.velocity ?? velocityForDirectionAndAngle(speed, direction, maximumAngle);

  let lowerAngle = Math.max(minimumAngle, best.angle - angleStep);
  let upperAngle = Math.min(maximumAngle, best.angle + angleStep);
  for (let iteration = 0; iteration < (stopAtTarget ? 8 : 14); iteration += 1) {
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

/** Search pace and spin together, measuring the actual height at the net rather
 * than using launch angle as a proxy. Keep the sampled landing fixed. */
const resolveNaturalGroundstroke = (intent: ShotIntent): ResolvedTrajectory => {
  const baseSpeed = Math.max(28.8, intent.launchSpeedKmh);
  const baseSpin = intent.spinRateRpm ?? defaultSpinRateRpm(intent);
  // A neutral recreational ball may need much less topspin, not more speed.
  // Keep the flat-stroke calibration and never invent spin for a zero-spin feed.
  const minimumSpin = Math.min(baseSpin, GROUNDSTROKE_FLAT_SPIN_PROFILE.minRpm);
  const minimumSpeedFactor = intent.landingZone ? .5 : .85;
  const maximumSpeedFactor = intent.landingZone ? 1.5 : 1.15;
  const minimumClearance = Math.max(.04, intent.minimumNetClearanceM ?? .12);
  const preferredClearance = Math.max(1, minimumClearance);
  const softClearance = Math.max(GROUNDSTROKE_SOFT_NET_CLEARANCE_M, minimumClearance);
  const candidates = new Map<string, ReturnType<typeof evaluateUncached>>();

  function evaluateUncached(speed: number, spin: number) {
    const candidateIntent = { ...intent, launchSpeedKmh: speed, spinRateRpm: spin,
      aimDirectionDeg: aimDirectionToCourtPoint(intent.source, intent.target) };
    let velocity = directedVelocity(candidateIntent, true);
    for (let i = 0; i < 3; i++) {
      const bounce = firstBounce(candidateIntent, velocity);
      if (Math.abs(bounce.position.x - intent.target.x) < .02) break;
      candidateIntent.aimDirectionDeg += Math.atan2(intent.target.x - bounce.position.x,
        Math.max(2, intent.source.z - intent.target.z)) * 180 / Math.PI;
      velocity = directedVelocity(candidateIntent, true);
    }
    // Probe only the first flight during search; build the full sampled/rebound
    // trajectory once, after selection. Wind remains a physical disturbance.
    const { bounce, netCrossing: net } = firstFlight(candidateIntent, velocity);
    const error = Math.hypot(bounce.position.x - intent.target.x, bounce.position.z - intent.target.z);
    const clearance = net ? net.position.y - netHeightAt(net.position.x) : -Infinity;
    const legal = bounce.bounced && !!net && net.time < bounce.time && clearance >= minimumClearance - .015;
    const speedFactor = speed / baseSpeed, spinFactor = baseSpin ? spin / baseSpin : 1;
    const speedChange = Math.abs(speedFactor - 1), spinChange = Math.abs(spinFactor - 1);
    // Landing and net legality take priority. Tiny integration errors must not
    // outweigh arc comfort. Above 3.5 m the cost rises steeply but stays finite.
    const score = legal && error <= .18
      ? .7 * Math.max(0, clearance - preferredClearance) ** 2
        + 8 * Math.max(0, clearance - softClearance) ** 2
        + 8 * speedChange + 20 * speedChange ** 2 + spinChange + error * .1
      : 10000 + (legal ? 0 : 10000) + error * 100;
    return { candidateIntent, velocity, error, legal, clearance, score, speedFactor, spinFactor };
  }
  const evaluate = (speedFactor: number, spinFactor: number) => {
    const speed = Math.max(28.8, baseSpeed * Math.max(minimumSpeedFactor, Math.min(maximumSpeedFactor, speedFactor)));
    let spin = Math.max(minimumSpin, baseSpin * Math.max(.25, Math.min(1.2, spinFactor)));
    if (intent.spin === 'flat') spin = Math.max(GROUNDSTROKE_FLAT_SPIN_PROFILE.minRpm,
      Math.min(GROUNDSTROKE_FLAT_SPIN_PROFILE.maxRpm, spin));
    const key = `${speed.toFixed(6)}:${spin.toFixed(6)}`;
    let candidate = candidates.get(key);
    if (!candidate) { candidate = evaluateUncached(speed, spin); candidates.set(key, candidate); }
    return candidate;
  };
  let best = evaluate(1, 1);
  if (!best.legal || best.error > .08 || best.clearance > preferredClearance + .25) {
    const spins = [1, .75, .5, .25, 1.2];
    const consider = (speed: number, spin: number) => {
      const candidate = evaluate(speed, spin);
      if (candidate.score < best.score) best = candidate;
    };
    for (const speed of [1, .85, 1.15]) for (const spin of spins) consider(speed, spin);
    // Reaching the target is not an early exit if it still produces a lob-like
    // groundstroke. Search the existing zone pace envelope for a lower option.
    if (intent.landingZone && (!best.legal || best.error > .18 || best.clearance > softClearance)) {
      for (const speed of [.5, .7, 1.3, 1.5]) for (const spin of spins) consider(speed, spin);
    }
    // Bounded coordinate refinement avoids coarse jumps between speed presets.
    for (const step of [.05, .025, .0125]) {
      const { speedFactor, spinFactor } = best;
      consider(speedFactor - step, spinFactor);
      consider(speedFactor + step, spinFactor);
      consider(best.speedFactor, spinFactor - step * 2.5);
      consider(best.speedFactor, spinFactor + step * 2.5);
    }
  }
  const result = integrateTrajectory(best.candidateIntent, best.velocity);
  const bounce = result.events.find(event => event.type === 'bounce');
  const net = result.events.find(event => event.type === 'net-crossing');
  const error = bounce ? Math.hypot(bounce.position.x - intent.target.x, bounce.position.z - intent.target.z) : 50;
  const legal = !!net && !!bounce && net.time < bounce.time
    && net.position.y - netHeightAt(net.position.x) >= minimumClearance - .015;
  const adjusted = Math.abs(result.resolved.launchSpeedKmh - intent.launchSpeedKmh) > .001
    || Math.abs(result.resolved.spinRateRpm - baseSpin) > .001;
  return { ...result, intent, solution: { mode: 'natural',
    status: !legal || error > .18 ? 'unreachable' : adjusted ? 'adjusted' : 'matched', targetErrorM: error } };
};

/** Natural shots keep a low arc and publish every bounded adjustment. The
 * target remains an intention: an infeasible request is never labelled matched. */
export const resolveTrajectory = (intent: ShotIntent): ResolvedTrajectory => {
  const spin = normalizeShotSpin(trajectoryShotType(intent), intent.spin);
  if (spin !== intent.spin) intent = { ...intent, spin };
  if (intent.trajectoryMode !== 'natural') {
    const exactIntent = intent.trajectoryMode==='exact' ? {...intent,aimDirectionDeg:intent.aimDirectionDeg??aimDirectionToCourtPoint(intent.source,intent.target)} : intent;
    const result=integrateTrajectory(intent, targetAdjustedVelocity(exactIntent));
    if(intent.trajectoryMode!=='exact')return result;
    const bounce=result.events.find(e=>e.type==='bounce'),net=result.events.find(e=>e.type==='net-crossing');
    const error=bounce?Math.hypot(bounce.position.x-intent.target.x,bounce.position.z-intent.target.z):50;
    const legal=net&&bounce&&net.time<bounce.time&&net.position.y>=netHeightAt(net.position.x)+(intent.minimumNetClearanceM??.08)-.015;
    return {...result,solution:{mode:'exact',status:legal&&error<=.18?'matched':'unreachable',targetErrorM:error}};
  }
  const type = trajectoryShotType(intent);
  if (type === 'groundstroke') return resolveNaturalGroundstroke(intent);
  const baseSpin = intent.spinRateRpm ?? defaultSpinRateRpm(intent);
  const desiredAngle = type === 'lob' ? 78 : type === 'serve' ? 12 : type === 'overhead' ? 12 : type === 'volley' ? 18 : 22;
  const evaluate = (speedFactor: number, spinFactor: number) => {
    const candidateIntent = { ...intent, launchSpeedKmh: intent.launchSpeedKmh * speedFactor,
      spinRateRpm: baseSpin * spinFactor, aimDirectionDeg: aimDirectionToCourtPoint(intent.source, intent.target) };
    // Correct heading for spin while keeping the same selected landing point.
    let velocity = targetAdjustedVelocity(candidateIntent);
    if (type !== 'serve') for (let i = 0; i < 3; i++) {
      const bounce = firstBounce(candidateIntent, velocity);
      if (Math.abs(bounce.position.x-intent.target.x)<.02) break;
      candidateIntent.aimDirectionDeg += Math.atan2(intent.target.x-bounce.position.x,Math.max(2,intent.source.z-intent.target.z))*180/Math.PI;
      velocity = directedVelocity(candidateIntent);
    }
    const result = integrateTrajectory(candidateIntent, velocity);
    const bounce = result.events.find(e=>e.type==='bounce'), net = result.events.find(e=>e.type==='net-crossing');
    const error = bounce ? Math.hypot(bounce.position.x-intent.target.x,bounce.position.z-intent.target.z) : 50;
    const legal = !!net && !!bounce && net.time < bounce.time && net.position.y >= netHeightAt(net.position.x)+(intent.minimumNetClearanceM??.08)-.015;
    const score = (legal?0:1000) + error*20 + Math.max(0,result.resolved.launchAngleDeg-desiredAngle)*.2
      + Math.abs(speedFactor-1)*2 + Math.abs(spinFactor-1)*.8;
    return { result, error, legal, score, speedFactor, spinFactor };
  };
  let best = evaluate(1,1);
  if (best.error>.12 || !best.legal || best.result.resolved.launchAngleDeg>desiredAngle+1) {
    for (const speed of [1.05,1.1,1.15,.95,.9,.85]) {
      const candidate=evaluate(speed,1); if(candidate.score<best.score)best=candidate;
      if(best.legal && best.error<.12 && best.result.resolved.launchAngleDeg<=desiredAngle)break;
    }
    // Spin adjustment is a second choice, after the speed neighborhood.
    if(best.error>.12 || !best.legal || best.result.resolved.launchAngleDeg>desiredAngle+1) for (const spin of [.8,.9,1.1,1.2]) {
      const candidate=evaluate(best.speedFactor,spin); if(candidate.score<best.score)best=candidate;
    }
  }
  // Zone membership is the primary intention. Short half-volleys in particular
  // need a slower ball than the old point-target ±15% neighborhood permits.
  // Keep the sampled target (no rejection bias), and publish the resolved speed.
  if (intent.landingZone && (!best.legal || best.error>.18)) {
    for (const speed of [.8,.7,.6,.5,1.2,1.35,1.5]) {
      const candidate=evaluate(speed,best.spinFactor);
      if(candidate.score<best.score)best=candidate;
      if(best.legal && best.error<.12)break;
    }
  }
  const status = !best.legal || best.error>.18 ? 'unreachable' : Math.abs(best.speedFactor-1)>.001 || Math.abs(best.spinFactor-1)>.001 ? 'adjusted' : 'matched';
  return { ...best.result, intent, solution: { mode:'natural', status, targetErrorM:best.error } };
};

/** Forward integration also serves inverse rally authoring in either direction. */
export const integrateTrajectory = (intent: ShotIntent, launchVelocity: Vec3, stopTime = MAX_SIMULATION_SECONDS): ResolvedTrajectory => {
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
  let bounceCount = 0;
  const direction = Math.sign(launchVelocity.z) || -1;

  for (let index = 1; index <= Math.ceil(stopTime / FIXED_STEP); index += 1) {
    const time = Math.min(index * FIXED_STEP, stopTime);
    const dt = time - (index - 1) * FIXED_STEP;
    if (grounded) {
      const rollingRetention = Math.exp(-surface.rollingResistance * FIXED_STEP);
      velocity = vec3(velocity.x * rollingRetention, 0, velocity.z * rollingRetention);
      position = vec3(
        position.x + velocity.x * FIXED_STEP,
        COURT.ballRadius,
        position.z + velocity.z * FIXED_STEP,
      );
    } else {
      velocity = add(velocity, scale(acceleration(velocity, spin, intent.windVelocity), dt));
      position = add(position, scale(velocity, dt));
      spin = decaySpin(spin, magnitude(velocity) * dt);
    }
    apexHeight = Math.max(apexHeight, position.y);

    if (previousZ * direction < 0 && position.z * direction >= 0) {
      events.push({ type: 'net-crossing', time, position, speedKmh: magnitude(velocity) * 3.6 });
    }

    if (!grounded && position.y <= COURT.ballRadius && velocity.y < 0) {
      const firstGroundContact = !bounced;
      bounceCount += 1;
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
      } else if (bounceCount === 2) {
        events.push({ type: 'second-bounce', time, position, speedKmh: preBounceSpeed });
      }
      if (reboundSpeed < 0.65) {
        grounded = true;
        velocity = vec3(velocity.x, 0, velocity.z);
      }
    }

    if (!receiverRecorded && bounced && (previousZ - receiverZ) * direction < 0 && (position.z - receiverZ) * direction >= 0) {
      events.push({ type: 'receiver-plane', time, position, speedKmh: magnitude(velocity) * 3.6 });
      receiverRecorded = true;
    }

    const completedPostBounceWindow = stopTime === MAX_SIMULATION_SECONDS && firstBounceTime !== null
      && time >= firstBounceTime + POST_BOUNCE_SIMULATION_SECONDS;
    if (index % 4 === 0 || completedPostBounceWindow || time === stopTime) {
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
