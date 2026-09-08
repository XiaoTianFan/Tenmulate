import { COURT } from '../../domain/court';
import type { Vec3 } from '../../domain/vector';
import { netHeightAt, type FlightSample, type ResolvedTrajectory } from '../trajectory/physics';

/** Product calibration, with research provenance in docs/research/player-coverage.md.
 * Height is independent of the movable camera's eye height. */
export const PLAYER_COVERAGE = Object.freeze({ heightM: 1.75, reactionSeconds: .28,
  acceleration: 5.5, speedMps: 4.5, racketReachM: 1.05, minContactM: .25,
  maxContactM: 2.65, displayAllowance: 1.12 });
export type PlayerPosition = Readonly<{ x: number; z: number }>;
export type Reachability = Readonly<{
  reachable: boolean; reason: 'reachable' | 'net' | 'out' | 'outside-coverage';
  contact: FlightSample | null; playerPosition: PlayerPosition; marginM: number;
}>;
export const movementReach = (time: number): number => {
  const t = Math.max(0, time - PLAYER_COVERAGE.reactionSeconds);
  const ramp = PLAYER_COVERAGE.speedMps / PLAYER_COVERAGE.acceleration;
  return (t < ramp ? .5 * PLAYER_COVERAGE.acceleration * t * t
    : PLAYER_COVERAGE.speedMps * (t - ramp / 2)) * PLAYER_COVERAGE.displayAllowance;
};
export const reachableContacts = (trajectory: ResolvedTrajectory, player: PlayerPosition): readonly FlightSample[] => {
  const net = trajectory.events.find(e => e.type === 'net-crossing');
  if (!net || net.position.y < netHeightAt(net.position.x) + COURT.ballRadius) return [];
  const bounce = trajectory.events.find(e => e.type === 'bounce');
  const legalBounce = bounce && bounce.position.z < 0 && bounce.position.z >= -COURT.halfLength
    && Math.abs(bounce.position.x) <= COURT.singlesWidth / 2;
  const end = trajectory.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
  return trajectory.samples.filter(s => s.time >= net.time && s.time < end && s.position.z < 0
    && (trajectory.intent.family !== 'serve' && trajectory.intent.shotType !== 'serve' || s.bounced)
    && (!s.bounced || legalBounce)
    && s.position.y >= PLAYER_COVERAGE.minContactM && s.position.y <= PLAYER_COVERAGE.maxContactM
    && Math.abs(s.position.x) <= COURT.singlesWidth / 2 + 2.5 && s.position.z >= -COURT.halfLength - 5
    && Math.hypot(s.position.x - player.x, s.position.z - player.z)
      <= movementReach(s.time) + PLAYER_COVERAGE.racketReachM * PLAYER_COVERAGE.displayAllowance);
};
export const assessReachability = (trajectory: ResolvedTrajectory, player: PlayerPosition): Reachability => {
  const net = trajectory.events.find(e => e.type === 'net-crossing');
  const candidates = reachableContacts(trajectory, player);
  // Prefer a comfortable strike close to the camera, rather than the earliest
  // barely reachable lunge. Keep every candidate available to rally planning.
  const score = (s: FlightSample) => Math.hypot(s.position.x-player.x,s.position.z-player.z) + Math.abs(s.position.y-1.05)*.4;
  const contact = [...candidates].sort((a,b) => score(a)-score(b))[0] ?? null;
  const bounce = trajectory.events.find(e => e.type === 'bounce');
  const out = bounce && (Math.abs(bounce.position.x)>COURT.singlesWidth/2 || bounce.position.z < -COURT.halfLength || bounce.position.z>=0);
  return { reachable: !!contact, reason: contact ? 'reachable' : !net || net.position.y<netHeightAt(net.position.x)+COURT.ballRadius ? 'net' : out ? 'out' : 'outside-coverage',
    contact, playerPosition: player, marginM: contact ? movementReach(contact.time)+PLAYER_COVERAGE.racketReachM*PLAYER_COVERAGE.displayAllowance-Math.hypot(contact.position.x-player.x,contact.position.z-player.z) : 0 };
};
export const cameraPlayerPosition = (camera?: Readonly<{lateral:number;behindBaseline:number}>): Vec3 =>
  ({x:camera?.lateral ?? 0,y:0,z:-(COURT.halfLength+(camera?.behindBaseline ?? 1.5))});
