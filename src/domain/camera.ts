export type CameraLook = Readonly<{ yaw: number; pitch: number }>;

export const CAMERA_LOOK_DEGREES_PER_PIXEL = 0.22;

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
