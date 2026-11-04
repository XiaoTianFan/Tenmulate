import { clipFrameRange } from '../timeline';
import type { ComparisonClip } from '../types';
import { COURT_LINES, type CourtLine, type Line, type Point, type ServeSetup, type SpeedSelection } from './types';

export type ServeMark = { points: Point[]; radius: number; frame: number; pixelFloor: number };

/** Court geometry may use any source frame; flight observations stay in the excerpt. */
export function markingBounds(clip: ComparisonClip, setup: ServeSetup, kind: SpeedSelection['kind']) {
  if (!clip.index) return null;
  if (kind in COURT_LINES) return { start: 0, end: clip.index.timestamps.length - 1 };
  const range = clipFrameRange({ ...clip, index: clip.index });
  if (kind === 'contact') return range;
  if (clip.contact === null || (kind === 'flight' && !setup.bounce)) return null;
  const start = Math.max(range.start, clip.contact + 1);
  const end = kind === 'flight' ? Math.min(range.end, setup.bounce!.frame - 1) : range.end;
  return end >= start ? { start, end } : null;
}

/** Only Save applies a draft. A revised contact cannot leave a backwards flight. */
export function applyServeMark(setup: ServeSetup, kind: SpeedSelection['kind'], mark: ServeMark): ServeSetup {
  const { points, radius, frame, pixelFloor } = mark;
  if (kind in COURT_LINES)
    return {
      ...setup,
      lines: { ...setup.lines, [kind as CourtLine]: { points: points as Line, frame, pixelFloor } }
    };
  const ball = { ...points[0], frame, radius: Math.max(radius, pixelFloor) };
  if (kind === 'flight')
    return {
      ...setup,
      flight: [...setup.flight.filter((p) => p.frame !== frame), ball].sort((a, b) => a.frame - b.frame)
    };
  if (kind === 'contact') {
    const bounce = setup.bounce && setup.bounce.frame > frame ? setup.bounce : undefined;
    return {
      ...setup,
      contact: ball,
      bounce,
      flight: setup.flight.filter((p) => p.frame > frame && (!bounce || p.frame < bounce.frame))
    };
  }
  return {
    ...setup,
    bounce: ball,
    flight: setup.flight.filter((p) => p.frame < frame && (!setup.contact || p.frame > setup.contact.frame))
  };
}
