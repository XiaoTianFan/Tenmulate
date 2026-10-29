import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { t, useLocale } from '../i18n/locale';
import { comparisonRange } from './timeline';
import { ExportGridEditor } from './ExportGridEditor';
import { outputSize, type GridRow } from './exportLayout';
import { exportPlan, imagePageLayout, type ExportConfig } from './exportPlan';
import { renderComparison } from './exportRender';
import type { ComparisonClip } from './types';
import './export.css';

type Props = { clips: ComparisonClip[]; rate: number; previews: Record<string, string>; onClose: () => void };
export function ComparisonExportModal({ clips, rate, previews, onClose }: Props) {
  const locale = useLocale();
  const eligible = clips.filter(clip => clip.index && clip.contact !== null && !clip.error);
  const bounds = comparisonRange(eligible.map(clip => ({ index: clip.index!, contact: clip.contact!, speed: clip.speed })));
  const [included, setIncluded] = useState(() => eligible.map(clip => clip.id));
  const [videoRows, setVideoRows] = useState<GridRow[]>(() => [{ id: 'first', clips: eligible.map(clip => clip.id) }]);
  const [imageOrder, setImageOrder] = useState(() => eligible.map(clip => clip.id));
  const [aspect, setAspect] = useState('16:9'), [longEdge, setLongEdge] = useState(1920);
  const [options, setOptions] = useState<Omit<ExportConfig, 'rows'>>({ kind: 'video', format: 'auto', width: 1920, height: 1080, fps: 30,
    rate, start: bounds.start, end: bounds.end, labels: true, sampling: 'even', imageRows: 12, cellWidth: 480, cellAspect: 16 / 9 });
  const [running, setRunning] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(''), [compatibility, setCompatibility] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string; key: string } | null>(null);
  const controller = useRef<AbortController | null>(null), dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  const opener = useRef(document.activeElement as HTMLElement | null);
  const rows = options.kind === 'video' ? videoRows.filter(row => row.clips.length) : [{ id: 'images', clips: imageOrder }].filter(row => row.clips.length);
  const config: ExportConfig = { ...options, rows };
  const key = JSON.stringify(config);
  const { validation, description } = useMemo(() => {
    let validation = '', description = '';
    try {
    const plan = exportPlan(clips, config);
    if (options.kind === 'images') {
      const page = imagePageLayout(plan.clips.length, plan.times.length, options.cellWidth, options.cellAspect);
      description = t('{columns} columns × {rows} rows · {width} × {height} px · {pages} PNG page(s)', { columns: plan.clips.length, rows: plan.times.length, width: page.width, height: page.totalHeight, pages: page.pages });
    } else description = t('{width} × {height} px · {fps} fps · {seconds} s', { width: options.width, height: options.height, fps: options.fps, seconds: plan.duration.toFixed(2) });
    } catch (failure) { validation = failure instanceof Error ? failure.message : 'Choose valid export settings.'; }
    return { validation, description };
  }, [key, clips, locale]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      controller.current?.abort(); controller.current = null; element?.close();
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  const change = (patch: Partial<Omit<ExportConfig, 'rows'>>) => { setOptions(current => ({ ...current, ...patch })); setError(''); };
  const toggle = (id: string, checked: boolean) => {
    setIncluded(current => checked ? [...current, id] : current.filter(value => value !== id));
    setImageOrder(current => checked ? [...current, id] : current.filter(value => value !== id));
    setVideoRows(current => checked ? current.length ? current.map((row, i) => i === current.length - 1 ? { ...row, clips: [...row.clips, id] } : row) : [{ id: 'first', clips: [id] }]
      : current.map(row => ({ ...row, clips: row.clips.filter(value => value !== id) })).filter(row => row.clips.length));
  };
  const preset = (columns: number) => setVideoRows(Array.from({ length: Math.ceil(included.length / columns) }, (_, i) => ({ id: `preset-${i}`, clips: videoRows.flatMap(row => row.clips).slice(i * columns, (i + 1) * columns) })));
  const start = async () => {
    const job = new AbortController(); controller.current = job;
    setResult(null); setError(''); setCompatibility(false); setProgress(0); setRunning(true);
    try {
      const output = await renderComparison(clips, config, job.signal, value => { if (!job.signal.aborted) setProgress(value); }, () => { if (!job.signal.aborted) setCompatibility(true); });
      if (!job.signal.aborted) setResult({ url: URL.createObjectURL(output.blob), name: output.name, key });
    } catch (failure) {
      if (!job.signal.aborted) setError(failure instanceof Error ? failure.message : 'Export failed. Try fewer frames or a lower resolution.');
    } finally { if (controller.current === job) { controller.current = null; setRunning(false); } }
  };
  const close = () => { controller.current?.abort(); onClose(); };
  return createPortal(<dialog ref={dialog} className="comparison-export" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2 id={titleId}>{t('Export comparison')}</h2><button type="button" onClick={close} aria-label={t('Close dialog')}><X size={20}/></button></header>
    <div className="export-body">
      <fieldset className="export-settings" disabled={running}>
        <label>{t('Output')}<select aria-label={t('Output')} value={options.kind} onChange={event => change({ kind: event.target.value as ExportConfig['kind'] })}>
          <option value="video">{t('Grid video')}</option><option value="images">{t('Grid images')}</option></select></label>
        <div className="export-field-pair">
          <label>{t('Start (s from contact)')}<input type="number" step="0.001" value={Number(options.start.toFixed(3))} onChange={event => change({ start: Number(event.target.value) })}/></label>
          <label>{t('End (s from contact)')}<input type="number" step="0.001" value={Number(options.end.toFixed(3))} onChange={event => change({ end: Number(event.target.value) })}/></label>
        </div>
        <button type="button" className="export-text-button" onClick={() => {
          const range = comparisonRange(eligible.filter(clip => included.includes(clip.id)).map(clip => ({ index: clip.index!, contact: clip.contact!, speed: clip.speed })));
          change({ start: range.start, end: range.end });
        }}>{t('Use full selected range')}</button>
        {options.kind === 'video' ? <>
          <label>{t('Aspect ratio')}<select aria-label={t('Aspect ratio')} value={aspect} onChange={event => { setAspect(event.target.value); if (event.target.value !== 'custom') change(outputSize(event.target.value, longEdge)); }}>
            {['16:9', '9:16', '1:1', '4:3', '3:4'].map(value => <option key={value}>{value}</option>)}<option value="custom">{t('Custom')}</option></select></label>
          {aspect !== 'custom' ? <label>{t('Resolution (long edge)')}<select aria-label={t('Resolution (long edge)')} value={longEdge} onChange={event => { const value = Number(event.target.value); setLongEdge(value); change(outputSize(aspect, value)); }}>
            {[1280, 1920, 2560, 3840].map(value => <option key={value} value={value}>{value} {t('px')}</option>)}</select></label> : <div className="export-field-pair">
            <label>{t('Width (px)')}<input type="number" min={128} max={4096} step={2} value={options.width} onChange={event => change({ width: Number(event.target.value) })}/></label>
            <label>{t('Height (px)')}<input type="number" min={128} max={4096} step={2} value={options.height} onChange={event => change({ height: Number(event.target.value) })}/></label></div>}
          <div className="export-field-pair">
            <label>{t('Frame rate')}<select aria-label={t('Frame rate')} value={options.fps} onChange={event => change({ fps: Number(event.target.value) })}>{[24, 25, 30, 50, 60].map(value => <option key={value} value={value}>{value} {t('fps')}</option>)}</select></label>
            <label>{t('Playback speed')}<select aria-label={t('Playback speed')} value={options.rate} onChange={event => change({ rate: Number(event.target.value) })}>{[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
          </div>
          <label>{t('File format')}<select aria-label={t('File format')} value={options.format} onChange={event => change({ format: event.target.value as ExportConfig['format'] })}><option value="auto">{t('Auto (MP4 or WebM)')}</option><option value="mp4">{t('MP4')}</option><option value="webm">{t('WebM')}</option></select></label>
          <label className="export-check"><input type="checkbox" checked={options.labels} onChange={event => change({ labels: event.target.checked })}/>{t('Show clip names and timecode')}</label>
        </> : <>
          <label>{t('Frame sampling')}<select aria-label={t('Frame sampling')} value={options.sampling} onChange={event => change({ sampling: event.target.value as ExportConfig['sampling'] })}><option value="even">{t('Evenly spaced rows')}</option><option value="frames">{t('Every synced frame')}</option></select></label>
          {options.sampling === 'even' ? <label>{t('Image rows')}<input type="number" min={1} max={2000} value={options.imageRows} onChange={event => change({ imageRows: Number(event.target.value) })}/></label> : null}
          <label>{t('Cell width (px)')}<input type="number" min={120} max={2048} step={1} value={options.cellWidth} onChange={event => change({ cellWidth: Number(event.target.value) })}/></label>
          <label>{t('Cell aspect ratio')}<select aria-label={t('Cell aspect ratio')} value={options.cellAspect} onChange={event => change({ cellAspect: Number(event.target.value) })}>{[['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:3', 4 / 3]].map(([label, value]) => <option key={label} value={value}>{label}</option>)}</select></label>
          <p className="export-hint">{t('Columns are clips; rows share contact-relative time. Contact gets its own row. Large sheets are split into PNG pages in a ZIP.')}</p>
        </>}
      </fieldset>
      <fieldset className="export-arrangement" disabled={running}>
        <legend>{t('Included clips')}</legend>
        <div className="export-clip-list">{clips.map(clip => <label key={clip.id} className={`export-clip-toggle${included.includes(clip.id) ? ' is-included' : ''}`}>
          <input type="checkbox" checked={included.includes(clip.id)} disabled={!eligible.some(item => item.id === clip.id)} onChange={event => toggle(clip.id, event.target.checked)}/>
          {previews[clip.id] || clip.thumbnails[0] ? <img src={previews[clip.id] || clip.thumbnails[0]} alt="" style={{ transform: clip.mirrored ? 'scaleX(-1)' : undefined }}/> : null}
          <span>{clip.name}{!eligible.some(item => item.id === clip.id) ? <small>{t('Set a contact frame to include this clip.')}</small> : null}</span>
        </label>)}</div>
        <div className="export-preview-heading"><h3>{t(options.kind === 'video' ? 'Video layout' : 'Column order')}</h3>
          {options.kind === 'video' ? <div className="export-layout-presets"><button type="button" disabled={!included.length} onClick={() => preset(included.length)}>{t('One row')}</button><button type="button" disabled={!included.length} onClick={() => preset(1)}>{t('One column')}</button><button type="button" disabled={!included.length} onClick={() => preset(Math.ceil(Math.sqrt(included.length)))}>{t('Auto grid')}</button></div> : null}
        </div>
        <ExportGridEditor rows={rows} clips={clips} previews={previews} aspect={options.width / options.height} images={options.kind === 'images'}
          onChange={next => options.kind === 'video' ? setVideoRows(next) : setImageOrder(next.flatMap(row => row.clips))}/>
        <output className="export-dimensions">{description}</output>
        <p className="export-hint">{t('Exports are silent. Contact alignment, clip speeds and mirror settings are preserved. Files stay on this device.')}</p>
      </fieldset>
    </div>
    <footer>
      <div className="export-feedback" aria-live="polite">
        {error || validation ? <p role="alert">{t(error || validation)}</p> : null}
        {running ? <><progress max={1} value={progress}/><span>{t('Rendering {percent}%', { percent: Math.round(progress * 100) })}</span></> : null}
        {compatibility ? <p>{t('Using compatibility decoding. Rendering may take longer.')}</p> : null}
      </div>
      <div className="export-actions">
        {running ? <button type="button" onClick={() => controller.current?.abort()}>{t('Cancel export')}</button> : <button type="button" onClick={close}>{t('Close')}</button>}
        {result?.key === key ? <a className="export-primary" href={result.url} download={result.name}><Download size={16}/>{t('Download export')}</a>
          : <button type="button" className="export-primary" disabled={running || !!validation} onClick={() => void start()}><Download size={16}/>{t('Start export')}</button>}
      </div>
    </footer>
  </dialog>, document.body);
}
