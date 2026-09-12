import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cameraFovAfterWheel, cameraLookAfterDrag, type CameraLook } from '../domain/camera';
import type { SurfaceId } from '../domain/court';
import { DEFAULT_ENVIRONMENT, type EnvironmentConfiguration } from '../domain/environment';
import {
  TennisScene,
  type CameraConfiguration,
  type CameraMotion,
  type QualityMode,
  type SceneMetrics,
} from '../engine/rendering/TennisScene';
import type { FlightSample, ResolvedTrajectory } from '../engine/trajectory/physics';
import { trajectoryReadout } from '../engine/trajectory/trajectoryReadout';
import type { CompiledRepetition, CompiledSession } from '../engine/session/compileSession';
import type { LandingZone } from '../engine/trajectory/landingZone';
import type { OpponentPlacement } from '../engine/rendering/OpponentPositionControl';
import { DEFAULT_BALL_FOCUS, type BallFocusSettings } from '../engine/rendering/ballFocus';

export type SceneViewportProps = Readonly<{
  active?: boolean;
  viewKey?: object;
  onCaptureSource?: (canvas: HTMLCanvasElement | null) => void;
  captureActive?: boolean;
  camera: CameraConfiguration;
  courtOverview?: boolean;
  trajectory: ResolvedTrajectory;
  surface: SurfaceId;
  environment?: EnvironmentConfiguration;
  quality?: QualityMode;
  running: boolean;
  resetToken: number;
  showTrajectory?: boolean;
  playbackRate?: number;
  loopTrajectory?: boolean;
  trajectoryInterval?: number | null;
  cameraMotion?: CameraMotion | null;
  followSessionCamera?: boolean;
  highContrastBall?: boolean;
  ballFocus?: BallFocusSettings;
  showBallTrail?: boolean;
  onAimChange?: (directionDeg: number) => void;
  onLandingZoneChange?: (zone: LandingZone) => void;
  onLandingZoneDraft?: (zone: LandingZone | null) => void;
  onReturnLandingZoneDraft?: (zone: LandingZone | null) => void;
  shotPreviewPending?: boolean;
  onCameraFovChange?: (fov: number) => void;
  onCameraLookChange?: (look: CameraLook) => void;
  onCameraViewCommit?: (camera: CameraConfiguration) => void;
  returnLandingZone?: LandingZone;
  nearLandingZone?: LandingZone;
  nearLandingZoneLimits?: LandingZone;
  onReturnLandingZoneChange?: (zone: LandingZone) => void;
  opponentPlacement?: OpponentPlacement;
  onOpponentPositionChange?: (point: OpponentPlacement) => void;
  onMetrics: (metrics: SceneMetrics) => void;
  onPointerActivity?: () => void;
  session?: CompiledSession;
  sessionClock?: Readonly<{ current: number }>;
  onSessionIndex?: (index:number, repetition: CompiledRepetition)=>void;
}>;

type CameraPointerDrag = {
  pointerId: number;
  mode: 'look' | 'aim' | 'landing' | 'return' | 'opponent';
  lastX: number;
  lastY: number;
  look: CameraLook;
};

type TrajectoryTooltipState = Readonly<{
  x: number;
  y: number;
  placeBelow: boolean;
  sample: FlightSample;
  trajectory: ResolvedTrajectory;
}>;

export function SceneViewport({
  active = true,
  viewKey,
  onCaptureSource,
  captureActive = false,
  camera,
  courtOverview = false,
  trajectory,
  surface,
  environment = DEFAULT_ENVIRONMENT,
  quality = 'auto',
  running,
  resetToken,
  showTrajectory = true,
  playbackRate = 1,
  loopTrajectory = true,
  trajectoryInterval = null,
  cameraMotion = null,
  followSessionCamera = false,
  highContrastBall = false,
  ballFocus = DEFAULT_BALL_FOCUS,
  showBallTrail = false,
  onAimChange,
  onLandingZoneChange,
  onLandingZoneDraft,
  onReturnLandingZoneDraft,
  shotPreviewPending = false,
  onCameraFovChange,
  onCameraLookChange,
  onCameraViewCommit,
  returnLandingZone,
  nearLandingZone,
  nearLandingZoneLimits,
  onReturnLandingZoneChange,
  opponentPlacement,
  onOpponentPositionChange,
  onMetrics,
  onPointerActivity,
  session,
  sessionClock,
  onSessionIndex,
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);
  const pointerDrag = useRef<CameraPointerDrag | null>(null);
  const keyboardZone = useRef<'landingZoneControl' | 'returnLandingZoneControl'>('landingZoneControl');
  const metricsListener = useRef(onMetrics);
  metricsListener.current = onMetrics;
  const [error, setError] = useState<string | null>(null);
  const [venueStatus, setVenueStatus] = useState<SceneMetrics['venueAsset']>({ status: 'loading', loadedBytes: 0, totalBytes: 0, hasAsset: false });
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [practiceIssue, setPracticeIssue] = useState<string | undefined>();
  const initialSceneOptions = useRef({ quality, environment });
  const captureSource = useRef(onCaptureSource);
  const zoomCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if(zoomCommitTimer.current)clearTimeout(zoomCommitTimer.current);
  },[viewKey,resetToken]);
  const [trajectoryTooltip, setTrajectoryTooltip] = useState<TrajectoryTooltipState | null>(null);

  const zoomFromWheel = useEffectEvent((event: WheelEvent) => {
    if (!onCameraFovChange) return;
    event.preventDefault();
    const deltaPixels = event.deltaY * (event.deltaMode === 1
      ? 16
      : event.deltaMode === 2 ? (event.currentTarget as HTMLCanvasElement).clientHeight : 1);
    const fov = cameraFovAfterWheel(camera.fov, deltaPixels);
    onCameraFovChange(fov);
    if(zoomCommitTimer.current)clearTimeout(zoomCommitTimer.current);
    if(onCameraViewCommit)zoomCommitTimer.current=setTimeout(()=>onCameraViewCommit({...camera,fov}),180);
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // React delegates wheel events passively. Custom zoom must cancel scrolling.
    const listener = (event: WheelEvent) => zoomFromWheel(event);
    canvas.addEventListener('wheel', listener, { passive: false });
    return () => { canvas.removeEventListener('wheel', listener); if(zoomCommitTimer.current)clearTimeout(zoomCommitTimer.current); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: TennisScene;
    try {
      scene = new TennisScene(canvas, metrics => {
        metricsListener.current(metrics);
        setVenueStatus(previous => previous.status === metrics.venueAsset.status && previous.loadedBytes === metrics.venueAsset.loadedBytes && previous.hasAsset === metrics.venueAsset.hasAsset && previous.message === metrics.venueAsset.message ? previous : metrics.venueAsset);
        setAudienceError(metrics.audience.status === 'error' ? metrics.audience.message ?? 'Audience unavailable' : null);
        setPracticeIssue(metrics.practiceIssue);
      }, initialSceneOptions.current);
      sceneRef.current = scene;
      captureSource.current?.(canvas);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The 3D renderer could not start.');
      return;
    }
    return () => {
      captureSource.current?.(null);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => { sceneRef.current?.setCaptureActive(captureActive); }, [captureActive]);

  useEffect(() => {
    sceneRef.current?.landingZoneControl.end(false);
    sceneRef.current?.landingZoneControl.leave();
    sceneRef.current?.returnLandingZoneControl.end(false);
    sceneRef.current?.returnLandingZoneControl.leave();
    sceneRef.current?.opponentPositionControl.end(false);
    sceneRef.current?.opponentPositionControl.leave();
    const drag = pointerDrag.current, canvas = canvasRef.current;
    if (drag && canvas?.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
    pointerDrag.current = null;
    setTrajectoryTooltip(null);
  }, [viewKey, active]);
  useEffect(() => {
    const update = () => sceneRef.current?.setActive(active && !document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [active]);

  useEffect(() => sceneRef.current?.setCamera(camera), [camera, followSessionCamera]);
  useEffect(() => sceneRef.current?.setCourtOverview(courtOverview), [courtOverview]);
  useEffect(() => sceneRef.current?.opponentPositionControl.configure(opponentPlacement ?? null, onOpponentPositionChange ?? null), [opponentPlacement, onOpponentPositionChange]);
  useEffect(() => sceneRef.current?.setBallFocus(ballFocus), [ballFocus]);
  useEffect(() => sceneRef.current?.setReturnLandingZone(returnLandingZone ?? null, onReturnLandingZoneChange ?? null), [returnLandingZone, onReturnLandingZoneChange]);
  useEffect(() => sceneRef.current?.setNearLandingZone(nearLandingZone ?? null, nearLandingZoneLimits), [nearLandingZone, nearLandingZoneLimits]);
  useEffect(() => sceneRef.current?.setSession(session ?? null, sessionClock ?? null, onSessionIndex), [session, sessionClock, onSessionIndex]);
  useEffect(() => sceneRef.current?.setShotPreviewPending(shotPreviewPending), [shotPreviewPending]);
  useEffect(() => sceneRef.current?.landingZoneControl.setDraftListener(onLandingZoneDraft ?? null), [onLandingZoneDraft]);
  useEffect(() => sceneRef.current?.returnLandingZoneControl.setDraftListener(onReturnLandingZoneDraft ?? null), [onReturnLandingZoneDraft]);
  useEffect(() => sceneRef.current?.setTrajectory(trajectory), [trajectory]);
  useEffect(() => sceneRef.current?.setLandingZoneInteraction(
    showTrajectory ? onLandingZoneChange ?? null : null), [showTrajectory, onLandingZoneChange]);
  useEffect(() => sceneRef.current?.setSurface(surface), [surface]);
  useEffect(() => sceneRef.current?.setEnvironment(environment), [environment]);
  useEffect(() => sceneRef.current?.setQualityMode(quality), [quality]);
  useEffect(() => sceneRef.current?.setRunning(running), [running]);
  useEffect(() => sceneRef.current?.reset(), [resetToken]);
  useEffect(() => sceneRef.current?.setTrajectoryVisible(showTrajectory), [showTrajectory]);
  useEffect(() => sceneRef.current?.setPlaybackRate(playbackRate), [playbackRate]);
  useEffect(() => sceneRef.current?.setLoopTrajectory(loopTrajectory), [loopTrajectory]);
  useEffect(() => sceneRef.current?.setTrajectoryInterval(trajectoryInterval), [trajectoryInterval]);
  useEffect(() => sceneRef.current?.setCameraMotion(cameraMotion), [cameraMotion]);
  useEffect(() => sceneRef.current?.setSessionCameraEnabled(followSessionCamera), [followSessionCamera]);
  useEffect(() => sceneRef.current?.setBallPresentation(highContrastBall, showBallTrail), [highContrastBall, showBallTrail]);

  const updateAimFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const direction = sceneRef.current?.aimDirectionFromClientPoint(event.clientX, event.clientY);
    if (direction !== null && direction !== undefined) onAimChange?.(direction);
  };

  const updateFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDrag.current;
    if (drag && drag.pointerId === event.pointerId) {
      setTrajectoryTooltip(null);
      if (drag.mode === 'opponent') {
        sceneRef.current?.opponentPositionControl.move(event.clientX, event.clientY); return;
      }
      if (drag.mode === 'landing') {
        sceneRef.current?.landingZoneControl.move(event.clientX, event.clientY);
        return;
      }
      if (drag.mode === 'return') {
        sceneRef.current?.returnLandingZoneControl.move(event.clientX, event.clientY);
        return;
      }
      if (drag.mode === 'aim') {
        updateAimFromPointer(event);
        return;
      }
      const look = cameraLookAfterDrag(drag.look, event.clientX - drag.lastX, event.clientY - drag.lastY);
      pointerDrag.current = { ...drag, lastX: event.clientX, lastY: event.clientY, look };
      onCameraLookChange?.(look);
      return;
    }
    if (sceneRef.current?.opponentPositionControl.hover(event.clientX, event.clientY)) {
      sceneRef.current.landingZoneControl.leave(); sceneRef.current.returnLandingZoneControl.leave();
      setTrajectoryTooltip(null); return;
    }
    const landingHover = showTrajectory && sceneRef.current?.landingZoneControl.hover(event.clientX, event.clientY);
    const returnHover = sceneRef.current?.returnLandingZoneControl.hover(event.clientX, event.clientY);
    if (landingHover || returnHover) {
      keyboardZone.current = returnHover ? 'returnLandingZoneControl' : 'landingZoneControl';
      setTrajectoryTooltip(null);
      return;
    }
    if (!showTrajectory) return;
    const hit = sceneRef.current?.getDisplayedTrajectories().map(path => ({ path, sample: sceneRef.current?.trajectorySampleFromClientPoint(event.clientX, event.clientY, 11, path) })).find(hit => hit.sample);
    if (!hit?.sample) {
      setTrajectoryTooltip(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    setTrajectoryTooltip({
      x: Math.min(Math.max(localX, 136), Math.max(136, bounds.width - 136)),
      y: localY,
      placeBelow: localY < 150,
      sample: hit.sample,
      trajectory: hit.path,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerDrag.current?.pointerId !== event.pointerId) return;
    if (pointerDrag.current.mode === 'landing') sceneRef.current?.landingZoneControl.end(event.type === 'pointerup');
    if (pointerDrag.current.mode === 'return') sceneRef.current?.returnLandingZoneControl.end(event.type === 'pointerup');
    if (pointerDrag.current.mode === 'opponent') sceneRef.current?.opponentPositionControl.end(event.type === 'pointerup');
    if (pointerDrag.current.mode === 'look' && event.type === 'pointerup') onCameraViewCommit?.({...camera,...pointerDrag.current.look});
    pointerDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && event.pointerType !== 'touch') sceneRef.current?.landingZoneControl.hover(event.clientX, event.clientY);
    else sceneRef.current?.landingZoneControl.leave();
    if (event.type === 'pointerup' && event.pointerType !== 'touch') sceneRef.current?.returnLandingZoneControl.hover(event.clientX, event.clientY);
    else sceneRef.current?.returnLandingZoneControl.leave();
  };

  const interactionHint = [
    onOpponentPositionChange ? 'Drag opponent to place' : null,
    onLandingZoneChange ? 'Drag zone to move · Edges to resize' : null,
    onCameraLookChange ? onLandingZoneChange ? 'Drag elsewhere to look' : 'Left-drag to look' : null,
    onCameraFovChange ? 'Wheel to zoom' : null,
    !onLandingZoneChange && onAimChange ? 'Right-drag to aim' : null,
    showTrajectory ? 'Hover trajectory for data' : null,
  ].filter(Boolean).join(' · ') || null;

  const visibleTooltip = showTrajectory && trajectoryTooltip && sceneRef.current?.getDisplayedTrajectories().includes(trajectoryTooltip.trajectory) ? trajectoryTooltip : null;
  const tooltipTrajectory = visibleTooltip?.trajectory ?? trajectory;
  const bounce = tooltipTrajectory.events.find((event) => event.type === 'bounce');
  const readout = trajectoryReadout(tooltipTrajectory);
  const receiver = tooltipTrajectory.events.find((event) => event.type === 'receiver-plane');
  const spinLabel = `${tooltipTrajectory.intent.spin[0]?.toUpperCase()}${tooltipTrajectory.intent.spin.slice(1)}`;
  const tooltipSpeedKmh = visibleTooltip
    ? Math.hypot(visibleTooltip.sample.velocity.x, visibleTooltip.sample.velocity.y, visibleTooltip.sample.velocity.z) * 3.6
    : 0;

  return (
    <div className="scene-viewport">
      <canvas
        ref={canvasRef}
        className={[onCameraLookChange ? 'look-enabled' : '', onAimChange ? 'aim-enabled' : '', onLandingZoneChange ? 'landing-enabled' : ''].filter(Boolean).join(' ') || undefined}
        tabIndex={0}
        aria-label={onLandingZoneChange ? 'Live tennis court. Left-drag inside the landing zone to move; drag an edge or corner to resize; drag elsewhere to look. Enter selects the zone; arrow keys move it; Escape deselects.' : 'Live first-person tennis court preview'}
        onContextMenu={onAimChange ? (event) => event.preventDefault() : undefined}
        onPointerDown={onLandingZoneChange || onAimChange || onCameraLookChange || onOpponentPositionChange ? (event) => {
          if (pointerDrag.current) return;
          const mode = event.button === 0 && sceneRef.current?.opponentPositionControl.begin(event.clientX, event.clientY)
            ? 'opponent' : event.button === 0 && sceneRef.current?.returnLandingZoneControl.begin(event.clientX, event.clientY, event.pointerType === 'touch')
            ? 'return' : event.button === 0 && sceneRef.current?.landingZoneControl.begin(event.clientX, event.clientY, event.pointerType === 'touch')
            ? 'landing' : event.button === 0 && onCameraLookChange
            ? 'look'
            : event.button === 2 && onAimChange
              ? 'aim'
              : null;
          if (!mode) return;
          if (mode !== 'landing') sceneRef.current?.landingZoneControl.leave();
          if (mode !== 'return') sceneRef.current?.returnLandingZoneControl.leave();
          event.preventDefault();
          event.currentTarget.focus({ preventScroll: true });
          pointerDrag.current = {
            pointerId: event.pointerId,
            mode,
            lastX: event.clientX,
            lastY: event.clientY,
            look: { yaw: camera.yaw, pitch: camera.pitch },
          };
          setTrajectoryTooltip(null);
          event.currentTarget.setPointerCapture(event.pointerId);
          if (mode === 'aim') updateAimFromPointer(event);
        } : undefined}
        onPointerMove={showTrajectory || onAimChange || onCameraLookChange || onPointerActivity || onOpponentPositionChange ? event => {
          onPointerActivity?.(); updateFromPointer(event);
        } : undefined}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onLostPointerCapture={finishPointer}
        onPointerLeave={() => { if (!pointerDrag.current) { setTrajectoryTooltip(null); sceneRef.current?.landingZoneControl.leave(); sceneRef.current?.returnLandingZoneControl.leave(); sceneRef.current?.opponentPositionControl.leave(); } }}
        onKeyDown={event => { if (sceneRef.current?.[keyboardZone.current].key(event.key)) { event.preventDefault(); event.stopPropagation(); } }}
        onBlur={()=>{ sceneRef.current?.landingZoneControl.leave(); sceneRef.current?.returnLandingZoneControl.leave(); }}
      />
      {error ? <div className="renderer-error" role="alert"><strong>3D renderer unavailable</strong><span>{error}</span><small>WebGL 2 and hardware acceleration are required. Setup and local drills remain available.</small></div> : null}
      {!error && !venueStatus.hasAsset && venueStatus.status !== 'ready' ? <div className="renderer-error" role={venueStatus.status === 'error' ? 'alert' : 'status'}><strong>{venueStatus.status === 'error' ? 'Venue unavailable' : 'Loading Blender venue…'}</strong><span>{venueStatus.message ?? (venueStatus.totalBytes ? `${Math.round(venueStatus.loadedBytes / venueStatus.totalBytes * 100)}%` : 'Preparing the selected scene')}</span>{venueStatus.status === 'error' ? <button onClick={() => sceneRef.current?.retryVenue()}>Retry venue</button> : null}</div> : null}
      {!error && venueStatus.hasAsset && venueStatus.status === 'error' ? <div className="scene-audience-error" role="alert">Venue quality update failed: {venueStatus.message} <button onClick={() => sceneRef.current?.retryVenue()}>Retry venue</button></div> : null}
      {audienceError ? <div className="scene-audience-error" role="alert">{audienceError} <button onClick={() => sceneRef.current?.retryVenue()}>Retry audience</button></div> : null}
      {interactionHint ? <div className="scene-aim-hint">{interactionHint}</div> : null}
      {practiceIssue ? <div className="scene-audience-error" role="alert">{practiceIssue}</div> : null}
      {visibleTooltip ? (
        <aside
          className={`trajectory-tooltip${visibleTooltip.placeBelow ? ' below' : ''}`}
          role="tooltip"
          data-flight-owner={readout.owner}
          style={{ left: visibleTooltip.x, top: visibleTooltip.y }}
        >
          <strong>{readout.owner === 'player' ? 'Your ball' : 'Opponent ball'} · {spinLabel}</strong>
          <span className="trajectory-tooltip-current">
            {visibleTooltip.sample.time.toFixed(2)} s · {visibleTooltip.sample.position.y.toFixed(2)} m high · {Math.round(tooltipSpeedKmh)} km/h
          </span>
          <dl>
            <div><dt>Launch</dt><dd>{tooltipTrajectory.resolved.launchSpeedKmh.toFixed(1)} km/h</dd></div>
            <div><dt>Spin</dt><dd>{Math.round(tooltipTrajectory.resolved.spinRateRpm)} rpm</dd></div>
            <div><dt>Angle</dt><dd>{tooltipTrajectory.resolved.launchAngleDeg.toFixed(1)}°</dd></div>
            <div title="Highest ball centre above the court, before the first bounce"><dt>Peak height</dt><dd>{readout.peakHeight.toFixed(2)} m</dd></div>
            <div title="Ball centre above the court at the net"><dt>Height at net</dt><dd>{readout.netHeight === undefined ? 'No crossing' : `${readout.netHeight.toFixed(2)} m`}</dd></div>
            <div title="Ball centre above the local net tape"><dt>Over net tape</dt><dd>{readout.netClearance === undefined ? 'No crossing' : `${readout.netClearance.toFixed(2)} m`}</dd></div>
            <div><dt>Landing</dt><dd>{bounce ? `${bounce.position.x.toFixed(2)}, ${bounce.position.z.toFixed(2)} m` : 'Unresolved'}</dd></div>
            <div><dt>Target error</dt><dd>{bounce ? `${Math.hypot(bounce.position.x - tooltipTrajectory.intent.target.x, bounce.position.z - tooltipTrajectory.intent.target.z).toFixed(2)} m` : 'Unresolved'}</dd></div>
            <div><dt>Bounce</dt><dd>{bounce?.postSpeedKmh !== undefined ? `${Math.round(bounce.speedKmh)} → ${Math.round(bounce.postSpeedKmh)} km/h` : 'Unresolved'}</dd></div>
            <div><dt>Arrival</dt><dd>{receiver ? `${receiver.position.y.toFixed(2)} m · ${Math.round(receiver.speedKmh)} km/h` : 'Before baseline'}</dd></div>
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
