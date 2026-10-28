import { describe, expect, it, vi } from 'vitest';
import { FrameBuffer, type BufferedFrame } from '../src/video-comparison/frameBuffer';

const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const sample = (frame: number, bytes = 1024): BufferedFrame => ({ frame, bytes, draw: vi.fn(), close: vi.fn() });

function stream(count = 100, bytes = 1024) {
  const samples: BufferedFrame[] = [];
  async function* iterator() {
    for (let i = 0; i < count; i++) { const next = sample(i, bytes); samples.push(next); yield next; }
  }
  const release = vi.fn(), buffer = new FrameBuffer(iterator(), 0, release);
  return { samples, release, buffer };
}

describe('sequential frame lookahead', () => {
  it('predecodes a bounded window and only paints when the shared scheduler commits', async () => {
    const { buffer, samples } = stream();
    expect(buffer.prepare(0)).toBe(false);
    await flush();
    expect(samples).toHaveLength(12);
    samples.forEach(s => expect(s.draw).not.toHaveBeenCalled());
    expect(buffer.prepare(0)).toBe(true);
    buffer.present(0); buffer.present(0);
    expect(samples[0]!.draw).toHaveBeenCalledOnce();
    expect(buffer.prepare(5)).toBe(true);
    buffer.present(5);
    await flush();
    expect(samples).toHaveLength(17);
    samples.slice(0, 5).forEach(s => expect(s.close).toHaveBeenCalledOnce());
    expect(samples[5]!.draw).toHaveBeenCalledOnce();
    buffer.dispose();
    samples.forEach(s => expect(s.close).toHaveBeenCalledOnce());
  });

  it('bounds retained frame bytes for high-resolution footage', async () => {
    const { buffer, samples } = stream(20, 20 * 1024 * 1024);
    await flush();
    expect(samples).toHaveLength(2); // One in-flight frame may cross the 32 MiB threshold.
    buffer.prepare(1); buffer.present(1);
    await flush();
    expect(samples).toHaveLength(3);
    expect(samples[0]!.close).toHaveBeenCalledOnce();
    buffer.dispose();
  });

  it('continues the same decoder when the display skips ahead, without painting intervening frames', async () => {
    const { buffer, samples } = stream();
    await flush();
    expect(buffer.prepare(30)).toBe(false);
    await flush(); await flush();
    expect(buffer.prepare(30)).toBe(true);
    buffer.present(30);
    expect(samples[30]!.draw).toHaveBeenCalledOnce();
    samples.slice(0, 30).forEach(s => { expect(s.close).toHaveBeenCalledOnce(); expect(s.draw).not.toHaveBeenCalled(); });
    buffer.dispose();
  });

  it('closes an in-flight frame arriving after disposal without touching a newer display', async () => {
    let resolve!: (value: IteratorResult<BufferedFrame>) => void;
    const iterator = { next: () => new Promise<IteratorResult<BufferedFrame>>(done => { resolve = done; }), return: vi.fn(async () => ({ done: true as const, value: undefined })) };
    const release = vi.fn(), buffer = new FrameBuffer(iterator, 0, release);
    buffer.dispose(); buffer.dispose();
    const late = sample(0); resolve({ done: false, value: late });
    await flush();
    expect(late.close).toHaveBeenCalledOnce();
    expect(late.draw).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
    expect(iterator.return).toHaveBeenCalledOnce();
  });

  it('propagates decoder failure and never substitutes a wrong or missing source frame', async () => {
    const { buffer } = stream(1);
    await flush();
    expect(() => buffer.prepare(1)).toThrow('Cannot read this video');
    buffer.dispose();
    const failed = new FrameBuffer({ next: async () => { throw new Error('Codec unavailable'); } }, 0, vi.fn());
    await flush();
    expect(() => failed.prepare(0)).toThrow('Codec unavailable');
    failed.dispose();
  });
});
