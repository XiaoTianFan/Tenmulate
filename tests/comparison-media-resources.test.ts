import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaQueue, mediaDeadline, REVIEW_PIXELS, reviewSize } from '../src/video-comparison/mediaResources';

afterEach(() => vi.useRealTimers());
describe('bounded media work', () => {
  it('prioritizes review over filmstrips and never runs two random seeks concurrently', async () => {
    const queue = new MediaQueue(), signal = new AbortController().signal, events: string[] = [];
    let finish!: () => void;
    const first = queue.run(signal, () => new Promise<void>(resolve => { finish = resolve; events.push('active'); }));
    const low = queue.run(signal, async () => { events.push('thumbnail'); }, 1);
    const high = queue.run(signal, async () => { events.push('review'); });
    expect(events).toEqual(['active']); finish(); await Promise.all([first, low, high]);
    expect(events).toEqual(['active', 'review', 'thumbnail']);
  });
  it('interrupts preemptible background work before serving an interactive miss', async () => {
    const queue = new MediaQueue(), background = new AbortController(), events: string[] = [];
    const slow = queue.run(background.signal, () => new Promise<void>((_, reject) => {
      events.push('background'); background.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }), 2, () => background.abort());
    const rejected = expect(slow).rejects.toMatchObject({ name: 'AbortError' });
    const foreground = queue.run(new AbortController().signal, async () => { events.push('foreground'); });
    await rejected; await foreground; expect(events).toEqual(['background', 'foreground']);
  });
  it('cancels queued clips without decoding them or blocking subsequent work', async () => {
    const queue = new MediaQueue(), active = new AbortController(), canceled = new AbortController();
    let finish!: () => void;
    const first = queue.run(active.signal, () => new Promise<void>(resolve => { finish = resolve; }));
    const work = vi.fn(async () => {}), pending = queue.run(canceled.signal, work);
    canceled.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    finish(); await first; await queue.run(active.signal, async () => {});
    expect(work).not.toHaveBeenCalled();
  });
  it('times out and reclaims a late hardware frame rather than leaking it', async () => {
    vi.useFakeTimers();
    const sample = { close: vi.fn() };
    let finish!: (value: typeof sample) => void;
    const waiting = mediaDeadline(new Promise<typeof sample>(resolve => { finish = resolve; }), new AbortController().signal, 100, value => value.close());
    const rejected = expect(waiting).rejects.toThrow('decoding stalled');
    await vi.advanceTimersByTimeAsync(100); await rejected;
    finish(sample); await Promise.resolve(); expect(sample.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('wakes a hung decode immediately on removal and closes its late result', async () => {
    vi.useFakeTimers();
    const controller = new AbortController(), close = vi.fn();
    let finish!: (value: number) => void;
    const waiting = mediaDeadline(new Promise<number>(resolve => { finish = resolve; }), controller.signal, 10000, close);
    controller.abort(); await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    finish(1); await Promise.resolve(); expect(close).toHaveBeenCalledWith(1); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([[3840,2160],[2160,3840],[8192,4320],[300,720]])('bounds %s×%s review surfaces without changing aspect ratio', (width, height) => {
    const size = reviewSize(width, height);
    expect(size.width * size.height).toBeLessThanOrEqual(REVIEW_PIXELS);
    expect(size.width).toBeLessThanOrEqual(width); expect(size.height).toBeLessThanOrEqual(height);
    expect(Math.abs(size.width / size.height - width / height)).toBeLessThan(.005);
  });
});
