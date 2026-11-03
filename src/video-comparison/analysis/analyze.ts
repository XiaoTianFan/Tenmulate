import { readVideoFrames } from '../videoFrames';
import { clipFrameRange } from '../timeline';
import type { ComparisonClip } from '../types';
import { emptySeries, putSample, type MotionSeries, type MotionTrack } from './types';
import { trackingBounds, type TrackingPass } from './trajectory';
import { fillDraft } from './series';
import type { PixelFrame } from './tracker';

export type AnalysisRequest = { kind: 'track'; track: MotionTrack } | { kind: 'pose' };
export type AnalysisProgress = { progress: number; message: string };
export async function analyze(clip: ComparisonClip, job: AnalysisRequest, signal: AbortSignal, ready: () => Promise<void>, progress: (value: AnalysisProgress) => void): Promise<MotionSeries> {
  if (!clip.index) throw new Error('Wait for video indexing before analysis.');
  const index = clip.index, excerpt = clipFrameRange({ ...clip, index });
  const bounds = job.kind === 'track' ? trackingBounds(job.track.anchors) : excerpt;
  if (!bounds) throw new Error('Choose a start and end position on two different frames.');
  const range = bounds;
  if (range.start < excerpt.start || range.end > excerpt.end) throw new Error('Tracking endpoints must be inside the selected excerpt.');
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
    const length = range.end - range.start + 1, forward: TrackingPass = Array(length).fill(null), backward: TrackingPass = Array(length).fill(null);
    let done = 0;
    const update = () => progress({ progress: Math.min(.94, .94 * ++done / (2 * (length + anchors.length))), message: 'Tracking from both endpoints…' });
    for (let i = 0; i + 1 < anchors.length; i++) {
      const start = anchors[i], end = anchors[i + 1];
      for await (const item of pixels(sequence(start.frame, end.frame))) {
        forward[item.frame - range.start] = await call('track', item.pixels, { anchor: item.frame === start.frame ? start : undefined, time: index.timestamps[item.frame] });
        update();
      }
      // Retain only four downscaled pictures while decoding the reverse pass.
      // A lost match does not terminate the interval: appearance can reacquire it.
      for (let last = end.frame; last >= start.frame; last -= 4) {
        const batch: { frame: number; pixels: PixelFrame }[] = [];
        for await (const item of pixels(sequence(Math.max(start.frame, last - 3), last))) batch.push(item);
        for (const item of batch.reverse()) {
          backward[item.frame - range.start] = await call('track', item.pixels, { anchor: item.frame === end.frame ? end : undefined, time: index.timestamps[item.frame] });
          update();
        }
      }
    }
    progress({ progress: .95, message: 'Reconstructing continuous trajectory…' });
    return await call('reconstruct', undefined, { index, anchors, forward, backward, width: sourceWidth, height: sourceHeight }) as MotionSeries;
  } finally { signal.removeEventListener('abort', abort); abort(); canvas.width = canvas.height = 0; }
}
