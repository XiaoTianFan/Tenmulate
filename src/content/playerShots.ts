import { COURT } from '../domain/court';
import { DEFAULT_DRILL_CAMERA } from '../engine/session/cameraTimeline';
import { normalizeShotSpin } from '../domain/shotKinds';
import { normalizeContactTiming } from '../engine/session/bounceContact';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { resolveLandingZone, type LandingZone } from '../engine/trajectory/landingZone';
import type { DrillBall, OpeningFeed, PlayerShotEventV2, RallyShotFamily, ShotFamily, StrokeChoice } from './types';

export const ballDefaults = (family: ShotFamily = 'groundstroke'): DrillBall => {
  const profile = {
    groundstroke: [70, 600, .25], approach: [72, 650, 1], 'half-volley': [55, 650, .12],
    volley: [60, 650, .12], overhead: [95, 120, .15], lob: [60, 1100, 2.5],
    'drop-shot': [38, 1400, .12], serve: [140, 900, .18],
  }[family];
  return { family, stroke: 'forehand', hand: 'right', paceKmh: profile[0]!,
    spin: ['volley', 'half-volley', 'drop-shot'].includes(family) ? 'slice' : family === 'overhead' || family === 'serve' ? 'flat' : 'topspin',
    spinRateRpm: profile[1]!, netClearanceM: profile[2]!, variationPercent: 8,
    bounceFactor: 1, trajectoryMode: 'natural', serveRhythm: 'normal', contactTiming: family === 'half-volley' ? 'rise' : 'descent' };
};
export const changeBallFamily = <Side extends StrokeChoice>(ball: DrillBall<Side>, family: ShotFamily): DrillBall<Side> => ({
  ...ballDefaults(family), hand: ball.hand, stroke: ball.stroke, variationPercent: ball.variationPercent, contactTiming: normalizeContactTiming(ball.contactTiming),
});
export const normalizeDrillBall = <Side extends StrokeChoice>(ball: DrillBall<Side>): DrillBall<Side> => ({ ...ball, spin: normalizeShotSpin(ball.family, ball.spin), contactTiming: normalizeContactTiming(ball.contactTiming) });
export const farZone = (x: number, z: number, width = 1.6, depth = 2): LandingZone => {
  const near = resolveLandingZone({ x: -x, z: -z }, { width, depth }, 'groundstroke', { x: 0 });
  return { minX: 0 - near.maxX, maxX: 0 - near.minX, minZ: 0 - near.maxZ, maxZ: 0 - near.minZ };
};
export const nearZone = (x: number, z: number, width = 1.6, depth = 2): LandingZone =>
  resolveLandingZone({ x, z }, { width, depth }, 'groundstroke', { x: 0 });
export const cameraForShot = (x: number, z = -12.1): CameraConfiguration => ({
  ...DEFAULT_DRILL_CAMERA, lateral: x, behindBaseline: -z - COURT.halfLength,
});
/** A bounce intent in front of the player's court position, never a camera-relative emitter. */
export const receivingZone = (camera: CameraConfiguration, family: ShotFamily = 'groundstroke', ball?: Pick<DrillBall, 'stroke' | 'hand' | 'contactTiming'>, incomingFrom = { x: 0, z: 12.4 }): LandingZone => {
  const offset = ((ball?.stroke ?? (camera.lateral > 0 ? 'backhand' : 'forehand')) === 'forehand' ? -1 : 1) * (ball?.hand === 'left' ? -1 : 1) * .45;
  if (['volley', 'overhead'].includes(family)) return nearZone(family === 'volley' ? camera.lateral * 1.5 : camera.lateral, -8.5, 1.2, 1.4);
  const feetZ = -(COURT.halfLength + camera.behindBaseline), contactZ = feetZ + .65;
  const lead = family === 'half-volley' ? .45 : ball?.contactTiming === 'rise' ? 3 : ball?.contactTiming === 'apex' ? 4.1 : 4.5;
  const bounceZ = Math.min(-1.2, feetZ + lead), contactX = camera.lateral + offset;
  // Suggest a bounce along the incoming direction: a crosscourt ball keeps
  // travelling sideways after it bounces. This only creates new/default zones.
  const fraction = (bounceZ - contactZ) / Math.max(1, incomingFrom.z - contactZ);
  return nearZone(contactX + (incomingFrom.x - contactX) * fraction, bounceZ, 1.2, 1.4);
};
export const openingFor = (event: Pick<PlayerShotEventV2, 'camera' | 'ball'>, serve = false): OpeningFeed => ({
  position: { x: serve ? event.camera.lateral > 0 ? -1.25 : 1.25 : 0, z: 12.4 },
  ball: { ...ballDefaults(serve ? 'serve' : event.ball.family === 'overhead' ? 'lob' : 'groundstroke'),
    // Overhead launches are still groundstroke feeds with an intentionally high arc.
    family: serve ? 'serve' : 'groundstroke',
    netClearanceM: event.ball.family === 'overhead' ? 3.2 : serve ? .18 : .25,
    ...(!serve && event.ball.family === 'volley' ? { paceKmh: 90, spin: 'flat' as const, spinRateRpm: 120, netClearanceM: .12 } : {}),
    variationPercent: 0 },
  landingZone: serve ? resolveLandingZone({ x: event.camera.lateral > 0 ? 1.9 : -1.9, z: -4.8 },
    { width: .7, depth: .8 }, 'serve', { x: event.camera.lateral > 0 ? -1.25 : 1.25 })
    : receivingZone(event.camera, event.ball.family, event.ball),
});

type ShotSpec = readonly [id: string, name: string, family: RallyShotFamily, stroke: 'forehand' | 'backhand',
  x: number, z: number, targetX: number, targetZ: number];
const specs: readonly ShotSpec[] = [
  ['fh-cross-deep', 'Forehand crosscourt deep', 'groundstroke', 'forehand', -2.2, -12.1, 2.6, 9.3],
  ['fh-cross-mid', 'Forehand crosscourt medium', 'groundstroke', 'forehand', -2.2, -12.1, 2.4, 7.4],
  ['fh-line-deep', 'Forehand down the line', 'groundstroke', 'forehand', -2.2, -12.1, -2.6, 9.3],
  ['fh-inside-out', 'Inside-out forehand', 'groundstroke', 'forehand', 2.1, -12.1, -2.7, 9],
  ['bh-cross-deep', 'Backhand crosscourt deep', 'groundstroke', 'backhand', 2.2, -12.1, -2.6, 9.3],
  ['bh-cross-high', 'Heavy backhand crosscourt', 'groundstroke', 'backhand', 2.2, -12.1, -2.4, 9],
  ['bh-line-deep', 'Backhand down the line', 'groundstroke', 'backhand', 2.2, -12.1, 2.6, 9.3],
  ['body-neutral', 'Neutral ball through the middle', 'groundstroke', 'forehand', 0, -12.1, 0, 9],
  ['short-angle-left', 'Short angle left', 'groundstroke', 'forehand', -2, -9, 2.7, 5.3],
  ['short-angle-right', 'Short angle right', 'groundstroke', 'backhand', 2, -9, -2.7, 5.3],
  ['defensive-high-left', 'High defensive crosscourt', 'groundstroke', 'forehand', -2.5, -12.5, 2.5, 9.7],
  ['slice-low-right', 'Backhand slice down the line', 'groundstroke', 'backhand', 2.1, -11.8, 2.4, 8.6],
  ['approach-feed', 'Forehand approach down the line', 'approach', 'forehand', -1.8, -8, -2.4, 9.3],
  ['half-volley-body', 'Half-volley through the middle', 'half-volley', 'forehand', 0, -6.5, 0, 8.5],
  ['volley-left', 'Forehand volley crosscourt', 'volley', 'forehand', -1.6, -4.3, .8, 9.3],
  ['volley-right', 'Backhand volley crosscourt', 'volley', 'backhand', 1.6, -3.8, -.8, 9.3],
  ['lob-deep', 'Defensive lob', 'lob', 'backhand', 1.2, -10, -1.2, 10.1],
  ['overhead-feed', 'Overhead into the open court', 'overhead', 'forehand', -.8, -5.5, 2, 9],
  ['drop-shot-short', 'Forehand drop shot', 'drop-shot', 'forehand', -1.6, -8, 1.8, 2.8],
  ['return-fh-cross', 'Forehand return crosscourt', 'groundstroke', 'forehand', -2.4, -11.5, 2.3, 9],
  ['return-bh-cross', 'Backhand return crosscourt', 'groundstroke', 'backhand', 2.4, -11.5, -2.3, 9],
];
export type PlayerShotPreset = Readonly<{ id: string; name: string; event: PlayerShotEventV2 }>;
export const PLAYER_SHOTS: readonly PlayerShotPreset[] = specs.map(([id, name, family, stroke, x, z, targetX, targetZ]) => {
  const camera = cameraForShot(x, z), ball = { ...ballDefaults(family), stroke };
  return { id, name, event: { id: `preset-${id}`, presetId: id, label: name, cue: name.toUpperCase(), camera,
    ball: id === 'slice-low-right' ? { ...ball, spin: 'slice', spinRateRpm: 1253 }
      : id.startsWith('short-angle') ? { ...ball, paceKmh: 60, netClearanceM: .85 } : ball,
    landingZone: farZone(targetX, targetZ), opponentReturn: { ball: { ...ballDefaults(), stroke: 'auto' }, landingZone: receivingZone(camera, family, ball) } } };
});
export const PLAYER_SHOT_BY_ID = new Map(PLAYER_SHOTS.map(shot => [shot.id, shot]));
export function newPlayerEvent(presetId = PLAYER_SHOTS[0]!.id): PlayerShotEventV2 {
  const preset = PLAYER_SHOT_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown player shot preset: ${presetId}`);
  return { ...structuredClone(preset.event), id: `event-${crypto.randomUUID()}` };
}

/** A fresh preset starts from family defaults, never the selected drill event. */
export function createPlayerShot(name: string, hand: 'right' | 'left', family: RallyShotFamily, stroke: 'forehand' | 'backhand') {
  const id = `shot-${crypto.randomUUID()}`;
  const depth = family === 'volley' ? -4.3 : family === 'overhead' ? -5.5 : family === 'half-volley' ? -6.5
    : family === 'approach' || family === 'drop-shot' ? -8 : -12.1;
  const camera = cameraForShot(0, depth), ball = { ...ballDefaults(family), hand, stroke };
  return { schemaVersion: 2 as const, id, name: name.trim(), playerHand: hand, event: {
    id: `preset-${id}`, presetId: id, label: name.trim(), cue: name.trim().toUpperCase(), camera, ball,
    landingZone: farZone(0, family === 'drop-shot' ? 2.8 : 8.5),
    opponentReturn: { ball: { ...ballDefaults(), stroke: 'auto' as const }, landingZone: receivingZone(camera, family, ball) },
    intervalSeconds: 5, rhythmPercent: 100, movementPercent: 100,
  } };
}
