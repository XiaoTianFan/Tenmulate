import { t, message as translateMessage } from '../i18n/locale';
import { SaveCancelled } from '../storage/savePolicy';
import { useEffect, useRef, useState } from 'react';
import { isPlayerSavedShot, validatePlayerEvent } from '../content/playerValidation';
import type { OpponentHand, PlayerShotEventV2, SavedShotV2 } from '../content/types';
import { Modal } from './Modal';
import { shotNameKey } from '../storage/projectShots';

type Props = {
  mode: 'new' | 'update';
  event: PlayerShotEventV2;
  playerHand: OpponentHand;
  savedShots: readonly SavedShotV2[];
  writable: boolean; projectStatus: string; projectShotIds: readonly string[];
  onSave: (shot: SavedShotV2, targetId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
};

export function SavedShotModal({ mode: initialMode, event, playerHand, savedShots, writable, projectStatus, onSave, onDelete, onClose }: Props) {
  const initialSlot = savedShots.find(shot => shot.id === event.presetId) ?? savedShots.find(shot => shotNameKey(shot.name) === shotNameKey(event.label));
  const [mode, setMode] = useState(initialMode);
  const [slotId, setSlotId] = useState(initialSlot?.id ?? '');
  const [name, setName] = useState(initialMode === 'new' ? event.label : initialSlot?.name ?? '');
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState('');
  const dismiss = () => { if (!busy) onClose(); };
  const body = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = dismiss;
  const slot = mode === 'update' ? savedShots.find(shot => shot.id === slotId) : undefined;
  const named = savedShots.find(shot => shotNameKey(shot.name) === shotNameKey(name));
  const empty = mode === 'update' && !savedShots.length;
  const errors: string[] = [];
  validatePlayerEvent(event, 'Selected shot', errors);
  const candidate: SavedShotV2 = {
    schemaVersion: 2, playerHand, id: mode === 'update' ? slotId : 'new-shot',
    name: name.trim(), event: { ...event, label: name.trim() },
  };
  const collision = mode === 'update' && slot && named && named.id !== slot.id;
  const canSave = writable && !busy && !collision && (mode === 'new' || !!slot) && isPlayerSavedShot(candidate);
  const act = async (operation: 'save' | 'delete') => {
    if (busy) return;
    setBusy(true); setFailure('');
    try {
      if (operation === 'delete' && slot) await onDelete(slot.id);
      else if (canSave) await onSave({ ...candidate, id: mode === 'update' ? slotId : `shot-${crypto.randomUUID()}` },
        slot?.id);
    } catch (error) { if (error instanceof SaveCancelled) return; setFailure(error instanceof Error ? error.message : 'Save failed. Your shot settings are retained.'); }
    finally { setBusy(false); }
  };

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

  return <Modal title={t("Save shot")} onClose={dismiss} actions={<>
    <button type="button" className="secondary-button" disabled={busy} onClick={dismiss}>{t("Cancel")}</button>
    {empty ? <button type="button" className="primary-button inline" onClick={() => { setMode('new'); setName(event.label); }}>{t("Save new shot")}</button>
      : <button type="button" className="primary-button inline" disabled={!canSave} onClick={() => void act('save')}>
        {busy ? t("Saving…") : t("Save shot")}</button>}
  </>}>
    <div ref={body}>
      <label className="stack-field"><span>{t("Save as")}</span><select aria-label={t("Save shot as")} disabled={busy} value={mode} onChange={e => { setMode(e.target.value as 'new' | 'update'); setName(e.target.value === 'new' ? event.label : initialSlot?.name ?? ''); setSlotId(initialSlot?.id ?? ''); }}><option value="update">{t("Replace existing shot")}</option><option value="new">{t("New shot")}</option></select></label>
      <p className="project-save-status" role="status">{translateMessage(projectStatus)}</p>
      {empty ? <p>{t("The shot library is empty. Save a new shot to create your first slot.")}</p> : <>
        {mode === 'update' ? <label className="stack-field"><span>{t("Shot to overwrite")}</span>
          <select aria-label={t("Shot to overwrite")} disabled={busy} value={slotId} onChange={e => {
            setSlotId(e.target.value);
            setName(savedShots.find(shot => shot.id === e.target.value)?.name ?? '');
            setFailure('');
          }}>
            <option value="" disabled>{t("Choose a library shot…")}</option>
            {savedShots.map(shot => <option key={shot.id} value={shot.id}>{shot.name}</option>)}
          </select>
        </label> : null}
        <label className="stack-field"><span>{t("Preset name")}</span><input maxLength={60} disabled={busy || mode === 'update' && !slot} value={name} onChange={e => setName(e.target.value)}/></label>
        <p>{slot || named ? <>{t("Replace “")}{(slot ?? named)!.name}{t("” with the current shot's settings.")}</> : t("Save the current shot as a preset.")} {t("Includes both balls, landing zones, contact camera, camera transition, timing and opponent settings.")}</p>
        <p>{t("Future timeline additions use this preset. Shots already placed in drills keep their own settings.")}</p>
        {collision ? <p className="validation-errors" role="alert">{t("Another shot uses this name. Choose a different name or select that shot to overwrite.")}</p> : null}
        {slot ? <button type="button" className="secondary-button" disabled={busy || !writable} onClick={() => void act('delete')}>{t("Delete shot")}</button> : null}
      </>}
      {errors.length ? <ul className="validation-errors" role="alert">{errors.map(error => <li key={error}>{translateMessage(error)}</li>)}</ul> : null}
      {failure ? <p className="validation-errors" role="alert">{translateMessage(failure)}</p> : null}
    </div>
  </Modal>;
}
