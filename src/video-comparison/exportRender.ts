import { AppendOnlyStreamTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, canEncodeVideo, type VideoCodec } from 'mediabunny';
import { gridCells, containRect, type Cell } from './exportLayout';
import { exportPlan, imagePageLayout, sourceFrames, MAX_EXPORT_BYTES, type ExportClip, type ExportConfig } from './exportPlan';
import { zipImages } from './exportZip';
import { readVideoFrames, type ReviewFrame } from './videoFrames';
import { formatTime } from './timeline';
import type { ComparisonClip } from './types';
import { drawCropped, normalizeCrop } from './crop';

export type ExportResult = { blob: Blob; name: string };
export async function chooseVideoEncoding(config: Pick<ExportConfig, 'format' | 'width' | 'height' | 'fps'>) {
  const candidates: { codec: VideoCodec; extension: 'mp4' | 'webm' }[] = [
    { codec: 'avc', extension: 'mp4' }, { codec: 'vp9', extension: 'webm' }, { codec: 'vp8', extension: 'webm' },
  ];
  for (const candidate of candidates) {
    if (config.format !== 'auto' && config.format !== candidate.extension) continue;
    if (await canEncodeVideo(candidate.codec, { width: config.width, height: config.height, frameRate: config.fps, quality: QUALITY_HIGH })) return candidate;
  }
  throw new Error('This browser cannot encode the selected video output. Try a lower resolution, Auto format, another browser, or a grid image.');
}

export function drawCell(context: CanvasRenderingContext2D, frame: ReviewFrame, clip: ExportClip, cell: Cell, label: boolean) {
  const labelHeight = label ? Math.min(32, cell.height * 0.15) : 0;
  const crop = normalizeCrop(clip.crop);
  const rect = containRect(frame.width * crop.width, frame.height * crop.height, { ...cell, height: cell.height - labelHeight });
  context.save();
  context.beginPath(); context.rect(cell.x, cell.y, cell.width, cell.height); context.clip();
  context.fillStyle = '#000'; context.fillRect(cell.x, cell.y, cell.width, cell.height);
  drawCropped(context, (x, y, width, height) => frame.draw(context, x, y, width, height), crop, rect, clip.mirrored);
  if (label) {
    context.fillStyle = '#edf3f6'; context.font = `${Math.max(10, Math.floor(labelHeight * 0.55))}px sans-serif`;
    context.textBaseline = 'middle'; context.fillText(clip.name, cell.x + 6, cell.y + cell.height - labelHeight / 2, cell.width - 12);
  }
  context.restore();
}

const png = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image is too large for this browser. Reduce the cell width.')), 'image/png'));

/** Shared by the interactive preview and the offline video compositor. */
export function drawGridFrame(context: CanvasRenderingContext2D, samples: readonly ReviewFrame[], clips: readonly ExportClip[], config: ExportConfig, time: number) {
  context.fillStyle = '#080c0f'; context.fillRect(0, 0, config.width, config.height);
  gridCells(config.rows, config.width, config.height).forEach(cell => {
    const i = clips.findIndex(clip => clip.id === cell.id);
    if (i >= 0 && samples[i]) drawCell(context, samples[i]!, clips[i]!, cell, config.labels);
  });
  if (config.labels) {
    context.font = `${Math.max(12, Math.round(config.width / 90))}px monospace`; context.textBaseline = 'top';
    const label = formatTime(time, true), size = context.measureText(label).width;
    context.fillStyle = '#080c0fcc'; context.fillRect(8, 8, size + 12, Math.max(20, config.width / 60));
    context.fillStyle = '#fff'; context.fillText(label, 14, 10);
  }
}

export function drawImageHeader(context: CanvasRenderingContext2D, clips: readonly ExportClip[], config: ExportConfig, page: ReturnType<typeof imagePageLayout>) {
  context.fillStyle = '#edf3f6'; context.font = '18px sans-serif'; context.textBaseline = 'middle';
  clips.forEach((clip, i) => context.fillText(clip.name, page.timeWidth + i * (config.cellWidth + page.gap) + 6, page.header / 2, config.cellWidth - 12));
}

export function drawImageRow(context: CanvasRenderingContext2D, samples: readonly ReviewFrame[], clips: readonly ExportClip[], config: ExportConfig,
  page: ReturnType<typeof imagePageLayout>, time: number, row: number) {
  const y = page.header + row * page.rowHeight;
  context.fillStyle = '#edf3f6'; context.font = '17px monospace'; context.textBaseline = 'middle';
  context.fillText(formatTime(time, true), 8, y + page.cellHeight / 2, page.timeWidth - 16);
  samples.forEach((sample, i) => drawCell(context, sample, clips[i]!, { id: clips[i]!.id,
    x: page.timeWidth + i * (config.cellWidth + page.gap), y, width: config.cellWidth, height: page.cellHeight }, false));
}

export async function renderComparison(clips: readonly ComparisonClip[], config: ExportConfig, signal: AbortSignal,
  onProgress: (fraction: number) => void, onCompatibility: () => void): Promise<ExportResult> {
  const plan = exportPlan(clips, config);
  signal.throwIfAborted();
  const encoding = config.kind === 'video' ? await chooseVideoEncoding(config) : null;
  signal.throwIfAborted();
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not create the export canvas.');
  const page = config.kind === 'images' ? imagePageLayout(plan.clips.length, plan.times.length, config.cellWidth, config.cellAspect) : null;
  const iterators = plan.clips.map(clip => {
    const frames = sourceFrames(clip, plan.times);
    return readVideoFrames(clip.file, clip.index, { length: frames.length, at: i => frames[i]! }, signal, onCompatibility);
  });
  const chunks: Blob[] = [], pages: { name: string; blob: Blob }[] = [];
  let output: Output | undefined, source: CanvasSource | undefined, bytes = 0;
  const limit = (size: number) => { bytes += size; if (bytes > MAX_EXPORT_BYTES) throw new Error('Export exceeds 256 MB. Choose a shorter range or lower resolution.'); };
  const abort = () => { void output?.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (encoding) {
      canvas.width = config.width; canvas.height = config.height;
      const target = new AppendOnlyStreamTarget(new WritableStream({ write(data: Uint8Array) {
        signal.throwIfAborted(); limit(data.byteLength); chunks.push(new Blob([new Uint8Array(data)]));
      } }));
      output = new Output({ target, format: encoding.extension === 'mp4' ? new Mp4OutputFormat({ fastStart: 'fragmented' }) : new WebMOutputFormat({ appendOnly: true }) });
      source = new CanvasSource(canvas, { codec: encoding.codec, quality: QUALITY_HIGH });
      output.addVideoTrack(source, { frameRate: config.fps });
      await output.start();
    }
    for (let row = 0; row < plan.times.length; row++) {
      signal.throwIfAborted();
      const results = await Promise.allSettled(iterators.map(iterator => iterator.next()));
      const samples = results.flatMap(result => result.status === 'fulfilled' && !result.value.done ? [result.value.value] : []);
      try {
        signal.throwIfAborted();
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
        if (samples.length !== plan.clips.length) throw new Error('No readable video frames.');
        if (page) {
          const pageRow = row % page.pageRows;
          if (pageRow === 0) {
            canvas.width = page.width; canvas.height = page.header + Math.min(page.pageRows, plan.times.length - row) * page.rowHeight;
            context.fillStyle = '#080c0f'; context.fillRect(0, 0, canvas.width, canvas.height);
            drawImageHeader(context, plan.clips, config, page);
          }
          drawImageRow(context, samples, plan.clips, config, page, plan.times[row]!, pageRow);
          if (pageRow === page.pageRows - 1 || row === plan.times.length - 1) {
            const blob = await png(canvas); limit(blob.size);
            pages.push({ name: `comparison-${String(pages.length + 1).padStart(3, '0')}.png`, blob });
          }
        } else {
          drawGridFrame(context, samples, plan.clips, config, plan.times[row]!);
          await source!.add(row / config.fps, Math.min(1 / config.fps, plan.duration - row / config.fps));
        }
      } finally { samples.forEach(sample => sample.close()); }
      onProgress((row + 1) / plan.times.length * 0.98);
      if (row % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    let result: ExportResult;
    if (output && encoding) {
      await output.finalize();
      result = { blob: new Blob(chunks, { type: encoding.extension === 'mp4' ? 'video/mp4' : 'video/webm' }), name: `tenmulate-comparison.${encoding.extension}` };
    } else if (pages.length === 1) result = { blob: pages[0]!.blob, name: 'tenmulate-comparison.png' };
    else result = { blob: await zipImages(pages, signal), name: 'tenmulate-comparison-images.zip' };
    signal.throwIfAborted();
    if (result.blob.size > MAX_EXPORT_BYTES) throw new Error('Export exceeds 256 MB. Choose a shorter range or lower resolution.');
    onProgress(1);
    return result;
  } finally {
    signal.removeEventListener('abort', abort);
    await Promise.allSettled(iterators.map(iterator => iterator.return(undefined)));
    if (output && output.state !== 'finalized') await output.cancel().catch(() => {});
    canvas.width = canvas.height = 0;
  }
}
