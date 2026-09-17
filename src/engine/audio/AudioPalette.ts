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

  load(id: PaletteAsset): Promise<AudioBuffer | null> {
    const existing = this.get(id);
    if (existing) return Promise.resolve(existing);
    const pending = this.pending.get(id);
    if (pending) return pending;
    const generation = this.generation;
    const asset = manifest.assets[id];
    this.status = 'loading'; this.changed();
    const request = (async () => {
      try {
        const response = await fetch(asset.url, { signal: this.abort.signal });
        if (!response.ok) throw new Error(`Audio ${response.status}: ${id}`);
        const data = await response.arrayBuffer();
        if (data.byteLength !== asset.bytes) throw new Error(`Invalid audio payload: ${id} (${data.byteLength}/${asset.bytes}, ${response.headers.get('content-type')})`);
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join('');
        if (hash !== asset.sha256) throw new Error(`Audio integrity failed: ${id}`);
        const buffer = await this.context.decodeAudioData(data);
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
    const keys: PaletteAsset[] = [0, 1, 2].flatMap(i => [`contact-${i}`, `bounce-${surface}-${i}`] as PaletteAsset[]);
    if (crowd) keys.push('murmur', 'cheer-0', 'cheer-1');
    await Promise.all(keys.map(key => this.load(key)));
  }

  contact(variant: number) {
    return this.get(`contact-${variant}` as PaletteAsset) ?? this.pcm(`fallback-contact-${variant}`, () => contactPcm(this.context.sampleRate, 157 + variant));
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
