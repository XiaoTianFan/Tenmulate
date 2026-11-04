import { clipFrameRange, comparisonTime } from '../timeline';
import type { ExportClip } from '../exportPlan';
import type { Cell } from '../exportLayout';

/** Three rendered seconds from contact, independent of source recording slowdown.
 * Ended/trimmed clips cannot display a label on an indefinitely held last frame. */
export function speedLabelVisible(clip: ExportClip, sharedTime: number, rate: number) {
  if (!clip.serveEstimate || !Number.isFinite(clip.serveEstimate.launchKph) || rate <= 0) return false;
  const range = clipFrameRange(clip),
    end = comparisonTime(clip, range.end);
  return sharedTime >= 0 && sharedTime / rate < 3 && sharedTime <= end + 1e-7;
}

export function drawSpeedLabel(
  context: CanvasRenderingContext2D,
  clip: ExportClip,
  rect: Cell,
  sharedTime: number,
  rate: number,
  caption: string
) {
  if (!speedLabelVisible(clip, sharedTime, rate)) return;
  const size = Math.max(10, Math.min(30, rect.width / 17, rect.height / 9));
  const text = `${caption} ≈ ${Math.round(clip.serveEstimate!.launchKph)} km/h`;
  context.save();
  context.font = `600 ${size}px sans-serif`;
  context.textBaseline = 'middle';
  const padding = size * 0.55,
    width = Math.min(rect.width - 12, context.measureText(text).width + padding * 2);
  const height = size * 2,
    left = rect.x + 6,
    top = rect.y + rect.height - height - 6;
  context.fillStyle = '#071015dc';
  context.fillRect(left, top, width, height);
  context.fillStyle = '#f6e62d';
  context.fillText(text, left + padding, top + height / 2, width - padding * 2);
  context.restore();
}
