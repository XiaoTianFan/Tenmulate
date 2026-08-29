import { useEffect, useRef } from 'react';
import type { SurfaceId } from '../domain/court';
import { DEFAULT_ENVIRONMENT, type EnvironmentConfiguration } from '../domain/environment';
import {
  TennisScene,
  type CameraConfiguration,
  type CameraMotion,
  type SceneMetrics,
} from '../engine/rendering/TennisScene';
import type { ResolvedTrajectory } from '../engine/trajectory/physics';

type SceneViewportProps = Readonly<{
  camera: CameraConfiguration;
  trajectory: ResolvedTrajectory;
  surface: SurfaceId;
  environment?: EnvironmentConfiguration;
  running: boolean;
  resetToken: number;
  showTrajectory?: boolean;
  playbackRate?: number;
  loopTrajectory?: boolean;
  cameraMotion?: CameraMotion | null;
  showSight?: boolean;
  onMetrics: (metrics: SceneMetrics) => void;
}>;

export function SceneViewport({
  camera,
  trajectory,
  surface,
  environment = DEFAULT_ENVIRONMENT,
  running,
  resetToken,
  showTrajectory = true,
  playbackRate = 1,
  loopTrajectory = true,
  cameraMotion = null,
  showSight = true,
  onMetrics,
}: SceneViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<TennisScene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new TennisScene(canvas, onMetrics);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [onMetrics]);

  useEffect(() => sceneRef.current?.setCamera(camera), [camera]);
  useEffect(() => sceneRef.current?.setTrajectory(trajectory), [trajectory]);
  useEffect(() => sceneRef.current?.setSurface(surface), [surface]);
  useEffect(() => sceneRef.current?.setEnvironment(environment), [environment]);
  useEffect(() => sceneRef.current?.setRunning(running), [running]);
  useEffect(() => sceneRef.current?.reset(), [resetToken]);
  useEffect(() => sceneRef.current?.setTrajectoryVisible(showTrajectory), [showTrajectory]);
  useEffect(() => sceneRef.current?.setPlaybackRate(playbackRate), [playbackRate]);
  useEffect(() => sceneRef.current?.setLoopTrajectory(loopTrajectory), [loopTrajectory]);
  useEffect(() => sceneRef.current?.setCameraMotion(cameraMotion), [cameraMotion]);

  return (
    <div className="scene-viewport">
      <canvas ref={canvasRef} aria-label="Live first-person tennis court preview" />
      {showSight ? <div className="scene-sight" aria-hidden="true"><span /></div> : null}
    </div>
  );
}
