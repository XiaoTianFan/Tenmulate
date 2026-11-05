import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n/locale';
import type { Anchor } from './types';
import type { CropRect } from '../crop';
import { SelectionMagnifier } from '../SelectionMagnifier';
export type Selection = { type: 'track'; id?: string; role: 'start' | 'end' | 'correction' };
export function MotionSelection({
  selection,
  crop,
  mirrored,
  frame,
  ready,
  min,
  max,
  toolbar,
  canvas,
  onSelect,
  onCancel
}: {
  selection: Selection;
  crop: CropRect;
  mirrored: boolean;
  frame: number;
  ready: boolean;
  min: number;
  max: number;
  toolbar: HTMLElement | null;
  canvas: RefObject<HTMLCanvasElement | null>;
  onSelect: (anchor: Anchor) => void;
  onCancel: () => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    surface.current?.focus({ preventScroll: true });
  }, []);
  const [holding, setHolding] = useState(false);
  const [aim, setAim] = useState({ x: 0.5, y: 0.5 });
  const start = useRef<{ x: number; y: number } | null>(null),
    [box, setBox] = useState<CropRect | null>(null);
  const cancelGesture = () => {
    start.current = null;
    setBox(null);
    setHolding(false);
  };
  useEffect(() => {
    cancelGesture();
  }, [frame, ready, crop.x, crop.y, crop.width, crop.height, mirrored]);
  const point = (event: PointerEvent<HTMLElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height))
    };
  };
  const finish = (x: number, y: number, width: number, height: number) => {
    const center = mirrored ? 1 - x : x;
    onSelect({
      frame,
      x: crop.x + center * crop.width,
      y: crop.y + y * crop.height,
      width: width * crop.width,
      height: height * crop.height
    });
  };
  return (
    <>
      <div className="motion-selection" role="group" aria-label={t('Select tracked point')}>
        <strong className="motion-selection-step">
          {t(
            selection.role === 'start'
              ? '1. Select start position'
              : selection.role === 'end'
                ? '2. Select end position'
                : 'Select correction position'
          )}
        </strong>
        <div
          ref={surface}
          className="motion-selection-surface"
          role="button"
          tabIndex={0}
          aria-label={t('Tap or drag a region. Arrow keys aim; Enter selects.')}
          aria-disabled={!ready}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancel();
            if (event.key === 'Enter' && ready) {
              event.preventDefault();
              finish(aim.x, aim.y, 0.05, 0.05);
            }
            if (event.key.startsWith('Arrow')) {
              event.preventDefault();
              const step = event.shiftKey ? 0.05 : 0.005;
              setAim((a) => ({
                x: Math.max(
                  0,
                  Math.min(
                    1,
                    a.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)
                  )
                ),
                y: Math.max(
                  0,
                  Math.min(1, a.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))
                )
              }));
            }
          }}
          onPointerDown={(event) => {
            if (!ready || event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            start.current = point(event);
            setAim(start.current);
            setHolding(true);
          }}
          onPointerMove={(event) => {
            if (!start.current || !event.isPrimary) return;
            const end = point(event),
              a = start.current;
            setAim(end);
            setBox({
              x: Math.min(a.x, end.x),
              y: Math.min(a.y, end.y),
              width: Math.abs(a.x - end.x),
              height: Math.abs(a.y - end.y)
            });
          }}
          onPointerCancel={cancelGesture}
          onLostPointerCapture={cancelGesture}
          onPointerUp={(event) => {
            if (!start.current || !ready || !event.isPrimary) return;
            const end = point(event),
              a = start.current;
            cancelGesture();
            const w = Math.abs(end.x - a.x),
              h = Math.abs(end.y - a.y);
            finish((a.x + end.x) / 2, (a.y + end.y) / 2, Math.max(0.015, w), Math.max(0.015, h));
          }}
        >
          <i
            className="motion-selection-aim"
            style={{
              left: `${aim.x * 100}%`,
              top: `${aim.y * 100}%`,
              display: holding ? 'block' : undefined
            }}
          >
            +
          </i>
          {box ? (
            <span
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`
              }}
            />
          ) : null}
          {holding && ready ? (
            <SelectionMagnifier
              point={aim}
              source={canvas}
              surface={surface}
              mirrored={mirrored}
              crop={crop}
            />
          ) : null}
        </div>
      </div>
      {toolbar
        ? createPortal(
            <div className="motion-selection-tools" role="group" aria-label={t('Tracking frame selection')}>
              <strong>
                {t(
                  selection.role === 'start'
                    ? '1. Select start position'
                    : selection.role === 'end'
                      ? '2. Select end position'
                      : 'Select correction position'
                )}
              </strong>
              <p>
                {frame < min || frame > max
                  ? t('Use the preview lane to choose a frame between {start} and {end}.', {
                      start: min + 1,
                      end: max + 1
                    })
                  : !ready
                    ? t('Preparing frame…')
                    : t(
                        'Use the preview lane to choose a frame. Hold to magnify while placing a point or dragging a region.'
                      )}
              </p>
              <div className="motion-selection-navigation">
                <output>{t('Frame {frame}', { frame: frame + 1 })}</output>
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
