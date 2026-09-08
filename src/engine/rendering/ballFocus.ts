export type BallFocusSettings = Readonly<{ enabled: boolean; maxBlurPx: number }>;
export const DEFAULT_BALL_FOCUS: BallFocusSettings = Object.freeze({ enabled: false, maxBlurPx: 3 });
export const MAX_BALL_FOCUS_BLUR_PX = 6;

export function normalizeBallFocus(value: unknown): BallFocusSettings {
  const data = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return {
    enabled: data.enabled === true,
    maxBlurPx: typeof data.maxBlurPx === 'number' && Number.isFinite(data.maxBlurPx)
      ? Math.max(0, Math.min(MAX_BALL_FOCUS_BLUR_PX, data.maxBlurPx)) : DEFAULT_BALL_FOCUS.maxBlurPx,
  };
}

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** Camera-space distance, in metres. Smoothly release as the ball leaves the view. */
export function ballFocusWeight(distance: number, forwardDistance: number, screenX: number, screenY: number): number {
  if (![distance, forwardDistance, screenX, screenY].every(Number.isFinite) || forwardDistance <= 0) return 0;
  return smooth((16 - distance) / 13.5) * smooth(forwardDistance / .8)
    * smooth((1.12 - Math.abs(screenX)) / .22) * smooth((1.12 - Math.abs(screenY)) / .22);
}

/** Only the visual envelope uses wall time; no feedback into the session clock. */
export function advanceBallFocus(current: number, target: number, delta: number): number {
  const tau = target > current ? .075 : .22;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) / tau));
}
