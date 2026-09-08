/** Preferred source/movement pace. The interval solver may raise either within
 * this range; outgoing ball speed remains independent. */
export const RHYTHM_RANGE = { min: 50, max: 300 } as const;
export const normalizeRhythm = (value: unknown): number => typeof value === 'number' && Number.isFinite(value)
  ? Math.min(RHYTHM_RANGE.max, Math.max(RHYTHM_RANGE.min, value)) : 100;
export const rhythmFromLegacyInterval = (interval: unknown, baseline = 3.5): number =>
  typeof interval === 'number' && Number.isFinite(interval) && interval > 0
    ? normalizeRhythm(100 * baseline / interval) : 100;
export const motionRateForRhythm = (percent: number): number => normalizeRhythm(percent) / 100;
export const normalizeShotInterval = (value: unknown, fallback = 5): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(30,Math.max(1,value)) : fallback;
