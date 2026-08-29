export type CueSound = 'countdown' | 'contact' | 'bounce' | 'footwork' | 'complete';

export class AudioCueEngine {
  private context: AudioContext | null = null;
  private ambience: { oscillator: OscillatorNode; gain: GainNode } | null = null;

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
  }

  play(sound: CueSound, volume: number): void {
    if (!this.context || volume <= 0) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequencies: Record<CueSound, number> = {
      countdown: 520,
      contact: 760,
      bounce: 240,
      footwork: 430,
      complete: 920,
    };
    oscillator.frequency.setValueAtTime(frequencies[sound], now);
    oscillator.type = sound === 'bounce' || sound === 'footwork' ? 'triangle' : 'sine';
    gain.gain.setValueAtTime(Math.min(0.12, volume * 0.12), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (sound === 'complete' ? 0.32 : 0.12));
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + (sound === 'complete' ? 0.34 : 0.14));
  }

  setAmbience(volume: number): void {
    if (!this.context) return;
    if (!this.ambience && volume > 0) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(74, this.context.currentTime);
      gain.gain.setValueAtTime(0.0001, this.context.currentTime);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start();
      this.ambience = { oscillator, gain };
    }
    this.ambience?.gain.gain.setTargetAtTime(Math.min(0.018, Math.max(0.0001, volume * 0.018)), this.context.currentTime, 0.08);
  }

  dispose(): void {
    this.ambience?.oscillator.stop();
    this.ambience = null;
    void this.context?.close();
    this.context = null;
  }
}

// Shared so setup can unlock the audio context inside the user's Start action
// before the rehearsal route begins its automatic countdown.
export const practiceAudio = new AudioCueEngine();
