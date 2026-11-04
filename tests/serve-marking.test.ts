import { describe, expect, it } from 'vitest';
import { markingBounds, applyServeMark, type ServeMark } from '../src/video-comparison/speed/marking';
import { newServeSetup } from '../src/video-comparison/speed/types';
import type { ComparisonClip } from '../src/video-comparison/types';

const clip: ComparisonClip = {
  id: 'clip',
  name: 'serve.mp4',
  file: new File([], 'serve.mp4'),
  url: 'blob:local',
  width: 400,
  thumbnails: [],
  frame: 40,
  speed: 1,
  contact: 30,
  trim: { start: 20, end: 80 },
  index: { timestamps: Float64Array.from({ length: 100 }, (_, i) => i / 60), fps: 60, end: 100 / 60, variable: false }
};
const mark = (frame: number): ServeMark => ({ points: [{ x: 0.3, y: 0.4 }], frame, radius: 0.5, pixelFloor: 1.25 });

describe('serve marking dialog data boundaries', () => {
  it('allows court observations outside the excerpt but bounds ball marks to the selected flight', () => {
    const setup = newServeSetup();
    setup.bounce = { frame: 60, x: 0.5, y: 0.6, radius: 2 };
    expect(markingBounds(clip, setup, 'near')).toEqual({ start: 0, end: 99 });
    expect(markingBounds(clip, setup, 'netCenter')).toEqual({ start: 0, end: 99 });
    expect(markingBounds(clip, setup, 'contact')).toEqual({ start: 20, end: 80 });
    expect(markingBounds(clip, setup, 'bounce')).toEqual({ start: 31, end: 80 });
    expect(markingBounds(clip, setup, 'flight')).toEqual({ start: 31, end: 59 });
    expect(markingBounds({ ...clip, contact: null }, setup, 'contact')).toEqual({ start: 20, end: 80 });
    expect(markingBounds({ ...clip, contact: null }, setup, 'bounce')).toBeNull();
    expect(markingBounds({ ...clip, contact: 60 }, setup, 'flight')).toBeNull();
  });
  it('revising contact keeps valid observations and clears a bounce that now precedes impact', () => {
    const setup = newServeSetup();
    setup.bounce = { frame: 60, x: 0.5, y: 0.6, radius: 2 };
    setup.flight = [35, 45, 55].map((frame) => ({ frame, x: 0.4, y: 0.5, radius: 2 }));
    const next = applyServeMark(setup, 'contact', mark(40));
    expect(next.contact).toEqual({ frame: 40, x: 0.3, y: 0.4, radius: 1.25 });
    expect(next.flight.map((p) => p.frame)).toEqual([45, 55]);
    expect(next.bounce).toEqual(setup.bounce);
    const later = applyServeMark(next, 'contact', mark(65));
    expect(later.bounce).toBeUndefined();
    expect(later.flight).toEqual([]);
    expect(setup.flight).toHaveLength(3);
    expect(setup.contact).toBeUndefined();
  });
  it('keeps unrelated annotations and frame-specific line precision when saving a court draft', () => {
    const setup = newServeSetup();
    setup.contact = { frame: 30, x: 0.2, y: 0.3, radius: 2 };
    const line = {
      ...mark(5),
      points: [
        { x: 0.2, y: 0.8 },
        { x: 0.9, y: 0.8 }
      ]
    };
    const next = applyServeMark(setup, 'near', line);
    expect(next.lines.near).toEqual({ points: line.points, frame: 5, pixelFloor: 1.25 });
    expect(next.contact).toBe(setup.contact);
    expect(setup.lines.near).toBeUndefined();
  });
  it('replaces a flight observation at the same frame and removes checks beyond a revised bounce', () => {
    const setup = newServeSetup();
    setup.contact = { frame: 30, x: 0.2, y: 0.3, radius: 2 };
    setup.flight = [40, 50, 60].map((frame) => ({ frame, x: 0.4, y: 0.5, radius: 2 }));
    const revised = applyServeMark(setup, 'flight', mark(50));
    expect(revised.flight.map((p) => p.frame)).toEqual([40, 50, 60]);
    expect(revised.flight[1].x).toBe(0.3);
    expect(applyServeMark(revised, 'bounce', mark(50)).flight.map((p) => p.frame)).toEqual([40]);
  });
});
