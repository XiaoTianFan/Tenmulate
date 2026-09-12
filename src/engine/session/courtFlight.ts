import { COURT } from '../../domain/court';
import type { Vec3 } from '../../domain/vector';
import type { OpponentBall, PlayerShotEventV2, ShotFamily } from '../../content/types';
import { aimDirectionToCourtPoint, netHeightAt, resolveTrajectory, type FlightSample, type ResolvedTrajectory, type ShotIntent } from '../trajectory/physics';
import type { LandingZone } from '../trajectory/landingZone';
import { cameraPlayerPosition, legalReturnContacts } from './playerCoverage';
import { contactsForTiming } from './bounceContact';

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
export function resolveCourtFlight(intent: ShotIntent, accepts?: (flight: ResolvedTrajectory) => boolean): ResolvedTrajectory {
  if (intent.source.z > 0) return resolveTrajectory({ ...intent, aimDirectionDeg: aimDirectionToCourtPoint(intent.source, intent.target) }, accepts);
  const source = rotateCourtPoint(intent.source), target = { x: -intent.target.x, z: -intent.target.z };
  return rotateCourtFlight(resolveTrajectory({ ...intent, source, target,
    landingZone: intent.landingZone && rotateZone(intent.landingZone),
    aimDirectionDeg: aimDirectionToCourtPoint(source, target),
    windVelocity: intent.windVelocity && rotateCourtPoint(intent.windVelocity),
    receiverZ: intent.receiverZ === undefined ? undefined : -intent.receiverZ }, accepts && (flight => accepts(rotateCourtFlight(flight)))));
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
function familyContact(sample: FlightSample, family: ShotFamily, player = false): boolean {
  const height = sample.position.y;
  return family === 'volley' ? !sample.bounced && height >= .65 && height <= (player ? 2.05 : 1.75)
    : family === 'overhead' ? !sample.bounced && height >= 1.8 && height <= 2.65
      : family === 'half-volley' ? sample.bounced && height >= .25 && height <= .8
        : sample.bounced && height >= (family === 'drop-shot' ? .25 : .35) && height <= 1.5;
}
export const contactHeight = (family: ShotFamily): number => family === 'serve' ? 2.55 : family === 'overhead' ? 2.3 : family === 'volley' ? 1.5 : family === 'half-volley' ? .65 : 1.05;
/** Net-shot posture follows eye height within a playable reach. Half-volleys
 * remain low rising contacts; raising the view cannot turn them into volleys. */
export const playerContactHeight = (event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): number =>
  event.ball.family === 'volley' ? Math.max(.65, Math.min(2.05, event.camera.eyeHeight - .1))
    : event.ball.family === 'half-volley' ? Math.max(.25, Math.min(.8, event.camera.eyeHeight - 1.2))
      : contactHeight(event.ball.family);
export const playerContactHeightCost = (sample: FlightSample, event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): number =>
  Math.abs(sample.position.y - playerContactHeight(event)) * (['volley', 'half-volley'].includes(event.ball.family) ? 4 : .1);
/** Racket contact is anchored to the camera's court position, independent of yaw.
 * Its small envelope accommodates a natural reach, not a run. */
export const PLAYER_CONTACT_RADIUS_M = 1.4;
export function playerContactAnchor(event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): Vec3 {
  const feet = cameraPlayerPosition(event.camera), side = (event.ball.stroke === 'forehand' ? -1 : 1) * (event.ball.hand === 'left' ? -1 : 1);
  return { x: feet.x + side * .45, y: playerContactHeight(event), z: feet.z + .65 };
}
export const contactDistance = (sample: FlightSample, event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): number => {
  const anchor = playerContactAnchor(event);
  return Math.hypot(sample.position.x - anchor.x, sample.position.z - anchor.z);
};
export function playerContacts(flight: ResolvedTrajectory, event: Pick<PlayerShotEventV2, 'camera' | 'ball'>): readonly FlightSample[] {
  return contactsForTiming(flight, event.ball.family, legalReturnContacts(flight).filter(sample => familyContact(sample, event.ball.family, true)
    && contactDistance(sample, event) <= PLAYER_CONTACT_RADIUS_M), event.ball.contactTiming);
}
/** Resolve the last footwork adjustment inside the authored reach envelope.
 * Keep the real ball contact .65 m in front and .45 m on the racket side;
 * preserve authored gaze and eye height without moving the physical ball. */
export function playerContactCamera(event: Pick<PlayerShotEventV2, 'camera' | 'ball'>, contact: Vec3) {
  const anchor = playerContactAnchor(event);
  return { ...event.camera, lateral: event.camera.lateral + contact.x - anchor.x,
    behindBaseline: event.camera.behindBaseline - (contact.z - anchor.z) };
}
export function opponentContacts(flight: ResolvedTrajectory, ball: OpponentBall): readonly FlightSample[] {
  const rotated = rotateCourtFlight(flight);
  // The visible opponent uses a real clip and rigid legs. A late ankle-height
  // contact would lower its pelvis through the court just to extend the interval.
  const minimumHeight = ball.family === 'overhead' ? 2.2 : ball.family === 'volley' ? 1.1 : .65;
  return contactsForTiming(flight, ball.family, legalReturnContacts(rotated).filter(sample => familyContact(sample, ball.family) && sample.position.y >= minimumHeight)
    .map(sample => ({ ...sample, position: rotateCourtPoint(sample.position), velocity: rotateCourtPoint(sample.velocity) })), ball.contactTiming);
}
