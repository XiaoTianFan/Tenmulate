import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeFrames, waitForMedia } from '../src/video-comparison/nativeVideo';
import { createFrameIndex } from '../src/video-comparison/timeline';

class Video extends EventTarget {
  muted = false; playsInline = false; preload = ''; seeking = false; readyState = 4; videoWidth = 320; videoHeight = 240;
  time = 0; seeks: number[] = []; load = vi.fn(); pause = vi.fn(); removeAttribute = vi.fn();
  get currentTime() { return this.time; }
  set currentTime(value: number) { this.time = value; this.seeks.push(value); this.seeking = true; queueMicrotask(() => { this.seeking = false; this.dispatchEvent(new Event('seeked')); }); }
  set src(_url: string) { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
}
const index = createFrameIndex([0,0.04,0.1,0.12].map(timestamp => ({ timestamp, duration: 0.02 })));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('native compatibility frame decoding', () => {
  it('seeks only requested indexed frames, snapshots them, and releases its isolated player', async () => {
    const video = new Video(), snapshots: { width: number; height: number; getContext: () => any }[] = [];
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:decoder');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('document', { createElement: (tag: string) => {
      if (tag === 'video') return video;
      const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) }; snapshots.push(canvas); return canvas;
    } });
    const order = [0,2,2,3], frames = nativeFrames(new File([], 'example.mov'), index, { length: order.length, at: i => order[i]! }, 0, new AbortController().signal);
    const seen: number[] = [];
    for await (const frame of frames) { seen.push(frame.frame); expect(frame.width).toBe(320); frame.close(); }
    expect(seen).toEqual(order);
    expect(video.seeks).toEqual([0.001,0.101,0.121]);
    snapshots.forEach(canvas => expect(canvas.width * canvas.height).toBe(0));
    expect(video.pause).toHaveBeenCalledOnce(); expect(video.removeAttribute).toHaveBeenCalledWith('src');
    expect(revoke).toHaveBeenCalledWith('blob:decoder');
  });
  it('aborts an outstanding media wait and removes listeners and timers', async () => {
    const video = new Video(), controller = new AbortController();
    const remove = vi.spyOn(video, 'removeEventListener');
    const waiting = waitForMedia(video as unknown as HTMLVideoElement, 'seeked', controller.signal, () => {});
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(remove).toHaveBeenCalledTimes(2);
  });
  it('reports native decode failure when both decoding paths are unavailable', async () => {
    const video = new Video();
    const waiting = waitForMedia(video as unknown as HTMLVideoElement, 'loadeddata', new AbortController().signal, () => { video.dispatchEvent(new Event('error')); });
    await expect(waiting).rejects.toThrow('H.264 MP4');
  });
});
