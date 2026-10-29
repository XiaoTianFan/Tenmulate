import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crosshair, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { t } from '../i18n/locale';
import { clamp, comparisonRange, formatTime, frameForTime, stepComparison } from './timeline';
import { imagePageLayout, type ExportClip, type ExportConfig } from './exportPlan';
import { drawGridFrame, drawImageHeader, drawImageRow } from './exportRender';
import { PreviewFrames } from './previewFrames';
import { ReviewTimeline } from './ReviewTimeline';
import type { ComparisonClip } from './types';

type Props = { clips: ComparisonClip[]; config: ExportConfig; disabled: boolean; onRange: (range: { start: number; end: number }) => void };
export function ExportPreview({ clips, config, disabled, onRange }: Props) {
  const selected = config.rows.flatMap(row => row.clips).map(id => clips.find(c => c.id === id)).filter(c => c?.index && c.contact !== null && !c.error) as ExportClip[];
  const bounds = comparisonRange(selected);
  const [time, setTime] = useState(() => clamp(0, config.start, config.end));
  const [playing, setPlaying] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null), requested = useRef(time), revision = useRef(0);
  const latest = useRef({ selected, config, disabled, playing });
  const request = useRef<(time: number) => void>(() => {});
  useLayoutEffect(() => { latest.current = { selected, config, disabled, playing }; });
  const sourceKey = selected.map(c => c.id).sort().join('|');
  const configKey = JSON.stringify(config);
  const seek = (value: number) => { setPlaying(false); request.current(clamp(value, config.start, config.end)); };

  useEffect(() => {
    if (disabled || !selected.length) return;
    const sources = new Map(selected.map(clip => [clip.id, new PreviewFrames(clip.file, clip.index)]));
    let stopped = false, working = false, timer: ReturnType<typeof setTimeout> | undefined;
    const render = async () => {
      if (stopped || working) return;
      working = true;
      while (!stopped) {
        const version = revision.current, target = requested.current, state = latest.current, started = performance.now();
        const waiting = setTimeout(() => { if (!stopped) setBusy(true); }, 120);
        const results = await Promise.allSettled(state.selected.map(clip => sources.get(clip.id)!.get(frameForTime(clip, target))));
        const samples = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        try {
          if (stopped) break;
          if (version !== revision.current) continue; // A newer scrub/configuration owns the next picture.
          const failure = results.find(r => r.status === 'rejected');
          if (failure?.status === 'rejected') throw failure.reason;
          const output = canvas.current!, context = output.getContext('2d', { alpha: false });
          if (!context) throw new Error('Could not create the export canvas.');
          const { config: c, selected: clips } = state;
          const page = c.kind === 'images' ? imagePageLayout(clips.length, 1, c.cellWidth, c.cellAspect) : null;
          const width = page?.width ?? c.width, height = page ? page.header + page.rowHeight : c.height;
          if (!(width > 0 && height > 0)) throw new Error('Choose valid export settings.');
          const scale = Math.min(1, 1280 / width, 720 / height);
          const previewWidth = Math.max(1, Math.round(width * scale)), previewHeight = Math.max(1, Math.round(height * scale));
          if (output.width !== previewWidth || output.height !== previewHeight) { output.width = previewWidth; output.height = previewHeight; }
          context.setTransform(output.width / width, 0, 0, output.height / height, 0, 0);
          if (page) {
            context.fillStyle = '#080c0f'; context.fillRect(0, 0, width, height);
            drawImageHeader(context, clips, c, page); drawImageRow(context, samples, clips, c, page, target, 0);
          } else drawGridFrame(context, samples, clips, c, target);
          output.dataset.time = String(target);
          output.dataset.frames = state.selected.map(clip => frameForTime(clip, target)).join(',');
          setTime(target); setError(''); setBusy(false);
          if (latest.current.playing && target < c.end) {
            const interval = 1000 / Math.min(30, c.fps), increment = interval / 1000 * c.rate;
            let next = Math.min(c.end, target + increment);
            if (target < 0 && next >= 0) next = 0;
            timer = setTimeout(() => { if (!stopped && latest.current.playing) request.current(next); }, Math.max(0, interval - (performance.now() - started)));
          } else if (target >= c.end) setPlaying(false);
        } catch (failure) {
          if (!stopped) { setError(failure instanceof Error ? failure.message : 'No readable video frames.'); setPlaying(false); setBusy(false); }
        } finally { clearTimeout(waiting); samples.forEach(sample => sample.close()); }
        if (revision.current === version) break;
      }
      working = false;
    };
    request.current = next => { clearTimeout(timer); requested.current = next; revision.current++; void render(); };
    request.current(clamp(requested.current, latest.current.config.start, latest.current.config.end));
    return () => { stopped = true; clearTimeout(timer); request.current = () => {}; sources.forEach(source => source.dispose()); };
  }, [sourceKey, disabled]);
  useEffect(() => {
    setPlaying(false);
    request.current(clamp(requested.current, config.start, config.end));
  }, [configKey]);
  useEffect(() => {
    if (disabled) { setPlaying(false); setBusy(false); }
    else if (playing) request.current(time >= config.end ? config.start : clamp(time, config.start, config.end));
  }, [playing, disabled]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const canReview = !disabled && selected.length > 0;
  const changeRange = (range: { start: number; end: number }) => { setPlaying(false); onRange(range); };
  return <section className="export-live-preview" aria-label={t('Rendered preview')}>
    <h3>{t(config.kind === 'video' ? 'Rendered preview' : 'Preview image row')}</h3>
    <canvas ref={canvas} aria-label={t('Rendered comparison preview')} hidden={!selected.length}/>
    <div className="export-preview-controls"><div>
      <button type="button" aria-label={t('Previous preview frame')} disabled={!canReview} onClick={() => seek(stepComparison(selected, time, -1))}><SkipBack size={16}/></button>
      <button type="button" aria-label={t(playing ? 'Pause export preview' : 'Play export preview')} disabled={!canReview || config.end <= config.start} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button>
      <button type="button" aria-label={t('Next preview frame')} disabled={!canReview} onClick={() => seek(stepComparison(selected, time, 1))}><SkipForward size={16}/></button>
      <button type="button" aria-label={t('Preview contact frame')} disabled={!canReview || config.start > 0 || config.end < 0} onClick={() => seek(0)}><Crosshair size={16}/></button>
    </div><output>{formatTime(time, true)}</output></div>
    <ReviewTimeline key={sourceKey} min={bounds.start} max={bounds.end} value={time} step={0.001} selection={{ start: config.start, end: config.end }} disabled={!canReview}
      label={t('Export preview timeline')} startLabel={t('Export range start')} endLabel={t('Export range end')} valueText={n => formatTime(n, true)} contact={0}
      onChange={seek} onRange={changeRange} onStep={(value, direction) => clamp(stepComparison(selected, value, direction), bounds.start, bounds.end)}/>
    <div className="export-range-caption"><span>{t('Start: {time}', { time: formatTime(config.start, true) })}</span><span>{t('End: {time}', { time: formatTime(config.end, true) })}</span></div>
    <div className="export-preview-controls"><div>
      <button type="button" disabled={!canReview} onClick={() => changeRange({ start: time, end: config.end })}>{t('Start at cursor')}</button>
      <button type="button" disabled={!canReview} onClick={() => changeRange({ start: config.start, end: time })}>{t('End at cursor')}</button>
    </div><button type="button" disabled={!canReview} onClick={() => changeRange(bounds)}>{t('Use full selected range')}</button></div>
    <div className="export-preview-status" role={error ? 'alert' : 'status'}>{error ? t(error) : busy ? t('Preparing preview…') : t('Drag the yellow handles to choose the export range. Scroll or pinch to zoom.')}</div>
  </section>;
}
