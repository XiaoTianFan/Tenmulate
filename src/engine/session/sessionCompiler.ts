import type { CompiledSession } from './compileSession';

export type PreparationSnapshot = Readonly<{ session?: CompiledSession; error?: Error }>;
export type SessionPreparation = Readonly<{
  ready: Promise<CompiledSession>;
  finished: Promise<CompiledSession>;
  getSnapshot: () => PreparationSnapshot;
  subscribe: (listener: () => void) => () => void;
  cancel: () => void;
}>;
type Subscriber = {
  publish: (snapshot: PreparationSnapshot) => void;
  resolve: (session: CompiledSession) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};
type Job = { worker: Worker; subscribers: Set<Subscriber>; snapshot: PreparationSnapshot };
const cancelled = () => new DOMException('Cancelled', 'AbortError');

/** One exact-input solve serves both warmup and playback. A partial result can
 * start playback, but only the final result enters the bounded completed cache. */
export function createSessionCompiler(createWorker: () => Worker, capacity = 3) {
  const cache = new Map<string, CompiledSession>(), jobs = new Map<string, Job>();
  let idle: Worker | undefined;
  const prepare = (input: object, signal?: AbortSignal): SessionPreparation => {
    let snapshot: PreparationSnapshot = {}, active = true;
    const listeners = new Set<() => void>();
    let resolveReady!: (session: CompiledSession) => void, rejectReady!: (error: Error) => void;
    let resolveFinished!: (session: CompiledSession) => void, rejectFinished!: (error: Error) => void;
    const ready = new Promise<CompiledSession>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const finished = new Promise<CompiledSession>((resolve, reject) => { resolveFinished = resolve; rejectFinished = reject; });
    // Clients can observe either phase; failures also live in the external store.
    void ready.catch(() => {}); void finished.catch(() => {});
    let abort = () => {};
    const subscriber: Subscriber = {
      publish: next => {
        snapshot = next;
        if (next.error) rejectReady(next.error); else if (next.session) resolveReady(next.session);
        listeners.forEach(listener => listener());
      },
      resolve: resolveFinished, reject: rejectFinished,
      cleanup: () => { active = false; signal?.removeEventListener('abort', abort); },
    };
    const handle: SessionPreparation = {
      ready, finished, getSnapshot: () => snapshot,
      subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      cancel: () => abort(),
    };
    const fail = (error: Error) => { subscriber.publish({ ...snapshot, error }); subscriber.reject(error); subscriber.cleanup(); };
    if (signal?.aborted) { fail(cancelled()); return handle; }
    const key = JSON.stringify(input), cached = cache.get(key);
    if (cached) {
      cache.delete(key); cache.set(key, cached);
      subscriber.publish({ session: cached }); subscriber.resolve(cached); subscriber.cleanup(); return handle;
    }
    let job = jobs.get(key);
    const fresh = !job;
    if (!job) {
      try { job = { worker: idle ?? createWorker(), subscribers: new Set(), snapshot: {} }; }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))); return handle; }
      idle = undefined; jobs.set(key, job);
    }
    const current = job;
    abort = () => {
      if (!active) return;
      current.subscribers.delete(subscriber); fail(cancelled());
      if (!current.subscribers.size && jobs.get(key) === current) { jobs.delete(key); current.worker.terminate(); }
    };
    current.subscribers.add(subscriber); signal?.addEventListener('abort', abort, { once: true });
    subscriber.publish(current.snapshot);
    if (!fresh) return handle;
    const finish = (session?: CompiledSession, error?: Error) => {
      if (jobs.get(key) !== current) return;
      jobs.delete(key);
      const planningError = session?.planningIssues?.length ? new Error(session.planningIssues.map(issue => issue.message).join('\n')) : undefined;
      const failure = error ?? planningError;
      if (session && !failure) {
        cache.set(key, session);
        while (cache.size > capacity) cache.delete(cache.keys().next().value!);
      }
      current.worker.onmessage = null; current.worker.onerror = null; current.worker.onmessageerror = null;
      if (!error && !idle) idle = current.worker; else current.worker.terminate();
      current.snapshot = failure ? { ...current.snapshot, error: failure } : { session };
      for (const listener of current.subscribers) {
        listener.cleanup(); listener.publish(current.snapshot);
        // Full-compilation callers retain the existing planningIssues contract.
        if (session) listener.resolve(session); else listener.reject(error!);
      }
      current.subscribers.clear();
    };
    current.worker.onmessage = ({ data }: MessageEvent<{ session?: CompiledSession; partial?: boolean; error?: string }>) => {
      if (jobs.get(key) !== current) return;
      if (data.partial && data.session?.preparation && !data.session.planningIssues?.length) {
        current.snapshot = { session: data.session };
        current.subscribers.forEach(listener => listener.publish(current.snapshot));
      } else finish(data.session, data.session ? undefined : new Error(data.error ?? 'Session calculation failed.'));
    };
    current.worker.onerror = event => finish(undefined, new Error(event.message || 'Session worker failed to load.'));
    current.worker.onmessageerror = () => finish(undefined, new Error('Session worker response could not be read.'));
    try { current.worker.postMessage(input); } catch (error) { finish(undefined, error instanceof Error ? error : new Error(String(error))); }
    return handle;
  };
  return Object.assign((input: object, signal?: AbortSignal) => prepare(input, signal).finished, { prepare });
}
