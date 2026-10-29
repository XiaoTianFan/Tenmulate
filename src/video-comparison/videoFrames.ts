import { nativeFrames } from './nativeVideo';
import { ALL_FORMATS, BlobSource, Input, VideoSampleSink, type VideoSample } from 'mediabunny';
import { frameSeekTime, type FrameIndex } from './timeline';

export type ReviewFrame = {
  frame: number; width: number; height: number; bytes: number;
  draw: (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => void;
  close: () => void;
};
export type FrameRequests = { length: number; at: (position: number) => number };


/** Prefer sequential WebCodecs decoding; fall back to the native media decoder
 * when the API, profile, hardware configuration, or runtime decoder fails.
 * Requests can be replayed from the last delivered frame without losing alignment.
 */
export async function* readVideoFrames(file: File, index: FrameIndex, requests: FrameRequests,
  signal: AbortSignal, onCompatibility: () => void = () => {}): AsyncGenerator<ReviewFrame> {
  signal.throwIfAborted();
  let delivered = 0;
  let input: Input | undefined, samples: AsyncGenerator<VideoSample | null, void, unknown> | undefined;
  let closed = false;
  const dispose = () => {
    if (closed) return;
    closed = true;
    void samples?.return().catch(() => {});
    input?.dispose();
  };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    signal.throwIfAborted();
    if (!track || !await track.canDecode()) throw new Error('Native decoder required');
    signal.throwIfAborted();
    function* times() { for (let i = 0; i < requests.length; i++) yield frameSeekTime(index, requests.at(i)); }
    samples = new VideoSampleSink(track).samplesAtTimestamps(times());
    for await (const sample of samples) {
      if (!sample) throw new Error('No readable video frames.');
      if (signal.aborted) { sample.close(); signal.throwIfAborted(); }
      let result: ReviewFrame;
      try {
        result = { frame: requests.at(delivered), width: sample.displayWidth, height: sample.displayHeight, bytes: sample.allocationSize(),
          draw: (context, x, y, width, height) => sample.draw(context, x, y, width, height), close: () => sample.close() };
      } catch (error) { sample.close(); throw error; }
      delivered++;
      yield result;
    }
    if (delivered < requests.length) throw new Error('Incomplete decode');
  } catch {
    signal.throwIfAborted();
    // Native playback can support codecs/profiles that WebCodecs does not expose.
  } finally { signal.removeEventListener('abort', dispose); dispose(); }
  if (delivered < requests.length) {
    signal.throwIfAborted(); onCompatibility();
    yield* nativeFrames(file, index, requests, delivered, signal);
  }
}
