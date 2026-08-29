export const COURT = Object.freeze({
  singlesWidth: 8.23,
  doublesWidth: 10.97,
  fullLength: 23.77,
  halfLength: 23.77 / 2,
  serviceLineFromNet: 6.4,
  netCenterHeight: 0.914,
  netPostHeight: 1.07,
  ballRadius: 0.0335,
  defaultEyeHeight: 1.7,
  defaultBehindBaseline: 1.5,
});

export type SurfaceId = 'hard' | 'clay' | 'grass';

export const CAMERA_PRESETS = Object.freeze({
  realistic: { x: 0, y: 1.7, z: -(COURT.halfLength + 1.5), fov: 54 },
  wide: { x: 0, y: 1.72, z: -(COURT.halfLength + 2.2), fov: 68 },
  baselineLeft: { x: -2.6, y: 1.68, z: -(COURT.halfLength + 1.4), fov: 58 },
  baselineRight: { x: 2.6, y: 1.68, z: -(COURT.halfLength + 1.4), fov: 58 },
  approach: { x: 0, y: 1.67, z: -7.2, fov: 62 },
});
