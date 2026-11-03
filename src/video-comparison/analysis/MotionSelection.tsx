import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n/locale';
import type { Anchor } from './types';
import type { CropRect } from '../crop';
export type Selection = { type: 'track'; id?: string; role: 'start' | 'end' | 'correction' } | { type: 'region' };
export function MotionSelection({ selection, crop, mirrored, frame, ready, min, max, toolbar, onFrame, onSelect, onCancel }: { selection: Selection; crop: CropRect; mirrored: boolean; frame: number; ready: boolean; min: number; max: number; toolbar: HTMLElement | null; onFrame: (frame: number) => void; onSelect: (anchor: Anchor) => void; onCancel: () => void }) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => { surface.current?.focus({ preventScroll: true }); }, []);
  const [aim, setAim] = useState({ x: .5, y: .5 });
  const start = useRef<{ x: number; y: number } | null>(null), [box, setBox] = useState<CropRect | null>(null);
  const point = (event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)) };
  };
  const finish = (x: number, y: number, width: number, height: number) => {
    const center = mirrored ? 1 - x : x;
    onSelect({ frame, x: crop.x + center * crop.width, y: crop.y + y * crop.height, width: width * crop.width, height: height * crop.height });
  };
  return <><div className="motion-selection" role="group" aria-label={t(selection.type === 'region' ? 'Select player region' : 'Select tracked point')}>
    {selection.type === 'track' ? <strong className="motion-selection-step">{t(selection.role === 'start' ? '1. Select start position' : selection.role === 'end' ? '2. Select end position' : 'Select correction position')}</strong> : null}
    <div ref={surface} className="motion-selection-surface" role="button" tabIndex={0} aria-label={t('Tap or drag a region. Arrow keys aim; Enter selects.')} aria-disabled={!ready}
      onKeyDown={event => { if (event.key === 'Escape') onCancel(); if (event.key === 'Enter' && ready) { event.preventDefault(); finish(aim.x, aim.y, .05, .05); } if (event.key.startsWith('Arrow')) { event.preventDefault(); const step = event.shiftKey ? .05 : .005; setAim(a => ({ x: Math.max(0, Math.min(1, a.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0))), y: Math.max(0, Math.min(1, a.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))) })); } }}
      onPointerDown={event => { if (!ready) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start.current = point(event); }}
      onPointerMove={event => { if (!start.current) return; const end = point(event), a = start.current; setBox({ x: Math.min(a.x, end.x), y: Math.min(a.y, end.y), width: Math.abs(a.x - end.x), height: Math.abs(a.y - end.y) }); }}
      onPointerCancel={() => { start.current = null; setBox(null); }}
      onPointerUp={event => { if (!start.current || !ready) return; const end = point(event), a = start.current; start.current = null; const w = Math.abs(end.x - a.x), h = Math.abs(end.y - a.y); finish((a.x + end.x) / 2, (a.y + end.y) / 2, Math.max(.015, w), Math.max(.015, h)); }}>
      <i className="motion-selection-aim" style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}>+</i>
      {box ? <span style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}/> : null}
    </div>
  </div>
    {toolbar ? createPortal(<div className="motion-selection-tools" role="group" aria-label={t('Tracking frame selection')}>
      <strong>{selection.type === 'region' ? t('Select player region') : t(selection.role === 'start' ? '1. Select start position' : selection.role === 'end' ? '2. Select end position' : 'Select correction position')}</strong>
      <p>{!ready ? t('Preparing frame…') : t(selection.type === 'region' ? 'Drag a region containing one player throughout the excerpt.' : 'Choose a frame, then tap the same target or drag a small region around it.')}</p>
      <div className="motion-selection-navigation">
        <button type="button" aria-label={t('Previous tracking frame')} disabled={frame <= min} onClick={() => onFrame(Math.max(min, frame - 1))}>←</button>
        <input type="range" aria-label={t('Tracking frame')} min={min} max={max} step={1} value={frame} onChange={e => onFrame(Number(e.target.value))}/>
        <button type="button" aria-label={t('Next tracking frame')} disabled={frame >= max} onClick={() => onFrame(Math.min(max, frame + 1))}>→</button>
      </div>
      <div className="motion-selection-navigation"><output>{t('Frame {frame}', { frame: frame + 1 })}</output><button type="button" onClick={onCancel}>{t('Cancel')}</button></div>
    </div>, toolbar) : null}
  </>;
}
