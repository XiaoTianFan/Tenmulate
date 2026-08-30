import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
  showSight?: boolean;
  highContrastBall?: boolean;
  showBallTrail?: boolean;
  onAimChange?: (directionDeg: number) => void;
  onMetrics: (metrics: SceneMetrics) => void;
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
  showSight = true,
  highContrastBall = false,
  showBallTrail = false,
  onAimChange,
  onMetrics,
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);
  const aimPointerId = useRef<number | null>(null);
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

  const finishAim = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (aimPointerId.current !== event.pointerId) return;
    aimPointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="scene-viewport">
      <canvas
        ref={canvasRef}
        className={onAimChange ? 'aim-enabled' : undefined}
        tabIndex={0}
        aria-label="Live first-person tennis court preview"
        onContextMenu={onAimChange ? (event) => event.preventDefault() : undefined}
        onPointerDown={onAimChange ? (event) => {
          if (event.button !== 2) return;
          event.preventDefault();
          aimPointerId.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateAimFromPointer(event);
        } : undefined}
        onPointerMove={onAimChange ? (event) => {
          if (aimPointerId.current === event.pointerId) updateAimFromPointer(event);
        } : undefined}
        onPointerUp={onAimChange ? finishAim : undefined}
        onPointerCancel={onAimChange ? finishAim : undefined}
      />
      {error ? <div className="renderer-error" role="alert"><strong>3D renderer unavailable</strong><span>{error}</span><small>WebGL 2 and hardware acceleration are required. Setup and local drills remain available.</small></div> : null}
      {showSight ? <div className="scene-sight" aria-hidden="true"><span /></div> : null}
      {onAimChange ? <div className="scene-aim-hint">Right-drag the court to aim</div> : null}
    </div>
  );
}
