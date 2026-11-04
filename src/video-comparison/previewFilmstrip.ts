import { PreviewFrames } from './previewFrames';
import type { FrameIndex } from './timeline';

/** A separate decoder fills the marking timeline without moving its review frame.
 * The native fallback is hosted in one thumbnail cell while images are prepared. */
export async function previewFilmstrip(
  file: File,
  index: FrameIndex,
  signal: AbortSignal,
  first: number,
  last: number,
  host: HTMLElement
) {
  const source = new PreviewFrames(file, index, host),
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
      const sample = await source.get(Math.round(first + (i / 11) * (last - first)));
      try {
        signal.throwIfAborted();
        context.fillStyle = '#030607';
        context.fillRect(0, 0, 144, 90);
        const scale = Math.min(144 / sample.width, 90 / sample.height);
        const width = sample.width * scale,
          height = sample.height * scale;
        sample.draw(context, (144 - width) / 2, (90 - height) / 2, width, height);
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
