import { frameAt, mediaTime, stepComparison, type AlignedClip } from './timeline';
import type { ComparisonClip } from './types';
import type { GridRow } from './exportLayout';

export type ExportClip = ComparisonClip & { index: NonNullable<ComparisonClip['index']>; contact: number };
export type ExportConfig = {
  kind: 'video' | 'images'; format: 'auto' | 'mp4' | 'webm';
  width: number; height: number; fps: number; rate: number; start: number; end: number;
  rows: GridRow[]; labels: boolean;
  sampling: 'even' | 'frames'; imageRows: number; cellWidth: number; cellAspect: number;
};
export type ExportPlan = { clips: ExportClip[]; times: number[]; config: ExportConfig; duration: number };
export const MAX_EXPORT_BYTES = 256 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 8192;

export function exportPlan(clips: readonly ComparisonClip[], config: ExportConfig): ExportPlan {
  const ids = config.rows.flatMap(row => row.clips);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Select at least one clip and use each clip once.');
  const selected = ids.map(id => clips.find(clip => clip.id === id));
  if (selected.some(clip => !clip?.index || clip.contact === null || clip.error)) throw new Error('Set a contact frame in every included clip.');
  const ready = selected as ExportClip[];
  if (![config.start, config.end, config.rate].every(Number.isFinite) || config.end < config.start || config.rate < 0.25 || config.rate > 2) {
    throw new Error('Choose a valid time range and playback speed.');
  }
  const duration = (config.end - config.start) / config.rate;
  let times: number[];
  if (config.kind === 'video') {
    if (![config.width, config.height].every(value => Number.isInteger(value) && value >= 128 && value <= 4096 && value % 2 === 0)
      || ![24, 25, 30, 50, 60].includes(config.fps)) throw new Error('Choose an even resolution from 128 to 4096 pixels and a supported frame rate.');
    if (duration < 0.000001 || Math.ceil(duration * config.fps - 1e-7) > 36_000) throw new Error('Choose a shorter, nonempty video time range.');
    times = Array.from({ length: Math.ceil(duration * config.fps - 1e-7) }, (_, i) => {
      const time = config.start + i / config.fps * config.rate;
      return i > 0 && time >= 0 && config.start + (i - 1) / config.fps * config.rate < 0 ? 0 : time;
    });
  } else {
    if (!Number.isInteger(config.imageRows) || config.imageRows < 1 || config.imageRows > 2000
      || !Number.isInteger(config.cellWidth) || config.cellWidth < 120 || config.cellWidth > 2048
      || !Number.isFinite(config.cellAspect) || config.cellAspect < 0.25 || config.cellAspect > 4) {
      throw new Error('Choose 1–2000 image rows and a cell width from 120 to 2048 pixels.');
    }
    if (config.sampling === 'frames') {
      times = [config.start];
      while (times.at(-1)! < config.end - 1e-7) {
        const next = stepComparison(ready as AlignedClip[], times.at(-1)!, 1);
        if (next <= times.at(-1)! + 1e-7 || next > config.end) break;
        times.push(next);
        if (times.length >= 10_000) throw new Error('Choose a shorter time range or fewer image rows.');
      }
      if (config.end > times.at(-1)! + 1e-7) times.push(config.end);
    } else {
      times = config.imageRows === 1 || config.start === config.end ? [config.start]
        : Array.from({ length: config.imageRows }, (_, i) => i === config.imageRows - 1 ? config.end : config.start + (config.end - config.start) * i / (config.imageRows - 1));
    }
    // Contact always gets its own row when included in the selected range.
    if (config.start <= 0 && config.end >= 0 && !times.some(time => Math.abs(time) < 1e-7)) times.push(0);
    times.sort((a, b) => a - b);
    imagePageLayout(ready.length, times.length, config.cellWidth, config.cellAspect);
  }
  return { clips: ready, times, config, duration };
}

export function sourceFrames(clip: ExportClip, times: readonly number[]): number[] {
  return times.map(time => frameAt(clip.index, mediaTime(clip, time)));
}

export function imagePageLayout(columns: number, rows: number, cellWidth: number, aspect: number) {
  const gap = 8, timeWidth = 132, header = 44;
  const cellHeight = Math.round(cellWidth / aspect), rowHeight = cellHeight + gap;
  const width = timeWidth + columns * (cellWidth + gap) + gap;
  const pageRows = Math.min(rows, Math.floor((MAX_IMAGE_SIDE - header) / rowHeight), Math.floor((MAX_IMAGE_PIXELS / width - header) / rowHeight));
  if (width > MAX_IMAGE_SIDE || pageRows < 1) throw new Error('Reduce image cell width or include fewer clips.');
  return { width, cellHeight, rowHeight, header, gap, timeWidth, pageRows,
    totalHeight: header + rows * rowHeight, pages: Math.ceil(rows / pageRows) };
}
