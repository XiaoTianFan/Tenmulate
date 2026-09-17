import { ACOUSTICS, AUDIO_LIMITS, type AcousticProfile } from './acoustics';
import { impulsePcm } from './synthesis';
import type { VenueId } from '../../domain/environment';

export type AudioBus = 'contact' | 'bounce' | 'training' | 'ambience' | 'crowd';
type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode;
  bus: AudioBus; loop: boolean; stopping: boolean; disposed: boolean };
type Effect = { convolver: ConvolverNode; gain: GainNode; disposeAt: number; bytes: number };

/** The real Web Audio graph. BaseAudioContext also permits real offline rendering. */
export class SoundscapeGraph {
  readonly output: GainNode;
  private readonly mix: GainNode;
  private readonly impactSend: GainNode;
  private readonly limiter: WaveShaperNode;
  private readonly buses: Record<AudioBus, GainNode>;
  private readonly voices = new Set<Voice>();
  private effects: Effect[] = [];
  private venue: VenueId | null = null;
  private muted = false;
  private active = true;
  private disposed = false;

  constructor(readonly context: BaseAudioContext) {
    this.output = context.createGain();
    this.mix = context.createGain();
    this.impactSend = context.createGain();
    this.limiter = context.createWaveShaper();
    // Bounded soft saturation is downstream of every dry/wet bus and upstream
    // of master mute/capture. Modest levels normally stay in its linear region.
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) curve[i] = .94 * Math.tanh((i / (curve.length - 1) * 2 - 1) / .94);
    this.limiter.curve = curve;
    this.limiter.oversample = '2x';
    this.mix.connect(this.limiter).connect(this.output);
    this.output.gain.value = .85;
    const makeBus = () => { const node = context.createGain(); node.connect(this.mix); return node; };
    this.buses = { contact: makeBus(), bounce: makeBus(), training: makeBus(), ambience: makeBus(), crowd: makeBus() };
    this.buses.contact.connect(this.impactSend);
    this.buses.bounce.connect(this.impactSend);
  }

  private ramp(param: AudioParam, value: number, seconds: number = AUDIO_LIMITS.muteFadeSeconds) {
    const now = this.context.currentTime;
    param.cancelAndHoldAtTime(now);
    param.linearRampToValueAtTime(value, now + seconds);
  }

  setMaster(muted: boolean, active = this.active) {
    this.muted = muted; this.active = active;
    this.ramp(this.output.gain, muted || !active ? 0 : .85);
  }

  setBus(bus: AudioBus, volume: number) {
    this.ramp(this.buses[bus].gain, Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0);
  }

  setVenue(venue: VenueId, force = false) {
    if (this.disposed || (this.venue === venue && !force)) return;
    this.venue = venue;
    this.sweep();
    // Rapid switches must never retain a third convolver, even within a fade.
    while (this.effects.length > 1) this.releaseEffect(this.effects[0]);
    const now = this.context.currentTime;
    for (const effect of this.effects) {
      this.ramp(effect.gain.gain, 0, .06);
      effect.disposeAt = now + .065;
    }
    const profile = ACOUSTICS[venue];
    const effect = this.createEffect(profile);
    effect.gain.gain.value = 0;
    effect.gain.gain.linearRampToValueAtTime(profile.wet, now + .06);
    this.effects.push(effect);
  }

  private createEffect(profile: AcousticProfile): Effect {
    const context = this.context;
    const left = impulsePcm(context.sampleRate, profile, 311);
    const right = impulsePcm(context.sampleRate, profile, 917);
    const buffer = context.createBuffer(2, left.length, context.sampleRate);
    buffer.copyToChannel(left, 0); buffer.copyToChannel(right, 1);
    const convolver = context.createConvolver(), gain = context.createGain();
    convolver.normalize = true;
    convolver.buffer = buffer;
    this.impactSend.connect(convolver).connect(gain).connect(this.mix);
    return { convolver, gain, disposeAt: Infinity, bytes: left.byteLength + right.byteLength };
  }

  private releaseEffect(effect: Effect) {
    this.impactSend.disconnect(effect.convolver);
    effect.convolver.disconnect(); effect.convolver.buffer = null;
    effect.gain.disconnect();
    this.effects = this.effects.filter(value => value !== effect);
  }

  /** Called by the existing playback tick; no graph-owned timers. */
  sweep() {
    for (const effect of [...this.effects]) if (effect.disposeAt <= this.context.currentTime) this.releaseEffect(effect);
  }

  play(buffer: AudioBuffer, bus: AudioBus, options: { gain?: number; rate?: number; pan?: number; loop?: boolean; when?: number } = {}) {
    if (this.disposed || this.muted || !this.active) return null;
    while (this.voices.size >= AUDIO_LIMITS.voices) {
      const voice = [...this.voices].find(voice => !voice.loop) ?? this.voices.values().next().value;
      if (voice) this.releaseVoice(voice); else break;
    }
    const context = this.context;
    const source = context.createBufferSource(), gain = context.createGain(), pan = context.createStereoPanner();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = Math.max(.5, Math.min(2, options.rate ?? 1));
    pan.pan.value = Math.max(-1, Math.min(1, options.pan ?? 0));
    const when = Math.max(context.currentTime, options.when ?? context.currentTime);
    const level = Math.max(0, Math.min(.6, options.gain ?? .25));
    gain.gain.setValueAtTime(source.loop ? 0 : level, when);
    if (source.loop) gain.gain.linearRampToValueAtTime(level, when + .15);
    source.connect(gain).connect(pan).connect(this.buses[bus]);
    const voice: Voice = { source, gain, pan, bus, loop: source.loop, stopping: false, disposed: false };
    this.voices.add(voice);
    source.onended = () => this.releaseVoice(voice);
    source.start(when);
    return { stop: (fade = .04) => this.stopVoice(voice, fade),
      get alive() { return !voice.disposed && !voice.stopping; } };
  }

  private stopVoice(voice: Voice, fade: number) {
    if (voice.disposed || voice.stopping) return;
    voice.stopping = true;
    if (fade <= 0) { this.releaseVoice(voice); return; }
    this.ramp(voice.gain.gain, 0, fade);
    voice.source.stop(this.context.currentTime + fade + .002);
  }

  private releaseVoice(voice: Voice) {
    if (voice.disposed) return;
    voice.disposed = true; voice.source.onended = null;
    try { voice.source.stop(); } catch { /* Already ended. */ }
    voice.source.disconnect(); voice.source.buffer = null;
    voice.gain.disconnect(); voice.pan.disconnect(); this.voices.delete(voice);
  }

  stopBus(bus: AudioBus) {
    for (const voice of this.voices) if (voice.bus === bus) this.stopVoice(voice, .04);
  }

  silence() {
    for (const voice of this.voices) this.stopVoice(voice, .04);
    for (const effect of this.effects) {
      this.ramp(effect.gain.gain, 0);
      effect.disposeAt = this.context.currentTime + .045;
    }
    this.venue = null;
  }

  /** Clears old impacts and reverberant history on seek/pause/exit. */
  reset() {
    for (const voice of [...this.voices]) this.releaseVoice(voice);
    for (const effect of [...this.effects]) this.releaseEffect(effect);
    this.venue = null;
  }

  get metrics() {
    return { voices: this.voices.size, loopingVoices: [...this.voices].filter(voice => voice.loop).length,
      voicesByBus: Object.fromEntries(Object.keys(this.buses).map(bus => [bus, [...this.voices].filter(voice => voice.bus === bus && !voice.stopping).length])),
      convolvers: this.effects.length, impulseBytes: this.effects.reduce((sum, effect) => sum + effect.bytes, 0) };
  }

  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    Object.values(this.buses).forEach(bus => bus.disconnect());
    this.impactSend.disconnect(); this.mix.disconnect(); this.limiter.disconnect(); this.output.disconnect();
  }
}
