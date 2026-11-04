import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair, RotateCcw, SkipBack, SkipForward, X } from 'lucide-react';
import { t } from '../../i18n/locale';
import { ClipTimeline } from '../ClipTimeline';
import { FULL_CROP } from '../crop';
import { clamp, formatTime } from '../timeline';
import type { ComparisonClip } from '../types';
import { SpeedSelection, isCourtSelection, selectionName } from './SpeedSelection';
import { isNetLine, supportsHalf, type CourtLine, type ServeSetup, type SpeedSelection as Selection } from './types';
import { markingBounds, type ServeMark } from './marking';
import { useMarkingPreview } from './useMarkingPreview';
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
  const [span, setSpan] = useState<'full' | 'half'>(() => setup.lines[selection.kind as CourtLine]?.span ?? 'full');
  const [draft, setDraft] = useState<ServeMark | null>(null),
    [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement as HTMLElement | null),
    titleId = useId(),
    hintId = useId();
  const [size, setSize] = useState({ width: 1, height: 1 });
  const picture = useMarkingPreview(clip.file, clip.index!, frame, canvas);
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
  const imagePoint = (p: { x: number; y: number }) => ({ x: (mirrored ? 1 - p.x : p.x) * 100, y: p.y * 100 });
  const marked = draft?.frame === frame ? draft.points.map(imagePoint) : [];
  const instruction = line
    ? isNetLine(selection.kind)
      ? 'Draw from the net top to the ground beneath it, or tap both ends.'
      : span === 'half'
        ? 'Draw from the centre mark or centre service-line intersection to either singles sideline. The far lines identify the half automatically.'
        : 'Drag between the singles line endpoints, or tap each endpoint.'
    : 'Tap the ball centre or drag a tight region around it.';
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
        ].filter((element) => element.getClientRects().length && element.getAttribute('aria-disabled') !== 'true');
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
            onStart={() => setDraft(null)}
            onSelect={(points, radius, selectedFrame, pixelFloor) =>
              setDraft({ points, radius, frame: selectedFrame, pixelFloor })
            }
          />
        </div>
        {!picture.ready ? (
          <div className="serve-marking-status" role={picture.error ? 'alert' : 'status'}>
            <span>{t(picture.error || 'Preparing frame…')}</span>
            {picture.error ? (
              <button type="button" onClick={picture.retry}>
                {t('Try again')}
              </button>
            ) : null}
          </div>
        ) : null}
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
            {t('Frame {frame} / {total}', { frame: frame + 1, total: clip.index!.timestamps.length })}
            <span>{formatTime(clip.index!.timestamps[frame])}</span>
          </output>
        </div>
        <div className={mirrored ? 'is-mirrored' : undefined}>
          <ClipTimeline clip={reviewClip} frame={frame} onFrame={seek} />
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
              if (canSave) onSave({ ...draft!, ...(supportsHalf(selection.kind) ? { span } : {}) });
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
