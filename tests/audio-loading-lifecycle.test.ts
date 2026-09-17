import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import manifest from '../src/content/audio-palette.json';
import { AudioPalette } from '../src/engine/audio/AudioPalette';

// Ownership/error-path tests only. No browser, network, or acoustic evidence.
const bytes = readFileSync(`public${manifest.assets['contact-0'].url}`);
const response = () => new Response(bytes, { headers: { 'content-type': 'audio/wav' } });
const buffer = { length: 4800, numberOfChannels: 1 } as AudioBuffer;
const context = (decodeAudioData = vi.fn(async () => buffer)) => ({ decodeAudioData } as unknown as BaseAudioContext);
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('coalesces in-flight loads and reuses decoded data without per-impact fetching', async () => {
  const fetch = vi.fn(async () => response()); vi.stubGlobal('fetch', fetch);
  const decode = vi.fn(async () => buffer), palette = new AudioPalette(context(decode));
  const first = palette.load('contact-0');
  expect(palette.load('contact-0')).toBe(first);
  await first;
  expect(await palette.load('contact-0')).toBe(buffer);
  expect(fetch).toHaveBeenCalledTimes(1); expect(decode).toHaveBeenCalledTimes(1);
  expect(palette.metrics.pending).toBe(0);
});

it('rejects empty intercepted payloads before decoding and recovers on explicit retry', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockImplementation(async () => response());
  vi.stubGlobal('fetch', fetch);
  const decode = vi.fn(async () => buffer), palette = new AudioPalette(context(decode));
  expect(await palette.load('contact-0')).toBeNull();
  expect(palette.status).toBe('fallback'); expect(decode).not.toHaveBeenCalled();
  expect(palette.metrics.errors['contact-0']).toContain('Invalid audio payload');
  expect(await palette.load('contact-0')).toBe(buffer);
  expect(palette.status).toBe('ready'); expect(palette.metrics.failed).toEqual([]);
});

it('rejects same-size corrupted payloads before decoding', async () => {
  const corrupt = Buffer.from(bytes); corrupt[corrupt.length - 1] ^= 1;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(corrupt)));
  const decode = vi.fn(async () => buffer), palette = new AudioPalette(context(decode));
  expect(await palette.load('contact-0')).toBeNull();
  expect(decode).not.toHaveBeenCalled();
  expect(palette.metrics.errors['contact-0']).toContain('integrity failed');
});

it('surfaces decoder rejection and permits a later successful decode', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  const decode = vi.fn().mockRejectedValueOnce(new DOMException('Unsupported codec', 'EncodingError')).mockResolvedValue(buffer);
  const palette = new AudioPalette(context(decode));
  expect(await palette.load('contact-0')).toBeNull();
  expect(palette.status).toBe('fallback'); expect(palette.metrics.errors['contact-0']).toContain('Unsupported codec');
  expect(await palette.load('contact-0')).toBe(buffer);
  expect(palette.status).toBe('ready');
});

it('discards an uncancellable decode that finishes after scene exit', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  let complete!: (value: AudioBuffer) => void;
  const decode = vi.fn(() => new Promise<AudioBuffer>(resolve => { complete = resolve; }));
  const palette = new AudioPalette(context(decode));
  const request = palette.load('contact-0');
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
  palette.clear(); complete(buffer);
  expect(await request).toBeNull();
  expect(palette.metrics).toMatchObject({ buffers: 0, pending: 0, decodedBytes: 0, failed: [] });
  expect(palette.status).toBe('idle');
});

it('aborts stalled requests at eight seconds and clears their pending state', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  })));
  const palette = new AudioPalette(context());
  const request = palette.load('contact-0');
  await vi.advanceTimersByTimeAsync(8000);
  expect(await request).toBeNull();
  expect(palette.metrics.pending).toBe(0); expect(palette.status).toBe('fallback');
  expect(vi.getTimerCount()).toBe(0);
});
