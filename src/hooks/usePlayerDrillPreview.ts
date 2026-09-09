import { useEffect, useState } from 'react';
import type { DrillDefinitionV2 } from '../content/types';
import type { CompiledSession } from '../engine/session/compileSession';
import type { SurfaceId } from '../domain/court';
import { defaultDrillSettings } from '../app/defaults';
import { validatePlayerDrill } from '../content/playerValidation';
import { compilePlayerDrillAsync } from '../engine/session/playerDrillClient';

export function usePlayerDrillPreview(drill: DrillDefinitionV2, surface: SurfaceId) {
  const [result, setResult] = useState<{ session: CompiledSession | null; source: DrillDefinitionV2 | null; error: string }>({ session: null, source: null, error: '' });
  useEffect(() => {
    if (!validatePlayerDrill(drill).valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void compilePlayerDrillAsync(drill, { ...defaultDrillSettings(drill), surface, repetitions: drill.events.length, restSeconds: 0 }, controller.signal)
        .then(session => setResult({ session, source: drill, error: '' }))
        .catch(error => { if (!controller.signal.aborted) setResult(previous => ({ ...previous, source: drill, error: String(error.message ?? error) })); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [drill, surface]);
  return { ...result, pending: result.source !== drill && validatePlayerDrill(drill).valid };
}
