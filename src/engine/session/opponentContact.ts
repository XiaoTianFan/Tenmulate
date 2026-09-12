import type { ContactTiming, OpponentBall, ShotDefinitionV1, ShotFamily } from '../../content/types';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';
import { bounceContactPreference, contactsForTiming } from './bounceContact';
import { motionClip, rotateMotionPoint, strokeForShot } from './opponentTimeline';

/** The authored racket anchor is reachable without raising the whole pelvis.
 * Lower contacts can use the existing crouch/foot IK; higher contacts must wait. */
export function opponentContactCeiling(ball: Pick<OpponentBall, 'family' | 'spin' | 'stroke'>): number {
  const sides = ball.stroke === 'auto' ? ['forehand', 'backhand'] as const : [ball.stroke];
  // Automatic keeps its choice based on footwork. Wait until either side can
  // reach rather than forcing an awkward side solely for a taller racket anchor.
  return Math.min(...sides.map(stroke => {
    const clip = strokeForShot({ ...ball, stroke, source: { x: 0, y: 0, z: 0 }, opponentHand: 'right' }, 0);
    return rotateMotionPoint(motionClip(clip).contactLocal!, 0, 'right').y;
  }));
}

export const groundedOpponentShot = (shot: ShotDefinitionV1): boolean =>
  shot.source.y <= opponentContactCeiling({ ...shot, stroke: shot.stroke ?? 'forehand' }) + 1e-7;

/** Preserve the requested phase when it has a supported contact. If its ball is
 * too high, wait along the same physical flight for a descending contact instead
 * of lifting the model. The caller still enforces family, court and bounce limits. */
export function groundedOpponentContacts(flight: ResolvedTrajectory, family: ShotFamily,
  contacts: readonly FlightSample[], timing: ContactTiming | undefined, ceiling: number): FlightSample[] {
  const requested = contactsForTiming(flight, family, contacts, timing);
  const grounded = requested.filter(sample => sample.position.y <= ceiling + 1e-7);
  if (grounded.length) return grounded;
  // A half-volley remains a rising, post-bounce shot.
  if (family === 'half-volley') return [];
  const after = requested[0]?.time ?? bounceContactPreference(flight, family, timing)?.time;
  if (after === undefined) return [];
  return contacts.filter(sample => sample.time > after && sample.velocity.y < 0 && sample.position.y <= ceiling + 1e-7);
}
