import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { QualityMode } from '../engine/rendering/TennisScene';
import type { DrillDefinitionV1 } from '../content/types';
import { validateDrill } from '../content/validation';
import type { SurfaceId } from '../domain/court';
import { DEFAULT_ENVIRONMENT, type EnvironmentConfiguration } from '../domain/environment';
import type { PracticeMode } from '../app/types';
import type { SpinKind } from '../engine/trajectory/physics';

const STORAGE_KEY = 'tenmulate.appData.v1';

export type SavedViewV1 = Readonly<{
  id: string;
  name: string;
  camera: CameraConfiguration;
}>;

export type AppDataV1 = Readonly<{
  schemaVersion: 1;
  customDrills: readonly DrillDefinitionV1[];
  savedViews: readonly SavedViewV1[];
  preferences: PracticePreferencesV1;
}>;

export type PracticePreferencesV1 = Readonly<{
  sessionCategory: string;
  mode: PracticeMode;
  pace: number;
  interval: number;
  repetitions: number;
  variation: number;
  timingVariation: number;
  workBlockSize: number;
  restSeconds: number;
  visualSurface: SurfaceId;
  physicsSurface: SurfaceId;
  spin: 'preset' | SpinKind;
  opponentHand: 'left' | 'right';
  serveRhythm: 'preset' | 'normal' | 'compact';
  netClearanceM: number;
  camera: CameraConfiguration;
  environment: EnvironmentConfiguration;
  quality: QualityMode;
  screenWidthCm: number;
  screenHeightCm: number;
  viewDistanceCm: number;
}>;

export const DEFAULT_PREFERENCES: PracticePreferencesV1 = {
  sessionCategory: 'Quick Rally', mode: 'rehearsal', pace: 78, interval: 3.2, repetitions: 12, variation: 8, timingVariation: 0,
  workBlockSize: 4, restSeconds: 20, visualSurface: 'hard', physicsSurface: 'hard', spin: 'preset', opponentHand: 'right', serveRhythm: 'preset', netClearanceM: 0.24,
  camera: { eyeHeight: 1.7, behindBaseline: 1.5, lateral: 0, yaw: 0, pitch: -1.7, fov: 70 },
  environment: DEFAULT_ENVIRONMENT, quality: 'auto', screenWidthCm: 120, screenHeightCm: 67.5, viewDistanceCm: 250,
};

export const DEFAULT_APP_DATA: AppDataV1 = {
  schemaVersion: 1,
  customDrills: [],
  savedViews: [],
  preferences: DEFAULT_PREFERENCES,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const loadAppData = (): AppDataV1 => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<AppDataV1>;
    if (parsed.schemaVersion !== 1) return DEFAULT_APP_DATA;
    const customDrills = Array.isArray(parsed.customDrills)
      ? parsed.customDrills.filter((drill) => validateDrill(drill).valid)
      : [];
    const savedViews = Array.isArray(parsed.savedViews)
      ? parsed.savedViews.filter((view): view is SavedViewV1 => Boolean(view && typeof view.id === 'string' && typeof view.name === 'string' && view.camera))
      : [];
    const candidate: Record<string, unknown> = isRecord(parsed.preferences) ? parsed.preferences : {};
    const camera = isRecord(candidate.camera) ? { ...DEFAULT_PREFERENCES.camera, ...candidate.camera } : DEFAULT_PREFERENCES.camera;
    const environment = isRecord(candidate.environment) ? { ...DEFAULT_PREFERENCES.environment, ...candidate.environment } : DEFAULT_PREFERENCES.environment;
    const legacySurface = candidate.surface === 'hard' || candidate.surface === 'clay' || candidate.surface === 'grass'
      ? candidate.surface
      : undefined;
    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...candidate,
      visualSurface: candidate.visualSurface ?? legacySurface ?? DEFAULT_PREFERENCES.visualSurface,
      physicsSurface: candidate.physicsSurface ?? legacySurface ?? DEFAULT_PREFERENCES.physicsSurface,
      camera,
      environment,
    } as PracticePreferencesV1;
    return { schemaVersion: 1, customDrills, savedViews, preferences };
  } catch {
    return DEFAULT_APP_DATA;
  }
};

export const saveAppData = (data: AppDataV1): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
