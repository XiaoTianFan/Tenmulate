import { useEffect, useState } from 'react';
import type { DrillDefinitionV2 } from '../content/types';
import type { CompiledSession } from '../engine/session/compileSession';
import type { SurfaceId } from '../domain/court';
import { defaultDrillSettings } from '../app/defaults';
import { validatePlayerDrill, validatePlayerEvent } from '../content/playerValidation';
import { compilePlayerDrillAsync } from '../engine/session/playerDrillClient';
import type { PlayerShotSelection } from '../engine/session/compilePlayerDrill';

export function usePlayerDrillPreview(drill: DrillDefinitionV2, surface: SurfaceId, selection?: PlayerShotSelection, drafting = false) {
  const [result, setResult] = useState<{ session: CompiledSession | null; source: DrillDefinitionV2 | null; surface?: SurfaceId; selection?: PlayerShotSelection; error: string }>({ session: null, source: null, error: '' });
  const errors: string[] = [];
  if (selection) validatePlayerEvent(drill.events.find(event => event.id === selection.eventId), 'Selected shot', errors);
  else errors.push(...validatePlayerDrill(drill).errors);
  const valid = errors.length === 0;
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void compilePlayerDrillAsync(drill, { ...defaultDrillSettings(drill), surface, repetitions: drill.events.length, restSeconds: 0 }, controller.signal, selection)
        .then(session => { if (!controller.signal.aborted) setResult({ session, source: drill, surface, selection, error: '' }); })
        .catch(error => { if (!controller.signal.aborted) setResult(previous => ({ ...previous, source: drill, surface, selection, error: String(error.message ?? error) })); });
    }, selection ? drafting ? 75 : 0 : 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [drill, surface, selection, drafting, valid]);
  useEffect(() => {
    if (!valid || selection || drafting) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void compilePlayerDrillAsync(drill, { ...defaultDrillSettings(drill), surface }, controller.signal).catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [drill, surface, selection, drafting, valid]);
  const current = result.source === drill && result.surface === surface && result.selection === selection;
  return { session: result.session, pending: !current && valid, error: errors[0] ?? (current ? result.error : ''), current: current && valid && !result.error };
}
