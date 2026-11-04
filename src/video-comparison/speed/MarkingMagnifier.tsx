import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Point } from './types';
import { t } from '../../i18n/locale';

/** Samples the already corrected picture; the glass is never part of the video. */
export function MarkingMagnifier({
  point,
  source,
  surface,
  mirrored
}: {
  point: Point;
  source: RefObject<HTMLCanvasElement | null>;
  surface: RefObject<HTMLDivElement | null>;
  mirrored: boolean;
}) {
  const glass = useRef<HTMLCanvasElement>(null);
  const rect = surface.current?.getBoundingClientRect();
  const size = Math.min(116, (rect?.width ?? 120) * 0.45, (rect?.height ?? 120) * 0.7);
  const x = point.x * (rect?.width ?? 1),
    y = point.y * (rect?.height ?? 1);
  const left = Math.max(0, Math.min((rect?.width ?? size) - size, x - size / 2));
  const top = y > size + 32 ? y - size - 28 : Math.min((rect?.height ?? size) - size, y + 32);
  useLayoutEffect(() => {
    const image = source.current,
      canvas = glass.current;
    if (!image?.width || !canvas) return;
    const context = canvas.getContext('2d')!;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size * scale);
    context.scale(scale, scale);
    context.fillStyle = '#020405';
    context.fillRect(0, 0, size, size);
    context.save();
    if (mirrored) {
      context.translate(size, 0);
      context.scale(-1, 1);
    }
    const zoom = 4,
      sx = (mirrored ? 1 - point.x : point.x) * image.width,
      sy = point.y * image.height;
    const sw = ((size / zoom) * image.width) / (rect?.width ?? image.width);
    const sh = ((size / zoom) * image.height) / (rect?.height ?? image.height);
    context.drawImage(image, sx - sw / 2, sy - sh / 2, sw, sh, 0, 0, size, size);
    context.restore();
    context.strokeStyle = '#f8e92e';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(size / 2 - 12, size / 2);
    context.lineTo(size / 2 + 12, size / 2);
    context.moveTo(size / 2, size / 2 - 12);
    context.lineTo(size / 2, size / 2 + 12);
    context.stroke();
  }, [point, source, mirrored, size, rect?.width, rect?.height]);
  return (
    <canvas
      ref={glass}
      className="serve-magnifier"
      aria-label={t('Magnified placement preview')}
      style={{ left, top, width: size, height: size }}
    />
  );
}
