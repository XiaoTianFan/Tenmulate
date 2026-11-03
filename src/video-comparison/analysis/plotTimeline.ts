import type { FrameIndex } from '../timeline';
/** Source-time position, independent of playback speed and link state. */
export function plotContactPosition(index: FrameIndex, contact: number | null, start: number, end: number): number | null {
  if (contact === null || !Number.isInteger(contact) || contact < start || contact > end || contact < 0 || contact >= index.timestamps.length) return null;
  const span = index.timestamps[end] - index.timestamps[start];
  return span > 0 ? (index.timestamps[contact] - index.timestamps[start]) / span : 0;
}
