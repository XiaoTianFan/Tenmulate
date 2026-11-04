/** Review surfaces are bounded independently of source/analysis/export resolution. */
export const REVIEW_PIXELS = 1280 * 720;
export function reviewSize(width: number, height: number, pixels = REVIEW_PIXELS) {
  if (!(width > 0 && height > 0)) throw new Error('No readable video frames.');
  const scale = Math.min(1, Math.sqrt(pixels / (width * height)), 1920 / Math.max(width, height));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}

/** Abort/timeouts also reclaim late results; Promise.race alone leaks VideoFrames. */
export function mediaDeadline<T>(pending: Promise<T>, signal: AbortSignal, milliseconds = 10_000,
  late?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const fail = (error: unknown) => { if (settled) return; settled = true; clean(); reject(error); };
    const abort = () => fail(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => fail(new Error('Video decoding stalled. Retry the preview or use a smaller H.264 MP4.')), milliseconds);
    signal.addEventListener('abort', abort, { once: true });
    pending.then(value => {
      if (settled) { late?.(value); return; }
      settled = true; clean(); resolve(value);
    }, fail);
    if (signal.aborted) abort();
  });
}

type Job = { priority: number; run: () => Promise<void> };
/** One random-access decode at a time. Review goes before optional thumbnails. */
export class MediaQueue {
  private jobs: Job[] = [];
  private busy = false;
  run<T>(signal: AbortSignal, work: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      const abort = () => { this.jobs = this.jobs.filter(value => value !== job); reject(new DOMException('Aborted', 'AbortError')); };
      const job: Job = { priority, run: async () => {
        signal.removeEventListener('abort', abort);
        try { signal.throwIfAborted(); resolve(await work()); } catch (error) { reject(error); }
      } };
      if (signal.aborted) { abort(); return; }
      signal.addEventListener('abort', abort, { once: true });
      this.jobs.push(job); this.jobs.sort((a, b) => a.priority - b.priority); this.pump();
    });
  }
  private pump() {
    if (this.busy) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.busy = true;
    void job.run().finally(() => { this.busy = false; this.pump(); });
  }
}
