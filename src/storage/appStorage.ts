import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { QualityMode } from '../engine/rendering/TennisScene';
import type { DrillDefinitionV1 } from '../content/types';
import { validateDrill } from '../content/validation';
import type { SurfaceId } from '../domain/court';
import { DEFAULT_ENVIRONMENT, normalizeEnvironmentConfiguration, type EnvironmentConfiguration } from '../domain/environment';
import type { SpinKind } from '../engine/trajectory/physics';
import { PRACTICE_SHOT_PROFILES, isPracticeShotType, spinForPracticeShot, type PracticeShotType } from '../engine/trajectory/practiceProfiles';

const STORAGE_KEY = 'tenmulate.appData.v1';

export type SavedViewV1 = Readonly<{
  id: string;
  name: string;
  camera: CameraConfiguration;
}>;

export type CameraPosition = Readonly<Pick<CameraConfiguration, 'eyeHeight' | 'behindBaseline' | 'lateral'>>;
export type PerspectiveConfiguration = Readonly<Pick<CameraConfiguration, 'yaw' | 'pitch' | 'fov'>>;
export type CameraPositionPresetV1 = Readonly<{ id: string; name: string; position: CameraPosition }>;
export type PerspectivePresetV1 = Readonly<{ id: string; name: string; perspective: PerspectiveConfiguration }>;

export const DEFAULT_CAMERA_POSITION_PRESETS: readonly CameraPositionPresetV1[] = [
  { id: 'position-baseline', name: 'Baseline', position: { eyeHeight: 1.7, behindBaseline: 1.5, lateral: 0 } },
  { id: 'position-left', name: 'Left corner', position: { eyeHeight: 1.68, behindBaseline: 1.4, lateral: 2.6 } },
  { id: 'position-net', name: 'At the net', position: { eyeHeight: 1.66, behindBaseline: -6.7, lateral: -0.4 } },
  { id: 'position-overhead', name: 'Overhead', position: { eyeHeight: 1.7, behindBaseline: -3.2, lateral: 0 } },
];

export const DEFAULT_PERSPECTIVE_PRESETS: readonly PerspectivePresetV1[] = [
  { id: 'perspective-natural', name: 'Natural', perspective: { yaw: 0, pitch: -1.7, fov: 70 } },
  { id: 'perspective-wide', name: 'Wide', perspective: { yaw: 0, pitch: -1.7, fov: 84 } },
  { id: 'perspective-focus', name: 'Focused', perspective: { yaw: 0, pitch: -0.8, fov: 58 } },
];

export type AppDataV1 = Readonly<{
  schemaVersion: 1;
  customDrills: readonly DrillDefinitionV1[];
  cameraPositionPresets: readonly CameraPositionPresetV1[];
  perspectivePresets: readonly PerspectivePresetV1[];
  preferences: PracticePreferencesV1;
}>;

export type PracticePreferencesV1 = Readonly<{
  sessionCategory: string;
  trajectoryEnabled: boolean;
  pace: number;
  interval: number;
  repetitions: number;
  variation: number;
  timingVariation: number;
  workBlockSize: number;
  restSeconds: number;
  surface: SurfaceId;
  shotType: PracticeShotType;
  spin: SpinKind;
  bounceFactor: number;
  opponentHand: 'left' | 'right';
  serveRhythm: 'preset' | 'normal' | 'compact';
  netClearanceM: number;
  landingDepthM: number;
  aimDirectionDeg: number;
  opponentPosition: Readonly<{ x: number; z: number }>;
  camera: CameraConfiguration;
  environment: EnvironmentConfiguration;
  quality: QualityMode;
  screenWidthCm: number;
  screenHeightCm: number;
  viewDistanceCm: number;
}>;

export const DEFAULT_PREFERENCES: PracticePreferencesV1 = {
  sessionCategory: 'Quick Rally', trajectoryEnabled: false, pace: 68, interval: 3.2, repetitions: 12, variation: 8, timingVariation: 0,
  workBlockSize: 4, restSeconds: 20, surface: 'hard', shotType: 'groundstroke', spin: 'topspin', bounceFactor: 1,
  opponentHand: 'right', serveRhythm: 'preset', netClearanceM: 0.36, landingDepthM: 9.5,
  aimDirectionDeg: 0, opponentPosition: { x: 0, z: 11.235 },
  camera: { eyeHeight: 1.7, behindBaseline: 1.5, lateral: 0, yaw: 0, pitch: -1.7, fov: 70 },
  environment: DEFAULT_ENVIRONMENT, quality: 'auto', screenWidthCm: 120, screenHeightCm: 67.5, viewDistanceCm: 250,
};

export const DEFAULT_APP_DATA: AppDataV1 = {
  schemaVersion: 1,
  customDrills: [],
  cameraPositionPresets: DEFAULT_CAMERA_POSITION_PRESETS,
  perspectivePresets: DEFAULT_PERSPECTIVE_PRESETS,
  preferences: DEFAULT_PREFERENCES,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizePlayerViewCameraPreset = (preset: CameraPositionPresetV1): CameraPositionPresetV1 => (
  preset.id === 'position-left'
  && preset.name === 'Left corner'
  && preset.position.eyeHeight === 1.68
  && preset.position.behindBaseline === 1.4
  && preset.position.lateral === -2.6
    ? { ...preset, position: { ...preset.position, lateral: 2.6 } }
    : preset
);

export const loadAppData = (): AppDataV1 => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<AppDataV1>;
    if (parsed.schemaVersion !== 1) return DEFAULT_APP_DATA;
    const customDrills = Array.isArray(parsed.customDrills)
      ? parsed.customDrills.filter((drill) => validateDrill(drill).valid)
      : [];
    const legacyViews = Array.isArray((parsed as Partial<AppDataV1> & { savedViews?: unknown }).savedViews)
      ? ((parsed as Partial<AppDataV1> & { savedViews?: unknown[] }).savedViews ?? []).filter((view): view is SavedViewV1 => Boolean(view && typeof view === 'object' && 'id' in view && 'name' in view && 'camera' in view))
      : [];
    const cameraPositionPresets = Array.isArray(parsed.cameraPositionPresets) && parsed.cameraPositionPresets.length
      ? parsed.cameraPositionPresets.map(normalizePlayerViewCameraPreset)
      : legacyViews.length
        ? legacyViews.map((view) => ({ id: `position-${view.id}`, name: view.name, position: { eyeHeight: view.camera.eyeHeight, behindBaseline: view.camera.behindBaseline, lateral: view.camera.lateral } }))
        : DEFAULT_CAMERA_POSITION_PRESETS;
    const perspectivePresets = Array.isArray(parsed.perspectivePresets) && parsed.perspectivePresets.length
      ? parsed.perspectivePresets
      : legacyViews.length
        ? legacyViews.map((view) => ({ id: `perspective-${view.id}`, name: view.name, perspective: { yaw: view.camera.yaw, pitch: view.camera.pitch, fov: view.camera.fov } }))
        : DEFAULT_PERSPECTIVE_PRESETS;
    const candidate: Record<string, unknown> = isRecord(parsed.preferences) ? parsed.preferences : {};
    const camera = isRecord(candidate.camera) ? { ...DEFAULT_PREFERENCES.camera, ...candidate.camera } : DEFAULT_PREFERENCES.camera;
    const environment = normalizeEnvironmentConfiguration(candidate.environment);
    const savedSurface = candidate.surface === 'hard' || candidate.surface === 'clay' || candidate.surface === 'grass'
      ? candidate.surface
      : candidate.physicsSurface === 'hard' || candidate.physicsSurface === 'clay' || candidate.physicsSurface === 'grass'
        ? candidate.physicsSurface
      : candidate.visualSurface === 'hard' || candidate.visualSurface === 'clay' || candidate.visualSurface === 'grass'
        ? candidate.visualSurface
        : DEFAULT_PREFERENCES.surface;
    const canonicalCandidate = { ...candidate };
    delete canonicalCandidate.physicsSurface;
    delete canonicalCandidate.visualSurface;
    const shotType = isPracticeShotType(candidate.shotType)
      ? candidate.shotType
      : candidate.sessionCategory === 'Return Practice'
        ? 'serve'
        : candidate.sessionCategory === 'Serve & Volley'
          ? 'volley'
          : candidate.sessionCategory === 'Net & Overhead'
            ? 'lob'
          : DEFAULT_PREFERENCES.shotType;
    const shotProfile = PRACTICE_SHOT_PROFILES[shotType];
    const depthRange = shotProfile.landingDepthRangeM;
    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...canonicalCandidate,
      trajectoryEnabled: typeof candidate.trajectoryEnabled === 'boolean' ? candidate.trajectoryEnabled : candidate.mode === 'learning',
      surface: savedSurface,
      shotType,
      spin: spinForPracticeShot(shotType, candidate.spin),
      pace: typeof candidate.pace === 'number'
        ? Math.min(shotProfile.paceRangeKmh.max, Math.max(shotProfile.paceRangeKmh.min, candidate.pace))
        : shotProfile.defaultPaceKmh,
      netClearanceM: typeof candidate.netClearanceM === 'number'
        ? Math.min(shotProfile.netClearanceRangeM.max, Math.max(shotProfile.netClearanceRangeM.min, candidate.netClearanceM))
        : shotProfile.defaultNetClearanceM,
      bounceFactor: typeof candidate.bounceFactor === 'number'
        ? Math.min(1.4, Math.max(0.6, candidate.bounceFactor))
        : DEFAULT_PREFERENCES.bounceFactor,
      landingDepthM: typeof candidate.landingDepthM === 'number'
        ? Math.min(depthRange.max, Math.max(depthRange.min, candidate.landingDepthM))
        : shotProfile.defaultLandingDepthM,
      camera,
      environment,
    } as PracticePreferencesV1;
    return { schemaVersion: 1, customDrills, cameraPositionPresets, perspectivePresets, preferences };
  } catch {
    return DEFAULT_APP_DATA;
  }
};

export const saveAppData = (data: AppDataV1): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
