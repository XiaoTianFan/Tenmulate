import { ALL_FORMATS, BlobSource, Input, VideoSampleSink, type VideoSample } from 'mediabunny';
import { frameSeekTime, type FrameIndex } from './timeline';
import { mountNativeVideo, openNativeVideo, seekNativeVideo } from './nativeVideo';
import { mediaDeadline, MediaQueue, reviewSize } from './mediaResources';
import type { ReviewFrame } from './videoFrames';

const queue = new MediaQueue();
// Review and filmstrips share one active decode and at most two warm readers.
const warm = new Set<PreviewFrames>();

export class PreviewFrames {
  private input?: Input;
  private sink?: VideoSampleSink;
  private video?: HTMLVideoElement;
  private url?: string;
  private initialized = false;
  private native = false;
  private last = -1;
  private idle?: ReturnType<typeof setTimeout>;
  private controller = new AbortController();
  constructor(
    private file: File,
    private index: FrameIndex,
    private nativeHost?: HTMLElement,
    private maxPixels?: number,
    private idleMilliseconds = 1500
  ) {}

  get nativeMode() {
    return this.native;
  }

  get(frame: number, priority = 0, signal?: AbortSignal, preemptible = false): Promise<ReviewFrame> {
    return this.run((s) => this.read(frame, s), priority, signal, preemptible);
  }

  /** A finite ascending batch shares one keyframe decode. Only owned, resized
   * snapshots may escape consume; each hardware sample is closed immediately. */
  fill(frames: number[], consume: (sample: ReviewFrame) => void, signal: AbortSignal) {
    return this.run(
      async (s) => {
        let delivered = 0;
        for await (const sample of this.range(frames, s)) {
          try {
            s.throwIfAborted();
            consume(sample);
          } finally {
            sample.close();
          }
          // Give pointer events/cache-hit painting a turn even on a very fast decoder.
          if (++delivered % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        }
      },
      1,
      signal,
      true
    );
  }

  private async run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    priority: number,
    signal?: AbortSignal,
    preemptible = false
  ): Promise<T> {
    const operation = new AbortController(),
      abort = () => operation.abort();
    const signals = [this.controller.signal, ...(signal ? [signal] : [])];
    for (const source of signals) {
      source.addEventListener('abort', abort, { once: true });
      if (source.aborted) abort();
    }
    try {
      return await queue.run(
        operation.signal,
        async () => {
          clearTimeout(this.idle);
          warm.delete(this);
          while (warm.size >= 2) warm.values().next().value!.release();
          warm.add(this);
          const interrupt = () => this.release();
          operation.signal.addEventListener('abort', interrupt, { once: true });
          try {
            return await work(operation.signal);
          } catch (error) {
            this.release();
            throw error;
          } finally {
            operation.signal.removeEventListener('abort', interrupt);
            if (!operation.signal.aborted)
              this.idle = setTimeout(() => this.release(), this.idleMilliseconds);
          }
        },
        priority,
        preemptible ? abort : undefined
      );
    } finally {
      for (const source of signals) source.removeEventListener('abort', abort);
    }
  }

  private async prepare(signal: AbortSignal) {
    if (this.initialized) return;
    this.initialized = true;
    this.input = new Input({ source: new BlobSource(this.file), formats: ALL_FORMATS });
    const track = await mediaDeadline(this.input.getPrimaryVideoTrack(), signal);
    if (!track || !(await mediaDeadline(track.canDecode(), signal)))
      throw new Error('Native decoder required');
    signal.throwIfAborted();
    this.sink = new VideoSampleSink(track);
  }
  private wrap(frame: number, sample: VideoSample): ReviewFrame {
    try {
      if (!(sample.displayWidth > 0 && sample.displayHeight > 0))
        throw new Error('No readable video frames.');
      return {
        frame,
        width: sample.displayWidth,
        height: sample.displayHeight,
        bytes: sample.allocationSize(),
        draw: (context, x, y, width, height) => sample.draw(context, x, y, width, height),
        close: () => sample.close()
      };
    } catch (error) {
      sample.close();
      throw error;
    }
  }
  private fallback() {
    this.native = true;
    this.input?.dispose();
    this.input = undefined;
    this.sink = undefined;
  }

  private async *range(frames: number[], signal: AbortSignal): AsyncGenerator<ReviewFrame> {
    let delivered = 0,
      samples: AsyncGenerator<VideoSample | null, void, unknown> | undefined;
    signal.throwIfAborted();
    if (!this.native) {
      try {
        await this.prepare(signal);
        samples = this.sink!.samplesAtTimestamps(frames.map((frame) => frameSeekTime(this.index, frame)));
        while (delivered < frames.length) {
          const item = await mediaDeadline(samples.next(), signal, 10_000, (value) => {
            if (!value.done) value.value?.close();
          });
          if (item.done || !item.value) throw new Error('No readable video frames.');
          const sample = this.wrap(frames[delivered], item.value);
          delivered++;
          yield sample;
          signal.throwIfAborted();
        }
      } catch {
        signal.throwIfAborted();
        this.fallback();
      } finally {
        await samples?.return().catch(() => {});
      }
    }
    while (delivered < frames.length) yield await this.read(frames[delivered++], signal);
  }

  private async read(frame: number, signal: AbortSignal): Promise<ReviewFrame> {
    signal.throwIfAborted();
    if (!this.native) {
      try {
        await this.prepare(signal);
        const sample = await mediaDeadline(
          this.sink!.getSample(frameSeekTime(this.index, frame)),
          signal,
          10_000,
          (value) => value?.close()
        );
        if (!sample) throw new Error('No readable video frames.');
        if (signal.aborted) {
          sample.close();
          signal.throwIfAborted();
        }
        return this.wrap(frame, sample);
      } catch {
        signal.throwIfAborted();
        this.fallback();
      }
    }
    if (!this.video) {
      this.video = document.createElement('video');
      mountNativeVideo(this.video, this.nativeHost);
      this.url = URL.createObjectURL(this.file);
      await openNativeVideo(this.video, this.url, signal);
    }
    if (this.last !== frame) {
      await seekNativeVideo(this.video, frameSeekTime(this.index, frame), signal);
      this.last = frame;
    }
    signal.throwIfAborted();
    // Owned snapshots survive eviction/another seek, including in grid exports.
    const video = this.video,
      snapshot = document.createElement('canvas');
    const size = this.maxPixels
      ? reviewSize(video.videoWidth, video.videoHeight, this.maxPixels)
      : { width: video.videoWidth, height: video.videoHeight };
    snapshot.width = size.width;
    snapshot.height = size.height;
    try {
      const context = snapshot.getContext('2d', { alpha: false });
      if (!context || !size.width || !size.height) throw new Error('No readable video frames.');
      context.drawImage(video, 0, 0, size.width, size.height);
      return {
        frame,
        width: video.videoWidth,
        height: video.videoHeight,
        bytes: size.width * size.height * 4,
        draw: (target, x, y, width, height) => target.drawImage(snapshot, x, y, width, height),
        close: () => {
          snapshot.width = snapshot.height = 0;
        }
      };
    } catch (error) {
      snapshot.width = snapshot.height = 0;
      throw error;
    }
  }

  private release() {
    clearTimeout(this.idle);
    warm.delete(this);
    this.input?.dispose();
    this.input = undefined;
    this.sink = undefined;
    this.initialized = false;
    this.video?.pause();
    this.video?.removeAttribute('src');
    this.video?.load();
    this.video?.remove();
    this.video = undefined;
    this.last = -1;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
  }
  dispose() {
    this.controller.abort();
    this.release();
  }
  useNative() {
    this.release();
    this.native = true;
  }
}
