import type { DrillDefinitionV2 } from '../../content/types';
import type { CompiledSession, SessionSettings } from './compileSession';
import type { PlayerShotSelection } from './compilePlayerDrill';
import { createSessionCompiler } from './sessionCompiler';

const compile = createSessionCompiler(() => new Worker(new URL('./playerDrill.worker.ts', import.meta.url), { type: 'module' }));
export function compilePlayerDrillAsync(drill: DrillDefinitionV2, settings: SessionSettings, signal?: AbortSignal, selection?: PlayerShotSelection): Promise<CompiledSession> {
  return compile({ drill, settings, selection }, signal);
}
