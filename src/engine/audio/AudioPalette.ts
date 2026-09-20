import manifest from '../../content/audio-palette.json';
import { AUDIO_LIMITS, SURFACE_SOUND } from './acoustics';
import { atmospherePcm, bouncePcm, contactPcm } from './synthesis';
import type { SurfaceId } from '../../domain/court';

export type PaletteAsset = keyof typeof manifest.assets;
export type PaletteStatus = 'idle' | 'loading' | 'ready' | 'fallback';

/** One bounded palette shared across venues. Fetches coalesce; reset invalidates late decodes. */
export class AudioPalette {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly pending = new Map<string, Promise<AudioBuffer | null>>();
  private generation = 0;
  private abort = new AbortController();
  private failed = new Set<string>();
  private errors = new Map<string, string>();
  private decodeTail: Promise<void> = Promise.resolve();
  status: PaletteStatus = 'idle';
  constructor(private readonly context: BaseAudioContext, private readonly changed: () => void = () => {}) {}

  private put(id: string, buffer: AudioBuffer) {
    const bytes = buffer.length * buffer.numberOfChannels * 4;
    const previous = this.buffers.get(id);
    const oldBytes = previous ? previous.length * previous.numberOfChannels * 4 : 0;
    // Reserve 4 MiB for transition impulse responses and any browser resampling.
    if (this.decodedBytes - oldBytes + bytes > AUDIO_LIMITS.decodedBytes - 4 * 1024 * 1024) throw new Error('Audio memory budget exceeded');
    this.buffers.set(id, buffer);
    return buffer;
  }

  private pcm(id: string, samples: () => Float32Array) {
    const existing = this.buffers.get(id);
    if (existing) return existing;
    const data = samples();
    const buffer = this.context.createBuffer(1, data.length, this.context.sampleRate);
    buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    return this.put(id, buffer);
  }

  get(id: PaletteAsset): AudioBuffer | undefined { return this.buffers.get(id); }

  private async response(id: PaletteAsset, signal: AbortSignal): Promise<Response> {
    if (!id.startsWith('contact-')) return fetch(manifest.assets[id].url, { signal });
    // A lazy application chunk carries exact WAV bytes. No media URL is requested.
    const bank = (await import('../../content/contact-bank.json')).default;
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const encoded = bank[id as keyof typeof bank];
    if (!encoded) throw new Error(`Missing embedded contact: ${id}`);
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    return new Response(bytes, { headers: { 'content-type': 'audio/wav' } });
  }

  load(id: PaletteAsset): Promise<AudioBuffer | null> {
    const existing = this.get(id);
    if (existing) return Promise.resolve(existing);
    const pending = this.pending.get(id);
    if (pending) return pending;
    const generation = this.generation;
    const asset = manifest.assets[id];
    const controller = new AbortController();
    const abort = () => controller.abort();
    const lifetime = this.abort.signal;
    lifetime.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 8000);
    this.status = 'loading'; this.changed();
    let cancelResponse: (() => void) | undefined;
    const request = (async () => {
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          cancelResponse = () => reject(new DOMException('Aborted', 'AbortError'));
          controller.signal.addEventListener('abort', cancelResponse, { once: true });
        });
        const response = await Promise.race([this.response(id, controller.signal), cancelled]);
        if (!response.ok) throw new Error(`Audio ${response.status}: ${id}`);
        const data = await response.arrayBuffer();
        if (data.byteLength !== asset.bytes) throw new Error(`Invalid audio payload: ${id} (${data.byteLength}/${asset.bytes}, ${response.headers.get('content-type')})`);
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join('');
        if (hash !== asset.sha256) throw new Error(`Audio integrity failed: ${id}`);
        const before = this.decodeTail;
        let release!: () => void;
        this.decodeTail = new Promise<void>(resolve => { release = resolve; });
        let buffer: AudioBuffer;
        try {
          await before;
          if (generation !== this.generation) return null;
          buffer = await this.context.decodeAudioData(data);
        } finally { release(); }
        if (generation !== this.generation) return null;
        this.failed.delete(id);
        this.errors.delete(id);
        return this.put(id, buffer);
      } catch (error) {
        if (generation === this.generation) {
          this.failed.add(id);
          this.errors.set(id, error instanceof Error ? error.message : String(error));
        }
        return null;
      } finally {
        if (cancelResponse) controller.signal.removeEventListener('abort', cancelResponse);
        clearTimeout(timeout); lifetime.removeEventListener('abort', abort);
        if (generation === this.generation) {
          this.pending.delete(id);
          this.status = this.failed.size ? 'fallback' : this.pending.size ? 'loading' : 'ready';
          this.changed();
        }
      }
    })();
    this.pending.set(id, request);
    return request;
  }

  async prepare(surface: SurfaceId, crowd: boolean) {
    const keys: PaletteAsset[] = [...Array.from({ length: 12 }, (_, i) => `contact-${i}` as PaletteAsset),
      ...[0, 1, 2].map(i => `bounce-${surface}-${i}` as PaletteAsset)];
    if (crowd) keys.push('murmur', 'cheer-0', 'cheer-1');
    await Promise.all(keys.map(key => this.load(key)));
  }

  contactSource(variant: number): PaletteAsset | 'procedural' {
    const preferred = `contact-${variant}` as PaletteAsset;
    if (this.get(preferred)) return preferred;
    // Partial loading retains recorded contact instead of unnecessarily using tones.
    const group = Math.floor(variant / 4) * 4;
    const candidates = [...Array.from({ length: 4 }, (_, i) => group + i), ...Array.from({ length: 12 }, (_, i) => i)];
    return candidates.map(i => `contact-${i}` as PaletteAsset).find(id => this.get(id)) ?? 'procedural';
  }

  contact(variant: number) {
    const source = this.contactSource(variant);
    return source === 'procedural' ? this.pcm(`fallback-contact-${variant % 4}`, () => contactPcm(this.context.sampleRate, 157 + variant % 4)) : this.get(source)!;
  }

  bounce(surface: SurfaceId, variant: number) {
    const profile = SURFACE_SOUND[surface];
    return this.get(`bounce-${surface}-${variant}` as PaletteAsset)
      ?? this.pcm(`fallback-${surface}-${variant}`, () => bouncePcm(this.context.sampleRate,
        profile.frequency * (1 + (variant - 1) * .025), profile.decay, profile.grit, 812 + variant));
  }

  atmosphere(kind: 'room' | 'wind' | 'rain') {
    return this.pcm(`atmosphere-${kind}`, () => atmospherePcm(this.context.sampleRate, kind, 437));
  }

  training(kind: 'countdown' | 'footwork' | 'complete') {
    return this.pcm(`training-${kind}`, () => {
      const rate = this.context.sampleRate, duration = kind === 'complete' ? .28 : .1;
      const samples = new Float32Array(Math.ceil(rate * duration));
      const frequency = kind === 'countdown' ? 520 : kind === 'complete' ? 920 : 430;
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate;
        samples[i] = .35 * Math.sin(2 * Math.PI * frequency * t) * Math.min(1, t / .004)
          * Math.exp(-t * 30) * Math.min(1, (duration - t) / .012);
      }
      return samples;
    });
  }

  get decodedBytes() { return [...this.buffers.values()].reduce((sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4, 0); }
  get metrics() { return { decodedBytes: this.decodedBytes, buffers: this.buffers.size, pending: this.pending.size, failed: [...this.failed], errors: Object.fromEntries(this.errors) }; }

  clear() {
    this.generation++; this.abort.abort(); this.abort = new AbortController();
    this.buffers.clear(); this.pending.clear(); this.failed.clear(); this.errors.clear(); this.status = 'idle'; this.changed();
  }
}
