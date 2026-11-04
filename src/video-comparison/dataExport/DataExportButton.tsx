import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t } from '../../i18n/locale';
import type { ComparisonClip } from '../types';
import type { Camera, MeasurementIssue, ServeSetup, SpeedResult } from '../speed/types';
import type { DataExportRequest, DataSection } from './types';
const labels: Record<DataSection, string> = {
  'motion-analysis': 'Export motion analysis JSON',
  'motion-plots': 'Export motion plots JSON',
  'serve-speed': 'Export serve-speed JSON'
};
/** Each export snapshots existing data; it never decodes video or reruns inference.
 * A ready download link remains available for browsers that require another tap. */
export function DataExportButton({
  section,
  clip,
  width,
  height,
  setup,
  result,
  calibration,
  issue,
  active,
  disabled = false,
  onPause
}: {
  active: boolean;
  section: DataSection;
  clip: ComparisonClip;
  width: number;
  height: number;
  setup?: ServeSetup;
  result?: SpeedResult;
  calibration?: Camera;
  issue?: MeasurementIssue;
  disabled?: boolean;
  onPause: () => void;
}) {
  const worker = useRef<Worker | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const name = `${clip.name
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 160)}-${section}.json`;
  const motion = section === 'serve-speed' ? undefined : clip.motion;
  const serve = section === 'serve-speed' ? (setup ?? clip.serve) : undefined;
  useLayoutEffect(() => {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setUrl('');
    setError('');
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, [
    active,
    section,
    motion,
    serve,
    clip.id,
    clip.name,
    clip.index,
    clip.contact,
    clip.speed,
    clip.trim,
    clip.crop,
    clip.mirrored,
    width,
    height,
    result,
    calibration,
    issue
  ]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        worker.current?.terminate();
        worker.current = null;
        setBusy(false);
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );
  const run = () => {
    if (busy) {
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      return;
    }
    if (!clip.index || !active) return;
    onPause();
    setError('');
    setUrl('');
    setBusy(true);
    try {
      const job = new Worker(new URL('./data.worker.ts', import.meta.url), { type: 'module' });
      worker.current = job;
      const fail = (message: string) => {
        if (worker.current !== job) return;
        job.terminate();
        worker.current = null;
        setBusy(false);
        setError(message);
      };
      job.onerror = () => fail('Could not export analysis data. Please try again.');
      job.onmessage = ({ data }: MessageEvent<{ blob?: Blob; error?: string }>) => {
        if (worker.current !== job) return;
        if (data.error || !data.blob) {
          fail(data.error ?? 'Could not export analysis data. Please try again.');
          return;
        }
        job.terminate();
        worker.current = null;
        setBusy(false);
        const next = URL.createObjectURL(data.blob);
        setUrl(next);
        const link = document.createElement('a');
        link.href = next;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
      };
      const request: DataExportRequest = {
        section,
        clip: {
          id: clip.id,
          name: clip.name,
          index: clip.index,
          contact: clip.contact,
          speed: clip.speed,
          trim: clip.trim,
          crop: clip.crop,
          mirrored: clip.mirrored,
          sourceWidth: width,
          sourceHeight: height,
          motion,
          serve
        },
        result,
        calibration,
        issue
      };
      job.postMessage(request); // Clone buffers; transferring would detach the live analysis.
    } catch {
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      setError('Could not export analysis data. Please try again.');
    }
  };
  return (
    <div className="data-export-controls">
      {url ? (
        <a className="data-export-button" href={url} download={name} aria-label={t(labels[section])}>
          <Download size={14} />
          {t('Download JSON')}
        </a>
      ) : (
        <button
          className="data-export-button"
          type="button"
          disabled={(!busy && disabled) || !clip.index || !active}
          onClick={run}
          aria-label={t(busy ? 'Cancel data export' : labels[section])}
          title={t(busy ? 'Preparing data…' : labels[section])}
        >
          {busy ? <X size={14} /> : <Download size={14} />} {t(busy ? 'Cancel' : 'Export JSON')}
        </button>
      )}
      {error ? (
        <span role="alert" className="data-export-error">
          {t(error)}
        </span>
      ) : null}
    </div>
  );
}
