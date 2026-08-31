export const COURT = Object.freeze({
  singlesWidth: 8.23,
  doublesWidth: 10.97,
  fullLength: 23.77,
  halfLength: 23.77 / 2,
  serviceLineFromNet: 6.4,
  netCenterHeight: 0.914,
  netPostHeight: 1.07,
  ballRadius: 0.0335,
  internationalSideRunoff: 3.66,
  internationalBackRunoff: 6.4,
  defaultOpponentRunback: 1,
  defaultServeRunback: 0.35,
  defaultEyeHeight: 1.7,
  defaultBehindBaseline: 1.5,
});

export type SurfaceId = 'hard' | 'clay' | 'grass';

export type CameraMoveKey = 'w' | 'a' | 's' | 'd';
export const CAMERA_EYE_HEIGHT_MIN = 0.4;
export const CAMERA_EYE_HEIGHT_MAX = 8;

export const isCameraHeightShortcut = (
  event: Readonly<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey'>>,
): boolean => (
  event.ctrlKey
  && !event.altKey
  && !event.metaKey
  && (event.key.toLowerCase() === 'w' || event.key.toLowerCase() === 's')
);

export type CameraMovement = Readonly<{
  behindBaseline: number;
  lateral: number;
  eyeHeight: number;
}>;

export const cameraMovementForKeys = (
  keys: ReadonlySet<CameraMoveKey>,
  distance: number,
  yawDegrees = 0,
  verticalMode = false,
): CameraMovement => {
  const forward = verticalMode ? 0 : (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const left = (keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0);
  const vertical = verticalMode ? (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0) : 0;
  const horizontalLength = Math.hypot(forward, left);
  const normalizedForward = horizontalLength === 0 ? 0 : forward / horizontalLength;
  const normalizedLeft = horizontalLength === 0 ? 0 : left / horizontalLength;
  const yaw = yawDegrees * Math.PI / 180;
  const worldX = normalizedForward * Math.sin(yaw) + normalizedLeft * Math.cos(yaw);
  const worldZ = normalizedForward * Math.cos(yaw) - normalizedLeft * Math.sin(yaw);
  const clean = (value: number): number => Math.abs(value) < 1e-12 ? 0 : value;
  return {
    behindBaseline: clean(-worldZ * distance),
    lateral: clean(worldX * distance),
    eyeHeight: clean(vertical * distance),
  };
};

export const cameraMovementDelta = (
  key: CameraMoveKey,
  step: number,
  yawDegrees = 0,
  verticalMode = false,
): CameraMovement => cameraMovementForKeys(new Set([key]), step, yawDegrees, verticalMode);

// The FPV camera looks from negative z toward positive z, so positive world x
// appears on the player's left. Keep top-down controls in that player view.
export const worldXToPlayerViewHorizontal = (worldX: number): number => -worldX;
export const playerViewHorizontalToWorldX = (horizontal: number): number => -horizontal;

export type CourtPosition = Readonly<{ x: number; z: number }>;

export const OPPONENT_POSITION_LIMITS = Object.freeze({
  halfWidth: COURT.doublesWidth / 2 + COURT.internationalSideRunoff,
  halfLength: COURT.halfLength + COURT.internationalBackRunoff,
});

export const DEFAULT_RALLY_OPPONENT_POSITION: CourtPosition = Object.freeze({
  x: 0,
  z: COURT.halfLength + COURT.defaultOpponentRunback,
});

export const DEUCE_SERVE_OPPONENT_POSITION: CourtPosition = Object.freeze({
  x: 1.25,
  z: COURT.halfLength + COURT.defaultServeRunback,
});

export const AD_SERVE_OPPONENT_POSITION: CourtPosition = Object.freeze({
  x: -1.25,
  z: COURT.halfLength + COURT.defaultServeRunback,
});

export const clampOpponentPosition = (position: CourtPosition): CourtPosition => ({
  x: Math.min(OPPONENT_POSITION_LIMITS.halfWidth, Math.max(-OPPONENT_POSITION_LIMITS.halfWidth, position.x)),
  z: Math.min(OPPONENT_POSITION_LIMITS.halfLength, Math.max(-OPPONENT_POSITION_LIMITS.halfLength, position.z)),
});

export const OPPONENT_POSITION_PRESETS = Object.freeze([
  { name: 'Baseline center', point: DEFAULT_RALLY_OPPONENT_POSITION },
  { name: 'Deuce corner', point: { x: 3.4, z: DEFAULT_RALLY_OPPONENT_POSITION.z } },
  { name: 'Ad corner', point: { x: -3.4, z: DEFAULT_RALLY_OPPONENT_POSITION.z } },
  { name: 'Deuce serve', point: DEUCE_SERVE_OPPONENT_POSITION },
  { name: 'Ad serve', point: AD_SERVE_OPPONENT_POSITION },
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
