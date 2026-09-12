import type { CameraConfiguration } from '../rendering/TennisScene';
import type { Vec3 } from '../../domain/vector';
import { COURT } from '../../domain/court';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../../domain/camera';
import { cameraEase, interpolateCamera } from './cameraMotion';
import type { CameraTransition } from './cameraTimeline';
import { sampleTrajectoryAt, type ResolvedTrajectory } from '../trajectory/physics';
import type { CameraFocusTarget, CameraMoveMoment, DrillCameraTransition } from '../../content/types';

/** Presentation calibration, not measured universal human reaction constants. */
export const TENNIS_CAMERA = Object.freeze({ release: .12, settle: .12, reaction: .15, serveReaction: .11,
  splitLead: .09, splitCompression: .018, maxSpeed: 7, maxAcceleration: 18, turnSpeed: 110 });
export type TennisCameraPhase = 'stroke' | 'recover' | 'approach' | 'watch' | 'split' | 'receive' | 'settle' | 'reset' | 'move' | 'hold';
export type TennisCameraExchange = Readonly<{
  start: number; end: number; opponentContact: number; reactAt: number; settleAt: number;
  from: CameraConfiguration; to: CameraConfiguration; ready: CameraConfiguration;
  strategy: 'recover' | 'approach' | 'opening' | 'custom'; legs: readonly CameraTransition[];
  feasible: boolean; requiredSeconds: number; availableSeconds: number;
  advance?: Readonly<{ start: number; end: number; from: number; to: number }>;
  incoming?: ResolvedTrajectory;
  outgoing?: ResolvedTrajectory;
  configuration?: DrillCameraTransition;
  /** Serve reception holds the authored view, including height and direction. */
  fixedCamera?: CameraConfiguration;
}>;
export type TennisCameraTrack = Readonly<{ exchanges: readonly TennisCameraExchange[]; motionScale: number }>;
export type TennisCameraPlanInput = Readonly<{
  start: number; opponentContact: number; end: number; from: CameraConfiguration; to: CameraConfiguration;
  playerTarget: Readonly<{ x: number; z: number }>; currentFamily: string; nextFamily: string;
  opponentFamily?: string; movementRate?: number; opening?: boolean;
  configuration?: DrillCameraTransition;
}>;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: CameraConfiguration, b: CameraConfiguration) => Math.hypot(a.lateral - b.lateral, a.behindBaseline - b.behindBaseline, a.eyeHeight - b.eyeHeight);
const duration = (d: number, speed: number, acceleration: number) => d < 1e-7 ? 0 : Math.max(.2, 1.875 * d / speed, Math.sqrt(5.774 * d / acceleration));
const advanceDepth = (advance: NonNullable<TennisCameraExchange['advance']>, time: number) =>
  advance.from + (advance.to - advance.from) * cameraEase((time - advance.start) / (advance.end - advance.start));
const softLimit = (value: number, limit: number) => limit > 0 ? limit * Math.tanh(value / limit) : 0;

/** Cover the known outgoing ball's possible replies, not the next event's
 * lateral destination. Net players keep a net-ready depth instead of retreating. */
export function neutralCamera(from: CameraConfiguration, outgoing: Readonly<{ x: number; z: number }>): CameraConfiguration {
  const behindBaseline = from.behindBaseline < -3 ? from.behindBaseline : 1.2;
  const dz = -COURT.halfLength - outgoing.z;
  const left = Math.atan2(-COURT.singlesWidth / 2 - outgoing.x, -dz);
  const right = Math.atan2(COURT.singlesWidth / 2 - outgoing.x, -dz);
  const lateral = clamp(outgoing.x + Math.tan((left + right) / 2) * (COURT.halfLength + behindBaseline + outgoing.z), -1.25, 1.25);
  return { ...from, lateral, behindBaseline };
}

/** A causal pre-contact route followed by a reactive intercept. A tactical
 * approach may advance in depth early, but never guesses the next lateral ball. */
export function planTennisCamera(input: TennisCameraPlanInput): TennisCameraExchange {
  const { start, end, opponentContact, from } = input;
  const to = { ...input.to, fov: from.fov };
  const compact = ['volley', 'half-volley'].includes(input.nextFamily);
  const reaction = input.opponentFamily === 'serve' ? TENNIS_CAMERA.serveReaction : compact ? .1 : TENNIS_CAMERA.reaction;
  const reactAt = opponentContact + reaction;
  const settleAt = end - (compact ? .06 : TENNIS_CAMERA.settle);
  const forward = from.behindBaseline - to.behindBaseline;
  const attack = !input.opening && forward > 1.4 && to.behindBaseline < -2
    && (['approach', 'volley', 'half-volley'].includes(input.nextFamily) || input.currentFamily === 'approach'
      || Math.abs(input.playerTarget.x) > COURT.singlesWidth * .34);
  const strategy = input.opening ? 'opening' : attack ? 'approach' : 'recover';
  const neutral = input.opening ? from : neutralCamera(from, input.playerTarget);
  // A chosen approach carries forward momentum through the split step. Its
  // depth curve depends on that tactical intent, never the incoming flight.
  const goal = attack ? { ...neutral, behindBaseline: from.behindBaseline } : neutral;
  const departure = start + TENNIS_CAMERA.release, braking = opponentContact - TENNIS_CAMERA.splitLead;
  const preTime = Math.max(0, braking - departure), rate = Math.sqrt(clamp(input.movementRate ?? 1, .35, 3));
  const advance = attack ? { start: departure, end: departure + duration(forward, Math.min(6, 4.8 * rate), 9),
    from: from.behindBaseline, to: to.behindBaseline } : undefined;
  const preSpeed = Math.min(5.5, 3.6 * rate), preAcceleration = Math.min(9, 6 * rate);
  const reach = Math.min(preSpeed * preTime / 1.875, preAcceleration * preTime * preTime / 5.774);
  const fraction = input.opening ? 0 : Math.min(1, reach / Math.max(1e-7, distance(from, goal)));
  const lateralReady = interpolateCamera(from, goal, fraction);
  const legs: CameraTransition[] = [];
  const preDuration = duration(distance(from, lateralReady), preSpeed, preAcceleration);
  const preEnd = Math.min(braking, departure + preDuration);
  if (preDuration > 0) legs.push({ start: departure, end: preEnd, from,
    to: advance ? { ...lateralReady, behindBaseline: advanceDepth(advance, preEnd) } : lateralReady });
  const postDistance = distance(lateralReady, advance ? { ...to, behindBaseline: lateralReady.behindBaseline } : to);
  const requiredSeconds = duration(postDistance, TENNIS_CAMERA.maxSpeed, advance && advance.end > reactAt ? 15 : TENNIS_CAMERA.maxAcceleration);
  const availableSeconds = Math.max(0, settleAt - reactAt);
  const feasible = settleAt >= reactAt && requiredSeconds <= availableSeconds + 1e-7 && (!advance || advance.end <= settleAt + 1e-7);
  const ready = advance ? { ...lateralReady, behindBaseline: advanceDepth(advance, reactAt) } : lateralReady;
  if (distance(ready, to) > 1e-7 || advance) legs.push({ start: reactAt, end: settleAt, from: ready, to });
  const automatic: TennisCameraExchange = { start, end, opponentContact, reactAt, settleAt, from, to, ready, strategy, legs, feasible,
    requiredSeconds, availableSeconds, advance, configuration: input.configuration };
  return configuredMovement(automatic, input);
}

/** Explicit authoring may anticipate a return. Automatic keeps its causal path.
 * Waypoints are real stops; an infeasible detour is never silently skipped. */
function configuredMovement(automatic: TennisCameraExchange, input: TennisCameraPlanInput): TennisCameraExchange {
  const m = input.configuration?.movement;
  if (!m || m.destination === 'auto' || input.opening) return automatic;
  const { from, to, start, opponentContact, reactAt, settleAt } = automatic;
  const moment = (when: CameraMoveMoment | undefined, fallback: CameraMoveMoment) => {
    const key = !when || when === 'auto' ? fallback : when;
    return key === 'player-hit' ? start + TENNIS_CAMERA.release : key === 'opponent-hit' ? opponentContact : reactAt;
  };
  const begin = moment(m.start, m.destination === 'next-shot' ? 'after-split' : 'player-hit') + (m.delaySeconds ?? 0);
  const rate = Math.sqrt(clamp(m.pacePercent === undefined ? input.movementRate ?? 1 : m.pacePercent / 100, .5, 2));
  const preferred = (a: CameraConfiguration, b: CameraConfiguration) => duration(distance(a, b), Math.min(5.5, 3.6 * rate), Math.min(9, 6 * rate));
  const minimum = (a: CameraConfiguration, b: CameraConfiguration) => duration(distance(a, b), TENNIS_CAMERA.maxSpeed, TENNIS_CAMERA.maxAcceleration);
  const legs: CameraTransition[] = [];
  let feasible: boolean, requiredSeconds: number, availableSeconds: number;
  let ready = from;
  if (m.destination === 'next-shot') {
    requiredSeconds = minimum(from, to); availableSeconds = Math.max(0, settleAt - begin);
    const travel = Math.min(preferred(from, to), availableSeconds);
    feasible = begin <= settleAt && travel >= requiredSeconds - 1e-7;
    if (travel > 0) legs.push({ start: begin, end: begin + travel, from, to });
  } else {
    ready = m.destination === 'waypoint' && m.waypoint ? { ...from, ...m.waypoint } : neutralCamera(from, input.playerTarget);
    const firstMinimum = minimum(from, ready), finalMinimum = minimum(ready, to);
    const firstTime = Math.min(preferred(from, ready), Math.max(0, settleAt - begin - finalMinimum - .06));
    const arrive = begin + firstTime;
    const resume = Math.max(arrive + .06, moment(m.resume, 'after-split') + (m.resumeDelaySeconds ?? 0));
    requiredSeconds = firstMinimum + .06 + finalMinimum; availableSeconds = Math.max(0, settleAt - begin);
    feasible = firstTime >= firstMinimum - 1e-7 && settleAt - resume >= finalMinimum - 1e-7;
    if (firstTime > 0) legs.push({ start: begin, end: arrive, from, to: ready });
    const finalTime = Math.min(preferred(ready, to), Math.max(0, settleAt - resume));
    if (finalTime > 0) legs.push({ start: resume, end: resume + finalTime, from: ready, to });
  }
  return { ...automatic, strategy: 'custom', legs, advance: undefined, ready, feasible, requiredSeconds, availableSeconds };
}

export function tennisCameraPhase(exchange: TennisCameraExchange, time: number): TennisCameraPhase {
  if (time >= exchange.settleAt) return 'settle';
  if (exchange.strategy === 'custom') {
    if (time < exchange.start + TENNIS_CAMERA.release) return 'stroke';
    if (exchange.legs.some(leg => time >= leg.start && time < leg.end)) return 'move';
    return time >= exchange.opponentContact - TENNIS_CAMERA.splitLead && time <= exchange.reactAt ? 'split' : 'hold';
  }
  if (time >= exchange.reactAt) return 'receive';
  if (time >= exchange.opponentContact - TENNIS_CAMERA.splitLead) return 'split';
  if (exchange.strategy !== 'opening' && time < exchange.start + TENNIS_CAMERA.release) return 'stroke';
  const moving = exchange.legs.some(leg => time >= leg.start && time < leg.end)
    || !!exchange.advance && time >= exchange.advance.start && time < exchange.advance.end;
  return moving && exchange.strategy !== 'opening' ? exchange.strategy : 'watch';
}

const rawPosition = (initial: CameraConfiguration, transitions: readonly CameraTransition[], time: number) => {
  let pose = initial;
  for (const leg of transitions) {
    if (time < leg.start) return pose;
    if (time >= leg.end) { pose = leg.to; continue; }
    return interpolateCamera(leg.from, leg.to, cameraEase((time - leg.start) / (leg.end - leg.start)));
  }
  return pose;
};
export function cameraExchangeAt(track: TennisCameraTrack, time: number): TennisCameraExchange | undefined {
  return track.exchanges.find(exchange => time >= exchange.start && time <= exchange.end);
}

/** Pure clock sampling: no accumulated camera state, so pause, seek, replay and
 * different frame rates produce the same view. Horizontal FOV is session-wide. */
export function sampleTennisCamera(initial: CameraConfiguration, transitions: readonly CameraTransition[], track: TennisCameraTrack,
  time: number, opponent?: Vec3, aspect = 16 / 9): CameraConfiguration {
  if (track.motionScale === 0) return initial;
  const exchange = cameraExchangeAt(track, time);
  if (exchange?.fixedCamera) return interpolateCamera(initial, exchange.fixedCamera, track.motionScale);
  let pose = { ...rawPosition(initial, transitions, time), fov: initial.fov };
  if (exchange) {
    const { from, to, start, opponentContact, reactAt, settleAt } = exchange;
    const phase = tennisCameraPhase(exchange, time);
    if (exchange.advance) pose.behindBaseline = advanceDepth(exchange.advance, time);
    const authored = interpolateCamera(from, to, cameraEase((time - reactAt) / Math.max(.001, settleAt - reactAt)));
    pose = { ...pose, yaw: authored.yaw, pitch: authored.pitch };
    // Small loading/landing cue rather than an exaggerated POV jump or head roll.
    const splitStart = opponentContact - TENNIS_CAMERA.splitLead;
    if (time > splitStart && time < reactAt) {
      const u = (time - splitStart) / (reactAt - splitStart);
      pose.eyeHeight -= TENNIS_CAMERA.splitCompression * Math.sin(Math.PI * u) ** 4;
    }
    const focus = exchange.configuration?.focus;
    const customFocus = focus && [focus.beforeReturn, focus.afterReturn].some(target => target && target.mode !== 'auto');
    if ((opponent || customFocus) && phase !== 'settle' && phase !== 'stroke') {
      const look = cameraLookAtCourtPoint(pose, { x: opponent?.x ?? 0, y: 1.35, z: opponent?.z ?? COURT.halfLength });
      let yaw = look.yaw, pitch = look.pitch;
      let customYaw: number | undefined;
      let departureLook: Readonly<{ yaw: number; pitch: number }> | undefined;
      let arrivalLook: Readonly<{ yaw: number; pitch: number }> | undefined;
      const age = time - opponentContact;
      if (age > 0 && exchange.incoming) {
        // Trailing samples soften bounce tracking without looking ahead in time.
        const a = sampleTrajectoryAt(exchange.incoming, age, false), b = sampleTrajectoryAt(exchange.incoming, Math.max(0, age - .08), false);
        const ball = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
        const ballLook = cameraLookAtCourtPoint(pose, ball);
        const h = Math.max(0, initial.fov / 2 - 5);
        const v = Math.max(0, Math.atan(Math.tan(initial.fov * Math.PI / 360) / Math.max(.2, aspect)) * 180 / Math.PI - 5);
        const weight = .82 * cameraEase(age / .28);
        // Ball-led panning inside a fixed field of view. If both cannot fit,
        // avoid whipping sideways after a near ball and retain court context.
        yaw += softLimit(wrapCameraAngle(ballLook.yaw - look.yaw), h) * weight;
        pitch += softLimit(ballLook.pitch - look.pitch, v) * weight;
      }
      if (customFocus) {
        const target = (choice: CameraFocusTarget | undefined, incoming: boolean) => {
          switch (choice?.mode) {
            case 'opponent': return look;
            case 'next-shot': return { yaw: to.yaw, pitch: to.pitch };
            case 'direction': return choice.direction ?? look;
            case 'point': return choice.point ? cameraLookAtCourtPoint(pose, choice.point) : look;
            case 'ball': {
              const flight = incoming ? exchange.incoming : exchange.outgoing;
              const elapsed = incoming ? Math.max(0, age) : clamp(time - start, 0, opponentContact - start);
              return flight ? cameraLookAtCourtPoint(pose, sampleTrajectoryAt(flight, elapsed, false)) : look;
            }
            default: return incoming ? { yaw, pitch } : look;
          }
        };
        const before = target(focus.beforeReturn, false), after = target(focus.afterReturn, true);
        const reference = (choice: CameraFocusTarget | undefined, incoming: boolean, at: CameraConfiguration) => {
          if (choice?.mode === 'direction') return choice.direction ?? look;
          if (choice?.mode === 'next-shot') return to;
          const flight = incoming ? exchange.incoming : exchange.outgoing;
          const point = choice?.mode === 'point' ? choice.point : choice?.mode === 'ball' ? flight?.intent.source : undefined;
          return cameraLookAtCourtPoint(at, point ?? { x: opponent?.x ?? 0, y: 1.35, z: opponent?.z ?? COURT.halfLength });
        };
        departureLook = reference(focus.beforeReturn, false, from);
        const afterReference = reference(focus.afterReturn, true, from);
        arrivalLook = reference(focus.afterReturn, true, to);
        // Blend at the physical opponent contact, never at a frame or event index.
        // Explicit ball tracking can leave the opponent outside the fixed frame.
        const turn = Math.max(Math.abs(wrapCameraAngle(after.yaw - before.yaw)), Math.abs(after.pitch - before.pitch));
        const change = cameraEase(age / Math.max(.32, 1.875 * turn / TENNIS_CAMERA.turnSpeed));
        yaw = before.yaw + wrapCameraAngle(after.yaw - before.yaw) * change;
        pitch = before.pitch + (after.pitch - before.pitch) * change;
        // Keep a stable angular branch when an authored pan crosses +/-180.
        // Re-wrapping that blended direction each frame would produce a cut.
        const branch = from.yaw + wrapCameraAngle(departureLook.yaw - from.yaw);
        const beforeYaw = branch + wrapCameraAngle(before.yaw - departureLook.yaw);
        const afterYaw = branch + wrapCameraAngle(afterReference.yaw - departureLook.yaw) + wrapCameraAngle(after.yaw - afterReference.yaw);
        customYaw = beforeYaw + (afterYaw - beforeYaw) * change;
      }
      const anchor = cameraLookAtCourtPoint(from, { x: 0, y: 1.35, z: COURT.halfLength });
      const unwrappedLook = customYaw ?? from.yaw + wrapCameraAngle(anchor.yaw - from.yaw) + wrapCameraAngle(yaw - anchor.yaw);
      const unwrappedAuthored = from.yaw + wrapCameraAngle(to.yaw - from.yaw) * cameraEase((time - reactAt) / Math.max(.001, settleAt - reactAt));
      const departure = departureLook ?? anchor;
      const fadeInTime = Math.max(.35, 1.875 * Math.max(Math.abs(wrapCameraAngle(departure.yaw - from.yaw)), Math.abs(departure.pitch - from.pitch)) / TENNIS_CAMERA.turnSpeed);
      const toAnchor = cameraLookAtCourtPoint(to, { x: 0, y: 1.35, z: COURT.halfLength });
      const arrival = arrivalLook ?? toAnchor;
      const fadeOutTime = Math.min(settleAt - reactAt, Math.max(.65, 1.875 * Math.max(Math.abs(wrapCameraAngle(arrival.yaw - to.yaw)), Math.abs(arrival.pitch - to.pitch)) / TENNIS_CAMERA.turnSpeed));
      const release = exchange.strategy === 'opening' ? start : start + TENNIS_CAMERA.release;
      const weight = cameraEase((time - release) / fadeInTime) * (time <= reactAt ? 1 : cameraEase((settleAt - time) / Math.max(.001, fadeOutTime)));
      pose.yaw = wrapCameraAngle(unwrappedAuthored + (unwrappedLook - unwrappedAuthored) * weight);
      pose.pitch = authored.pitch + (pitch - authored.pitch) * weight;
    }
  }
  return interpolateCamera(initial, pose, track.motionScale);
}
