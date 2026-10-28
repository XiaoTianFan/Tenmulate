import { clamp, comparisonRange, frameAt, frameSeekTime, mediaTime, type AlignedClip } from './timeline';

/** The small media surface used by playback, also usable with deterministic test players. */
export type ComparisonVideo = Pick<HTMLVideoElement, 'currentTime' | 'playbackRate' | 'paused' | 'seeking' | 'readyState' | 'play' | 'pause'>;
export type PlaybackFollower = { clip: AlignedClip; video: ComparisonVideo };
type Follower = PlaybackFollower & {
  prepared: boolean; pending: boolean; stepped: boolean; baseRate: number;
  lastSeek: number; lastAdjustment: number; stalledSince: number | null;
};
const owners = new WeakMap<ComparisonVideo, object>();
const SEEK_COOLDOWN_MS = 1500;
const ADJUSTMENT_INTERVAL_MS = 250;

/** Manual navigation deliberately seeks inside an indexed frame, even for VFR clips. */
export function seekVideoFrame(video: ComparisonVideo, clip: AlignedClip['index'], frame: number): void {
  video.pause();
  if (video.readyState < 1) return;
  const target = frameSeekTime(clip, frame);
  if (Math.abs(video.currentTime - target) > 0.0001) video.currentTime = target;
}

/** Continuous comparison time is independent of React renders and native decode cadence.
 * Players seek once at startup, then run natively with small bounded rate corrections.
 * A recovering follower never freezes or rewinds the shared clock.
 */
export class ComparisonPlayback {
  private readonly followers: Follower[];
  private readonly range: { start: number; end: number };
  private anchorTime: number;
  private anchorWall: number;
  private rate: number;
  private started = false;
  private stopped = false;

  constructor(followers: PlaybackFollower[], time: number, rate: number, now: number, private readonly onError: (message: string) => void) {
    this.followers = followers.map(item => ({ ...item, prepared: false, pending: false, stepped: false,
      baseRate: NaN, lastSeek: -Infinity, lastAdjustment: -Infinity, stalledSince: null }));
    this.range = comparisonRange(followers.map(item => item.clip));
    this.anchorTime = clamp(time, this.range.start, this.range.end);
    this.anchorWall = now;
    this.rate = rate;
    for (const { video } of this.followers) { owners.set(video, this); video.pause(); }
  }

  private timeAt(now: number): number {
    return clamp(this.anchorTime + (this.started ? (now - this.anchorWall) / 1000 * this.rate : 0), this.range.start, this.range.end);
  }

  setRate(rate: number, now: number): void {
    if (rate === this.rate) return;
    this.anchorTime = this.timeAt(now);
    this.anchorWall = now;
    this.rate = rate;
  }

  private fail(): void {
    if (this.stopped) return;
    this.dispose();
    this.onError('Playback could not start. Try another video codec.');
  }

  private seek(follower: Follower, time: number, now: number): void {
    follower.video.currentTime = time;
    follower.lastSeek = now;
  }

  private setNativeRate(follower: Follower, rate: number): boolean {
    try {
      if (Math.abs(follower.video.playbackRate - rate) > 0.0001) follower.video.playbackRate = rate;
      return true;
    } catch {
      return false;
    }
  }

  private play(follower: Follower): void {
    const { video } = follower;
    if (!video.paused || follower.pending) return;
    follower.pending = true;
    void video.play().then(() => {
      // A late promise from an old session must not pause a newer playback session.
      if (this.stopped && owners.get(video) === this) video.pause();
    }).catch(error => {
      if (!this.stopped && owners.get(video) === this && error?.name !== 'AbortError') this.fail();
    }).finally(() => { follower.pending = false; });
  }

  tick(now: number): { time: number; buffering: boolean; ended: boolean } {
    const time = this.timeAt(now);
    if (this.stopped) return { time, buffering: false, ended: true };

    if (!this.started) {
      for (const follower of this.followers) {
        const { video, clip } = follower;
        if (follower.prepared || video.readyState < 1) continue;
        const frame = frameAt(clip.index, mediaTime(clip, time));
        const target = frameSeekTime(clip.index, frame);
        if (Math.abs(video.currentTime - target) > 0.002) this.seek(follower, target, now);
        follower.prepared = true;
      }
      if (this.followers.some(({ prepared, video }) => !prepared || video.seeking || video.readyState < 2)) {
        if (now - this.anchorWall > 15_000) this.fail();
        return { time, buffering: !this.stopped, ended: this.stopped };
      }
      this.started = true;
      this.anchorWall = now;
    }

    let buffering = false;
    for (const follower of this.followers) {
      const { video, clip } = follower;
      const target = mediaTime(clip, time);
      const frame = frameAt(clip.index, target);
      const last = clip.index.timestamps.length - 1;
      const moving = target >= clip.index.timestamps[0]! && target < clip.index.timestamps[last]!;
      if (!moving) {
        if (!video.paused) video.pause();
        if (video.readyState >= 1 && !video.seeking && frameAt(clip.index, video.currentTime) !== frame) {
          this.seek(follower, frameSeekTime(clip.index, frame), now);
        }
        follower.stalledSince = null;
        continue;
      }

      const baseRate = clip.speed * this.rate;
      if (follower.baseRate !== baseRate) {
        follower.baseRate = baseRate;
        follower.stepped = !this.setNativeRate(follower, baseRate);
        follower.lastAdjustment = now;
      }
      if (follower.stepped) {
        // Some browsers reject very low effective rates. Present source frames at
        // their scheduled boundaries instead of silently clamping the user's rate.
        if (!video.paused) video.pause();
        if (video.readyState >= 2 && !video.seeking && frameAt(clip.index, video.currentTime) !== frame) {
          this.seek(follower, frameSeekTime(clip.index, frame), now);
        }
        continue;
      }

      if (video.seeking || video.readyState < 3) {
        follower.stalledSince ??= now;
        buffering ||= now - follower.stalledSince > 250;
      } else follower.stalledSince = null;
      // Never pause the other players while a native seek or decode completes.
      if (video.seeking || video.readyState < 2) continue;
      if (now - follower.lastAdjustment >= ADJUSTMENT_INTERVAL_MS && now - follower.lastSeek >= 500) {
        const error = target - video.currentTime;
        const hardDrift = Math.max(0.75 * baseRate, 8 / clip.index.fps);
        if (Math.abs(error) > hardDrift && now - follower.lastSeek >= SEEK_COOLDOWN_MS) {
          // Seek to continuous source time, not the preceding indexed frame.
          this.seek(follower, target, now);
          this.setNativeRate(follower, baseRate);
        } else {
          const tolerance = Math.max(0.06 * baseRate, 2 / clip.index.fps);
          const adjustment = Math.abs(error) > tolerance ? clamp(error / (2 * baseRate), -0.05, 0.05) : 0;
          if (!this.setNativeRate(follower, baseRate * (1 + adjustment))) this.setNativeRate(follower, baseRate);
        }
        follower.lastAdjustment = now;
      }
      if (!video.seeking) this.play(follower);
    }
    const ended = time >= this.range.end;
    if (ended) this.dispose();
    return { time, buffering, ended };
  }

  dispose(): void {
    this.stopped = true;
    for (const { video } of this.followers) if (owners.get(video) === this) video.pause();
  }
}
