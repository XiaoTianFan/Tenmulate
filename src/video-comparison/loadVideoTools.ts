/** Keep networking outside the route transition and bound waits for optional tools.
 * Closing a UI stops its caller; an import may finish in the browser's module cache.
 */
export function loadVideoTools<T>(load: () => Promise<T>, signal: AbortSignal, timeoutMs = 20_000): Promise<T> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { clean(); reject(new Error('Video tools are taking too long to load. Check your connection and try again.')); }, timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    // Starting in a microtask also catches synchronous loader failures.
    Promise.resolve().then(() => { signal.throwIfAborted(); return load(); }).then(value => {
      clean(); resolve(value);
    }, () => { clean(); reject(new Error('Could not load video tools. Check your connection and try again.')); });
  });
}
