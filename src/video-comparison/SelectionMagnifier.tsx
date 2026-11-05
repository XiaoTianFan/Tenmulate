import { useLayoutEffect, useRef, type RefObject } from 'react';
import { FULL_CROP, type CropRect } from './crop';
import { t } from '../i18n/locale';

import './SelectionMagnifier.css';

/** Reads the displayed frame without creating a decoder. Crop/mirror describe the
 * visible selection surface; a lens-corrected modal passes its corrected canvas. */
export function SelectionMagnifier({
  point,
  source,
  surface,
  mirrored,
  crop = FULL_CROP
}: {
  point: { x: number; y: number };
  source: RefObject<HTMLCanvasElement | null>;
  surface: RefObject<HTMLDivElement | null>;
  mirrored: boolean;
  crop?: CropRect;
}) {
  const glass = useRef<HTMLCanvasElement>(null);
  const rect = surface.current?.getBoundingClientRect();
  const size = Math.min(116, (rect?.width ?? 120) * 0.45, (rect?.height ?? 120) * 0.7);
  const x = point.x * (rect?.width ?? 1),
    y = point.y * (rect?.height ?? 1);
  const outer = size + 4,
    gap = 28,
    width = rect?.width ?? outer,
    height = rect?.height ?? outer;
  let left = x - outer / 2,
    top = y - outer - gap;
  if (top < 0) {
    if (y + gap + outer <= height) top = y + gap;
    else {
      // Shallow landscape cards have room beside the pointer instead of above it.
      top = y - outer / 2;
      if (x + gap + outer <= width) left = x + gap;
      else if (x - gap - outer >= 0) left = x - gap - outer;
      else {
        left = x < width / 2 ? width - outer : 0;
        top = y < height / 2 ? height - outer : 0;
      }
    }
  }
  left = Math.max(0, Math.min(width - outer, left));
  top = Math.max(0, Math.min(height - outer, top));
  useLayoutEffect(() => {
    const image = source.current,
      canvas = glass.current;
    if (!image?.width || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context || !rect?.width || !rect.height) return;
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
      sx = (crop.x + (mirrored ? 1 - point.x : point.x) * crop.width) * image.width,
      sy = (crop.y + point.y * crop.height) * image.height;
    const sw = ((size / zoom) * image.width * crop.width) / rect.width;
    const sh = ((size / zoom) * image.height * crop.height) / rect.height;
    const windowX = sx - sw / 2,
      windowY = sy - sh / 2;
    // Do not expose pixels outside the selected crop when aiming near an edge.
    const sourceX = Math.max(crop.x * image.width, windowX),
      sourceY = Math.max(crop.y * image.height, windowY);
    const sourceWidth = Math.min((crop.x + crop.width) * image.width, sx + sw / 2) - sourceX,
      sourceHeight = Math.min((crop.y + crop.height) * image.height, sy + sh / 2) - sourceY;
    if (sourceWidth > 0 && sourceHeight > 0)
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        ((sourceX - windowX) / sw) * size,
        ((sourceY - windowY) / sh) * size,
        (sourceWidth / sw) * size,
        (sourceHeight / sh) * size
      );
    context.restore();
    context.strokeStyle = '#f8e92e';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(size / 2 - 12, size / 2);
    context.lineTo(size / 2 + 12, size / 2);
    context.moveTo(size / 2, size / 2 - 12);
    context.lineTo(size / 2, size / 2 + 12);
    context.stroke();
  }, [point, source, source.current?.width, source.current?.height, mirrored, size, rect?.width, rect?.height, crop.x, crop.y, crop.width, crop.height]);
  return (
    <canvas
      ref={glass}
      className="selection-magnifier"
      aria-label={t('Magnified placement preview')}
      style={{ left, top, width: size, height: size }}
    />
  );
}
