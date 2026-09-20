import { ContactSelector } from './contactSelection';
import type { SurfaceId } from '../../domain/court';
import { DEFAULT_ENVIRONMENT, type EnvironmentConfiguration } from '../../domain/environment';
import { audienceGain, cueVariation, environmentalLevels } from './acoustics';
import { AudioPalette } from './AudioPalette';
import { SoundscapeGraph } from './SoundscapeGraph';
import type { SpatialCue } from './spatialCues';

export type CueSound = 'countdown' | 'contact' | 'bounce' | 'footwork' | 'complete';
export type AudioLevels = Readonly<{ countdown: number; contact: number; bounce: number; footwork: number; ambience: number; crowd: number }>;
export const DEFAULT_AUDIO_LEVELS: AudioLevels = Object.freeze({ countdown: 1, contact: 1, bounce: .7, footwork: .6, ambience: .3, crowd: .3 });
export type AudioStatus = 'idle' | 'locked' | 'loading' | 'ready' | 'fallback' | 'unavailable';
export type AudioPlayback = 'countdown' | 'playing' | 'resting' | 'paused' | 'completed' | 'idle';

/** Route-independent context/capture; scene voices and buffers belong to rehearsal. */
export class AudioCueEngine {
  private context: AudioContext | null = null;
  private graph: SoundscapeGraph | null = null;
  private palette: AudioPalette | null = null;
  private environment: EnvironmentConfiguration = DEFAULT_ENVIRONMENT;
  private surface: SurfaceId = 'hard';
  private levels = DEFAULT_AUDIO_LEVELS;
  private enabled = true;
  private audible = false;
  private playback: AudioPlayback = 'idle';
  private status: AudioStatus = 'idle';
  private readonly listeners = new Set<() => void>();
  private loops = new Map<string, NonNullable<ReturnType<SoundscapeGraph['play']>>>();
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private readonly contacts = new ContactSelector();
  private generation = 0;
  private captureLeases = 0;
  private dispatches: { id: string; eventTime: number; clockTime: number; latencyMs: number; source?: string }[] = [];

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.status;
  private publish = () => {
    if (this.context) this.status = this.context.state !== 'running' ? 'locked'
      : this.palette?.status === 'fallback' ? 'fallback' : this.palette?.status === 'loading' ? 'loading' : 'ready';
    this.listeners.forEach(listener => listener());
  };

  unlock(): void { void this.resume(); }
  private async resume() {
    try {
      const context = this.ensureContext();
      await context.resume(); this.publish();
      // Re-apply the current scene after an interrupted context recovers.
      this.graph!.setMaster(!this.enabled, this.audible);
      if (this.audible && this.enabled) this.graph!.setVenue(this.environment.venue);
      if (this.playback !== 'idle') await this.prepare();
    } catch { this.status = this.context ? 'locked' : 'unavailable'; this.listeners.forEach(listener => listener()); }
  }

  private ensureContext() {
    if (this.context) return this.context;
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    this.graph = new SoundscapeGraph(context);
    this.graph.output.connect(context.destination);
    this.graph.setMaster(!this.enabled, this.audible);
    this.palette = new AudioPalette(context, this.publish);
    context.addEventListener('statechange', this.publish);
    return context;
  }

  private clearTimer() { if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer); this.cleanupTimer = null; }
  private async prepare() {
    await this.palette?.prepare(this.surface, this.environment.audience !== 'empty' && this.levels.crowd > 0);
    this.syncLoops();
  }

  configure(environment: EnvironmentConfiguration, surface: SurfaceId, levels: AudioLevels, enabled: boolean) {
    const reload = this.surface !== surface || this.environment.audience !== environment.audience
      || (this.levels.crowd <= 0 && levels.crowd > 0);
    const wasEnabled = this.enabled;
    const becameEmpty = this.environment.audience !== 'empty' && environment.audience === 'empty';
    this.environment = environment; this.surface = surface; this.levels = levels; this.enabled = enabled;
    this.graph?.setMaster(!enabled, this.audible);
    if (!enabled && wasEnabled) { this.graph?.silence(); this.loops.clear(); }
    if (becameEmpty || levels.crowd <= 0) this.graph?.stopBus('crowd');
    if (this.graph && enabled && this.audible) this.graph.setVenue(environment.venue);
    if (reload && this.playback !== 'idle') void this.prepare();
    this.syncLoops();
  }

  private settle(clearBuffers: boolean) {
    this.clearTimer(); this.audible = false;
    this.graph?.setMaster(!this.enabled, false); this.graph?.silence(); this.loops.clear();
    if (clearBuffers) this.palette?.clear();
    const generation = this.generation;
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      if (generation === this.generation) this.graph?.reset();
    }, 70);
  }

  setPlayback(playback: AudioPlayback) {
    if (this.playback === playback) return;
    const previous = this.playback; this.playback = playback;
    this.generation++; this.clearTimer();
    if (playback === 'idle' || playback === 'paused') { this.settle(playback === 'idle'); return; }
    this.audible = true;
    if (!this.context) { this.status = 'locked'; this.listeners.forEach(listener => listener()); return; }
    this.graph!.setMaster(!this.enabled, true); this.graph!.setVenue(this.environment.venue);
    if (previous === 'idle') { this.contacts.reset(); this.dispatches = []; void this.prepare(); }
    if (playback === 'completed') {
      this.stopLoops();
      this.play('complete', this.levels.countdown);
      if (this.enabled && this.environment.audience !== 'empty' && this.levels.crowd > 0) {
        const cheer = this.palette?.get(this.sequence++ % 2 === 0 ? 'cheer-0' : 'cheer-1');
        if (cheer) this.graph!.play(cheer, 'crowd', { gain: .35 * this.levels.crowd * audienceGain(this.environment.audience, false) });
      }
      this.cleanupTimer = setTimeout(() => { this.cleanupTimer = null; this.settle(false); }, 4200);
    } else this.syncLoops();
  }

  private stopLoops() { this.loops.forEach(loop => loop.stop()); this.loops.clear(); }
  private syncLoops() {
    const graph = this.graph, palette = this.palette;
    if (!graph || !palette) return;
    if (!this.enabled || !this.audible || !['countdown', 'playing', 'resting'].includes(this.playback) || this.context?.state !== 'running') { this.stopLoops(); return; }
    const environmental = environmentalLevels(this.environment);
    const crowd = audienceGain(this.environment.audience, this.playback === 'playing') * this.levels.crowd;
    graph.setBus('ambience', this.levels.ambience);
    const wants: [string, number, () => AudioBuffer | undefined, 'ambience' | 'crowd'][] = [
      ['room', this.levels.ambience > 0 ? environmental.room * .13 : 0, () => palette.atmosphere('room'), 'ambience'],
      ['wind', this.levels.ambience > 0 ? environmental.wind * .2 : 0, () => palette.atmosphere('wind'), 'ambience'],
      ['rain', this.levels.ambience > 0 ? environmental.rain * .15 : 0, () => palette.atmosphere('rain'), 'ambience'],
      ['murmur', crowd * .35, () => palette.get('murmur'), 'crowd'],
    ];
    const desired = new Set(wants.filter(([, gain]) => gain > 0).map(([id, gain]) => `${id}:${gain}`));
    for (const [key, voice] of this.loops) if (!desired.has(key) || !voice.alive) { voice.stop(); this.loops.delete(key); }
    for (const [id, gain, buffer, bus] of wants) {
      const key = `${id}:${gain}`;
      if (gain <= 0 || this.loops.has(key)) continue;
      const decoded = buffer();
      if (!decoded) continue;
      const voice = graph.play(decoded, bus, { gain, loop: true });
      if (voice) this.loops.set(key, voice);
    }
  }

  play(sound: CueSound, volume: number): void {
    if (!this.graph || !this.palette || !this.enabled || !this.audible || volume <= 0 || this.context?.state !== 'running') return;
    if (sound === 'contact' || sound === 'bounce') this.playCue({ id: `legacy:${this.sequence++}`, time: 0, kind: sound }, volume, 0);
    else this.graph.play(this.palette.training(sound), 'training', { gain: volume * .22 });
  }

  playCue(cue: SpatialCue, volume: number, seed: number, spatial = { gain: 1, pan: 0 }, clockTime = cue.time) {
    if (!this.graph || !this.palette || !this.enabled || !this.audible || volume <= 0 || this.context?.state !== 'running') return;
    if (cue.kind === 'footwork') { this.play('footwork', volume); return; }
    const variation = cueVariation(cue.id, seed);
    const speed = Math.max(.45, Math.min(1, (cue.speedKmh ?? 85) / 140));
    const contact = cue.kind === 'contact' ? this.contacts.select(cue, seed) : null;
    const source = contact ? this.palette.contactSource(contact.index) : undefined;
    const buffer = cue.kind === 'contact' ? this.palette.contact(contact!.index) : this.palette.bounce(this.surface, variation.variant);
    this.graph.play(buffer, cue.kind, { gain: volume * .42 * (contact?.gain ?? speed) * variation.gain * spatial.gain,
      rate: contact?.rate ?? variation.rate, cutoff: contact?.cutoff, decay: contact?.decay, pan: spatial.pan });
    this.dispatches.push({ id: cue.id, eventTime: cue.time, clockTime, latencyMs: (clockTime - cue.time) * 1000, ...(source ? { source } : {}) });
    if (this.dispatches.length > 512) this.dispatches.shift();
  }

  setAmbience(volume: number) { this.levels = { ...this.levels, ambience: volume }; this.syncLoops(); }
  retry() { this.unlock(); }
  tick() { this.graph?.sweep(); }
  resetTimeline() {
    this.generation++; this.clearTimer(); this.dispatches = [];
    this.graph?.silence(); this.loops.clear(); this.sequence = 0; this.contacts.reset();
    if (this.enabled && this.audible) this.graph?.setVenue(this.environment.venue, true);
    this.syncLoops();
  }

  /** Same post-master mix as the speakers; capture does not own scene lifetime. */
  async capture() {
    const context = this.ensureContext();
    await context.resume(); this.publish();
    if (context.state !== 'running') throw new Error('Practice audio is suspended');
    const output = this.graph!.output, destination = context.createMediaStreamDestination();
    output.connect(destination); this.captureLeases++;
    let released = false;
    return { stream: destination.stream, release: () => {
      if (released) return; released = true; this.captureLeases--;
      try { output.disconnect(destination); } catch { /* Output may already have been disposed. */ }
      destination.stream.getTracks().forEach(track => track.stop());
    } };
  }

  get metrics() { return { ...this.graph?.metrics, ...this.palette?.metrics, status: this.status,
    decodedBytes: (this.palette?.decodedBytes ?? 0) + (this.graph?.metrics.impulseBytes ?? 0),
    activeLoops: this.loops.size, cleanupTimers: this.cleanupTimer !== null ? 1 : 0, captureLeases: this.captureLeases,
    contextState: this.context?.state ?? 'absent', baseLatency: this.context?.baseLatency ?? 0,
    outputLatency: this.context?.outputLatency ?? 0, playback: this.playback, venue: this.environment.venue,
    dispatches: [...this.dispatches] }; }

  dispose() {
    this.generation++; this.clearTimer(); this.stopLoops(); this.palette?.clear(); this.graph?.dispose();
    this.context?.removeEventListener('statechange', this.publish);
    void this.context?.close(); this.context = null; this.graph = null; this.palette = null;
    this.audible = false; this.playback = 'idle'; this.status = 'idle'; this.listeners.forEach(listener => listener());
  }
}

export const practiceAudio = new AudioCueEngine();
