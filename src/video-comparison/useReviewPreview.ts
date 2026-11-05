import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { loadVideoTools } from './loadVideoTools';
import type { ReviewSession } from './reviewSession';
import type { ReviewImage } from './reviewCache';
import type { FrameIndex } from './timeline';

type Options = {
  pixels: number;
  retainDetail?: boolean;
  revision?: number;
  paint?: (image: ReviewImage, output: HTMLCanvasElement) => void;
  onPresented?: (frame: number) => void;
};
/** Card and marking dialog share cache ownership and request scheduling. Only a
 * successfully painted source frame makes annotations ready. */
export function useReviewPreview(
  file: File,
  index: FrameIndex | undefined,
  frame: number,
  active: boolean,
  canvas: RefObject<HTMLCanvasElement | null>,
  options: Options
) {
  const [picture, setPicture] = useState({
    frame: -1,
    width: 0,
    height: 0,
    busy: true,
    error: '',
    recovering: false
  });
  const [attempt, retry] = useState(0);
  const session = useRef<ReviewSession | undefined>(undefined);
  const latest = useRef({ frame, active, options });
  useLayoutEffect(() => {
    latest.current = { frame, active, options };
  });
  useLayoutEffect(() => {
    session.current?.request(frame, true);
  }, [frame, options.revision]);
  useEffect(() => {
    if (!index) return;
    const controller = new AbortController();
    let reader: ReviewSession | undefined;
    setPicture((previous) => ({ ...previous, busy: true, error: '' }));
    const activate = () => reader?.setActive(latest.current.active && !document.hidden);
    document.addEventListener('visibilitychange', activate);
    void loadVideoTools(() => import('./reviewSession'), controller.signal)
      .then((module) => {
        if (controller.signal.aborted) return;
        reader = new module.ReviewSession({
          file,
          index,
          pixels: options.pixels,
          retainDetail: options.retainDetail,
          host: canvas.current?.parentElement ?? undefined,
          pending: (busy) => {
            if (!controller.signal.aborted) setPicture((p) => (p.busy === busy ? p : { ...p, busy }));
          },
          error: (error) => {
            if (controller.signal.aborted) return;
            latest.current.options.onPresented?.(-1);
            setPicture((p) => ({ ...p, frame: -1, busy: false, error }));
          },
          present: (image, detail) => {
            if (controller.signal.aborted) return;
            const output = canvas.current,
              context = output?.getContext('2d', { alpha: false });
            if (!output || !context) throw new Error('Could not create the preview canvas.');
            if (context.isContextLost?.())
              throw new Error('Preview memory was released by the browser. Retry the preview.');
            if (latest.current.options.paint) latest.current.options.paint(image, output);
            else {
              if (output.width !== image.canvas.width || output.height !== image.canvas.height) {
                output.width = image.canvas.width;
                output.height = image.canvas.height;
              }
              context.drawImage(image.canvas, 0, 0);
            }
            output.hidden = false;
            output.dataset.frame = String(image.frame);
            output.dataset.sourceWidth = String(image.width);
            output.dataset.sourceHeight = String(image.height);
            output.dataset.quality = detail ? 'detail' : 'preview';
            setPicture({
              frame: image.frame,
              width: image.width,
              height: image.height,
              busy: false,
              error: '',
              recovering: false
            });
            latest.current.options.onPresented?.(image.frame);
          }
        });
        session.current = reader;
        activate();
        reader.request(latest.current.frame);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPicture((p) => ({ ...p, busy: false, error: error.message }));
      });
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', activate);
      reader?.dispose();
      session.current = undefined;
    };
  }, [file, index, canvas, options.pixels, options.retainDetail, attempt]);
  useEffect(() => {
    session.current?.setActive(active && !document.hidden);
  }, [active]);
  useEffect(() => {
    const output = canvas.current;
    const lost = (event: Event) => {
      event.preventDefault();
      session.current?.setActive(false);
      latest.current.options.onPresented?.(-1);
      setPicture((p) => ({
        ...p,
        frame: -1,
        busy: false,
        error: 'Preview memory was released by the browser. Retry the preview.'
      }));
    };
    const restore = () => retry((value) => value + 1);
    output?.addEventListener('contextlost', lost);
    output?.addEventListener('contextrestored', restore);
    return () => {
      output?.removeEventListener('contextlost', lost);
      output?.removeEventListener('contextrestored', restore);
      if (output) output.width = output.height = 0;
    };
  }, [canvas]);
  return {
    ...picture,
    ready: picture.frame === frame && !picture.error,
    retry: () => retry((value) => value + 1)
  };
}
