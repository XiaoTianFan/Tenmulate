import type { DrillDefinitionV1 } from '../../content/types';
import type { CompiledSession, SessionSettings } from './compileSession';

export function compilePracticeAsync(drill: DrillDefinitionV1, settings: SessionSettings, preview: boolean, signal?: AbortSignal): Promise<CompiledSession> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./practiceSession.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ session?: CompiledSession; error?: string }>) => {
      finish(); if (data.session) resolve(data.session); else reject(new Error(data.error ?? 'Practice calculation failed.'));
    };
    worker.onerror = event => { finish(); reject(new Error(event.message || 'Practice worker failed to load.')); };
    worker.postMessage({ drill, settings, preview });
  });
}
