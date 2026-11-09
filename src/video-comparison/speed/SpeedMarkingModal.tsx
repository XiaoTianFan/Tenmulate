import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react';
import { t } from '../../i18n/locale';
import { ClipTimeline } from '../ClipTimeline';
import { FULL_CROP } from '../crop';
import { clamp, formatTime } from '../timeline';
import type { ComparisonClip } from '../types';
import { SpeedSelection, isCourtSelection, selectionName } from './SpeedSelection';
import {
  isNetLine,
  supportsHalf,
  type CourtLine,
  type ServeSetup,
  type SpeedSelection as Selection
} from './types';
import { markingBounds, type ServeMark } from './marking';
import { useMarkingPreview } from './useMarkingPreview';
import { correctLens, MAX_LENS } from './lens';
import './marking.css';

export function SpeedMarkingModal({
  clip,
  setup,
  selection,
  onSave,
  onClose
}: {
  clip: ComparisonClip;
  setup: ServeSetup;
  selection: Selection;
  onSave: (mark: ServeMark) => void;
  onClose: () => void;
}) {
  const bounds = markingBounds(clip, setup, selection.kind)!;
  const [frame, setFrame] = useState(() => clamp(selection.frame, bounds.start, bounds.end));
  const [span, setSpan] = useState<'full' | 'half'>(
    () => setup.lines[selection.kind as CourtLine]?.span ?? 'full'
  );
  const [lens, setLens] = useState(setup.lens ?? 0);
  const [waiting, setWaiting] = useState(false);
  const [draft, setDraft] = useState<ServeMark | null>(null),
    [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null),
    titleId = useId(),
    hintId = useId();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const picture = useMarkingPreview(clip.file, clip.index!, frame, canvas, lens);
  useEffect(() => {
    setWaiting(false);
    if (picture.ready) return;
    const timer = window.setTimeout(() => setWaiting(true), 250);
    return () => window.clearTimeout(timer);
  }, [picture.ready, frame]);
  const sourceAspect = picture.width && picture.height ? picture.width / picture.height : 16 / 9;
  const width = Math.min(size.width, size.height * sourceAspect),
    height = width / sourceAspect;
  const line = isCourtSelection(selection.kind),
    mirrored = !!clip.mirrored;
  const reviewClip = { ...clip, crop: undefined, trim: bounds };
  const canSave = picture.ready && draft?.frame === frame;
  useLayoutEffect(() => {
    const element = dialog.current!,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setSize({ width: box.width, height: box.height });
    });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const seek = (value: number) => {
    const next = clamp(Math.round(value), bounds.start, bounds.end);
    if (next !== frame) {
      setDraft(null);
      setFrame(next);
    }
  };
  const reset = () => {
    setDraft(null);
    setRevision((value) => value + 1);
  };
  const imagePoint = (p: { x: number; y: number }) => {
    const corrected = correctLens(p, lens, picture.width, picture.height);
    return {
      x: (mirrored ? 1 - corrected.x : corrected.x) * 100,
      y: corrected.y * 100
    };
  };
  const marked = draft?.frame === frame ? draft.points.map(imagePoint) : [];
  const instruction = line
    ? isNetLine(selection.kind)
      ? 'Set the net top first, then the ground directly beneath it. Hold and move to refine either point.'
      : span === 'half'
        ? 'Set the centre mark first, then either singles sideline. The far lines identify the half automatically.'
        : 'Set one singles endpoint, then the other. Hold and move to refine each point; a third press starts a new line.'
    : 'Hold to magnify and move the crosshair onto the ball centre. Release to set that exact point.';
  return createPortal(
    <dialog
      ref={dialog}
      className="serve-marking"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'
          )
        ].filter(
          (element) => element.getClientRects().length && element.getAttribute('aria-disabled') !== 'true'
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <h2 id={titleId}>{t(selectionName(selection.kind))}</h2>
          <p title={clip.name}>{clip.name}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('Close dialog')}>
          <X size={22} />
        </button>
      </header>
      <div className="serve-marking-view">
        <div className="serve-marking-stage" ref={stage}>
          <div className={`serve-marking-picture${mirrored ? ' is-mirrored' : ''}`} style={{ width, height }}>
            <canvas
              ref={canvas}
              aria-label={t('Measurement video preview')}
              style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
            />
            {marked.length && picture.ready ? (
              <svg
                className="serve-marking-draft"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label={t('Unsaved measurement')}
              >
                {line ? <line x1={marked[0].x} y1={marked[0].y} x2={marked[1].x} y2={marked[1].y} /> : null}
                {marked.map((p, i) => (
                  <ellipse key={i} cx={p.x} cy={p.y} rx={500 / width} ry={500 / height} />
                ))}
              </svg>
            ) : null}
            <SpeedSelection
              key={revision}
              selection={selection}
              crop={FULL_CROP}
              mirrored={mirrored}
              width={picture.width}
              height={picture.height}
              frame={frame}
              ready={picture.ready}
              canvas={canvas}
              lens={lens}
              onStart={() => setDraft(null)}
              onSelect={(points, radius, selectedFrame, pixelFloor) =>
                setDraft({ points, radius, frame: selectedFrame, pixelFloor })
              }
            />
          </div>
          {!picture.width && !picture.ready && (waiting || picture.error) ? (
            <div
              className="serve-marking-status"
              role={picture.error ? 'alert' : 'status'}
            >
              <span>{t(picture.error || 'Preparing frame…')}</span>
              {picture.error ? (
                <button type="button" onClick={picture.retry}>
                  {t('Try again')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <aside
          className="serve-lens-control"
          title={t(
            'Adjust until court lines look straight. Zero keeps the original view; saved with the measurement.'
          )}
        >
          <label htmlFor={`${titleId}-lens`}>{t('Lens')}</label>
          <span aria-hidden="true">+</span>
          <input
            id={`${titleId}-lens`}
            type="range"
            aria-label={t('Lens distortion correction')}
            min={-MAX_LENS}
            max={MAX_LENS}
            step={0.01}
            value={lens}
            onChange={(event) => {
              setLens(Number(event.target.value));
              reset();
            }}
          />
          <span aria-hidden="true">−</span>
          <output>{lens.toFixed(2)}</output>
          <button
            type="button"
            onClick={() => {
              setLens(0);
              reset();
            }}
            disabled={!lens}
            aria-label={t('Reset lens correction')}
          >
            <RotateCcw size={16} />
          </button>
        </aside>
      </div>
      <div className="serve-marking-review">
        {supportsHalf(selection.kind) ? (
          <label className="serve-marking-span">
            {t('Line span')}
            <select
              aria-label={t('Line span')}
              value={span}
              onChange={(event) => {
                setSpan(event.target.value as 'full' | 'half');
                reset();
              }}
            >
              <option value="full">{t('Full singles width')}</option>
              <option value="half">{t('Half width · detect side')}</option>
            </select>
          </label>
        ) : null}
        <div className="serve-marking-navigation">
          <div>
            <button
              type="button"
              disabled={frame <= bounds.start}
              aria-label={t('Previous preview frame')}
              onClick={() => seek(frame - 1)}
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              disabled={frame >= bounds.end}
              aria-label={t('Next preview frame')}
              onClick={() => seek(frame + 1)}
            >
              <SkipForward size={18} />
            </button>
            <button
              type="button"
              disabled={clip.contact === null || clip.contact < bounds.start || clip.contact > bounds.end}
              onClick={() => seek(clip.contact!)}
            >
              <Crosshair size={16} />
              {t('Contact frame')}
            </button>
          </div>
          <output>
            {t('Frame {frame} / {total}', {
              frame: frame + 1,
              total: clip.index!.timestamps.length
            })}
            <span>{formatTime(clip.index!.timestamps[frame])}</span>
          </output>
        </div>
        <div className={mirrored ? 'is-mirrored' : undefined}>
          <ClipTimeline clip={reviewClip} frame={frame} onFrame={seek} />
        </div>
        <div className="serve-marking-seek-status" role={picture.error ? 'alert' : 'status'}>
          {picture.width > 0 && !picture.ready && (waiting || picture.error) ? t(picture.error || 'Seeking frame…') : ''}
          {picture.error ? <button type="button" onClick={picture.retry}>{t('Try again')}</button> : null}
        </div>
      </div>
      <footer>
        <div id={hintId}>
          <p>{t(instruction)}</p>
          <small>
            {t(
              selection.kind === 'contact'
                ? 'Saving also sets this clip’s contact frame.'
                : 'Use the timeline to choose a clear frame. Save when the mark is ready.'
            )}
          </small>
        </div>
        <div className="serve-marking-actions">
          <button type="button" onClick={reset} aria-label={t('Redraw measurement')}>
            <RotateCcw size={16} />
            {t('Redraw')}
          </button>
          <button type="button" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            type="button"
            className="serve-marking-save"
            disabled={!canSave}
            onClick={() => {
              if (canSave)
                onSave({
                  ...draft!,
                  lens,
                  ...(supportsHalf(selection.kind) ? { span } : {})
                });
            }}
          >
            {t('Save measurement')}
          </button>
        </div>
      </footer>
    </dialog>,
    document.body
  );
}
