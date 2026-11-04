import type { Camera, Point } from './types';
import { project } from './projective';

export const MAX_LENS = 0.8;
/** Manual, centred radial correction. Unlike a cubic radial polynomial this map
 * stays one-to-one, including outside the picture. The corner fit keeps the full
 * source visible. Coordinates/annotations on disk always refer to the raw image. */
export function correctLens(p: Point, strength: number, width: number, height: number): Point {
  if (!strength) return { ...p };
  const radius = Math.hypot(width, height) / 2;
  const x = ((p.x - 0.5) * width) / radius,
    y = ((p.y - 0.5) * height) / radius;
  const r2 = x * x + y * y;
  const scale = (1 + (strength * r2) / (1 + r2)) / (1 + Math.max(0, strength) / 2);
  return { x: 0.5 + (p.x - 0.5) * scale, y: 0.5 + (p.y - 0.5) * scale };
}

/** Inverse of correctLens; positive derivative for |strength| <= .8. */
export function distortLens(p: Point, strength: number, width: number, height: number): Point {
  if (!strength) return { ...p };
  const radius = Math.hypot(width, height) / 2;
  const target = Math.hypot(((p.x - 0.5) * width) / radius, ((p.y - 0.5) * height) / radius);
  if (!target) return { ...p };
  const scale = 1 / (1 + Math.max(0, strength) / 2);
  let r = target / scale;
  for (let i = 0; i < 12; i++) {
    const q = r * r;
    const f = scale * r * (1 + (strength * q) / (1 + q)) - target;
    const derivative = scale * (1 + (strength * q * (3 + q)) / (1 + q) ** 2);
    r = Math.max(0, r - f / derivative);
  }
  return {
    x: 0.5 + ((p.x - 0.5) * r) / target,
    y: 0.5 + ((p.y - 0.5) * r) / target
  };
}

export const cameraPoint = (camera: Camera, point: Point) =>
  camera.lens ? correctLens(point, camera.lens.strength, camera.lens.width, camera.lens.height) : point;
export const projectImage = (camera: Camera, world: number[]): Point => {
  const point = project(camera.p, world);
  return camera.lens
    ? distortLens(point, camera.lens.strength, camera.lens.width, camera.lens.height)
    : point;
};
