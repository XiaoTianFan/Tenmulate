import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny';
import { frameSeekTime, type FrameIndex } from './timeline';
import { waitForMedia } from './nativeVideo';
import type { ReviewFrame } from './videoFrames';

/** Persistent, serialized random-access decoder for interactive export scrubbing. */
export class PreviewFrames {
  private input?: Input;
  private sink?: VideoSampleSink;
  private video?: HTMLVideoElement;
  private url?: string;
  private initialized = false;
  private native = false;
  private last = -1;
  private controller = new AbortController();
  constructor(private file: File, private index: FrameIndex) {}
  async get(frame: number): Promise<ReviewFrame> {
    const signal = this.controller.signal;
    signal.throwIfAborted();
    if (!this.initialized) {
      this.initialized = true;
      try {
        this.input = new Input({ source: new BlobSource(this.file), formats: ALL_FORMATS });
        const track = await this.input.getPrimaryVideoTrack();
        if (track && await track.canDecode()) this.sink = new VideoSampleSink(track);
      } catch { /* Try the native decoder below. */ }
    }
    signal.throwIfAborted();
    if (this.sink && !this.native) {
      try {
        const sample = await this.sink.getSample(frameSeekTime(this.index, frame));
        if (!sample) throw new Error('No readable video frames.');
        if (signal.aborted) { sample.close(); signal.throwIfAborted(); }
        try {
          return { frame, width: sample.displayWidth, height: sample.displayHeight, bytes: sample.allocationSize(),
            draw: (context, x, y, width, height) => sample.draw(context, x, y, width, height), close: () => sample.close() };
        } catch (error) { sample.close(); throw error; }
      } catch { signal.throwIfAborted(); }
    }
    this.native = true; this.input?.dispose(); this.input = undefined; this.sink = undefined;
    if (!this.video) {
      this.video = document.createElement('video'); this.video.muted = true; this.video.playsInline = true; this.video.preload = 'auto';
      this.url = URL.createObjectURL(this.file);
      await waitForMedia(this.video, 'loadeddata', signal, () => { this.video!.src = this.url!; });
    }
    if (this.last !== frame) {
      await waitForMedia(this.video, 'seeked', signal, () => { this.video!.currentTime = frameSeekTime(this.index, frame); });
      this.last = frame;
    }
    signal.throwIfAborted();
    const video = this.video;
    // Caller draws before requesting the next frame, so no extra full-size snapshot is needed.
    return { frame, width: video.videoWidth, height: video.videoHeight, bytes: 0,
      draw: (context, x, y, width, height) => context.drawImage(video, x, y, width, height), close: () => {} };
  }
  dispose() {
    this.controller.abort(); this.input?.dispose(); this.input = undefined;
    this.video?.pause(); this.video?.removeAttribute('src'); this.video?.load(); this.video = undefined;
    if (this.url) URL.revokeObjectURL(this.url); this.url = undefined;
  }
}
