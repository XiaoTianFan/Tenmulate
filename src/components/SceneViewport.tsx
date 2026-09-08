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
import { netHeightAt, type FlightSample, type ResolvedTrajectory } from '../engine/trajectory/physics';
import type { CompiledRepetition, CompiledSession } from '../engine/session/compileSession';

type SceneViewportProps = Readonly<{
  camera: CameraConfiguration;
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
  highContrastBall?: boolean;
  showBallTrail?: boolean;
  onAimChange?: (directionDeg: number) => void;
  landingTarget?:Readonly<{x:number;z:number}>;
  onLandingChange?: (point:Readonly<{x:number;z:number}>)=>void;
  onCameraFovChange?: (fov: number) => void;
  onCameraLookChange?: (look: CameraLook) => void;
  onMetrics: (metrics: SceneMetrics) => void;
  session?: CompiledSession;
  sessionClock?: Readonly<{ current: number }>;
  onSessionIndex?: (index:number, repetition: CompiledRepetition)=>void;
}>;

type CameraPointerDrag = {
  pointerId: number;
  mode: 'look' | 'aim' | 'landing';
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
  camera,
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
  highContrastBall = false,
  showBallTrail = false,
  onAimChange,
  onLandingChange,
  landingTarget,
  onCameraFovChange,
  onCameraLookChange,
  onMetrics,
  session,
  sessionClock,
  onSessionIndex,
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);
  const pointerDrag = useRef<CameraPointerDrag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venueStatus, setVenueStatus] = useState<SceneMetrics['venueAsset']>({ status: 'loading', loadedBytes: 0, totalBytes: 0 });
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const initialSceneOptions = useRef({ quality, environment });
  const [trajectoryTooltip, setTrajectoryTooltip] = useState<TrajectoryTooltipState | null>(null);

  const zoomFromWheel = useEffectEvent((event: WheelEvent) => {
    if (!onCameraFovChange) return;
    event.preventDefault();
    const deltaPixels = event.deltaY * (event.deltaMode === 1
      ? 16
      : event.deltaMode === 2 ? (event.currentTarget as HTMLCanvasElement).clientHeight : 1);
    onCameraFovChange(cameraFovAfterWheel(camera.fov, deltaPixels));
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // React delegates wheel events passively. Custom zoom must cancel scrolling.
    const listener = (event: WheelEvent) => zoomFromWheel(event);
    canvas.addEventListener('wheel', listener, { passive: false });
    return () => canvas.removeEventListener('wheel', listener);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: TennisScene;
    try {
      scene = new TennisScene(canvas, metrics => {
        onMetrics(metrics);
        setVenueStatus(previous => previous.status === metrics.venueAsset.status && previous.loadedBytes === metrics.venueAsset.loadedBytes ? previous : metrics.venueAsset);
        setAudienceError(metrics.audience.status === 'error' ? metrics.audience.message ?? 'Audience unavailable' : null);
      }, initialSceneOptions.current);
      sceneRef.current = scene;
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The 3D renderer could not start.');
      return;
    }
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [onMetrics]);

  useEffect(() => sceneRef.current?.setCamera(camera), [camera]);
  useEffect(() => sceneRef.current?.setSession(session ?? null, sessionClock ?? null, onSessionIndex), [session, sessionClock, onSessionIndex]);
  useEffect(() => sceneRef.current?.setTrajectory(trajectory), [trajectory]);
  useEffect(() => sceneRef.current?.setLandingTarget(landingTarget ?? trajectory.intent.target,
    showTrajectory ? onLandingChange ?? null : null), [landingTarget, trajectory, showTrajectory, onLandingChange]);
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
  useEffect(() => sceneRef.current?.setBallPresentation(highContrastBall, showBallTrail), [highContrastBall, showBallTrail]);

  const updateAimFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const direction = sceneRef.current?.aimDirectionFromClientPoint(event.clientX, event.clientY);
    if (direction !== null && direction !== undefined) onAimChange?.(direction);
  };

  const updateFromPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDrag.current;
    if (drag && drag.pointerId === event.pointerId) {
      setTrajectoryTooltip(null);
      if (drag.mode === 'landing') {
        sceneRef.current?.landingGizmo.move(event.clientX, event.clientY);
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
    if (!showTrajectory) return;
    if (sceneRef.current?.landingGizmo.hover(event.clientX, event.clientY)) {
      setTrajectoryTooltip(null);
      return;
    }
    const sample = sceneRef.current?.trajectorySampleFromClientPoint(event.clientX, event.clientY) ?? null;
    if (!sample) {
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
      sample,
      trajectory: sceneRef.current?.getDisplayedTrajectory() ?? trajectory,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerDrag.current?.pointerId !== event.pointerId) return;
    if (pointerDrag.current.mode === 'landing') sceneRef.current?.landingGizmo.end(event.type !== 'pointerup');
    pointerDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const interactionHint = [
    onCameraLookChange ? 'Left-drag to look' : null,
    onCameraFovChange ? 'Wheel to zoom' : null,
    onLandingChange ? 'Hover target · Drag red X / blue Z arrows' : onAimChange ? 'Right-drag to aim' : null,
    showTrajectory ? 'Hover trajectory for data' : null,
  ].filter(Boolean).join(' · ') || null;

  const visibleTooltip = showTrajectory && trajectoryTooltip?.trajectory === sceneRef.current?.getDisplayedTrajectory() ? trajectoryTooltip : null;
  const tooltipTrajectory = visibleTooltip?.trajectory ?? trajectory;
  const bounce = tooltipTrajectory.events.find((event) => event.type === 'bounce');
  const net = tooltipTrajectory.events.find((event) => event.type === 'net-crossing');
  const receiver = tooltipTrajectory.events.find((event) => event.type === 'receiver-plane');
  const spinLabel = `${tooltipTrajectory.intent.spin[0]?.toUpperCase()}${tooltipTrajectory.intent.spin.slice(1)}`;
  const tooltipSpeedKmh = visibleTooltip
    ? Math.hypot(visibleTooltip.sample.velocity.x, visibleTooltip.sample.velocity.y, visibleTooltip.sample.velocity.z) * 3.6
    : 0;

  return (
    <div className="scene-viewport">
      <canvas
        ref={canvasRef}
        className={[onCameraLookChange ? 'look-enabled' : '', onAimChange ? 'aim-enabled' : ''].filter(Boolean).join(' ') || undefined}
        tabIndex={0}
        aria-label={onLandingChange ? 'Live tennis court. Enter selects landing zone; X or Z selects an axis; arrow keys move it; Escape deselects.' : 'Live first-person tennis court preview'}
        onContextMenu={onAimChange ? (event) => event.preventDefault() : undefined}
        onPointerDown={onLandingChange || onAimChange || onCameraLookChange ? (event) => {
          const mode = event.button === 0 && sceneRef.current?.landingGizmo.begin(event.clientX, event.clientY)
            ? 'landing' : event.button === 0 && onCameraLookChange
            ? 'look'
            : event.button === 2 && onAimChange
              ? 'aim'
              : null;
          if (!mode) return;
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
        onPointerMove={showTrajectory || onAimChange || onCameraLookChange ? updateFromPointer : undefined}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onLostPointerCapture={finishPointer}
        onPointerLeave={() => { if (!pointerDrag.current) { setTrajectoryTooltip(null); sceneRef.current?.landingGizmo.leave(); } }}
        onKeyDown={event => { if (sceneRef.current?.landingGizmo.key(event.key)) { event.preventDefault(); event.stopPropagation(); } }}
        onBlur={()=>sceneRef.current?.landingGizmo.leave()}
      />
      {error ? <div className="renderer-error" role="alert"><strong>3D renderer unavailable</strong><span>{error}</span><small>WebGL 2 and hardware acceleration are required. Setup and local drills remain available.</small></div> : null}
      {!error && venueStatus.status !== 'ready' ? <div className="renderer-error" role={venueStatus.status === 'error' ? 'alert' : 'status'}><strong>{venueStatus.status === 'error' ? 'Venue unavailable' : 'Loading Blender venue…'}</strong><span>{venueStatus.message ?? (venueStatus.totalBytes ? `${Math.round(venueStatus.loadedBytes / venueStatus.totalBytes * 100)}%` : 'Preparing the selected scene')}</span>{venueStatus.status === 'error' ? <button onClick={() => sceneRef.current?.retryVenue()}>Retry venue</button> : null}</div> : null}
      {audienceError ? <div className="scene-audience-error" role="alert">{audienceError} <button onClick={() => sceneRef.current?.retryVenue()}>Retry audience</button></div> : null}
      {interactionHint ? <div className="scene-aim-hint">{interactionHint}</div> : null}
      {visibleTooltip ? (
        <aside
          className={`trajectory-tooltip${visibleTooltip.placeBelow ? ' below' : ''}`}
          role="tooltip"
          style={{ left: visibleTooltip.x, top: visibleTooltip.y }}
        >
          <strong>Trajectory · {spinLabel}</strong>
          <span className="trajectory-tooltip-current">
            {visibleTooltip.sample.time.toFixed(2)} s · {visibleTooltip.sample.position.y.toFixed(2)} m high · {Math.round(tooltipSpeedKmh)} km/h
          </span>
          <dl>
            <div><dt>Launch</dt><dd>{tooltipTrajectory.resolved.launchSpeedKmh.toFixed(1)} km/h</dd></div>
            <div><dt>Spin</dt><dd>{Math.round(tooltipTrajectory.resolved.spinRateRpm)} rpm</dd></div>
            <div><dt>Angle</dt><dd>{tooltipTrajectory.resolved.launchAngleDeg.toFixed(1)}°</dd></div>
            <div><dt>Apex</dt><dd>{tooltipTrajectory.apexHeight.toFixed(2)} m</dd></div>
            <div><dt>Net</dt><dd>{net ? `${(net.position.y - netHeightAt(net.position.x)).toFixed(2)} m clear` : 'No crossing'}</dd></div>
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
