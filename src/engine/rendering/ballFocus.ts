export type BallFocusSettings = Readonly<{ enabled: boolean; maxBlurPx: number }>;
export const DEFAULT_BALL_FOCUS: BallFocusSettings = Object.freeze({ enabled: false, maxBlurPx: 1.5 });
export const MAX_BALL_FOCUS_BLUR_PX = 5;

export function normalizeBallFocus(value: unknown): BallFocusSettings {
  const data = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return {
    enabled: data.enabled === true,
    maxBlurPx: typeof data.maxBlurPx === 'number' && Number.isFinite(data.maxBlurPx)
      ? Math.max(0, Math.min(MAX_BALL_FOCUS_BLUR_PX, data.maxBlurPx)) : DEFAULT_BALL_FOCUS.maxBlurPx,
  };
}

const EXPONENTIAL_RANGE = Math.expm1(4);

/** Net is z=0. Only incoming flights crossing onto the camera's court half qualify.
 * Normalize court depth so baseline, corner and volley views share the same curve.
 * Position alone controls the envelope: no release tail after passing the camera,
 * and no early screen-edge fade when a close ball moves below the viewport.
 */
export function ballFocusWeight(ballZ: number, sourceZ: number, cameraZ: number, forwardDistance: number): number {
  if (![ballZ, sourceZ, cameraZ, forwardDistance].every(Number.isFinite)
    || Math.abs(cameraZ) < .001 || sourceZ * cameraZ >= 0 || forwardDistance <= 0) return 0;
  const progress = ballZ / cameraZ;
  if (progress <= 0 || progress >= 1) return 0;
  return Math.expm1(4 * progress) / EXPONENTIAL_RANGE;
}
