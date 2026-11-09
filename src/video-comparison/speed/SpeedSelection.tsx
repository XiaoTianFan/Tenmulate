import { useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import { correctLens, distortLens } from './lens';
import { SelectionMagnifier } from '../SelectionMagnifier';
import { t } from '../../i18n/locale';
import type { CropRect } from '../crop';
import { COURT_LINES, isNetLine, type Point, type SpeedSelection as Selection } from './types';

export const isCourtSelection = (kind: Selection['kind']) => kind in COURT_LINES;
export const selectionName = (kind: Selection['kind']) =>
  kind in COURT_LINES
    ? COURT_LINES[kind as keyof typeof COURT_LINES]
    : kind === 'contact'
      ? 'Contact ball position'
      : kind === 'bounce'
        ? 'First bounce ball position'
        : 'Flight correction ball position';
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
  lens = 0,
  canvas,
  onSelect,
  onStart
}: {
  selection: Selection;
  crop: CropRect;
  mirrored: boolean;
  width: number;
  height: number;
  frame: number;
  ready: boolean;
  lens?: number;
  canvas: RefObject<HTMLCanvasElement | null>;
  onSelect: (points: Point[], radius: number, frame: number, pixelFloor: number) => void;
  onStart: () => void;
}) {
  const surface = useRef<HTMLDivElement>(null),
    down = useRef<Point | null>(null);
  const [holding, setHolding] = useState(false);
  const [first, setFirst] = useState<Point | null>(null),
    [aim, setAim] = useState<Point>({ x: 0.5, y: 0.5 });
  const line = selection.kind in COURT_LINES;
  useEffect(() => {
    surface.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    down.current = null;
    setFirst(null);
    setHolding(false);
  }, [frame, lens, ready]);
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height))
    };
  };
  const raw = (p: Point) => distortLens(toSource(p, crop, mirrored), lens, width, height);
  const inside = (p: Point) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const commit = (a: Point, b?: Point) => {
    if (!ready || !inside(raw(a)) || (b && !inside(raw(b)))) return;
    // A small preview cannot justify sub-screen-pixel annotation precision.
    const rect = surface.current!.getBoundingClientRect();
    const center = raw(b ?? a),
      dx = raw({ x: (b ?? a).x + 1 / rect.width, y: (b ?? a).y }),
      dy = raw({ x: (b ?? a).x, y: (b ?? a).y + 1 / rect.height });
    const pixelFloor =
      Math.ceil(
        Math.max(
          width / (canvas.current?.width || width), height / (canvas.current?.height || height),
          Math.hypot((dx.x - center.x) * width, (dx.y - center.y) * height),
          Math.hypot((dy.x - center.x) * width, (dy.y - center.y) * height)
        ) * 4
      ) / 4;
    if (line) {
      if (!b || Math.hypot((a.x - b.x) * crop.width * width, (a.y - b.y) * crop.height * height) < 2) {
        setFirst(a);
        return;
      }
      // The original image's left/right order stays invariant under preview mirroring.
      const ends = [raw(a), raw(b)].sort((p, q) => (isNetLine(selection.kind) ? p.y - q.y : p.x - q.x));
      setFirst(null);
      onSelect(ends, 0, frame, pixelFloor);
    } else {
      // A ball mark is the crosshair position, never the midpoint of a drag.
      // Keep screen/source precision as uncertainty without shifting the point.
      onSelect([raw(a)], 0, frame, pixelFloor);
    }
  };
  return (
    <>
      <div
        className="motion-selection speed-selection"
        role="group"
        aria-label={t('Serve measurement selection')}
      >
        <div
          ref={surface}
          className="motion-selection-surface"
          role="button"
          tabIndex={0}
          aria-label={t('Mark serve measurement. Arrow keys aim; Enter selects.')}
          aria-disabled={!ready}
          onKeyDown={(event) => {
            if (!ready) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              onStart();
              commit(first ?? aim, first ? aim : undefined);
            }
            if (event.key.startsWith('Arrow')) {
              event.preventDefault();
              const step = event.shiftKey ? 10 : 1;
              setAim((a) => {
                const source = raw(a);
                source.x = Math.max(
                  0,
                  Math.min(
                    1,
                    source.x +
                      (((mirrored ? -1 : 1) * step) / width) *
                        (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)
                  )
                );
                source.y = Math.max(
                  0,
                  Math.min(
                    1,
                    source.y +
                      (step / height) * (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)
                  )
                );
                const corrected = correctLens(source, lens, width, height);
                const x = (corrected.x - crop.x) / crop.width;
                return {
                  x: Math.max(0, Math.min(1, mirrored ? 1 - x : x)),
                  y: Math.max(0, Math.min(1, (corrected.y - crop.y) / crop.height))
                };
              });
            }
          }}
          onPointerDown={(event) => {
            if (!ready || event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            onStart();
            event.currentTarget.setPointerCapture(event.pointerId);
            down.current = point(event);
            setHolding(true);
            setAim(down.current);
          }}
          onPointerMove={(event) => {
            if (!event.isPrimary) return;
            const end = point(event);
            setAim(end);
          }}
          onPointerCancel={() => {
            down.current = null;
            setHolding(false);
          }}
          onPointerUp={(event) => {
            if (!down.current || !event.isPrimary) return;
            const b = point(event);
            down.current = null;
            setHolding(false);
            setAim(b);
            if (line) commit(first ?? b, first ? b : undefined);
            else commit(b);
          }}
        >
          <i
            className="motion-selection-aim"
            style={{
              display: holding ? 'block' : undefined,
              left: `${aim.x * 100}%`,
              top: `${aim.y * 100}%`
            }}
          >
            +
          </i>
          {line && first ? (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1={first.x * 100} y1={first.y * 100} x2={aim.x * 100} y2={aim.y * 100} />
            </svg>
          ) : null}
          {line && first ? (
            <i
              className="serve-first-point"
              style={{ left: `${first.x * 100}%`, top: `${first.y * 100}%` }}
            />
          ) : null}
          {holding && ready ? (
            <SelectionMagnifier crop={crop} point={aim} source={canvas} surface={surface} mirrored={mirrored} />
          ) : null}
          {line ? (
            <output className="serve-placement-step" aria-live="polite">
              {t(
                first
                  ? '2 · Hold to adjust the end; release to set.'
                  : '1 · Hold to adjust the start; release to set.'
              )}
            </output>
          ) : null}
        </div>
      </div>
    </>
  );
}
