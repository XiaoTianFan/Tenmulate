import type { PlaybackSource } from './playback';

export type BufferedFrame = { frame: number; bytes: number; draw: () => void; close: () => void };
const MAX_FRAMES = 12;
const MAX_BYTES = 32 * 1024 * 1024;

/** A bounded sequential decoder queue. Requests never start a second seek/decoder.
 * Frames arrive asynchronously, but only the shared scheduler may present them.
 */
export class FrameBuffer implements PlaybackSource {
  private frames: BufferedFrame[] = [];
  private bytes = 0;
  private requested: number;
  private presented = -1;
  private primed = false;
  private reading = false;
  private done = false;
  private stopped = false;
  private error: unknown;

  constructor(private readonly iterator: AsyncIterator<BufferedFrame>, first: number, private readonly release: () => void) {
    this.requested = first;
    this.fill();
  }

  prepare(frame: number): boolean {
    if (this.error) throw this.error;
    this.requested = frame;
    while (this.frames.length && this.frames[0]!.frame < frame) this.dropFirst();
    this.fill();
    if (this.frames[0]?.frame === frame) {
      // Build a short runway at startup and after an underrun, rather than
      // repeatedly starting as soon as a single frame finishes decoding.
      this.primed ||= this.frames.length >= 4 || this.bytes >= MAX_BYTES || this.done;
      return this.primed;
    }
    this.primed = false;
    if (this.done || (this.frames[0] && this.frames[0].frame > frame)) {
      throw new Error('Cannot read this video. Try an MP4, MOV or WebM file.');
    }
    return false;
  }

  present(frame: number): void {
    if (this.stopped || frame === this.presented) return;
    const sample = this.frames[0];
    if (sample?.frame !== frame) throw new Error('Cannot read this video. Try an MP4, MOV or WebM file.');
    sample.draw();
    this.presented = frame;
  }

  private dropFirst(): void {
    const sample = this.frames.shift()!;
    this.bytes -= sample.bytes;
    sample.close();
  }

  private fill(): void {
    if (this.reading || this.done || this.stopped || this.error) return;
    this.reading = true;
    void (async () => {
      try {
        // At most one sample can exceed the byte budget. Keep at least one frame
        // so a single very large source sample cannot deadlock the queue.
        while (!this.stopped && this.frames.length < MAX_FRAMES && (!this.frames.length || this.bytes < MAX_BYTES)) {
          const item = await this.iterator.next();
          if (item.done) { this.done = true; break; }
          if (this.stopped || item.value.frame < this.requested) item.value.close();
          else { this.frames.push(item.value); this.bytes += item.value.bytes; }
        }
      } catch (error) {
        if (!this.stopped) this.error = error;
      } finally { this.reading = false; }
    })();
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    while (this.frames.length) this.dropFirst();
    this.release();
    void this.iterator.return?.().catch(() => { /* The input may already be disposed. */ });
  }
}
