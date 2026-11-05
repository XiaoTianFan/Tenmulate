import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewFrames } from '../src/video-comparison/previewFrames';
import { createFrameIndex, frameSeekTime } from '../src/video-comparison/timeline';

const mock = vi.hoisted(() => ({ inputs: [] as any[], samples: [] as any[], track: { canDecode: vi.fn() }, getSample: vi.fn(), batch: vi.fn() }));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], BlobSource: class {},
  Input: class { dispose = vi.fn(); constructor() { mock.inputs.push(this); } async getPrimaryVideoTrack() { return mock.track; } },
  VideoSampleSink: class { getSample = mock.getSample; samplesAtTimestamps = mock.batch; },
}));
const index = createFrameIndex([0,.04,.1,.12,.3].map(timestamp => ({ timestamp, duration: .02 })));
const sample = () => ({ displayWidth: 720, displayHeight: 1280, allocationSize: () => 1024, draw: vi.fn(), close: vi.fn() });

class NativeVideo extends EventTarget {
  videoWidth = 720; videoHeight = 1280; muted = false; playsInline = false; preload = ''; readyState = 4; seeking = false;
  style = {}; setAttribute = vi.fn(); remove = vi.fn(); play = vi.fn(async () => {});
  private time = 0;
  set src(_url: string) { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  get currentTime() { return this.time; }
  set currentTime(time: number) { this.time = time; queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
  pause = vi.fn(); removeAttribute = vi.fn(); load = vi.fn();
}

beforeEach(() => {
  mock.batch.mockReset().mockImplementation(async function* (times: number[]) {
    for (const _time of times) { const value = sample(); mock.samples.push(value); yield value; }
  });
  mock.inputs = []; mock.samples = []; mock.track.canDecode.mockReset().mockResolvedValue(true);
  mock.getSample.mockReset().mockImplementation(async () => { const value = sample(); mock.samples.push(value); return value; });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('interactive export frame ownership', () => {
  it('prepares nearby frames as one ascending decode batch and closes hardware samples after each snapshot', async () => {
    const reader = new PreviewFrames(new File([], 'local.mp4'), index), consume = vi.fn();
    await reader.fill([0, 1, 2, 3], consume, new AbortController().signal);
    expect(mock.batch).toHaveBeenCalledWith([0, 1, 2, 3].map(frame => frameSeekTime(index, frame)));
    expect(mock.getSample).not.toHaveBeenCalled(); expect(consume.mock.calls.map(c => c[0].frame)).toEqual([0, 1, 2, 3]);
    mock.samples.forEach(value => expect(value.close).toHaveBeenCalledOnce()); reader.dispose();
  });
  it('preempts a hung speculative batch for a foreground seek and closes its late sample', async () => {
    let finish!: (value: any) => void;
    mock.batch.mockReturnValueOnce({ next: () => new Promise(resolve => { finish = resolve; }), return: vi.fn(async () => ({ done: true })) });
    const reader = new PreviewFrames(new File([], 'local.mp4'), index);
    const background = reader.fill([0, 1, 2], vi.fn(), new AbortController().signal);
    const rejected = expect(background).rejects.toMatchObject({ name: 'AbortError' });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    const visible = reader.get(4, -10); await rejected; (await visible).close();
    const late = sample(); finish({ value: late, done: false }); await Promise.resolve();
    expect(late.close).toHaveBeenCalledOnce(); expect(mock.inputs[0].dispose).toHaveBeenCalledOnce(); reader.dispose();
  });
  it('evicts cold readers and releases all container caches after idle', async () => {
    vi.useFakeTimers();
    const readers = Array.from({ length: 9 }, () => new PreviewFrames(new File([], 'large.mp4'), index));
    try {
      for (const reader of readers) { const frame = await reader.get(0); frame.close(); }
      expect(mock.inputs).toHaveLength(9);
      expect(mock.inputs.filter(input => !input.dispose.mock.calls.length)).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1500);
      expect(mock.inputs.every(input => input.dispose.mock.calls.length === 1)).toBe(true);
      const frame = await readers[0]!.get(1); frame.close();
      expect(mock.inputs).toHaveLength(10);
    } finally { readers.forEach(reader => reader.dispose()); vi.useRealTimers(); }
  });

  it('does not start a queued reader after its card has been removed', async () => {
    let finish!: (value: any) => void;
    mock.getSample.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const first = new PreviewFrames(new File([], 'first.mp4'), index), removed = new PreviewFrames(new File([], 'removed.mp4'), index);
    const pending = first.get(1), canceled = removed.get(2);
    removed.dispose(); await expect(canceled).rejects.toMatchObject({ name: 'AbortError' });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    finish(sample()); (await pending).close(); first.dispose();
    expect(mock.inputs).toHaveLength(1);
  });
  it('falls back when WebCodecs hangs and closes a late result', async () => {
    vi.useFakeTimers();
    let finish!: (value: any) => void;
    mock.getSample.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const video = new NativeVideo();
    vi.stubGlobal('document', { querySelector: () => null, body: { append: vi.fn() }, createElement: (tag: string) => tag === 'video' ? video
      : { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fallback'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const reader = new PreviewFrames(new File([], 'large.mov'), index, undefined, 100 * 100);
    try {
      const pending = reader.get(2);
      await vi.advanceTimersByTimeAsync(10_001);
      const frame = await pending;
      expect(frame.frame).toBe(2); expect(frame.width).toBe(720); expect(frame.height).toBe(1280);
      expect(frame.bytes).toBeLessThanOrEqual(100 * 100 * 4); frame.close();
      expect(mock.inputs[0].dispose).toHaveBeenCalledOnce();
      const late = sample(); finish(late); await Promise.resolve();
      expect(late.close).toHaveBeenCalledOnce();
    } finally { reader.dispose(); vi.useRealTimers(); }
  });

  it('reuses a decoder for backward and forward scrubs and transfers sample ownership to the compositor', async () => {
    const reader = new PreviewFrames(new File([], 'local.mp4'), index);
    for (const n of [3,1,4,2]) { const frame = await reader.get(n); expect(frame.frame).toBe(n); frame.close(); }
    expect(mock.inputs).toHaveLength(1);
    expect(mock.getSample.mock.calls.map(call => call[0])).toEqual([3,1,4,2].map(n => frameSeekTime(index, n)));
    mock.samples.forEach(value => expect(value.close).toHaveBeenCalledOnce());
    reader.dispose(); expect(mock.inputs[0].dispose).toHaveBeenCalledOnce();
  });
  it('disposes late decoded frames when the modal closes during a seek', async () => {
    let resolve!: (value: any) => void;
    const pending = new Promise(done => { resolve = done; }); mock.getSample.mockReturnValue(pending);
    const reader = new PreviewFrames(new File([], 'local.mp4'), index);
    const request = reader.get(2);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    reader.dispose(); const value = sample(); resolve(value);
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(value.close).toHaveBeenCalledOnce(); expect(mock.inputs[0].dispose).toHaveBeenCalledOnce();
  });
  it('keeps one native video alive after a runtime codec failure, then releases it and its URL', async () => {
    mock.getSample.mockRejectedValue(new Error('Decoder failure'));
    const video = new NativeVideo(), snapshots: any[] = [];
    const create = vi.fn((tag: string) => {
      if (tag === 'video') return video;
      const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) }; snapshots.push(canvas); return canvas;
    });
    vi.stubGlobal('document', { querySelector: () => null, createElement: create, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:native'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const reader = new PreviewFrames(new File([], 'local.mov'), index), context = { drawImage: vi.fn() };
    for (const n of [4,0,2]) {
      const frame = await reader.get(n); frame.draw(context as unknown as CanvasRenderingContext2D,0,0,72,128); frame.close();
      expect(video.currentTime).toBe(frameSeekTime(index, n));
    }
    expect(create.mock.calls.filter(call => call[0] === 'video')).toHaveLength(1); expect(mock.getSample).toHaveBeenCalledOnce();
    snapshots.forEach(canvas => expect(canvas.width * canvas.height).toBe(0));
    expect(mock.inputs[0].dispose).toHaveBeenCalledOnce(); expect(context.drawImage).toHaveBeenCalledTimes(3);
    reader.dispose(); expect(video.load).toHaveBeenCalledTimes(2); expect(video.remove).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:native');
  });
});
