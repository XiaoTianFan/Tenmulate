import { describe, expect, it, vi } from 'vitest';
import { ComparisonPlayback, seekVideoFrame, type ComparisonVideo } from '../src/video-comparison/playback';
import { createFrameIndex, frameAt, frameSeekTime, type AlignedClip } from '../src/video-comparison/timeline';

class Video implements ComparisonVideo {
  time = 0;
  rate = 1;
  paused = true;
  seeking = false;
  readyState = 4;
  seeks: number[] = [];
  playCalls = 0;
  pauseCalls = 0;
  minimumRate = 0;
  playResult = () => Promise.resolve();
  constructor(readonly fps = 30) {}
  // Emulate browsers exposing time rounded to a source-frame boundary.
  get currentTime() { return Math.floor((this.time + 1e-7) * this.fps) / this.fps; }
  set currentTime(time: number) { this.time = time; this.seeks.push(time); this.seeking = true; this.readyState = 1; }
  get playbackRate() { return this.rate; }
  set playbackRate(rate: number) {
    if (rate < this.minimumRate) throw new DOMException('Unsupported rate', 'NotSupportedError');
    this.rate = rate;
  }
  play() { this.playCalls++; this.paused = false; return this.playResult(); }
  pause() { this.pauseCalls++; this.paused = true; }
  advance(seconds: number) { if (!this.paused && !this.seeking && this.readyState >= 3) this.time += seconds * this.rate; }
  settleSeek() { this.seeking = false; this.readyState = 4; }
}
const clip = (fps = 30, speed = 1, contact = 0, seconds = 10): AlignedClip => ({
  index: createFrameIndex(Array.from({ length: Math.ceil(fps * seconds) }, (_, i) => ({ timestamp: i / fps, duration: 1 / fps }))),
  speed, contact,
});

describe('continuous comparison playback', () => {
  it('runs mixed FPS and clip speeds without repeated seeking or group pauses', () => {
    const clips = [clip(29.97, 1, 30), clip(60, 0.5, 120), clip(120, 1.5, 60)];
    const videos = clips.map(c => { const video = new Video(c.index.fps); video.time = c.index.timestamps[c.contact]!; return video; });
    const engine = new ComparisonPlayback(clips.map((c, i) => ({ clip: c, video: videos[i]! })), 0, 1, 0, vi.fn());
    engine.tick(0);
    for (let i = 1; i <= 300; i++) {
      videos.forEach(video => video.advance(1 / 60));
      const result = engine.tick(i * 1000 / 60);
      expect(result.time).toBeCloseTo(i / 60);
      expect(result.buffering).toBe(false);
    }
    videos.forEach((video, i) => {
      expect(video.playbackRate).toBeCloseTo(clips[i]!.speed);
      expect(video.seeks).toHaveLength(0);
      expect(video.playCalls).toBe(1);
      expect(video.pauseCalls).toBe(1); // Initial alignment only.
    });
    engine.dispose();
  });

  it('multiplies global and clip rates and changes global speed without jumping', () => {
    const video = new Video();
    const engine = new ComparisonPlayback([{ clip: clip(30, 0.5), video }], 0, 0.5, 0, vi.fn());
    engine.tick(0);
    expect(video.playbackRate).toBe(0.25);
    video.advance(1);
    engine.setRate(2, 1000);
    expect(engine.tick(1000).time).toBe(0.5);
    expect(video.playbackRate).toBe(1);
    video.advance(1);
    expect(engine.tick(2000).time).toBe(2.5);
    expect(video.seeks).toHaveLength(0);
  });

  it('uses elapsed wall time after a delayed render instead of losing elapsed time', () => {
    const video = new Video();
    const engine = new ComparisonPlayback([{ clip: clip(), video }], 0, 1, 0, vi.fn());
    engine.tick(0);
    video.advance(1.2);
    expect(engine.tick(1200).time).toBe(1.2);
    expect(video.seeks).toHaveLength(0);
  });

  it('waits once for initial alignment before starting the comparison clock', () => {
    const video = new Video();
    const engine = new ComparisonPlayback([{ clip: clip(30, 1, 30), video }], 0, 1, 0, vi.fn());
    expect(engine.tick(0)).toEqual({ time: 0, buffering: true, ended: false });
    expect(engine.tick(100).time).toBe(0);
    expect(video.seeks).toHaveLength(1);
    video.settleSeek();
    expect(engine.tick(200).buffering).toBe(false);
    video.advance(1);
    expect(engine.tick(1200).time).toBe(1);
  });

  it('corrects modest drift with a bounded rate change rather than a seek', () => {
    const video = new Video();
    const engine = new ComparisonPlayback([{ clip: clip(), video }], 0, 1, 0, vi.fn());
    engine.tick(0);
    video.time = 0.1;
    engine.tick(250);
    expect(video.playbackRate).toBe(1.05);
    expect(video.seeks).toHaveLength(0);
    video.time = 0.65;
    engine.tick(500);
    expect(video.playbackRate).toBe(0.95);
    expect(video.seeks).toHaveLength(0);
  });

  it('limits large-drift seeks and never stalls another player while a seek completes', () => {
    const slow = new Video(120), healthy = new Video(30);
    const engine = new ComparisonPlayback([{ clip: clip(120), video: slow }, { clip: clip(), video: healthy }], 0, 1, 0, vi.fn());
    engine.tick(0);
    healthy.advance(1.5);
    engine.tick(1500);
    expect(slow.seeks).toEqual([1.5]);
    for (const now of [1600, 1800, 2100]) {
      healthy.time = now / 1000;
      expect(engine.tick(now).time).toBe(now / 1000);
      expect(healthy.paused).toBe(false);
    }
    expect(slow.seeks).toHaveLength(1);
    slow.settleSeek();
    slow.time = 0;
    healthy.time = 2.2;
    engine.tick(2200);
    expect(slow.seeks).toHaveLength(1); // Cooldown prevents a seek feedback loop.
    expect(healthy.pauseCalls).toBe(1);
  });

  it('converges after a brief decoder lag without repeatedly snapping frames', () => {
    const video = new Video(60);
    const engine = new ComparisonPlayback([{ clip: clip(60), video }], 0, 1, 0, vi.fn());
    engine.tick(0);
    for (let i = 1; i <= 360; i++) {
      video.advance(1 / 60);
      if (i === 60) video.time -= 0.2;
      engine.tick(i * 1000 / 60);
    }
    expect(Math.abs(6 - video.currentTime)).toBeLessThan(0.08);
    expect(video.seeks).toHaveLength(0);
    expect(video.pauseCalls).toBe(1);
  });

  it('keeps the clock and healthy videos running through follower buffering', () => {
    const stalled = new Video(), healthy = new Video();
    const engine = new ComparisonPlayback([{ clip: clip(), video: stalled }, { clip: clip(), video: healthy }], 0, 1, 0, vi.fn());
    engine.tick(0);
    stalled.readyState = 1;
    engine.tick(100);
    healthy.advance(0.5);
    expect(engine.tick(500)).toEqual({ time: 0.5, buffering: true, ended: false });
    expect(healthy.paused).toBe(false);
    stalled.readyState = 4;
    stalled.time = healthy.time = 0.6;
    expect(engine.tick(600).buffering).toBe(false);
  });

  it('holds shorter clips at their edges and stops at the end of the union', () => {
    const short = new Video(), long = new Video();
    const shortClip = clip(30, 1, 15, 1), longClip = clip(30, 1, 30, 3);
    const engine = new ComparisonPlayback([{ clip: shortClip, video: short }, { clip: longClip, video: long }], -1, 1, 0, vi.fn());
    engine.tick(0);
    expect(short.paused).toBe(true);
    expect(long.paused).toBe(false);
    long.advance(1.6);
    engine.tick(1600);
    expect(short.paused).toBe(true);
    expect(frameAt(shortClip.index, short.time)).toBe(29);
    const end = engine.tick(4000);
    expect(end.ended).toBe(true);
    expect(end.time).toBeCloseTo(59 / 30);
    expect(long.paused).toBe(true);
  });

  it('uses scheduled frames when a browser rejects an extremely low combined rate', () => {
    const video = new Video(); video.minimumRate = 0.0625;
    const engine = new ComparisonPlayback([{ clip: clip(30, 0.1), video }], 0, 0.25, 0, vi.fn());
    engine.tick(0);
    expect(video.paused).toBe(true);
    expect(engine.tick(2000).time).toBe(0.5);
    expect(video.seeks).toEqual([frameSeekTime(clip().index, 1)]);
    engine.tick(2100);
    expect(video.seeks).toHaveLength(1);
  });

  it('does not let an old play promise pause a newer session', async () => {
    const video = new Video();
    let resolve!: () => void;
    video.playResult = () => new Promise<void>(done => { resolve = done; });
    const first = new ComparisonPlayback([{ clip: clip(), video }], 0, 1, 0, vi.fn());
    first.tick(0);
    const resolveFirst = resolve;
    first.dispose();
    const second = new ComparisonPlayback([{ clip: clip(), video }], 0, 1, 0, vi.fn());
    second.tick(0);
    const pauses = video.pauseCalls;
    resolveFirst();
    await Promise.resolve();
    expect(video.pauseCalls).toBe(pauses);
    expect(video.paused).toBe(false);
    resolve();
    second.dispose();
  });

  it('reports startup timeout and playback rejection rather than hanging indefinitely', async () => {
    const video = new Video(), onError = vi.fn();
    video.readyState = 0;
    const waiting = new ComparisonPlayback([{ clip: clip(), video }], 0, 1, 0, onError);
    expect(waiting.tick(15_001).ended).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
    video.readyState = 4;
    video.playResult = () => Promise.reject(new DOMException('Codec failure', 'NotSupportedError'));
    const playing = new ComparisonPlayback([{ clip: clip(), video }], 0, 1, 0, onError);
    playing.tick(0);
    await Promise.resolve(); await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(video.paused).toBe(true);
  });

  it('retains precise manual frame seeking for variable-rate footage', () => {
    const index = createFrameIndex([0, 0.04, 0.1, 0.12].map(timestamp => ({ timestamp, duration: 0.02 })));
    const video = new Video(1000); video.paused = false;
    seekVideoFrame(video, index, 2);
    expect(video.paused).toBe(true);
    expect(video.time).toBe(0.101);
    expect(frameAt(index, video.time)).toBe(2);
  });
});
