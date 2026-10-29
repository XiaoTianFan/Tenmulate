import { describe, expect, it, vi } from 'vitest';
import { clipFrameRange, comparisonRange, comparisonTime, createFrameIndex, frameForTime, stepComparison } from '../src/video-comparison/timeline';
import { cropForAspect, drawCropped, FULL_CROP, normalizeCrop, resizeCrop } from '../src/video-comparison/crop';
import { fitWindow, zoomWindow } from '../src/video-comparison/timelineView';
import { ComparisonPlayback } from '../src/video-comparison/playback';
import { exportPlan, sourceFrames, type ExportConfig } from '../src/video-comparison/exportPlan';
import { gridCells } from '../src/video-comparison/exportLayout';
import type { ComparisonClip } from '../src/video-comparison/types';

const clip = (id: string, fps: number, contact: number, speed: number, start: number, end: number) => ({
  id, file: new File([], id), name: id, url: 'blob:local', frame: contact, width: 320, thumbnails: [],
  index: createFrameIndex(Array.from({ length: fps * 3 }, (_, i) => ({ timestamp: i / fps, duration: 1 / fps }))),
  contact, speed, trim: { start, end },
});

describe('temporary source excerpts', () => {
  const a = clip('a', 30, 30, 1, 15, 60), b = clip('b', 60, 60, 0.5, 30, 150);
  it('holds trimmed boundaries without moving the original contact anchors', () => {
    expect(comparisonRange([a, b])).toEqual({ start: -1, end: 3 });
    expect(frameForTime(a, -1)).toBe(15);
    expect(frameForTime(a, 3)).toBe(60);
    expect([frameForTime(a, 0), frameForTime(b, 0)]).toEqual([30, 60]);
    expect(comparisonTime(a, a.contact)).toBe(0);
    expect(clipFrameRange({ ...a, trim: undefined })).toEqual({ start: 0, end: 89 });
  });
  it('steps only selected boundaries, including a gap and an excluded contact', () => {
    const before = { ...a, trim: { start: 0, end: 15 } }, after = { ...b, trim: { start: 90, end: 120 } };
    expect(stepComparison([before, after], -0.5, 1)).toBe(1);
    expect(stepComparison([before, after], 1, -1)).toBe(-0.5);
    expect([frameForTime(before, 0), frameForTime(after, 0)]).toEqual([15, 90]);
    expect(stepComparison([after], 2, 1)).toBe(2);
    expect(stepComparison([after], 1, -1)).toBe(1);
  });
  it('presents the same excerpt/contact frames during playback and offline export', () => {
    const clips = [a, b];
    const displayed = [-1, -1];
    const followers = clips.map((clip, i) => ({ clip, source: { prepare: () => true, present: (n: number) => { displayed[i] = n; }, dispose: vi.fn() } }));
    const error = vi.fn(), engine = new ComparisonPlayback(followers, -1, 1, 0, error);
    engine.tick(0); expect(displayed).toEqual([15,30]);
    const config: ExportConfig = { kind: 'video', format: 'auto', width: 640, height: 360, fps: 30, rate: 1, start: -1, end: 3,
      rows: [{ id: 'r', clips: ['a','b'] }], labels: true, sampling: 'frames', imageRows: 3, cellWidth: 120, cellAspect: 1 };
    for (let i = 1; i <= 120; i++) {
      const result = engine.tick(i * 1000 / 30);
      expect(displayed).toEqual(clips.map(c => sourceFrames(c, [result.time])[0]));
      expect(displayed[0]).toBeGreaterThanOrEqual(15); expect(displayed[0]).toBeLessThanOrEqual(60);
      expect(displayed[1]).toBeGreaterThanOrEqual(30); expect(displayed[1]).toBeLessThanOrEqual(150);
      if (result.time === 0) expect(displayed).toEqual([30,60]);
    }
    const plan = exportPlan(clips, { ...config, kind: 'images' });
    expect(plan.times[0]).toBe(-1); expect(plan.times.at(-1)).toBe(3);
    expect(sourceFrames(plan.clips[0]!, plan.times).every(n => n >= 15 && n <= 60)).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });
  it('preserves VFR boundaries and a one-frame excerpt', () => {
    const c = { ...a, index: createFrameIndex([0,0.04,0.1,0.12,0.3].map(timestamp => ({ timestamp, duration: .02 }))), contact: 2, trim: { start: 1, end: 3 } };
    expect(stepComparison([c], -0.06, 1)).toBe(0);
    expect(stepComparison([c], 0, 1)).toBeCloseTo(.02);
    const single = { ...c, trim: { start: 2, end: 2 } };
    expect(comparisonRange([single])).toEqual({ start: 0, end: 0 });
    expect(frameForTime(single, 10)).toBe(2);
    expect(stepComparison([single], 0, 1)).toBe(0);
  });
  it('lays out nine edited clips as a 3 × 3 grid without omitted cells', () => {
    const clips: ComparisonClip[] = Array.from({ length: 9 }, (_, i) => ({ ...a, id: String(i), crop: { x: .1, y: .2, width: .5, height: .6 } }));
    const rows = Array.from({ length: 3 }, (_, r) => ({ id: String(r), clips: clips.slice(r * 3, r * 3 + 3).map(c => c.id) }));
    const cells = gridCells(rows, 1920, 1080);
    expect(cells).toHaveLength(9); expect(new Set(cells.map(c => c.id)).size).toBe(9);
    expect(new Set(cells.map(c => c.y)).size).toBe(3);
    expect(new Set(cells.map(c => c.x)).size).toBe(3);
  });
});

describe('crop coordinates shared by preview and export', () => {
  it.each([16/9, 9/16, 1, 4/3, 3/4])('fits a %s preset in portrait and landscape sources', ratio => {
    for (const sourceAspect of [16/9, 9/16]) {
      const crop = cropForAspect(FULL_CROP, sourceAspect, ratio);
      expect(crop.width * sourceAspect / crop.height).toBeCloseTo(ratio);
      expect(crop.x).toBeGreaterThanOrEqual(0); expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(1); expect(crop.y + crop.height).toBeLessThanOrEqual(1);
    }
  });
  it('resizes locked corners against a fixed anchor and source edges', () => {
    const crop = { x: .2, y: .2, width: .4, height: .4 };
    const resized = resizeCrop(crop, 'nw', -.8, -.8, 1);
    expect(resized.x + resized.width).toBeCloseTo(.6); expect(resized.y + resized.height).toBeCloseTo(.6);
    expect(resized.x).toBeCloseTo(0); expect(resized.y).toBeCloseTo(0);
    expect(resized.width / resized.height).toBeCloseTo(1);
    expect(normalizeCrop({ x: 9, y: -1, width: .5, height: .2 })).toEqual({ x: .5, y: 0, width: .5, height: .2 });
    expect(resizeCrop(crop, 'se', -.2, .1).width).toBeCloseTo(.2);
    expect(resizeCrop(crop, 'se', -.2, .1).height).toBeCloseTo(.5);
  });
  it('clips before mirroring so an off-center crop keeps the same source region', () => {
    const context = { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), translate: vi.fn(), scale: vi.fn() };
    const draw = vi.fn();
    drawCropped(context as unknown as CanvasRenderingContext2D, draw, { x: .25, y: .1, width: .5, height: .4 }, { x: 10, y: 20, width: 100, height: 80 }, true);
    expect(context.rect).toHaveBeenCalledWith(10,20,100,80);
    expect(context.translate).toHaveBeenCalledWith(120,0); expect(context.scale).toHaveBeenCalledWith(-1,1);
    expect(draw).toHaveBeenCalledWith(-40,0,200,200); expect(context.restore).toHaveBeenCalledOnce();
  });
});

describe('timeline zoom and pan', () => {
  it('keeps the pointer frame under the same fraction of the viewport', () => {
    const view = zoomWindow({ start: 0, end: 1000 }, 4, .3, 0, 1000, 4);
    expect(view).toEqual({ start: 225, end: 475 });
    expect(view.start + (view.end - view.start) * .3).toBe(300);
    expect(zoomWindow(view, .25, .3, 0, 1000, 4)).toEqual({ start: 0, end: 1000 });
  });
  it('clamps panning and pinch zoom to source bounds and useful frame precision', () => {
    expect(fitWindow({ start: -50, end: 50 }, 0, 1000)).toEqual({ start: 0, end: 100 });
    expect(fitWindow({ start: 990, end: 1090 }, 0, 1000)).toEqual({ start: 900, end: 1000 });
    expect(zoomWindow({ start: 0, end: 1000 }, 10000, .5, 0, 1000, 4)).toEqual({ start: 498, end: 502 });
    expect(zoomWindow({ start: 0, end: 0 }, 2, .5, 0, 0, 4)).toEqual({ start: 0, end: 0 });
  });
});
