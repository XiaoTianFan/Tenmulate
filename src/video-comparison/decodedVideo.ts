import { FrameBuffer, type BufferedFrame } from './frameBuffer';
import type { FrameIndex } from './timeline';
import { readVideoFrames } from './videoFrames';
import { REVIEW_PIXELS, reviewSize } from './mediaResources';

/** Both decoders feed the same contact-synchronized presentation barrier. */
export function decodeVideo(file: File, index: FrameIndex, first: number, canvas: HTMLCanvasElement,
  onCompatibility?: () => void, last = index.timestamps.length - 1, onPresented?: (frame: number) => void, clipCount = 1): FrameBuffer {
  const controller = new AbortController();
  async function* frames(): AsyncGenerator<BufferedFrame> {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Playback could not start. Try another video codec.');
    const requests = { length: last - first + 1, at: (position: number) => first + position };
    for await (const sample of readVideoFrames(file, index, requests, controller.signal, onCompatibility, REVIEW_PIXELS)) {
      const size = reviewSize(sample.width, sample.height);
      let snapshot: HTMLCanvasElement | undefined;
      if (size.width !== sample.width || size.height !== sample.height) {
        // Release large hardware surfaces before the lookahead queue retains them.
        // Source coordinates/timestamps remain unchanged for analysis and exports.
        try {
          snapshot = document.createElement('canvas'); snapshot.width = size.width; snapshot.height = size.height;
          const target = snapshot.getContext('2d', { alpha: false });
          if (!target) throw new Error('Could not create the preview canvas.');
          sample.draw(target, 0, 0, size.width, size.height);
        } catch (error) { if (snapshot) snapshot.width = snapshot.height = 0; throw error; }
        finally { sample.close(); }
      }
      yield { frame: sample.frame, bytes: snapshot ? size.width * size.height * 4 : sample.bytes,
        close: () => { if (snapshot) snapshot.width = snapshot.height = 0; else sample.close(); }, draw: () => {
        if (controller.signal.aborted) return;
        if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height; }
        if (snapshot) context.drawImage(snapshot, 0, 0); else sample.draw(context, 0, 0, size.width, size.height);
        if (canvas.dataset) canvas.dataset.frame = String(sample.frame);
        canvas.hidden = false; onPresented?.(sample.frame);
      } };
    }
  }
  const budget = Math.min(16, 48 / Math.max(1, clipCount)) * 1024 * 1024;
  return new FrameBuffer(frames(), first, () => controller.abort(), budget);
}
