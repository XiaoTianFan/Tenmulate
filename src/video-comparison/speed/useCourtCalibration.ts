import { useLayoutEffect, useMemo, useState } from 'react';
import { type CalibrationInput, type Camera, type MeasurementIssue } from './types';
import { courtRequirement } from './courtCoverage';
type Status = { key: string; camera?: Camera; error?: MeasurementIssue; busy?: boolean };
/** Calibrate after enough independent lines are marked. Frame playback and ball edits do not
 * rerun the fit. Cleanup owns the worker, including superseded/background jobs. */
export function useCourtCalibration(input: CalibrationInput, active: boolean): Status {
  const { setup, width, height } = input;
  const key = useMemo(
    () =>
      JSON.stringify({
        lines: setup.lines,
        netSupports: setup.netSupports,
        pixelError: setup.pixelError,
        width,
        height
      }),
    [setup.lines, setup.netSupports, setup.pixelError, width, height]
  );
  const complete = !courtRequirement(setup);
  const [state, setState] = useState<Status>({ key: '' });
  useLayoutEffect(() => {
    if (!active || !complete) return;
    let worker: Worker | undefined,
      live = true;
    setState({ key, busy: true });
    const fail = (error: MeasurementIssue) => {
      if (live) setState({ key, error });
      worker?.terminate();
    };
    try {
      worker = new Worker(new URL('./speed.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }: MessageEvent<{ camera?: Camera; error?: MeasurementIssue }>) => {
        if (!live) return;
        setState({ key, ...data });
        worker?.terminate();
      };
      worker.onerror = () => fail({ message: 'Speed estimation could not start. Reload the app and try again.' });
      worker.postMessage({ kind: 'calibrate', input });
    } catch {
      fail({ message: 'Speed estimation could not start. Reload the app and try again.' });
    }
    return () => {
      live = false;
      worker?.terminate();
    };
  }, [key, active, complete]);
  return state.key === key && complete ? { ...state, busy: active && state.busy } : { key, busy: active && complete };
}
