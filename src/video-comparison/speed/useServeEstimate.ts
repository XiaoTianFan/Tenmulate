import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MeasurementIssue, SpeedInput, SpeedResult } from './types';

type State = {
  key: string;
  index?: SpeedInput['index'];
  result?: SpeedResult;
  error?: MeasurementIssue;
  busy?: boolean;
  progress?: number;
};
/** No video decoding or numerical work runs on the UI thread. Every job owns its worker. */
export function useServeEstimate(input: SpeedInput | undefined, active: boolean) {
  const worker = useRef<Worker | null>(null);
  const key = useMemo(
    () =>
      input
        ? JSON.stringify({
            ...input,
            index: undefined,
            setup: { ...input.setup, showCourtOverlay: undefined, showBallOverlay: undefined }
          })
        : '',
    [input?.setup, input?.contact, input?.start, input?.end, input?.width, input?.height]
  );
  const [state, setState] = useState<State>({ key: '' });
  const cancel = () => {
    worker.current?.terminate();
    worker.current = null;
    setState((s) => ({ ...s, busy: false }));
  };
  useLayoutEffect(() => {
    worker.current?.terminate();
    worker.current = null;
    setState((s) => ({ ...s, busy: false }));
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, [key, input?.index, active]);
  const run = () => {
    cancel();
    if (!input || !active) return;
    const index = input.index;
    setState({ key, index, busy: true, progress: 0 });
    try {
      const current = new Worker(new URL('./speed.worker.ts', import.meta.url), { type: 'module' });
      worker.current = current;
      const fail = (error: MeasurementIssue) => {
        if (worker.current !== current) return;
        current.terminate();
        worker.current = null;
        setState({ key, index, error });
      };
      current.onerror = () => fail({ message: 'Speed estimation could not start. Reload the app and try again.' });
      current.onmessage = (
        event: MessageEvent<{ progress?: number; result?: SpeedResult; error?: MeasurementIssue }>
      ) => {
        if (worker.current !== current) return;
        const { progress, result, error } = event.data;
        if (error) fail(error);
        else if (result) {
          current.terminate();
          worker.current = null;
          setState({ key, index, result });
        } else if (progress !== undefined) setState({ key, index, busy: true, progress });
      };
      current.postMessage({ kind: 'estimate', input });
    } catch {
      cancel();
      setState({ key, index, error: { message: 'Speed estimation could not start. Reload the app and try again.' } });
    }
  };
  return { ...(state.key === key && state.index === input?.index ? state : {}), run, cancel };
}
export type SpeedControls = ReturnType<typeof useServeEstimate>;
