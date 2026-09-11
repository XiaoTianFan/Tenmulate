import { normalizeLandingZone, type LandingZone, type LandingZoneSize } from '../engine/trajectory/landingZone';
import { DEFAULT_RETURN_LANDING_ZONE, isReturnLandingZone } from '../engine/session/returnLandingZone';
import { defaultReturnShot, normalizeReturnShot } from '../engine/session/returnShot';
import type { ContactTiming, ReturnShotConfiguration } from '../content/types';
import { normalizeContactTiming } from '../engine/session/bounceContact';
import { DEFAULT_BALL_FOCUS, normalizeBallFocus, type BallFocusSettings } from '../engine/rendering/ballFocus';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { QualityMode } from '../engine/rendering/TennisScene';
import type { DrillDefinitionV1, DrillDefinitionV2, SavedShotV2 } from '../content/types';
import { migratePlayerDrill, migratePlayerSavedShot } from '../content/playerMigration';
import { isPlayerDrill, isPlayerSavedShot } from '../content/playerValidation';
import { isSavedShot, validateDrill } from '../content/validation';
import { AD_SERVE_OPPONENT_POSITION, COURT, DEFAULT_RALLY_OPPONENT_POSITION, DEUCE_SERVE_OPPONENT_POSITION, clampOpponentPosition, type SurfaceId } from '../domain/court';
import { DEFAULT_ENVIRONMENT, normalizeEnvironmentConfiguration, type EnvironmentConfiguration } from '../domain/environment';
import type { SpinKind } from '../engine/trajectory/physics';
import { normalizeRhythm, normalizeShotInterval, rhythmFromLegacyInterval } from '../engine/session/rhythm';
import { PRACTICE_SHOT_PROFILES, isPracticeShotType, spinForPracticeShot, spinRateForPracticeShot, type PracticeShotType } from '../engine/trajectory/practiceProfiles';

const STORAGE_KEY = 'tenmulate.appData.v2';
const LEGACY_STORAGE_KEY = 'tenmulate.appData.v1';
let storageNotice = '';
export const appStorageNotice = () => storageNotice;

export type SavedViewV1 = Readonly<{
  id: string;
  name: string;
  camera: CameraConfiguration;
}>;

export type CameraPosition = Readonly<Pick<CameraConfiguration, 'eyeHeight' | 'behindBaseline' | 'lateral'>>;
export type PerspectiveConfiguration = Readonly<Pick<CameraConfiguration, 'yaw' | 'pitch' | 'fov'>>;
export type CameraPositionPresetV1 = Readonly<{ id: string; name: string; position: CameraPosition; lookAt?: Readonly<{ x: number; y: number; z: number }> }>;
export type PerspectivePresetV1 = Readonly<{ id: string; name: string; perspective: PerspectiveConfiguration }>;

export const DEFAULT_CAMERA_POSITION_PRESETS: readonly CameraPositionPresetV1[] = [
  { id: 'position-baseline', name: 'Baseline', position: { eyeHeight: 1.7, behindBaseline: 1.5, lateral: 0 } },
  { id: 'position-left', name: 'Left corner', position: { eyeHeight: 1.68, behindBaseline: 2.8, lateral: 3.6 }, lookAt: { x: 0, y: 0, z: COURT.halfLength } },
  { id: 'position-right', name: 'Right corner', position: { eyeHeight: 1.68, behindBaseline: 2.8, lateral: -3.6 }, lookAt: { x: 0, y: 0, z: COURT.halfLength } },
  { id: 'position-net', name: 'At the net', position: { eyeHeight: 1.66, behindBaseline: COURT.serviceLineFromNet - 1 - COURT.halfLength, lateral: 0 }, lookAt: { x: 0, y: 0, z: COURT.halfLength } },
  { id: 'position-overhead', name: 'Overhead', position: { eyeHeight: 1.7, behindBaseline: -3.2, lateral: 0 } },
];

export const DEFAULT_PERSPECTIVE_PRESETS: readonly PerspectivePresetV1[] = [
  { id: 'perspective-natural', name: 'Natural', perspective: { yaw: 0, pitch: -1.7, fov: 70 } },
  { id: 'perspective-wide', name: 'Wide', perspective: { yaw: 0, pitch: -1.7, fov: 84 } },
  { id: 'perspective-focus', name: 'Focused', perspective: { yaw: 0, pitch: -0.8, fov: 58 } },
];

export type AppDataV2 = Readonly<{
  schemaVersion: 2;
  drillPlayerHand: 'left' | 'right';
  customDrills: readonly DrillDefinitionV2[];
  savedShots: readonly SavedShotV2[];
  cameraPositionPresets: readonly CameraPositionPresetV1[];
  perspectivePresets: readonly PerspectivePresetV1[];
  preferences: PracticePreferencesV1;
}>;

export type PracticePreferencesV1 = Readonly<{
  ballFocus: BallFocusSettings;
  sessionCategory: string;
  trajectoryEnabled: boolean;
  launchSpeedKmh: number;
  interval: number;
  rhythmPercent: number;
  movementPercent: number;
  practiceStroke: 'forehand' | 'backhand' | 'auto';
  trajectoryMode: 'natural' | 'exact';
  returnTargetMode: 'pattern' | 'custom';
  repetitions: number;
  variation: number;
  timingVariation: number;
  workBlockSize: number;
  restSeconds: number;
  surface: SurfaceId;
  shotType: PracticeShotType;
  spin: SpinKind;
  spinRateRpm: number;
  bounceFactor: number;
  opponentHand: 'left' | 'right';
  serveRhythm: 'normal' | 'compact';
  landingDepthM: number;
  landingZone: LandingZoneSize;
  rallyLandingZone: LandingZone;
  rallyShot: ReturnShotConfiguration;
  opponentContactTiming: ContactTiming;
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
  ballFocus: DEFAULT_BALL_FOCUS,
  sessionCategory: 'Quick Rally', trajectoryEnabled: true, launchSpeedKmh: 70, interval: 5, rhythmPercent: 100, movementPercent: 100, practiceStroke: 'auto', trajectoryMode: 'natural', returnTargetMode: 'pattern', repetitions: 12, variation: 8, timingVariation: 0,
  workBlockSize: 4, restSeconds: 20, surface: 'hard', shotType: 'groundstroke', spin: 'topspin', spinRateRpm: 1103, bounceFactor: 1,
  opponentHand: 'right', serveRhythm: 'normal', landingDepthM: 8.5,
  landingZone: { width: 1.6, depth: 2 },
  rallyLandingZone: DEFAULT_RETURN_LANDING_ZONE, rallyShot: defaultReturnShot('groundstroke'),
  opponentContactTiming: 'descent',
  aimDirectionDeg: 0, opponentPosition: DEFAULT_RALLY_OPPONENT_POSITION,
  camera: { eyeHeight: 1.7, behindBaseline: 1.5, lateral: 0, yaw: 0, pitch: -1.7, fov: 70 },
  environment: DEFAULT_ENVIRONMENT, quality: 'auto', screenWidthCm: 120, screenHeightCm: 67.5, viewDistanceCm: 250,
};

export const DEFAULT_APP_DATA: AppDataV2 = {
  schemaVersion: 2,
  drillPlayerHand: 'right',
  customDrills: [],
  savedShots: [],
  cameraPositionPresets: DEFAULT_CAMERA_POSITION_PRESETS,
  perspectivePresets: DEFAULT_PERSPECTIVE_PRESETS,
  preferences: DEFAULT_PREFERENCES,
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizePlayerViewCameraPreset = (preset: CameraPositionPresetV1): CameraPositionPresetV1 => {
  const current = DEFAULT_CAMERA_POSITION_PRESETS.find(item => item.id === preset.id && item.name === preset.name);
  if (!current || preset.lookAt) return preset;
  const p = preset.position;
  const oldCorner = (preset.id === 'position-left' || preset.id === 'position-right')
    && p.eyeHeight === 1.68 && p.behindBaseline === 1.4
    && (preset.id === 'position-left' ? Math.abs(p.lateral) === 2.6 : p.lateral === -2.6);
  const oldNet = preset.id === 'position-net' && p.eyeHeight === 1.66 && p.behindBaseline === -6.7 && p.lateral === -.4;
  // Only untouched shipped values migrate. Owner-created/edited positions survive.
  return oldCorner || oldNet ? current : preset;
};

const addRightCornerToLegacyBuiltIns = (presets: readonly CameraPositionPresetV1[]): readonly CameraPositionPresetV1[] => {
  if (presets.some((preset) => preset.id === 'position-right')) return presets;
  const isLegacyBuiltInSet = ['position-baseline', 'position-left', 'position-net', 'position-overhead']
    .every((id) => presets.some((preset) => preset.id === id));
  const rightCorner = DEFAULT_CAMERA_POSITION_PRESETS.find((preset) => preset.id === 'position-right');
  if (!isLegacyBuiltInSet || !rightCorner) return presets;
  const leftIndex = presets.findIndex((preset) => preset.id === 'position-left');
  return [...presets.slice(0, leftIndex + 1), rightCorner, ...presets.slice(leftIndex + 1)];
};

export const loadAppData = (): AppDataV2 => {
  try {
    storageNotice = '';
    const current = localStorage.getItem(STORAGE_KEY);
    const raw = current ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<Omit<AppDataV2, "schemaVersion">> & {schemaVersion?:number};
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) return DEFAULT_APP_DATA;
    let skipped = 0;
    const customDrills: DrillDefinitionV2[] = [];
    for (const item of Array.isArray(parsed.customDrills) ? parsed.customDrills : []) {
      try {
        const drill = isPlayerDrill(item) ? migratePlayerDrill(item) : validateDrill(item).valid ? migratePlayerDrill(item as unknown as DrillDefinitionV1) : null;
        if (drill && isPlayerDrill(drill)) customDrills.push(drill); else skipped++;
      } catch { skipped++; }
    }
    const legacyViews = Array.isArray((parsed as Partial<AppDataV2> & { savedViews?: unknown }).savedViews)
      ? ((parsed as Partial<AppDataV2> & { savedViews?: unknown[] }).savedViews ?? []).filter((view): view is SavedViewV1 => Boolean(view && typeof view === 'object' && 'id' in view && 'name' in view && 'camera' in view))
      : [];
    const cameraPositionPresets = Array.isArray(parsed.cameraPositionPresets) && parsed.cameraPositionPresets.length
      ? addRightCornerToLegacyBuiltIns(parsed.cameraPositionPresets.map(normalizePlayerViewCameraPreset))
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
    delete canonicalCandidate.pace;
    delete canonicalCandidate.netClearanceM;
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
    const spin = spinForPracticeShot(shotType, candidate.spin);
    const storedOpponentPosition = isRecord(candidate.opponentPosition)
      && typeof candidate.opponentPosition.x === 'number' && Number.isFinite(candidate.opponentPosition.x)
      && typeof candidate.opponentPosition.z === 'number' && Number.isFinite(candidate.opponentPosition.z)
      ? { x: candidate.opponentPosition.x, z: candidate.opponentPosition.z }
      : shotProfile.opponentPosition;
    const opponentPosition = shotType === 'groundstroke'
      && storedOpponentPosition.x === 0 && storedOpponentPosition.z === 11.235
      ? DEFAULT_RALLY_OPPONENT_POSITION
      : shotType === 'serve' && Math.abs(storedOpponentPosition.x) === 1.25 && storedOpponentPosition.z === COURT.halfLength - 0.18
        ? storedOpponentPosition.x < 0 ? AD_SERVE_OPPONENT_POSITION : DEUCE_SERVE_OPPONENT_POSITION
        : clampOpponentPosition(storedOpponentPosition);
    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...canonicalCandidate,
      ballFocus: normalizeBallFocus(candidate.ballFocus),
      serveRhythm: candidate.serveRhythm === 'compact' ? 'compact' : 'normal',
      trajectoryEnabled: typeof candidate.trajectoryEnabled === 'boolean'
        ? candidate.trajectoryEnabled
        : candidate.mode === 'learning'
          ? true
          : candidate.mode === 'rehearsal'
            ? false
            : DEFAULT_PREFERENCES.trajectoryEnabled,
      surface: savedSurface,
      rhythmPercent: normalizeRhythm(candidate.rhythmPercent ?? rhythmFromLegacyInterval(candidate.interval)),
      interval: normalizeShotInterval(candidate.interval),
      movementPercent: normalizeRhythm(candidate.movementPercent),
      practiceStroke: candidate.practiceStroke === 'forehand' || candidate.practiceStroke === 'backhand' ? candidate.practiceStroke : 'auto',
      trajectoryMode: candidate.trajectoryMode === 'exact' ? 'exact' : 'natural',
      returnTargetMode: candidate.returnTargetMode === 'custom' ? 'custom' : 'pattern',
      shotType,
      spin,
      spinRateRpm: spinRateForPracticeShot(shotType, spin, candidate.spinRateRpm),
      launchSpeedKmh: typeof candidate.launchSpeedKmh === 'number'
        ? Math.min(shotProfile.launchSpeedRangeKmh.max, Math.max(shotProfile.launchSpeedRangeKmh.min, candidate.launchSpeedKmh))
        : typeof candidate.pace === 'number'
          ? Math.min(shotProfile.launchSpeedRangeKmh.max, Math.max(shotProfile.launchSpeedRangeKmh.min, candidate.pace))
          : shotProfile.defaultLaunchSpeedKmh,
      bounceFactor: typeof candidate.bounceFactor === 'number'
        ? Math.min(1.4, Math.max(0.6, candidate.bounceFactor))
        : DEFAULT_PREFERENCES.bounceFactor,
      landingZone: normalizeLandingZone(candidate.landingZone, shotType),
      rallyLandingZone: isReturnLandingZone(candidate.rallyLandingZone) ? candidate.rallyLandingZone : DEFAULT_RETURN_LANDING_ZONE,
      rallyShot: normalizeReturnShot(candidate.rallyShot),
      opponentContactTiming: normalizeContactTiming(candidate.opponentContactTiming),
      landingDepthM: typeof candidate.landingDepthM === 'number'
        ? Math.min(depthRange.max, Math.max(depthRange.min, candidate.landingDepthM))
        : shotProfile.defaultLandingDepthM,
      opponentPosition,
      camera,
      environment,
    } as PracticePreferencesV1;
    const savedShots: SavedShotV2[] = [];
    for (const item of Array.isArray(parsed.savedShots) ? parsed.savedShots : []) {
      try {
        const shot = isPlayerSavedShot(item) ? migratePlayerSavedShot(item) : isSavedShot(item) ? migratePlayerSavedShot(item) : null;
        if (shot && isPlayerSavedShot(shot)) savedShots.push(shot); else skipped++;
      } catch { skipped++; }
    }
    if (!current && (customDrills.length || savedShots.length || skipped)) storageNotice = `Saved drills and shots now use the player's perspective. Original data is retained in this browser.${skipped ? ` ${skipped} legacy item(s) need manual repair before import.` : ''}`;
    return { schemaVersion: 2, drillPlayerHand: parsed.drillPlayerHand === 'left' ? 'left' : 'right', customDrills, savedShots, cameraPositionPresets, perspectivePresets, preferences };
  } catch {
    return DEFAULT_APP_DATA;
  }
};

export const saveAppData = (data: AppDataV2): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
