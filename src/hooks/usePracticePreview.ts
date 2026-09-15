import { useEffect, useRef, useState } from 'react';
import type { DrillDefinitionV1 } from '../content/types';
import { compileSession, type CompiledSession, type SessionSettings } from '../engine/session/compileSession';
import { compilePracticeAsync } from '../engine/session/practiceSessionClient';

export function usePracticePreview(drill: DrillDefinitionV1, settings: SessionSettings) {
  // A newly selected mode must never inherit the previous mode's live session.
  // Keep a single-feed placeholder while the continuous sequence resolves off-thread.
  const [placeholder, setPlaceholder] = useState(() => ({ drill,
    session: compileSession(drill, { ...settings, rally: undefined, repetitions: 1, restSeconds: 0 }),
  }));
  if (placeholder.drill !== drill) {
    setPlaceholder({ drill, session: compileSession(drill, { ...settings, rally: undefined, repetitions: 1, restSeconds: 0 }) });
  }
  const requestedDrill = useRef<DrillDefinitionV1 | null>(null);
  const [result, setResult] = useState<{ session: CompiledSession; source: SessionSettings | null; error: string }>(() => ({
    session: placeholder.session, source: null, error: '',
  }));
  useEffect(() => {
    const controller = new AbortController();
    const modeChanged = requestedDrill.current !== drill;
    requestedDrill.current = drill;
    const timer = setTimeout(() => {
      void compilePracticeAsync(drill, settings, true, controller.signal)
        .then(session => { if (!controller.signal.aborted) setResult({ session, source: settings, error: '' }); })
        .catch(error => { if (!controller.signal.aborted) setResult(previous => ({ ...previous, source: settings, error: String(error.message ?? error) })); });
    }, modeChanged ? 0 : 50);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [drill, settings]);
  const pending = result.source !== settings;
  const [prepared, setPrepared] = useState<SessionSettings | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void compilePracticeAsync(drill, settings, false, controller.signal)
        .then(() => { if (!controller.signal.aborted) setPrepared(settings); })
        .catch(() => { /* Start reports planning failures; superseded warmups are silent. */ });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [drill, settings]);
  return { ...result, session: pending || result.error ? placeholder.session : result.session,
    error: pending ? '' : result.error, pending, prepared: prepared === settings };
}
