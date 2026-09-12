import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { needsSaveDestination, SaveCancelled, type SaveDestination } from '../storage/savePolicy';

type Request = { label: string; projectAvailable: boolean; perform: (destination: SaveDestination) => Promise<void>; cancel: () => void };
export function useSaveSystem() {
  const [request, setRequest] = useState<Request | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const active = useRef(false), writing = useRef(false);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 6000); return () => window.clearTimeout(timer); }, [notice]);
  const run = async <T,>(label: string, projectAvailable: boolean, operations: { browser: () => T | Promise<T>; project: () => T | Promise<T> }): Promise<T> => {
    if (!needsSaveDestination(import.meta.env.DEV)) {
      const value = await operations.browser(); setNotice(`${label} saved in this browser.`); return value;
    }
    if (active.current) throw new Error('Finish the current save first.');
    active.current = true; setError('');
    return new Promise<T>((resolve, reject) => {
      setRequest({ label, projectAvailable, cancel: () => { active.current = false; setRequest(null); reject(new SaveCancelled()); },
        perform: async destination => {
          if (writing.current) return;
          writing.current = true; setBusy(true); setError('');
          try {
            const value = await operations[destination]();
            setNotice(`${label} saved ${destination === 'project' ? 'as a project default' : 'in this browser'}.`);
            active.current = false; setRequest(null); resolve(value);
          } catch (failure) { setError(failure instanceof Error ? failure.message : 'Save failed. Try again.'); }
          finally { writing.current = false; setBusy(false); }
        } });
    });
  };
  return { run, ui: <>
    {notice ? <div className="save-notice" role="status">{notice}<button type="button" aria-label="Dismiss save notice" onClick={() => setNotice('')}>×</button></div> : null}
    {request ? <Modal title={`Save ${request.label.toLowerCase()}`} labelledBy="save-destination-title" onClose={busy ? undefined : request.cancel}
      actions={<button type="button" className="secondary-button" disabled={busy} onClick={request.cancel}>Cancel</button>}>
      <p>Where should this be saved?</p>
      <div className="save-destinations">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void request.perform('browser')}><strong>This browser</strong><span>Personal copy on this browser and device. Kept after closing the tab.</span></button>
        <button type="button" className="secondary-button" disabled={busy || !request.projectAvailable} onClick={() => void request.perform('project')}><strong>Project default</strong><span>Update the local project. Included in future builds for everyone.</span></button>
      </div>
      {!request.projectAvailable ? <p>Project storage is unavailable. This browser is still available.</p> : null}
      {busy ? <p role="status">Saving…</p> : null}
      {error ? <p role="alert" className="validation-errors">{error}</p> : null}
    </Modal> : null}
  </> };
}
