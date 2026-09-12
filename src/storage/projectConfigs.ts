import type { CameraPositionPresetV1, PerspectivePresetV1, PracticePreferencesV1 } from './appStorage.ts';
import { SHOT_CAMERA_RANGES } from '../domain/cameraRanges.ts';
import { VENUE_IDS } from '../domain/environment.ts';

export const PROJECT_CONFIGS_ENDPOINT = '/__tenmulate/project/configs';
export const PRACTICE_CATEGORIES = ['Quick Rally', 'Return Practice', 'Serve & Volley', 'Net & Overhead'] as const;
export type ProjectConfigs = { schemaVersion: 1; practiceConfigs: Record<string, PracticePreferencesV1>;
  cameraPositionPresets: CameraPositionPresetV1[]; perspectivePresets: PerspectivePresetV1[] };
export type ConfigChange = { kind: 'practice'; value: PracticePreferencesV1 }
  | { kind: 'position'; value: CameraPositionPresetV1 } | { kind: 'perspective'; value: PerspectivePresetV1 };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, min = -10000, max = 10000) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function fields(value: unknown, keys: string[]) {
  if (!record(value) || keys.some(key => !number(value[key]))) throw new Error('Invalid configuration fields.');
  return value;
}
function camera(value: unknown, keys: string[]) {
  const v = fields(value, keys);
  for (const key of keys) {
    const bounds = key === 'eyeHeight' ? [.4, 8] : key === 'pitch' ? [-180, 180] : SHOT_CAMERA_RANGES[key as keyof typeof SHOT_CAMERA_RANGES];
    if (!number(v[key], bounds[0], bounds[1])) throw new Error(`Invalid camera ${key}.`);
  }
}
export function validatePracticeConfig(value: unknown): PracticePreferencesV1 {
  const v = fields(value, ['launchSpeedKmh', 'interval', 'rhythmPercent', 'movementPercent', 'repetitions', 'variation', 'timingVariation', 'workBlockSize', 'restSeconds', 'spinRateRpm', 'bounceFactor', 'landingDepthM', 'aimDirectionDeg', 'screenWidthCm', 'screenHeightCm', 'viewDistanceCm']);
  const enums: Record<string, readonly unknown[]> = { sessionCategory: PRACTICE_CATEGORIES, surface: ['hard', 'clay', 'grass'],
    shotType: ['groundstroke', 'serve', 'volley', 'lob', 'overhead', 'drop-shot'], spin: ['flat', 'topspin', 'slice', 'kick', 'sidespin'],
    practiceStroke: ['auto', 'forehand', 'backhand'], trajectoryMode: ['natural', 'exact'], returnTargetMode: ['pattern', 'custom'],
    opponentHand: ['left', 'right'], serveRhythm: ['normal', 'compact'], opponentContactTiming: ['rise', 'apex', 'descent'], quality: ['auto', 'performance', 'quality'] };
  for (const [key, choices] of Object.entries(enums)) if (!choices.includes(v[key])) throw new Error(`Invalid configuration ${key}.`);
  if (typeof v.trajectoryEnabled !== 'boolean' || !number(v.launchSpeedKmh, 20, 260) || !number(v.interval, 1, 30)
    || !number(v.repetitions, 1, 1000) || !number(v.variation, 0, 100) || !number(v.spinRateRpm, 0, 6000)
    || !record(v.ballFocus) || typeof v.ballFocus.enabled !== 'boolean') throw new Error('Invalid practice configuration.');
  camera(v.camera, Object.keys(SHOT_CAMERA_RANGES));
  fields(v.opponentPosition, ['x', 'z']); fields(v.landingZone, ['width', 'depth']);
  const zone = fields(v.rallyLandingZone, ['minX', 'maxX', 'minZ', 'maxZ']);
  if (Number(zone.minX) >= Number(zone.maxX) || Number(zone.minZ) >= Number(zone.maxZ)) throw new Error('Invalid return landing zone.');
  const environment = fields(v.environment, ['lightDirection', 'lightIntensity', 'timeOfDay', 'weatherIntensity', 'windDirection', 'windSpeedMps']);
  if (!VENUE_IDS.includes(environment.venue as typeof VENUE_IDS[number]) || !['empty','half','full'].includes(String(environment.audience))
    || !['day','golden-hour','night','indoor-neutral','indoor-warm','indoor-bright'].includes(String(environment.lighting))
    || !['clear','overcast','rain'].includes(String(environment.weather))) throw new Error('Invalid environment configuration.');
  if (!record(v.rallyShot) || !['groundstroke','drop-shot','volley','overhead','lob'].includes(String(v.rallyShot.type))
    || !['flat','topspin','slice'].includes(String(v.rallyShot.spin))) throw new Error('Invalid player return configuration.');
  if (v.rallyShot.paceKmh !== undefined && !number(v.rallyShot.paceKmh, 20, 260)
    || v.rallyShot.spinRateRpm !== undefined && !number(v.rallyShot.spinRateRpm, 0, 6000)
    || v.rallyShot.contactTiming !== undefined && !['rise','apex','descent'].includes(String(v.rallyShot.contactTiming))) throw new Error('Invalid player return settings.');
  if (v.seed !== undefined && (typeof v.seed !== 'string' || !/^\d{1,10}$/.test(v.seed))) throw new Error('Invalid seed.');
  return value as PracticePreferencesV1;
}
export function validateProjectConfigs(value: unknown): ProjectConfigs {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.practiceConfigs)) throw new Error('Invalid configuration catalog.');
  for (const [category, config] of Object.entries(value.practiceConfigs)) {
    if (validatePracticeConfig(config).sessionCategory !== category) throw new Error('Configuration category mismatch.');
  }
  for (const [key, position] of [['cameraPositionPresets', true], ['perspectivePresets', false]] as const) {
    const list = value[key];
    if (!Array.isArray(list) || list.length > 1000) throw new Error('Invalid preset catalog.');
    const ids = new Set<string>();
    for (const preset of list) {
      if (!record(preset) || typeof preset.id !== 'string' || !preset.id || ids.has(preset.id)
        || typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 60) throw new Error('Invalid preset identity.');
      ids.add(preset.id);
      camera(position ? preset.position : preset.perspective, position ? ['eyeHeight', 'behindBaseline', 'lateral'] : ['yaw', 'pitch', 'fov']);
      if (preset.lookAt !== undefined) fields(preset.lookAt, ['x', 'y', 'z']);
    }
  }
  return value as ProjectConfigs;
}
export function upsertProjectConfig(catalog: ProjectConfigs, input: ConfigChange) {
  const next: ProjectConfigs = structuredClone({ schemaVersion: 1, practiceConfigs: catalog.practiceConfigs, cameraPositionPresets: catalog.cameraPositionPresets, perspectivePresets: catalog.perspectivePresets });
  if (input.kind === 'practice') { const value = validatePracticeConfig(input.value); next.practiceConfigs[value.sessionCategory] = value; }
  else if (input.kind === 'position' || input.kind === 'perspective') {
    const key = input.kind === 'position' ? 'cameraPositionPresets' : 'perspectivePresets';
    // Validate the discriminated value through the complete catalog below.
    (next[key] as (CameraPositionPresetV1 | PerspectivePresetV1)[]) = [...next[key].filter(item => item.id !== input.value.id), input.value];
  } else throw new Error('Unknown configuration kind.');
  return validateProjectConfigs(next);
}
