import { useEffect, useRef, useState } from 'react';
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
  onMetrics,
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);
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

  return (
    <div className="scene-viewport">
      <canvas ref={canvasRef} aria-label="Live first-person tennis court preview" />
      {error ? <div className="renderer-error" role="alert"><strong>3D renderer unavailable</strong><span>{error}</span><small>WebGL 2 and hardware acceleration are required. Setup and local drills remain available.</small></div> : null}
      {showSight ? <div className="scene-sight" aria-hidden="true"><span /></div> : null}
    </div>
  );
}
