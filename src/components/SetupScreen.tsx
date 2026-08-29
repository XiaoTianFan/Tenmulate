import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Crosshair,
  Gauge,
  PencilLine,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Target,
  TimerReset,
  Trash2,
  Trophy,
} from 'lucide-react';
import { DRILL_BY_CATEGORY } from '../content/bundled';
import type { SessionCategory } from '../content/types';
import { COURT, type SurfaceId } from '../domain/court';
import { SCENE_DEFINITIONS, VENUE_LABELS, isOutdoorVenue, windVelocityFromEnvironment, type EnvironmentConfiguration, type LightingPreset, type VenueId, type WeatherCondition } from '../domain/environment';
import type { QualityMode, SceneMetrics } from '../engine/rendering/TennisScene';
import { compileSession } from '../engine/session/compileSession';
import { resolveTrajectory, type SpinKind } from '../engine/trajectory/physics';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import type { PracticeMode, SessionLaunch } from '../app/types';
import type { PracticePreferencesV1, SavedViewV1 } from '../storage/appStorage';
import { AppHeader, type AppRoute } from './AppHeader';
import { Modal } from './Modal';
import { OfflineStatus } from './OfflineStatus';
import { SceneViewport } from './SceneViewport';

type BuiltInCameraPresetId = 'realistic' | 'wide' | 'baselineLeft' | 'baselineRight' | 'approach' | 'firstVolley' | 'secondVolley' | 'overhead';
type CameraPresetId = BuiltInCameraPresetId | 'custom';

const sessions: ReadonlyArray<{ label: SessionCategory; icon: typeof Activity }> = [
  { label: 'Quick Rally', icon: Activity },
  { label: 'Return Practice', icon: Target },
  { label: 'Tactical Pattern', icon: Crosshair },
  { label: 'Serve & Volley', icon: Trophy },
  { label: 'Net & Overhead', icon: Gauge },
  { label: 'Custom', icon: PencilLine },
];

const OUTDOOR_TIME_BY_LIGHTING: Readonly<Record<'day' | 'golden-hour' | 'night', number>> = {
  day: 14,
  'golden-hour': 18.5,
  night: 21.5,
};

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

type SetupScreenProps = Readonly<{
  route: AppRoute;
  savedViews: readonly SavedViewV1[];
  initialPreferences: PracticePreferencesV1;
  onRoute: (route: AppRoute) => void;
  onStart: (launch: SessionLaunch) => void;
  onSaveView: (view: SavedViewV1) => void;
  onDeleteView: (id: string) => void;
  onRenameView: (id: string, name: string) => void;
  onPreferencesChange: (preferences: PracticePreferencesV1) => void;
}>;

export function SetupScreen({ route, savedViews, initialPreferences, onRoute, onStart, onSaveView, onDeleteView, onRenameView, onPreferencesChange }: SetupScreenProps) {
  const [sessionCategory, setSessionCategory] = useState<SessionCategory>(initialPreferences.sessionCategory as SessionCategory);
  const [mode, setMode] = useState<PracticeMode>(initialPreferences.mode);
  const [pace, setPace] = useState(initialPreferences.pace);
  const [interval, setIntervalValue] = useState(initialPreferences.interval);
  const [repetitions, setRepetitions] = useState(initialPreferences.repetitions);
  const [variation, setVariation] = useState(initialPreferences.variation);
  const [timingVariation, setTimingVariation] = useState(initialPreferences.timingVariation);
  const [workBlockSize, setWorkBlockSize] = useState(initialPreferences.workBlockSize);
  const [restSeconds, setRestSeconds] = useState(initialPreferences.restSeconds);
  const [visualSurface, setVisualSurface] = useState<SurfaceId>(initialPreferences.visualSurface);
  const [physicsSurface, setPhysicsSurface] = useState<SurfaceId>(initialPreferences.physicsSurface);
  const [spin, setSpin] = useState<'preset' | SpinKind>(initialPreferences.spin);
  const [opponentHand, setOpponentHand] = useState<'left' | 'right'>(initialPreferences.opponentHand);
  const [serveRhythm, setServeRhythm] = useState<'preset' | 'normal' | 'compact'>(initialPreferences.serveRhythm);
  const [netClearanceM, setNetClearanceM] = useState(initialPreferences.netClearanceM);
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
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('realistic');
  const [resetToken, setResetToken] = useState(0);
  const [metrics, setMetrics] = useState<SceneMetrics | null>(null);
  const [dialog, setDialog] = useState<'safety' | 'display' | 'help' | 'saveView' | 'renameView' | null>(null);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [screenWidthCm, setScreenWidthCm] = useState(initialPreferences.screenWidthCm);
  const [screenHeightCm, setScreenHeightCm] = useState(initialPreferences.screenHeightCm);
  const [viewDistanceCm, setViewDistanceCm] = useState(initialPreferences.viewDistanceCm);
  const [selectedSavedView, setSelectedSavedView] = useState('');
  const [viewName, setViewName] = useState('My baseline view');
  const onMetrics = useCallback((next: SceneMetrics) => setMetrics(next), []);

  const drill = DRILL_BY_CATEGORY.get(sessionCategory) ?? DRILL_BY_CATEGORY.get('Quick Rally')!;
  const environment = useMemo<EnvironmentConfiguration>(() => ({
    venue, lighting, lightDirection, lightIntensity, timeOfDay, weather, weatherIntensity, windDirection, windSpeedMps,
  }), [lightDirection, lightIntensity, lighting, timeOfDay, venue, weather, weatherIntensity, windDirection, windSpeedMps]);
  const windVelocity = useMemo(() => windVelocityFromEnvironment(environment), [environment]);
  const trajectory = useMemo(() => resolveTrajectory({
    source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
    target: { x: -2.35, z: -8.9 },
    paceKmh: pace,
    spin: spin === 'preset' ? 'topspin' : spin,
    surface: physicsSurface,
    netClearanceM,
    windVelocity,
  }), [netClearanceM, pace, physicsSurface, spin, windVelocity]);
  const bounce = trajectory.events.find((event) => event.type === 'bounce');
  const net = trajectory.events.find((event) => event.type === 'net-crossing');

  const camera = useMemo(() => ({ eyeHeight, behindBaseline, lateral, yaw, pitch, fov }), [behindBaseline, eyeHeight, fov, lateral, pitch, yaw]);
  useEffect(() => {
    const timeout = window.setTimeout(() => onPreferencesChange({
      sessionCategory, mode, pace, interval, repetitions, variation, timingVariation, workBlockSize, restSeconds, visualSurface, physicsSurface, spin,
      opponentHand, serveRhythm, netClearanceM, camera, environment, quality, screenWidthCm, screenHeightCm, viewDistanceCm,
    }), 180);
    return () => window.clearTimeout(timeout);
  }, [camera, environment, interval, mode, netClearanceM, onPreferencesChange, opponentHand, pace, physicsSurface, quality, repetitions, restSeconds, screenHeightCm, screenWidthCm, serveRhythm, sessionCategory, spin, timingVariation, variation, viewDistanceCm, visualSurface, workBlockSize]);

  const applySavedView = (id: string) => {
    setSelectedSavedView(id);
    const saved = savedViews.find((view) => view.id === id);
    if (!saved) return;
    setEyeHeight(saved.camera.eyeHeight);
    setBehindBaseline(saved.camera.behindBaseline);
    setLateral(saved.camera.lateral);
    setYaw(saved.camera.yaw);
    setPitch(saved.camera.pitch);
    setFov(saved.camera.fov);
    setCameraPreset('custom');
  };

  const saveCurrentView = () => {
    const id = `view-${crypto.randomUUID().slice(0, 8)}`;
    onSaveView({ id, name: viewName.trim() || 'Untitled view', camera });
    setSelectedSavedView(id);
    setDialog(null);
  };

  const applyCameraPreset = (preset: BuiltInCameraPresetId) => {
    setCameraPreset(preset);
    const values = {
      realistic: { eye: 1.7, lateral: 0, behind: 1.5, yaw: 0, pitch: -1.7, fov: 70 },
      wide: { eye: 1.72, lateral: 0, behind: 2.2, yaw: 0, pitch: -1.7, fov: 84 },
      baselineLeft: { eye: 1.68, lateral: -2.6, behind: 1.4, yaw: 7, pitch: -1.7, fov: 74 },
      baselineRight: { eye: 1.68, lateral: 2.6, behind: 1.4, yaw: -7, pitch: -1.7, fov: 74 },
      approach: { eye: 1.67, lateral: 0, behind: -4.68, yaw: 0, pitch: -1.2, fov: 76 },
      firstVolley: { eye: 1.66, lateral: -0.8, behind: -6.7, yaw: 3, pitch: -0.8, fov: 78 },
      secondVolley: { eye: 1.65, lateral: 0.8, behind: -8.4, yaw: -4, pitch: -0.4, fov: 80 },
      overhead: { eye: 1.7, lateral: 0, behind: -3.2, yaw: 0, pitch: 4, fov: 82 },
    }[preset];
    setEyeHeight(values.eye);
    setLateral(values.lateral);
    setBehindBaseline(values.behind);
    setYaw(values.yaw);
    setPitch(values.pitch);
    setFov(values.fov);
  };

  const selectSession = (category: SessionCategory) => {
    const nextDrill = DRILL_BY_CATEGORY.get(category);
    setSessionCategory(category);
    if (nextDrill) {
      setIntervalValue(nextDrill.defaultInterval);
      setRepetitions(nextDrill.defaultRepetitions);
    }
  };

  const launch = () => {
    onStart({
      session: compileSession(drill, {
        repetitions,
        interval,
        variationPercent: variation,
        timingVariationPercent: timingVariation,
        paceKmh: pace,
        surface: physicsSurface,
        seed,
        spin,
        opponentHand,
        workBlockSize,
        restSeconds,
        serveRhythm,
        netClearanceM,
        windVelocity,
      }),
      mode,
      camera,
      environment,
      visualSurface,
      quality,
    });
  };

  const requestStart = () => {
    practiceAudio.unlock();
    if (localStorage.getItem('tenmulate.safetyAcknowledged') === 'true') launch();
    else setDialog('safety');
  };

  const applyPhysicalFov = () => {
    const nextFov = (2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI;
    setFov(Math.min(105, Math.max(20, Math.round(nextFov))));
    setCameraPreset('custom');
    setDialog(null);
  };

  return (
    <main className="app-shell">
      <AppHeader route={route} onRoute={onRoute} onDisplay={() => setDialog('display')} onHelp={() => setDialog('help')} />
      <section className="practice-layout">
        <aside className="session-rail" aria-label="Session types">
          <h1>Choose a session</h1>
          <p className="compact-display-notice">Setup works here. For safe physical shadow-swing practice, use a larger display with a cleared practice area.</p>
          <div className="session-list">
            {sessions.map(({ label, icon: Icon }) => (
              <button type="button" key={label} className={sessionCategory === label ? 'session-row selected' : 'session-row'} onClick={() => selectSession(label)}>
                <Icon size={21} /><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="recent-list">
            <h2>Recent</h2>
            <button type="button" onClick={() => selectSession('Quick Rally')}><TimerReset size={17} /> Crosscourt Rhythm</button>
            <button type="button" onClick={() => selectSession('Return Practice')}><TimerReset size={17} /> Serve Recognition</button>
          </div>
          <OfflineStatus />
        </aside>

        <section className="preview-column" aria-label="Live court preview">
          <SceneViewport camera={camera} trajectory={trajectory} surface={visualSurface} environment={environment} quality={quality} running resetToken={resetToken} showTrajectory={mode === 'learning'} onMetrics={onMetrics} />
          <div className="preview-toolbar">
            <button className={cameraPreset === 'realistic' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('realistic')}><Crosshair size={18} /><span>Realistic</span></button>
            <button className={cameraPreset === 'wide' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('wide')}><SlidersHorizontal size={18} /><span>Wide</span></button>
            <button className={cameraPreset === 'baselineLeft' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('baselineLeft')}><span>Baseline L</span></button>
            <button className={cameraPreset === 'baselineRight' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('baselineRight')}><span>Baseline R</span></button>
            <button className={cameraPreset === 'approach' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('approach')}><span>Approach</span></button>
            <button className={cameraPreset === 'firstVolley' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('firstVolley')}><span>First volley</span></button>
            <button className={cameraPreset === 'secondVolley' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('secondVolley')}><span>Second volley</span></button>
            <button className={cameraPreset === 'overhead' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('overhead')}><span>Overhead</span></button>
            <button className="reset-link" type="button" onClick={() => applyCameraPreset('realistic')}><RotateCcw size={15} /> Reset view</button>
          </div>
          <div className="preview-diagnostics" aria-live="polite">
            <span>{metrics ? `${metrics.renderer} · ${metrics.fps} fps · ${metrics.frameMs.toFixed(1)} ms · ${metrics.pixelRatio.toFixed(2)}× ${metrics.quality}` : 'Starting renderer…'}</span>
            <span>{net ? `Net ${net.position.y.toFixed(2)} m` : 'No net crossing'} · {bounce ? `Bounce ${bounce.position.x.toFixed(2)}, ${bounce.position.z.toFixed(2)} m` : 'No bounce'} · Wind {windSpeedMps.toFixed(1)} m/s</span>
          </div>
        </section>

        <aside className="inspector" aria-label="Session setup">
          <h2>Session setup</h2>
          <fieldset className="mode-switch"><legend>Mode</legend><button type="button" className={mode === 'rehearsal' ? 'active' : ''} onClick={() => setMode('rehearsal')}>Rehearsal</button><button type="button" className={mode === 'learning' ? 'active' : ''} onClick={() => setMode('learning')}>Learning</button></fieldset>
          <RangeField label="Pace" value={pace} min={35} max={165} step={1} unit="km/h" onChange={setPace} />
          <RangeField label="Interval" value={interval} min={1.5} max={8} step={0.1} unit="s" onChange={setIntervalValue} />
          <RangeField label="Repetitions" value={repetitions} min={1} max={50} step={1} unit="" onChange={setRepetitions} />
          <RangeField label="Shot variation" value={variation} min={0} max={25} step={1} unit="%" onChange={setVariation} />
          <RangeField label="Timing variation" value={timingVariation} min={0} max={30} step={1} unit="%" onChange={setTimingVariation} />
          <RangeField label="Work block" value={workBlockSize} min={1} max={20} step={1} unit="reps" onChange={setWorkBlockSize} />
          <RangeField label="Rest" value={restSeconds} min={0} max={120} step={5} unit="s" onChange={setRestSeconds} />
          <label className="select-field"><span>Court appearance</span><select value={visualSurface} onChange={(event) => setVisualSurface(event.target.value as SurfaceId)}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>
          <label className="select-field"><span>Bounce profile</span><select value={physicsSurface} onChange={(event) => setPhysicsSurface(event.target.value as SurfaceId)}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>
          <label className="select-field"><span>Venue</span><select value={venue} onChange={(event) => { const next = event.target.value as VenueId; const definition = SCENE_DEFINITIONS[next]; const preset = definition.defaultLighting; setVenue(next); setVisualSurface(definition.defaultSurface); setLighting(preset); if (preset === 'day' || preset === 'golden-hour' || preset === 'night') setTimeOfDay(OUTDOOR_TIME_BY_LIGHTING[preset]); }}>{(Object.entries(VENUE_LABELS) as [VenueId, string][]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="select-field"><span>Lighting</span><select value={lighting} onChange={(event) => { const next = event.target.value as LightingPreset; setLighting(next); if (next === 'day' || next === 'golden-hour' || next === 'night') setTimeOfDay(OUTDOOR_TIME_BY_LIGHTING[next]); }}>{isOutdoorVenue(venue) ? <><option value="day">Day</option><option value="golden-hour">Golden hour</option><option value="night">Night floodlights</option></> : <><option value="indoor-neutral">Neutral</option><option value="indoor-warm">Warm</option><option value="indoor-bright">Bright match</option></>}</select></label>
          {isOutdoorVenue(venue) ? <>
            <RangeField label="Time of day" value={timeOfDay} min={5} max={23} step={0.25} unit="h" onChange={setTimeOfDay} />
            <label className="select-field"><span>Weather</span><select value={weather} onChange={(event) => { const next = event.target.value as WeatherCondition; setWeather(next); setWeatherIntensity(next === 'clear' ? 0 : Math.max(0.45, weatherIntensity)); }}><option value="clear">Clear</option><option value="overcast">Overcast</option><option value="rain">Rain</option></select></label>
            {weather !== 'clear' ? <RangeField label="Weather level" value={weatherIntensity} min={0.1} max={1} step={0.05} unit="×" onChange={setWeatherIntensity} /> : null}
          </> : null}
          <RangeField label={isOutdoorVenue(venue) ? 'Sun direction' : 'Light direction'} value={lightDirection} min={-180} max={180} step={5} unit="°" onChange={setLightDirection} />
          <RangeField label="Light level" value={lightIntensity} min={0.35} max={1.5} step={0.05} unit="×" onChange={setLightIntensity} />
          <RangeField label="Wind direction" value={windDirection} min={-180} max={180} step={5} unit="°" onChange={setWindDirection} />
          <RangeField label="Wind speed" value={windSpeedMps} min={0} max={15} step={0.5} unit="m/s" onChange={setWindSpeedMps} />
          <label className="select-field"><span>Spin</span><select value={spin} onChange={(event) => setSpin(event.target.value as 'preset' | SpinKind)}><option value="preset">Drill preset</option><option value="flat">Flat</option><option value="topspin">Topspin</option><option value="slice">Slice</option><option value="kick">Kick</option><option value="sidespin">Sidespin</option></select></label>
          <RangeField label="Net clearance" value={netClearanceM} min={0.08} max={1.5} step={0.02} unit="m" onChange={setNetClearanceM} />
          <label className="select-field"><span>Opponent</span><select value={opponentHand} onChange={(event) => setOpponentHand(event.target.value as 'left' | 'right')}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
          <label className="select-field"><span>Serve rhythm</span><select value={serveRhythm} onChange={(event) => setServeRhythm(event.target.value as 'preset' | 'normal' | 'compact')}><option value="preset">Drill preset</option><option value="normal">Normal · high toss</option><option value="compact">Compact · quick toss</option></select></label>
          <label className="select-field"><span>Render quality</span><select value={quality} onChange={(event) => setQuality(event.target.value as QualityMode)}><option value="auto">Auto adaptive</option><option value="performance">Performance</option><option value="quality">Quality</option></select></label>
          <label className="text-field"><span>Seed</span><input aria-label="Seed" value={seed} inputMode="numeric" onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10) || '0')} /></label>
          <div className="inspector-section">
            <h2>View calibration</h2>
            <RangeField label="Eye height" value={eyeHeight} min={1.2} max={2.1} step={0.01} unit="m" onChange={(value) => { setEyeHeight(value); setCameraPreset('custom'); }} />
            <RangeField label="Behind baseline" value={behindBaseline} min={-5} max={4} step={0.05} unit="m" onChange={(value) => { setBehindBaseline(value); setCameraPreset('custom'); }} />
            <RangeField label="Lateral" value={lateral} min={-5} max={5} step={0.05} unit="m" onChange={(value) => { setLateral(value); setCameraPreset('custom'); }} />
            <RangeField label="Yaw" value={yaw} min={-25} max={25} step={0.5} unit="°" onChange={(value) => { setYaw(value); setCameraPreset('custom'); }} />
            <RangeField label="Pitch" value={pitch} min={-12} max={12} step={0.1} unit="°" onChange={(value) => { setPitch(value); setCameraPreset('custom'); }} />
            <RangeField label="FOV" value={fov} min={20} max={105} step={1} unit="° H" onChange={(value) => { setFov(value); setCameraPreset('custom'); }} />
            <button type="button" className="text-action" onClick={() => setDialog('display')}>Use physical display measurements</button>
            <label className="select-field"><span>Saved view</span><select value={selectedSavedView} onChange={(event) => applySavedView(event.target.value)}><option value="">Choose…</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>
            <div className="view-actions">
              <button type="button" onClick={() => { setViewName('My baseline view'); setDialog('saveView'); }}><Save size={14} /> Save view</button>
              <button type="button" disabled={!selectedSavedView} onClick={() => { const saved = savedViews.find((view) => view.id === selectedSavedView); setViewName(saved?.name ?? ''); setDialog('renameView'); }}>Rename</button>
              <button type="button" disabled={!selectedSavedView} onClick={() => { onDeleteView(selectedSavedView); setSelectedSavedView(''); }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
          <div className="inspector-actions">
            <button className="primary-button" type="button" onClick={requestStart}>Start practice</button>
            <button className="text-action centered" type="button" onClick={() => { setMode('learning'); setResetToken((value) => value + 1); }}><Play size={15} /> Preview trajectory</button>
          </div>
        </aside>
      </section>
      <footer className="safety-footer">Clear a safe practice area before starting</footer>

      {dialog === 'safety' ? (
        <Modal title="Make room to swing" actions={<><button className="secondary-button" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button inline" type="button" disabled={!safetyChecked} onClick={() => { localStorage.setItem('tenmulate.safetyAcknowledged', 'true'); setDialog(null); launch(); }}>Continue</button></>}>
          <p>Move furniture, people, pets, and breakable objects beyond your full racket-and-arm reach. Tenmulate does not measure your room.</p>
          <label className="check-row"><input type="checkbox" checked={safetyChecked} onChange={(event) => setSafetyChecked(event.target.checked)} /> I have cleared a safe practice area.</label>
        </Modal>
      ) : null}
      {dialog === 'display' ? (
        <Modal title="Physical display view" onClose={() => setDialog(null)} actions={<button className="primary-button inline" type="button" onClick={applyPhysicalFov}>Apply calculated FOV</button>}>
          <p>Enter the visible screen width and height plus your eye-to-screen distance. This calculates physical horizontal and vertical FOV without changing court geometry.</p>
          <label className="dialog-field"><span>Screen width</span><input type="number" min="30" max="1000" value={screenWidthCm} onChange={(event) => setScreenWidthCm(Number(event.target.value))} /><small>cm</small></label>
          <label className="dialog-field"><span>Screen height</span><input type="number" min="20" max="1000" value={screenHeightCm} onChange={(event) => setScreenHeightCm(Number(event.target.value))} /><small>cm</small></label>
          <label className="dialog-field"><span>Viewing distance</span><input type="number" min="30" max="1500" value={viewDistanceCm} onChange={(event) => setViewDistanceCm(Number(event.target.value))} /><small>cm</small></label>
          <p className="calculation">Calculated FOV: {Math.round((2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI)}° horizontal · {Math.round((2 * Math.atan(screenHeightCm / (2 * viewDistanceCm)) * 180) / Math.PI)}° vertical</p>
          <p className="scale-check">Scale check: singles court 8.23 m wide · center net 0.914 m · tennis ball 6.7 cm diameter.</p>
        </Modal>
      ) : null}
      {dialog === 'help' ? (
        <Modal title="Practice controls" onClose={() => setDialog(null)}>
          <dl className="shortcut-list"><div><dt>Space</dt><dd>Pause or resume</dd></div><div><dt>R</dt><dd>Restart the set</dd></div><div><dt>F</dt><dd>Enter or leave full screen</dd></div><div><dt>Esc</dt><dd>Pause before leaving</dd></div></dl>
        </Modal>
      ) : null}
      {dialog === 'saveView' || dialog === 'renameView' ? (
        <Modal title={dialog === 'saveView' ? 'Save camera view' : 'Rename camera view'} onClose={() => setDialog(null)} actions={<><button className="secondary-button" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="primary-button inline" type="button" onClick={() => { if (dialog === 'saveView') saveCurrentView(); else { onRenameView(selectedSavedView, viewName.trim() || 'Untitled view'); setDialog(null); } }}>{dialog === 'saveView' ? 'Save view' : 'Rename'}</button></>}>
          <label className="stack-field"><span>View name</span><input autoFocus maxLength={60} value={viewName} onChange={(event) => setViewName(event.target.value)} /></label>
        </Modal>
      ) : null}
    </main>
  );
}
