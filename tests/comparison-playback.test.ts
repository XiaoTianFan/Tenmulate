import { describe, expect, it, vi } from 'vitest';
import { ComparisonPlayback, seekVideoFrame, showManualFrame, type PlaybackSource } from '../src/video-comparison/playback';
import { comparisonRange, createFrameIndex, frameAt, frameSeekTime, mediaTime, type AlignedClip } from '../src/video-comparison/timeline';

class Frames implements PlaybackSource {
  displayed = -1;
  available = Infinity;
  requested: number[] = [];
  pictures: number[] = [];
  dispose = vi.fn();
  prepare(frame: number) { this.requested.push(frame); return frame <= this.available; }
  present(frame: number) { this.displayed = frame; this.pictures.push(frame); }
}
const clip = (fps = 30, speed = 1, contact = 0, seconds = 10): AlignedClip => ({
  index: createFrameIndex(Array.from({ length: Math.ceil(fps * seconds) }, (_, i) => ({ timestamp: i / fps, duration: 1 / fps }))),
  speed, contact,
});
const vfr = (): AlignedClip => ({
  index: createFrameIndex([0, 0.04, 0.1, 0.12, 0.27, 0.4, 0.51, 0.53, 0.7, 0.9, 1.2, 1.3, 1.5].map(timestamp => ({ timestamp, duration: 0.03 }))),
  contact: 5, speed: 0.4,
});

describe('contact-synchronized frame presentation', () => {
  it('hands playback back to manual scrubbing only after seek completion, even with a rounded media clock', () => {
    const video = Object.assign(new EventTarget(), { currentTime: 0, readyState: 1, seeking: true, pause: vi.fn() });
    const canvas = { hidden: false };
    const cleanup = showManualFrame(video, clip().index, 5, canvas);
    expect(canvas.hidden).toBe(false);
    video.currentTime = 0.1; // A privacy-rounded value need not identify the decoded sample.
    video.readyState = 4; video.seeking = false;
    video.dispatchEvent(new Event('seeked'));
    expect(canvas.hidden).toBe(true);
    cleanup();
    canvas.hidden = false;
    video.dispatchEvent(new Event('seeked'));
    expect(canvas.hidden).toBe(false); // An old manual seek cannot cover a new playback session.
  });

  it.each([0.25, 0.5, 1, 2])('presents the actual contact pictures together across mixed FPS/VFR and clip speeds at %s×', rate => {
    const clips = [clip(29.97, 1, 30), clip(60, 0.5, 120), clip(120, 1.5, 180), vfr()];
    const sources = clips.map(() => new Frames());
    const engine = new ComparisonPlayback(clips.map((c, i) => ({ clip: c, source: sources[i]! })), -0.53, rate, 0, vi.fn());
    engine.tick(0);
    let sawContact = false;
    for (let i = 1; i <= Math.ceil(1.5 / rate * 60); i++) {
      const result = engine.tick(i * 1000 / 60);
      expect(result.buffering).toBe(false);
      sources.forEach((source, n) => {
        // Check the frame sent to the display, not a UI cursor or media clock.
        expect(source.displayed).toBe(frameAt(clips[n]!.index, mediaTime(clips[n]!, result.time)));
      });
      if (result.time === 0) {
        sawContact = true;
        expect(sources.map(source => source.displayed)).toEqual(clips.map(c => c.contact));
      }
    }
    expect(sawContact).toBe(true);
    engine.dispose();
  });

  it('waits for differently delayed decoders before advancing any picture or cursor', () => {
    const clips = [clip(30, 1, 30), clip(120, 0.5, 240)];
    const sources = [new Frames(), new Frames()];
    sources[1]!.available = -1;
    const engine = new ComparisonPlayback(clips.map((c, i) => ({ clip: c, source: sources[i]! })), -0.5, 1, 0, vi.fn());
    expect(engine.tick(0)).toEqual({ time: -0.5, buffering: true, ended: false });
    expect(engine.tick(300).time).toBe(-0.5);
    expect(sources.map(source => source.pictures.length)).toEqual([0, 0]);
    sources[1]!.available = Infinity;
    expect(engine.tick(350).time).toBe(-0.5);
    expect(engine.tick(850).time).toBe(0);
    expect(sources.map(source => source.displayed)).toEqual([30, 240]);
  });

  it('never lets a ready clip pass contact while another contact frame is unavailable', () => {
    const a = new Frames(), b = new Frames();
    const engine = new ComparisonPlayback([{ clip: clip(30, 1, 30), source: a }, { clip: clip(60, 0.5, 120), source: b }], -0.2, 1, 0, vi.fn());
    engine.tick(0);
    engine.tick(150);
    const before = [a.displayed, b.displayed];
    b.available = 119;
    expect(engine.tick(250)).toEqual({ time: -0.05000000000000002, buffering: true, ended: false });
    expect([a.displayed, b.displayed]).toEqual(before);
    expect(engine.tick(1000).buffering).toBe(true);
    expect(a.displayed).toBeLessThan(30);
    b.available = Infinity;
    expect(engine.tick(1100).time).toBe(0);
    expect([a.displayed, b.displayed]).toEqual([30, 120]);
    expect(engine.tick(1200).time).toBeCloseTo(0.1); // No wall-clock catch-up jump.
  });

  it('preserves rate multiplication and position when global speed changes during play', () => {
    const source = new Frames(), c = clip(60, 0.5, 120);
    const engine = new ComparisonPlayback([{ clip: c, source }], -0.5, 0.5, 0, vi.fn());
    engine.tick(0);
    engine.setRate(2, 500);
    expect(engine.tick(500).time).toBe(-0.25);
    expect(source.displayed).toBe(112);
    expect(engine.tick(625).time).toBe(0);
    expect(source.displayed).toBe(c.contact);
    expect(engine.tick(1000).time).toBe(0.75);
    expect(source.displayed).toBe(frameAt(c.index, 2 + 0.75 * 0.5));
  });

  it('can change rate while buffering without consuming undecoded time', () => {
    const source = new Frames(); source.available = -1;
    const engine = new ComparisonPlayback([{ clip: clip(), source }], 0, 1, 0, vi.fn());
    engine.tick(0); engine.setRate(2, 500);
    source.available = Infinity;
    expect(engine.tick(1000).time).toBe(0);
    expect(engine.tick(1500).time).toBe(1);
  });

  it('retains elapsed time across delayed renders and explicitly presents contact on crossing', () => {
    const source = new Frames();
    const engine = new ComparisonPlayback([{ clip: clip(30, 1, 30), source }], -0.1, 1, 0, vi.fn());
    engine.tick(0);
    expect(engine.tick(150).time).toBe(0);
    expect(source.displayed).toBe(30);
    expect(engine.tick(200).time).toBeCloseTo(0.1);
    expect(engine.tick(1200).time).toBeCloseTo(1.1);
  });

  it('starts at the same VFR frame as manual scrubbing, including between sample boundaries', () => {
    const c = vfr(), source = new Frames();
    const time = -0.675; // source time 0.13 lies inside the frame starting at 0.12.
    const engine = new ComparisonPlayback([{ clip: c, source }], time, 1, 0, vi.fn());
    engine.tick(0);
    const manual = { currentTime: 0, readyState: 4, pause: vi.fn() };
    seekVideoFrame(manual, c.index, frameAt(c.index, mediaTime(c, time)));
    expect(source.displayed).toBe(frameAt(c.index, manual.currentTime));
    expect(manual.currentTime).toBe(frameSeekTime(c.index, 3));
  });

  it('holds edge pictures and stops only at the end of the union', () => {
    const short = clip(30, 1, 15, 1), long = clip(60, 0.5, 90, 3);
    const sources = [new Frames(), new Frames()];
    const clips = [short, long], range = comparisonRange(clips);
    const engine = new ComparisonPlayback(clips.map((c, i) => ({ clip: c, source: sources[i]! })), range.start, 1, 0, vi.fn());
    engine.tick(0);
    expect(sources.map(s => s.displayed)).toEqual([0, 0]);
    engine.tick(-range.start * 1000);
    expect(sources.map(s => s.displayed)).toEqual([15, 90]);
    const end = engine.tick((range.end - range.start) * 1000);
    expect(end.ended).toBe(true);
    expect(sources.map(s => s.displayed)).toEqual([29, 179]);
    sources.forEach(s => expect(s.dispose).toHaveBeenCalledOnce());
  });

  it('supports very low combined speeds without a native playbackRate limit', () => {
    const source = new Frames();
    const engine = new ComparisonPlayback([{ clip: clip(60, 0.1), source }], 0, 0.25, 0, vi.fn());
    engine.tick(0);
    expect(engine.tick(2000).time).toBe(0.5);
    expect(source.displayed).toBe(3); // 0.05 seconds of source time.
  });

  it('disposes once and never presents again after pause, removal or an obsolete session', () => {
    const source = new Frames();
    const engine = new ComparisonPlayback([{ clip: clip(), source }], 0, 1, 0, vi.fn());
    engine.tick(0); engine.dispose(); engine.dispose();
    expect(engine.tick(200).ended).toBe(true);
    expect(source.pictures).toEqual([0]);
    expect(source.dispose).toHaveBeenCalledOnce();
  });

  it('reports unavailable decoders and timed-out buffering without advancing the pictures', () => {
    const source = new Frames(), onError = vi.fn();
    source.available = -1;
    const engine = new ComparisonPlayback([{ clip: clip(), source }], 0, 1, 0, onError);
    expect(engine.tick(15_001).ended).toBe(true);
    expect(onError).toHaveBeenCalledOnce();
    expect(source.pictures).toEqual([]);
    const broken = new Frames(); broken.prepare = () => { throw new Error('Decoder unavailable'); };
    const failed = new ComparisonPlayback([{ clip: clip(), source: broken }], 0, 1, 0, onError);
    expect(failed.tick(0).ended).toBe(true);
    expect(onError).toHaveBeenLastCalledWith('Decoder unavailable');
    expect(broken.dispose).toHaveBeenCalledOnce();
  });
});
