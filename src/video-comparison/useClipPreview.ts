import type { RefObject } from 'react';
import { REVIEW_PIXELS } from './mediaResources';
import type { FrameIndex } from './timeline';
import { useReviewPreview } from './useReviewPreview';

export function useClipPreview(
  file: File,
  index: FrameIndex | undefined,
  frame: number,
  active: boolean,
  canvas: RefObject<HTMLCanvasElement | null>,
  onPresented: (frame: number) => void
) {
  return useReviewPreview(file, index, frame, active, canvas, { pixels: REVIEW_PIXELS, onPresented });
}
