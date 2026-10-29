import { FrameBuffer, type BufferedFrame } from './frameBuffer';
import type { FrameIndex } from './timeline';
import { readVideoFrames } from './videoFrames';

/** Both decoders feed the same contact-synchronized presentation barrier. */
export function decodeVideo(file: File, index: FrameIndex, first: number, canvas: HTMLCanvasElement,
  onCompatibility?: () => void, last = index.timestamps.length - 1): FrameBuffer {
  const controller = new AbortController();
  async function* frames(): AsyncGenerator<BufferedFrame> {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Playback could not start. Try another video codec.');
    const requests = { length: last - first + 1, at: (position: number) => first + position };
    for await (const sample of readVideoFrames(file, index, requests, controller.signal, onCompatibility)) {
      yield { frame: sample.frame, bytes: sample.bytes, close: () => sample.close(), draw: () => {
        if (controller.signal.aborted) return;
        if (canvas.width !== sample.width || canvas.height !== sample.height) { canvas.width = sample.width; canvas.height = sample.height; }
        sample.draw(context, 0, 0, sample.width, sample.height);
        canvas.hidden = false;
      } };
    }
  }
  return new FrameBuffer(frames(), first, () => controller.abort());
}
