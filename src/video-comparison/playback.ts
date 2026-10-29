import { clamp, comparisonRange, frameForTime, frameSeekTime, type AlignedClip } from './timeline';

export type ComparisonVideo = Pick<HTMLVideoElement, 'currentTime' | 'readyState' | 'pause'>;
export type PlaybackSource = {
  /** Request an indexed frame and predecode its successors, without displaying it. */
  prepare: (frame: number) => boolean;
  present: (frame: number) => void;
  dispose: () => void;
};
export type PlaybackFollower = { clip: AlignedClip; source: PlaybackSource };

/** Manual navigation deliberately seeks inside an indexed frame, even for VFR clips. */
export function seekVideoFrame(video: ComparisonVideo, clip: AlignedClip['index'], frame: number): void {
  video.pause();
  if (video.readyState < 1) return;
  const target = frameSeekTime(clip, frame);
  if (Math.abs(video.currentTime - target) > 0.0001) video.currentTime = target;
}

/** Keep the playback canvas until the native manual seek has a displayable frame.
 * Event completion is authoritative: privacy settings can round currentTime.
 */
export function showManualFrame(video: ComparisonVideo & Pick<HTMLVideoElement, 'seeking' | 'addEventListener' | 'removeEventListener'>,
  index: AlignedClip['index'], frame: number, canvas?: Pick<HTMLCanvasElement, 'hidden'>): () => void {
  const reveal = () => { if (canvas && !video.seeking && video.readyState >= 2) canvas.hidden = true; };
  video.addEventListener('seeked', reveal);
  video.addEventListener('loadeddata', reveal);
  seekVideoFrame(video, index, frame);
  reveal();
  return () => { video.removeEventListener('seeked', reveal); video.removeEventListener('loadeddata', reveal); };
}

/** One clock selects and presents every clip's actual frame in the same animation
 * callback. No independent media clocks, corrective seeks or rate chasing.
 */
export class ComparisonPlayback {
  private readonly range: { start: number; end: number };
  private time: number;
  private anchorTime: number;
  private anchorWall: number;
  private pendingTime: number | null;
  private waitingSince: number | null;
  private stopped = false;

  constructor(private readonly followers: PlaybackFollower[], time: number, private rate: number,
    now: number, private readonly onError: (message: string) => void) {
    this.range = comparisonRange(followers.map(item => item.clip));
    this.time = this.anchorTime = clamp(time, this.range.start, this.range.end);
    this.pendingTime = this.time;
    this.anchorWall = now;
    this.waitingSince = now;
  }

  private timeAt(now: number): number {
    return clamp(this.anchorTime + (now - this.anchorWall) / 1000 * this.rate, this.range.start, this.range.end);
  }

  setRate(rate: number, now: number): void {
    if (rate === this.rate) return;
    this.anchorTime = this.pendingTime ?? this.timeAt(now);
    this.anchorWall = now;
    this.rate = rate;
  }

  tick(now: number): { time: number; buffering: boolean; ended: boolean } {
    if (this.stopped) return { time: this.time, buffering: false, ended: true };
    let target = this.pendingTime ?? this.timeAt(now);
    // A display refresh can straddle zero, especially at high playback rates.
    // Present every selected contact frame together, even in that case.
    if (this.time < 0 && target >= 0) target = 0;
    const frames = this.followers.map(({ clip }) => frameForTime(clip, target));
    try {
      // Request all clips before checking the barrier so decoders work concurrently.
      const ready = this.followers.map(({ source }, i) => source.prepare(frames[i]!));
      if (ready.some(value => !value)) {
        this.pendingTime = target;
        this.waitingSince ??= now;
        if (now - this.waitingSince > 15_000) throw new Error('Playback could not start. Try another video codec.');
        return { time: this.time, buffering: true, ended: false };
      }
      if (this.pendingTime !== null) {
        // After an underrun, resume here rather than racing to an old wall clock.
        this.anchorTime = target;
        this.anchorWall = now;
        this.pendingTime = null;
      }
      this.waitingSince = null;
      this.followers.forEach(({ source }, i) => source.present(frames[i]!));
      this.time = target;
      const ended = target >= this.range.end;
      if (ended) this.dispose();
      return { time: this.time, buffering: false, ended };
    } catch (error) {
      this.dispose();
      this.onError(error instanceof Error ? error.message : 'Playback could not start. Try another video codec.');
      return { time: this.time, buffering: false, ended: true };
    }
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const { source } of this.followers) source.dispose();
  }
}
