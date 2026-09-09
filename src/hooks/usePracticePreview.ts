import { useEffect, useState } from 'react';
import type { DrillDefinitionV1 } from '../content/types';
import { compileSession, type CompiledSession, type SessionSettings } from '../engine/session/compileSession';
import { compilePracticeAsync } from '../engine/session/practiceSessionClient';

export function usePracticePreview(drill: DrillDefinitionV1, settings: SessionSettings) {
  const [result, setResult] = useState<{ session: CompiledSession; source: SessionSettings | null; error: string }>(() => ({
    session: compileSession(drill, { ...settings, rally: undefined, repetitions: 1, restSeconds: 0 }), source: null, error: '',
  }));
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void compilePracticeAsync(drill, settings, true, controller.signal)
        .then(session => setResult({ session, source: settings, error: '' }))
        .catch(error => { if (!controller.signal.aborted) setResult(previous => ({ ...previous, source: settings, error: String(error.message ?? error) })); });
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [drill, settings]);
  return { ...result, pending: result.source !== settings };
}
