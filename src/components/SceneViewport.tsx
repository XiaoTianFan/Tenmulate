import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
import type { ResolvedTrajectory } from '../engine/trajectory/physics';

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
}>;

type CameraPointerDrag = {
  pointerId: number;
  mode: 'look' | 'aim';
  lastX: number;
  lastY: number;
  look: CameraLook;
};

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
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);
  const pointerDrag = useRef<CameraPointerDrag | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mode === 'aim') {
      updateAimFromPointer(event);
      return;
    }
    const look = cameraLookAfterDrag(drag.look, event.clientX - drag.lastX, event.clientY - drag.lastY);
    pointerDrag.current = { ...drag, lastX: event.clientX, lastY: event.clientY, look };
    onCameraLookChange?.(look);
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
  ].filter(Boolean).join(' · ') || null;

  return (
    <div className="scene-viewport">
      <canvas
        ref={canvasRef}
        className={[onCameraLookChange ? 'look-enabled' : '', onAimChange ? 'aim-enabled' : ''].filter(Boolean).join(' ') || undefined}
        tabIndex={0}
        aria-label="Live first-person tennis court preview"
        onContextMenu={onAimChange ? (event) => event.preventDefault() : undefined}
        onWheel={onCameraFovChange ? (event) => {
          event.preventDefault();
          const deltaPixels = event.deltaY * (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? event.currentTarget.clientHeight
              : 1);
          onCameraFovChange(cameraFovAfterWheel(camera.fov, deltaPixels));
        } : undefined}
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
          event.currentTarget.setPointerCapture(event.pointerId);
          if (mode === 'aim') updateAimFromPointer(event);
        } : undefined}
        onPointerMove={onAimChange || onCameraLookChange ? updateFromPointer : undefined}
        onPointerUp={onAimChange || onCameraLookChange ? finishPointer : undefined}
        onPointerCancel={onAimChange || onCameraLookChange ? finishPointer : undefined}
      />
      {error ? <div className="renderer-error" role="alert"><strong>3D renderer unavailable</strong><span>{error}</span><small>WebGL 2 and hardware acceleration are required. Setup and local drills remain available.</small></div> : null}
      {interactionHint ? <div className="scene-aim-hint">{interactionHint}</div> : null}
    </div>
  );
}
