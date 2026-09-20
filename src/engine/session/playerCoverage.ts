import { COURT } from '../../domain/court';
import type { Vec3 } from '../../domain/vector';
import type { CameraMotionDefinition } from '../../content/types';
import { netHeightAt, type FlightSample, type ResolvedTrajectory } from '../trajectory/physics';

/** Product calibration, with research provenance in docs/technical-architecture.md#calibration-references-and-limits.
 * Height is independent of the movable camera's eye height. */
export const PLAYER_COVERAGE = Object.freeze({ heightM: 1.75, reactionSeconds: .28,
  acceleration: 5.5, speedMps: 4.5, racketReachM: 1.05, minContactM: .25,
  maxContactM: 2.65, displayAllowance: 1.12 });
export type PlayerPosition = Readonly<{ x: number; z: number; yaw?: number }>;
/** Shared playable contact space, including run-off behind a deep bounce. */
export const CONTACT_COURT_LIMITS = Object.freeze({ halfWidth: COURT.singlesWidth / 2 + 2.5, halfLength: COURT.halfLength + 5 });
export type PlayerPath = PlayerPosition | ((time:number)=>PlayerPosition);
export const playerAt = (player:PlayerPath,time:number):PlayerPosition => typeof player==='function'?player(time):player;
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
/** Physical contacts on the incoming path, independent of the viewing camera. */
export const legalReturnContacts = (trajectory: ResolvedTrajectory): readonly FlightSample[] => {
  const net = trajectory.events.find(e => e.type === 'net-crossing');
  if (!net || net.position.y < netHeightAt(net.position.x) + COURT.ballRadius) return [];
  const bounce = trajectory.events.find(e => e.type === 'bounce');
  const serve=trajectory.intent.family==='serve'||trajectory.intent.shotType==='serve';
  const legalBounce = bounce && bounce.position.z < 0 && bounce.position.z >= -COURT.halfLength
    && Math.abs(bounce.position.x) <= COURT.singlesWidth / 2
    && (!serve || bounce.position.z >= -COURT.serviceLineFromNet && bounce.position.x*trajectory.intent.source.x <= 0);
  const end = trajectory.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
  return trajectory.samples.filter(s => s.time >= net.time && s.time < end && s.position.z < 0
    && (!serve || s.bounced)
    && (!s.bounced || legalBounce)
    && s.position.y >= PLAYER_COVERAGE.minContactM && s.position.y <= PLAYER_COVERAGE.maxContactM
    && Math.abs(s.position.x) <= CONTACT_COURT_LIMITS.halfWidth && s.position.z >= -CONTACT_COURT_LIMITS.halfLength);
};
export const reachableContacts = (trajectory: ResolvedTrajectory, player: PlayerPath): readonly FlightSample[] =>
  legalReturnContacts(trajectory).filter(s => Math.hypot(s.position.x - playerAt(player,s.time).x, s.position.z - playerAt(player,s.time).z)
    <= movementReach(s.time) + PLAYER_COVERAGE.racketReachM * PLAYER_COVERAGE.displayAllowance);
export const assessReachability = (trajectory: ResolvedTrajectory, player: PlayerPath): Reachability => {
  const net = trajectory.events.find(e => e.type === 'net-crossing');
  const candidates = reachableContacts(trajectory, player);
  // Prefer a comfortable strike close to the camera, rather than the earliest
  // barely reachable lunge. Keep every candidate available to rally planning.
  const score = (s: FlightSample) => {
    const center = playerAt(player,s.time);
    return Math.hypot(s.position.x-center.x,s.position.z-center.z) + Math.abs(s.position.y-1.05)*.4;
  };
  const contact = [...candidates].sort((a,b) => score(a)-score(b))[0] ?? null;
  const bounce = trajectory.events.find(e => e.type === 'bounce');
  const serve=trajectory.intent.family==='serve'||trajectory.intent.shotType==='serve';
  const out = bounce && (Math.abs(bounce.position.x)>COURT.singlesWidth/2 || bounce.position.z < -COURT.halfLength || bounce.position.z>=0
    || serve && (bounce.position.z < -COURT.serviceLineFromNet || bounce.position.x*trajectory.intent.source.x > 0));
  const position = playerAt(player,contact?.time??0);
  return { reachable: !!contact, reason: contact ? 'reachable' : !net || net.position.y<netHeightAt(net.position.x)+COURT.ballRadius ? 'net' : out ? 'out' : 'outside-coverage',
    contact, playerPosition: position, marginM: contact ? movementReach(contact.time)+PLAYER_COVERAGE.racketReachM*PLAYER_COVERAGE.displayAllowance-Math.hypot(contact.position.x-position.x,contact.position.z-position.z) : 0 };
};
export const cameraPlayerPosition = (camera?: Readonly<{lateral:number;behindBaseline:number}>): Vec3 =>
  ({x:camera?.lateral ?? 0,y:0,z:-(COURT.halfLength+(camera?.behindBaseline ?? 1.5))});

/** Match the existing scripted camera interpolation in the rendered rehearsal.
 * The coverage envelope is in the viewer's virtual frame, not body tracking. */
export const cameraCoveragePath = (camera: Readonly<{lateral:number;behindBaseline:number}> | undefined,
  motion:CameraMotionDefinition|undefined,intensity=1):PlayerPath => {
  const base=camera??{lateral:0,behindBaseline:1.5};
  if(!motion||intensity===0)return cameraPlayerPosition(base);
  const from={...base,...motion.from},target={...base,...motion.to};
  return time=>{
    const u=Math.max(0,Math.min(1,(time-(motion.delay??0))/Math.max(.001,motion.duration))),t=u*u*(3-2*u);
    return cameraPlayerPosition({lateral:from.lateral+(base.lateral+(target.lateral-base.lateral)*intensity-from.lateral)*t,
      behindBaseline:from.behindBaseline+(base.behindBaseline+(target.behindBaseline-base.behindBaseline)*intensity-from.behindBaseline)*t});
  };
};
