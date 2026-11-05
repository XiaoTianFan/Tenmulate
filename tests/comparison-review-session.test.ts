import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewSession, reviewWindow, type ReviewReader } from '../src/video-comparison/reviewSession';
import { ReviewCachePool, snapshotReviewFrame, SCRUB_PIXELS } from '../src/video-comparison/reviewCache';
import { createFrameIndex } from '../src/video-comparison/timeline';
import type { ReviewFrame } from '../src/video-comparison/videoFrames';

const index = createFrameIndex(Array.from({ length: 600 }, (_, frame) => ({ timestamp: frame / 60, duration: 1 / 60 })));
const sessions: ReviewSession[] = [];
const canvases: any[] = [];
function sample(frame: number, width = 1280, height = 720): ReviewFrame {
  return { frame, width, height, bytes: width * height * 4, draw: vi.fn(), close: vi.fn() };
}
function reader() {
  return { get: vi.fn(async (frame: number) => sample(frame)), fill: vi.fn(async (frames: number[], consume: (s: ReviewFrame) => void, _signal: AbortSignal) => {
    for (const frame of frames) { const s = sample(frame); try { consume(s); } finally { s.close(); } }
  }), dispose: vi.fn() } satisfies ReviewReader;
}
function setup(source = reader(), file = new File([], 'stroke.mp4'), pool = new ReviewCachePool()) {
  const present = vi.fn(), pending = vi.fn(), error = vi.fn();
  const session = new ReviewSession({ file, index, pixels: 1280 * 720, reader: () => source, pool, present, pending, error });
  sessions.push(session); session.setActive(true);
  return { session, source, pool, present, pending, error, file };
}
async function tick(ms = 20) { await vi.advanceTimersByTimeAsync(ms); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }) }; canvases.push(canvas); return canvas;
  } });
});
afterEach(() => { sessions.splice(0).forEach(s => s.dispose()); vi.unstubAllGlobals(); vi.useRealTimers(); canvases.length = 0; });

describe('bounded shared navigation pictures', () => {
  it('caps application-owned pixels across clips and reclaims evicted and released canvases', () => {
    const pool = new ReviewCachePool(SCRUB_PIXELS * 4 * 3), a = pool.acquire({}), b = pool.acquire({});
    for (let f = 0; f < 10; f++) (f % 2 ? a : b).put(snapshotReviewFrame(sample(f, 3840, 2160), SCRUB_PIXELS));
    expect(pool.bytes).toBeLessThanOrEqual(pool.limit); expect(a.frames.size + b.frames.size).toBe(3);
    expect(canvases.filter(c => c.width * c.height > 0)).toHaveLength(3);
    a.release(); b.release(); expect(pool.bytes).toBe(0); expect(canvases.every(c => !c.width && !c.height)).toBe(true);
  });
  it('invalidates a lost cached canvas so it can be decoded again instead of presenting black', () => {
    const pool = new ReviewCachePool(), cache = pool.acquire({}); const image = snapshotReviewFrame(sample(1), SCRUB_PIXELS); cache.put(image);
    image.canvas.getContext = vi.fn(() => ({ isContextLost: () => true })) as any;
    expect(cache.has(1)).toBe(false); expect(cache.get(1)).toBeUndefined(); expect(pool.bytes).toBe(0); cache.release();
  });
  it('shares a clip between card and modal without releasing frames while either still owns them', () => {
    const pool = new ReviewCachePool(), key = {}, card = pool.acquire(key), modal = pool.acquire(key);
    const image = snapshotReviewFrame(sample(10), SCRUB_PIXELS); card.put(image);
    expect(modal.get(10)).toBe(image); card.release(); expect(modal.get(10)).toBe(image);
    modal.release(); expect(image.canvas.width).toBe(0); expect(pool.bytes).toBe(0);
  });
  it('bounds lookaround by frame budget rather than decoding the entire clip, and biases the scrub direction', () => {
    const forward = reviewWindow(index, 200, 1, 30), backward = reviewWindow(index, 200, -1, 30);
    expect(forward).toHaveLength(30); expect(backward).toHaveLength(30);
    expect(forward.filter(f => f > 200).length).toBeGreaterThan(forward.filter(f => f < 200).length);
    expect(backward.filter(f => f < 200).length).toBeGreaterThan(backward.filter(f => f > 200).length);
    expect(reviewWindow(index, 0, 1, 48)[0]).toBe(0);
    expect(reviewWindow(index, 599, -1, 48).at(-1)).toBe(599);
  });
});

describe('responsive paused review', () => {
  it('paints cached frames immediately while speculative decoding is blocked, then preempts it for an uncached seek', async () => {
    const source = reader(); let background!: AbortSignal;
    source.fill.mockImplementationOnce(async (_frames, consume, signal) => {
      for (const frame of [1, 2, 3]) consume(sample(frame));
      background = signal;
      await new Promise<void>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    });
    const { session, present, pending } = setup(source);
    session.request(0); await tick(60); expect(background).toBeDefined();
    session.request(2); expect(present.mock.lastCall?.[0].frame).toBe(2); expect(pending.mock.lastCall).toEqual([false]);
    session.request(3); expect(present.mock.lastCall?.[0].frame).toBe(3); expect(source.get).toHaveBeenCalledTimes(1);
    session.request(120); expect(background.aborted).toBe(true); await tick(20);
    expect(source.get.mock.calls.map(c => c[0])).toEqual([0, 120]); expect(present.mock.lastCall?.[0].frame).toBe(120);
  });
  it('promotes the frame already being prefetched instead of canceling and seeking to it again', async () => {
    const source = reader(); let consume!: (sample: ReviewFrame) => void, signal!: AbortSignal, finish!: () => void;
    source.fill.mockImplementationOnce(async (_frames, callback, abort) => { consume = callback; signal = abort; await new Promise<void>(resolve => { finish = resolve; }); });
    const { session, present } = setup(source); session.request(0); await tick(80);
    session.request(1); expect(signal.aborted).toBe(false); consume(sample(1));
    expect(present.mock.lastCall?.[0].frame).toBe(1); expect(source.get).toHaveBeenCalledTimes(1); finish(); await tick();
  });
  it('prepares the nearest reverse frame first with the native decoder', async () => {
    const source = { ...reader(), nativeMode: true }; const { session } = setup(source);
    session.request(300); await tick(80); session.request(250); await tick(80);
    const reverse = source.fill.mock.calls.find(c => c[0][0] === 249); expect(reverse).toBeDefined(); expect(reverse![0][1]).toBe(248);
  });
  it('cache hits bypass a slow foreground seek and its late result cannot overwrite the newer displayed frame', async () => {
    const { session, source, present } = setup();
    session.request(0); await tick(80);
    let finish!: (value: ReviewFrame) => void;
    source.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    session.request(200); await tick(20);
    session.request(4); expect(present.mock.lastCall?.[0].frame).toBe(4);
    const calls = present.mock.calls.length, stale = sample(200); finish(stale); await tick(20);
    expect(stale.close).toHaveBeenCalledOnce(); expect(present.mock.calls).toHaveLength(calls);
    session.request(200); expect(present.mock.lastCall?.[0].frame).toBe(200); expect(source.get).toHaveBeenCalledTimes(2);
  });
  it('coalesces a fast distant drag to its latest target and refines cached frames only after settling', async () => {
    const { session, source, present } = setup();
    for (const f of [100, 240, 400, 10]) session.request(f);
    await tick(80); expect(source.get.mock.calls.map(c => c[0])).toEqual([10]);
    for (const f of [11, 12, 11, 13, 10]) { session.request(f); await tick(20); }
    expect(source.get).toHaveBeenCalledTimes(1); expect(present.mock.lastCall?.[0].frame).toBe(10);
    await tick(200); expect(source.get.mock.calls.map(c => c[0])).toEqual([10, 10]);
    expect(present.mock.lastCall?.[1]).toBe(true);
  });
  it('extends lookahead during a continuous scrub without decoding every requested frame again', async () => {
    const { session, source, present } = setup(); session.request(0); await tick(80);
    for (let frame = 1; frame < 120; frame++) {
      session.request(frame); expect(present.mock.lastCall?.[0].frame).toBe(frame); await tick(20);
    }
    expect(source.get).toHaveBeenCalledTimes(1);
    expect(source.fill.mock.calls.length).toBeGreaterThan(4);
    expect(source.fill.mock.calls.length).toBeLessThan(20);
  });
  it('opens a modal and resumes the card from the same frame cache without a foreground seek', async () => {
    const a = setup(); a.session.request(10); await tick(80); a.session.setActive(false);
    const b = setup(reader(), a.file, a.pool); b.session.request(12);
    expect(b.present.mock.lastCall?.[0].frame).toBe(12); expect(b.source.get).not.toHaveBeenCalled();
    b.session.dispose(); a.session.setActive(true); a.session.request(13);
    expect(a.present.mock.lastCall?.[0].frame).toBe(13); expect(a.source.get).toHaveBeenCalledTimes(1);
  });
  it('silently stops failed optional prefetch while keeping usable frames and permits future seeks', async () => {
    const { session, source, present, error } = setup();
    source.fill.mockRejectedValue(new Error('optional decoder failure'));
    session.request(30); await tick(500); expect(source.fill).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled();
    expect(present.mock.lastCall?.[0].frame).toBe(30);
    session.request(31); await tick(20); expect(present.mock.lastCall?.[0].frame).toBe(31);
  });
  it('retains one clean native retry for an intermittent initial decoder failure', async () => {
    const source = { ...reader(), useNative: vi.fn() }; source.get.mockRejectedValueOnce(new Error('decoder startup'));
    const { session, present, error } = setup(source); session.request(0); await tick();
    expect(source.useNative).toHaveBeenCalledOnce(); expect(present.mock.lastCall?.[0].frame).toBe(0); expect(error).not.toHaveBeenCalled();
  });
  it('does not turn cache eviction into an unrequested foreground decode of the visible frame', async () => {
    const { session, source, pool } = setup(); session.request(0); await tick();
    const other = pool.acquire({}); for (let f = 0; f < 48; f++) other.put(snapshotReviewFrame(sample(f), SCRUB_PIXELS));
    await tick(100); expect(source.get).toHaveBeenCalledTimes(1); other.release();
  });
  it('reports an uncached-frame failure but cached review remains available', async () => {
    const { session, source, present, error } = setup(); session.request(0); await tick(80);
    source.get.mockRejectedValueOnce(new Error('cannot decode target'));
    session.request(300); await tick(100); expect(error).toHaveBeenCalledWith('cannot decode target');
    session.request(2); expect(present.mock.lastCall?.[0].frame).toBe(2);
  });
  it('disposes a late sample without painting or repopulating a removed clip cache', async () => {
    const { session, source, present, pool } = setup(); let finish!: (value: ReviewFrame) => void;
    source.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    session.request(5); await tick(); session.dispose(); const late = sample(5); finish(late); await tick();
    expect(late.close).toHaveBeenCalledOnce(); expect(present).not.toHaveBeenCalled(); expect(pool.bytes).toBe(0);
    expect(source.dispose).toHaveBeenCalledOnce();
  });
  it('releases the high-resolution snapshot after its synchronous consumer has painted it', async () => {
    const { session, present } = setup(); session.request(2); await tick();
    const image = present.mock.lastCall?.[0]; expect(image.width).toBe(1280); expect(image.canvas.width).toBe(0);
    expect(canvases.filter(c => c.width * c.height > SCRUB_PIXELS)).toHaveLength(0);
  });
});
