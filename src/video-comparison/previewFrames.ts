import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny';
import { frameSeekTime, type FrameIndex } from './timeline';
import { mountNativeVideo, openNativeVideo, seekNativeVideo } from './nativeVideo';
import { mediaDeadline, MediaQueue, reviewSize } from './mediaResources';
import type { ReviewFrame } from './videoFrames';

const queue = new MediaQueue();
// Review and filmstrips share one active decode and at most two warm readers.
// Native buffers and container caches are also released after idle.
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
  constructor(private file: File, private index: FrameIndex, private nativeHost?: HTMLElement, private maxPixels?: number) {}

  get(frame: number, priority = 0): Promise<ReviewFrame> {
    return queue.run(this.controller.signal, async () => {
      clearTimeout(this.idle);
      warm.delete(this);
      while (warm.size >= 2) warm.values().next().value!.release();
      warm.add(this);
      try { return await this.read(frame); }
      catch (error) { this.release(); throw error; }
      finally {
        if (!this.controller.signal.aborted) this.idle = setTimeout(() => this.release(), 1500);
      }
    }, priority);
  }

  private async read(frame: number): Promise<ReviewFrame> {
    const signal = this.controller.signal;
    signal.throwIfAborted();
    if (!this.native) {
      try {
        if (!this.initialized) {
          this.initialized = true;
          this.input = new Input({ source: new BlobSource(this.file), formats: ALL_FORMATS });
          const track = await mediaDeadline(this.input.getPrimaryVideoTrack(), signal);
          if (!track || !await mediaDeadline(track.canDecode(), signal)) throw new Error('Native decoder required');
          signal.throwIfAborted();
          this.sink = new VideoSampleSink(track);
        }
        const sample = await mediaDeadline(this.sink!.getSample(frameSeekTime(this.index, frame)), signal, 10_000, value => value?.close());
        if (!sample) throw new Error('No readable video frames.');
        if (signal.aborted) { sample.close(); signal.throwIfAborted(); }
        try {
          if (!(sample.displayWidth > 0 && sample.displayHeight > 0)) throw new Error('No readable video frames.');
          return { frame, width: sample.displayWidth, height: sample.displayHeight, bytes: sample.allocationSize(),
            draw: (context, x, y, width, height) => sample.draw(context, x, y, width, height), close: () => sample.close() };
        } catch (error) { sample.close(); throw error; }
      } catch { signal.throwIfAborted(); this.native = true; this.input?.dispose(); this.input = undefined; this.sink = undefined; }
    }
    if (!this.video) {
      this.video = document.createElement('video'); mountNativeVideo(this.video, this.nativeHost);
      this.url = URL.createObjectURL(this.file);
      await openNativeVideo(this.video, this.url, signal);
    }
    if (this.last !== frame) {
      await seekNativeVideo(this.video, frameSeekTime(this.index, frame), signal);
      this.last = frame;
    }
    signal.throwIfAborted();
    // Owned snapshots survive eviction/another seek, including in grid exports.
    const video = this.video, snapshot = document.createElement('canvas');
    const size = this.maxPixels ? reviewSize(video.videoWidth, video.videoHeight, this.maxPixels) : { width: video.videoWidth, height: video.videoHeight };
    snapshot.width = size.width; snapshot.height = size.height;
    try {
      const context = snapshot.getContext('2d', { alpha: false });
      if (!context || !size.width || !size.height) throw new Error('No readable video frames.');
      context.drawImage(video, 0, 0, size.width, size.height);
      return { frame, width: video.videoWidth, height: video.videoHeight, bytes: size.width * size.height * 4,
        draw: (target, x, y, width, height) => target.drawImage(snapshot, x, y, width, height),
        close: () => { snapshot.width = snapshot.height = 0; } };
    } catch (error) { snapshot.width = snapshot.height = 0; throw error; }
  }

  private release() {
    clearTimeout(this.idle); warm.delete(this);
    this.input?.dispose(); this.input = undefined; this.sink = undefined; this.initialized = false;
    this.video?.pause(); this.video?.removeAttribute('src'); this.video?.load(); this.video?.remove(); this.video = undefined; this.last = -1;
    if (this.url) URL.revokeObjectURL(this.url); this.url = undefined;
  }
  dispose() { this.controller.abort(); this.release(); }
  useNative() { this.release(); this.native = true; }
}
