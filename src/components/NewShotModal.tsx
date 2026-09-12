import { SaveCancelled } from '../storage/savePolicy';
import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { createPlayerShot } from '../content/playerShots';
import { shotNameKey } from '../storage/projectShots';
import { SHOT_TYPE_LABELS } from '../domain/shotKinds';
import type { OpponentHand, RallyShotFamily, SavedShotV2 } from '../content/types';

export function NewShotModal({ hand, savedShots, writable, status, onSave, onClose }: {
  hand: OpponentHand; savedShots: readonly SavedShotV2[]; writable: boolean; status: string;
  onSave: (shot: SavedShotV2) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(''), [family, setFamily] = useState<RallyShotFamily>('groundstroke');
  const [stroke, setStroke] = useState<'forehand' | 'backhand'>('forehand');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null), pending = useRef(false);
  const close = useRef(onClose); close.current = onClose;
  const duplicate = savedShots.some(shot => shotNameKey(shot.name) === shotNameKey(name));
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = body.current?.closest<HTMLElement>('[role="dialog"]');
    dialog?.querySelector('input')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!pending.current) close.current(); }
      if (e.key === 'Tab') {
        const items = [...dialog!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
        if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
      }
    };
    dialog?.addEventListener('keydown', key);
    return () => { dialog?.removeEventListener('keydown', key); opener?.focus({ preventScroll: true }); };
  }, []);
  const save = async () => {
    if (pending.current || !writable || !name.trim() || duplicate) return;
    pending.current = true; setBusy(true); setError('');
    try { await onSave(createPlayerShot(name, hand, family, stroke)); }
    catch (failure) { if (failure instanceof SaveCancelled) return; setError(failure instanceof Error ? failure.message : 'Unable to create shot.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Modal title="Add New Shot" onClose={busy ? undefined : onClose} actions={<>
    <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="button" className="primary-button inline" disabled={busy || !writable || !name.trim() || duplicate} onClick={() => void save()}>{busy ? 'Creating…' : 'Save shot'}</button>
  </>}><div ref={body}>
    <label className="stack-field"><span>Preset name</span><input maxLength={60} disabled={busy} value={name} onChange={e => setName(e.target.value)}/></label>
    <label className="stack-field"><span>Shot type</span><select aria-label="Shot type" disabled={busy} value={family} onChange={e => setFamily(e.target.value as RallyShotFamily)}>
      {Object.entries(SHOT_TYPE_LABELS).filter(([id]) => id !== 'serve').map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    <label className="stack-field"><span>Stroke side</span><select aria-label="Stroke side" disabled={busy} value={stroke} onChange={e => setStroke(e.target.value as typeof stroke)}><option value="forehand">Forehand</option><option value="backhand">Backhand</option></select></label>
    <p>Starts with fresh {hand}-handed settings. Add the preset to a timeline to adjust its balls, landing zones and shot view.</p>
    {duplicate ? <p className="validation-errors" role="alert">A shot already uses this name. Choose a new name.</p> : null}
    {!writable ? <p role="status">{status}</p> : null}
    {error ? <p className="validation-errors" role="alert">{error}</p> : null}
  </div></Modal>;
}
