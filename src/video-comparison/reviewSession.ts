import { PreviewFrames } from './previewFrames';
import {
  reviewCache,
  snapshotReviewFrame,
  closeReviewImage,
  SCRUB_PIXELS,
  type ReviewCache,
  type ReviewCachePool,
  type ReviewImage
} from './reviewCache';
import type { FrameIndex } from './timeline';
import type { ReviewFrame } from './videoFrames';

export type ReviewReader = Pick<PreviewFrames, 'get' | 'fill' | 'dispose'> & {
  useNative?: () => void;
  readonly nativeMode?: boolean;
};
type Options = {
  file: File;
  index: FrameIndex;
  host?: HTMLElement;
  pixels: number;
  retainDetail?: boolean;
  present: (image: ReviewImage, detail: boolean) => void;
  pending: (busy: boolean) => void;
  error: (message: string) => void;
  pool?: ReviewCachePool;
  reader?: () => ReviewReader;
};

/** Bound work by time and memory, with more runway in the current scrub direction.
 * Frame indices (not nominal FPS timestamps) retain VFR/source-frame precision. */
export function reviewWindow(index: FrameIndex, frame: number, direction: number, capacity: number) {
  const count = Math.min(index.timestamps.length, capacity, Math.max(4, Math.ceil(index.fps * 0.8)));
  const behind = Math.floor((count - 1) * (direction > 0 ? 1 / 3 : direction < 0 ? 2 / 3 : 1 / 2));
  const start = Math.max(0, Math.min(index.timestamps.length - count, frame - behind));
  return Array.from({ length: count }, (_, i) => start + i);
}

/** Cache presentation never waits for an active decoder. Only the latest target
 * may paint; speculative samples can populate the LRU but cannot move the cursor. */
export class ReviewSession {
  private cache: ReviewCache;
  private source?: ReviewReader;
  private active = false;
  private disposed = false;
  private wanted = -1;
  private direction = 0;
  private requestedAt = 0;
  private refined = -1;
  private shown = -1;
  private failed = -1;
  private prefetchFailed = -1;
  private detail?: ReviewImage;
  private width = 0;
  private height = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private timerAt = 0;
  private job?: { controller: AbortController; kind: 'target' | 'detail' | 'prefetch'; next?: number };
  constructor(private options: Options) {
    this.cache = (options.pool ?? reviewCache).acquire(options.file);
  }

  setActive(active: boolean) {
    if (this.disposed || active === this.active) return;
    this.active = active;
    this.cache.active += active ? 1 : -1;
    if (active) {
      this.source =
        this.options.reader?.() ??
        new PreviewFrames(
          this.options.file,
          this.options.index,
          this.options.host,
          this.options.pixels,
          8000
        );
      if (this.wanted >= 0) this.request(this.wanted, true);
    } else {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.job?.controller.abort();
      this.source?.dispose();
      this.source = undefined;
      if (this.detail) closeReviewImage(this.detail);
      this.detail = undefined;
      this.refined = -1;
      this.shown = -1;
      this.options.pending(false);
    }
  }
  request(frame: number, redraw = false) {
    frame = Math.max(0, Math.min(this.options.index.timestamps.length - 1, Math.round(frame)));
    if (this.disposed || (!redraw && frame === this.wanted)) return;
    if (frame !== this.wanted) this.direction = this.wanted < 0 ? 0 : Math.sign(frame - this.wanted);
    this.wanted = frame;
    this.requestedAt = performance.now();
    this.failed = -1;
    this.prefetchFailed = -1;
    if (!this.active) return;
    const image = this.detail?.frame === frame ? this.detail : this.cache.get(frame);
    try {
      if (image) this.paint(image, image === this.detail);
      else {
        this.options.pending(true);
        // Only a cache miss needs to interrupt speculative decoding. Cached scrubs
        // stay independent of it, including while another clip is decoding.
        if (this.job?.kind !== 'target' && this.job?.next !== frame) this.job?.controller.abort();
      }
    } catch (error) {
      this.report(error);
      return;
    }
    this.schedule(16);
  }
  private paint(image: ReviewImage, detail: boolean) {
    if (!this.active || image.frame !== this.wanted) return;
    this.shown = image.frame;
    this.width = image.width;
    this.height = image.height;
    this.options.present(image, detail);
    this.options.pending(false);
    this.refined = detail ? image.frame : -1;
    if (this.detail && this.detail !== image) {
      closeReviewImage(this.detail);
      this.detail = undefined;
    }
  }
  private accept(sample: ReviewFrame, show: boolean) {
    this.cache.put(snapshotReviewFrame(sample, SCRUB_PIXELS));
    if (!show || !this.active || sample.frame !== this.wanted) return;
    const image = snapshotReviewFrame(sample, this.options.pixels);
    try {
      this.paint(image, true);
      if (this.options.retainDetail) this.detail = image;
    } finally {
      if (this.detail !== image) closeReviewImage(image);
    }
  }
  private report(error: unknown) {
    this.failed = this.wanted;
    this.options.pending(false);
    this.options.error(error instanceof Error ? error.message : 'No readable video frames.');
  }
  private schedule(delay: number) {
    const due = performance.now() + delay;
    if (this.timer !== undefined && this.timerAt <= due) return;
    clearTimeout(this.timer);
    this.timerAt = due;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.work();
    }, delay);
  }
  private async work() {
    if (!this.active || this.disposed || !this.source || this.wanted < 0 || this.failed === this.wanted)
      return;
    const target = this.wanted,
      cached = this.cache.has(target),
      elapsed = performance.now() - this.requestedAt;
    const needsDetail = this.shown === target && this.refined !== target;
    if (this.job) {
      if (needsDetail && this.job.kind === 'prefetch') {
        if (elapsed >= 180) this.job.controller.abort();
        else this.schedule(180 - elapsed);
      }
      return;
    }
    const kind =
      !cached && this.shown !== target ? 'target' : needsDetail && elapsed >= 180 ? 'detail' : 'prefetch';
    const window = this.width
      ? reviewWindow(this.options.index, target, this.direction, this.cache.capacity(this.width, this.height))
      : [];
    const missing = window.filter((frame) => !this.cache.has(frame));
    const covered = (frame: number) =>
      frame < 0 || frame >= this.options.index.timestamps.length || this.cache.has(frame);
    // Refill in useful batches, not another keyframe seek for every extra lookahead
    // frame. Continue preparing during a sustained scrub; only detail waits for idle.
    const enough = missing.length >= Math.min(8, Math.max(1, Math.floor(window.length / 4)));
    if (
      kind === 'prefetch' &&
      (!missing.length ||
        this.prefetchFailed === target ||
        (!enough && covered(target - 1) && covered(target + 1)))
    ) {
      if (needsDetail && elapsed < 180) this.schedule(180 - elapsed);
      return;
    }
    // Prepare the immediate direction first. In native mode a reverse seek has no
    // sequential WebCodecs advantage, so fetch the closest preceding frame first.
    const before = missing.filter((frame) => frame < target),
      after = missing.filter((frame) => frame > target);
    const batch = this.direction < 0 ? (before.length ? before : after) : after.length ? after : before;
    if (!batch.length) batch.push(...missing);
    if (this.source.nativeMode && batch === before) batch.reverse();
    const job: NonNullable<ReviewSession['job']> = {
      controller: new AbortController(),
      kind,
      next: kind === 'prefetch' ? batch[0] : undefined
    };
    this.job = job;
    let retryBackground = false;
    try {
      if (kind === 'prefetch') {
        // Evict outside the new runway first. Plain LRU would evict unvisited
        // upcoming frames before the just-viewed frames behind the cursor.
        this.cache.retain(window);
        await this.source.fill(
          batch,
          (sample) => {
            this.accept(sample, sample.frame === this.wanted);
            job.next = batch[batch.indexOf(sample.frame) + 1];
          },
          job.controller.signal
        );
      } else {
        let sample: ReviewFrame;
        try {
          sample = await this.source.get(
            target,
            kind === 'target' ? -10 : 0,
            job.controller.signal,
            kind === 'detail'
          );
        } catch (error) {
          if (
            kind !== 'target' ||
            target !== this.wanted ||
            job.controller.signal.aborted ||
            !this.source?.useNative
          )
            throw error;
          // Keep the clean native retry used by paused review for intermittent
          // codec/initialization failures. Retry once, without losing annotations.
          this.source.useNative();
          sample = await this.source.get(target, -10, job.controller.signal);
        }
        try {
          if (!job.controller.signal.aborted && this.active) this.accept(sample, target === this.wanted);
        } finally {
          sample.close();
        }
      }
    } catch (error) {
      if (this.active && !job.controller.signal.aborted) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
          retryBackground = true; // Priority preemption.
        else if (kind === 'target' && target === this.wanted) this.report(error);
        else if (kind === 'detail' && target === this.wanted)
          this.refined = target; // Keep the usable cached image.
        else if (kind === 'prefetch') this.prefetchFailed = target; // Optional work must not replace a good frame with an error.
      }
    } finally {
      this.job = undefined;
      // A newer cached target may have painted during this await; never repaint it
      // with the older result, and never wait for speculative work to show a cache hit.
      if (this.active && this.failed !== this.wanted)
        this.schedule(retryBackground ? 100 : this.cache.has(this.wanted) ? 30 : 0);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.setActive(false);
    this.disposed = true;
    clearTimeout(this.timer);
    this.cache.release();
  }
}
