import { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  CircleHelp,
  Crosshair,
  Monitor,
  Gauge,
  PencilLine,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Target,
  TimerReset,
  Trophy,
} from 'lucide-react';
import { SceneViewport } from '../components/SceneViewport';
import { COURT, type SurfaceId } from '../domain/court';
import type { SceneMetrics } from '../engine/rendering/TennisScene';
import { resolveTrajectory, type SpinKind } from '../engine/trajectory/physics';

type SessionKind = 'Quick Rally' | 'Return Practice' | 'Tactical Pattern' | 'Serve & Volley' | 'Net & Overhead' | 'Custom';
type CameraPresetId = 'realistic' | 'wide' | 'baselineLeft' | 'baselineRight' | 'approach';

const sessions: ReadonlyArray<{ label: SessionKind; icon: typeof Activity }> = [
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
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{value.toFixed(step < 1 ? 2 : 0)}</output>
      <small>{unit}</small>
    </label>
  );
}

export function App() {
  const [session, setSession] = useState<SessionKind>('Quick Rally');
  const [mode, setMode] = useState<'rehearsal' | 'learning'>('rehearsal');
  const [pace, setPace] = useState(78);
  const [interval, setIntervalValue] = useState(3.2);
  const [repetitions, setRepetitions] = useState(12);
  const [variation, setVariation] = useState(8);
  const [surface, setSurface] = useState<SurfaceId>('hard');
  const [spin, setSpin] = useState<SpinKind>('topspin');
  const [eyeHeight, setEyeHeight] = useState<number>(COURT.defaultEyeHeight);
  const [behindBaseline, setBehindBaseline] = useState<number>(COURT.defaultBehindBaseline);
  const [fov, setFov] = useState(70);
  const [lateral, setLateral] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('realistic');
  const [running, setRunning] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [metrics, setMetrics] = useState<SceneMetrics | null>(null);
  const onMetrics = useCallback((next: SceneMetrics) => setMetrics(next), []);

  const trajectory = useMemo(
    () =>
      resolveTrajectory({
        source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
        target: { x: -2.35, z: -8.9 },
        paceKmh: pace,
        spin,
        surface,
      }),
    [pace, spin, surface],
  );

  const bounce = trajectory.events.find((event) => event.type === 'bounce');
  const net = trajectory.events.find((event) => event.type === 'net-crossing');

  const resetView = () => {
    setEyeHeight(COURT.defaultEyeHeight);
    setBehindBaseline(COURT.defaultBehindBaseline);
    setLateral(0);
    setFov(70);
    setCameraPreset('realistic');
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <strong className="wordmark">Tenmulate</strong>
        <nav aria-label="Primary navigation">
          <button className="nav-item active" type="button">Practice</button>
          <button className="nav-item" type="button">Drills</button>
          <button className="nav-item" type="button">Editor</button>
        </nav>
        <div className="header-actions">
          <button className="icon-text-button" type="button"><Monitor size={18} /> Display</button>
          <button className="icon-text-button" type="button"><CircleHelp size={18} /> Help</button>
        </div>
      </header>

      <section className="practice-layout">
        <aside className="session-rail" aria-label="Session types">
          <h1>Choose a session</h1>
          <div className="session-list">
            {sessions.map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                className={session === label ? 'session-row selected' : 'session-row'}
                onClick={() => setSession(label)}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="recent-list">
            <h2>Recent</h2>
            <button type="button"><TimerReset size={17} /> Crosscourt Rhythm</button>
            <button type="button"><TimerReset size={17} /> Serve Recognition</button>
          </div>
          <div className="rail-status">
            <span className="status-dot" /> Local only · Ready offline
          </div>
        </aside>

        <section className="preview-column" aria-label="Live court preview">
          <SceneViewport
            camera={{ eyeHeight, behindBaseline, lateral, yaw: 0, pitch: -1.7, fov }}
            trajectory={trajectory}
            surface={surface}
            running={running}
            resetToken={resetToken}
            onMetrics={onMetrics}
          />
          <div className="preview-toolbar">
            <button className={cameraPreset === 'realistic' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('realistic')}>
              <Crosshair size={18} />
              <span>Realistic</span>
            </button>
            <button className={cameraPreset === 'wide' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('wide')}>
              <SlidersHorizontal size={18} />
              <span>Wide</span>
            </button>
            <button className={cameraPreset === 'baselineLeft' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('baselineLeft')}><span>Baseline L</span></button>
            <button className={cameraPreset === 'baselineRight' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('baselineRight')}><span>Baseline R</span></button>
            <button className={cameraPreset === 'approach' ? 'camera-preset active' : 'camera-preset'} type="button" onClick={() => applyCameraPreset('approach')}><span>Approach</span></button>
            <button className="reset-link" type="button" onClick={resetView}><RotateCcw size={15} /> Reset view</button>
          </div>
          <div className="preview-diagnostics" aria-live="polite">
            <span>{metrics ? `${metrics.renderer} · ${metrics.fps} fps · ${metrics.frameMs.toFixed(1)} ms` : 'Starting renderer…'}</span>
            <span>{net ? `Net ${net.position.y.toFixed(2)} m` : 'No net crossing'} · {bounce ? `Bounce ${bounce.position.x.toFixed(2)}, ${bounce.position.z.toFixed(2)} m` : 'No bounce'}</span>
          </div>
        </section>

        <aside className="inspector" aria-label="Session setup">
          <h2>Session setup</h2>
          <fieldset className="mode-switch">
            <legend>Mode</legend>
            <button type="button" className={mode === 'rehearsal' ? 'active' : ''} onClick={() => setMode('rehearsal')}>Rehearsal</button>
            <button type="button" className={mode === 'learning' ? 'active' : ''} onClick={() => setMode('learning')}>Learning</button>
          </fieldset>
          <RangeField label="Pace" value={pace} min={35} max={150} step={1} unit="km/h" onChange={setPace} />
          <RangeField label="Interval" value={interval} min={1.5} max={8} step={0.1} unit="s" onChange={setIntervalValue} />
          <RangeField label="Repetitions" value={repetitions} min={1} max={50} step={1} unit="" onChange={setRepetitions} />
          <RangeField label="Variation" value={variation} min={0} max={25} step={1} unit="%" onChange={setVariation} />
          <label className="select-field"><span>Surface</span><select value={surface} onChange={(event) => setSurface(event.target.value as SurfaceId)}><option value="hard">Hard</option><option value="clay">Clay</option><option value="grass">Grass</option></select></label>
          <label className="select-field"><span>Spin</span><select value={spin} onChange={(event) => setSpin(event.target.value as SpinKind)}><option value="flat">Flat</option><option value="topspin">Topspin</option><option value="slice">Slice</option><option value="kick">Kick</option></select></label>
          <label className="select-field"><span>Opponent</span><select defaultValue="right"><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
          <label className="text-field"><span>Seed</span><input defaultValue="18427" inputMode="numeric" /></label>

          <div className="inspector-section">
            <h2>View calibration</h2>
            <RangeField label="Eye height" value={eyeHeight} min={1.2} max={2.1} step={0.01} unit="m" onChange={setEyeHeight} />
            <RangeField label="Behind baseline" value={behindBaseline} min={-5} max={4} step={0.05} unit="m" onChange={(value) => { setBehindBaseline(value); setCameraPreset('realistic'); }} />
            <RangeField label="FOV" value={fov} min={45} max={105} step={1} unit="° H" onChange={(value) => { setFov(value); setCameraPreset('realistic'); }} />
            <button type="button" className="text-action">Use physical display measurements</button>
          </div>

          <div className="inspector-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setRunning((value) => !value)}
            >
              {running ? 'Pause preview' : 'Start practice'}
            </button>
            <button className="text-action centered" type="button" onClick={() => setResetToken((value) => value + 1)}>
              <Play size={15} /> Preview trajectory
            </button>
          </div>
        </aside>
      </section>
      <footer className="safety-footer">Clear a safe practice area before starting</footer>
    </main>
  );
}
