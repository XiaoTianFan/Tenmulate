import { compilePlayerDrill } from './compilePlayerDrill';
import type { DrillDefinitionV2 } from '../../content/types';
import type { SessionSettings } from './compileSession';

self.onmessage = (message: MessageEvent<{ drill: DrillDefinitionV2; settings: SessionSettings }>) => {
  try { self.postMessage({ session: compilePlayerDrill(message.data.drill, message.data.settings) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Drill calculation failed.' }); }
};
