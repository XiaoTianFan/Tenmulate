import { describe, expect, it, vi } from 'vitest';
import { PointTracker, type PixelFrame } from '../src/video-comparison/analysis/tracker';
import { AnalysisQueue } from '../src/video-comparison/analysis/queue';
import { emptySeries, putSample, sampleAt, newMotion, ESTIMATED, MANUAL, type MotionPlot } from '../src/video-comparison/analysis/types';
import { fillDraft, jointAngle, plotData, trackCoverage } from '../src/video-comparison/analysis/series';
import { PresentedFrames } from '../src/video-comparison/analysis/presentation';
import { createFrameIndex } from '../src/video-comparison/timeline';

function patch(cx: number, cy: number, visible = true, ball = false): PixelFrame {
  const width = 240, height = 160, rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - cx, dy = y - cy, inside = ball ? dx * dx + dy * dy < 25 : Math.abs(dx) < 11 && Math.abs(dy) < 11;
    const v = visible && inside ? ball ? 220 : 60 + ((dx + 11) * 37 + (dy + 11) * 17) % 190 : 25;
    rgba.set([v, v, v, 255], (y * width + x) * 4);
  }
  return { width, height, rgba };
}
describe('point tracking', () => {
  it('follows a textured region and a fast small target, rejects occlusion and can reacquire a visible target', () => {
    for (const ball of [false, true]) {
      const tracker = new PointTracker(), anchor = { frame: 0, x: 50 / 240, y: 80 / 160, width: 22 / 240, height: 22 / 160 };
      tracker.reset(patch(50, 80, true, ball), anchor);
      for (let i = 1; i <= 4; i++) {
        const x = 50 + i * (ball ? 31 : 6), y = 80 + i * 2;
        const point = tracker.next(patch(x, y, true, ball));
        expect(point).not.toBeNull(); expect(point!.x * 240).toBeCloseTo(x, 0); expect(point!.y * 160).toBeCloseTo(y, 0);
      }
      expect(tracker.next(patch(0, 0, false))).toBeNull();
      // Loss does not permanently disable the tracker; a manual anchor can also restart it.
      tracker.reset(patch(50, 80, true, ball), anchor);
      expect(tracker.next(patch(54, 82, true, ball))).not.toBeNull();
    }
  });
  it('reacquires after a short occlusion using timestamp-aware prediction in both directions', () => {
    for (const direction of [1, -1]) {
      const tracker = new PointTracker(), anchor = { frame: 0, x: 80 / 240, y: .5, width: 22 / 240, height: 22 / 160 };
      tracker.reset(patch(80, 80), anchor, .5);
      expect(tracker.next(patch(86, 80), .5 + direction * .02)?.x).toBeCloseTo(86 / 240, 3);
      expect(tracker.next(patch(0, 0, false), .5 + direction * .04)).toBeNull();
      const recovered = tracker.next(patch(104, 80), .5 + direction * .08);
      expect(recovered?.x).toBeCloseTo(104 / 240, 3);
    }
  });
  it('uses chroma to reject a similar gray distractor beside a moving colored ball', () => {
    const colored = (cx: number, distractor: boolean) => {
      const frame = patch(cx, 80, true, true);
      for (let y = 0; y < 160; y++) for (let x = 0; x < 240; x++) {
        if ((x - cx) ** 2 + (y - 80) ** 2 < 25) frame.rgba.set([190, 230, 30, 255], (y * 240 + x) * 4);
        if (distractor && (x - 60) ** 2 + (y - 80) ** 2 < 25) frame.rgba.set([195, 195, 195, 255], (y * 240 + x) * 4);
      }
      return frame;
    };
    const tracker = new PointTracker(); tracker.reset(colored(60, false), { frame: 0, x: .25, y: .5, width: .06, height: .09 });
    for (const x of [90, 120, 150]) expect(tracker.next(colored(x, true))?.x).toBeCloseTo(x / 240, 3);
  });
  it('rejects a textureless region instead of inventing a measurement', () => {
    const tracker = new PointTracker(); tracker.reset(patch(0, 0, false), { frame: 0, x: .5, y: .5, width: .1, height: .1 });
    expect(tracker.next(patch(0, 0, false))).toBeNull();
  });
});

describe('source-time motion metrics', () => {
  const times = [0, .017, .05, .081, .12, .17, .22], index = createFrameIndex(times.map(timestamp => ({ timestamp, duration: .02 })));
  const series = emptySeries(0, times.length - 1, 1, 1000, 500, 'fixture');
  times.forEach((time, f) => putSample(series, f, 0, (100 + 30 * time + 20 * time * time) / 1000, (50 + 40 * time) / 500, 1));
  const motion = { ...newMotion(), tracks: [{ id: 'ball', name: 'ball', color: '#fff', anchors: [], visible: true, revision: 0, result: series }] };
  const plot: MotionPlot = { id: 'p', target: 'track:ball', metric: 'vx', smoothing: .2 };
  it('fits velocity and acceleration using actual VFR timestamps and original source dimensions', () => {
    expect(plotData(motion, plot, index).values[3]).toBeCloseTo(30 + 40 * times[3], 2);
    expect(plotData(motion, { ...plot, metric: 'ax' }, index).values[3]).toBeCloseTo(40, 1);
    expect(plotData(motion, { ...plot, metric: 'vy' }, index).values[3]).toBeCloseTo(-40, 2);
    expect(plotData(motion, { ...plot, metric: 'speed' }, index).values[3]).toBeCloseTo(Math.hypot(30 + 40 * times[3], 40), 2);
  });
  it('does not fit across missing samples or manual correction discontinuities', () => {
    const copy = { ...series, values: series.values.slice(), states: series.states.slice() }; copy.states[3] = 0;
    const m = { ...motion, tracks: [{ ...motion.tracks[0], result: copy }] };
    expect(plotData(m, plot, index).values[3]).toBeNull();
    expect(plotData(m, { ...plot, smoothing: 0 }, index).values[2]).toBeNull();
    putSample(copy, 3, 0, .9, .9, 1, MANUAL);
    expect(plotData(m, { ...plot, smoothing: 0 }, index).values[2]).toBeNull();
  });
  it('marks only supported short draft intervals as estimates and never bridges detection failure', () => {
    const pose = emptySeries(0, 6, 17, 1000, 500, 'pose');
    putSample(pose, 0, 9, .1, .2, .9); putSample(pose, 2, 9, .3, .4, .8); putSample(pose, 6, 9, .9, .9, .8);
    fillDraft(pose, [0, 2, 4, 6], index);
    expect(sampleAt(pose, 1, 9)?.state).toBe(ESTIMATED); expect(sampleAt(pose, 1, 9)?.x).toBeCloseTo(.168, 4);
    expect(sampleAt(pose, 3, 9)).toBeNull(); expect(sampleAt(pose, 5, 9)).toBeNull();
  });
  it('measures projected joint angles in pixel aspect, not normalized square coordinates', () => {
    const pose = emptySeries(0, 0, 17, 1000, 500, 'pose');
    putSample(pose, 0, 5, .4, .3, 1); putSample(pose, 0, 7, .5, .5, 1); putSample(pose, 0, 9, .6, .3, 1);
    expect(jointAngle(pose, 0, 'leftElbow')).toBeCloseTo(90, 4);
    pose.states[9] = 0; expect(jointAngle(pose, 0, 'leftElbow')).toBeNull();
  });
  it('bounds series allocation and represents missing values distinctly from the top-left corner', () => {
    expect(() => emptySeries(0, 7200, 1, 100, 100, '')).toThrow('7200');
    const s = emptySeries(0, 1, 1, 100, 100, ''); putSample(s, 0, 0, 0, 0, 1);
    expect(sampleAt(s, 0)?.x).toBe(0); expect(sampleAt(s, 1)).toBeNull();
  });
});

describe('analysis ownership and frame presentation', () => {
  it('serializes jobs and resumes only when review releases the queue', async () => {
    const queue = new AnalysisQueue(), calls: string[] = []; queue.setPaused(true);
    const a = queue.enqueue('a/track', async (_signal, ready) => { calls.push('a'); queue.setPaused(true); await ready(); calls.push('end'); });
    const b = queue.enqueue('b/pose', async () => { calls.push('b'); });
    await Promise.resolve(); expect(calls).toEqual([]); queue.setPaused(false);
    await vi.waitFor(() => expect(calls).toEqual(['a'])); queue.setPaused(false); await Promise.all([a, b]);
    expect(calls).toEqual(['a', 'end', 'b']); queue.dispose();
  });
  it('rejects cancelled queued and active jobs, allowing the next job to run', async () => {
    const queue = new AnalysisQueue(); queue.setPaused(true); const called = vi.fn();
    const a = queue.enqueue('a/track', called), rejection = expect(a).rejects.toMatchObject({ name: 'AbortError' }); queue.cancelClip('a');
    queue.setPaused(false); await rejection; expect(called).not.toHaveBeenCalled();
    const b = queue.enqueue('b/pose', async (signal, ready) => { queue.setPaused(true); await ready(); signal.throwIfAborted(); });
    const failed = expect(b).rejects.toMatchObject({ name: 'AbortError' }); await Promise.resolve(); await Promise.resolve(); queue.cancelClip('b'); await failed;
    queue.setPaused(false); await expect(queue.enqueue('c/pose', async () => 42)).resolves.toBe(42); queue.dispose();
  });
  it('notifies overlays only when a picture is presented and detaches listeners', () => {
    const frames = new PresentedFrames(), listener = vi.fn(), remove = frames.subscribe('a', listener);
    expect(frames.get('a')).toBe(-1); frames.present('a', 5); frames.present('a', 5); expect(listener).toHaveBeenCalledTimes(1);
    expect(frames.get('a')).toBe(5); remove(); frames.present('a', 6); expect(listener).toHaveBeenCalledTimes(1);
    frames.remove('a'); expect(frames.get('a')).toBe(-1);
  });
});

it('composites the source-frame overlay through the same crop and mirror as exported video', async () => {
  const { drawCell } = await import('../src/video-comparison/exportRender');
  const point = emptySeries(1, 1, 1, 400, 400, 'manual'); putSample(point, 1, 0, .4, .6, 1);
  const motion = { ...newMotion(), tracks: [{ id: 'p', name: 'ball', color: '#fff', anchors: [], visible: true, revision: 0, result: point }] };
  const index = createFrameIndex([0, .1].map(timestamp => ({ timestamp, duration: .1 })));
  const clip = { id: 'c', name: 'c', file: new File([], 'c'), url: '', index, contact: 0, speed: 1, frame: 0, width: 200, thumbnails: [], motion, crop: { x: .25, y: .25, width: .5, height: .5 }, mirrored: true };
  let transform = [1, 1, 0, 0]; const stack: number[][] = [], dots: number[][] = [];
  const ctx = { save: () => stack.push([...transform]), restore: () => { transform = stack.pop()!; },
    translate: (x: number, y: number) => { transform[2] += x * transform[0]; transform[3] += y * transform[1]; }, scale: (x: number, y: number) => { transform[0] *= x; transform[1] *= y; },
    arc: (x: number, y: number) => dots.push([x * transform[0] + transform[2], y * transform[1] + transform[3]]),
    beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), fillRect: vi.fn(), fill: vi.fn(), stroke: vi.fn(), strokeText: vi.fn(), fillText: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const sample = { frame: 1, width: 400, height: 400, bytes: 640000, draw: vi.fn(), close: vi.fn() }, cell = { id: 'c', x: 10, y: 20, width: 200, height: 200 };
  drawCell(ctx, sample, clip, cell, false);
  expect(dots).toHaveLength(1); expect(dots[0][0]).toBeCloseTo(150, 3); expect(dots[0][1]).toBeCloseTo(160, 3);
  dots.length = 0; drawCell(ctx, sample, clip, cell, false, { tracks: false, skeleton: false, angles: false, plots: false }); expect(dots).toEqual([]);
  drawCell(ctx, { ...sample, frame: 0 }, clip, cell, false); expect(dots).toEqual([]); // Cursor frame 0 is not sample 1.
});

it('keeps gaps compact for long videos with isolated manual anchors', () => {
  const series = emptySeries(50, 50, 1, 100, 100, 'manual'); putSample(series, 50, 0, .5, .5, 1, MANUAL);
  expect(trackCoverage(series, { start: 0, end: 999999 })).toEqual({ found: 1, gaps: [{ start: 0, end: 49 }, { start: 51, end: 999999 }] });
});
