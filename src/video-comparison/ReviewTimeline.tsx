import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { t } from '../i18n/locale';
import { clamp } from './timeline';
import { fitWindow, zoomWindow, type TimelineWindow } from './timelineView';

type Props = {
  min: number; max: number; value: number; step: number; selection: TimelineWindow;
  label: string; startLabel: string; endLabel: string; valueText: (value: number) => string;
  disabled?: boolean; contact?: number; children?: ReactNode;
  onChange: (value: number) => void; onRange: (range: TimelineWindow) => void;
  onView?: (view: TimelineWindow) => void; onStep?: (value: number, direction: -1 | 1) => number;
};

/** A shared pointer/keyboard timeline. Zoom changes only the view, never the edit. */
export function ReviewTimeline(props: Props) {
  const { min, max, value, step, selection, label, startLabel, endLabel, valueText, disabled, contact, children, onChange, onRange } = props;
  const [window, setWindow] = useState<TimelineWindow>({ start: min, end: max });
  const view = fitWindow(window.end > window.start ? window : { start: min, end: max }, min, max);
  const lane = useRef<HTMLDivElement>(null), latest = useRef({ props, view });
  latest.current = { props, view };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ mode: 'cursor' | 'start' | 'end' | 'pinch'; view: TimelineWindow; distance: number; center: number; moved: boolean } | null>(null);
  const span = view.end - view.start || step;
  const percent = (n: number) => (n - view.start) / span * 100;
  const snap = (n: number) => clamp(min + Math.round((n - min) / step) * step, min, max);
  const at = (x: number) => { const box = lane.current!.getBoundingClientRect(); return snap(view.start + clamp((x - box.left) / box.width, 0, 1) * span); };
  useEffect(() => { props.onView?.(view); }, [view.start, view.end, props.onView]);
  useEffect(() => {
    const element = lane.current;
    const wheel = (event: WheelEvent) => {
      const { props: p, view: v } = latest.current;
      if (p.disabled || p.max <= p.min) return;
      event.preventDefault();
      const box = element!.getBoundingClientRect();
      const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (horizontal) {
        const delta = (event.deltaX || event.deltaY) * (event.deltaMode === 1 ? 16 : 1) / box.width * (v.end - v.start);
        setWindow(fitWindow({ start: v.start + delta, end: v.end + delta }, p.min, p.max));
      } else setWindow(zoomWindow(v, Math.exp(-event.deltaY * (event.deltaMode === 1 ? 16 : 1) * 0.006), clamp((event.clientX - box.left) / box.width, 0, 1), p.min, p.max, p.step * 4));
    };
    element?.addEventListener('wheel', wheel, { passive: false });
    return () => element?.removeEventListener('wheel', wheel);
  }, []);
  const update = (mode: 'cursor' | 'start' | 'end', n: number) => {
    if (mode === 'cursor') onChange(clamp(n, selection.start, selection.end));
    else onRange(mode === 'start' ? { start: Math.min(n, selection.end), end: selection.end } : { start: selection.start, end: Math.max(n, selection.start) });
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    (event.target as HTMLElement).closest<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: 'pinch', view, distance: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)), center: (a!.x + b!.x) / 2, moved: true };
    } else if (pointers.current.size === 1) {
      const mode = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle as 'start' | 'end' | undefined;
      gesture.current = { mode: mode ?? 'cursor', view, distance: 0, center: event.clientX, moved: false };
      // A touch tap is deferred so beginning a pinch never moves the playhead.
      if (event.pointerType !== 'touch') update(mode ?? 'cursor', at(event.clientX));
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (g.mode === 'pinch') {
      if (pointers.current.size !== 2) return;
      const [a, b] = [...pointers.current.values()], box = lane.current!.getBoundingClientRect();
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y), center = (a!.x + b!.x) / 2;
      const zoomed = zoomWindow(g.view, distance / g.distance, clamp((g.center - box.left) / box.width, 0, 1), min, max, step * 4);
      const delta = (g.center - center) / box.width * (zoomed.end - zoomed.start);
      setWindow(fitWindow({ start: zoomed.start + delta, end: zoomed.end + delta }, min, max));
    } else { g.moved = true; update(g.mode, at(event.clientX)); }
  };
  const up = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    const g = gesture.current;
    if (!cancel && g && g.mode !== 'pinch' && !g.moved && event.pointerType === 'touch') update(g.mode, at(event.clientX));
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size || cancel) { pointers.current.clear(); gesture.current = null; }
  };
  const keys = (event: KeyboardEvent, mode: 'cursor' | 'start' | 'end', current: number) => {
    if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const requested = event.key === 'Home' ? min : event.key === 'End' ? max : props.onStep ? props.onStep(current, direction) : snap(current + direction * step * (event.shiftKey ? 10 : 1));
    const n = clamp(requested, mode === 'start' ? min : selection.start, mode === 'end' ? max : selection.end);
    update(mode, n);
    if (n < view.start || n > view.end) setWindow(fitWindow({ start: n - span / 2, end: n + span / 2 }, min, max));
  };
  return <div className="review-timeline">
    <div className="review-zoom"><span>{valueText(view.start)} — {valueText(view.end)}</span><div>
      <button type="button" disabled={disabled || max <= min} title={t('Zoom out timeline')} aria-label={t('Zoom out timeline')} onClick={() => setWindow(zoomWindow(view, 0.5, 0.5, min, max, step * 4))}><Minus size={13}/></button>
      <output>{((max - min) / span || 1).toFixed(1)}×</output>
      <button type="button" disabled={disabled || max <= min} title={t('Zoom in timeline')} aria-label={t('Zoom in timeline')} onClick={() => setWindow(zoomWindow(view, 2, clamp((value - view.start) / span, 0, 1), min, max, step * 4))}><Plus size={13}/></button>
      <button type="button" disabled={disabled} title={t('Fit full timeline')} aria-label={t('Fit full timeline')} onClick={() => setWindow({ start: min, end: max })}><Maximize2 size={13}/></button>
    </div></div>
    <div ref={lane} className="review-lane" onPointerDown={down} onPointerMove={move} onPointerUp={event => up(event)} onPointerCancel={event => up(event, true)}>
      <div className="review-lane-content" aria-hidden="true">{children}</div>
      <div className="review-selection" style={{ left: `${clamp(percent(selection.start), 0, 100)}%`, right: `${100 - clamp(percent(selection.end), 0, 100)}%` }} aria-hidden="true"/>
      {contact !== undefined && contact >= view.start && contact <= view.end ? <span className="comparison-contact-marker" style={{ left: `${percent(contact)}%` }} aria-hidden="true"/> : null}
      <div className="review-cursor-target" role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={label}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText(value)} onKeyDown={event => keys(event, 'cursor', value)}/>
      {value >= view.start && value <= view.end ? <span className="comparison-playhead" style={{ left: `${percent(value)}%` }} aria-hidden="true"/> : null}
      {(['start', 'end'] as const).map(mode => <div key={mode} className={`review-range-handle is-${mode}`} data-handle={mode} role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
        aria-label={mode === 'start' ? startLabel : endLabel} aria-valuemin={mode === 'start' ? min : selection.start} aria-valuemax={mode === 'end' ? max : selection.end}
        aria-valuenow={selection[mode]} aria-valuetext={valueText(selection[mode])}
        style={{ left: `${clamp(percent(selection[mode]), 0, 100)}%`, visibility: selection[mode] < view.start || selection[mode] > view.end ? 'hidden' : undefined }}
        onKeyDown={event => keys(event, mode, selection[mode])}><span/></div>)}
    </div>
    {span < max - min - step / 2 ? <input className="review-pan" type="range" aria-label={t('Pan timeline')} min={min} max={max - span} step="any" value={view.start} disabled={disabled}
      onChange={event => { const start = Number(event.target.value); setWindow({ start, end: start + span }); }}/> : null}
  </div>;
}
