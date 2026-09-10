import { useEffect, useRef, useState } from 'react';
import { isPlayerSavedShot, validatePlayerEvent } from '../content/playerValidation';
import type { OpponentHand, PlayerShotEventV2, SavedShotV2 } from '../content/types';
import { Modal } from './Modal';

type Props = {
  mode: 'new' | 'update';
  event: PlayerShotEventV2;
  playerHand: OpponentHand;
  savedShots: readonly SavedShotV2[];
  onSave: (shot: SavedShotV2) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function SavedShotModal({ mode: initialMode, event, playerHand, savedShots, onSave, onDelete, onClose }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [slotId, setSlotId] = useState('');
  const [name, setName] = useState(initialMode === 'new' ? event.label : '');
  const body = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const slot = savedShots.find(shot => shot.id === slotId);
  const empty = mode === 'update' && !savedShots.length;
  const errors: string[] = [];
  validatePlayerEvent(event, 'Selected shot', errors);
  const candidate: SavedShotV2 = {
    schemaVersion: 2, playerHand, id: mode === 'update' ? slotId : 'new-shot',
    name: name.trim(), event: { ...event, label: name.trim() },
  };
  const canSave = (mode === 'new' || !!slot) && isPlayerSavedShot(candidate);

  useEffect(() => {
    const dialog = body.current?.closest<HTMLElement>('[role="dialog"]');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener('keydown', onKey);
    return () => { dialog?.removeEventListener('keydown', onKey); opener?.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    const dialog = body.current?.closest<HTMLElement>('[role="dialog"]');
    (dialog?.querySelector<HTMLElement>('select, input:not(:disabled)') ?? dialog?.querySelector<HTMLElement>('button'))?.focus();
  }, [mode]);

  return <Modal title={mode === 'update' ? 'Update existing saved shot' : 'Save new shot'} onClose={onClose} actions={<>
    <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
    {empty ? <button type="button" className="primary-button inline" onClick={() => { setMode('new'); setName(event.label); }}>Save new shot</button>
      : <button type="button" className="primary-button inline" disabled={!canSave} onClick={() => {
        if (canSave) onSave({ ...candidate, id: mode === 'update' ? slotId : `shot-${crypto.randomUUID()}` });
      }}>{mode === 'update' ? 'Overwrite saved shot' : 'Save new shot'}</button>}
  </>}>
    <div ref={body}>
      {empty ? <p>No saved shots yet. Save a new shot to create your first slot.</p> : <>
        {mode === 'update' ? <label className="stack-field"><span>Saved shot to overwrite</span>
          <select aria-label="Saved shot to overwrite" value={slotId} onChange={e => {
            setSlotId(e.target.value);
            setName(savedShots.find(shot => shot.id === e.target.value)?.name ?? '');
          }}>
            <option value="" disabled>Choose a saved shot…</option>
            {savedShots.map(shot => <option key={shot.id} value={shot.id}>{shot.name}</option>)}
          </select>
        </label> : null}
        <label className="stack-field"><span>Preset name</span><input maxLength={60} disabled={mode === 'update' && !slot} value={name} onChange={e => setName(e.target.value)}/></label>
        <p>{slot ? <>Replace “{slot.name}” with the current shot's settings.</> : 'Save the current shot and its settings.'} Includes both balls, landing zones, contact camera, camera transition, timing and opponent settings.</p>
        {slot ? <button type="button" className="secondary-button" onClick={() => onDelete(slot.id)}>Delete saved shot</button> : null}
      </>}
      {errors.length ? <ul className="validation-errors" role="alert">{errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
    </div>
  </Modal>;
}
