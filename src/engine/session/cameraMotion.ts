import type { CameraConfiguration } from '../rendering/TennisScene';
import { wrapCameraAngle } from '../../domain/camera';

export const cameraEase = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (10 + t * (-15 + 6 * t));
};
export function interpolateCamera(from: CameraConfiguration, to: CameraConfiguration, t: number): CameraConfiguration {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return { eyeHeight: lerp(from.eyeHeight, to.eyeHeight), lateral: lerp(from.lateral, to.lateral), behindBaseline: lerp(from.behindBaseline, to.behindBaseline),
    yaw: wrapCameraAngle(from.yaw + wrapCameraAngle(to.yaw - from.yaw) * t), pitch: lerp(from.pitch, to.pitch), fov: lerp(from.fov, to.fov) };
}
