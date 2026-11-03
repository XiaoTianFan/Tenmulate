/** One bounded analysis owner, yielding decoding between frames during review. */
export class AnalysisQueue {
  private jobs = new Map<string, AbortController>();
  private tail: Promise<unknown> = Promise.resolve();
  private paused = false;
  private wake = new Set<() => void>();
  setPaused(value: boolean) { this.paused = value; if (!value) for (const wake of this.wake) wake(); }
  async ready(signal: AbortSignal) {
    signal.throwIfAborted();
    while (this.paused) {
      await new Promise<void>((resolve, reject) => {
        const clean = () => { this.wake.delete(done); signal.removeEventListener('abort', abort); };
        const done = () => { clean(); resolve(); };
        const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
        this.wake.add(done); signal.addEventListener('abort', abort, { once: true });
      });
      signal.throwIfAborted();
    }
  }
  enqueue<T>(key: string, task: (signal: AbortSignal, ready: () => Promise<void>) => Promise<T>): Promise<T> {
    this.cancel(key); const controller = new AbortController(); this.jobs.set(key, controller);
    const result = this.tail.catch(() => {}).then(async () => {
      await this.ready(controller.signal);
      return task(controller.signal, () => this.ready(controller.signal));
    }).finally(() => { if (this.jobs.get(key) === controller) this.jobs.delete(key); });
    this.tail = result.catch(() => {}); return result;
  }
  cancel(key: string) { this.jobs.get(key)?.abort(); this.jobs.delete(key); }
  cancelClip(id: string) { for (const key of this.jobs.keys()) if (key.startsWith(`${id}/`)) this.cancel(key); }
  dispose() { for (const key of this.jobs.keys()) this.cancel(key); }
}
