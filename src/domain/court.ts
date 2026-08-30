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

export type CameraMoveKey = 'w' | 'a' | 's' | 'd';

export const cameraMovementDelta = (
  key: CameraMoveKey,
  step: number,
): Readonly<{ behindBaseline: number; lateral: number }> => {
  switch (key) {
    case 'w':
      return { behindBaseline: -step, lateral: 0 };
    case 's':
      return { behindBaseline: step, lateral: 0 };
    case 'a':
      return { behindBaseline: 0, lateral: step };
    case 'd':
      return { behindBaseline: 0, lateral: -step };
  }
};

// The FPV camera looks from negative z toward positive z, so positive world x
// appears on the player's left. Keep top-down controls in that player view.
export const worldXToPlayerViewHorizontal = (worldX: number): number => -worldX;
export const playerViewHorizontalToWorldX = (horizontal: number): number => -horizontal;

export const OPPONENT_POSITION_PRESETS = Object.freeze([
  { name: 'Baseline center', point: { x: 0, z: COURT.halfLength - 0.65 } },
  { name: 'Deuce corner', point: { x: 3.4, z: COURT.halfLength - 0.65 } },
  { name: 'Ad corner', point: { x: -3.4, z: COURT.halfLength - 0.65 } },
  { name: 'Deuce serve', point: { x: 1.25, z: COURT.halfLength - 0.18 } },
  { name: 'Ad serve', point: { x: -1.25, z: COURT.halfLength - 0.18 } },
  { name: 'Service line center', point: { x: 0, z: COURT.serviceLineFromNet } },
  { name: 'At the net', point: { x: 0, z: 1.2 } },
] as const);

export const CAMERA_PRESETS = Object.freeze({
  realistic: { x: 0, y: 1.7, z: -(COURT.halfLength + 1.5), fov: 54 },
  wide: { x: 0, y: 1.72, z: -(COURT.halfLength + 2.2), fov: 68 },
  baselineLeft: { x: 2.6, y: 1.68, z: -(COURT.halfLength + 1.4), fov: 58 },
  baselineRight: { x: -2.6, y: 1.68, z: -(COURT.halfLength + 1.4), fov: 58 },
  approach: { x: 0, y: 1.67, z: -7.2, fov: 62 },
});
