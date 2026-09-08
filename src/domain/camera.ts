import { COURT } from './court';

export type CameraLook = Readonly<{ yaw: number; pitch: number }>;

export function cameraLookAtCourtPoint(position: Readonly<{ lateral: number; behindBaseline: number; eyeHeight: number }>,
  target: Readonly<{ x: number; y: number; z: number }>): CameraLook {
  const dx = target.x - position.lateral, dz = target.z + COURT.halfLength + position.behindBaseline;
  return { yaw: Math.atan2(dx, dz) * 180 / Math.PI,
    pitch: Math.atan2(target.y - position.eyeHeight, Math.hypot(dx, dz)) * 180 / Math.PI };
}

export const CAMERA_LOOK_DEGREES_PER_PIXEL = 0.22;
export const CAMERA_FOV_MIN = 5;
export const CAMERA_FOV_MAX = 160;
export const CAMERA_FOV_DEGREES_PER_WHEEL_PIXEL = 0.03;

export const clampCameraFov = (fov: number): number => Math.min(CAMERA_FOV_MAX, Math.max(CAMERA_FOV_MIN, fov));

export const cameraFovAfterWheel = (
  fov: number,
  deltaPixels: number,
  degreesPerPixel = CAMERA_FOV_DEGREES_PER_WHEEL_PIXEL,
): number => clampCameraFov(fov + deltaPixels * degreesPerPixel);

export const wrapCameraAngle = (degrees: number): number => {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
};

export const cameraLookAfterDrag = (
  look: CameraLook,
  deltaX: number,
  deltaY: number,
  degreesPerPixel = CAMERA_LOOK_DEGREES_PER_PIXEL,
): CameraLook => ({
  yaw: wrapCameraAngle(look.yaw - deltaX * degreesPerPixel),
  pitch: wrapCameraAngle(look.pitch - deltaY * degreesPerPixel),
});

export const cameraRotationRadians = (look: CameraLook): Readonly<{ pitch: number; yaw: number }> => ({
  pitch: wrapCameraAngle(look.pitch) * Math.PI / 180,
  yaw: Math.PI + wrapCameraAngle(look.yaw) * Math.PI / 180,
});
