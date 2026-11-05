import { useEffect, useRef, type RefObject } from 'react';
import type { FrameIndex } from '../timeline';
import { useReviewPreview } from '../useReviewPreview';
import { LensRenderer } from './lensRenderer';

/** A full-detail current snapshot keeps lens edits decoder-free. Navigation uses
 * the same bounded nearby-frame cache as the card, even across dialog reopenings. */
export function useMarkingPreview(
  file: File,
  index: FrameIndex,
  frame: number,
  canvas: RefObject<HTMLCanvasElement | null>,
  lens = 0
) {
  const renderer = useRef<LensRenderer | undefined>(undefined);
  useEffect(
    () => () => {
      renderer.current?.dispose();
      renderer.current = undefined;
    },
    [file, index]
  );
  return useReviewPreview(file, index, frame, true, canvas, {
    pixels: 2560 * 1440,
    retainDetail: true,
    revision: lens,
    paint: (image, output) => {
      if (lens || renderer.current) {
        renderer.current ??= new LensRenderer();
        renderer.current.draw(image.canvas, output, lens);
      } else {
        if (output.width !== image.canvas.width || output.height !== image.canvas.height) {
          output.width = image.canvas.width;
          output.height = image.canvas.height;
        }
        output.getContext('2d', { alpha: false })!.drawImage(image.canvas, 0, 0);
      }
    }
  });
}
