import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonPlayback } from '../src/video-comparison/playback';
import { decodeVideo } from '../src/video-comparison/decodedVideo';
import { createFrameIndex, frameAt, frameSeekTime, mediaTime } from '../src/video-comparison/timeline';

const mock = vi.hoisted(() => ({ tracks: [] as any[], inputs: [] as any[], calls: [] as number[][], native: vi.fn() }));
vi.mock('../src/video-comparison/nativeVideo', () => ({ nativeFrames: mock.native }));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], BlobSource: class {},
  Input: class {
    track = mock.tracks.shift();
    dispose = vi.fn();
    constructor() { mock.inputs.push(this); }
    getPrimaryVideoTrack = async () => this.track;
  },
  VideoSampleSink: class {
    constructor(private track: any) {}
    async *samplesAtTimestamps(timestamps: Iterable<number>) {
      const calls: number[] = []; mock.calls.push(calls);
      for (const timestamp of timestamps) {
        calls.push(timestamp);
        const frame = frameAt(this.track.index, timestamp);
        if (this.track.failAt === frame) throw new DOMException('Decoder lost', 'EncodingError');
        const sample = { displayWidth: 720, displayHeight: 1280, allocationSize: () => 1024,
          draw: vi.fn((context: any) => { context.picture = frame; }), close: vi.fn() };
        this.track.samples.push(sample);
        yield sample;
      }
    }
  },
}));
const flush = async () => { for (let i = 0; i < 150; i++) await Promise.resolve(); };
const canvas = () => {
  const context = { picture: -1 };
  const element = { width: 300, height: 150, hidden: true, getContext: () => context };
  return { element: element as unknown as HTMLCanvasElement, context };
};
const track = (timestamps: number[]) => ({ index: createFrameIndex(timestamps.map(timestamp => ({ timestamp, duration: 0.02 }))),
  canDecode: async () => true, samples: [] as any[] });

beforeEach(() => { mock.tracks = []; mock.inputs = []; mock.calls = []; mock.native.mockReset(); });

describe('decoded pictures connected to the shared scheduler', () => {
  it('draws contact pictures together, using the same sample interiors as manual navigation', async () => {
    const tracks = [track(Array.from({ length: 120 }, (_, i) => i / 60)), track([0, 0.03, 0.07, 0.1, 0.18, 0.3, 0.31, 0.5, 0.6, 0.9, 1.2])];
    const clips = tracks.map((t, i) => ({ index: t.index, contact: i ? 5 : 30, speed: i ? 0.5 : 1 }));
    const canvases = [canvas(), canvas()];
    mock.tracks.push(...tracks);
    const followers = clips.map((clip, i) => ({ clip, source: decodeVideo(new File([], 'local.mp4'), clip.index,
      frameAt(clip.index, mediaTime(clip, -0.2)), canvases[i]!.element) }));
    const error = vi.fn(), engine = new ComparisonPlayback(followers, -0.2, 1, 0, error);
    await flush();
    engine.tick(0);
    for (let i = 1; i <= 30; i++) {
      await flush();
      const result = engine.tick(i * 10);
      expect(result.buffering).toBe(false);
      canvases.forEach((c, n) => expect(c.context.picture).toBe(frameAt(clips[n]!.index, mediaTime(clips[n]!, result.time))));
      if (i === 20) expect(canvases.map(c => c.context.picture)).toEqual([30, 5]);
    }
    expect(error).not.toHaveBeenCalled();
    canvases.forEach(c => {
      expect(c.element.hidden).toBe(false);
      expect([c.element.width, c.element.height]).toEqual([720, 1280]);
    });
    mock.calls.forEach((calls, i) => calls.forEach(timestamp => expect(timestamp).toBe(frameSeekTime(clips[i]!.index, frameAt(clips[i]!.index, timestamp)))));
    engine.dispose(); await flush();
    mock.inputs.forEach(input => expect(input.dispose).toHaveBeenCalledOnce());
    tracks.flatMap(t => t.samples).forEach(sample => expect(sample.close).toHaveBeenCalledOnce());
  });

  it('falls back to native decoding while retaining the shared contact presentation barrier', async () => {
    const t = track([0, 0.04]); t.canDecode = async () => false; mock.tracks.push(t);
    const closed = vi.fn(), compatibility = vi.fn();
    mock.native.mockImplementation(async function* (_file, _index, requests, first) {
      for (let i = first; i < requests.length; i++) yield { frame: requests.at(i), width: 720, height: 1280, bytes: 1024,
        draw: (context: any) => { context.picture = requests.at(i); }, close: closed };
    });
    const c = canvas(), error = vi.fn();
    const source = decodeVideo(new File([], 'local.mov'), t.index, 0, c.element, compatibility);
    const engine = new ComparisonPlayback([{ clip: { index: t.index, contact: 0, speed: 1 }, source }], 0, 1, 0, error);
    await flush();
    expect(engine.tick(0).ended).toBe(false);
    expect(c.context.picture).toBe(0);
    expect(engine.tick(40).ended).toBe(true);
    expect(c.context.picture).toBe(1);
    expect(error).not.toHaveBeenCalled();
    expect(compatibility).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledTimes(2);
    expect(mock.inputs[0].dispose).toHaveBeenCalledOnce();
  });

  it('does not initialize a decoder or draw after a removed clip finishes loading', async () => {
    let resolve!: (track: any) => void;
    const pending = new Promise(done => { resolve = done; });
    mock.tracks.push(pending);
    const t = track([0, 0.04]), c = canvas();
    const source = decodeVideo(new File([], 'local.mp4'), t.index, 0, c.element);
    source.dispose(); resolve(t); await flush();
    expect(mock.calls).toEqual([]);
    expect(c.element.hidden).toBe(true);
    expect(mock.inputs[0].dispose).toHaveBeenCalledOnce();
  });

  it('continues at the first undelivered frame after a runtime WebCodecs failure', async () => {
    const t = Object.assign(track([0, 0.04, 0.1, 0.12]), { failAt: 2 }); mock.tracks.push(t);
    const compatibility = vi.fn(), closed = vi.fn(), c = canvas(), error = vi.fn();
    mock.native.mockImplementation(async function* (_file, _index, requests, first) {
      for (let i = first; i < requests.length; i++) yield { frame: requests.at(i), width: 720, height: 1280, bytes: 1024,
        draw: (context: any) => { context.picture = requests.at(i); }, close: closed };
    });
    const source = decodeVideo(new File([], 'local.mov'), t.index, 0, c.element, compatibility);
    const engine = new ComparisonPlayback([{ clip: { index: t.index, contact: 2, speed: 1 }, source }], -0.1, 1, 0, error);
    await flush();
    engine.tick(0); expect(c.context.picture).toBe(0);
    engine.tick(100); expect(c.context.picture).toBe(2);
    engine.tick(120); expect(c.context.picture).toBe(3);
    expect(mock.native.mock.calls[0]![3]).toBe(2);
    expect(compatibility).toHaveBeenCalledOnce(); expect(error).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledTimes(2);
    t.samples.forEach(sample => expect(sample.close).toHaveBeenCalledOnce());
  });
});
