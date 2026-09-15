import type { CompiledSession } from './compileSession';

type Subscriber = { resolve: (value: CompiledSession) => void; reject: (error: Error) => void; cleanup: () => void };
type Job = { worker: Worker; subscribers: Set<Subscriber> };

/** Exact-input, bounded reuse. Cancelling a warmup must not cancel Start's
 * subscription to the same solve. Completed workers remain warm for the next edit. */
export function createSessionCompiler(createWorker: () => Worker, capacity = 3) {
  const cache = new Map<string, CompiledSession>(), jobs = new Map<string, Job>();
  let idle: Worker | undefined;
  return (input: object, signal?: AbortSignal): Promise<CompiledSession> => {
    if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    const key = JSON.stringify(input), cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); return Promise.resolve(cached); }
    return new Promise((resolve, reject) => {
      let job = jobs.get(key);
      const fresh = !job;
      if (!job) { job = { worker: idle ?? createWorker(), subscribers: new Set() }; idle = undefined; jobs.set(key, job); }
      const current = job;
      const abort = () => {
        current.subscribers.delete(subscriber); subscriber.cleanup();
        reject(new DOMException('Cancelled', 'AbortError'));
        if (!current.subscribers.size && jobs.get(key) === current) { jobs.delete(key); current.worker.terminate(); }
      };
      const subscriber: Subscriber = { resolve, reject, cleanup: () => signal?.removeEventListener('abort', abort) };
      current.subscribers.add(subscriber); signal?.addEventListener('abort', abort, { once: true });
      if (!fresh) return;
      const finish = (session?: CompiledSession, error?: Error) => {
        if (jobs.get(key) !== current) return;
        jobs.delete(key);
        if (session) {
          cache.set(key, session);
          while (cache.size > capacity) cache.delete(cache.keys().next().value!);
        }
        current.worker.onmessage = null; current.worker.onerror = null;
        if (!error && !idle) idle = current.worker; else current.worker.terminate();
        for (const listener of current.subscribers) { listener.cleanup(); if (session) listener.resolve(session); else listener.reject(error!); }
        current.subscribers.clear();
      };
      current.worker.onmessage = ({ data }: MessageEvent<{ session?: CompiledSession; error?: string }>) =>
        finish(data.session, data.session ? undefined : new Error(data.error ?? 'Session calculation failed.'));
      current.worker.onerror = event => finish(undefined, new Error(event.message || 'Session worker failed to load.'));
      try { current.worker.postMessage(input); } catch (error) { finish(undefined, error instanceof Error ? error : new Error(String(error))); }
    });
  };
}
