import { COURT, OPPONENT_POSITION_LIMITS } from '../domain/court.ts';
import { spinsForShot, SHOT_TYPE_LABELS } from '../domain/shotKinds.ts';
import { SHOT_CAMERA_RANGES } from '../domain/cameraRanges.ts';
import type { DrillDefinitionV2, SavedShotV2 } from './types.ts';
import type { ValidationResult } from './validation.ts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const range = (v: unknown, low: number, high: number) => typeof v === 'number' && Number.isFinite(v) && v >= low - 1e-8 && v <= high + 1e-8;
const text = (v: unknown, max: number, required = true) => typeof v === 'string' && (!required || !!v.trim()) && v.length <= max;
const id = (v: unknown) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(v);
function object(v: unknown, keys: string, path: string, errors: string[]): v is Record<string, unknown> {
  if (!record(v)) { errors.push(`${path} must be an object.`); return false; }
  const unknown = Object.keys(v).filter(k => !keys.split(' ').includes(k));
  if (unknown.length) errors.push(`${path} contains unsupported fields: ${unknown.join(', ')}.`);
  return true;
}
function ball(v: unknown, role: 'launch' | 'rally', path: string, errors: string[], opponent = false) {
  if (!object(v, 'family stroke hand paceKmh spin spinRateRpm variationPercent bounceFactor trajectoryMode netClearanceM serveRhythm contactTiming', path, errors)) return;
  if (v.contactTiming !== undefined && !['rise', 'apex', 'descent'].includes(v.contactTiming as string)) errors.push(`${path} contact timing is invalid.`);
  const family = v.family;
  if (typeof family !== 'string' || !Object.hasOwn(SHOT_TYPE_LABELS, family)
    || (role === 'launch' ? !['serve', 'groundstroke'].includes(family) : family === 'serve')) errors.push(`${path} shot type is not valid for this phase.`);
  if (!(opponent ? ['auto', 'forehand', 'backhand'] : ['forehand', 'backhand']).includes(String(v.stroke)) || !['left', 'right'].includes(String(v.hand))) errors.push(`${path} hand or stroke is invalid.`);
  if (!spinsForShot(String(family)).includes(v.spin as never)) errors.push(`${path} spin is invalid; kick/sidespin require a serve.`);
  for (const [key, limits] of Object.entries({ paceKmh: [20, 260], spinRateRpm: [0, 6000], variationPercent: [0, 25], bounceFactor: [.6, 1.4], netClearanceM: [.08, 6] })) {
    if (!range(v[key], limits[0]!, limits[1]!)) errors.push(`${path} ${key} is outside ${limits.join('–')}.`);
  }
  if (!['natural', 'exact'].includes(String(v.trajectoryMode)) || !['normal', 'compact'].includes(String(v.serveRhythm))) errors.push(`${path} trajectory style or serve rhythm is invalid.`);
}
function zone(v: unknown, side: 'near' | 'far', path: string, errors: string[]) {
  if (!object(v, 'minX maxX minZ maxZ', path, errors)) return;
  const { minX, maxX, minZ, maxZ } = v, bound = COURT.singlesWidth / 2 - .12;
  if (![minX, maxX].every(n => range(n, -bound, bound))
    || ![minZ, maxZ].every(n => range(n, side === 'far' ? .12 : -COURT.halfLength + .12, side === 'far' ? COURT.halfLength - .12 : -.12))
    || !range(Number(maxX) - Number(minX), .2, 6) || !range(Number(maxZ) - Number(minZ), .2, 6)) errors.push(`${path} must be a 0.2–6 m rectangle on the ${side} singles court.`);
}
function response(v: unknown, launch: boolean, path: string, errors: string[]) {
  if (!object(v, launch ? 'ball landingZone position' : 'ball landingZone', path, errors)) return;
  ball(v.ball, launch ? 'launch' : 'rally', `${path} ball`, errors, true);
  zone(v.landingZone, 'near', `${path} landing zone`, errors);
  if (launch) {
    if (object(v.position, 'x z', `${path} position`, errors)) {
      if (!range(v.position.x, -OPPONENT_POSITION_LIMITS.halfWidth, OPPONENT_POSITION_LIMITS.halfWidth)
        || !range(v.position.z, .7, OPPONENT_POSITION_LIMITS.halfLength)) errors.push(`${path} position is outside court runoff.`);
    }
    if (record(v.ball) && v.ball.family === 'serve' && record(v.landingZone) && record(v.position)) {
      const z = v.landingZone, x = Number(v.position.x);
      const wrongBox = x < 0 ? Number(z.minX) < .12 : x > 0 ? Number(z.maxX) > -.12
        : Number(z.minX) < .12 && Number(z.maxX) > -.12;
      if (Number(z.minZ) < -COURT.serviceLineFromNet + .12 - 1e-8 || wrongBox) errors.push(`${path} serve landing zone must be in the diagonal service box.`);
    }
  }
}
function cameraTransition(v: unknown, path: string, errors: string[]) {
  if (!object(v, 'movement focus', path, errors)) return;
  if (v.movement !== undefined && object(v.movement, 'destination start delaySeconds resume resumeDelaySeconds pacePercent waypoint', `${path} movement`, errors)) {
    const m = v.movement;
    if (!['auto', 'neutral', 'next-shot', 'waypoint'].includes(String(m.destination))) errors.push(`${path} movement destination is invalid.`);
    for (const key of ['start', 'resume']) if (m[key] !== undefined && !['auto', 'player-hit', 'opponent-hit', 'after-split'].includes(String(m[key]))) errors.push(`${path} ${key} is invalid.`);
    for (const key of ['delaySeconds', 'resumeDelaySeconds']) if (m[key] !== undefined && !range(m[key], 0, 2)) errors.push(`${path} ${key} must be 0–2 seconds.`);
    if (m.pacePercent !== undefined && !range(m.pacePercent, 50, 200)) errors.push(`${path} pace must be 50–200%.`);
    if (m.waypoint !== undefined || m.destination === 'waypoint') {
      if (object(m.waypoint, 'lateral behindBaseline eyeHeight', `${path} waypoint`, errors))
        for (const key of ['lateral', 'behindBaseline', 'eyeHeight'] as const)
          if (!range(m.waypoint[key], SHOT_CAMERA_RANGES[key][0], SHOT_CAMERA_RANGES[key][1])) errors.push(`${path} waypoint ${key} is invalid.`);
    }
  }
  if (v.focus !== undefined && object(v.focus, 'beforeReturn afterReturn', `${path} focus`, errors)) {
    for (const phase of ['beforeReturn', 'afterReturn']) {
      const f = v.focus[phase]; if (f === undefined) continue;
      if (!object(f, 'mode direction point', `${path} ${phase}`, errors)) continue;
      if (!['auto', 'ball', 'opponent', 'next-shot', 'direction', 'point'].includes(String(f.mode))) errors.push(`${path} focus mode is invalid.`);
      if (f.direction !== undefined || f.mode === 'direction') {
        if (object(f.direction, 'yaw pitch', `${path} direction`, errors)
          && (!range(f.direction.yaw, -180, 180) || !range(f.direction.pitch, -85, 85))) errors.push(`${path} direction is invalid.`);
      }
      if (f.point !== undefined || f.mode === 'point') {
        if (object(f.point, 'x y z', `${path} focus point`, errors)
          && (!range(f.point.x, -12, 12) || !range(f.point.y, 0, 8) || !range(f.point.z, -20, 20))) errors.push(`${path} focus point is outside court bounds.`);
      }
    }
  }
}
export function validatePlayerEvent(v: unknown, path: string, errors: string[]) {
  if (!object(v, 'id presetId label cue camera cameraTransition ball landingZone opponentReturn intervalSeconds rhythmPercent movementPercent openingFeed', path, errors)) return;
  if (!id(v.id)) errors.push(`${path} needs a valid id.`);
  if (v.presetId !== undefined && !id(v.presetId)) errors.push(`${path} preset id is invalid.`);
  if (!text(v.label, 60) || !text(v.cue, 60, false)) errors.push(`${path} label/cue must be 60 characters or fewer.`);
  if (object(v.camera, Object.keys(SHOT_CAMERA_RANGES).join(' '), `${path} camera`, errors)) {
    for (const [key, limits] of Object.entries(SHOT_CAMERA_RANGES)) if (!range(v.camera[key], limits[0], limits[1])) errors.push(`${path} camera ${key} is invalid.`);
  }
  if (v.cameraTransition !== undefined) cameraTransition(v.cameraTransition, `${path} camera transition`, errors);
  ball(v.ball, 'rally', `${path} player ball`, errors);
  zone(v.landingZone, 'far', `${path} player landing zone`, errors);
  response(v.opponentReturn, false, `${path} opponent return`, errors);
  if (v.openingFeed !== undefined) response(v.openingFeed, true, `${path} opening feed`, errors);
  for (const [key, limits] of Object.entries({ intervalSeconds: [1, 30], rhythmPercent: [50, 300], movementPercent: [50, 300] })) {
    if (v[key] !== undefined && !range(v[key], limits[0]!, limits[1]!)) errors.push(`${path} ${key} is invalid.`);
  }
}
export function validatePlayerDrill(v: unknown): ValidationResult {
  const errors: string[] = [], warnings: string[] = [];
  if (!object(v, 'schemaVersion playerHand id title description category launch events defaultInterval defaultRhythmPercent defaultMovementPercent defaultRepetitions', 'Drill', errors)) return { valid: false, errors, warnings };
  if (v.playerHand !== undefined && !['right', 'left'].includes(String(v.playerHand))) errors.push('Player handedness must be right or left.');
  if (v.schemaVersion !== 2) errors.push('Player drills require schemaVersion 2.');
  if (!id(v.id) || !text(v.title, 100) || !text(v.description, 400, false)) errors.push('Drill id, title or description is invalid.');
  if (!['Quick Rally', 'Return Practice', 'Tactical Pattern', 'Serve & Volley', 'Net & Overhead', 'Custom'].includes(String(v.category))) errors.push('Category is not supported.');
  response(v.launch, true, 'Opening shot', errors);
  if (!Array.isArray(v.events) || !v.events.length || v.events.length > 200) errors.push('A drill needs 1–200 player shots.');
  else {
    v.events.forEach((event, index) => validatePlayerEvent(event, `Player shot ${index + 1}`, errors));
    const ids = v.events.filter(record).map(e => e.id);
    if (new Set(ids).size !== ids.length) errors.push('Player shot ids must be unique.');
  }
  if (!range(v.defaultInterval, 1, 30)) errors.push('Default interval must be 1–30 seconds.');
  for (const key of ['defaultRhythmPercent', 'defaultMovementPercent']) if (v[key] !== undefined && !range(v[key], 50, 300)) errors.push(`${key} must be 50–300.`);
  if (!Number.isInteger(v.defaultRepetitions) || !range(v.defaultRepetitions, 1, 200)) errors.push('Repetitions must be an integer from 1 to 200.');
  if (/https?:\/\//i.test(JSON.stringify(v))) errors.push('Remote URLs are not allowed in drill JSON.');
  return { valid: !errors.length, errors, warnings };
}
export function isPlayerSavedShot(v: unknown): v is SavedShotV2 {
  const errors: string[] = [];
  if (!object(v, 'schemaVersion playerHand id name event', 'Saved shot', errors)) return false;
  if (v.playerHand !== undefined && !['right', 'left'].includes(String(v.playerHand))) return false;
  if (v.schemaVersion !== 2 || !id(v.id) || !text(v.name, 60)) return false;
  validatePlayerEvent(v.event, 'Saved shot', errors);
  return !errors.length && !/https?:\/\//i.test(JSON.stringify(v));
}
export const isPlayerDrill = (v: unknown): v is DrillDefinitionV2 => validatePlayerDrill(v).valid;
