import { t } from '../../i18n/locale';
import { clipFrameRange } from '../timeline';
import type { ComparisonClip } from '../types';
import type { Cell } from '../exportLayout';
import { plotData, type PlotData } from './series';
import { JOINTS, LANDMARKS, METRICS, type ClipMotion, type MotionPlot } from './types';
import { plotContactPosition } from './plotTimeline';
const cache = new WeakMap<ClipMotion, Map<MotionPlot, PlotData>>();
/** Export reuses the same source-frame measurements; model inference never runs here. */
export function drawExportPlots(ctx: CanvasRenderingContext2D, clip: ComparisonClip, frame: number, rect: Omit<Cell, 'id'>) {
  if (!clip.motion || !clip.index) return;
  const motion = clip.motion, index = clip.index, plots = motion.plots.slice(0, 4), range = clipFrameRange({ ...clip, index });
  let entries = cache.get(motion); if (!entries) { entries = new Map(); cache.set(motion, entries); }
  const span = index.timestamps[range.end] - index.timestamps[range.start] || 1;
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.width, rect.height); ctx.clip();
  ctx.fillStyle = '#0b141b'; ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  for (let p = 0; p < plots.length; p++) {
    const plot = plots[p]; let data = entries.get(plot); if (!data) { data = plotData(motion, plot, index); entries.set(plot, data); }
    const height = rect.height / plots.length, top = rect.y + p * height, font = Math.max(7, Math.min(14, height / 5)), graphTop = top + font * 1.6;
    const x = (f: number) => rect.x + 5 + (index.timestamps[f] - index.timestamps[range.start]) / span * (rect.width - 10);
    const y = (value: number) => graphTop + (1 - (value - data!.min) / (data!.max - data!.min || 1)) * Math.max(1, height - font * 1.6 - 5);
    const [type, id] = plot.target.split(':'), target = type === 'track' ? motion.tracks.find(v => v.id === id)?.name ?? '' : type === 'joint' ? t(JOINTS[id]?.name ?? '') : t(LANDMARKS[Number(id)] ?? '');
    const value = data.values[frame - data.start];
    ctx.font = `${font}px sans-serif`; ctx.textBaseline = 'top'; ctx.fillStyle = '#e4edf2';
    ctx.fillText(`${target} · ${t(METRICS[plot.metric].name)} ${value === null || value === undefined ? '—' : `${data.estimated[frame - data.start] ? '≈' : ''}${value.toFixed(1)}`} ${METRICS[plot.metric].unit}`, rect.x + 5, top + 2, rect.width - 10);
    let drawing = false; ctx.beginPath(); const stride = Math.max(1, Math.ceil((range.end - range.start + 1) / Math.max(1, rect.width)));
    for (let f = Math.max(range.start, data.start); f <= Math.min(range.end, data.start + data.values.length - 1); f++) {
      const v = data.values[f - data.start]; if (v === null || !Number.isFinite(v)) { drawing = false; continue; }
      if (drawing && f % stride && f !== range.end) continue;
      if (drawing) ctx.lineTo(x(f), y(v)); else ctx.moveTo(x(f), y(v)); drawing = true;
    }
    ctx.strokeStyle = '#46d9ff'; ctx.lineWidth = Math.max(1, rect.width / 600); ctx.stroke();
    const contact = plotContactPosition(index, clip.contact, range.start, range.end);
    if (contact !== null) {
      const marker = rect.x + 5 + contact * (rect.width - 10);
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(marker, graphTop); ctx.lineTo(marker, top + height - 3); ctx.strokeStyle = '#d5b96a'; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(marker, graphTop); ctx.lineTo(marker + 3, graphTop + 3); ctx.lineTo(marker, graphTop + 6); ctx.lineTo(marker - 3, graphTop + 3); ctx.closePath(); ctx.fillStyle = '#d5b96a'; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(x(frame), graphTop); ctx.lineTo(x(frame), top + height - 3); ctx.strokeStyle = '#f6e62d'; ctx.stroke();
  }
  ctx.restore();
}
