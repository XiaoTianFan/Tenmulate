import { useRef, useState, type PointerEvent } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { t } from '../i18n/locale';
import { moveGridClip, type GridDrop, type GridRow } from './exportLayout';
import type { ComparisonClip } from './types';

type Props = { rows: GridRow[]; clips: ComparisonClip[]; previews: Record<string, string>; aspect: number; images: boolean; onChange: (rows: GridRow[]) => void };
export function ExportGridEditor({ rows, clips, previews, aspect, images, onChange }: Props) {
  const [selected, setSelected] = useState<string | null>(null), [hover, setHover] = useState('');
  const [ghost, setGhost] = useState<{ x: number; y: number; id: string } | null>(null);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const dropAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-export-drop]')?.dataset.exportDrop;
  const apply = (id: string, key: string) => {
    const drop = JSON.parse(key) as GridDrop;
    if ('newRow' in drop) drop.newRow = crypto.randomUUID();
    onChange(moveGridClip(rows, id, drop)); setSelected(null);
  };
  const finish = (event: PointerEvent) => {
    const key = dropAt(event.clientX, event.clientY);
    if (drag.current && key) apply(drag.current.id, key);
    drag.current = null; setGhost(null); setHover('');
  };
  const zone = (drop: GridDrop, row: boolean, style?: React.CSSProperties) => {
    const key = JSON.stringify(drop);
    return <button key={key} type="button" className={`export-drop ${row ? 'is-row' : 'is-column'}${hover === key ? ' is-over' : ''}`}
      style={style} data-export-drop={key} disabled={!selected} aria-label={t(row ? 'Move selected clip into a new row' : 'Move selected clip here')}
      onClick={() => { if (selected) apply(selected, key); }}><Plus size={14}/></button>;
  };
  return <div className={`export-grid-editor${selected ? ' is-arranging' : ''}`}>
    <div className={`export-grid-preview${images ? ' is-image-columns' : ''}`} style={{ aspectRatio: images ? undefined : aspect,
      width: images ? undefined : `min(100%, ${480 * (aspect > 0 && Number.isFinite(aspect) ? aspect : 16 / 9)}px)` }}
      onPointerMove={event => {
        if (!drag.current || Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 4) return;
        setGhost({ x: event.clientX, y: event.clientY, id: drag.current.id }); setHover(dropAt(event.clientX, event.clientY) ?? '');
      }} onPointerUp={finish} onPointerCancel={() => { drag.current = null; setGhost(null); setHover(''); }}>
      {rows.map((row, r) => <div className="export-grid-row" key={row.id} style={{ flex: 1 }}>
        {!images ? zone({ before: row.id, newRow: `row-${r}-${selected}` }, true, { top: -7 }) : null}
        {row.clips.map((id, c) => {
          const clip = clips.find(item => item.id === id)!;
          return <div className={`export-grid-cell${selected === id ? ' is-selected' : ''}`} key={id}>
            {zone({ row: row.id, index: c }, false, { left: -7 })}
            {previews[id] || clip.thumbnails[0] ? <img src={previews[id] || clip.thumbnails[0]} alt="" draggable={false} style={{ transform: clip.mirrored ? 'scaleX(-1)' : undefined }}/> : null}
            <button type="button" className="export-grid-grip" aria-label={t('Arrange {name}', { name: clip.name })} aria-pressed={selected === id}
              onClick={() => setSelected(id)} onPointerDown={event => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id, x: event.clientX, y: event.clientY }; setSelected(id);
              }}><GripVertical size={16}/><span>{clip.name}</span></button>
            {c === row.clips.length - 1 ? zone({ row: row.id, index: c + 1 }, false, { right: -7 }) : null}
          </div>;
        })}
        {!images && r === rows.length - 1 ? zone({ before: null, newRow: `last-${selected}` }, true, { bottom: -7 }) : null}
      </div>)}
      {!rows.length ? <p>{t('Select clips to preview the export.')}</p> : null}
    </div>
    <p className="export-hint">{t(images ? 'Drag to reorder columns, or select a clip and choose an insertion point.' : 'Drag the grip between clips or rows. You can also select a clip and choose an insertion point.')}</p>
    {ghost ? <div className="export-drag-ghost" style={{ left: ghost.x + 12, top: ghost.y + 12 }} aria-hidden="true">{clips.find(clip => clip.id === ghost.id)?.name}</div> : null}
  </div>;
}
