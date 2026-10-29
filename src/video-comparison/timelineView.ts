import { clamp } from './timeline';
export type TimelineWindow = { start: number; end: number };
export function fitWindow(view: TimelineWindow, min: number, max: number): TimelineWindow {
  const span = clamp(view.end - view.start, 0, max - min);
  const start = clamp(view.start, min, max - span);
  return { start, end: start + span };
}
export function zoomWindow(view: TimelineWindow, factor: number, anchor: number, min: number, max: number, minimum: number): TimelineWindow {
  const span = clamp((view.end - view.start) / factor, Math.min(minimum, max - min), max - min);
  const point = view.start + (view.end - view.start) * anchor;
  return fitWindow({ start: point - span * anchor, end: point + span * (1 - anchor) }, min, max);
}
