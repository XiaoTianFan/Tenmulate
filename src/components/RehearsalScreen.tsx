import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BallFocusControls } from './BallFocusControls';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Minimize,
  Eye,
  EyeOff,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { SessionLaunch } from '../app/types';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import { crossedCues, sessionCues } from '../engine/audio/sessionCues';
import { compileSession } from '../engine/session/compileSession';
import { useSessionPlayer } from '../hooks/useSessionPlayer';
import { useFullscreen } from '../hooks/useFullscreen';
import { Modal } from './Modal';
import { CourtViewport } from './SharedCourt';
import { RETURN_SERVE_PLACEMENT_LABELS } from '../domain/returnPractice';

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
  const [cameraMotionScale, setCameraMotionScale] = useState(1);
  const [audioLevels, setAudioLevels] = useState({ countdown: 1, contact: 1, bounce: 0.7, footwork: 0.6, ambience: 0 });
  const [highContrastBall, setHighContrastBall] = useState(false);
  const [showBallTrail, setShowBallTrail] = useState(false);
  const [autoHideUI, setAutoHideUI] = useState(true);
  const [touchControls, setTouchControls] = useState(false);
  const touchRevealClick = useRef(false);
  const shellRef = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(shellRef);
  const toggleUI = useCallback(() => { setAutoHideUI(value => !value); setTouchControls(false); }, []);
  const audioRef = useRef(practiceAudio);
  const previousCueRef = useRef('');
  const audioTimeRef = useRef(0);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effectiveCameraMotionScale = reducedMotion ? 0 : cameraMotionScale;
  const session = useMemo(() => effectiveCameraMotionScale === (launch.session.settings.cameraMotionScale ?? 1)
    ? launch.session : compileSession(launch.session.drill, { ...launch.session.settings, camera: launch.camera, cameraMotionScale: effectiveCameraMotionScale }),
  [effectiveCameraMotionScale, launch.session, launch.camera]);
  const player = useSessionPlayer(session, playbackRate);
  const repetition = session.repetitions[player.currentIndex] ?? session.repetitions[0];
  const trajectory = repetition?.trajectory;
  const shot = repetition?.shot;
  const timedCues = useMemo(() => sessionCues(session), [session]);
  const onMetrics = useCallback(() => undefined, []);

  useEffect(() => {
    const shell = shellRef.current;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !(event.target instanceof Element)) return;
      const inControls = !!event.target.closest('.rehearsal-chrome-zone, .coach-overlay');
      // The first tap reveals the controls without activating the button underneath.
      touchRevealClick.current = inControls && autoHideUI && !touchControls && !showDiagnostics;
      setTouchControls(inControls);
    };
    // The shared canvas is a React portal; listen to its physical DOM ancestry.
    shell?.addEventListener('pointerdown', onPointerDown, true);
    return () => shell?.removeEventListener('pointerdown', onPointerDown, true);
  }, [autoHideUI, touchControls, showDiagnostics]);

  useEffect(() => {
    return () => audioRef.current.setAmbience(0);
  }, []);

  useEffect(() => {
    const cueKey = `${player.status}:${player.countdown ?? ''}:${player.currentIndex}`;
    if (cueKey === previousCueRef.current) return;
    previousCueRef.current = cueKey;
    if (player.status === 'countdown') audioRef.current?.play('countdown', soundEnabled ? audioLevels.countdown : 0);
    if (player.status === 'completed') audioRef.current?.play('complete', soundEnabled ? audioLevels.countdown : 0);
  }, [audioLevels.contact, audioLevels.countdown, player.countdown, player.currentIndex, player.status, soundEnabled]);

  useEffect(() => audioRef.current?.setAmbience(soundEnabled ? audioLevels.ambience : 0), [audioLevels.ambience, soundEnabled]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const current = player.clock.current;
      if (player.status !== 'paused' && player.status !== 'completed') {
        for (const cue of crossedCues(timedCues, audioTimeRef.current, current)) audioRef.current.play(cue.kind, soundEnabled ? audioLevels[cue.kind] : 0);
      }
      audioTimeRef.current = current;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audioLevels, player.clock, player.status, soundEnabled, timedCues]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && player.status === 'playing') player.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [player]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || target?.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.code === 'Space') {
        if (target?.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        if (player.status === 'paused') player.play(); else player.pause();
      }
      if (event.key.toLowerCase() === 'r') player.restart();
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); void fullscreen.toggle(); }
      if (event.key.toLowerCase() === 'h') {
        if (target?.closest('.rehearsal-chrome-zone')) target.blur();
        toggleUI();
      }
      if (event.key === 'Escape') {
        setShowDiagnostics(false);
        setTouchControls(false);
        player.pause();
        if (document.fullscreenElement === shellRef.current) void fullscreen.toggle();
      }
      if (event.key === 'ArrowLeft') player.previous();
      if (event.key === 'ArrowRight') player.next();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, fullscreen.toggle, toggleUI]);

  if (!trajectory || !shot) return null;
  const playing = player.status === 'playing';
  const paused = player.status === 'paused';
  const repetitionNumber = Math.min(player.currentIndex + 1, session.repetitions.length);
  const resolvedSpeed = Math.round(Math.hypot(trajectory.launchVelocity.x, trajectory.launchVelocity.y, trajectory.launchVelocity.z) * 3.6);

  return (
    <main ref={shellRef} className={`rehearsal-shell${autoHideUI ? ' auto-hide-ui' : ''}${touchControls || showDiagnostics ? ' controls-revealed' : ''}`}
      onClickCapture={event => {
        if (!touchRevealClick.current) return;
        touchRevealClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}>
      <CourtViewport camera={launch.camera} trajectory={trajectory} surface={launch.surface} environment={launch.environment} quality={launch.quality} running={playing} resetToken={0} showTrajectory={launch.trajectoryEnabled || showDiagnostics} playbackRate={playbackRate} loopTrajectory={false} cameraMotion={null} followSessionCamera highContrastBall={highContrastBall} showBallTrail={showBallTrail} onMetrics={onMetrics} session={session} sessionClock={player.clock} />
      <div className="rehearsal-header-zone rehearsal-chrome-zone">
      <header className="rehearsal-header rehearsal-chrome-content">
        <strong>Tenmulate</strong>
        <span className="drill-title">{session.drill.title}</span>
        <span className="rep-status">Set {player.currentSet} of {player.setCount} · Rep {repetitionNumber} of {session.repetitions.length}</span>
        <div>
          <button type="button" aria-label="Settings" aria-expanded={showDiagnostics} onClick={() => setShowDiagnostics((value) => !value)}><Settings size={18} /> Settings</button>
          <button type="button" aria-label={autoHideUI ? 'Keep controls visible' : 'Auto-hide controls'} title={autoHideUI ? 'Show UI (H)' : 'Hide UI (H)'} aria-pressed={!autoHideUI} onClick={toggleUI}>{autoHideUI ? <Eye size={18} /> : <EyeOff size={18} />} {autoHideUI ? 'Show UI' : 'Hide UI'}</button>
          <button type="button" aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'} aria-pressed={fullscreen.active} onClick={() => void fullscreen.toggle()}>{fullscreen.active ? <Minimize size={18} /> : <Expand size={18} />} {fullscreen.active ? 'Exit full screen' : 'Full screen'}</button>
          <button type="button" onClick={onExit}><LogOut size={18} /> Exit</button>
        </div>
      </header>
      </div>

      {player.countdown ? <div className="countdown" aria-live="assertive"><strong>{player.countdown}</strong><span>Ready position</span></div> : null}
      {player.status === 'resting' ? <div className="countdown rest-countdown" aria-live="polite"><strong>{player.restRemaining}</strong><span>Rest · next set follows</span></div> : null}
      <div className="rehearsal-transport-zone rehearsal-chrome-zone">
      <div className="rehearsal-transport rehearsal-chrome-content" role="group" aria-label="Playback controls">
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
      </div>

      <aside className="rehearsal-metadata" aria-label="Shot metadata">
        <div className="metadata-shot"><strong>{resolvedSpeed} <small>km/h</small></strong>
          <span>{shot.spin[0]?.toUpperCase()}{shot.spin.slice(1)} · {shot.family[0]?.toUpperCase()}{shot.family.slice(1)}</span>
          <button type="button" aria-label={soundEnabled ? 'Mute cues' : 'Unmute cues'} title={soundEnabled ? 'Mute cues' : 'Unmute cues'} onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        </div>
        <div className="metadata-placement"><span>{shot.opponentHand === 'left' ? 'Left' : 'Right'} arm{shot.stroke ? ` · ${shot.stroke}` : ''}</span><span>{repetition?.returnServePlacement
          ? `${RETURN_SERVE_PLACEMENT_LABELS[repetition.returnServePlacement]} serve · ${shot.depth}${shot.serveRhythm ? ` · ${shot.serveRhythm}` : ''}`
          : `${shot.direction} · ${shot.depth}${shot.serveRhythm ? ` · ${shot.serveRhythm}` : ''}`}</span></div>
        <div className="metadata-rhythm"><span>Trajectory {launch.trajectoryEnabled || showDiagnostics ? 'on' : 'off'}</span>
          {repetition?.timing ? <span title="Shot interval">{repetition.timing.actual.toFixed(2)} s</span> : null}
          <span>Stroke {Math.round((repetition?.motionRate??1)*100)}%</span><span>Move {Math.round((repetition?.movementRate??1)*100)}%</span></div>
        {paused ? <span className="metadata-state" role="status">Paused</span> : null}
        {session.mode === 'drill' ? <span className="metadata-note">{repetition?.returnStatus === 'linked' ? 'Rally return' : repetition?.returnStatus === 'infeasible' || repetition?.returnStatus === 'unreachable' ? 'Next shot begins a new feed' : 'New point'}</span> : null}
        {repetition?.timing?.limited ? <span className="metadata-note">Requested {repetition.timing.requested.toFixed(2)} s; this transition needs more time.</span> : repetition?.returnStatus==='rest' ? <span className="metadata-note">A set rest follows this shot.</span> : null}
      </aside>

      {fullscreen.error ? <div className="fullscreen-message" role="alert"><span>{fullscreen.error}</span><button type="button" aria-label="Dismiss fullscreen message" onClick={fullscreen.clearError}><X size={16} /></button></div> : null}

      {showDiagnostics ? (
        <aside className="coach-overlay">
          <div className="coach-heading"><h2>Session settings</h2><button type="button" aria-label="Close settings" onClick={() => setShowDiagnostics(false)}><X size={18} /></button></div>
          <details className="editor-section" open><summary>Perspective</summary><BallFocusControls /></details>
          <label className="compact-range"><span>Camera motion (restarts set)</span><input aria-label="Camera motion intensity" type="range" min="0" max="1" step="0.25" value={cameraMotionScale} onChange={(event) => setCameraMotionScale(Number(event.target.value))} /><output>{Math.round(cameraMotionScale * 100)}%</output></label>
          <label className="compact-range"><span>Countdown</span><input aria-label="Countdown volume" type="range" min="0" max="1" step="0.1" value={audioLevels.countdown} onChange={(event) => setAudioLevels((current) => ({ ...current, countdown: Number(event.target.value) }))} /><output>{Math.round(audioLevels.countdown * 100)}%</output></label>
          <label className="compact-range"><span>Contact</span><input aria-label="Contact volume" type="range" min="0" max="1" step="0.1" value={audioLevels.contact} onChange={(event) => setAudioLevels((current) => ({ ...current, contact: Number(event.target.value) }))} /><output>{Math.round(audioLevels.contact * 100)}%</output></label>
          <label className="compact-range"><span>Bounce</span><input aria-label="Bounce volume" type="range" min="0" max="1" step="0.1" value={audioLevels.bounce} onChange={(event) => setAudioLevels((current) => ({ ...current, bounce: Number(event.target.value) }))} /><output>{Math.round(audioLevels.bounce * 100)}%</output></label>
          <label className="compact-range"><span>Footwork</span><input aria-label="Footwork cue volume" type="range" min="0" max="1" step="0.1" value={audioLevels.footwork} onChange={(event) => setAudioLevels((current) => ({ ...current, footwork: Number(event.target.value) }))} /><output>{Math.round(audioLevels.footwork * 100)}%</output></label>
          <label className="compact-range"><span>Ambience</span><input aria-label="Ambience volume" type="range" min="0" max="1" step="0.1" value={audioLevels.ambience} onChange={(event) => setAudioLevels((current) => ({ ...current, ambience: Number(event.target.value) }))} /><output>{Math.round(audioLevels.ambience * 100)}%</output></label>
          <label className="compact-check"><input type="checkbox" checked={highContrastBall} onChange={(event) => setHighContrastBall(event.target.checked)} /><span>High-contrast ball</span></label>
          <label className="compact-check"><input type="checkbox" checked={showBallTrail} onChange={(event) => setShowBallTrail(event.target.checked)} /><span>Short ball trail</span></label>
        </aside>
      ) : null}

      {player.status === 'completed' ? (
        <Modal title="Set complete" actions={<><button className="secondary-button" type="button" onClick={onExit}>Back to setup</button><button className="secondary-button" type="button" onClick={onRandomize}>New variation</button><button className="primary-button inline" type="button" onClick={player.restart}>Replay same seed</button></>}>
          <p>{session.drill.title}: {session.repetitions.length} repetition{session.repetitions.length === 1 ? '' : 's'} completed in {Math.round(session.duration)} seconds.</p>
          <dl className="session-summary"><div><dt>Trajectory</dt><dd>{launch.trajectoryEnabled ? 'on' : 'off'}</dd></div><div><dt>Shot type</dt><dd>{session.settings.practiceShotType ?? 'Drill-authored'}</dd></div><div><dt>Venue</dt><dd>{launch.environment.venue}</dd></div><div><dt>Surface</dt><dd>{launch.surface}</dd></div><div><dt>Landing depth</dt><dd>{session.settings.landingDepthM ? `${session.settings.landingDepthM.toFixed(1)} m` : 'Drill-authored'}</dd></div><div><dt>Spin rate</dt><dd>{session.settings.spinRateRpm !== undefined ? `${Math.round(session.settings.spinRateRpm)} rpm` : 'Drill-authored'}</dd></div><div><dt>Bounce height</dt><dd>{(session.settings.bounceFactor ?? 1).toFixed(2)}×</dd></div><div><dt>Launch speed</dt><dd>{session.settings.launchSpeedKmh} km/h</dd></div><div><dt>Stroke rhythm</dt><dd>{session.rhythmPercent}% ± {session.settings.timingVariationPercent}%</dd></div><div><dt>Shot interval</dt><dd>{session.settings.shotIntervalSeconds?.toFixed(1)} s</dd></div><div><dt>Movement pace</dt><dd>{session.settings.movementPercent}%</dd></div><div><dt>Seed</dt><dd>{session.settings.seed}</dd></div></dl>
          <p>The same seed reproduces the same shot order and bounded landing variation.</p>
        </Modal>
      ) : null}
    </main>
  );
}
