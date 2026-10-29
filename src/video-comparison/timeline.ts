/** Presentation timestamps, in the same seconds used by HTMLVideoElement. */
export type FrameIndex = Readonly<{
  timestamps: Float64Array;
  end: number;
  fps: number;
  variable: boolean;
}>;

export type AlignedClip = Readonly<{ index: FrameIndex; contact: number; speed: number; trim?: { start: number; end: number } }>;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function createFrameIndex(packets: readonly { timestamp: number; duration: number }[]): FrameIndex {
  const sorted = packets.filter(p => Number.isFinite(p.timestamp) && p.timestamp >= 0)
    .slice().sort((a, b) => a.timestamp - b.timestamp);
  const unique = sorted.filter((p, i) => i === 0 || p.timestamp - sorted[i - 1]!.timestamp > 1e-7);
  if (!unique.length) throw new Error('No readable video frames.');
  const timestamps = Float64Array.from(unique, p => p.timestamp);
  const deltas = unique.slice(1).map((p, i) => p.timestamp - unique[i]!.timestamp);
  const ordered = [...deltas].sort((a, b) => a - b);
  const typical = ordered.length ? ordered[Math.floor(ordered.length / 2)]! : unique[0]!.duration;
  if (!(typical > 0)) throw new Error('No readable video frames.');
  const last = unique[unique.length - 1]!;
  return { timestamps, end: last.timestamp + (last.duration > 0 ? last.duration : typical),
    fps: deltas.length ? deltas.length / (last.timestamp - timestamps[0]!) : 1 / typical,
    variable: deltas.some(delta => Math.abs(delta - typical) > Math.max(0.002, typical * 0.05)) };
}

/** The visible frame at a media timestamp, including variable-rate intervals. */
export function frameAt(index: FrameIndex, seconds: number): number {
  const times = index.timestamps;
  let low = 0, high = times.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (times[mid]! <= seconds + 1e-7) low = mid + 1; else high = mid;
  }
  return Math.max(0, low - 1);
}

export function mediaTime(clip: AlignedClip, sharedTime: number): number {
  return clip.index.timestamps[clip.contact]! + sharedTime * clip.speed;
}

/** Inclusive source-frame excerpt. Contact remains an absolute source anchor. */
export function clipFrameRange(clip: { index: FrameIndex; trim?: { start: number; end: number } }) {
  const last = clip.index.timestamps.length - 1;
  const start = clamp(Math.round(clip.trim?.start ?? 0), 0, last);
  return { start, end: clamp(Math.round(clip.trim?.end ?? last), start, last) };
}

export function frameForTime(clip: AlignedClip, sharedTime: number): number {
  const range = clipFrameRange(clip);
  return clamp(frameAt(clip.index, mediaTime(clip, sharedTime)), range.start, range.end);
}

export function comparisonTime(clip: AlignedClip, frame: number): number {
  return (clip.index.timestamps[frame]! - clip.index.timestamps[clip.contact]!) / clip.speed;
}

/** Union: shorter clips hold their first/last frame instead of disappearing. */
export function comparisonRange(clips: readonly AlignedClip[]): { start: number; end: number } {
  if (!clips.length) return { start: 0, end: 0 };
  return {
    start: Math.min(...clips.map(c => comparisonTime(c, clipFrameRange(c).start))),
    end: Math.max(...clips.map(c => comparisonTime(c, clipFrameRange(c).end))),
  };
}

/** Step the densest timeline, so no distinct source frame boundary is skipped. */
export function stepComparison(clips: readonly AlignedClip[], time: number, direction: -1 | 1): number {
  const candidates = clips.flatMap(clip => {
    const range = clipFrameRange(clip);
    const frame = frameForTime(clip, time);
    const at = comparisonTime(clip, frame);
    const next = direction === 1 ? (at > time + 1e-7 ? frame : frame + 1)
      : (at < time - 1e-7 ? frame : frame - 1);
    return next >= range.start && next <= range.end ? [comparisonTime(clip, next)] : [];
  });
  return candidates.length ? (direction === 1 ? Math.min(...candidates) : Math.max(...candidates)) : time;
}

/** Seek inside the sample, avoiding floating-point ambiguity on frame boundaries. */
export function frameSeekTime(index: FrameIndex, frame: number): number {
  const start = index.timestamps[frame]!;
  const end = index.timestamps[frame + 1] ?? index.end;
  return start + Math.min(0.001, (end - start) / 4);
}

export function formatTime(seconds: number, signed = false): string {
  const magnitude = Math.abs(seconds);
  return `${seconds < -0.0005 ? '−' : signed ? '+' : ''}${Math.floor(magnitude / 60).toString().padStart(2, '0')}:${(magnitude % 60).toFixed(3).padStart(6, '0')}`;
}
