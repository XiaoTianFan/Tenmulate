import type { DrillDefinitionV1 } from '../../content/types';
import type { CompiledSession, SessionSettings } from './compileSession';
import { createSessionCompiler } from './sessionCompiler';

const previewCompiler = createSessionCompiler(() => new Worker(new URL('./practiceSession.worker.ts', import.meta.url), { type: 'module' }));
const sessionCompiler = createSessionCompiler(() => new Worker(new URL('./practiceSession.worker.ts', import.meta.url), { type: 'module' }));
export function compilePracticeAsync(drill: DrillDefinitionV1, settings: SessionSettings, preview: boolean, signal?: AbortSignal): Promise<CompiledSession> {
  // Set/rest counts do not affect the continuous configuration preview.
  const input = { drill, settings: preview ? { ...settings, repetitions: 3, workBlockSize: 3, restSeconds: 0 } : settings, preview };
  return (preview ? previewCompiler : sessionCompiler)(input, signal);
}
