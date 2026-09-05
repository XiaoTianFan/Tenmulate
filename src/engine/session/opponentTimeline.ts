import library from '../../content/opponent-motion.json';
import type { ShotDefinitionV1 } from '../../content/types';
import type { Vec3 } from '../../domain/vector';

export const OPPONENT_MOTION = library;
export type StrokeId = 'forehand' | 'backhand' | 'forehand-slice' | 'backhand-slice' | 'serve';
export type MotionId = keyof typeof library.clips;
export type ClipMetadata = Readonly<{ duration: number; contact?: number; contactLocal?: readonly number[]; tossRelease?: number; tossLocal?: readonly number[]; recovery: number; loop: boolean }>;
export const motionClip = (id: MotionId): ClipMetadata => library.clips[id];
export const smoothStep = (value: number): number => { const x = Math.min(1, Math.max(0, value)); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPoint = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), z: mix(a.z, b.z, t) });
export const MAX_OPPONENT_SPEED = 4.8;

export type MotionEvent = Readonly<{
  index: number; clip: StrokeId; contactTime: number; start: number; end: number;
  rate: number; hand: 'left' | 'right'; yaw: number; root: Vec3; source: Vec3;
}>;
export type MotionRepetition = Readonly<{ index: number; startTime: number; shot: ShotDefinitionV1 }>;

export const strokeForShot = (shot: ShotDefinitionV1, index: number): StrokeId => {
  if (shot.family === 'serve' || shot.family === 'overhead') return 'serve';
  const relativeSide = shot.source.x * (shot.opponentHand === 'left' ? -1 : 1);
  const side = shot.stroke ?? (shot.backhandStyle ? 'backhand' : Math.abs(relativeSide) > 0.4 ? relativeSide < 0 ? 'backhand' : 'forehand' : index % 2 ? 'backhand' : 'forehand');
  return shot.spin === 'slice' ? `${side}-slice` : side;
};

export const rotateMotionPoint = (point: readonly number[], yaw: number, hand: 'left' | 'right'): Vec3 => {
  const x = (point[0] ?? 0) * library.scale * (hand === 'left' ? -1 : 1), z = (point[2] ?? 0) * library.scale;
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), y: (point[1] ?? 0) * library.scale + library.floorOffset, z: -x * Math.sin(yaw) + z * Math.cos(yaw) };
};

export const motionEvent = (repetition: MotionRepetition): MotionEvent => {
  const { shot, index, startTime } = repetition, clip = strokeForShot(shot, index), metadata = motionClip(clip);
  const rate = shot.family === 'serve' && shot.serveRhythm === 'compact' ? 1.25 : 1;
  const yaw = Math.atan2(shot.target.x - shot.source.x, shot.target.z - shot.source.z);
  const local = rotateMotionPoint(metadata.contactLocal!, yaw, shot.opponentHand);
  return { index, clip, contactTime: startTime, start: startTime - metadata.contact! / rate,
    end: startTime + (metadata.duration - metadata.contact!) / rate, rate, yaw, hand: shot.opponentHand,
    root: { x: shot.source.x - local.x, y: 0, z: shot.source.z - local.z }, source: shot.source };
};

export const minimumMotionGap = (previous: MotionRepetition, next: MotionRepetition): number => {
  const a = motionEvent(previous), b = motionEvent(next);
  const distance = Math.hypot(b.root.x - a.root.x, b.root.z - a.root.z);
  // Smoothstep's peak speed is 1.5 times its mean speed. Leave a boundary blend at zero travel.
  const travel = Math.max(.4, 1.5 * distance / MAX_OPPONENT_SPEED + .35);
  return a.end - a.contactTime + b.contactTime - b.start + travel;
};

export type MotionSample = Readonly<{
  root: Vec3; yaw: number; hand: 'left' | 'right';
  layers: readonly Readonly<{ clip: MotionId; time: number; weight: number }>[];
  event: MotionEvent | null; verticalCorrection: number;
  footTargets?: Readonly<{ left: Vec3; right: Vec3 }>;
  /** Local head counter-turn keeps the gaze toward play during lateral running. */
  lookYaw?: number;
  toss: Vec3 | null;
}>;

const yawLerp = (a: number, b: number, t: number): number => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export const sampleOpponentTimeline = (events: readonly MotionEvent[], time: number): MotionSample | null => {
  if (!events.length) return null;
  const event = events.find((candidate) => time >= candidate.start && time <= candidate.end);
  if (event) {
    const clip = motionClip(event.clip), localTime = Math.max(0, Math.min(clip.duration, (time - event.start) * event.rate));
    const contactHeight = rotateMotionPoint(clip.contactLocal!, event.yaw, event.hand).y;
    const contactEnvelope = smoothStep(localTime / clip.contact!) * smoothStep((clip.duration - localTime) / (clip.duration - clip.contact!));
    const verticalCorrection = (event.source.y - contactHeight) * contactEnvelope;
    let toss: Vec3 | null = null;
    if (event.clip === 'serve' && clip.tossRelease !== undefined && localTime >= clip.tossRelease && localTime < clip.contact!) {
      const release = rotateMotionPoint(clip.tossLocal!, event.yaw, event.hand);
      const start = { x: event.root.x + release.x, y: release.y, z: event.root.z + release.z };
      const duration = (clip.contact! - clip.tossRelease) / event.rate, t = (localTime - clip.tossRelease) / event.rate;
      const alpha = t / duration;
      const initialY = (event.source.y - start.y + .5 * 9.81 * duration * duration) / duration;
      toss = { x: mix(start.x, event.source.x, alpha), y: start.y + initialY * t - .5 * 9.81 * t * t, z: mix(start.z, event.source.z, alpha) };
    }
    return { root: event.root, yaw: event.yaw, hand: event.hand, event, verticalCorrection,
      layers: [{ clip: event.clip, time: localTime, weight: 1 }], toss };
  }
  const next = events.find((candidate) => candidate.start > time), previous = [...events].reverse().find((candidate) => candidate.end < time);
  const anchor = next ?? previous!;
  if (!next || !previous) {
    // A split-step ends in the identical ready pose immediately before the next preparation.
    const splitStart = (next?.start ?? Infinity) - .6;
    return { root: anchor.root, yaw: anchor.yaw, hand: anchor.hand, event: null, verticalCorrection: 0, toss: null,
      layers: [{ clip: next && time >= splitStart ? 'split-step' : 'ready', time: next && time >= splitStart ? time - splitStart : (previous ? Math.max(0, time - previous.end) % 1.2 : 0), weight: 1 }] };
  }
  const dx = next.root.x - previous.root.x, dz = next.root.z - previous.root.z, distance = Math.hypot(dx, dz);
  const start = previous.end, end = Math.min(next.start, start + Math.max(.4, 1.5 * distance / 4.2 + .35)), duration = end - start;
  if (time >= end) {
    const splitStart = next.start - .6, split = next.start - end >= .6 && time >= splitStart;
    return { root: next.root, yaw: next.yaw, hand: next.hand, event: null, verticalCorrection: 0, toss: null,
      layers: [{ clip: split ? 'split-step' : 'ready', time: split ? time - splitStart : Math.max(0, Math.min(time - end, Math.max(0, splitStart - time))) % 1.2, weight: 1 }] };
  }
  const rootAt = (t: number) => lerpPoint(previous.root, next.root, smoothStep((t - start) / duration));
  const running = distance >= 1.8, heading = Math.atan2(dx, dz);
  const turnDuration = Math.min(.65, duration * .38);
  const yawAt = (t: number) => {
    if (!running) return yawLerp(previous.yaw, next.yaw, smoothStep((t - start) / duration));
    const depart = yawLerp(previous.yaw, heading, smoothStep((t - start) / turnDuration));
    return yawLerp(depart, next.yaw, smoothStep((t - (end - turnDuration)) / turnDuration));
  };
  const root = rootAt(time), yaw = yawAt(time);
  if (distance < .04) return { root, yaw, hand: next.hand, event: null, verticalCorrection: 0, toss: null, layers: [{ clip: 'ready', time: Math.max(0, Math.min(time - start, end - time)) % 1.2, weight: 1 }] };
  // Resolve travel into the opponent's local right/forward axes.
  const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw), localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const movement: MotionId = running ? 'run-forward' : Math.abs(localX) > Math.abs(localZ) ? localX < 0 ? 'move-right' : 'move-left' : localZ > 0 ? 'move-forward' : 'move-backward';
  const period = running ? .58 : Math.min(.65, Math.max(.38, duration / Math.max(1, Math.ceil(distance / 1.1))));
  const phase = (time - start) / period, blend = smoothStep((time - start) / .28) * smoothStep((end - time) / .28);
  const foot = (side: 'left' | 'right'): Vec3 => {
    const offset = side === 'right' ? 0 : .5;
    const cycle = Math.floor(phase - offset), u = phase - offset - cycle;
    // A running foot spends 38% of its cycle planted. There are brief flight
    // phases, and a same-foot stride can exceed two metres at peak travel speed.
    const swingFraction = running ? .62 : .5;
    const plantEnd = start + (cycle + offset + swingFraction + (1 - swingFraction) / 2) * period;
    const plantStart = plantEnd - period;
    const lane = running ? .13 : .26;
    const localFoot = [side === 'left' ? lane : -lane, .087, side === 'left' ? .05 : -.025];
    const anchored = (t: number): Vec3 => {
      const base = rootAt(t), plantYaw = yawAt(t);
      const local = rotateMotionPoint(localFoot, plantYaw, next.hand);
      return { x: base.x + local.x, y: local.y, z: base.z + local.z };
    };
    const swing = u < swingFraction, a = anchored(plantStart), b = anchored(plantEnd);
    const position = swing ? lerpPoint(a, b, smoothStep(u / swingFraction)) : b;
    const moving = { ...position, y: position.y + (swing ? Math.sin(u / swingFraction * Math.PI) * (running ? .34 : .14) : 0) };
    const local = rotateMotionPoint([side === 'left' ? .26 : -.26, .087, side === 'left' ? .05 : -.025], yaw, next.hand);
    // Match exact ready feet at both transition boundaries; no history-dependent foot anchors.
    return lerpPoint({ x: root.x + local.x, y: local.y, z: root.z + local.z }, moving, blend);
  };
  return { root, yaw, hand: next.hand, event: null, verticalCorrection: 0, toss: null,
    lookYaw: running ? Math.max(-1.15, Math.min(1.15, Math.atan2(Math.sin(next.yaw-yaw),Math.cos(next.yaw-yaw)))) * blend : 0,
    layers: [{ clip: 'ready', time: 0, weight: 1 - blend }, { clip: movement, time: (phase % 1) * .6, weight: blend }],
    footTargets: { left: foot('left'), right: foot('right') } };
};
