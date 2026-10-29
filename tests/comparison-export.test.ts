import { describe, expect, it, vi } from 'vitest';
import { containRect, gridCells, moveGridClip, outputSize } from '../src/video-comparison/exportLayout';
import { exportPlan, imagePageLayout, sourceFrames, MAX_IMAGE_PIXELS, MAX_IMAGE_SIDE, type ExportConfig } from '../src/video-comparison/exportPlan';
import { crc32, zipImages } from '../src/video-comparison/exportZip';
import { createFrameIndex } from '../src/video-comparison/timeline';
import type { ComparisonClip } from '../src/video-comparison/types';
const makeClip = (id: string, fps: number, contact: number, speed = 1): ComparisonClip => ({ id, name: id, file: new File([], id), url: 'blob:test',
  index: createFrameIndex(Array.from({ length: fps * 3 }, (_, i) => ({ timestamp: i / fps, duration: 1 / fps }))), contact, speed, frame: 0, width: 320, thumbnails: [] });
const clips = [makeClip('a', 30, 30), makeClip('b', 60, 120, 0.5)];
const config: ExportConfig = { kind: 'video', format: 'auto', width: 640, height: 360, fps: 30, rate: 0.5,
  start: -0.2, end: 0.4, rows: [{ id: 'row', clips: ['a', 'b'] }], labels: true, sampling: 'even', imageRows: 3, cellWidth: 160, cellAspect: 1 };

describe('export grid arrangement', () => {
  it('reorders within a row without duplicates or off-by-one insertion', () => {
    expect(moveGridClip([{ id: 'r', clips: ['a','b','c'] }], 'a', { row: 'r', index: 3 })).toEqual([{ id: 'r', clips: ['b','c','a'] }]);
    expect(moveGridClip([{ id: 'r', clips: ['a','b','c'] }], 'c', { row: 'r', index: 0 })).toEqual([{ id: 'r', clips: ['c','a','b'] }]);
  });
  it('creates rows, joins rows and removes the empty source row', () => {
    const rows = [{ id: 'r1', clips: ['a','b'] }, { id: 'r2', clips: ['c'] }];
    expect(moveGridClip(rows, 'c', { row: 'r1', index: 1 })).toEqual([{ id: 'r1', clips: ['a','c','b'] }]);
    expect(moveGridClip(rows, 'b', { before: 'r1', newRow: 'new' })).toEqual([{ id: 'new', clips: ['b'] }, { id: 'r1', clips: ['a'] }, { id: 'r2', clips: ['c'] }]);
    expect(rows[0]!.clips).toEqual(['a','b']);
  });
  it('fits arbitrary unequal rows inside the output and preserves source proportions', () => {
    const rows = [{ id: 'top', clips: ['a','b','c','d'] }, { id: 'bottom', clips: ['e'] }];
    const cells = gridCells(rows, 1920, 1080);
    expect(cells).toHaveLength(5);
    expect(cells[4]!.width).toBeGreaterThan(cells[0]!.width * 3);
    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual(0); expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width).toBeLessThanOrEqual(1920); expect(cell.y + cell.height).toBeLessThanOrEqual(1080);
      const portrait = containRect(720, 1280, cell);
      expect(portrait.width / portrait.height).toBeCloseTo(720 / 1280);
      expect(portrait.height).toBeLessThanOrEqual(cell.height);
    }
    expect(outputSize('9:16', 1920)).toEqual({ width: 1080, height: 1920 });
  });
});

describe('export timeline and validation', () => {
  it('keeps actual source contact frames synchronized at configured FPS and multiplicative speed', () => {
    const plan = exportPlan(clips, config);
    expect(plan.times).toHaveLength(36); // Do not add a zero-duration frame for floating-point noise.
    const zero = plan.times.indexOf(0);
    expect(zero).toBe(12);
    expect(plan.clips.map(clip => sourceFrames(clip, plan.times)[zero])).toEqual([30,120]);
    expect(plan.duration).toBeCloseTo(1.2);
    expect(sourceFrames(plan.clips[1]!, [0.5])).toEqual([135]);
  });
  it('uses the chosen inclusion and grid order and rejects unaligned or duplicate clips', () => {
    expect(exportPlan(clips, { ...config, rows: [{ id: 'r', clips: ['b'] }] }).clips.map(c => c.id)).toEqual(['b']);
    expect(exportPlan(clips, { ...config, rows: [{ id: 'r', clips: ['b','a'] }] }).clips.map(c => c.id)).toEqual(['b','a']);
    expect(() => exportPlan(clips, { ...config, rows: [] })).toThrow('Select at least');
    expect(() => exportPlan(clips, { ...config, rows: [{ id: 'r', clips: ['a','a'] }] })).toThrow('Select at least');
    expect(() => exportPlan([{ ...clips[0]!, contact: null }], { ...config, rows: [{ id: 'r', clips: ['a'] }] })).toThrow('Set a contact');
  });
  it('samples contact sheets chronologically, including exact contact and VFR boundaries', () => {
    expect(exportPlan(clips, { ...config, kind: 'images', imageRows: 2 }).times).toEqual([-0.2,0,0.4]);
    const vfr = { ...clips[0]!, index: createFrameIndex([0,0.04,0.1,0.12,0.3].map(timestamp => ({ timestamp, duration: 0.02 }))), contact: 2 };
    const plan = exportPlan([vfr], { ...config, kind: 'images', sampling: 'frames', start: -0.1, end: 0.2, rows: [{ id: 'r', clips: ['a'] }] });
    expect(plan.times.length).toBe(5);
    expect(sourceFrames(plan.clips[0]!, plan.times)).toEqual([0,1,2,3,4]);
  });
  it('tiles very tall sheets without losing or duplicating rows and bounds each canvas', () => {
    const page = imagePageLayout(5, 2000, 480, 16/9);
    expect(page.pages).toBeGreaterThan(1);
    expect(page.width * (page.header + page.pageRows * page.rowHeight)).toBeLessThanOrEqual(MAX_IMAGE_PIXELS);
    expect(page.header + page.pageRows * page.rowHeight).toBeLessThanOrEqual(MAX_IMAGE_SIDE);
    expect(page.totalHeight).toBeGreaterThan(MAX_IMAGE_SIDE);
    const pageCounts = Array.from({ length: page.pages }, (_, i) => Math.min(page.pageRows, 2000 - i * page.pageRows));
    expect(pageCounts.reduce((a,b) => a+b,0)).toBe(2000);
    expect(() => imagePageLayout(20, 2, 2048, 1)).toThrow('Reduce image');
  });
  it('rejects invalid dimensions, excessive work and invalid input before decoding', () => {
    expect(() => exportPlan(clips, { ...config, width: 641 })).toThrow('even resolution');
    expect(() => exportPlan(clips, { ...config, fps: 0 })).toThrow('supported frame rate');
    expect(() => exportPlan(clips, { ...config, end: -1 })).toThrow('valid time range');
    expect(() => exportPlan(clips, { ...config, end: 10_000 })).toThrow('shorter');
    expect(() => exportPlan(clips, { ...config, kind: 'images', imageRows: 0 })).toThrow('1–2000');
  });
});

describe('PNG page archive', () => {
  it('writes valid CRCs, file sizes, central-directory offsets and UTF-8 names', async () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(crc32(bytes)).toBe(0xcbf43926);
    const zip = await zipImages([{ name: '对比.png', blob: new Blob([bytes]) }, { name: '2.png', blob: new Blob(['abc']) }], new AbortController().signal);
    const data = new Uint8Array(await zip.arrayBuffer()), view = new DataView(data.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(14, true)).toBe(0xcbf43926);
    const end = data.length - 22, central = view.getUint32(end + 16, true);
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    expect(view.getUint32(central, true)).toBe(0x02014b50);
    expect(view.getUint32(central + 42, true)).toBe(0);
    expect(view.getUint32(end + 12, true)).toBe(end - central);
  });
  it('does not create an archive after cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(zipImages([{ name: 'a.png', blob: new Blob(['x']) }], controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
