import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, Eye, Gauge, MapPin, Plus, RotateCcw, Target, Trophy, UserRound } from 'lucide-react';
import { DRILL_BY_CATEGORY } from '../content/bundled';
import type { SessionCategory } from '../content/types';
import { CAMERA_FOV_MAX, CAMERA_FOV_MIN, clampCameraFov, type CameraLook } from '../domain/camera';
import { COURT, OPPONENT_POSITION_PRESETS, cameraMovementForKeys, type CameraMoveKey, type SurfaceId } from '../domain/court';
import { SCENE_DEFINITIONS, VENUE_LABELS, isOutdoorVenue, windVelocityFromEnvironment, type EnvironmentConfiguration, type LightingPreset, type VenueId, type WeatherCondition } from '../domain/environment';
import type { CameraConfiguration, QualityMode, SceneMetrics } from '../engine/rendering/TennisScene';
import { compileSession } from '../engine/session/compileSession';
import { resolveTrajectory, type SpinKind } from '../engine/trajectory/physics';
import { PRACTICE_SHOT_PROFILES, legalServeTarget, practiceLandingTarget, spinForPracticeShot, spinRateForPracticeShot, spinRateProfileForPracticeShot, type PracticeShotType } from '../engine/trajectory/practiceProfiles';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import type { SessionLaunch } from '../app/types';
import { DEFAULT_CAMERA_POSITION_PRESETS, DEFAULT_PERSPECTIVE_PRESETS, type CameraPositionPresetV1, type PerspectivePresetV1, type PracticePreferencesV1 } from '../storage/appStorage';
import { AppHeader, type AppRoute } from './AppHeader';
import { CourtPlan, type CourtPoint } from './CourtPlan';
import { Modal } from './Modal';
import { SceneViewport } from './SceneViewport';

type PracticePresetId = 'rally' | 'return' | 'volley' | 'overhead';
type DialogId = 'safety' | 'display' | 'help' | 'opponent' | 'new-position' | 'new-perspective' | null;

const PRACTICE_PRESETS: ReadonlyArray<{
  id: PracticePresetId;
  label: string;
  category: SessionCategory;
  icon: typeof Activity;
  cameraPresetId: string;
  opponent: CourtPoint;
  shotType: PracticeShotType;
}> = [
  { id: 'rally', label: 'Rally', category: 'Quick Rally', icon: Activity, cameraPresetId: 'position-baseline', opponent: { x: 0, z: COURT.halfLength - 0.65 }, shotType: 'groundstroke' },
  { id: 'return', label: 'Return', category: 'Return Practice', icon: Target, cameraPresetId: 'position-baseline', opponent: { x: 1.25, z: COURT.halfLength - 0.18 }, shotType: 'serve' },
  { id: 'volley', label: 'Volley', category: 'Serve & Volley', icon: Trophy, cameraPresetId: 'position-net', opponent: { x: 0, z: 3.7 }, shotType: 'volley' },
  { id: 'overhead', label: 'Overhead', category: 'Net & Overhead', icon: Gauge, cameraPresetId: 'position-overhead', opponent: { x: 1.1, z: 6.0 }, shotType: 'lob' },
];

const OUTDOOR_TIME_BY_LIGHTING: Readonly<Record<'day' | 'golden-hour' | 'night', number>> = {
  day: 14,
  'golden-hour': 18.5,
  night: 21.5,
};

const practiceSpinLabel = (shotType: PracticeShotType, spin: SpinKind): string => (
  shotType === 'volley' ? 'None' : spin === 'topspin' ? 'Topspin' : `${spin[0]?.toUpperCase()}${spin.slice(1)}`
);

type RangeFieldProps = Readonly<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}>;

function RangeField({ label, value, min, max, step, unit, onChange }: RangeFieldProps) {
  return (
    <label className="range-field">
      <span>{label}</span>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <output>{value.toFixed(step < 1 ? 2 : 0)}</output>
      <small>{unit}</small>
    </label>
  );
}

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
  onSaveCameraPositionPreset: (preset: CameraPositionPresetV1) => void;
  onSavePerspectivePreset: (preset: PerspectivePresetV1) => void;
  onPreferencesChange: (preferences: PracticePreferencesV1) => void;
}>;

export function SetupScreen({ route, cameraPositionPresets = DEFAULT_CAMERA_POSITION_PRESETS, perspectivePresets = DEFAULT_PERSPECTIVE_PRESETS, initialPreferences, onRoute, onStart, onSaveCameraPositionPreset, onSavePerspectivePreset, onPreferencesChange }: SetupScreenProps) {
  const legacyInitialPreferences = initialPreferences as PracticePreferencesV1 & { physicsSurface?: SurfaceId; visualSurface?: SurfaceId };
  const initialPractice = PRACTICE_PRESETS.find((preset) => preset.category === initialPreferences.sessionCategory) ?? PRACTICE_PRESETS[0]!;
  const [practicePreset, setPracticePreset] = useState<PracticePresetId>(initialPractice.id);
  const [sessionCategory, setSessionCategory] = useState<SessionCategory>(initialPractice.category);
  const [trajectoryEnabled, setTrajectoryEnabled] = useState(initialPreferences.trajectoryEnabled ?? false);
  const [launchSpeedKmh, setLaunchSpeedKmh] = useState(initialPreferences.launchSpeedKmh);
  const [interval, setIntervalValue] = useState(initialPreferences.interval);
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
  const [serveRhythm, setServeRhythm] = useState<'preset' | 'normal' | 'compact'>(initialPreferences.serveRhythm);
  const [landingDepthM, setLandingDepthM] = useState(initialPreferences.landingDepthM);
  const [aimDirectionDeg, setAimDirectionDeg] = useState(initialPreferences.aimDirectionDeg ?? 0);
  const [opponentPosition, setOpponentPosition] = useState<CourtPoint>(initialPreferences.opponentPosition ?? initialPractice.opponent);
  const [venue, setVenue] = useState<VenueId>(initialPreferences.environment.venue);
  const [lighting, setLighting] = useState<LightingPreset>(initialPreferences.environment.lighting);
  const [lightDirection, setLightDirection] = useState(initialPreferences.environment.lightDirection);
  const [lightIntensity, setLightIntensity] = useState(initialPreferences.environment.lightIntensity);
  const [timeOfDay, setTimeOfDay] = useState(initialPreferences.environment.timeOfDay);
  const [weather, setWeather] = useState<WeatherCondition>(initialPreferences.environment.weather);
  const [weatherIntensity, setWeatherIntensity] = useState(initialPreferences.environment.weatherIntensity);
  const [windDirection, setWindDirection] = useState(initialPreferences.environment.windDirection);
  const [windSpeedMps, setWindSpeedMps] = useState(initialPreferences.environment.windSpeedMps);
  const [seed, setSeed] = useState('18427');
  const [eyeHeight, setEyeHeight] = useState<number>(initialPreferences.camera.eyeHeight);
  const [behindBaseline, setBehindBaseline] = useState<number>(initialPreferences.camera.behindBaseline);
  const [lateral, setLateral] = useState(initialPreferences.camera.lateral);
  const [yaw, setYaw] = useState(initialPreferences.camera.yaw);
  const [pitch, setPitch] = useState(initialPreferences.camera.pitch);
  const [fov, setFov] = useState(initialPreferences.camera.fov);
  const [quality, setQuality] = useState<QualityMode>(initialPreferences.quality);
  const [selectedPositionPreset, setSelectedPositionPreset] = useState(cameraPositionPresets[0]?.id ?? '');
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
  const fastMovement = useRef(false);
  const onMetrics = useCallback((next: SceneMetrics) => setMetrics(next), []);
  const updateCameraLook = useCallback((look: CameraLook) => {
    setYaw(look.yaw);
    setPitch(look.pitch);
    setSelectedPerspectivePreset('');
  }, []);
  const updateCameraFov = useCallback((nextFov: number) => {
    setFov(clampCameraFov(nextFov));
    setSelectedPerspectivePreset('');
  }, []);

  const activePractice = PRACTICE_PRESETS.find((preset) => preset.id === practicePreset) ?? PRACTICE_PRESETS[0]!;
  const drill = DRILL_BY_CATEGORY.get(sessionCategory) ?? DRILL_BY_CATEGORY.get('Quick Rally')!;
  const environment = useMemo<EnvironmentConfiguration>(() => ({ venue, lighting, lightDirection, lightIntensity, timeOfDay, weather, weatherIntensity, windDirection, windSpeedMps }), [lightDirection, lightIntensity, lighting, timeOfDay, venue, weather, weatherIntensity, windDirection, windSpeedMps]);
  const windVelocity = useMemo(() => windVelocityFromEnvironment(environment), [environment]);
  const shotProfile = PRACTICE_SHOT_PROFILES[shotType];
  const spinRateProfile = spinRateProfileForPracticeShot(shotType, spin);
  const trajectory = useMemo(() => {
    const source = { x: opponentPosition.x, y: shotProfile.contactHeight, z: opponentPosition.z };
    const target = shotType === 'serve'
      ? legalServeTarget(source, aimDirectionDeg, landingDepthM)
      : practiceLandingTarget(source, aimDirectionDeg, landingDepthM);
    return resolveTrajectory({
      source,
      target,
      aimDirectionDeg,
      launchSpeedKmh,
      spin,
      spinRateRpm,
      shotType,
      opponentHand,
      surface,
      minimumNetClearanceM: shotProfile.minimumNetClearanceM,
      windVelocity,
      bounceFactor,
    });
  }, [aimDirectionDeg, bounceFactor, landingDepthM, launchSpeedKmh, opponentHand, opponentPosition, shotProfile.contactHeight, shotProfile.minimumNetClearanceM, shotType, spin, spinRateRpm, surface, windVelocity]);
  const bounce = trajectory.events.find((event) => event.type === 'bounce');
  const camera = useMemo<CameraConfiguration>(() => ({ eyeHeight, behindBaseline, lateral, yaw, pitch, fov }), [behindBaseline, eyeHeight, fov, lateral, pitch, yaw]);

  useEffect(() => {
    const timeout = window.setTimeout(() => onPreferencesChange({ sessionCategory, trajectoryEnabled, launchSpeedKmh, interval, repetitions, variation, timingVariation, workBlockSize, restSeconds, surface, shotType, spin, spinRateRpm, bounceFactor, opponentHand, serveRhythm, landingDepthM, aimDirectionDeg, opponentPosition, camera, environment, quality, screenWidthCm, screenHeightCm, viewDistanceCm }), 180);
    return () => window.clearTimeout(timeout);
  }, [aimDirectionDeg, bounceFactor, camera, environment, interval, landingDepthM, launchSpeedKmh, onPreferencesChange, opponentHand, opponentPosition, quality, repetitions, restSeconds, screenHeightCm, screenWidthCm, serveRhythm, sessionCategory, shotType, spin, spinRateRpm, surface, timingVariation, trajectoryEnabled, variation, viewDistanceCm, workBlockSize]);

  useEffect(() => {
    let frame = 0;
    let lastFrame = performance.now();
    const clearMovement = () => {
      heldMovementKeys.current.clear();
      fastMovement.current = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
    const applyMovement = (distance: number) => {
      const movement = cameraMovementForKeys(heldMovementKeys.current, distance);
      if (movement.behindBaseline) setBehindBaseline((value) => Math.min(6, Math.max(-10, value + movement.behindBaseline)));
      if (movement.lateral) setLateral((value) => Math.min(7, Math.max(-7, value + movement.lateral)));
      if (movement.behindBaseline || movement.lateral) setSelectedPositionPreset('');
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
      if (event.key === 'Shift') fastMovement.current = true;
      if (dialog || target?.matches('input:not([type="range"]), textarea, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (!['w', 'a', 's', 'd'].includes(key)) return;
      event.preventDefault();
      fastMovement.current = event.shiftKey;
      const movementKey = key as CameraMoveKey;
      const isNewPress = !heldMovementKeys.current.has(movementKey);
      heldMovementKeys.current.add(movementKey);
      if (isNewPress) applyMovement(event.shiftKey ? 0.1 : 0.04);
      if (!frame) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(moveFrame);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') fastMovement.current = false;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) heldMovementKeys.current.delete(key as CameraMoveKey);
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearMovement();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearMovement);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearMovement);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearMovement();
    };
  }, [dialog]);

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
  };

  const changeShotType = (nextShotType: PracticeShotType) => {
    const profile = PRACTICE_SHOT_PROFILES[nextShotType];
    setShotType(nextShotType);
    setSpin(profile.defaultSpin);
    setSpinRateRpm(spinRateForPracticeShot(nextShotType, profile.defaultSpin, undefined));
    setLaunchSpeedKmh(profile.defaultLaunchSpeedKmh);
    setLandingDepthM(profile.defaultLandingDepthM);
    setOpponentPosition(profile.opponentPosition);
    setAimDirectionDeg(0);
    setResetToken((value) => value + 1);
  };

  const changeSpin = (nextSpinValue: string) => {
    const nextSpin = spinForPracticeShot(shotType, nextSpinValue);
    setSpin(nextSpin);
    setSpinRateRpm(spinRateForPracticeShot(shotType, nextSpin, undefined));
  };

  const applyPerspective = (preset: PerspectivePresetV1) => {
    setYaw(preset.perspective.yaw);
    setPitch(preset.perspective.pitch);
    setFov(preset.perspective.fov);
    setSelectedPerspectivePreset(preset.id);
  };

  const choosePractice = (preset: typeof PRACTICE_PRESETS[number]) => {
    const nextDrill = DRILL_BY_CATEGORY.get(preset.category);
    setPracticePreset(preset.id);
    setSessionCategory(preset.category);
    changeShotType(preset.shotType);
    setOpponentPosition(preset.opponent);
    const position = cameraPositionPresets.find((item) => item.id === preset.cameraPresetId);
    if (position) applyCameraPosition(position);
    if (nextDrill) { setIntervalValue(nextDrill.defaultInterval); setRepetitions(nextDrill.defaultRepetitions); }
  };

  const resetView = () => {
    if (cameraPositionPresets[0]) applyCameraPosition(cameraPositionPresets[0]);
    if (perspectivePresets[0]) applyPerspective(perspectivePresets[0]);
  };

  const updatePositionPreset = (preset: CameraPositionPresetV1) => {
    onSaveCameraPositionPreset({ ...preset, position: { eyeHeight, behindBaseline, lateral } });
    setSelectedPositionPreset(preset.id);
    setPresetNotice(`${preset.name} position updated`);
  };

  const updatePerspectivePreset = (preset: PerspectivePresetV1) => {
    onSavePerspectivePreset({ ...preset, perspective: { yaw, pitch, fov } });
    setSelectedPerspectivePreset(preset.id);
    setPresetNotice(`${preset.name} perspective updated`);
  };

  const createPreset = () => {
    const name = presetName.trim() || 'Untitled preset';
    if (dialog === 'new-position') {
      const id = `position-${crypto.randomUUID().slice(0, 8)}`;
      onSaveCameraPositionPreset({ id, name, position: { eyeHeight, behindBaseline, lateral } });
      setSelectedPositionPreset(id);
    } else {
      const id = `perspective-${crypto.randomUUID().slice(0, 8)}`;
      onSavePerspectivePreset({ id, name, perspective: { yaw, pitch, fov } });
      setSelectedPerspectivePreset(id);
    }
    setPresetNotice(`${name} created`);
    setDialog(null);
  };

  const launch = () => onStart({
    session: compileSession(drill, { repetitions, interval, variationPercent: variation, timingVariationPercent: timingVariation, launchSpeedKmh, surface, seed, spin, spinRateRpm, practiceShotType: shotType, bounceFactor, opponentHand, workBlockSize, restSeconds, serveRhythm, landingDepthM, aimDirectionDeg, opponentPosition, windVelocity }),
    trajectoryEnabled,
    camera,
    environment,
    surface,
    quality,
  });

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
    <main className="app-shell setup-shell">
      <AppHeader route={route} onRoute={onRoute} onDisplay={() => setDialog('display')} onHelp={() => setDialog('help')} />
      <section className="practice-layout">
        <aside className="session-rail compact-practice-rail" aria-label="Practice presets">
          <h1>Practice</h1>
          <p className="rail-intro">Choose a starting camera and incoming-ball setup.</p>
          <p className="compact-display-notice">Setup works here. For safe physical shadow-swing practice, use a larger display with a cleared practice area.</p>
          <div className="session-list">
            {PRACTICE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return <button type="button" key={preset.id} className={practicePreset === preset.id ? 'session-row selected' : 'session-row'} onClick={() => choosePractice(preset)}><Icon size={21} /><span>{preset.label}</span></button>;
            })}
          </div>
          <div className="practice-preset-summary"><span>{activePractice.label} setup</span><strong>{shotProfile.label} · {practiceSpinLabel(shotType, spin)}</strong><small>Opponent {opponentPosition.x.toFixed(1)}, {opponentPosition.z.toFixed(1)} m</small></div>
        </aside>

        <section className="preview-column" aria-label="Live court preview">
          <div className="setup-court-view">
            <SceneViewport camera={camera} trajectory={trajectory} surface={surface} environment={environment} quality={quality} running resetToken={resetToken} showTrajectory={trajectoryEnabled} trajectoryInterval={interval} onAimChange={setAimDirectionDeg} onCameraFovChange={updateCameraFov} onCameraLookChange={updateCameraLook} onMetrics={onMetrics} />
            <div className="court-metadata" aria-live="polite">{metrics ? `${metrics.renderer} · ${metrics.fps} fps · ${metrics.pixelRatio.toFixed(2)}× ${metrics.quality}` : 'Starting renderer'} · Every {interval.toFixed(1)} s</div>
          </div>
          <div className="preset-toolbar">
            <div className="preset-group" aria-label="Camera position presets">
              <header><span><MapPin size={14} /> Camera positions</span><small>WASD to move · right-click to update</small></header>
              <div>{cameraPositionPresets.map((preset) => <button key={preset.id} type="button" className={selectedPositionPreset === preset.id ? 'preset-chip active' : 'preset-chip'} onClick={() => applyCameraPosition(preset)} onContextMenu={(event) => { event.preventDefault(); updatePositionPreset(preset); }}>{preset.name}</button>)}<button className="preset-add" type="button" aria-label="Create camera position preset" onClick={() => { setPresetName('My position'); setDialog('new-position'); }}><Plus size={15} /></button></div>
            </div>
            <div className="preset-group" aria-label="Perspective presets">
              <header><span><Eye size={14} /> Perspectives</span><small>Right-click to update</small></header>
              <div>{perspectivePresets.map((preset) => <button key={preset.id} type="button" className={selectedPerspectivePreset === preset.id ? 'preset-chip active' : 'preset-chip'} onClick={() => applyPerspective(preset)} onContextMenu={(event) => { event.preventDefault(); updatePerspectivePreset(preset); }}>{preset.name}</button>)}<button className="preset-add" type="button" aria-label="Create perspective preset" onClick={() => { setPresetName('My perspective'); setDialog('new-perspective'); }}><Plus size={15} /></button></div>
            </div>
            <button className="reset-link" type="button" onClick={resetView}><RotateCcw size={15} /> Reset view</button>
            {presetNotice ? <span className="preset-notice" role="status">{presetNotice}</span> : null}
          </div>
        </section>

        <aside className="inspector" aria-label="Practice configuration">
          <h2>Practice configuration</h2>
          <SetupSection title="Ball & rhythm" subtitle="Flight, speed, timing" open>
            <label className="toggle-field"><span>Trajectory</span><button type="button" role="switch" aria-checked={trajectoryEnabled} className={trajectoryEnabled ? 'toggle active' : 'toggle'} onClick={() => setTrajectoryEnabled((value) => !value)}><span /></button><small>{trajectoryEnabled ? 'On' : 'Off'}</small></label>
            <label className="select-field"><span>Shot type</span><select aria-label="Shot type" value={shotType} onChange={(event) => changeShotType(event.target.value as PracticeShotType)}><option value="groundstroke">Groundstroke</option><option value="serve">Serve</option><option value="volley">Volley</option><option value="lob">Lob</option></select></label>
            <RangeField label="Launch speed" value={launchSpeedKmh} min={shotProfile.launchSpeedRangeKmh.min} max={shotProfile.launchSpeedRangeKmh.max} step={1} unit="km/h" onChange={setLaunchSpeedKmh} />
            <label className="select-field"><span>Spin type</span><select aria-label="Spin type" value={spin} disabled={shotType === 'volley'} onChange={(event) => changeSpin(event.target.value)}>{shotProfile.spins.map((option) => <option key={option} value={option}>{practiceSpinLabel(shotType, option)}</option>)}</select></label>
            {shotType !== 'volley' ? <RangeField label="Spin rate" value={spinRateRpm} min={spinRateProfile.minRpm} max={spinRateProfile.maxRpm} step={1} unit="rpm" onChange={setSpinRateRpm} /> : null}
            <RangeField label="Landing depth" value={landingDepthM} min={shotProfile.landingDepthRangeM.min} max={shotProfile.landingDepthRangeM.max} step={0.1} unit="m" onChange={setLandingDepthM} />
            <RangeField label="Interval" value={interval} min={1.5} max={8} step={0.1} unit="s" onChange={setIntervalValue} />
          </SetupSection>
          <SetupSection title="Ball arrival" subtitle="Surface response and perceived height"><RangeField label="Bounce height" value={bounceFactor} min={0.6} max={1.4} step={0.05} unit="×" onChange={setBounceFactor} /></SetupSection>
          <SetupSection title="Practice set" subtitle="Repetitions and recovery"><RangeField label="Repetitions" value={repetitions} min={1} max={50} step={1} unit="" onChange={setRepetitions} /><RangeField label="Shot variation" value={variation} min={0} max={25} step={1} unit="%" onChange={setVariation} /><RangeField label="Timing variation" value={timingVariation} min={0} max={30} step={1} unit="%" onChange={setTimingVariation} /><RangeField label="Work block" value={workBlockSize} min={1} max={20} step={1} unit="reps" onChange={setWorkBlockSize} /><RangeField label="Rest" value={restSeconds} min={0} max={120} step={5} unit="s" onChange={setRestSeconds} /></SetupSection>
          <SetupSection title="Opponent" subtitle="Position and delivery" open><button type="button" className="configuration-action" onClick={() => setDialog('opponent')}><UserRound size={16} /><span>Position opponent</span><small>{opponentPosition.x.toFixed(1)}, {opponentPosition.z.toFixed(1)} m</small></button><label className="select-field"><span>Hand</span><select value={opponentHand} onChange={(event) => setOpponentHand(event.target.value as 'left' | 'right')}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>{shotType === 'serve' ? <label className="select-field"><span>Serve rhythm</span><select value={serveRhythm} onChange={(event) => setServeRhythm(event.target.value as 'preset' | 'normal' | 'compact')}><option value="preset">Drill preset</option><option value="normal">Normal · high toss</option><option value="compact">Compact · quick toss</option></select></label> : null}</SetupSection>
          <SetupSection title="Venue" subtitle="Court, light, weather">
            <label className="select-field"><span>Venue</span><select value={venue} onChange={(event) => changeVenue(event.target.value as VenueId)}>{(Object.entries(VENUE_LABELS) as [VenueId, string][]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label className="select-field"><span>Surface</span><select value={surface} onChange={(event) => setSurface(event.target.value as SurfaceId)}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>
            <label className="select-field"><span>Lighting</span><select value={lighting} onChange={(event) => { const next = event.target.value as LightingPreset; setLighting(next); if (next === 'day' || next === 'golden-hour' || next === 'night') setTimeOfDay(OUTDOOR_TIME_BY_LIGHTING[next]); }}>{isOutdoorVenue(venue) ? <><option value="day">Day</option><option value="golden-hour">Golden hour</option><option value="night">Night floodlights</option></> : <><option value="indoor-neutral">Neutral</option><option value="indoor-warm">Warm</option><option value="indoor-bright">Bright match</option></>}</select></label>
            {isOutdoorVenue(venue) ? <><RangeField label="Time of day" value={timeOfDay} min={5} max={23} step={0.25} unit="h" onChange={setTimeOfDay} /><label className="select-field"><span>Weather</span><select value={weather} onChange={(event) => { const next = event.target.value as WeatherCondition; setWeather(next); setWeatherIntensity(next === 'clear' ? 0 : Math.max(0.45, weatherIntensity)); }}><option value="clear">Clear</option><option value="overcast">Overcast</option><option value="rain">Rain</option></select></label>{weather !== 'clear' ? <RangeField label="Weather level" value={weatherIntensity} min={0.1} max={1} step={0.05} unit="×" onChange={setWeatherIntensity} /> : null}</> : null}
            <RangeField label={isOutdoorVenue(venue) ? 'Sun direction' : 'Light direction'} value={lightDirection} min={-180} max={180} step={5} unit="°" onChange={setLightDirection} /><RangeField label="Light level" value={lightIntensity} min={0.35} max={1.5} step={0.05} unit="×" onChange={setLightIntensity} /><RangeField label="Wind direction" value={windDirection} min={-180} max={180} step={5} unit="°" onChange={setWindDirection} /><RangeField label="Wind speed" value={windSpeedMps} min={0} max={15} step={0.5} unit="m/s" onChange={setWindSpeedMps} />
          </SetupSection>
          <SetupSection title="Perspective" subtitle="360° look and field of view"><RangeField label="Yaw" value={yaw} min={-180} max={180} step={0.1} unit="°" onChange={(value) => { setYaw(value); setSelectedPerspectivePreset(''); }} /><RangeField label="Pitch" value={pitch} min={-180} max={180} step={0.1} unit="°" onChange={(value) => { setPitch(value); setSelectedPerspectivePreset(''); }} /><RangeField label="FOV" value={fov} min={CAMERA_FOV_MIN} max={CAMERA_FOV_MAX} step={1} unit="° H" onChange={updateCameraFov} /><button type="button" className="text-action" onClick={() => setDialog('display')}>Use physical display measurements</button></SetupSection>
          <SetupSection title="System" subtitle="Quality and repeatability"><label className="select-field"><span>Quality</span><select value={quality} onChange={(event) => setQuality(event.target.value as QualityMode)}><option value="auto">Auto adaptive</option><option value="performance">Performance</option><option value="quality">Quality</option></select></label><label className="text-field"><span>Seed</span><input aria-label="Seed" value={seed} inputMode="numeric" onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10) || '0')} /></label></SetupSection>
          <div className="inspector-actions"><button className="primary-button" type="button" onClick={requestStart}>Start practice</button></div>
        </aside>
      </section>
      {dialog === 'safety' ? <Modal title="Make room to swing" actions={<><button className="secondary-button" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button inline" type="button" disabled={!safetyChecked} onClick={() => { localStorage.setItem('tenmulate.safetyAcknowledged', 'true'); setDialog(null); launch(); }}>Continue</button></>}><p>Move furniture, people, pets, and breakable objects beyond your full racket-and-arm reach. Tenmulate does not measure your room.</p><label className="check-row"><input type="checkbox" checked={safetyChecked} onChange={(event) => setSafetyChecked(event.target.checked)} /> I have cleared a safe practice area.</label></Modal> : null}
      {dialog === 'opponent' ? <Modal title="Opponent position" onClose={() => setDialog(null)} actions={<button className="primary-button inline" type="button" onClick={() => setDialog(null)}>Done</button>}><p>Drag the opponent anywhere on the floor plan, or start from a court preset.</p><div className="court-preset-list">{OPPONENT_POSITION_PRESETS.map((preset) => <button type="button" key={preset.name} onClick={() => setOpponentPosition(preset.point)}>{preset.name}</button>)}</div><CourtPlan opponent={opponentPosition} landing={bounce?.position ?? null} onOpponentChange={setOpponentPosition} /><p className="calculation">Opponent floor position: {opponentPosition.x.toFixed(2)}, {opponentPosition.z.toFixed(2)} m</p></Modal> : null}
      {dialog === 'display' ? <Modal title="Physical display view" onClose={() => setDialog(null)} actions={<button className="primary-button inline" type="button" onClick={applyPhysicalFov}>Apply calculated FOV</button>}><p>Enter the visible screen width and height plus your eye-to-screen distance. This calculates physical horizontal and vertical FOV without changing court geometry.</p><label className="dialog-field"><span>Screen width</span><input type="number" min="30" max="1000" value={screenWidthCm} onChange={(event) => setScreenWidthCm(Number(event.target.value))} /><small>cm</small></label><label className="dialog-field"><span>Screen height</span><input type="number" min="20" max="1000" value={screenHeightCm} onChange={(event) => setScreenHeightCm(Number(event.target.value))} /><small>cm</small></label><label className="dialog-field"><span>Viewing distance</span><input type="number" min="30" max="1500" value={viewDistanceCm} onChange={(event) => setViewDistanceCm(Number(event.target.value))} /><small>cm</small></label><p className="calculation">Calculated FOV: {Math.round((2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI)}° horizontal · {Math.round((2 * Math.atan(screenHeightCm / (2 * viewDistanceCm)) * 180) / Math.PI)}° vertical</p></Modal> : null}
      {dialog === 'help' ? <Modal title="Practice controls" onClose={() => setDialog(null)}><dl className="shortcut-list"><div><dt>WASD</dt><dd>Move freely around the court during setup</dd></div><div><dt>Shift</dt><dd>Move faster while held</dd></div><div><dt>Left drag</dt><dd>Turn and pitch the FPV camera through the full 360° range</dd></div><div><dt>Wheel</dt><dd>Zoom the FPV camera by changing its field of view</dd></div><div><dt>Right drag</dt><dd>Aim the opponent’s shot directly on the FPV court</dd></div><div><dt>Preset click</dt><dd>Right-click a bottom preset to update it</dd></div><div><dt>Space</dt><dd>Pause or resume practice</dd></div></dl></Modal> : null}
      {dialog === 'new-position' || dialog === 'new-perspective' ? <Modal title={dialog === 'new-position' ? 'New camera position' : 'New perspective'} onClose={() => setDialog(null)} actions={<><button className="secondary-button" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button inline" type="button" onClick={createPreset}>Create preset</button></>}><label className="stack-field"><span>Preset name</span><input autoFocus maxLength={40} value={presetName} onChange={(event) => setPresetName(event.target.value)} /></label></Modal> : null}
    </main>
  );
}
