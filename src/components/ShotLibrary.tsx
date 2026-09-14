import { t, message as translateMessage } from '../i18n/locale';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { PLAYER_SHOT_BY_ID } from '../content/playerShots';
import type { SavedShotV2 } from '../content/types';
import { SHOT_TYPE_LABELS } from '../domain/shotKinds';

export const SHOT_DRAG_TYPE = 'application/x-tenmulate-shot';
export function ShotLibrary({ savedShots, projectShotIds, notice, writable, onAdd, onCreate, onDelete, onMenuChange }: {
  savedShots: readonly SavedShotV2[]; projectShotIds: readonly string[]; notice: string; onAdd: (id: string) => void;
  writable: boolean; onCreate: () => void; onDelete: (id: string) => Promise<void>; onMenuChange: (open: boolean) => void;
}) {
  const [type, setType] = useState('all'), [source, setSource] = useState('all');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; opener: HTMLElement } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null), createRef = useRef<HTMLButtonElement>(null);
  const selected = savedShots.find(shot => shot.id === menu?.id);
  const dismiss = () => { menu?.opener.focus({ preventScroll: true }); setMenu(null); setError(''); };
  useEffect(() => { onMenuChange(!!menu); return () => onMenuChange(false); }, [!!menu, onMenuChange]);
  useLayoutEffect(() => {
    if (!menu) return;
    const element = menuRef.current!;
    element.style.left = `${Math.max(8, Math.min(menu.x, innerWidth - element.offsetWidth - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(menu.y, innerHeight - element.offsetHeight - 8))}px`;
    element.querySelector('button')?.focus({ preventScroll: true });
  }, [menu, error]);
  useEffect(() => {
    if (!menu || busy) return;
    const outside = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) dismiss(); };
    const origin = menu.opener.getBoundingClientRect();
    const scroll = () => { const now = menu.opener.getBoundingClientRect(); if (now.top !== origin.top || now.left !== origin.left) dismiss(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } dismiss(); } };
    const resize = () => dismiss();
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scroll, true); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key, true); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize); };
  }, [menu, busy]);
  const open = (id: string, x: number, y: number, opener: HTMLElement) => { if (!busy) { setError(''); setMenu({ id, x, y, opener }); } };
  const remove = async () => {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { await onDelete(selected.id); setMenu(null); createRef.current?.focus({ preventScroll: true }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to delete shot.'); }
    finally { setBusy(false); }
  };
  const items = savedShots.map(item => ({ id: item.id, name: item.name,
    family: item.event.ball.family, pace: item.event.ball.paceKmh, default: PLAYER_SHOT_BY_ID.has(item.id), project: projectShotIds.includes(item.id) }))
    .filter(item => (type === 'all' || item.family === type) && (source === 'all' || (source === 'default' ? item.default : !item.default)));
  return <aside className="event-library">
    <header><h1>{t("Your shots")}</h1><span>{items.length}</span></header>
    <div className="shot-library-filters">
      <select aria-label={t("Filter shots by type")} value={type} onChange={event => setType(event.target.value)}>
        <option value="all">{t("All shot types")}</option>
        {[...new Set(savedShots.map(shot => shot.event.ball.family))].map(family => <option key={family} value={family}>{t(SHOT_TYPE_LABELS[family])}</option>)}
      </select>
      <select aria-label={t("Shot library source")} value={source} onChange={event => setSource(event.target.value)}>
        <option value="all">{t("All library shots")}</option><option value="default">{t("Default shots")}</option><option value="saved">{t("Custom shots")}</option>
      </select>
    </div>
    <p className="saved-shot-count" role="status">{translateMessage(notice || t("Click or drag to add. Right-click for options."))}</p>
    <div className="event-list">
      {items.map(item => <div className="shot-library-row" key={item.id} onContextMenu={event => { event.preventDefault(); open(item.id, event.clientX, event.clientY, event.currentTarget.querySelector('button')!); }}>
        <button type="button" className="shot-library-card" draggable
        aria-label={t("Add {0}", {"0": item.name})} title={t("Add {0} to the timeline", {"0": item.name})}
        onDragStart={event => { event.dataTransfer.setData(SHOT_DRAG_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy'; }}
        onKeyDown={event => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); open(item.id, rect.right - 30, rect.top, event.currentTarget); } }}
        onClick={() => onAdd(item.id)}>
        <GripVertical size={15}/><span><strong>{item.name}</strong><small>{!item.project ? t("Browser · ") : ''}{t(item.family)} · {Math.round(item.pace)} {t("km/h")}</small></span><Plus size={16}/>
      </button><button type="button" className="shot-library-options" aria-label={t("Options for {0}", {"0": item.name})} aria-haspopup="menu" aria-expanded={menu?.id === item.id}
        onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); open(item.id, rect.right, rect.bottom, event.currentTarget); }}><MoreHorizontal size={17}/></button></div>)}
      {!items.length ? <p className="saved-shot-count">{t("No shots match this filter.")}</p> : null}
    </div>
    <footer className="shot-library-footer"><button ref={createRef} type="button" className="secondary-button full-width" disabled={!writable} onClick={() => { setType('all'); setSource('all'); onCreate(); }}><Plus size={17}/> {t("Add New Shot")}</button></footer>
    {menu && selected ? createPortal(<div ref={menuRef} className="shot-library-menu" role="menu" aria-label={t("Options for {0}", {"0": selected.name})}>
      <button type="button" role="menuitem" disabled={busy || !writable && projectShotIds.includes(selected.id)} onClick={() => void remove()}><Trash2 size={16}/>{busy ? t("Deleting…") : t("Delete shot from library")}</button>
      {error ? <p role="alert">{translateMessage(error)}</p> : null}
    </div>, document.body) : null}
  </aside>;
}
