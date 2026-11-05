import { reviewSize } from './mediaResources';
import type { ReviewFrame } from './videoFrames';

// Owned navigation pictures, not retained hardware VideoFrames. Shared by a clip's
// card and marking dialog, and bounded across every loaded clip.
export const SCRUB_PIXELS = 640 * 360;
export const SCRUB_CACHE_BYTES = 48 * 1024 * 1024;
export const SCRUB_CACHE_FRAMES = 48;
export type ReviewImage = { frame: number; canvas: HTMLCanvasElement; width: number; height: number };
export function closeReviewImage(image: ReviewImage) {
  image.canvas.width = image.canvas.height = 0;
}
export function snapshotReviewFrame(sample: ReviewFrame, pixels: number): ReviewImage {
  const size = reviewSize(sample.width, sample.height, pixels),
    canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not create the preview canvas.');
    sample.draw(context, 0, 0, size.width, size.height);
    return { frame: sample.frame, canvas, width: sample.width, height: sample.height };
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  }
}

type Entry = { owner: ReviewCache; image: ReviewImage; bytes: number };
/** A global LRU prevents nine cards from each allocating an independent budget. */
export class ReviewCachePool {
  private entries = new Map<ReviewImage, Entry>();
  private owners = new Map<object, ReviewCache>();
  bytes = 0;
  constructor(readonly limit = SCRUB_CACHE_BYTES) {}
  acquire(key: object) {
    let cache = this.owners.get(key);
    if (!cache) {
      cache = new ReviewCache(this, key);
      this.owners.set(key, cache);
    }
    cache.references++;
    return cache;
  }
  get activeCount() {
    return Math.max(1, [...this.owners.values()].filter((c) => c.active > 0).length);
  }
  touch(image: ReviewImage) {
    const entry = this.entries.get(image);
    if (entry) {
      this.entries.delete(image);
      this.entries.set(image, entry);
    }
  }
  add(owner: ReviewCache, image: ReviewImage) {
    const bytes = image.canvas.width * image.canvas.height * 4;
    if (bytes > this.limit) {
      closeReviewImage(image);
      return false;
    }
    while (this.bytes + bytes > this.limit) this.remove(this.entries.keys().next().value!);
    this.entries.set(image, { owner, image, bytes });
    this.bytes += bytes;
    return true;
  }
  remove(image: ReviewImage) {
    const entry = this.entries.get(image);
    if (!entry) return;
    this.entries.delete(image);
    this.bytes -= entry.bytes;
    entry.owner.frames.delete(image.frame);
    closeReviewImage(image);
  }
  release(owner: ReviewCache) {
    if (--owner.references > 0) return;
    for (const image of owner.frames.values()) this.remove(image);
    this.owners.delete(owner.key);
  }
}
export class ReviewCache {
  readonly frames = new Map<number, ReviewImage>();
  references = 0;
  active = 0;
  constructor(
    readonly pool: ReviewCachePool,
    readonly key: object
  ) {}
  get(frame: number) {
    const image = this.frames.get(frame);
    if (image && !this.has(frame)) return undefined;
    if (image) {
      this.frames.delete(frame);
      this.frames.set(frame, image);
      this.pool.touch(image);
    }
    return image;
  }
  has(frame: number) {
    const image = this.frames.get(frame);
    if (!image) return false;
    if (!image.canvas.width || !image.canvas.height || image.canvas.getContext('2d')?.isContextLost?.()) {
      this.pool.remove(image);
      return false;
    }
    return true;
  }
  put(image: ReviewImage) {
    const old = this.frames.get(image.frame);
    if (old) this.pool.remove(old);
    while (this.frames.size >= SCRUB_CACHE_FRAMES) this.pool.remove(this.frames.values().next().value!);
    if (this.pool.add(this, image)) this.frames.set(image.frame, image);
  }
  retain(window: number[]) {
    const keep = new Set(window);
    for (const [frame, image] of this.frames) if (!keep.has(frame)) this.pool.remove(image);
  }
  capacity(width: number, height: number) {
    const size = reviewSize(width, height, SCRUB_PIXELS);
    return Math.max(
      2,
      Math.min(
        SCRUB_CACHE_FRAMES,
        Math.floor(this.pool.limit / this.pool.activeCount / (size.width * size.height * 4))
      )
    );
  }
  release() {
    this.pool.release(this);
  }
}
export const reviewCache = new ReviewCachePool();
