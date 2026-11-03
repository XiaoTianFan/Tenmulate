import { readVideoFrames } from '../videoFrames';
import { clipFrameRange } from '../timeline';
import type { ComparisonClip } from '../types';
import { emptySeries, MANUAL, putSample, type MotionSeries, type MotionTrack } from './types';
import { fillDraft } from './series';
import type { PixelFrame } from './tracker';

export type AnalysisRequest = { kind: 'track'; track: MotionTrack } | { kind: 'pose' };
export type AnalysisProgress = { progress: number; message: string };
export async function analyze(clip: ComparisonClip, job: AnalysisRequest, signal: AbortSignal, ready: () => Promise<void>, progress: (value: AnalysisProgress) => void): Promise<MotionSeries> {
  if (!clip.index) throw new Error('Wait for video indexing before analysis.');
  const index = clip.index, range = clipFrameRange({ ...clip, index });
  if (range.end - range.start + 1 > 7200 || index.timestamps[range.end] - index.timestamps[range.start] > 60) throw new Error('Choose an excerpt of up to 60 seconds and 7200 frames for analysis.');
  const worker = job.kind === 'pose'
    ? new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' })
    : new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true })!;
  let serial = 0, pending: { id: number; resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  const fail = (error: Error) => { if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = undefined; } };
  const abort = () => { fail(new DOMException('Aborted', 'AbortError')); worker.terminate(); };
  signal.addEventListener('abort', abort, { once: true });
  worker.onerror = () => fail(new Error('Motion analysis could not start. Check your connection and try again.'));
  worker.onmessage = ({ data }) => {
    if (!pending || pending.id !== data.id) return;
    if ('progress' in data) { progress({ progress: data.progress * 0.15, message: 'Loading pose model…' }); return; }
    const current = pending; clearTimeout(current.timer); pending = undefined;
    if (data.error) current.reject(new Error('Motion analysis failed. Try a shorter excerpt or another video.')); else current.resolve(data.result);
  };
  const call = async (type: string, frame?: PixelFrame, extra: Record<string, unknown> = {}) => {
    await ready(); signal.throwIfAborted();
    return new Promise<any>((resolve, reject) => {
      const id = ++serial;
      pending = { id, resolve, reject, timer: setTimeout(() => fail(new Error('Motion analysis timed out. Check your connection or choose a shorter excerpt.')), type === 'initPose' ? 60_000 : 20_000) };
      worker.postMessage({ id, type, frame, ...extra }, frame ? [frame.rgba.buffer] : []);
    });
  };
  let sourceWidth = 0, sourceHeight = 0;
  async function* pixels(frames: number[]): AsyncGenerator<{ frame: number; pixels: PixelFrame }> {
    for await (const sample of readVideoFrames(clip.file, index, { length: frames.length, at: i => frames[i] }, signal)) {
      try {
        await ready(); signal.throwIfAborted(); sourceWidth = sample.width; sourceHeight = sample.height;
        const scale = Math.min(1, (job.kind === 'track' ? 1280 : 640) / Math.max(sample.width, sample.height));
        const width = Math.max(1, Math.round(sample.width * scale)), height = Math.max(1, Math.round(sample.height * scale));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        sample.draw(context, 0, 0, width, height);
        yield { frame: sample.frame, pixels: { width, height, rgba: context.getImageData(0, 0, width, height).data } };
      } finally { sample.close(); }
    }
  }
  const sequence = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  try {
    signal.throwIfAborted();
    if (job.kind === 'pose') {
      progress({ progress: 0, message: 'Loading pose model…' }); await call('initPose');
      const frames: number[] = []; let last = -Infinity;
      for (let f = range.start; f <= range.end; f++) if (clip.motion?.pose.quality === 'full' || index.timestamps[f] - last >= 1 / 15 - 1e-6 || f === range.end || f === clip.contact) { frames.push(f); last = index.timestamps[f]; }
      let result: MotionSeries | undefined, done = 0;
      for await (const item of pixels(frames)) {
        result ??= emptySeries(range.start, range.end, 17, sourceWidth, sourceHeight, 'MoveNet Lightning v4 / WASM');
        const values = await call('pose', item.pixels, { region: clip.motion?.pose.region }) as Float32Array;
        for (let p = 0; p < 17; p++) if (values[p * 3 + 2] >= .25) putSample(result, item.frame, p, values[p * 3], values[p * 3 + 1], values[p * 3 + 2]);
        progress({ progress: .15 + .85 * ++done / frames.length, message: 'Analyzing pose…' });
      }
      if (!result) throw new Error('No readable video frames.');
      if (clip.motion?.pose.quality !== 'full') fillDraft(result, frames, index);
      return result;
    }
    const anchors = job.track.anchors.filter(a => a.frame >= range.start && a.frame <= range.end).sort((a, b) => a.frame - b.frame);
    if (!anchors.length) throw new Error('Place a tracking anchor inside the selected excerpt.');
    let result: MotionSeries | undefined, done = 0;
    for (let i = 0; i < anchors.length; i++) {
      const anchor = anchors[i], end = (anchors[i + 1]?.frame ?? range.end + 1) - 1;
      for await (const item of pixels(sequence(anchor.frame, end))) {
        result ??= emptySeries(range.start, range.end, 1, sourceWidth, sourceHeight, 'LK + normalized template');
        const point = await call('track', item.pixels, { anchor: item.frame === anchor.frame ? anchor : undefined });
        if (!point) break;
        putSample(result, item.frame, 0, point.x, point.y, point.confidence, item.frame === anchor.frame ? MANUAL : 1);
        progress({ progress: Math.min(.98, ++done / ((range.end - range.start + 1) * 2)), message: 'Tracking motion…' });
      }
      // Backward review uses small forward-decoded batches, never the entire clip.
      const start = (anchors[i - 1]?.frame ?? range.start - 1) + 1;
      let lost = false;
      for (let end = anchor.frame; end >= start && !lost; end -= 4) {
        const batch: { frame: number; pixels: PixelFrame }[] = [];
        for await (const item of pixels(sequence(Math.max(start, end - 3), end))) batch.push(item);
        for (const item of batch.reverse()) {
          const point = await call('track', item.pixels, { anchor: item.frame === anchor.frame ? anchor : undefined });
          if (!point) { lost = true; break; }
          if (!result!.states[item.frame - result!.start] || item.frame === anchor.frame) putSample(result!, item.frame, 0, point.x, point.y, point.confidence, item.frame === anchor.frame ? MANUAL : 1);
          progress({ progress: Math.min(.98, ++done / ((range.end - range.start + 1) * 2)), message: 'Tracking motion…' });
        }
      }
    }
    return result!;
  } finally { signal.removeEventListener('abort', abort); abort(); canvas.width = canvas.height = 0; }
}
