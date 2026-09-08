export type AudioCaptureLease = { stream: MediaStream; release: () => void };
export type CaptureSnapshot = Readonly<{
  available: boolean;
  rendering: boolean;
  includeAudio: boolean;
  state: 'idle' | 'starting' | 'capturing' | 'error';
  stream: MediaStream | null;
  muted: boolean;
  error: string | null;
}>;

/** Owns tracks independently of route, dialog, video-element and renderer settings. */
export class CourtCapture {
  private canvas: HTMLCanvasElement | null = null;
  private audio: AudioCaptureLease | null = null;
  private pendingStream: MediaStream | null = null;
  private generation = 0;
  private listeners = new Set<() => void>();
  private snapshot: CaptureSnapshot = { available: false, rendering: false, includeAudio: false, state: 'idle', stream: null, muted: false, error: null };

  constructor(private acquireAudio: () => Promise<AudioCaptureLease>) {}

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(patch: Partial<CaptureSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  setRendering = (rendering: boolean) => {
    if (this.snapshot.rendering !== rendering) this.update({ rendering });
  };

  setSource = (canvas: HTMLCanvasElement | null) => {
    if (canvas === this.canvas) return;
    this.stop();
    this.canvas?.removeEventListener('webglcontextlost', this.contextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.contextRestored);
    this.canvas = canvas;
    canvas?.addEventListener('webglcontextlost', this.contextLost);
    canvas?.addEventListener('webglcontextrestored', this.contextRestored);
    this.update({ available: typeof canvas?.captureStream === 'function' });
  };
  private contextLost = () => {
    this.stop();
    this.update({ available: false, state: 'error', error: 'The court renderer was interrupted. Wait for it to recover, then start capture again.' });
  };
  private contextRestored = () => this.update({ available: typeof this.canvas?.captureStream === 'function' });
  private ended = () => {
    this.stop();
    this.update({ state: 'error', error: 'The browser ended court capture. Start capture again to continue.' });
  };
  private muted = () => this.update({ muted: this.snapshot.stream?.getTracks().some(track => track.muted) ?? false });

  start = async (includeAudio = true): Promise<void> => {
    if (this.snapshot.state === 'starting' || this.snapshot.state === 'capturing') return;
    if (!this.snapshot.available || !this.canvas) {
      this.update({ state: 'error', error: 'Live court capture is unavailable in this browser or the court is not ready.' });
      return;
    }
    const generation = ++this.generation;
    this.update({ state: 'starting', error: null, muted: false, includeAudio });
    try {
      // Browser-owned capture of the existing drawing buffer; no screenshots or second renderer.
      const stream = this.canvas.captureStream(30);
      this.pendingStream = stream;
      if (!stream.getVideoTracks().some(track => track.readyState === 'live')) throw new Error('No live video track');
      if (includeAudio) {
        const audio = await this.acquireAudio();
        if (generation !== this.generation) { audio.release(); return; }
        this.audio = audio;
        audio.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
      if (stream.getTracks().some(track => track.readyState !== 'live')) throw new Error('Capture was interrupted');
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', this.ended);
        track.addEventListener('mute', this.muted);
        track.addEventListener('unmute', this.muted);
      });
      this.pendingStream = null;
      this.update({ state: 'capturing', stream, muted: stream.getTracks().some(track => track.muted) });
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      this.update({ state: 'error', error: includeAudio
        ? 'Capture could not start. Try again, or turn off practice audio. Keep this page in the foreground.'
        : 'Capture could not start. Keep this page in the foreground and check that the court is rendering.' });
    }
  };

  stop = () => {
    ++this.generation;
    for (const stream of [this.pendingStream, this.snapshot.stream]) {
      stream?.getTracks().forEach(track => {
        track.removeEventListener('ended', this.ended);
        track.removeEventListener('mute', this.muted);
        track.removeEventListener('unmute', this.muted);
        track.stop();
      });
    }
    this.pendingStream = null;
    this.audio?.release();
    this.audio = null;
    this.update({ state: 'idle', stream: null, muted: false, error: null, includeAudio: false });
  };
}

/** Cap the source drawing buffer at 720p in either orientation, preserving its aspect. */
export function capturePixelRatio(width: number, height: number, preferred: number, capturing: boolean): number {
  if (!capturing || width <= 0 || height <= 0) return preferred;
  return Math.min(preferred, 1280 / Math.max(width, height), 720 / Math.min(width, height));
}
