import { planRecovery, sampleRecovery } from './opponentMovement';
import type { MovementStage } from './opponentMovement';
export { MAX_OPPONENT_SPEED } from './opponentMovement';
import library from '../../content/opponent-motion.json';
import type { ShotDefinitionV1 } from '../../content/types';
import type { Vec3 } from '../../domain/vector';

export const OPPONENT_MOTION = library;
export type StrokeId = 'forehand' | 'backhand' | 'forehand-slice' | 'backhand-slice' | 'forehand-volley' | 'backhand-volley' | 'serve' | 'serve-compact';
export const isServeMotion = (clip: string): boolean => clip === 'serve' || clip === 'serve-compact';
export type MotionId = keyof typeof library.clips;
export type ClipMetadata = Readonly<{ duration: number; contact?: number; contactLocal?: readonly number[]; tossRelease?: number; tossLocal?: readonly number[]; recovery: number; loop: boolean }>;
export const motionClip = (id: MotionId): ClipMetadata => library.clips[id];
export const smoothStep = (value: number): number => { const x = Math.min(1, Math.max(0, value)); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type MotionEvent = Readonly<{
  index: number; clip: StrokeId; contactTime: number; start: number; end: number;
  rate: number; hand: 'left' | 'right'; yaw: number; root: Vec3; source: Vec3;
  movementRate?: number;
  home?: Vec3; recoveryPolicy?: 'home' | 'auto' | 'recover' | 'direct';
  tossEnabled?: boolean;
}>;
export type MotionRepetition = Readonly<{ index: number; startTime: number; shot: ShotDefinitionV1;
  motionRate?: number; movementRate?: number; home?: Vec3; recoveryPolicy?: MotionEvent['recoveryPolicy'] }>;

export const strokeForShot = (shot: ShotDefinitionV1, index: number): StrokeId => {
  if (shot.family === 'serve') return shot.serveRhythm === 'compact' ? 'serve-compact' : 'serve';
  if (shot.family === 'overhead') return 'serve';
  const relativeSide = shot.source.x * (shot.opponentHand === 'left' ? -1 : 1);
  const side = shot.stroke ?? (shot.backhandStyle ? 'backhand' : Math.abs(relativeSide) > 0.4 ? relativeSide < 0 ? 'backhand' : 'forehand' : index % 2 ? 'backhand' : 'forehand');
  if (shot.family === 'volley') return `${side}-volley`;
  return shot.spin === 'slice' ? `${side}-slice` : side;
};

export const rotateMotionPoint = (point: readonly number[], yaw: number, hand: 'left' | 'right'): Vec3 => {
  const x = (point[0] ?? 0) * library.scale * (hand === 'left' ? -1 : 1), z = (point[2] ?? 0) * library.scale;
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), y: (point[1] ?? 0) * library.scale + library.floorOffset, z: -x * Math.sin(yaw) + z * Math.cos(yaw) };
};

export const motionEvent = (repetition: MotionRepetition): MotionEvent => {
  const { shot, index, startTime } = repetition, clip = strokeForShot(shot, index), metadata = motionClip(clip);
  // Uniform source-clock scaling preserves all phase ratios and contact anchors.
  // Compact remains its own clip; it receives no additional hidden multiplier.
  const rate = repetition.motionRate ?? 1;
  const yaw = Math.atan2(shot.target.x - shot.source.x, shot.target.z - shot.source.z);
  const local = rotateMotionPoint(metadata.contactLocal!, yaw, shot.opponentHand);
  return { index, clip, contactTime: startTime, start: startTime - metadata.contact! / rate,
    end: startTime + (metadata.duration - metadata.contact!) / rate, rate, yaw, hand: shot.opponentHand,
    root: { x: shot.source.x - local.x, y: 0, z: shot.source.z - local.z }, source: shot.source,
    movementRate: repetition.movementRate, home: repetition.home, recoveryPolicy: repetition.recoveryPolicy, tossEnabled: shot.family === 'serve' };
};

export const minimumMotionGap = (previous: MotionRepetition, next: MotionRepetition): number => {
  const a = motionEvent(previous), b = motionEvent(next);
  return a.end - a.contactTime + b.contactTime - b.start + planRecovery(a,b).requiredDuration;
};

export type MotionSample = Readonly<{
  root: Vec3; yaw: number; hand: 'left' | 'right';
  layers: readonly Readonly<{ clip: MotionId; time: number; weight: number }>[];
  event: MotionEvent | null; verticalCorrection: number;
  movement?: Readonly<{stage:MovementStage;speed:number;acceleration?:number;distance:number;phase:number;heading:number}>;
  footTargets?: Readonly<{ left: Vec3; right: Vec3 }>;
  /** Local head counter-turn keeps the gaze toward play during lateral running. */
  lookYaw?: number;
  travelLean?: number;
  toss: Vec3 | null;
}>;


export const sampleOpponentTimeline = (events: readonly MotionEvent[], time: number): MotionSample | null => {
  if (!events.length) return null;
  const event = events.find((candidate) => time >= candidate.start && time <= candidate.end);
  if (event) {
    const clip = motionClip(event.clip), localTime = Math.max(0, Math.min(clip.duration, (time - event.start) * event.rate));
    const contactHeight = rotateMotionPoint(clip.contactLocal!, event.yaw, event.hand).y;
    const contactEnvelope = smoothStep(localTime / clip.contact!) * smoothStep((clip.duration - localTime) / (clip.duration - clip.contact!));
    const verticalCorrection = (event.source.y - contactHeight) * contactEnvelope;
    let toss: Vec3 | null = null;
    if (isServeMotion(event.clip) && event.tossEnabled !== false && clip.tossRelease !== undefined && localTime >= clip.tossRelease && localTime < clip.contact!) {
      const release = rotateMotionPoint(clip.tossLocal!, event.yaw, event.hand);
      const releaseEnvelope = smoothStep(clip.tossRelease / clip.contact!) * smoothStep((clip.duration - clip.tossRelease) / (clip.duration - clip.contact!));
      const start = { x: event.root.x + release.x, y: release.y + (event.source.y - contactHeight) * releaseEnvelope, z: event.root.z + release.z };
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
  if (!next && previous) return sampleRecovery(planRecovery(previous),time,previous.hand);
  if (!previous) {
    if (next?.home) {
      const initial = { ...next, root: next.home, yaw: Math.PI, end: 0, recoveryPolicy: 'direct' as const };
      return sampleRecovery(planRecovery(initial, next), time, next.hand);
    }
    // A split-step ends in the identical ready pose immediately before the next preparation.
    const splitStart = (next?.start ?? Infinity) - .6;
    return { root: anchor.root, yaw: anchor.yaw, hand: anchor.hand, event: null, verticalCorrection: 0, toss: null,
      layers: [{ clip: next && time >= splitStart ? 'split-step' : 'ready', time: next && time >= splitStart ? time - splitStart : 0, weight: 1 }] };
  }
  return sampleRecovery(planRecovery(previous,next),time,next!.hand);
};
