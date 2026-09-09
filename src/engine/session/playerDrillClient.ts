import type { DrillDefinitionV2 } from '../../content/types';
import type { CompiledSession, SessionSettings } from './compileSession';
import type { PlayerShotSelection } from './compilePlayerDrill';

/** Abort terminates an obsolete solve, including its physics work. No work runs on the UI thread. */
export function compilePlayerDrillAsync(drill: DrillDefinitionV2, settings: SessionSettings, signal?: AbortSignal, selection?: PlayerShotSelection): Promise<CompiledSession> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const worker = new Worker(new URL('./playerDrill.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (message: MessageEvent<{ session?: CompiledSession; error?: string }>) => {
      finish(); if (message.data.session) resolve(message.data.session); else reject(new Error(message.data.error ?? 'Drill calculation failed.'));
    };
    worker.onerror = event => { finish(); reject(new Error(event.message || 'Drill worker failed to load.')); };
    worker.postMessage({ drill, settings, selection });
  });
}
