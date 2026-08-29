import { useCallback, useMemo, useState } from 'react';
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
import { DEFAULT_ENVIRONMENT, VENUE_LABELS, type EnvironmentConfiguration, type LightingPreset, type VenueId } from '../domain/environment';
import type { SceneMetrics } from '../engine/rendering/TennisScene';
import { compileSession } from '../engine/session/compileSession';
import { resolveTrajectory, type SpinKind } from '../engine/trajectory/physics';
import type { PracticeMode, SessionLaunch } from '../app/types';
import type { SavedViewV1 } from '../storage/appStorage';
import { AppHeader, type AppRoute } from './AppHeader';
import { Modal } from './Modal';
import { OfflineStatus } from './OfflineStatus';
import { SceneViewport } from './SceneViewport';

type CameraPresetId = 'realistic' | 'wide' | 'baselineLeft' | 'baselineRight' | 'approach';

const sessions: ReadonlyArray<{ label: SessionCategory; icon: typeof Activity }> = [
  { label: 'Quick Rally', icon: Activity },
  { label: 'Return Practice', icon: Target },
  { label: 'Tactical Pattern', icon: Crosshair },
  { label: 'Serve & Volley', icon: Trophy },
  { label: 'Net & Overhead', icon: Gauge },
  { label: 'Custom', icon: PencilLine },
];

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
  onRoute: (route: AppRoute) => void;
  onStart: (launch: SessionLaunch) => void;
  onSaveView: (view: SavedViewV1) => void;
  onDeleteView: (id: string) => void;
  onRenameView: (id: string, name: string) => void;
}>;

export function SetupScreen({ route, savedViews, onRoute, onStart, onSaveView, onDeleteView, onRenameView }: SetupScreenProps) {
  const [sessionCategory, setSessionCategory] = useState<SessionCategory>('Quick Rally');
  const [mode, setMode] = useState<PracticeMode>('rehearsal');
  const [pace, setPace] = useState(78);
  const [interval, setIntervalValue] = useState(3.2);
  const [repetitions, setRepetitions] = useState(12);
  const [variation, setVariation] = useState(8);
  const [workBlockSize, setWorkBlockSize] = useState(4);
  const [restSeconds, setRestSeconds] = useState(20);
  const [surface, setSurface] = useState<SurfaceId>('hard');
  const [spin, setSpin] = useState<'preset' | SpinKind>('preset');
  const [opponentHand, setOpponentHand] = useState<'left' | 'right'>('right');
  const [venue, setVenue] = useState<VenueId>(DEFAULT_ENVIRONMENT.venue);
  const [lighting, setLighting] = useState<LightingPreset>(DEFAULT_ENVIRONMENT.lighting);
  const [lightDirection, setLightDirection] = useState(DEFAULT_ENVIRONMENT.lightDirection);
  const [lightIntensity, setLightIntensity] = useState(DEFAULT_ENVIRONMENT.lightIntensity);
  const [seed, setSeed] = useState('18427');
  const [eyeHeight, setEyeHeight] = useState<number>(COURT.defaultEyeHeight);
  const [behindBaseline, setBehindBaseline] = useState<number>(COURT.defaultBehindBaseline);
  const [lateral, setLateral] = useState(0);
  const [fov, setFov] = useState(70);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('realistic');
  const [resetToken, setResetToken] = useState(0);
  const [metrics, setMetrics] = useState<SceneMetrics | null>(null);
  const [dialog, setDialog] = useState<'safety' | 'display' | 'help' | 'saveView' | 'renameView' | null>(null);
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [screenWidthCm, setScreenWidthCm] = useState(120);
  const [viewDistanceCm, setViewDistanceCm] = useState(250);
  const [selectedSavedView, setSelectedSavedView] = useState('');
  const [viewName, setViewName] = useState('My baseline view');
  const onMetrics = useCallback((next: SceneMetrics) => setMetrics(next), []);

  const drill = DRILL_BY_CATEGORY.get(sessionCategory) ?? DRILL_BY_CATEGORY.get('Quick Rally')!;
  const trajectory = useMemo(() => resolveTrajectory({
    source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
    target: { x: -2.35, z: -8.9 },
    paceKmh: pace,
    spin: spin === 'preset' ? 'topspin' : spin,
    surface,
  }), [pace, spin, surface]);
  const bounce = trajectory.events.find((event) => event.type === 'bounce');
  const net = trajectory.events.find((event) => event.type === 'net-crossing');

  const camera = useMemo(() => ({ eyeHeight, behindBaseline, lateral, yaw: 0, pitch: -1.7, fov }), [behindBaseline, eyeHeight, fov, lateral]);
  const environment = useMemo<EnvironmentConfiguration>(() => ({ venue, lighting, lightDirection, lightIntensity }), [lightDirection, lightIntensity, lighting, venue]);

  const applySavedView = (id: string) => {
    setSelectedSavedView(id);
    const saved = savedViews.find((view) => view.id === id);
    if (!saved) return;
    setEyeHeight(saved.camera.eyeHeight);
    setBehindBaseline(saved.camera.behindBaseline);
    setLateral(saved.camera.lateral);
    setFov(saved.camera.fov);
    setCameraPreset('realistic');
  };

  const saveCurrentView = () => {
    const id = `view-${crypto.randomUUID().slice(0, 8)}`;
    onSaveView({ id, name: viewName.trim() || 'Untitled view', camera });
    setSelectedSavedView(id);
    setDialog(null);
  };

  const applyCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    const values = {
      realistic: { lateral: 0, behind: 1.5, fov: 70 },
      wide: { lateral: 0, behind: 2.2, fov: 84 },
      baselineLeft: { lateral: -2.6, behind: 1.4, fov: 74 },
      baselineRight: { lateral: 2.6, behind: 1.4, fov: 74 },
      approach: { lateral: 0, behind: -4.68, fov: 76 },
    }[preset];
    setLateral(values.lateral);
    setBehindBaseline(values.behind);
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
        paceKmh: pace,
        surface,
        seed,
        spin,
        opponentHand,
        workBlockSize,
        restSeconds,
      }),
      mode,
      camera,
      environment,
    });
  };

  const requestStart = () => {
    if (localStorage.getItem('tenmulate.safetyAcknowledged') === 'true') launch();
    else setDialog('safety');
  };

  const applyPhysicalFov = () => {
    const nextFov = (2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI;
    setFov(Math.min(105, Math.max(45, Math.round(nextFov))));
    setCameraPreset('realistic');
    setDialog(null);
  };

  return (
    <main className="app-shell">
      <AppHeader route={route} onRoute={onRoute} onDisplay={() => setDialog('display')} onHelp={() => setDialog('help')} />
      <section className="practice-layout">
        <aside className="session-rail" aria-label="Session types">
          <h1>Choose a session</h1>
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
          <SceneViewport camera={camera} trajectory={trajectory} surface={surface} environment={environment} running resetToken={resetToken} showTrajectory={mode === 'learning'} onMetrics={onMetrics} />
          <div className="preview-toolbar">
            <button className={cameraPreset === 'realistic' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('realistic')}><Crosshair size={18} /><span>Realistic</span></button>
            <button className={cameraPreset === 'wide' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('wide')}><SlidersHorizontal size={18} /><span>Wide</span></button>
            <button className={cameraPreset === 'baselineLeft' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('baselineLeft')}><span>Baseline L</span></button>
            <button className={cameraPreset === 'baselineRight' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('baselineRight')}><span>Baseline R</span></button>
            <button className={cameraPreset === 'approach' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('approach')}><span>Approach</span></button>
            <button className="reset-link" type="button" onClick={() => applyCameraPreset('realistic')}><RotateCcw size={15} /> Reset view</button>
          </div>
          <div className="preview-diagnostics" aria-live="polite">
            <span>{metrics ? `${metrics.renderer} · ${metrics.fps} fps · ${metrics.frameMs.toFixed(1)} ms` : 'Starting renderer…'}</span>
            <span>{net ? `Net ${net.position.y.toFixed(2)} m` : 'No net crossing'} · {bounce ? `Bounce ${bounce.position.x.toFixed(2)}, ${bounce.position.z.toFixed(2)} m` : 'No bounce'}</span>
          </div>
        </section>

        <aside className="inspector" aria-label="Session setup">
          <h2>Session setup</h2>
          <fieldset className="mode-switch"><legend>Mode</legend><button type="button" className={mode === 'rehearsal' ? 'active' : ''} onClick={() => setMode('rehearsal')}>Rehearsal</button><button type="button" className={mode === 'learning' ? 'active' : ''} onClick={() => setMode('learning')}>Learning</button></fieldset>
          <RangeField label="Pace" value={pace} min={35} max={165} step={1} unit="km/h" onChange={setPace} />
          <RangeField label="Interval" value={interval} min={1.5} max={8} step={0.1} unit="s" onChange={setIntervalValue} />
          <RangeField label="Repetitions" value={repetitions} min={1} max={50} step={1} unit="" onChange={setRepetitions} />
          <RangeField label="Variation" value={variation} min={0} max={25} step={1} unit="%" onChange={setVariation} />
          <RangeField label="Work block" value={workBlockSize} min={1} max={20} step={1} unit="reps" onChange={setWorkBlockSize} />
          <RangeField label="Rest" value={restSeconds} min={0} max={120} step={5} unit="s" onChange={setRestSeconds} />
          <label className="select-field"><span>Surface</span><select value={surface} onChange={(event) => setSurface(event.target.value as SurfaceId)}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>
          <label className="select-field"><span>Venue</span><select value={venue} onChange={(event) => { const next = event.target.value as VenueId; setVenue(next); setLighting(next === 'outdoor' ? 'day' : 'indoor-neutral'); }}>{(Object.entries(VENUE_LABELS) as [VenueId, string][]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="select-field"><span>Lighting</span><select value={lighting} onChange={(event) => setLighting(event.target.value as LightingPreset)}>{venue === 'outdoor' ? <><option value="day">Day</option><option value="golden-hour">Golden hour</option><option value="night">Night floodlights</option></> : <><option value="indoor-neutral">Neutral</option><option value="indoor-warm">Warm</option><option value="indoor-bright">Bright match</option></>}</select></label>
          <RangeField label={venue === 'outdoor' ? 'Sun direction' : 'Light direction'} value={lightDirection} min={-180} max={180} step={5} unit="°" onChange={setLightDirection} />
          <RangeField label="Light level" value={lightIntensity} min={0.35} max={1.5} step={0.05} unit="×" onChange={setLightIntensity} />
          <label className="select-field"><span>Spin</span><select value={spin} onChange={(event) => setSpin(event.target.value as 'preset' | SpinKind)}><option value="preset">Drill preset</option><option value="flat">Flat</option><option value="topspin">Topspin</option><option value="slice">Slice</option><option value="kick">Kick</option></select></label>
          <label className="select-field"><span>Opponent</span><select value={opponentHand} onChange={(event) => setOpponentHand(event.target.value as 'left' | 'right')}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
          <label className="text-field"><span>Seed</span><input aria-label="Seed" value={seed} inputMode="numeric" onChange={(event) => setSeed(event.target.value.replace(/\D/g, '').slice(0, 10) || '0')} /></label>
          <div className="inspector-section">
            <h2>View calibration</h2>
            <RangeField label="Eye height" value={eyeHeight} min={1.2} max={2.1} step={0.01} unit="m" onChange={setEyeHeight} />
            <RangeField label="Behind baseline" value={behindBaseline} min={-5} max={4} step={0.05} unit="m" onChange={(value) => { setBehindBaseline(value); setCameraPreset('realistic'); }} />
            <RangeField label="FOV" value={fov} min={45} max={105} step={1} unit="° H" onChange={(value) => { setFov(value); setCameraPreset('realistic'); }} />
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
          <p>Enter the visible screen width and your eye-to-screen distance. This calculates horizontal FOV without changing court geometry.</p>
          <label className="dialog-field"><span>Screen width</span><input type="number" min="30" max="1000" value={screenWidthCm} onChange={(event) => setScreenWidthCm(Number(event.target.value))} /><small>cm</small></label>
          <label className="dialog-field"><span>Viewing distance</span><input type="number" min="30" max="1500" value={viewDistanceCm} onChange={(event) => setViewDistanceCm(Number(event.target.value))} /><small>cm</small></label>
          <p className="calculation">Calculated horizontal FOV: {Math.round((2 * Math.atan(screenWidthCm / (2 * viewDistanceCm)) * 180) / Math.PI)}°</p>
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
