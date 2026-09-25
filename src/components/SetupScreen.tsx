import { practiceDefaults } from '../app/practiceDefaults';

import { AudioSettings } from './AudioSettings';
import { usePreviewAudio } from '../hooks/usePreviewAudio';
import { t, message as translateMessage } from '../i18n/locale';
import { SaveCancelled } from '../storage/savePolicy';
import { RangeField } from './RangeField';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, Eye, Gauge, MapPin, Play, Save, RotateCcw, Target, Trophy, UserRound } from 'lucide-react';
import { DRILL_BY_CATEGORY } from '../content/bundled';
import type { SessionCategory } from '../content/types';
import { CAMERA_FOV_MAX, CAMERA_FOV_MIN, clampCameraFov, type CameraLook } from '../domain/camera';
import { CAMERA_EYE_HEIGHT_MAX, CAMERA_EYE_HEIGHT_MIN, DEFAULT_RALLY_OPPONENT_POSITION, cameraHeightMovementKey, cameraMovementForKeys, isCameraHeightShortcut, type CameraMoveKey, type SurfaceId } from '../domain/court';
import { DEFAULT_ENVIRONMENT, SCENE_DEFINITIONS, VENUE_LABELS, isOutdoorVenue, windVelocityFromEnvironment, type AudienceOccupancy, type EnvironmentConfiguration, type LightingPreset, type VenueId, type WeatherCondition } from '../domain/environment';
import { RETURN_SERVE_PATTERN, RETURN_SERVE_PLACEMENT_LABELS, returnReceiverSideForCameraPreset, returnServerPosition, type ReturnReceiverSide } from '../domain/returnPractice';
import type { CameraConfiguration, QualityMode, SceneMetrics } from '../engine/rendering/TennisScene';
import type { CompiledRepetition, CompiledSession } from '../engine/session/compileSession';
import { compilePracticeAsync } from '../engine/session/practiceSessionClient';
import { usePracticePreview } from '../hooks/usePracticePreview';
import { useCourtOverview } from '../hooks/useCourtOverview';
import { defaultReturnShot } from '../engine/session/returnShot';
import { practiceReturnType } from '../engine/session/practiceReturn';
import { OVERHEAD_PRACTICE_OPPONENT, QUICK_PRACTICE_VIEWS } from '../domain/practiceViews';
import { ContactTimingControl } from './ContactTimingControl';
import { aimDirectionToCourtPoint, type SpinKind } from '../engine/trajectory/physics';
import { PRACTICE_SHOT_PROFILES, legalServeTarget, practiceLandingTarget, spinForPracticeShot, spinRateForPracticeShot, spinRateProfileForPracticeShot, type PracticeShotType } from '../engine/trajectory/practiceProfiles';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import type { SessionLaunch } from '../app/types';
import { DEFAULT_CAMERA_POSITION_PRESETS, DEFAULT_PERSPECTIVE_PRESETS, type CameraPositionPresetV1, type PerspectivePresetV1, type PracticePreferencesV1 } from '../storage/appStorage';
import { useCameraKeyboardLock } from '../hooks/useCameraKeyboardLock';
import { AppHeader, type AppRoute } from './AppHeader';
import type { CourtPoint } from './CourtPlan';
import { Modal } from './Modal';
import { CourtViewport } from './SharedCourt';
import { BallFocusControls } from './BallFocusControls';
import { landingZoneCenter, resolveLandingZone, type LandingZone } from '../engine/trajectory/landingZone';
import { cameraLookAtCourtPoint } from '../domain/camera';

type PracticePresetId = 'rally' | 'return' | 'volley' | 'overhead';
type DialogId = 'safety' | 'display' | 'new-position' | 'new-perspective' | null;

export const PRACTICE_PRESETS: ReadonlyArray<{
  id: PracticePresetId;
  label: string;
  category: SessionCategory;
  icon: typeof Activity;
  cameraPresetId: string;
  opponent: CourtPoint;
  shotType: PracticeShotType;
  returnReceiverSide?: ReturnReceiverSide;
}> = [
  { id: 'rally', label: 'Rally', category: 'Quick Rally', icon: Activity, cameraPresetId: 'position-baseline', opponent: DEFAULT_RALLY_OPPONENT_POSITION, shotType: 'groundstroke' },
  { id: 'return', label: 'Return', category: 'Return Practice', icon: Target, cameraPresetId: 'position-left', opponent: returnServerPosition('left'), shotType: 'serve', returnReceiverSide: 'left' },
  { id: 'volley', label: 'Volley', category: 'Serve & Volley', icon: Trophy, cameraPresetId: 'position-net', opponent: DEFAULT_RALLY_OPPONENT_POSITION, shotType: 'groundstroke' },
  { id: 'overhead', label: 'Overhead', category: 'Net & Overhead', icon: Gauge, cameraPresetId: 'position-overhead', opponent: OVERHEAD_PRACTICE_OPPONENT, shotType: 'lob' },
];

const OUTDOOR_TIME_BY_LIGHTING: Readonly<Record<'day' | 'golden-hour' | 'night', number>> = {
  day: 14,
  'golden-hour': 18.5,
  night: 21.5,
};

const practiceSpinLabel = (shotType: PracticeShotType, spin: SpinKind): string => (
  shotType === 'groundstroke' && spin === 'flat'
      ? 'Flat drive'
      : spin === 'topspin' ? 'Topspin' : `${spin[0]?.toUpperCase()}${spin.slice(1)}`
);

function SetupSection({ title, subtitle, open = false, children }: Readonly<{ title: string; subtitle: string; open?: boolean; children: ReactNode }>) {
  return (
    <details className="setup-section" open={open}>
      <summary><span>{title}</span><small>{subtitle}</small></summary>
      <div className="setup-section-body">{children}</div>
    </details>
  );
}

type SetupScreenProps = Readonly<{
  route: AppRoute;
  cameraPositionPresets: readonly CameraPositionPresetV1[];
  perspectivePresets: readonly PerspectivePresetV1[];
  initialPreferences: PracticePreferencesV1;
  onRoute: (route: AppRoute) => void;
  onStart: (launch: SessionLaunch) => void;
  onSaveCameraPositionPreset: (preset: CameraPositionPresetV1) => Promise<void>;
  onSavePerspectivePreset: (preset: PerspectivePresetV1) => Promise<void>;
  onRestoreBallFocus: (value: PracticePreferencesV1['ballFocus']) => void;
  onSaveConfig: (preferences: Omit<PracticePreferencesV1, 'ballFocus'>) => Promise<void>;
  practiceConfigs: Record<string, PracticePreferencesV1>;
  projectPracticeConfigs: Record<string, PracticePreferencesV1>;
  onPreferencesChange: (preferences: Omit<PracticePreferencesV1, 'ballFocus'>) => void;
}>;

export function SetupScreen({ route, cameraPositionPresets = DEFAULT_CAMERA_POSITION_PRESETS, perspectivePresets = DEFAULT_PERSPECTIVE_PRESETS, initialPreferences, practiceConfigs, projectPracticeConfigs, onSaveConfig, onRestoreBallFocus, onRoute, onStart, onSaveCameraPositionPreset, onSavePerspectivePreset, onPreferencesChange }: SetupScreenProps) {
  const legacyInitialPreferences = initialPreferences as PracticePreferencesV1 & { physicsSurface?: SurfaceId; visualSurface?: SurfaceId };
  const initialPractice = PRACTICE_PRESETS.find((preset) => preset.category === initialPreferences.sessionCategory) ?? PRACTICE_PRESETS[0]!;
  const initialPositionPreset = cameraPositionPresets.find((preset) => (
    preset.position.eyeHeight === initialPreferences.camera.eyeHeight
    && preset.position.behindBaseline === initialPreferences.camera.behindBaseline
    && preset.position.lateral === initialPreferences.camera.lateral
  ));
  const [practicePreset, setPracticePreset] = useState<PracticePresetId>(initialPractice.id);
  const [overview, setOverview] = useState(false);
  const [launching, setLaunching] = useState(false), [launchError, setLaunchError] = useState('');
  const launchCalculation = useRef<AbortController | null>(null);
  useEffect(() => () => launchCalculation.current?.abort(), []);
  const [rallyLandingZone, setRallyLandingZone] = useState(initialPreferences.rallyLandingZone);
  const rallyShot = useMemo(() => defaultReturnShot('groundstroke'), []);
  const [opponentContactTiming, setOpponentContactTiming] = useState(initialPreferences.opponentContactTiming);
  const [sessionCategory, setSessionCategory] = useState<SessionCategory>(initialPractice.category);
  const [trajectoryEnabled, setTrajectoryEnabled] = useState(initialPreferences.trajectoryEnabled ?? false);
  const [launchSpeedKmh, setLaunchSpeedKmh] = useState(initialPreferences.launchSpeedKmh);
  const [rhythmPercent, setRhythmPercent] = useState(initialPreferences.rhythmPercent);
  const [interval, setInterval] = useState(initialPreferences.interval);
  const [movementPercent, setMovementPercent] = useState(initialPreferences.movementPercent);
  const [practiceStroke, setPracticeStroke] = useState(initialPreferences.practiceStroke);
  const [trajectoryMode, setTrajectoryMode] = useState(initialPreferences.trajectoryMode);
  const [returnTargetMode, setReturnTargetMode] = useState(initialPreferences.returnTargetMode);
  const [repetitions, setRepetitions] = useState(initialPreferences.repetitions);
  const [variation, setVariation] = useState(initialPreferences.variation);
  const [timingVariation, setTimingVariation] = useState(initialPreferences.timingVariation);
  const [workBlockSize, setWorkBlockSize] = useState(initialPreferences.workBlockSize);
  const [restSeconds, setRestSeconds] = useState(initialPreferences.restSeconds);
  const [surface, setSurface] = useState<SurfaceId>(() => legacyInitialPreferences.surface ?? legacyInitialPreferences.physicsSurface ?? legacyInitialPreferences.visualSurface ?? 'hard');
  const [shotType, setShotType] = useState<PracticeShotType>(initialPreferences.shotType);
  const [spin, setSpin] = useState<SpinKind>(() => spinForPracticeShot(initialPreferences.shotType, initialPreferences.spin));
  const [spinRateRpm, setSpinRateRpm] = useState(initialPreferences.spinRateRpm);
  const [bounceFactor, setBounceFactor] = useState(initialPreferences.bounceFactor);
  const [opponentHand, setOpponentHand] = useState<'left' | 'right'>(initialPreferences.opponentHand);
  const [serveRhythm, setServeRhythm] = useState<'normal' | 'compact'>(initialPreferences.serveRhythm);
  const [landingZone, setLandingZone] = useState(initialPreferences.landingZone);
  const [landingDepthM, setLandingDepthM] = useState(initialPreferences.landingDepthM);
  const [aimDirectionDeg, setAimDirectionDeg] = useState(initialPreferences.aimDirectionDeg ?? 0);
  const [returnReceiverSide, setReturnReceiverSide] = useState<ReturnReceiverSide>(() => (
    initialPractice.id === 'return' && initialPreferences.camera.lateral < 0 ? 'right' : initialPractice.returnReceiverSide ?? 'left'
  ));
  const [returnPreviewIndex, setReturnPreviewIndex] = useState(0);
  const [previewRepetition, setPreviewRepetition] = useState<{ session: CompiledSession; repetition: CompiledRepetition } | null>(null);
  const [opponentPosition, setOpponentPosition] = useState<CourtPoint>(initialPreferences.opponentPosition ?? initialPractice.opponent);
  const [venue, setVenue] = useState<VenueId>(initialPreferences.environment.venue);
  const [audience, setAudience] = useState<AudienceOccupancy>(initialPreferences.environment.audience ?? DEFAULT_ENVIRONMENT.audience);
  const [lighting, setLighting] = useState<LightingPreset>(initialPreferences.environment.lighting);
  const [lightDirection, setLightDirection] = useState(initialPreferences.environment.lightDirection);
  const [lightIntensity, setLightIntensity] = useState(initialPreferences.environment.lightIntensity);
  const [timeOfDay, setTimeOfDay] = useState(initialPreferences.environment.timeOfDay);
  const [weather, setWeather] = useState<WeatherCondition>(initialPreferences.environment.weather);
  const [weatherIntensity, setWeatherIntensity] = useState(initialPreferences.environment.weatherIntensity);
  const [windDirection, setWindDirection] = useState(initialPreferences.environment.windDirection);
  const [windSpeedMps, setWindSpeedMps] = useState(initialPreferences.environment.windSpeedMps);
  const [seed, setSeed] = useState(initialPreferences.seed ?? '18427');
  const [eyeHeight, setEyeHeight] = useState<number>(initialPreferences.camera.eyeHeight);
  const [behindBaseline, setBehindBaseline] = useState<number>(initialPreferences.camera.behindBaseline);
  const [lateral, setLateral] = useState(initialPreferences.camera.lateral);
  const [yaw, setYaw] = useState(initialPreferences.camera.yaw);
  const [pitch, setPitch] = useState(initialPreferences.camera.pitch);
  const [fov, setFov] = useState(initialPreferences.camera.fov);
  const [quality, setQuality] = useState<QualityMode>(initialPreferences.quality);
  const [selectedPositionPreset, setSelectedPositionPreset] = useState(initialPositionPreset?.id ?? '');
  const [selectedPerspectivePreset, setSelectedPerspectivePreset] = useState(perspectivePresets[0]?.id ?? '');
  const [resetToken, setResetToken] = useState(0);
  const [metrics, setMetrics] = useState<SceneMetrics | null>(null);
  const [dialog, setDialog] = useState<DialogId>(null);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [screenWidthCm, setScreenWidthCm] = useState(initialPreferences.screenWidthCm);
  const [screenHeightCm, setScreenHeightCm] = useState(initialPreferences.screenHeightCm);
  const [viewDistanceCm, setViewDistanceCm] = useState(initialPreferences.viewDistanceCm);
  const [presetName, setPresetName] = useState('My preset');
  const [presetNotice, setPresetNotice] = useState<string | null>(null);
  const heldMovementKeys = useRef(new Set<CameraMoveKey>());
  const heldHeightKeys = useRef(new Set<CameraMoveKey>());
  const fastMovement = useRef(false);
  const verticalMovement = useRef(false);
  const cameraYaw = useRef(yaw);
  const keyboardLock = useCameraKeyboardLock();
  const onMetrics = useCallback((next: SceneMetrics) => setMetrics(next), []);
  const updateCameraYaw = useCallback((nextYaw: number) => {
    cameraYaw.current = nextYaw;
    setYaw(nextYaw);
  }, []);
  const updateCameraLook = useCallback((look: CameraLook) => {
    updateCameraYaw(look.yaw);
    setPitch(look.pitch);
    setSelectedPerspectivePreset('');
  }, [updateCameraYaw]);
  const updateCameraFov = useCallback((nextFov: number) => {
    setFov(clampCameraFov(nextFov));
    setSelectedPerspectivePreset('');
  }, []);

  const activePractice = PRACTICE_PRESETS.find((preset) => preset.id === practicePreset) ?? PRACTICE_PRESETS[0]!;
  const drill = DRILL_BY_CATEGORY.get(sessionCategory) ?? DRILL_BY_CATEGORY.get('Quick Rally')!;
  const environment = useMemo<EnvironmentConfiguration>(() => ({ venue, audience, lighting, lightDirection, lightIntensity, timeOfDay, weather, weatherIntensity, windDirection, windSpeedMps }), [audience, lightDirection, lightIntensity, lighting, timeOfDay, venue, weather, weatherIntensity, windDirection, windSpeedMps]);
  const windVelocity = useMemo(() => windVelocityFromEnvironment(environment), [environment]);
  const shotProfile = PRACTICE_SHOT_PROFILES[shotType];
  const spinRateProfile = spinRateProfileForPracticeShot(shotType, spin);
  const returnPatternActive = practicePreset === 'return' && shotType === 'serve' && returnTargetMode === 'pattern';
  const returnServePlacement = RETURN_SERVE_PATTERN[returnPreviewIndex % RETURN_SERVE_PATTERN.length]!;
  const camera = useMemo<CameraConfiguration>(() => ({ eyeHeight, behindBaseline, lateral, yaw, pitch, fov }), [behindBaseline, eyeHeight, fov, lateral, pitch, yaw]);
  const { container: overviewContainer, displayCamera, zoomOverview } = useCourtOverview(camera, overview);
  const rally = useMemo(() => practicePreset === 'rally' ? { landingZone: rallyLandingZone, shot: rallyShot, opponentContactTiming, playerShotPolicy: 'automatic' as const } : undefined, [practicePreset, rallyLandingZone, rallyShot, opponentContactTiming]);
  const practiceReturn = useMemo(() => ({ type: practiceReturnType(sessionCategory), landingZone: rallyLandingZone }), [sessionCategory, rallyLandingZone]);
  const nearZone = useMemo(() => rally ? resolveLandingZone(practiceLandingTarget(opponentPosition, aimDirectionDeg, landingDepthM), landingZone, shotType, opponentPosition) : undefined, [rally, opponentPosition, aimDirectionDeg, landingDepthM, landingZone, shotType]);
  const sessionSettings = useMemo(() => ({
    repetitions, rhythmPercent, shotIntervalSeconds: interval, movementPercent, practiceStroke, trajectoryMode, mode: 'quick-practice' as const, camera: { lateral, behindBaseline, eyeHeight },
    variationPercent: variation, timingVariationPercent: timingVariation, launchSpeedKmh, surface, seed,
    spin, spinRateRpm, practiceShotType: shotType, bounceFactor, opponentHand, workBlockSize, restSeconds,
    serveRhythm, landingZone, landingDepthM, aimDirectionDeg, opponentPosition,
    returnReceiverSide: returnPatternActive ? returnReceiverSide : undefined, windVelocity, rally, practiceReturn, followPracticeBall: practicePreset === 'overhead',
  }), [repetitions, interval, movementPercent, practiceStroke, trajectoryMode, rhythmPercent, lateral, behindBaseline, variation, timingVariation, launchSpeedKmh,
    surface, seed, spin, spinRateRpm, shotType, bounceFactor, opponentHand, workBlockSize, restSeconds,
    serveRhythm, landingZone, landingDepthM, aimDirectionDeg, opponentPosition, returnPatternActive, returnReceiverSide, windVelocity, rally, practiceReturn, practicePreset, eyeHeight]);
  const preview = usePracticePreview(drill, sessionSettings), previewSession = preview.session;
  const onPreviewAudioFrame = usePreviewAudio(environment, surface, !launching && !preview.pending && !preview.error, previewSession);
  const resolvedPreview = (previewRepetition?.session === previewSession ? previewRepetition.repetition : previewSession.repetitions[0])!;
  const trajectory = resolvedPreview.trajectory;
  const previewGap = resolvedPreview.timing?.actual ?? (previewSession.repetitions[1] ? previewSession.repetitions[1].startTime - previewSession.repetitions[0]!.startTime : 0);
  const resolvedStroke=Math.round((resolvedPreview.motionRate??1)*100),resolvedMovement=Math.round((resolvedPreview.movementRate??1)*100);
  const onPreviewIndex = useCallback((index: number, repetition: CompiledRepetition) => {
    setReturnPreviewIndex(index); setPreviewRepetition({ session: previewSession, repetition });
  }, [previewSession]);

  const pendingPreferences = useRef<Omit<PracticePreferencesV1, 'ballFocus'>>(initialPreferences);
  useEffect(() => {
    pendingPreferences.current = { seed, sessionCategory, trajectoryEnabled, launchSpeedKmh, interval, rhythmPercent, movementPercent, practiceStroke, trajectoryMode, returnTargetMode, repetitions, variation, timingVariation, workBlockSize, restSeconds, surface, shotType, spin, spinRateRpm, bounceFactor, opponentHand, serveRhythm, landingZone, rallyLandingZone, rallyShot, opponentContactTiming, landingDepthM, aimDirectionDeg, opponentPosition, camera, environment, quality, screenWidthCm, screenHeightCm, viewDistanceCm };
    const timeout = window.setTimeout(() => onPreferencesChange(pendingPreferences.current), 180);
    return () => window.clearTimeout(timeout);
  }, [seed, aimDirectionDeg, bounceFactor, camera, environment, interval, movementPercent, practiceStroke, trajectoryMode, returnTargetMode, rhythmPercent, landingZone, rallyLandingZone, rallyShot, opponentContactTiming, landingDepthM, launchSpeedKmh, onPreferencesChange, opponentHand, opponentPosition, quality, repetitions, restSeconds, screenHeightCm, screenWidthCm, serveRhythm, sessionCategory, shotType, spin, spinRateRpm, surface, timingVariation, trajectoryEnabled, variation, viewDistanceCm, workBlockSize]);
  // A route change can follow a pointer release before the debounce expires.
  useEffect(() => () => onPreferencesChange(pendingPreferences.current), [onPreferencesChange]);

  useEffect(() => {
    let frame = 0;
    let lastFrame = performance.now();
    const clearMovement = () => {
      heldMovementKeys.current.clear();
      heldHeightKeys.current.clear();
      fastMovement.current = false;
      verticalMovement.current = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const applyMovement = (distance: number) => {
      const movement = cameraMovementForKeys(heldMovementKeys.current, distance, cameraYaw.current, verticalMovement.current);
      if (movement.behindBaseline) setBehindBaseline((value) => Math.min(6, Math.max(-10, value + movement.behindBaseline)));
      if (movement.lateral) setLateral((value) => Math.min(7, Math.max(-7, value + movement.lateral)));
      if (movement.eyeHeight) setEyeHeight((value) => Math.min(CAMERA_EYE_HEIGHT_MAX, Math.max(CAMERA_EYE_HEIGHT_MIN, value + movement.eyeHeight)));
      if (movement.behindBaseline || movement.lateral || movement.eyeHeight) setSelectedPositionPreset('');
    };
    const moveFrame = (now: number) => {
      if (!heldMovementKeys.current.size || dialog) {
        frame = 0;
        return;
      }
      const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastFrame) / 1_000));
      lastFrame = now;
      applyMovement((fastMovement.current ? 6 : 2.4) * deltaSeconds);
      frame = requestAnimationFrame(moveFrame);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const protectedHeightShortcut = cameraHeightMovementKey(event, keyboardLock.active);
      const browserHeightShortcut = isCameraHeightShortcut(event);
      if (protectedHeightShortcut) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.key === 'Shift') fastMovement.current = true;
      if (browserHeightShortcut && !keyboardLock.active) return;
      if (dialog || overview || (target?.matches('input, textarea, select, [contenteditable="true"]') && !protectedHeightShortcut)) return;
      const key = event.key.toLowerCase();
      const movementKey = protectedHeightShortcut ?? (['w', 'a', 's', 'd'].includes(key) ? key as CameraMoveKey : null);
      if (!movementKey) return;
      event.preventDefault();
      fastMovement.current = event.shiftKey;
      if (protectedHeightShortcut) heldHeightKeys.current.add(movementKey);
      verticalMovement.current = heldHeightKeys.current.size > 0;
      const isNewPress = !heldMovementKeys.current.has(movementKey);
      heldMovementKeys.current.add(movementKey);
      if (isNewPress) applyMovement(event.shiftKey ? 0.1 : 0.04);
      if (!frame) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(moveFrame);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const protectedHeightShortcut = cameraHeightMovementKey(event, keyboardLock.active);
      if (protectedHeightShortcut) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.key === 'Shift') fastMovement.current = false;
      if (event.key === 'Control') {
        for (const key of heldHeightKeys.current) heldMovementKeys.current.delete(key);
        heldHeightKeys.current.clear();
        verticalMovement.current = false;
        return;
      }
      const key = event.key.toLowerCase();
      const movementKey = protectedHeightShortcut ?? (['w', 'a', 's', 'd'].includes(key) ? key as CameraMoveKey : null);
      if (!movementKey) return;
      heldMovementKeys.current.delete(movementKey);
      if (protectedHeightShortcut) heldHeightKeys.current.delete(movementKey);
      verticalMovement.current = heldHeightKeys.current.size > 0;
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearMovement();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', clearMovement);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', clearMovement);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearMovement();
    };
  }, [dialog, overview, keyboardLock.active]);

  useEffect(() => {
    if (!presetNotice) return;
    const timeout = window.setTimeout(() => setPresetNotice(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [presetNotice]);


  const applyCameraPosition = (preset: CameraPositionPresetV1) => {
    setEyeHeight(preset.position.eyeHeight);
    setBehindBaseline(preset.position.behindBaseline);
    setLateral(preset.position.lateral);
    setSelectedPositionPreset(preset.id);
    if (preset.lookAt) {
      const look = cameraLookAtCourtPoint(preset.position, preset.lookAt);
      updateCameraYaw(look.yaw); setPitch(look.pitch); setSelectedPerspectivePreset('');
    }
    const receiverSide = returnReceiverSideForCameraPreset(preset.id);
    if (practicePreset === 'return' && shotType === 'serve' && receiverSide) {
      setReturnReceiverSide(receiverSide);
      setReturnPreviewIndex(0);
      setOpponentPosition(returnServerPosition(receiverSide));
      setResetToken((value) => value + 1);
    }
  };

  const changeShotType = (nextShotType: PracticeShotType) => {
    const profile = PRACTICE_SHOT_PROFILES[nextShotType];
    setShotType(nextShotType);
    setSpin(profile.defaultSpin);
    setSpinRateRpm(spinRateForPracticeShot(nextShotType, profile.defaultSpin, undefined));
    setLaunchSpeedKmh(profile.defaultLaunchSpeedKmh);
    setLandingDepthM(profile.defaultLandingDepthM);
    setOpponentPosition(nextShotType === 'serve' && practicePreset === 'return'
      ? returnServerPosition(returnReceiverSide)
      : profile.opponentPosition);
    setAimDirectionDeg(0);
    setResetToken((value) => value + 1);
  };

  const changeSpin = (nextSpinValue: string) => {
    const nextSpin = spinForPracticeShot(shotType, nextSpinValue);
    setSpin(nextSpin);
    setSpinRateRpm(spinRateForPracticeShot(shotType, nextSpin, undefined));
  };

  const applyPerspective = (preset: PerspectivePresetV1) => {
    updateCameraYaw(preset.perspective.yaw);
    setPitch(preset.perspective.pitch);
    setFov(preset.perspective.fov);
    setSelectedPerspectivePreset(preset.id);
  };

  const restoreConfig = (value: PracticePreferencesV1) => {
    onRestoreBallFocus(value.ballFocus);
    setTrajectoryEnabled(value.trajectoryEnabled);
    setLaunchSpeedKmh(value.launchSpeedKmh);
    setRhythmPercent(value.rhythmPercent);
    setInterval(value.interval);
    setMovementPercent(value.movementPercent);
    setPracticeStroke(value.practiceStroke);
    setTrajectoryMode(value.trajectoryMode);
    setReturnTargetMode(value.returnTargetMode);
    setRepetitions(value.repetitions);
    setVariation(value.variation);
    setTimingVariation(value.timingVariation);
    setWorkBlockSize(value.workBlockSize);
    setRestSeconds(value.restSeconds);
    setSurface(value.surface);
    setShotType(value.shotType);
    setSpin(value.spin);
    setSpinRateRpm(value.spinRateRpm);
    setBounceFactor(value.bounceFactor);
    setOpponentHand(value.opponentHand);
    setServeRhythm(value.serveRhythm);
    setLandingZone(value.landingZone);
    setRallyLandingZone(value.rallyLandingZone);
    setOpponentContactTiming(value.opponentContactTiming);
    setLandingDepthM(value.landingDepthM);
    setAimDirectionDeg(value.aimDirectionDeg);
    setOpponentPosition(value.opponentPosition);
    setQuality(value.quality);
    setScreenWidthCm(value.screenWidthCm);
    setScreenHeightCm(value.screenHeightCm);
    setViewDistanceCm(value.viewDistanceCm);
    setEyeHeight(value.camera.eyeHeight);
    setBehindBaseline(value.camera.behindBaseline);
    setLateral(value.camera.lateral);
    updateCameraYaw(value.camera.yaw);
    setPitch(value.camera.pitch);
    setFov(value.camera.fov);
    setVenue(value.environment.venue);
    setAudience(value.environment.audience);
    setLighting(value.environment.lighting);
    setLightDirection(value.environment.lightDirection);
    setLightIntensity(value.environment.lightIntensity);
    setTimeOfDay(value.environment.timeOfDay);
    setWeather(value.environment.weather);
    setWeatherIntensity(value.environment.weatherIntensity);
    setWindDirection(value.environment.windDirection);
    setWindSpeedMps(value.environment.windSpeedMps);
    setSeed(value.seed ?? '18427'); setSelectedPositionPreset(''); setSelectedPerspectivePreset(''); setOverview(false);
    setReturnReceiverSide(value.camera.lateral < 0 ? 'right' : 'left'); setReturnPreviewIndex(0);
  };

  const choosePractice = (preset: typeof PRACTICE_PRESETS[number]) => {
    setPracticePreset(preset.id);
    setSessionCategory(preset.category);
    restoreConfig(practiceConfigs[preset.category] ?? practiceDefaults(preset.category, projectPracticeConfigs));
    setLaunchError(''); setPreviewRepetition(null); setResetToken(value => value + 1);
  };
  const resetConfig = () => {
    restoreConfig(practiceDefaults(sessionCategory, projectPracticeConfigs));
    setLaunchError(''); setPreviewRepetition(null); setResetToken(value => value + 1);
    setPresetNotice(t('Configuration reset to defaults for this practice.'));
  };

  const changeLanding = (point:Readonly<{x:number;z:number}>) => {
    const range=shotProfile.landingDepthRangeM;
    const z=-Math.min(range.max,Math.max(range.min,-point.z));
    const requested={x:Math.min(7,Math.max(-7,point.x)),z};
    const target=shotType==='serve'?legalServeTarget(opponentPosition,aimDirectionToCourtPoint(opponentPosition,requested),-z):requested;
    if(returnPatternActive)setReturnTargetMode('custom');
    setLandingDepthM(-target.z);
    setAimDirectionDeg(aimDirectionToCourtPoint(opponentPosition,target));
  };
  const changeRecoveryCenter = (point:CourtPoint) => {
    const target=practiceLandingTarget(opponentPosition,aimDirectionDeg,landingDepthM);
    setOpponentPosition({ x: point.x, z: point.z });
    setAimDirectionDeg(aimDirectionToCourtPoint(point,target));
  };
  const changeLandingZone = (zone: LandingZone) => {
    setLandingZone({ width: zone.maxX - zone.minX, depth: zone.maxZ - zone.minZ });
    changeLanding(landingZoneCenter(zone));
  };
  const resetView = () => {
    if (cameraPositionPresets[0]) applyCameraPosition(cameraPositionPresets[0]);
    if (perspectivePresets[0]) applyPerspective(perspectivePresets[0]);
    if (practicePreset === 'overhead' || practicePreset === 'volley') {
      const view = QUICK_PRACTICE_VIEWS[practicePreset];
      setEyeHeight(view.eyeHeight); setBehindBaseline(view.behindBaseline); setLateral(view.lateral);
      updateCameraYaw(view.yaw); setPitch(view.pitch); setSelectedPositionPreset(''); setSelectedPerspectivePreset('');
    }
  };

  const [saving, setSaving] = useState(false);
  const performSave = async (operation: () => Promise<void>) => {
    if (saving) return;
    setSaving(true);
    try { await operation(); }
    catch (error) { if (!(error instanceof SaveCancelled)) setPresetNotice(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setSaving(false); }
  };
  const updatePositionPreset = (preset: CameraPositionPresetV1) => void performSave(async () => {
    await onSaveCameraPositionPreset({ ...preset, position: { eyeHeight, behindBaseline, lateral } });
    setSelectedPositionPreset(preset.id);
  });
  const updatePerspectivePreset = (preset: PerspectivePresetV1) => void performSave(async () => {
    await onSavePerspectivePreset({ ...preset, perspective: { yaw, pitch, fov } });
    setSelectedPerspectivePreset(preset.id);
  });
  const createPreset = () => void performSave(async () => {
    const name = presetName.trim() || t('Untitled preset');
    if (dialog === 'new-position') {
      const id = `position-${crypto.randomUUID().slice(0, 8)}`;
      await onSaveCameraPositionPreset({ id, name, position: { eyeHeight, behindBaseline, lateral } });
      setSelectedPositionPreset(id);
    } else {
      const id = `perspective-${crypto.randomUUID().slice(0, 8)}`;
      await onSavePerspectivePreset({ id, name, perspective: { yaw, pitch, fov } });
      setSelectedPerspectivePreset(id);
    }
    setDialog(null);
  });

  const launch = async () => {
    launchCalculation.current?.abort();
    const controller = new AbortController(); launchCalculation.current = controller;
    setLaunching(true); setLaunchError(''); setResetToken(value => value + 1);
    try {
      const session = await compilePracticeAsync(drill, sessionSettings, false, controller.signal);
      if (controller.signal.aborted) return;
      if (session.planningIssues?.length) { setLaunchError(session.planningIssues[0]!.message); return; }
      onStart({ session, trajectoryEnabled, camera, environment, surface, quality, defaultContent: true });
    } catch (error) { if (!controller.signal.aborted) setLaunchError(error instanceof Error ? error.message : String(error)); }
    finally { if (launchCalculation.current === controller) setLaunching(false); }
  };

  const requestStart = () => {
    practiceAudio.unlock();
    if (localStorage.getItem('tenmulate.safetyAcknowledged') === 'true') launch();
    else setDialog('safety');
  };

  const applyPhysicalFov = () => {
    const nextFov = (2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI;
    setFov(clampCameraFov(Math.round(nextFov)));
    setSelectedPerspectivePreset('');
    setDialog(null);
  };

  const changeVenue = (next: VenueId) => {
    const definition = SCENE_DEFINITIONS[next];
    const preset = definition.defaultLighting;
    setVenue(next);
    setSurface(definition.defaultSurface);
    setLighting(preset);
    if (preset === 'day' || preset === 'golden-hour' || preset === 'night') setTimeOfDay(OUTDOOR_TIME_BY_LIGHTING[preset]);
  };

  return (
    <main className="app-shell setup-shell" data-session-prepared={preview.prepared}>
      <AppHeader route={route} onRoute={onRoute} />
      <section className="practice-layout">
        <aside className="session-rail compact-practice-rail" aria-label={t("Practice presets")}>
          <h1>{t("Quick Practice")}</h1>
          <p className="rail-intro">{t("Choose the shot you want to practice. Opponent shot controls the ball coming to you.")}</p>
          <p className="compact-display-notice">{t("Setup works here. For safe physical shadow-swing practice, use a larger display with a cleared practice area.")}</p>
          <div className="session-list">
            {PRACTICE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return <button type="button" key={preset.id} className={practicePreset === preset.id ? 'session-row selected' : 'session-row'} onClick={() => choosePractice(preset)}><Icon size={21} /><span>{t(preset.label)}</span></button>;
            })}
          </div>
          <div className="practice-preset-summary"><span>{t(activePractice.label)} {t("setup")}</span><strong>{t(shotProfile.label)} · {t(practiceSpinLabel(shotType, spin))}</strong><small>{t("Opponent")} {opponentPosition.x.toFixed(1)}, {opponentPosition.z.toFixed(1)} {t("m")}</small>{returnPatternActive ? <small aria-live="polite">{returnReceiverSide === 'left' ? t("Left") : t("Right")} {t("receiver · Now")} {t(RETURN_SERVE_PLACEMENT_LABELS[returnServePlacement])} {t("· T → Body → Wide")}</small> : null}</div>
        </aside>

        <section className="preview-column" aria-label={t("Live court preview")}>
          <div className="setup-court-view" ref={overviewContainer} data-camera-eye-height={eyeHeight.toFixed(3)}>
            <CourtViewport onPreviewAudioFrame={onPreviewAudioFrame} camera={displayCamera} courtOverview={overview} playerCamera={camera} onPlayerCameraChange={overview ? next => {
              setLateral(next.lateral); setBehindBaseline(next.behindBaseline); updateCameraYaw(next.yaw);
              setSelectedPositionPreset(''); setSelectedPerspectivePreset('');
            } : undefined} trajectory={trajectory} surface={surface} environment={environment} quality={quality} running={!launching && !preview.pending && !preview.error} shotPreviewPending={launching || preview.pending} resetToken={resetToken} showTrajectory={trajectoryEnabled || overview} showOpponentLandingZone loopTrajectory session={launching ? undefined : previewSession} onSessionIndex={onPreviewIndex} onLandingZoneChange={changeLandingZone}
              followSessionCamera={!overview} nearLandingZone={nearZone} returnLandingZone={rallyLandingZone} onReturnLandingZoneChange={setRallyLandingZone}
              opponentPlacement={overview ? { ...opponentPosition, hand: opponentHand } : undefined} onOpponentPositionChange={overview ? changeRecoveryCenter : undefined}
              onCameraFovChange={overview ? zoomOverview : updateCameraFov} onCameraLookChange={overview ? undefined : updateCameraLook} onMetrics={onMetrics} />
            <div className="editor-view-tools"><button type="button" aria-pressed={overview} onClick={() => setOverview(value => !value)}>{overview ? t("Back to player view") : t("Top-down court")}</button>{overview ? <span><i className="return-swatch"/>{t("Your return")} <i className="landing-swatch"/>{t("Opponent landing")}</span> : null}</div>
            <div className="court-metadata" aria-live="polite">{metrics ? t("{0} · {1} fps · {2}× {3}", {"0": metrics.renderer, "1": metrics.fps, "2": metrics.pixelRatio.toFixed(2), "3": t(metrics.quality)}) : t("Starting renderer")} {t("· Stroke")} {resolvedStroke}%{previewGap ? t(" · {0} s between shots", {"0": previewGap.toFixed(2)}) : ''}</div>
          </div>
          <div className="preset-toolbar">
            <div className="preset-group" aria-label={t("Camera position presets")}>
              <header><span><MapPin size={14} /> {t("Camera positions")}</span><small>{keyboardLock.active ? t("Ctrl+W/S") : t("PgUp/PgDn")} <output aria-label={t("Camera height")}>{eyeHeight.toFixed(2)} {t("m")}</output></small></header>
              <div className="preset-row"><div className="preset-options">{cameraPositionPresets.map((preset) => <button key={preset.id} type="button" className={selectedPositionPreset === preset.id ? 'preset-chip active' : 'preset-chip'} onClick={() => applyCameraPosition(preset)} onContextMenu={(event) => { event.preventDefault(); updatePositionPreset(preset); }}>{preset.name}</button>)}</div><button className="preset-add" type="button" aria-label={t("Save camera position preset")} title={t("Save the current camera location and eye height")} onClick={() => { setPresetName(t('My position')); setDialog('new-position'); }}><Save size={14} /><span>{t("Save preset")}</span></button></div>
            </div>
            <div className="preset-group" aria-label={t("Perspective presets")}>
              <header><span><Eye size={14} /> {t("Perspectives")}</span><small>{t("Right-click to save preset")}</small></header>
              <div className="preset-row"><div className="preset-options">{perspectivePresets.map((preset) => <button key={preset.id} type="button" className={selectedPerspectivePreset === preset.id ? 'preset-chip active' : 'preset-chip'} onClick={() => applyPerspective(preset)} onContextMenu={(event) => { event.preventDefault(); updatePerspectivePreset(preset); }}>{preset.name}</button>)}</div><button className="preset-add" type="button" aria-label={t("Save perspective preset")} title={t("Save the current viewing direction and field of view")} onClick={() => { setPresetName(t('My perspective')); setDialog('new-perspective'); }}><Save size={14} /><span>{t("Save preset")}</span></button></div>
            </div>
            <div className="preset-toolbar-actions"><button className={keyboardLock.active ? 'keyboard-lock-button active' : 'keyboard-lock-button'} type="button" aria-pressed={keyboardLock.active} disabled={keyboardLock.status === 'requesting' || keyboardLock.status === 'unsupported'} title={translateMessage(keyboardLock.message)} onClick={() => void (keyboardLock.active ? keyboardLock.disable() : keyboardLock.enable())}>{keyboardLock.status === 'requesting' ? t("Requesting…") : keyboardLock.active ? t("Unlock Ctrl+W/S") : keyboardLock.status === 'failed' ? t("Retry Ctrl+W/S") : keyboardLock.status === 'unsupported' ? t("Ctrl+W/S unavailable") : t("Protect Ctrl+W/S")}</button><button className="reset-link" type="button" onClick={resetView}><RotateCcw size={15} /> {t("Reset view")}</button></div>
            {keyboardLock.status === 'failed' || keyboardLock.status === 'unsupported' ? <span className="keyboard-lock-message" role="status">{translateMessage(keyboardLock.message)}</span> : null}
            {presetNotice ? <span className="preset-notice" role="status">{translateMessage(presetNotice)}</span> : null}
          </div>
        </section>

        <aside className="inspector" aria-label={t("Quick Practice")}>
          <h2>{t("Quick Practice")}</h2>
          <SetupSection title={t("Opponent shot")} subtitle={t("Incoming ball")} open>
            <label className="select-field"><span>{t("Shot type")}</span><select aria-label={t("Shot type")} value={shotType} onChange={(event) => changeShotType(event.target.value as PracticeShotType)}>{(['groundstroke','serve','drop-shot','volley','lob','overhead'] as const).map(type=><option key={type} value={type}>{t(PRACTICE_SHOT_PROFILES[type].label)}</option>)}</select></label>
            <label className="select-field"><span>{t("Spin type")}</span><select aria-label={t("Spin type")} value={spin} onChange={(event) => changeSpin(event.target.value)}>{shotProfile.spins.map((option) => <option key={option} value={option}>{t(practiceSpinLabel(shotType, option))}</option>)}</select></label>
            {shotType!=='serve'?<label className="select-field"><span>{t("Stroke side")}</span><select aria-label={t("Stroke side")} value={practiceStroke} onChange={event=>setPracticeStroke(event.target.value as 'forehand'|'backhand'|'auto')}><option value="auto">{t("Automatic")}</option><option value="forehand">{t("Forehand")}</option><option value="backhand">{t("Backhand")}</option></select></label>:null}
          </SetupSection>
          <SetupSection title={t("Ball & rhythm")} subtitle={t("Flight, speed, timing")} open>
            <label className="toggle-field"><span>{t("Trajectory")}</span><button type="button" role="switch" aria-label={t("Trajectory")} aria-checked={trajectoryEnabled || overview} disabled={overview} title={overview ? t("Always shown in top-down view") : undefined} className={trajectoryEnabled || overview ? 'toggle active' : 'toggle'} onClick={() => setTrajectoryEnabled((value) => !value)}><span /></button><small>{trajectoryEnabled || overview ? t("On") : t("Off")}</small></label>
            {shotType === 'serve' ? <label className="select-field"><span>{t("Serve rhythm")}</span><select aria-label={t("Serve rhythm")} value={serveRhythm} onChange={(event) => setServeRhythm(event.target.value as 'normal' | 'compact')}><option value="normal">{t("Normal")}</option><option value="compact">{t("Compact")}</option></select></label> : null}
            <RangeField label={t("Launch speed")} value={launchSpeedKmh} min={shotProfile.launchSpeedRangeKmh.min} max={shotProfile.launchSpeedRangeKmh.max} step={1} unit={t("km/h")} onChange={setLaunchSpeedKmh} />
            {spinRateProfile.maxRpm > 0 ? <RangeField label={t("Spin rate")} value={spinRateRpm} min={spinRateProfile.minRpm} max={spinRateProfile.maxRpm} step={1} unit={t("rpm")} onChange={setSpinRateRpm} /> : null}
            {practicePreset==='return' && shotType==='serve' ? <label className="select-field"><span>{t("Serve placement")}</span><select aria-label={t("Serve placement")} value={returnTargetMode} onChange={event=>{if(event.target.value==='custom')changeLanding(trajectory.intent.target);else setReturnTargetMode('pattern');}}><option value="pattern">{t("T → Body → Wide")}</option><option value="custom">{t("Custom target")}</option></select></label> : null}
            <RangeField label={t("Shot Variation")} value={variation} min={0} max={25} step={1} unit="%" onChange={setVariation} />
            <label className="select-field"><span>{t("Trajectory style")}</span><select aria-label={t("Trajectory style")} value={trajectoryMode} onChange={event=>setTrajectoryMode(event.target.value as 'natural'|'exact')}><option value="natural">{t("Natural target")}</option><option value="exact">{t("Exact sampled speed & spin")}</option></select></label>
            <small className={`trajectory-resolution${trajectory.solution?.status==='unreachable'?' warning':''}`} role="status">{trajectory.solution?.status==='unreachable'?t("Sample outside this shot’s reach. Adjust speed, spin or zone."):t("Resolved {0} km/h · {1} rpm.", {"0": trajectory.resolved.launchSpeedKmh.toFixed(1), "1": Math.round(trajectory.resolved.spinRateRpm)})} {trajectoryMode==='exact'?t("Each sampled speed and spin stays fixed; some landings may be out of reach."):''}</small>
            <RangeField label={t("Shot interval")} value={interval} min={1} max={30} step={0.1} unit={t("s")} onChange={setInterval} />
            {rally ? <ContactTimingControl family={shotType === 'serve' ? 'groundstroke' : shotType} value={opponentContactTiming} label={t("Opponent contact timing")} onChange={setOpponentContactTiming}/> : null}
            <RangeField label={t("Stroke rhythm")} value={rhythmPercent} min={50} max={300} step={5} unit="%" onChange={setRhythmPercent} />
            <RangeField label={t("Movement pace")} value={movementPercent} min={50} max={300} step={5} unit="%" onChange={setMovementPercent} />
            <small>{t("Resolved")} {resolvedStroke}{t("% stroke ·")} {resolvedMovement}{t("% movement.")} {resolvedPreview.timing?.limited?t("{0}: {1} s.", {"0": rally ? t('Physical contact interval') : t('Shortest feasible interval'), "1": previewGap.toFixed(2)}):t("{0} s between shots.", {"0": previewGap.toFixed(2)})}</small>
          </SetupSection>
          <SetupSection title={t("Ball arrival")} subtitle={t("Surface response and perceived height")}><RangeField label={t("Bounce height")} value={bounceFactor} min={0.6} max={1.4} step={0.05} unit="×" onChange={setBounceFactor} /></SetupSection>
          <SetupSection title={t("Your return")} subtitle={t("Blue landing zone")} open><button type="button" className="text-action" onClick={() => setOverview(true)}>{t("Edit return landing zone on court")}</button></SetupSection>
          <SetupSection title={t("Practice set")} subtitle={t("Repetitions and recovery")}><RangeField label={t("Repetitions")} value={repetitions} min={1} max={50} step={1} unit="" onChange={setRepetitions} /><RangeField label={t("Timing variation")} value={timingVariation} min={0} max={30} step={1} unit="%" onChange={setTimingVariation} /><RangeField label={t("Work block")} value={workBlockSize} min={1} max={20} step={1} unit={t("reps")} onChange={setWorkBlockSize} /><RangeField label={t("Rest")} value={restSeconds} min={0} max={120} step={5} unit={t("s")} onChange={setRestSeconds} /></SetupSection>
          <SetupSection title={t("Opponent")} subtitle={t("Position and delivery")} open><button type="button" className="configuration-action" onClick={() => setOverview(true)}><UserRound size={16} /><span>{t("Place opponent on court")}</span><small>{opponentPosition.x.toFixed(1)}, {opponentPosition.z.toFixed(1)} {t("m")}</small></button><label className="select-field"><span>{t("Hand")}</span><select value={opponentHand} onChange={(event) => setOpponentHand(event.target.value as 'left' | 'right')}><option value="right">{t("Right-handed")}</option><option value="left">{t("Left-handed")}</option></select></label></SetupSection>
          <SetupSection title={t("Venue")} subtitle={t("Court, light, weather")}>
            <label className="select-field"><span>{t("Venue")}</span><select value={venue} onChange={(event) => changeVenue(event.target.value as VenueId)}>{(Object.entries(VENUE_LABELS) as [VenueId, string][]).map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}</select></label>
            <label className="select-field"><span>{t("Audience")}</span><select value={audience} onChange={event => setAudience(event.target.value as AudienceOccupancy)}><option value="empty">{t("Empty")}</option><option value="half">{t("Half seated")}</option><option value="full">{t("Fully seated")}</option></select></label>
            <label className="select-field"><span>{t("Surface")}</span><select value={surface} onChange={(event) => setSurface(event.target.value as SurfaceId)}><option value="hard">{t("Hard")}</option><option value="clay">{t("Clay")}</option><option value="grass">{t("Grass")}</option></select></label>
            <label className="select-field"><span>{t("Lighting")}</span><select value={lighting} onChange={(event) => { const next = event.target.value as LightingPreset; setLighting(next); if (next === 'day' || next === 'golden-hour' || next === 'night') setTimeOfDay(OUTDOOR_TIME_BY_LIGHTING[next]); }}>{isOutdoorVenue(venue) ? <><option value="day">{t("Day")}</option><option value="golden-hour">{t("Golden hour")}</option><option value="night">{t("Night floodlights")}</option></> : <><option value="indoor-neutral">{t("Neutral")}</option><option value="indoor-warm">{t("Warm")}</option><option value="indoor-bright">{t("Bright match")}</option></>}</select></label>
            {isOutdoorVenue(venue) ? <><RangeField label={t("Time of day")} value={timeOfDay} min={5} max={23} step={0.25} unit={t("h")} onChange={setTimeOfDay} /><label className="select-field"><span>{t("Weather")}</span><select value={weather} onChange={(event) => { const next = event.target.value as WeatherCondition; setWeather(next); setWeatherIntensity(next === 'clear' ? 0 : Math.max(0.45, weatherIntensity)); }}><option value="clear">{t("Clear")}</option><option value="overcast">{t("Overcast")}</option><option value="rain">{t("Rain")}</option></select></label>{weather !== 'clear' ? <RangeField label={t("Weather level")} value={weatherIntensity} min={0.1} max={1} step={0.05} unit="×" onChange={setWeatherIntensity} /> : null}</> : null}
            <RangeField label={isOutdoorVenue(venue) ? t("Sun direction") : t("Light direction")} value={lightDirection} min={-180} max={180} step={5} unit="°" onChange={setLightDirection} /><RangeField label={t("Light level")} value={lightIntensity} min={0.35} max={1.5} step={0.05} unit="×" onChange={setLightIntensity} /><RangeField label={t("Wind direction")} value={windDirection} min={-180} max={180} step={5} unit="°" onChange={setWindDirection} /><RangeField label={t("Wind speed")} value={windSpeedMps} min={0} max={15} step={0.5} unit={t("m/s")} onChange={setWindSpeedMps} />
          </SetupSection>
          <SetupSection title={t("Perspective")} subtitle={t("Height, 360° look, and field of view")}>
            <BallFocusControls />
            <RangeField label={t("Camera height")} value={eyeHeight} min={CAMERA_EYE_HEIGHT_MIN} max={CAMERA_EYE_HEIGHT_MAX} step={0.05} unit={t("m")} onChange={(value) => { setEyeHeight(value); setSelectedPositionPreset(''); }} />
            <RangeField label={t("Yaw")} value={yaw} min={-180} max={180} step={0.1} unit="°" onChange={(value) => { updateCameraYaw(value); setSelectedPerspectivePreset(''); }} />
            <RangeField label={t("Pitch")} value={pitch} min={-180} max={180} step={0.1} unit="°" onChange={(value) => { setPitch(value); setSelectedPerspectivePreset(''); }} />
            <RangeField label={t("FOV")} value={fov} min={CAMERA_FOV_MIN} max={CAMERA_FOV_MAX} step={1} unit={t("° H")} onChange={updateCameraFov} />
            <button type="button" className="text-action" onClick={() => setDialog('display')}>{t("Use physical display measurements")}</button>
          </SetupSection>
          <SetupSection title={t("System")} subtitle={t("Quality and repeatability")}><label className="select-field"><span>{t("Quality")}</span><select value={quality} onChange={(event) => setQuality(event.target.value as QualityMode)}><option value="auto">{t("Auto adaptive")}</option><option value="performance">{t("Performance")}</option><option value="quality">{t("Quality")}</option></select></label><label className="text-field"><span>{t("Seed")}</span><input aria-label={t("Seed")} value={seed} inputMode="numeric" onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10) || '0')} /></label></SetupSection>
          <AudioSettings />
          {preview.pending ? <p role="status">{t("Updating practice…")}</p> : preview.error || previewSession.planningIssues?.length ? <p role="alert">{translateMessage(preview.error || previewSession.planningIssues?.[0]?.message)}</p> : null}
          {launchError ? <p role="alert">{translateMessage(launchError)}</p> : null}
          <div className="inspector-actions"><button className="secondary-button" type="button" disabled={saving || launching} onClick={resetConfig}><RotateCcw size={16}/>{t("Reset config")}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => void performSave(() => onSaveConfig(pendingPreferences.current))}><Save size={16}/>{saving ? t("Saving…") : t("Save config")}</button><button className="primary-button" type="button" disabled={launching || preview.pending || !!preview.error || !!previewSession.planningIssues?.length} onClick={requestStart}><Play size={16}/>{launching ? t("Preparing practice…") : t("Start practice")}</button></div>
        </aside>
      </section>
      {dialog === 'safety' ? <Modal title={t("Make room to swing")} actions={<><button className="secondary-button" type="button" onClick={() => setDialog(null)}>{t("Cancel")}</button><button className="primary-button inline" type="button" disabled={!safetyChecked} onClick={() => { localStorage.setItem('tenmulate.safetyAcknowledged', 'true'); setDialog(null); launch(); }}>{t("Continue")}</button></>}><p>{t("Move furniture, people, pets, and breakable objects beyond your full racket-and-arm reach. Tenmulate does not measure your room.")}</p><label className="check-row"><input type="checkbox" checked={safetyChecked} onChange={(event) => setSafetyChecked(event.target.checked)} /> {t("I have cleared a safe practice area.")}</label></Modal> : null}
      {dialog === 'display' ? <Modal title={t("Physical display view")} onClose={() => setDialog(null)} actions={<button className="primary-button inline" type="button" onClick={applyPhysicalFov}>{t("Apply calculated FOV")}</button>}><p>{t("Enter the visible screen width and height plus your eye-to-screen distance. This calculates physical horizontal and vertical FOV without changing court geometry.")}</p><label className="dialog-field"><span>{t("Screen width")}</span><input type="number" min="30" max="1000" value={screenWidthCm} onChange={(event) => setScreenWidthCm(Number(event.target.value))} /><small>{t("cm")}</small></label><label className="dialog-field"><span>{t("Screen height")}</span><input type="number" min="20" max="1000" value={screenHeightCm} onChange={(event) => setScreenHeightCm(Number(event.target.value))} /><small>{t("cm")}</small></label><label className="dialog-field"><span>{t("Viewing distance")}</span><input type="number" min="30" max="1500" value={viewDistanceCm} onChange={(event) => setViewDistanceCm(Number(event.target.value))} /><small>{t("cm")}</small></label><p className="calculation">{t("Calculated FOV:")} {Math.round((2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI)}{t("° horizontal ·")} {Math.round((2 * Math.atan(screenHeightCm / (2 * viewDistanceCm)) * 180) / Math.PI)}{t("° vertical")}</p></Modal> : null}
      {dialog === 'new-position' || dialog === 'new-perspective' ? <Modal title={dialog === 'new-position' ? t("New camera position") : t("New perspective")} onClose={() => setDialog(null)} actions={<><button className="secondary-button" type="button" onClick={() => setDialog(null)}>{t("Cancel")}</button><button className="primary-button inline" type="button" disabled={saving} onClick={createPreset}>{t("Save preset")}</button></>}><p>{dialog === 'new-position' ? t("Reuse this camera location and eye height in another practice setup.") : t("Reuse this viewing direction and field of view from any camera position.")}</p><label className="stack-field"><span>{t("Preset name")}</span><input autoFocus maxLength={40} value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label></Modal> : null}
    </main>
  );
}
