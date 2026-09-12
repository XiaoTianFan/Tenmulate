// Shared by catalog validation and gameplay; keep this module independent of the renderer.
export const SHOT_CAMERA_RANGES = {eyeHeight:[1,2.4],behindBaseline:[-10,6],lateral:[-7,7],yaw:[-180,180],pitch:[-85,85],fov:[5,160]} as const;
