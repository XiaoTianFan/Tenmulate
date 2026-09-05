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
import type { CompiledSession } from '../engine/session/compileSession';

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
  onCameraFovChange?: (fov: number) => void;
  onCameraLookChange?: (look: CameraLook) => void;
  onMetrics: (metrics: SceneMetrics) => void;
  session?: CompiledSession;
  sessionClock?: Readonly<{ current: number }>;
}>;

type CameraPointerDrag = {
  pointerId: number;
  mode: 'look' | 'aim';
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
  onCameraFovChange,
  onCameraLookChange,
  onMetrics,
  session,
  sessionClock,
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);
  const pointerDrag = useRef<CameraPointerDrag | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      scene = new TennisScene(canvas, onMetrics);
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
  useEffect(() => sceneRef.current?.setSession(session ?? null, sessionClock ?? null), [session, sessionClock]);
  useEffect(() => sceneRef.current?.setTrajectory(trajectory), [trajectory]);
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
      trajectory,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerDrag.current?.pointerId !== event.pointerId) return;
    pointerDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const interactionHint = [
    onCameraLookChange ? 'Left-drag to look' : null,
    onCameraFovChange ? 'Wheel to zoom' : null,
    onAimChange ? 'Right-drag to aim' : null,
    showTrajectory ? 'Hover trajectory for data' : null,
  ].filter(Boolean).join(' · ') || null;

  const bounce = trajectory.events.find((event) => event.type === 'bounce');
  const net = trajectory.events.find((event) => event.type === 'net-crossing');
  const receiver = trajectory.events.find((event) => event.type === 'receiver-plane');
  const spinLabel = `${trajectory.intent.spin[0]?.toUpperCase()}${trajectory.intent.spin.slice(1)}`;
  const visibleTooltip = showTrajectory && trajectoryTooltip?.trajectory === trajectory ? trajectoryTooltip : null;
  const tooltipSpeedKmh = visibleTooltip
    ? Math.hypot(visibleTooltip.sample.velocity.x, visibleTooltip.sample.velocity.y, visibleTooltip.sample.velocity.z) * 3.6
    : 0;

  return (
    <div className="scene-viewport">
      <canvas
        ref={canvasRef}
        className={[onCameraLookChange ? 'look-enabled' : '', onAimChange ? 'aim-enabled' : ''].filter(Boolean).join(' ') || undefined}
        tabIndex={0}
        aria-label="Live first-person tennis court preview"
        onContextMenu={onAimChange ? (event) => event.preventDefault() : undefined}
        onPointerDown={onAimChange || onCameraLookChange ? (event) => {
          const mode = event.button === 0 && onCameraLookChange
            ? 'look'
            : event.button === 2 && onAimChange
              ? 'aim'
              : null;
          if (!mode) return;
          event.preventDefault();
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
        onPointerUp={onAimChange || onCameraLookChange ? finishPointer : undefined}
        onPointerCancel={onAimChange || onCameraLookChange ? finishPointer : undefined}
        onPointerLeave={() => { if (!pointerDrag.current) setTrajectoryTooltip(null); }}
      />
      {error ? <div className="renderer-error" role="alert"><strong>3D renderer unavailable</strong><span>{error}</span><small>WebGL 2 and hardware acceleration are required. Setup and local drills remain available.</small></div> : null}
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
            <div><dt>Launch</dt><dd>{trajectory.resolved.launchSpeedKmh.toFixed(1)} km/h</dd></div>
            <div><dt>Spin</dt><dd>{Math.round(trajectory.resolved.spinRateRpm)} rpm</dd></div>
            <div><dt>Angle</dt><dd>{trajectory.resolved.launchAngleDeg.toFixed(1)}°</dd></div>
            <div><dt>Apex</dt><dd>{trajectory.apexHeight.toFixed(2)} m</dd></div>
            <div><dt>Net</dt><dd>{net ? `${(net.position.y - netHeightAt(net.position.x)).toFixed(2)} m clear` : 'No crossing'}</dd></div>
            <div><dt>Landing</dt><dd>{bounce ? `${bounce.position.x.toFixed(2)}, ${bounce.position.z.toFixed(2)} m` : 'Unresolved'}</dd></div>
            <div><dt>Target error</dt><dd>{bounce ? `${Math.hypot(bounce.position.x - trajectory.intent.target.x, bounce.position.z - trajectory.intent.target.z).toFixed(2)} m` : 'Unresolved'}</dd></div>
            <div><dt>Bounce</dt><dd>{bounce?.postSpeedKmh !== undefined ? `${Math.round(bounce.speedKmh)} → ${Math.round(bounce.postSpeedKmh)} km/h` : 'Unresolved'}</dd></div>
            <div><dt>Arrival</dt><dd>{receiver ? `${receiver.position.y.toFixed(2)} m · ${Math.round(receiver.speedKmh)} km/h` : 'Before baseline'}</dd></div>
          </dl>
        </aside>
      ) : null}
    </div>
  );
}
