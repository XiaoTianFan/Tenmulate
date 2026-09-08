// Retain the stored ballFocus key so existing highlight choices survive blur removal.
export type BallFocusSettings = Readonly<{ enabled: boolean }>;
export const DEFAULT_BALL_FOCUS: BallFocusSettings = Object.freeze({ enabled: false });

export function normalizeBallFocus(value: unknown): BallFocusSettings {
  const data = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return { enabled: data.enabled === true };
}

const EXPONENTIAL_RANGE = Math.expm1(4);

/** Net is z=0. Only incoming flights crossing onto the camera's court half qualify.
 * Normalize court depth so baseline, corner and volley views share the same curve.
 * Position alone controls the envelope; the renderer separately excludes balls
 * outside the camera frustum, with no screen-edge taper or release tail.
 */
export function ballFocusWeight(ballZ: number, sourceZ: number, cameraZ: number, forwardDistance: number): number {
  if (![ballZ, sourceZ, cameraZ, forwardDistance].every(Number.isFinite)
    || Math.abs(cameraZ) < .001 || sourceZ * cameraZ >= 0 || forwardDistance <= 0) return 0;
  const progress = ballZ / cameraZ;
  if (progress <= 0 || progress >= 1) return 0;
  return Math.expm1(4 * progress) / EXPONENTIAL_RANGE;
}
