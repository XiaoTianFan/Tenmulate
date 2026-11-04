import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n/locale';
import type { CropRect } from '../crop';
import { COURT_LINES, type Point, type SpeedSelection as Selection } from './types';

export const isCourtSelection = (kind: Selection['kind']) => kind in COURT_LINES || kind === 'netCenter';
export const selectionName = (kind: Selection['kind']) =>
  kind in COURT_LINES
    ? COURT_LINES[kind as keyof typeof COURT_LINES]
    : kind === 'netCenter'
      ? 'Net centre at strap'
      : kind === 'contact'
        ? 'Contact ball position'
        : kind === 'bounce'
          ? 'First bounce ball position'
          : 'Flight check ball position';
export const toSource = (p: Point, crop: CropRect, mirrored: boolean): Point => ({
  x: crop.x + (mirrored ? 1 - p.x : p.x) * crop.width,
  y: crop.y + p.y * crop.height
});

export function SpeedSelection({
  selection,
  crop,
  mirrored,
  width,
  height,
  frame,
  ready,
  toolbar,
  onSelect,
  onCancel,
  onFrame
}: {
  selection: Selection;
  crop: CropRect;
  mirrored: boolean;
  width: number;
  height: number;
  frame: number;
  ready: boolean;
  toolbar: HTMLElement | null;
  onSelect: (points: Point[], radius: number, frame: number, pixelFloor: number) => void;
  onCancel: () => void;
  onFrame: (frame: number) => void;
}) {
  const surface = useRef<HTMLDivElement>(null),
    down = useRef<Point | null>(null);
  const [first, setFirst] = useState<Point | null>(null),
    [aim, setAim] = useState<Point>({ x: 0.5, y: 0.5 }),
    [box, setBox] = useState<{ a: Point; b: Point } | null>(null);
  const line = selection.kind in COURT_LINES,
    locked = isCourtSelection(selection.kind) || selection.kind === 'contact';
  useEffect(() => {
    surface.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    down.current = null;
    setFirst(null);
    setBox(null);
  }, [frame]);
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height))
    };
  };
  const commit = (a: Point, b?: Point) => {
    if (!ready) return;
    // A small preview cannot justify sub-screen-pixel annotation precision.
    const rect = surface.current!.getBoundingClientRect();
    const pixelFloor =
      Math.ceil(Math.max((width * crop.width) / rect.width, (height * crop.height) / rect.height) * 4) / 4;
    if (line) {
      if (!b || Math.hypot(a.x - b.x, a.y - b.y) < 0.01) {
        setFirst(a);
        return;
      }
      // The original image's left/right order stays invariant under preview mirroring.
      const ends = [toSource(a, crop, mirrored), toSource(b, crop, mirrored)].sort((p, q) => p.x - q.x);
      onSelect(ends, 0, frame, pixelFloor);
    } else {
      const center = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
      const radius =
        b && selection.kind !== 'netCenter'
          ? Math.hypot((a.x - b.x) * crop.width * width, (a.y - b.y) * crop.height * height) / 2
          : 0;
      onSelect([toSource(center, crop, mirrored)], radius < 1 ? 0 : radius, frame, pixelFloor);
    }
  };
  return (
    <>
      <div className="motion-selection speed-selection" role="group" aria-label={t('Serve measurement selection')}>
        <strong className="motion-selection-step">{t(selectionName(selection.kind))}</strong>
        <div
          ref={surface}
          className="motion-selection-surface"
          role="button"
          tabIndex={0}
          aria-label={t('Mark serve measurement. Arrow keys aim; Enter selects.')}
          aria-disabled={!ready}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel();
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(first ?? aim, first ? aim : undefined);
            }
            if (event.key.startsWith('Arrow')) {
              event.preventDefault();
              const step = event.shiftKey ? 10 : 1,
                dx = step / (width * crop.width),
                dy = step / (height * crop.height);
              setAim((a) => ({
                x: Math.max(
                  0,
                  Math.min(1, a.x + (event.key === 'ArrowRight' ? dx : event.key === 'ArrowLeft' ? -dx : 0))
                ),
                y: Math.max(0, Math.min(1, a.y + (event.key === 'ArrowDown' ? dy : event.key === 'ArrowUp' ? -dy : 0)))
              }));
            }
          }}
          onPointerDown={(event) => {
            if (!ready || event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            down.current = point(event);
            setAim(down.current);
          }}
          onPointerMove={(event) => {
            const end = point(event);
            setAim(end);
            if (down.current) setBox({ a: down.current, b: end });
          }}
          onPointerCancel={() => {
            down.current = null;
            setBox(null);
          }}
          onPointerUp={(event) => {
            if (!down.current) return;
            const a = down.current,
              b = point(event);
            down.current = null;
            setBox(null);
            const rect = event.currentTarget.getBoundingClientRect();
            const dragged = Math.hypot((a.x - b.x) * rect.width, (a.y - b.y) * rect.height) > 5;
            if (first && line) commit(first, b);
            else commit(a, dragged ? b : undefined);
          }}
        >
          <i className="motion-selection-aim" style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%` }}>
            +
          </i>
          {line && (first || box) ? (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1={(first ?? box!.a).x * 100} y1={(first ?? box!.a).y * 100} x2={aim.x * 100} y2={aim.y * 100} />
            </svg>
          ) : null}
          {!line && box ? (
            <span
              style={{
                left: `${Math.min(box.a.x, box.b.x) * 100}%`,
                top: `${Math.min(box.a.y, box.b.y) * 100}%`,
                width: `${Math.abs(box.a.x - box.b.x) * 100}%`,
                height: `${Math.abs(box.a.y - box.b.y) * 100}%`
              }}
            />
          ) : null}
        </div>
      </div>
      {toolbar
        ? createPortal(
            <div className="motion-selection-tools" role="group" aria-label={t('Serve measurement tools')}>
              <strong>{t(selectionName(selection.kind))}</strong>
              <p>
                {t(
                  line
                    ? 'Drag along the line between its two endpoints, or tap each endpoint. Arrow keys and Enter also work.'
                    : selection.kind === 'netCenter'
                      ? 'Tap the top of the net at the centre strap.'
                      : 'Use the preview lane to choose the frame. Tap the ball centre or drag a tight region around the ball.'
                )}
              </p>
              {!ready ? (
                <p role="status">
                  {locked && frame !== selection.frame
                    ? t('Return to the measurement frame before marking.')
                    : t('Preparing frame…')}
                </p>
              ) : null}
              <div className="motion-selection-navigation">
                <output>{t('Frame {frame}', { frame: frame + 1 })}</output>
                {locked && frame !== selection.frame ? (
                  <button type="button" onClick={() => onFrame(selection.frame)}>
                    {t('Return to measurement frame')}
                  </button>
                ) : null}
                <button type="button" onClick={onCancel}>
                  {t('Cancel')}
                </button>
              </div>
            </div>,
            toolbar
          )
        : null}
    </>
  );
}
