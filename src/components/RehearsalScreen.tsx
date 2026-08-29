import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SessionLaunch } from '../app/types';
import { AudioCueEngine } from '../engine/audio/AudioCueEngine';
import type { CameraMotion, SceneMetrics } from '../engine/rendering/TennisScene';
import { useSessionPlayer } from '../hooks/useSessionPlayer';
import { Modal } from './Modal';
import { SceneViewport } from './SceneViewport';

type RehearsalScreenProps = Readonly<{
  launch: SessionLaunch;
  onExit: () => void;
  onRandomize: () => void;
}>;

const speedOptions = [0.5, 0.75, 1, 1.25] as const;

export function RehearsalScreen({ launch, onExit, onRandomize }: RehearsalScreenProps) {
  const [playbackRate, setPlaybackRate] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [metrics, setMetrics] = useState<SceneMetrics | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const audioRef = useRef<AudioCueEngine | null>(null);
  const previousCueRef = useRef('');
  const player = useSessionPlayer(launch.session, playbackRate);
  const repetition = launch.session.repetitions[player.currentIndex] ?? launch.session.repetitions[0];
  const trajectory = repetition?.trajectory;
  const shot = repetition?.shot;
  const bounce = trajectory?.events.find((event) => event.type === 'bounce');
  const receiver = trajectory?.events.find((event) => event.type === 'receiver-plane');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onMetrics = useCallback((next: SceneMetrics) => setMetrics(next), []);

  useEffect(() => {
    const audio = new AudioCueEngine();
    audio.unlock();
    audioRef.current = audio;
    return () => audio.dispose();
  }, []);

  useEffect(() => {
    const cueKey = `${player.status}:${player.countdown ?? ''}:${player.currentIndex}`;
    if (cueKey === previousCueRef.current) return;
    previousCueRef.current = cueKey;
    if (player.status === 'countdown') audioRef.current?.play('countdown', soundEnabled ? 1 : 0);
    if (player.status === 'playing') audioRef.current?.play('contact', soundEnabled ? 1 : 0);
    if (player.status === 'completed') audioRef.current?.play('complete', soundEnabled ? 1 : 0);
  }, [player.countdown, player.currentIndex, player.status, soundEnabled]);

  useEffect(() => {
    setResetToken((value) => value + 1);
  }, [player.currentIndex]);

  useEffect(() => {
    if (player.status !== 'playing' || !bounce) return;
    const timeout = window.setTimeout(() => audioRef.current?.play('bounce', soundEnabled ? 0.72 : 0), (bounce.time / playbackRate) * 1000);
    return () => window.clearTimeout(timeout);
  }, [bounce, playbackRate, player.currentIndex, player.status, soundEnabled]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && player.status === 'playing') player.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [player]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (player.status === 'paused') player.play(); else player.pause();
      }
      if (event.key.toLowerCase() === 'r') player.restart();
      if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      if (event.key === 'ArrowLeft') player.previous();
      if (event.key === 'ArrowRight') player.next();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, toggleFullscreen]);

  const cameraMotion = useMemo<CameraMotion | null>(() => {
    if (!shot?.cameraMotion || reducedMotion) return null;
    const from = { ...launch.camera, ...shot.cameraMotion.from };
    const to = { ...launch.camera, ...shot.cameraMotion.to };
    return { from, to, duration: shot.cameraMotion.duration, delay: shot.cameraMotion.delay };
  }, [launch.camera, reducedMotion, shot]);

  if (!trajectory || !shot) return null;
  const playing = player.status === 'playing';
  const paused = player.status === 'paused';
  const repetitionNumber = Math.min(player.currentIndex + 1, launch.session.repetitions.length);
  const resolvedSpeed = Math.round(Math.hypot(trajectory.launchVelocity.x, trajectory.launchVelocity.y, trajectory.launchVelocity.z) * 3.6);

  return (
    <main className="rehearsal-shell">
      <SceneViewport camera={launch.camera} trajectory={trajectory} surface={launch.session.settings.surface} running={playing} resetToken={resetToken} showTrajectory={launch.mode === 'learning' || showDiagnostics} playbackRate={playbackRate} loopTrajectory={false} cameraMotion={cameraMotion} showSight={false} onMetrics={onMetrics} />
      <header className="rehearsal-header">
        <strong>Tenmulate</strong>
        <span className="drill-title">{launch.session.drill.title}</span>
        <span className="rep-status">Set 1 · Rep {repetitionNumber} of {launch.session.repetitions.length}</span>
        <div>
          <button type="button" onClick={() => setShowDiagnostics((value) => !value)}><Settings size={18} /> Settings</button>
          <button type="button" onClick={() => void toggleFullscreen()}><Expand size={18} /> Full screen</button>
          <button type="button" onClick={onExit}><LogOut size={18} /> Exit</button>
        </div>
      </header>

      {launch.mode === 'learning' && playing ? <div className="preparation-cue"><strong>{shot.cue}</strong><span /></div> : null}
      {player.countdown ? <div className="countdown" aria-live="assertive"><strong>{player.countdown}</strong><span>Ready position</span></div> : null}
      {paused ? <div className="paused-label" aria-live="polite">Paused</div> : null}

      <aside className="rehearsal-mode-panel">
        <span className={launch.mode === 'rehearsal' ? 'active' : ''}>Rehearsal</span>
        <span className={launch.mode === 'learning' ? 'active' : ''}>Learning</span>
        <small>Seed {launch.session.settings.seed}</small>
      </aside>

      <div className="rehearsal-transport" aria-label="Playback controls">
        <button type="button" aria-label="Previous repetition" onClick={player.previous}><SkipBack size={22} /></button>
        <button className="primary-transport" type="button" aria-label={paused ? 'Resume' : 'Pause'} onClick={paused ? player.play : player.pause}>{paused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}</button>
        <button type="button" aria-label="Restart set" onClick={player.restart}><RotateCcw size={22} /></button>
        <button type="button" aria-label="Next repetition" onClick={player.next}><SkipForward size={22} /></button>
        <div className="speed-control">
          <button type="button" aria-label="Slower playback" onClick={() => setPlaybackRate((value) => speedOptions[Math.max(0, speedOptions.indexOf(value as typeof speedOptions[number]) - 1)] ?? 0.5)}><ChevronLeft size={16} /></button>
          <span>{playbackRate.toFixed(playbackRate === 1 ? 1 : 2)}×</span>
          <button type="button" aria-label="Faster playback" onClick={() => setPlaybackRate((value) => speedOptions[Math.min(speedOptions.length - 1, speedOptions.indexOf(value as typeof speedOptions[number]) + 1)] ?? 1.25)}><ChevronRight size={16} /></button>
        </div>
        <div className="session-progress"><span style={{ width: `${player.progress * 100}%` }} /></div>
      </div>

      <aside className="shot-readout">
        <strong>{resolvedSpeed} <small>km/h</small></strong>
        <span>{shot.spin[0]?.toUpperCase()}{shot.spin.slice(1)}</span>
        <span>{shot.direction} · {shot.depth}</span>
        <button type="button" aria-label={soundEnabled ? 'Mute cues' : 'Unmute cues'} onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
      </aside>

      {showDiagnostics ? (
        <aside className="coach-overlay">
          <h2>Coach view</h2>
          <dl><div><dt>Launch</dt><dd>{resolvedSpeed} km/h</dd></div><div><dt>Apex</dt><dd>{trajectory.apexHeight.toFixed(2)} m</dd></div><div><dt>Bounce</dt><dd>{bounce ? `${bounce.position.x.toFixed(2)}, ${bounce.position.z.toFixed(2)} m` : '—'}</dd></div><div><dt>Arrival</dt><dd>{receiver ? `${receiver.position.y.toFixed(2)} m · ${receiver.time.toFixed(2)} s` : '—'}</dd></div><div><dt>Renderer</dt><dd>{metrics ? `${metrics.renderer} · ${metrics.fps} fps` : 'Starting…'}</dd></div></dl>
        </aside>
      ) : null}

      {player.status === 'completed' ? (
        <Modal title="Set complete" actions={<><button className="secondary-button" type="button" onClick={onExit}>Back to setup</button><button className="secondary-button" type="button" onClick={onRandomize}>New variation</button><button className="primary-button inline" type="button" onClick={player.restart}>Replay same seed</button></>}>
          <p>{launch.session.drill.title}: {launch.session.repetitions.length} repetition{launch.session.repetitions.length === 1 ? '' : 's'} completed in {Math.round(launch.session.duration)} seconds.</p>
          <p>The same seed reproduces the same shot order and bounded landing variation.</p>
        </Modal>
      ) : null}
    </main>
  );
}
