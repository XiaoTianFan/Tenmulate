/** Rhythm changes scheduling and uniform animation time, never ball velocity. */
export const RHYTHM_RANGE = { min: 50, max: 150 } as const;
export const normalizeRhythm = (value: unknown): number => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(RHYTHM_RANGE.max, Math.max(RHYTHM_RANGE.min, value)) : 100;
export const rhythmFromLegacyInterval = (interval: unknown, baseline = 3.5): number =>
  typeof interval === 'number' && Number.isFinite(interval) && interval > 0
    ? normalizeRhythm(100 * baseline / interval) : 100;
export const motionRateForRhythm = (percent: number): number =>
  Math.min(1.2, Math.max(.85, Math.sqrt(normalizeRhythm(percent) / 100)));
