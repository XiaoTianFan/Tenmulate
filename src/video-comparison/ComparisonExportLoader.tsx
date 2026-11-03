import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { t } from '../i18n/locale';
import type { ComparisonExportProps } from './ComparisonExportModal';
import { loadVideoTools } from './loadVideoTools';

type ExportModule = typeof import('./ComparisonExportModal');
let loaded: ExportModule | undefined;

/** The comparison page is ready before export encoders are downloaded/evaluated. */
export function ComparisonExportLoader(props: ComparisonExportProps) {
  const [module, setModule] = useState(loaded), [attempt, setAttempt] = useState(0), [error, setError] = useState('');
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    if (module) return;
    const controller = new AbortController();
    setError('');
    void loadVideoTools(() => import('./ComparisonExportModal'), controller.signal).then(value => {
      if (!controller.signal.aborted) { loaded = value; setModule(value); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load video tools. Check your connection and try again.'); });
    return () => controller.abort();
  }, [attempt, module]);
  if (module) return <module.ComparisonExportModal {...props} restoreFocusTo={opener.current}/>;
  return <Modal title={t('Export comparison')} onClose={props.onClose} actions={<>
    <button type="button" className="secondary-button" onClick={props.onClose}>{t('Cancel')}</button>
    {error ? <button type="button" className="primary-button inline" onClick={() => setAttempt(value => value + 1)}>{t('Try again')}</button> : null}
  </>}><p role={error ? 'alert' : 'status'}>{t(error || 'Loading export tools…')}</p></Modal>;
}
