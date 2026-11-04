import { clipFrameRange } from '../timeline';
import type { DataClip, DataSection } from './types';
export const finite = (value: number | undefined | null) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
export function timeAt(clip: DataClip, frame: number | null) {
  return frame === null ? null : finite(clip.index.timestamps[frame]);
}
export function frameReference(clip: DataClip, frame: number) {
  const sourceTimeSeconds = timeAt(clip, frame),
    contact = timeAt(clip, clip.contact);
  const contactRelativeSourceSeconds =
    sourceTimeSeconds !== null && contact !== null ? sourceTimeSeconds - contact : null;
  return {
    frame,
    displayFrame: frame + 1,
    sourceTimeSeconds,
    contactRelativeSourceSeconds,
    contactRelativeTimelineSeconds:
      contactRelativeSourceSeconds !== null ? contactRelativeSourceSeconds / clip.speed : null
  };
}
export function frameColumns(clip: DataClip, start: number, end: number) {
  const rows = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => frameReference(clip, start + i));
  return {
    frame: rows.map((r) => r.frame),
    sourceTimeSeconds: rows.map((r) => r.sourceTimeSeconds),
    contactRelativeSourceSeconds: rows.map((r) => r.contactRelativeSourceSeconds),
    contactRelativeTimelineSeconds: rows.map((r) => r.contactRelativeTimelineSeconds)
  };
}
export function exportMetadata(clip: DataClip, section: DataSection) {
  const range = clipFrameRange(clip);
  return {
    schema: 'tenmulate.analysis-data',
    version: 1,
    section,
    exportedAt: new Date().toISOString(),
    clip: {
      id: clip.id,
      name: clip.name,
      source: {
        widthPixels: clip.sourceWidth,
        heightPixels: clip.sourceHeight,
        frameCount: clip.index.timestamps.length,
        fps: clip.index.fps,
        variableFrameRate: clip.index.variable,
        endTimeSeconds: clip.index.end,
        timestampsSeconds: Array.from(clip.index.timestamps)
      },
      excerpt: { start: frameReference(clip, range.start), end: frameReference(clip, range.end), inclusive: true },
      contact: clip.contact === null ? null : frameReference(clip, clip.contact),
      presentation: {
        playbackRate: clip.speed,
        mirrored: clip.mirrored ?? false,
        crop: clip.crop ?? { x: 0, y: 0, width: 1, height: 1 }
      }
    },
    conventions: {
      frames: 'Zero-based absolute source indices; displayFrame is frame + 1. Frame ranges are inclusive.',
      samples: 'Parallel column arrays share the frame column. Full stored resolution; no chart downsampling.',
      image:
        'Original oriented, unmirrored, uncropped image. Normalized x is rightward, y downward, origin top left. Pixels scale by source width/height.',
      motionMetrics:
        'Positions and derivatives use original pixels with x rightward and y upward from the image bottom.',
      time: 'Source presentation seconds, including variable frame intervals. Motion derivatives do not use playback rate or serve recording slowdown.',
      comparisonTime:
        'Contact-relative timeline seconds = contact-relative source seconds / clip playbackRate. Global playback speed changes wall-clock playback only.',
      missing:
        'null means unavailable/non-finite, never zero. State 0 = missing, 1 = observed, 2 = manual, 3 = estimated. Confidence is not a probability of correctness.',
      completeness:
        'Contains all currently retained annotations and results, including hidden tracks/joints and samples outside the current excerpt. Partial or missing results are explicit.'
    }
  };
}
/** JSON has no typed arrays or non-finite numbers. Preserve zeros and null gaps. */
export function serializeData(value: unknown) {
  return JSON.stringify(value, (_key, item) =>
    ArrayBuffer.isView(item) && !(item instanceof DataView)
      ? Array.from(item as unknown as ArrayLike<number>)
      : typeof item === 'number' && !Number.isFinite(item)
        ? null
        : item
  );
}
