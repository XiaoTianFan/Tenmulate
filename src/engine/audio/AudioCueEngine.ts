export type CueSound = 'countdown' | 'contact' | 'bounce' | 'complete';

export class AudioCueEngine {
  private context: AudioContext | null = null;

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
      complete: 920,
    };
    oscillator.frequency.setValueAtTime(frequencies[sound], now);
    oscillator.type = sound === 'bounce' ? 'triangle' : 'sine';
    gain.gain.setValueAtTime(Math.min(0.12, volume * 0.12), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (sound === 'complete' ? 0.32 : 0.12));
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + (sound === 'complete' ? 0.34 : 0.14));
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
  }
}
