import { PreviewFrames } from './previewFrames';
import type { FrameIndex } from './timeline';
import { drawCropped, normalizeCrop, type CropRect } from './crop';

/** Low-priority frame requests fill the timeline without moving the review frame.
 * The shared reader bounds concurrency and releases idle native/container state. */
export async function previewFilmstrip(
  file: File,
  index: FrameIndex,
  signal: AbortSignal,
  first: number,
  last: number,
  host: HTMLElement,
  crop?: CropRect
) {
  const source = new PreviewFrames(file, index, host, 144 * 90),
    canvas = document.createElement('canvas');
  canvas.width = 144;
  canvas.height = 90;
  const context = canvas.getContext('2d', { alpha: false })!;
  const abort = () => source.dispose();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const images: string[] = [];
    for (let i = 0; i < 12; i++) {
      signal.throwIfAborted();
      const sample = await source.get(Math.round(first + (i / 11) * (last - first)), 1);
      try {
        signal.throwIfAborted();
        context.fillStyle = '#030607';
        context.fillRect(0, 0, 144, 90);
        const region = normalizeCrop(crop), sourceWidth = sample.width * region.width, sourceHeight = sample.height * region.height;
        const scale = Math.min(144 / sourceWidth, 90 / sourceHeight);
        const width = sourceWidth * scale, height = sourceHeight * scale;
        drawCropped(context, (x, y, w, h) => sample.draw(context, x, y, w, h), region,
          { x: (144 - width) / 2, y: (90 - height) / 2, width, height });
        images.push(canvas.toDataURL('image/jpeg', 0.7));
      } finally {
        sample.close();
      }
    }
    return images;
  } finally {
    signal.removeEventListener('abort', abort);
    source.dispose();
    canvas.width = canvas.height = 0;
  }
}
