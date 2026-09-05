import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
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
} from 'lucide-react';
import type { SessionLaunch } from '../app/types';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import { crossedCues, sessionCues } from '../engine/audio/sessionCues';
import type { CameraMotion } from '../engine/rendering/TennisScene';
import { useSessionPlayer } from '../hooks/useSessionPlayer';
import { Modal } from './Modal';
import { SceneViewport } from './SceneViewport';
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
  const [hudHidden, setHudHidden] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const audioRef = useRef(practiceAudio);
  const previousCueRef = useRef('');
  const audioTimeRef = useRef(0);
  const player = useSessionPlayer(launch.session, playbackRate);
  const repetition = launch.session.repetitions[player.currentIndex] ?? launch.session.repetitions[0];
  const trajectory = repetition?.trajectory;
  const shot = repetition?.shot;
  const timedCues = useMemo(() => sessionCues(launch.session), [launch.session]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onMetrics = useCallback(() => undefined, []);

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
    setResetToken((value) => value + 1);
  }, [player.currentIndex]);

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
      if (event.key.toLowerCase() === 'h') setHudHidden((value) => !value);
      if (event.key === 'Escape') player.pause();
      if (event.key === 'ArrowLeft') player.previous();
      if (event.key === 'ArrowRight') player.next();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, toggleFullscreen]);

  const cameraMotion = useMemo<CameraMotion | null>(() => {
    if (!shot?.cameraMotion || reducedMotion || cameraMotionScale === 0) return null;
    const from = { ...launch.camera, ...shot.cameraMotion.from };
    const target = { ...launch.camera, ...shot.cameraMotion.to };
    const to = {
      eyeHeight: launch.camera.eyeHeight + (target.eyeHeight - launch.camera.eyeHeight) * cameraMotionScale,
      behindBaseline: launch.camera.behindBaseline + (target.behindBaseline - launch.camera.behindBaseline) * cameraMotionScale,
      lateral: launch.camera.lateral + (target.lateral - launch.camera.lateral) * cameraMotionScale,
      yaw: launch.camera.yaw + (target.yaw - launch.camera.yaw) * cameraMotionScale,
      pitch: launch.camera.pitch + (target.pitch - launch.camera.pitch) * cameraMotionScale,
      fov: launch.camera.fov + (target.fov - launch.camera.fov) * cameraMotionScale,
    };
    return { from, to, duration: shot.cameraMotion.duration, delay: shot.cameraMotion.delay };
  }, [cameraMotionScale, launch.camera, reducedMotion, shot]);

  if (!trajectory || !shot) return null;
  const playing = player.status === 'playing';
  const paused = player.status === 'paused';
  const repetitionNumber = Math.min(player.currentIndex + 1, launch.session.repetitions.length);
  const resolvedSpeed = Math.round(Math.hypot(trajectory.launchVelocity.x, trajectory.launchVelocity.y, trajectory.launchVelocity.z) * 3.6);

  return (
    <main className={hudHidden ? 'rehearsal-shell hud-hidden' : 'rehearsal-shell'} onMouseMove={() => { if (hudHidden) setHudHidden(false); }}>
      <SceneViewport camera={launch.camera} trajectory={trajectory} surface={launch.surface} environment={launch.environment} quality={launch.quality} running={playing} resetToken={resetToken} showTrajectory={launch.trajectoryEnabled || showDiagnostics} playbackRate={playbackRate} loopTrajectory={false} cameraMotion={cameraMotion} highContrastBall={highContrastBall} showBallTrail={showBallTrail} onMetrics={onMetrics} session={launch.session} sessionClock={player.clock} />
      <header className="rehearsal-header">
        <strong>Tenmulate</strong>
        <span className="drill-title">{launch.session.drill.title}</span>
        <span className="rep-status">Set {player.currentSet} of {player.setCount} · Rep {repetitionNumber} of {launch.session.repetitions.length}</span>
        <div>
          <button type="button" onClick={() => setShowDiagnostics((value) => !value)}><Settings size={18} /> Settings</button>
          <button type="button" onClick={() => setHudHidden(true)}><EyeOff size={18} /> Hide UI</button>
          <button type="button" onClick={() => void toggleFullscreen()}><Expand size={18} /> Full screen</button>
          <button type="button" onClick={onExit}><LogOut size={18} /> Exit</button>
        </div>
      </header>

      {player.countdown ? <div className="countdown" aria-live="assertive"><strong>{player.countdown}</strong><span>Ready position</span></div> : null}
      {player.status === 'resting' ? <div className="countdown rest-countdown" aria-live="polite"><strong>{player.restRemaining}</strong><span>Rest · next set follows</span></div> : null}
      {paused ? <div className="paused-label" aria-live="polite">Paused</div> : null}

      <aside className="rehearsal-mode-panel">
        <span className={launch.trajectoryEnabled ? 'active' : ''}>Trajectory {launch.trajectoryEnabled ? 'on' : 'off'}</span>
        <small>Seed {launch.session.settings.seed}</small>
        {launch.session.motionTimingAdjusted ? <small>Rhythm includes stroke preparation and court movement.</small> : null}
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
        <span>{repetition?.returnServePlacement
          ? `${RETURN_SERVE_PLACEMENT_LABELS[repetition.returnServePlacement]} serve · ${shot.depth}${shot.serveRhythm ? ` · ${shot.serveRhythm}` : ''}`
          : `${shot.direction} · ${shot.depth}${shot.serveRhythm ? ` · ${shot.serveRhythm}` : ''}`}</span>
        <button type="button" aria-label={soundEnabled ? 'Mute cues' : 'Unmute cues'} onClick={() => setSoundEnabled((value) => !value)}>{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
      </aside>

      {showDiagnostics ? (
        <aside className="coach-overlay">
          <h2>Session settings</h2>
          <label className="compact-range"><span>Camera motion</span><input aria-label="Camera motion intensity" type="range" min="0" max="1" step="0.25" value={cameraMotionScale} onChange={(event) => setCameraMotionScale(Number(event.target.value))} /><output>{Math.round(cameraMotionScale * 100)}%</output></label>
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
          <p>{launch.session.drill.title}: {launch.session.repetitions.length} repetition{launch.session.repetitions.length === 1 ? '' : 's'} completed in {Math.round(launch.session.duration)} seconds.</p>
          <dl className="session-summary"><div><dt>Trajectory</dt><dd>{launch.trajectoryEnabled ? 'on' : 'off'}</dd></div><div><dt>Shot type</dt><dd>{launch.session.settings.practiceShotType ?? 'Drill-authored'}</dd></div><div><dt>Venue</dt><dd>{launch.environment.venue}</dd></div><div><dt>Surface</dt><dd>{launch.surface}</dd></div><div><dt>Landing depth</dt><dd>{launch.session.settings.landingDepthM ? `${launch.session.settings.landingDepthM.toFixed(1)} m` : 'Drill-authored'}</dd></div><div><dt>Spin rate</dt><dd>{launch.session.settings.spinRateRpm !== undefined ? `${Math.round(launch.session.settings.spinRateRpm)} rpm` : 'Drill-authored'}</dd></div><div><dt>Bounce height</dt><dd>{(launch.session.settings.bounceFactor ?? 1).toFixed(2)}×</dd></div><div><dt>Launch speed</dt><dd>{launch.session.settings.launchSpeedKmh} km/h</dd></div><div><dt>Interval</dt><dd>{launch.session.settings.interval.toFixed(1)} s ± {launch.session.settings.timingVariationPercent}%</dd></div><div><dt>Seed</dt><dd>{launch.session.settings.seed}</dd></div></dl>
          <p>The same seed reproduces the same shot order and bounded landing variation.</p>
        </Modal>
      ) : null}
    </main>
  );
}
