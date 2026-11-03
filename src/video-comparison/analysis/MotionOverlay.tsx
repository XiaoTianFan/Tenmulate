import { useCallback, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ComparisonClip } from '../types';
import type { PresentedFrames } from './presentation';
import { drawMotion } from './draw';
export function usePresentedFrame(presentation: PresentedFrames, id: string) {
  return useSyncExternalStore(useCallback(listener => presentation.subscribe(id, listener), [presentation, id]), useCallback(() => presentation.get(id), [presentation, id]));
}
export function MotionOverlay({ clip, presentation, width, height }: { clip: ComparisonClip; presentation: PresentedFrames; width: number; height: number }) {
  const frame = usePresentedFrame(presentation, clip.id), canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const element = canvas.current; if (!element || !clip.index) return;
    const scale = Math.min(1, 1280 / Math.max(width, height)); const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
    const ctx = element.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, element.width, element.height);
    drawMotion(ctx, clip.motion, clip.index, frame, { x: 0, y: 0, width: element.width, height: element.height }, undefined, clip.mirrored);
  }, [clip.motion, clip.index, clip.mirrored, frame, width, height]);
  return <canvas ref={canvas} className="motion-overlay" aria-hidden="true" data-presented-frame={frame}/>;
}
