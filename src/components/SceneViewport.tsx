import { useEffect, useRef } from 'react';
import type { SurfaceId } from '../domain/court';
import { TennisScene, type CameraConfiguration, type SceneMetrics } from '../engine/rendering/TennisScene';
import type { ResolvedTrajectory } from '../engine/trajectory/physics';

type SceneViewportProps = Readonly<{
  camera: CameraConfiguration;
  trajectory: ResolvedTrajectory;
  surface: SurfaceId;
  running: boolean;
  resetToken: number;
  onMetrics: (metrics: SceneMetrics) => void;
}>;

export function SceneViewport({
  camera,
  trajectory,
  surface,
  running,
  resetToken,
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
  useEffect(() => sceneRef.current?.setRunning(running), [running]);
  useEffect(() => sceneRef.current?.reset(), [resetToken]);

  return (
    <div className="scene-viewport">
      <canvas ref={canvasRef} aria-label="Live first-person tennis court preview" />
      <div className="scene-sight" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
