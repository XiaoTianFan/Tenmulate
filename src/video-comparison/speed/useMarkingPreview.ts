import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { loadVideoTools } from '../loadVideoTools';
import type { PreviewFrames } from '../previewFrames';
import type { FrameIndex } from '../timeline';

/** Own one independent decoder. Scrubs coalesce and only the latest completed
 * picture enables marking; no request writes into the comparison playback clock. */
export function useMarkingPreview(
  file: File,
  index: FrameIndex,
  frame: number,
  canvas: RefObject<HTMLCanvasElement | null>
) {
  const [picture, setPicture] = useState({ frame: -1, width: 0, height: 0, error: '' });
  const [attempt, retry] = useState(0);
  const requested = useRef(frame),
    request = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    requested.current = frame;
    request.current();
  }, [frame]);
  useEffect(() => {
    const controller = new AbortController();
    let source: PreviewFrames | undefined,
      working = false;
    setPicture({ frame: -1, width: 0, height: 0, error: '' });
    const render = async () => {
      if (!source || working || controller.signal.aborted) return;
      working = true;
      try {
        while (!controller.signal.aborted) {
          const target = requested.current;
          try {
            const sample = await source.get(target);
            try {
              if (controller.signal.aborted) break;
              if (requested.current !== target) continue;
              const output = canvas.current,
                context = output?.getContext('2d', { alpha: false });
              if (!output || !context || !sample.width || !sample.height) throw new Error('No readable video frames.');
              const scale = Math.min(1, 2560 / sample.width, 1440 / sample.height);
              output.width = Math.max(1, Math.round(sample.width * scale));
              output.height = Math.max(1, Math.round(sample.height * scale));
              sample.draw(context, 0, 0, output.width, output.height);
              output.dataset.frame = String(target);
              setPicture({ frame: target, width: sample.width, height: sample.height, error: '' });
            } finally {
              sample.close();
            }
          } catch (error) {
            if (!controller.signal.aborted && requested.current === target)
              setPicture((previous) => ({
                ...previous,
                frame: -1,
                error: error instanceof Error ? error.message : 'No readable video frames.'
              }));
          }
          if (requested.current === target) break;
        }
      } finally {
        working = false;
      }
    };
    request.current = () => {
      void render();
    };
    void loadVideoTools(() => import('../previewFrames'), controller.signal)
      .then((module) => {
        if (controller.signal.aborted) return;
        source = new module.PreviewFrames(file, index, canvas.current?.parentElement ?? undefined);
        void render();
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPicture((previous) => ({ ...previous, error: error.message }));
      });
    return () => {
      controller.abort();
      source?.dispose();
      request.current = () => {};
    };
  }, [file, index, attempt, canvas]);
  return { ...picture, ready: picture.frame === frame && !picture.error, retry: () => retry((value) => value + 1) };
}
