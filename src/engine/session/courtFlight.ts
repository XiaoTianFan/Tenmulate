import { COURT } from '../../domain/court';
import type { Vec3 } from '../../domain/vector';
import type { DrillBall, PlayerShotEventV2, ShotFamily } from '../../content/types';
import { aimDirectionToCourtPoint, netHeightAt, resolveTrajectory, type FlightSample, type ResolvedTrajectory, type ShotIntent } from '../trajectory/physics';
import type { LandingZone } from '../trajectory/landingZone';
import { cameraPlayerPosition, legalReturnContacts } from './playerCoverage';

export const rotateCourtPoint = (p: Vec3): Vec3 => ({ x: -p.x, y: p.y, z: -p.z });
const rotateZone = (z: LandingZone): LandingZone => ({ minX: -z.maxX, maxX: -z.minX, minZ: -z.maxZ, maxZ: -z.minZ });
export function rotateCourtFlight(flight: ResolvedTrajectory): ResolvedTrajectory {
  return { ...flight, intent: { ...flight.intent, source: rotateCourtPoint(flight.intent.source),
    target: { x: -flight.intent.target.x, z: -flight.intent.target.z },
    landingZone: flight.intent.landingZone && rotateZone(flight.intent.landingZone), aimDirectionDeg: undefined,
    receiverZ: flight.intent.receiverZ === undefined ? undefined : -flight.intent.receiverZ,
    windVelocity: flight.intent.windVelocity && rotateCourtPoint(flight.intent.windVelocity) },
    launchVelocity: rotateCourtPoint(flight.launchVelocity),
    samples: flight.samples.map(s => ({ ...s, position: rotateCourtPoint(s.position), velocity: rotateCourtPoint(s.velocity) })),
    events: flight.events.map(e => ({ ...e, position: rotateCourtPoint(e.position) })) };
}
/** The aerodynamic solver has one canonical half; rotate the entire physical
 * solution for a player stroke, including velocity, wind and event coordinates. */
export function resolveCourtFlight(intent: ShotIntent): ResolvedTrajectory {
  if (intent.source.z > 0) return resolveTrajectory({ ...intent, aimDirectionDeg: aimDirectionToCourtPoint(intent.source, intent.target) });
  const source = rotateCourtPoint(intent.source), target = { x: -intent.target.x, z: -intent.target.z };
  return rotateCourtFlight(resolveTrajectory({ ...intent, source, target,
    landingZone: intent.landingZone && rotateZone(intent.landingZone),
    aimDirectionDeg: aimDirectionToCourtPoint(source, target),
    windVelocity: intent.windVelocity && rotateCourtPoint(intent.windVelocity),
    receiverZ: intent.receiverZ === undefined ? undefined : -intent.receiverZ }));
}
export function trimFlight(flight: ResolvedTrajectory, contact: FlightSample): ResolvedTrajectory {
  return { ...flight, samples: [...flight.samples.filter(s => s.time < contact.time), contact],
    events: flight.events.filter(e => e.time <= contact.time) };
}
export function landsInZone(flight: ResolvedTrajectory): boolean {
  const net = flight.events.find(e => e.type === 'net-crossing'), bounce = flight.events.find(e => e.type === 'bounce'), zone = flight.intent.landingZone;
  return !!net && net.position.y >= netHeightAt(net.position.x) + COURT.ballRadius && !!bounce && !!zone
    && bounce.position.x >= zone.minX - .04 && bounce.position.x <= zone.maxX + .04
    && bounce.position.z >= zone.minZ - .04 && bounce.position.z <= zone.maxZ + .04;
}
function familyContact(sample: FlightSample, family: ShotFamily): boolean {
  const height = sample.position.y;
  return family === 'volley' ? !sample.bounced && height >= .65 && height <= 1.75
    : family === 'overhead' ? !sample.bounced && height >= 1.8 && height <= 2.65
      : family === 'half-volley' ? sample.bounced && height >= .25 && height <= .8
        : sample.bounced && height >= (family === 'drop-shot' ? .25 : .35) && height <= 1.5;
}
export const contactHeight = (family: ShotFamily): number => family === 'serve' ? 2.55 : family === 'overhead' ? 2.3 : family === 'volley' ? 1.3 : family === 'half-volley' ? .5 : 1.05;
/** Racket contact is anchored to the camera's court position, independent of yaw
 * and eye height. Its small envelope accommodates a natural reach, not a run. */
export const PLAYER_CONTACT_RADIUS_M = 1.4;
export function playerContactAnchor(event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): Vec3 {
  const feet = cameraPlayerPosition(event.camera), side = (event.ball.stroke === 'forehand' ? -1 : 1) * (event.ball.hand === 'left' ? -1 : 1);
  return { x: feet.x + side * .45, y: contactHeight(event.ball.family), z: feet.z + .65 };
}
export const contactDistance = (sample: FlightSample, event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): number => {
  const anchor = playerContactAnchor(event);
  return Math.hypot(sample.position.x - anchor.x, sample.position.z - anchor.z);
};
export function playerContacts(flight: ResolvedTrajectory, event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): readonly FlightSample[] {
  return legalReturnContacts(flight).filter(sample => familyContact(sample, event.ball.family)
    && contactDistance(sample, event) <= PLAYER_CONTACT_RADIUS_M);
}
export function opponentContacts(flight: ResolvedTrajectory, ball: DrillBall): readonly FlightSample[] {
  const rotated = rotateCourtFlight(flight);
  return legalReturnContacts(rotated).filter(sample => familyContact(sample, ball.family))
    .map(sample => ({ ...sample, position: rotateCourtPoint(sample.position), velocity: rotateCourtPoint(sample.velocity) }));
}
