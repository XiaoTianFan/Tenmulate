import { COURT, type SurfaceId } from '../../domain/court';
import { add, cross, magnitude, scale, subtract, vec3, type Vec3 } from '../../domain/vector';

const GRAVITY = vec3(0, -9.81, 0);
const FIXED_STEP = 1 / 240;
const DRAG_FACTOR = 0.0018;
const MAGNUS_FACTOR = 0.00028;
const MAX_SIMULATION_SECONDS = 10;
export const POST_BOUNCE_SIMULATION_SECONDS = 3;

export type SpinKind = 'flat' | 'topspin' | 'slice' | 'kick' | 'sidespin';

export type SurfaceProfile = Readonly<{
  id: SurfaceId;
  restitution: number;
  horizontalRetention: number;
  spinCoupling: number;
}>;

export const SURFACE_PROFILES: Record<SurfaceId, SurfaceProfile> = {
  hard: { id: 'hard', restitution: 0.73, horizontalRetention: 0.82, spinCoupling: 0.08 },
  clay: { id: 'clay', restitution: 0.77, horizontalRetention: 0.72, spinCoupling: 0.11 },
  grass: { id: 'grass', restitution: 0.62, horizontalRetention: 0.9, spinCoupling: 0.05 },
};

export type ShotIntent = Readonly<{
  source: Vec3;
  target: Readonly<{ x: number; z: number }>;
  aimDirectionDeg?: number;
  paceKmh: number;
  spin: SpinKind;
  surface: SurfaceId;
  receiverZ?: number;
  netClearanceM?: number;
  windVelocity?: Vec3;
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
}>;

const spinVector = (kind: SpinKind): Vec3 => {
  switch (kind) {
    case 'topspin':
      return vec3(-105, 0, 0);
    case 'slice':
      return vec3(45, 0, 28);
    case 'kick':
      return vec3(-125, 0, 42);
    case 'sidespin':
      return vec3(0, 0, 95);
    default:
      return vec3(0, 0, 0);
  }
};

const acceleration = (velocity: Vec3, spin: Vec3, windVelocity = vec3()): Vec3 => {
  const airVelocity = subtract(velocity, windVelocity);
  const speed = magnitude(airVelocity);
  const drag = scale(airVelocity, -DRAG_FACTOR * speed);
  const magnus = scale(cross(spin, airVelocity), MAGNUS_FACTOR);
  return add(GRAVITY, add(drag, magnus));
};

const lowArcVelocity = (intent: ShotIntent): Vec3 => {
  const dx = intent.target.x - intent.source.x;
  const dz = intent.target.z - intent.source.z;
  const distance = Math.hypot(dx, dz);
  const speed = Math.max(8, intent.paceKmh / 3.6);
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
  const spin = spinVector(intent.spin);

  for (let index = 1; index < 5 / FIXED_STEP; index += 1) {
    const nextVelocity = add(velocity, scale(acceleration(velocity, spin), FIXED_STEP));
    const nextPosition = add(position, scale(nextVelocity, FIXED_STEP));
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
  const spin = spinVector(intent.spin);

  for (let index = 1; index < 3 / FIXED_STEP; index += 1) {
    const nextVelocity = add(velocity, scale(acceleration(velocity, spin), FIXED_STEP));
    const nextPosition = add(position, scale(nextVelocity, FIXED_STEP));
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

const directedVelocity = (intent: ShotIntent): Vec3 => {
  const direction = Math.min(35, Math.max(-35, intent.aimDirectionDeg ?? 0)) * Math.PI / 180;
  const speed = Math.max(8, intent.paceKmh / 3.6);
  const directionX = Math.sin(direction);
  const directionZ = -Math.cos(direction);
  const clearance = Math.min(1.8, Math.max(0.08, intent.netClearanceM ?? 0.12));
  let lowerAngle = -5 * Math.PI / 180;
  let upperAngle = 48 * Math.PI / 180;

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const angle = (lowerAngle + upperAngle) / 2;
    const horizontalSpeed = speed * Math.cos(angle);
    const velocity = vec3(
      directionX * horizontalSpeed,
      speed * Math.sin(angle),
      directionZ * horizontalSpeed,
    );
    const crossing = firstNetCrossing({ ...intent, windVelocity: undefined }, velocity);
    const requiredHeight = crossing
      ? netHeightAt(crossing.position.x) + clearance
      : COURT.netCenterHeight + clearance;
    if (crossing && crossing.position.y >= requiredHeight) upperAngle = angle;
    else lowerAngle = angle;
  }

  const launchAngle = upperAngle;
  const horizontalSpeed = speed * Math.cos(launchAngle);
  return vec3(
    directionX * horizontalSpeed,
    speed * Math.sin(launchAngle),
    directionZ * horizontalSpeed,
  );
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
  if (intent.aimDirectionDeg !== undefined) return directedVelocity(intent);
  let velocity = lowArcVelocity(intent);
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const bounce = firstBounce(intent, velocity);
    const time = Math.max(0.2, bounce.time);
    const errorX = intent.target.x - bounce.position.x;
    const errorZ = intent.target.z - bounce.position.z;
    const net = firstNetCrossing(intent, velocity);
    const clearance = Math.min(1.8, Math.max(0.08, intent.netClearanceM ?? 0.12));
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
  const spin = spinVector(intent.spin);
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
      const rollingRetention = Math.exp(-1.8 * FIXED_STEP);
      velocity = vec3(velocity.x * rollingRetention, 0, velocity.z * rollingRetention);
      position = vec3(
        position.x + velocity.x * FIXED_STEP,
        COURT.ballRadius,
        position.z + velocity.z * FIXED_STEP,
      );
    } else {
      velocity = add(velocity, scale(acceleration(velocity, spin, intent.windVelocity), FIXED_STEP));
      position = add(position, scale(velocity, FIXED_STEP));
    }
    apexHeight = Math.max(apexHeight, position.y);

    if (previousZ > 0 && position.z <= 0) {
      events.push({ type: 'net-crossing', time, position, speedKmh: magnitude(velocity) * 3.6 });
    }

    if (!grounded && position.y <= COURT.ballRadius && velocity.y < 0) {
      const firstGroundContact = !bounced;
      const preBounceSpeed = magnitude(velocity) * 3.6;
      position = vec3(position.x, COURT.ballRadius, position.z);
      const reboundSpeed = -velocity.y * surface.restitution;
      velocity = vec3(
        velocity.x * surface.horizontalRetention + spin.z * surface.spinCoupling * 0.01,
        reboundSpeed,
        velocity.z * surface.horizontalRetention - spin.x * surface.spinCoupling * 0.01,
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

  return { intent, launchVelocity, samples, events, apexHeight };
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
