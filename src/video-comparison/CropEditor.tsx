import { useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/locale';
import { cropForAspect, FULL_CROP, normalizeCrop, resizeCrop, type CropRect } from './crop';

type Props = { crop?: CropRect; sourceAspect: number; viewportAspect: number; toolbarTarget: HTMLElement | null; onChange: (crop?: CropRect) => void; onDone: () => void; onCancel: () => void };
export function CropEditor({ crop, sourceAspect, viewportAspect, toolbarTarget, onChange, onDone, onCancel }: Props) {
  const [aspect, setAspect] = useState('free');
  const [drawing, setDrawing] = useState(!crop);
  const bounds = normalizeCrop(crop), element = useRef<HTMLDivElement>(null);
  const drag = useRef<{ crop: CropRect; x: number; y: number; width: number; height: number; handle: string } | null>(null);
  const ratio = aspect === 'free' ? undefined : (aspect === 'viewport' ? viewportAspect : Number(aspect)) / sourceAspect;
  const move = (event: PointerEvent) => {
    if (!drag.current) return;
    const d = drag.current, dx = (event.clientX - d.x) / d.width, dy = (event.clientY - d.y) / d.height;
    if (d.handle === 'move') onChange(normalizeCrop({ ...d.crop, x: d.crop.x + dx, y: d.crop.y + dy }));
    else if (d.handle === 'draw') {
      const box = element.current!.getBoundingClientRect(), x = (d.x - box.left) / box.width, y = (d.y - box.top) / box.height;
      const next = normalizeCrop({ x: Math.min(x, x + dx), y: Math.min(y, y + dy), width: Math.abs(dx), height: Math.abs(dy) });
      onChange(ratio ? cropForAspect(next, sourceAspect, ratio * sourceAspect) : next);
    } else onChange(resizeCrop(d.crop, d.handle, dx, dy, ratio));
  };
  return <>
    <div ref={element} className={`crop-overlay${drawing ? ' is-drawing' : ''}`} onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      const box = event.currentTarget.getBoundingClientRect();
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-crop-handle]');
      let handle = target?.dataset.cropHandle ?? 'draw';
      if (handle === 'move' && drawing) handle = 'draw';
      if (handle !== 'draw') target?.focus({ preventScroll: true });
      drag.current = { crop: bounds, x: event.clientX, y: event.clientY, width: box.width, height: box.height, handle };
    }} onPointerMove={move} onPointerUp={() => { if (drag.current) setDrawing(false); drag.current = null; }} onPointerCancel={() => { if (drag.current) onChange(drag.current.crop); drag.current = null; }}>
      <div className="crop-selection" data-crop-handle="move" role="group" tabIndex={0} aria-label={t('Move crop with arrow keys')}
        style={{ left: `${bounds.x * 100}%`, top: `${bounds.y * 100}%`, width: `${bounds.width * 100}%`, height: `${bounds.height * 100}%` }}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); const delta = event.shiftKey ? 0.05 : 0.01;
          onChange(normalizeCrop({ ...bounds, x: bounds.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0), y: bounds.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0) }));
        }}>
        <span className="crop-thirds"/>
        {(['nw', 'ne', 'sw', 'se'] as const).map(corner => <button key={corner} type="button" className={`crop-handle is-${corner}`} data-crop-handle={corner}
          aria-label={t({ nw: 'Resize crop top left', ne: 'Resize crop top right', sw: 'Resize crop bottom left', se: 'Resize crop bottom right' }[corner])}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation(); const delta = event.shiftKey ? 0.05 : 0.01;
            onChange(resizeCrop(bounds, corner, event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0, event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0, ratio));
          }}/>) }
      </div>
    </div>
    {toolbarTarget ? createPortal(<div className="crop-toolbar" onPointerDown={event => event.stopPropagation()}>
      <label>{t('Crop ratio')}<select aria-label={t('Crop ratio')} value={aspect} onChange={event => {
        const value = event.target.value; setAspect(value); setDrawing(false);
        if (value !== 'free') onChange(cropForAspect(FULL_CROP, sourceAspect, value === 'viewport' ? viewportAspect : Number(value)));
      }}><option value="free">{t('Freehand')}</option><option value="viewport">{t('Fit preview zone')}</option>
        {[[1,'1:1'],[16/9,'16:9'],[9/16,'9:16'],[4/3,'4:3'],[3/4,'3:4']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      <button type="button" aria-pressed={drawing} onClick={() => setDrawing(value => !value)}>{t('Draw crop')}</button>
      <button type="button" onClick={() => { setAspect('free'); setDrawing(true); onChange(undefined); }}>{t('Reset crop')}</button>
      <button type="button" onClick={onCancel}>{t('Cancel')}</button><button type="button" className="crop-done" onClick={onDone}>{t('Done')}</button>
    </div>, toolbarTarget) : null}
  </>;
}
