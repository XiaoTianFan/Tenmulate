import { useAudioSettings } from '../hooks/useAudioSettings';
import { AudioSettings } from './AudioSettings';
import { VENUE_LABELS } from '../domain/environment';
import { defaultContentText } from '../i18n/content';
import { t, message as translateMessage } from '../i18n/locale';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BallFocusControls } from './BallFocusControls';
import { LanguageControl } from './LanguageControl';
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
import { usePracticeAudio } from '../hooks/usePracticeAudio';
import { compileSession } from '../engine/session/compileSession';
import { scaleCameraTimeline } from '../engine/session/cameraTimeline';
import { useSessionPlayer } from '../hooks/useSessionPlayer';
import { useFullscreen } from '../hooks/useFullscreen';
import { Modal } from './Modal';
import { CourtViewport } from './SharedCourt';
import { CastingButton } from './CastingButton';
import { RETURN_SERVE_PLACEMENT_LABELS } from '../domain/returnPractice';

type RehearsalScreenProps = Readonly<{
  launch: SessionLaunch;
  onExit: () => void;
  onRandomize: () => void;
}>;

const speedOptions = [0.5, 0.75, 1, 1.25] as const;

export function RehearsalScreen({ launch, onExit, onRandomize }: RehearsalScreenProps) {
  const contentText = (value: string) => launch.defaultContent ? defaultContentText(value) : value;
  const [playbackRate, setPlaybackRate] = useState(1);
  const { soundEnabled, setSoundEnabled, audioLevels, crowdEnabled } = useAudioSettings();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showTrajectory, setShowTrajectory] = useState(launch.trajectoryEnabled);
  const [cameraMotionScale, setCameraMotionScale] = useState(1);
  const effectiveAudioLevels = useMemo(() => ({ ...audioLevels, crowd: crowdEnabled ? audioLevels.crowd : 0 }), [audioLevels, crowdEnabled]);
  const [highContrastBall, setHighContrastBall] = useState(false);
  const [showBallTrail, setShowBallTrail] = useState(false);
  const [autoHideUI, setAutoHideUI] = useState(true);
  const [touchControls, setTouchControls] = useState(false);
  const touchRevealClick = useRef(false);
  const shellRef = useRef<HTMLElement>(null);
  const fullscreen = useFullscreen(shellRef);
  const toggleUI = useCallback(() => { setAutoHideUI(value => !value); setTouchControls(false); }, []);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effectiveCameraMotionScale = reducedMotion ? 0 : cameraMotionScale;
  const session = useMemo(() => {
    if (effectiveCameraMotionScale === (launch.session.settings.cameraMotionScale ?? 1)) return launch.session;
    if (!launch.session.playerEvents) return compileSession(launch.session.drill, { ...launch.session.settings, camera: launch.camera, cameraMotionScale: effectiveCameraMotionScale });
    return { ...launch.session, cameraTimeline: scaleCameraTimeline(launch.session.cameraTimeline, effectiveCameraMotionScale) };
  }, [effectiveCameraMotionScale, launch.session, launch.camera]);
  const rawPlayer = useSessionPlayer(session, playbackRate);
  const { player, status: audioStatus } = usePracticeAudio(session, launch, rawPlayer, effectiveAudioLevels, soundEnabled);
  const playerEvent = session.playerEvents?.[Math.max(0, player.currentIndex)];
  const activeFlight = session.scheduledFlights?.find(flight => player.elapsed >= flight.startTime && player.elapsed < flight.endTime);
  const repetition = session.repetitions[playerEvent ? playerEvent.incomingIndex : player.currentIndex] ?? session.repetitions[0];
  const trajectory = activeFlight?.trajectory ?? repetition?.trajectory;
  const shot = repetition?.shot;
  const eventCount = session.playerEvents?.length ?? session.repetitions.length;
  const opening = activeFlight?.phase === 'opening' || player.currentIndex < 0;
  const ballOwner = opening ? 'Opening opponent shot' : activeFlight?.owner === 'opponent' ? 'Opponent return' : 'Your shot';
  const activeEvent = session.playerEvents?.[activeFlight?.eventIndex ?? Math.max(0, player.currentIndex)];
  const openingBall = activeEvent?.event.openingFeed?.ball ?? (session.drill.schemaVersion === 2 ? session.drill.launch.ball : null);
  const metadataBall = opening ? openingBall : activeFlight?.phase === 'response' ? activeEvent?.event.opponentReturn.ball : activeEvent?.event.ball;
  const timing = playerEvent?.timing ?? repetition?.timing;
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
  const repetitionNumber = Math.min(player.currentIndex + 1, eventCount);
  const resolvedSpeed = Math.round(Math.hypot(trajectory.launchVelocity.x, trajectory.launchVelocity.y, trajectory.launchVelocity.z) * 3.6);

  return (
    <main ref={shellRef} className={`rehearsal-shell${autoHideUI ? ' auto-hide-ui' : ''}${touchControls || showDiagnostics ? ' controls-revealed' : ''}`}
      onClickCapture={event => {
        if (!touchRevealClick.current) return;
        touchRevealClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}>
      <CourtViewport camera={launch.camera} trajectory={trajectory} surface={launch.surface} environment={launch.environment} quality={launch.quality} running={playing} resetToken={0} showTrajectory={showTrajectory} returnLandingZone={activeEvent?.event.landingZone ?? repetition?.returnLandingZone} playbackRate={playbackRate} loopTrajectory={false} cameraMotion={null} followSessionCamera highContrastBall={highContrastBall} showBallTrail={showBallTrail} onMetrics={onMetrics} session={session} sessionClock={player.clock} />
      <div className="rehearsal-header-zone rehearsal-chrome-zone">
      <header className="rehearsal-header rehearsal-chrome-content">
        <strong>Tenmulate</strong>
        <span className="drill-title">{contentText(session.drill.title)}</span>
        <span className="rep-status">{session.playerEvents ? t("Repetition") : t("Set")} {activeEvent ? activeEvent.setIndex + 1 : player.currentSet} {t("of")} {player.setCount} · {session.playerEvents ? opening ? t("Opening shot") : t("Your shot {0} of {1}", {"0": repetitionNumber, "1": eventCount}) : t("Rep {0} of {1}", {"0": repetitionNumber, "1": eventCount})}</span>
        <div>
          <CastingButton />
          <button type="button" aria-label={t("Settings")} aria-expanded={showDiagnostics} onClick={() => setShowDiagnostics((value) => !value)}><Settings size={18} /> {t("Settings")}</button>
          <button type="button" aria-label={autoHideUI ? t("Keep controls visible") : t("Auto-hide controls")} title={autoHideUI ? t("Show UI (H)") : t("Hide UI (H)")} aria-pressed={!autoHideUI} onClick={toggleUI}>{autoHideUI ? <Eye size={18} /> : <EyeOff size={18} />} {autoHideUI ? t("Show UI") : t("Hide UI")}</button>
          <button type="button" aria-label={fullscreen.active ? t("Exit full screen") : t("Full screen")} aria-pressed={fullscreen.active} onClick={() => void fullscreen.toggle()}>{fullscreen.active ? <Minimize size={18} /> : <Expand size={18} />} {fullscreen.active ? t("Exit full screen") : t("Full screen")}</button>
          <button type="button" onClick={onExit}><LogOut size={18} /> {t("Exit")}</button>
        </div>
      </header>
      </div>

      {player.countdown ? <div className="countdown" aria-live="assertive"><strong>{player.countdown}</strong><span>{t("Ready position")}</span></div> : null}
      {player.status === 'resting' ? <div className="countdown rest-countdown" aria-live="polite"><strong>{player.restRemaining}</strong><span>{t("Rest · next")} {session.playerEvents ? t("repetition") : t("set")} {t("follows")}</span></div> : null}
      <div className="rehearsal-transport-zone rehearsal-chrome-zone">
      <div className="rehearsal-transport rehearsal-chrome-content" role="group" aria-label={t("Playback controls")}>
        <button type="button" aria-label={t("Previous repetition")} onClick={player.previous}><SkipBack size={22} /></button>
        <button className="primary-transport" type="button" aria-label={paused ? t("Resume") : t("Pause")} onClick={paused ? player.play : player.pause}>{paused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}</button>
        <button type="button" aria-label={t("Restart set")} onClick={player.restart}><RotateCcw size={22} /></button>
        <button type="button" aria-label={t("Next repetition")} onClick={player.next}><SkipForward size={22} /></button>
        <div className="speed-control">
          <button type="button" aria-label={t("Slower playback")} onClick={() => setPlaybackRate((value) => speedOptions[Math.max(0, speedOptions.indexOf(value as typeof speedOptions[number]) - 1)] ?? 0.5)}><ChevronLeft size={16} /></button>
          <span>{playbackRate.toFixed(playbackRate === 1 ? 1 : 2)}×</span>
          <button type="button" aria-label={t("Faster playback")} onClick={() => setPlaybackRate((value) => speedOptions[Math.min(speedOptions.length - 1, speedOptions.indexOf(value as typeof speedOptions[number]) + 1)] ?? 1.25)}><ChevronRight size={16} /></button>
        </div>
        <div className="session-progress"><span style={{ width: `${player.progress * 100}%` }} /></div>
      </div>
      </div>

      <aside className="rehearsal-metadata" aria-label={t("Shot metadata")}>
        <div className="metadata-shot"><strong>{resolvedSpeed} <small>{t("km/h")}</small></strong>
          <span>{metadataBall ? `${t(ballOwner)} · ${t(metadataBall.spin)} · ${t(metadataBall.family)}` : `${t(shot.spin)} · ${t(shot.family)}`}</span>
          <button type="button" aria-label={soundEnabled ? t("Mute all sound") : t("Unmute all sound")} title={soundEnabled ? t("Mute all sound") : t("Unmute all sound")} onClick={() => { if (!soundEnabled) practiceAudio.unlock(); setSoundEnabled((value) => !value); }}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        </div>
        <div className="metadata-placement"><span>{(metadataBall?.hand ?? shot.opponentHand) === 'left' ? t("Left") : t("Right")} {t("arm ·")} {t(metadataBall?.stroke ?? shot.stroke ?? 'Automatic')}</span><span>{playerEvent ? contentText(playerEvent.event.label) : repetition?.returnServePlacement
          ? t("{0} serve · {1}{2}", {"0": t(RETURN_SERVE_PLACEMENT_LABELS[repetition.returnServePlacement]), "1": t(shot.depth), "2": shot.serveRhythm ? ` · ${t(shot.serveRhythm)}` : ''})
          : `${t(shot.direction)} · ${t(shot.depth)}${shot.serveRhythm ? ` · ${t(shot.serveRhythm)}` : ''}`}</span></div>
        <div className="metadata-rhythm"><span>{t("Trajectory")} {showTrajectory ? t("on") : t("off")}</span>
          {timing ? <span title={t("Shot interval")}>{timing.actual.toFixed(2)} {t("s")}</span> : null}
          <span>{t("Stroke")} {Math.round((repetition?.motionRate??1)*100)}%</span><span>{t("Move")} {Math.round((repetition?.movementRate??1)*100)}%</span></div>
        {paused ? <span className="metadata-state" role="status">{t("Paused")}</span> : null}
        {soundEnabled && audioStatus !== 'ready' && audioStatus !== 'idle' ? <div className="metadata-note" role="status">
          <span>{audioStatus === 'loading' ? t("Loading sounds · synthesized impacts for now")
            : audioStatus === 'fallback' ? t("Some sounds unavailable · synthesized impacts active")
              : audioStatus === 'unavailable' ? t("Audio is unavailable in this browser") : t("Tap to enable sound")}</span>
          {audioStatus !== 'loading' && audioStatus !== 'unavailable' ? <button type="button" onClick={() => practiceAudio.retry()}>{t("Retry sound")}</button> : null}
        </div> : null}
        {playerEvent ? <span className="metadata-note">{contentText(playerEvent.event.cue)}</span> : null}
        {timing?.limited ? <span className="metadata-note">{t("Requested")} {timing.requested.toFixed(2)} {t("s · resolved")} {timing.actual.toFixed(2)} {t("s")}</span> : null}
      </aside>

      {fullscreen.error ? <div className="fullscreen-message" role="alert"><span>{translateMessage(fullscreen.error)}</span><button type="button" aria-label={t("Dismiss fullscreen message")} onClick={fullscreen.clearError}><X size={16} /></button></div> : null}

      {showDiagnostics ? (
        <aside className="coach-overlay">
          <div className="coach-heading"><h2>{t("Session settings")}</h2><button type="button" aria-label={t("Close settings")} onClick={() => setShowDiagnostics(false)}><X size={18} /></button></div>
          <label className="select-field"><span>{t("Language")}</span><LanguageControl /></label>
          <label className="toggle-field"><span>{t("Trajectory")}</span><button type="button" role="switch" aria-label={t("Trajectory")} aria-checked={showTrajectory} className={showTrajectory ? 'toggle active' : 'toggle'} onClick={() => setShowTrajectory(value => !value)}><span /></button><small>{showTrajectory ? t("On") : t("Off")}</small></label>
          <details className="editor-section" open><summary>{t("Perspective")}</summary><BallFocusControls /></details>
          <label className="compact-range"><span>{t("Camera motion (restarts set)")}</span><input aria-label={t("Camera motion intensity")} type="range" min="0" max="1" step="0.25" value={cameraMotionScale} onChange={(event) => setCameraMotionScale(Number(event.target.value))} /><output>{Math.round(cameraMotionScale * 100)}%</output></label>
          <AudioSettings />
          <label className="compact-check"><input type="checkbox" checked={highContrastBall} onChange={(event) => setHighContrastBall(event.target.checked)} /><span>{t("High-contrast ball")}</span></label>
          <label className="compact-check"><input type="checkbox" checked={showBallTrail} onChange={(event) => setShowBallTrail(event.target.checked)} /><span>{t("Short ball trail")}</span></label>
        </aside>
      ) : null}

      {player.status === 'completed' ? (
        <Modal title={t("Set complete")} actions={<><button className="secondary-button" type="button" onClick={onExit}>{t("Back to setup")}</button><button className="secondary-button" type="button" onClick={onRandomize}>{t("New variation")}</button><button className="primary-button inline" type="button" onClick={player.restart}>{t("Replay same seed")}</button></>}>
          <p>{contentText(session.drill.title)}: {eventCount} {session.playerEvents ? t("player shots") : t("repetitions")} {t("completed in")} {Math.round(session.duration)} {t("seconds.")}</p>
          <dl className="session-summary"><div><dt>{t("Trajectory")}</dt><dd>{showTrajectory ? t("on") : t("off")}</dd></div><div><dt>{t("Shot type")}</dt><dd>{t(session.settings.practiceShotType ?? 'Drill-authored')}</dd></div><div><dt>{t("Venue")}</dt><dd>{t(VENUE_LABELS[launch.environment.venue])}</dd></div><div><dt>{t("Surface")}</dt><dd>{t(launch.surface)}</dd></div><div><dt>{t("Landing depth")}</dt><dd>{session.settings.landingDepthM ? t("{0} m", {"0": session.settings.landingDepthM.toFixed(1)}) : t("Drill-authored")}</dd></div><div><dt>{t("Spin rate")}</dt><dd>{session.settings.spinRateRpm !== undefined ? t("{0} rpm", {"0": Math.round(session.settings.spinRateRpm)}) : t("Drill-authored")}</dd></div><div><dt>{t("Bounce height")}</dt><dd>{(session.settings.bounceFactor ?? 1).toFixed(2)}×</dd></div><div><dt>{t("Launch speed")}</dt><dd>{session.settings.launchSpeedKmh} {t("km/h")}</dd></div><div><dt>{t("Stroke rhythm")}</dt><dd>{session.rhythmPercent}% ± {session.settings.timingVariationPercent}%</dd></div><div><dt>{t("Shot interval")}</dt><dd>{session.settings.shotIntervalSeconds?.toFixed(1)} {t("s")}</dd></div><div><dt>{t("Movement pace")}</dt><dd>{session.settings.movementPercent}%</dd></div><div><dt>{t("Seed")}</dt><dd>{session.settings.seed}</dd></div></dl>
          <p>{t("The same seed reproduces the same shot order and bounded landing variation.")}</p>
        </Modal>
      ) : null}
    </main>
  );
}
