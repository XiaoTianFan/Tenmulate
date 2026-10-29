import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewFrames } from '../src/video-comparison/previewFrames';
import { createFrameIndex, frameSeekTime } from '../src/video-comparison/timeline';

const mock = vi.hoisted(() => ({ inputs: [] as any[], samples: [] as any[], track: { canDecode: vi.fn() }, getSample: vi.fn() }));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], BlobSource: class {},
  Input: class { dispose = vi.fn(); constructor() { mock.inputs.push(this); } async getPrimaryVideoTrack() { return mock.track; } },
  VideoSampleSink: class { getSample = mock.getSample; },
}));
const index = createFrameIndex([0,.04,.1,.12,.3].map(timestamp => ({ timestamp, duration: .02 })));
const sample = () => ({ displayWidth: 720, displayHeight: 1280, allocationSize: () => 1024, draw: vi.fn(), close: vi.fn() });

class NativeVideo extends EventTarget {
  videoWidth = 720; videoHeight = 1280; muted = false; playsInline = false; preload = '';
  private time = 0;
  set src(_url: string) { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  get currentTime() { return this.time; }
  set currentTime(time: number) { this.time = time; queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
  pause = vi.fn(); removeAttribute = vi.fn(); load = vi.fn();
}

beforeEach(() => {
  mock.inputs = []; mock.samples = []; mock.track.canDecode.mockReset().mockResolvedValue(true);
  mock.getSample.mockReset().mockImplementation(async () => { const value = sample(); mock.samples.push(value); return value; });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('interactive export frame ownership', () => {
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
    const video = new NativeVideo(), create = vi.fn(() => video);
    vi.stubGlobal('document', { createElement: create });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:native'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const reader = new PreviewFrames(new File([], 'local.mov'), index), context = { drawImage: vi.fn() };
    for (const n of [4,0,2]) {
      const frame = await reader.get(n); frame.draw(context as unknown as CanvasRenderingContext2D,0,0,72,128); frame.close();
      expect(video.currentTime).toBe(frameSeekTime(index, n));
    }
    expect(create).toHaveBeenCalledOnce(); expect(mock.getSample).toHaveBeenCalledOnce();
    expect(mock.inputs[0].dispose).toHaveBeenCalledOnce(); expect(context.drawImage).toHaveBeenCalledTimes(3);
    reader.dispose(); expect(video.load).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:native');
  });
});
