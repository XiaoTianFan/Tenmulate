import { clamp } from './timeline';

/** Normalized coordinates in the oriented source image, before mirroring. */
export type CropRect = { x: number; y: number; width: number; height: number };
export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
export function normalizeCrop(crop: CropRect = FULL_CROP): CropRect {
  const width = clamp(crop.width, 0.05, 1), height = clamp(crop.height, 0.05, 1);
  return { x: clamp(crop.x, 0, 1 - width), y: clamp(crop.y, 0, 1 - height), width, height };
}

export function cropForAspect(crop: CropRect, sourceAspect: number, aspect: number): CropRect {
  const ratio = aspect / sourceAspect;
  let width = crop.width, height = width / ratio;
  if (height > crop.height) { height = crop.height; width = height * ratio; }
  // Very thin previous selections should not make a preset impossible to edit.
  if (width < 0.05 || height < 0.05) {
    width = Math.min(1, ratio); height = width / ratio;
  }
  return normalizeCrop({ x: crop.x + (crop.width - width) / 2, y: crop.y + (crop.height - height) / 2, width, height });
}

export function resizeCrop(crop: CropRect, corner: string, dx: number, dy: number, ratio?: number): CropRect {
  const left = corner.includes('w'), top = corner.includes('n');
  const anchorX = left ? crop.x + crop.width : crop.x, anchorY = top ? crop.y + crop.height : crop.y;
  const maxWidth = left ? anchorX : 1 - anchorX, maxHeight = top ? anchorY : 1 - anchorY;
  let width = clamp(crop.width + (left ? -dx : dx), 0.05, maxWidth);
  let height = clamp(crop.height + (top ? -dy : dy), 0.05, maxHeight);
  if (ratio) {
    if (Math.abs(dx) > Math.abs(dy * ratio)) height = width / ratio; else width = height * ratio;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width *= scale; height *= scale;
    if (width < 0.05 || height < 0.05) return crop;
  }
  return { x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height };
}

/** Draw only the crop into a destination rectangle without allocating another bitmap. */
export function drawCropped(context: CanvasRenderingContext2D, draw: (x: number, y: number, w: number, h: number) => void,
  crop: CropRect | undefined, rect: { x: number; y: number; width: number; height: number }, mirrored = false) {
  const c = normalizeCrop(crop);
  context.save();
  context.beginPath(); context.rect(rect.x, rect.y, rect.width, rect.height); context.clip();
  if (mirrored) { context.translate(2 * rect.x + rect.width, 0); context.scale(-1, 1); }
  draw(rect.x - c.x * rect.width / c.width, rect.y - c.y * rect.height / c.height, rect.width / c.width, rect.height / c.height);
  context.restore();
}
