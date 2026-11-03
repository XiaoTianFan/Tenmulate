import { memo, useMemo } from 'react';
import { t } from '../../i18n/locale';
import { frameAt, formatTime } from '../timeline';
import type { ComparisonClip } from '../types';
import { plotData, type PlotData } from './series';
import { JOINTS, LANDMARKS, METRICS, type Metric, type MotionPlot } from './types';
import { plotContactPosition } from './plotTimeline';

export function targetName(clip: ComparisonClip, target: string): string {
  const [type, id] = target.split(':'); return type === 'track' ? clip.motion?.tracks.find(track => track.id === id)?.name ?? '' : type === 'pose' ? t(LANDMARKS[Number(id)] ?? '') : t(JOINTS[id]?.name ?? '');
}
export function plotPath(data: PlotData, timestamps: Float64Array, start: number, end: number) {
  const a = timestamps[start], span = timestamps[end] - a || 1, vertical = data.max - data.min || 1;
  let path = '', drawing = false;
  // Keep gaps while limiting path density to the visible plot's pixel budget.
  const stride = Math.max(1, Math.ceil((end - start + 1) / 1000));
  for (let f = Math.max(start, data.start); f <= Math.min(end, data.start + data.values.length - 1); f++) {
    const value = data.values[f - data.start]; if (value === null || !Number.isFinite(value)) { drawing = false; continue; }
    if (drawing && f % stride && f !== end) continue;
    path += `${drawing ? 'L' : 'M'}${((timestamps[f] - a) / span * 1000).toFixed(2)},${(115 - (value - data.min) / vertical * 100).toFixed(2)}`; drawing = true;
  }
  return path;
}
export const MotionPlotCard = memo(function MotionPlotCard({ clip, plot, frame, view, linked, onFrame, onChange, onRemove }: { clip: ComparisonClip; plot: MotionPlot; frame: number; view: { start: number; end: number }; linked: boolean; onFrame: (frame: number) => void; onChange: (plot: MotionPlot) => void; onRemove: () => void }) {
  const index = clip.index!, motion = clip.motion!;
  const data = useMemo(() => plotData(motion, plot, index), [motion, plot, index]);
  const start = Math.max(0, Math.floor(view.start)), end = Math.min(index.timestamps.length - 1, Math.ceil(view.end));
  const path = useMemo(() => plotPath(data, index.timestamps, start, end), [data, index, start, end]);
  const cursor = (index.timestamps[frame] - index.timestamps[start]) / (index.timestamps[end] - index.timestamps[start] || 1) * 1000;
  const contact = plotContactPosition(index, clip.contact, start, end);
  const value = data.values[frame - data.start], estimated = data.estimated[frame - data.start];
  const angle = plot.target.startsWith('joint:'), metrics: Metric[] = angle ? ['angle', 'angularVelocity', 'angularAcceleration'] : ['x', 'y', 'vx', 'vy', 'speed', 'ax', 'ay', 'acceleration', 'confidence'];
  const continuous = plot.target.startsWith('track:') && motion.tracks.find(track => `track:${track.id}` === plot.target)?.result?.continuous;
  const position = ['x', 'y', 'confidence'].includes(plot.metric);
  const labelTime = (f: number) => formatTime(linked && clip.contact !== null ? (index.timestamps[f] - index.timestamps[clip.contact]) / clip.speed : index.timestamps[f], linked);
  return <section className="motion-plot" aria-label={t('Motion plot')}>
    <div className="motion-plot-controls">
      <select aria-label={t('Plot target')} value={plot.target} onChange={event => { const target = event.target.value; onChange({ ...plot, target, metric: target.startsWith('joint:') ? 'angle' : 'speed' }); }}>
        {motion.tracks.map(track => <option key={track.id} value={`track:${track.id}`}>{track.name}</option>)}
        {LANDMARKS.map((name, i) => <option key={name} value={`pose:${i}`}>{t(name)}</option>)}
        {Object.entries(JOINTS).map(([id, joint]) => <option key={id} value={`joint:${id}`}>{t(joint.name)} · {t('Joint angle')}</option>)}
      </select>
      <select aria-label={t('Plot parameter')} value={plot.metric} onChange={event => onChange({ ...plot, metric: event.target.value as Metric })}>{metrics.map(id => <option key={id} value={id}>{t(METRICS[id].name)}</option>)}</select>
      <button type="button" aria-label={t('Remove plot')} onClick={onRemove}>×</button>
    </div>
    <div className="motion-plot-readout"><output>{value === null || value === undefined ? '—' : `${estimated ? '≈' : ''}${value.toFixed(1)} ${METRICS[plot.metric].unit}`}</output>
      <label>{t(continuous ? 'Derivative smoothing' : 'Smoothing')}<select disabled={continuous && position} value={plot.smoothing} onChange={event => onChange({ ...plot, smoothing: Number(event.target.value) })}><option value={0}>{t('Raw')}</option><option value={.05}>{'50 ms'}</option><option value={.1}>{'100 ms'}</option><option value={.2}>{'200 ms'}</option></select></label></div>
    <svg viewBox="0 0 1000 140" preserveAspectRatio="none" role="slider" tabIndex={0} aria-label={t('Seek motion plot')} aria-valuemin={start + 1} aria-valuemax={end + 1} aria-valuenow={frame + 1}
      onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); onFrame(event.key === 'Home' ? start : event.key === 'End' ? end : Math.max(start, Math.min(end, frame + (event.key === 'ArrowRight' ? 1 : -1)))); } }}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const r = event.currentTarget.getBoundingClientRect(); onFrame(frameAt(index, index.timestamps[start] + Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)) * (index.timestamps[end] - index.timestamps[start]))); }}
      onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const r = event.currentTarget.getBoundingClientRect(); onFrame(frameAt(index, index.timestamps[start] + Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)) * (index.timestamps[end] - index.timestamps[start]))); }}>
      <path d="M0,115H1000M0,15H1000" className="motion-plot-grid"/>
      {contact !== null ? <g className="motion-plot-contact" data-contact-frame={clip.contact} aria-label={t('Contact frame')}>
        <title>{t('Contact frame')} · {t('Frame {frame}', { frame: clip.contact! + 1 })}</title>
        <path d={`M${contact * 1000},9V140`} className="motion-plot-contact-line"/>
        <path d={`M${contact * 1000},0l8,5l-8,5l-8,-5Z`} className="motion-plot-contact-head"/>
      </g> : null}
      <path d={path} className="motion-plot-line"/>
      {cursor >= 0 && cursor <= 1000 ? <path d={`M${cursor},0V140`} className="motion-plot-cursor"/> : null}
    </svg>
    <div className="motion-plot-axis"><span>{labelTime(start)}</span><span>{contact !== null ? <span className="motion-plot-contact-key">◇ {t('Contact frame')} · </span> : null}{t('Source-time units')}</span><span>{labelTime(end)}</span></div>
    {!data.values.length ? <p>{t('Run analysis to populate this plot.')}</p> : null}
  </section>;
});
