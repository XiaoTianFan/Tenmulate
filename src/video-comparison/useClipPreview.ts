import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { PreviewFrames } from './previewFrames';
import { loadVideoTools } from './loadVideoTools';
import { REVIEW_PIXELS, reviewSize } from './mediaResources';
import type { FrameIndex } from './timeline';

/** Last-request-wins review. A decoded picture, never metadata/seek completion,
 * publishes the frame used by annotations and motion overlays. */
export function useClipPreview(file: File, index: FrameIndex | undefined, frame: number, active: boolean,
  canvas: RefObject<HTMLCanvasElement | null>, onPresented: (frame: number) => void) {
  const [picture, setPicture] = useState({ width: 0, height: 0, busy: true, error: '', recovering: false });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ frame, onPresented }), request = useRef(() => {});
  useLayoutEffect(() => { latest.current = { frame, onPresented }; request.current(); }, [frame, onPresented]);
  useEffect(() => {
    if (!active || !index) return;
    const controller = new AbortController();
    let source: PreviewFrames | undefined, working = false, failed = false, shown = -1;
    const render = async () => {
      if (!source || working || failed || controller.signal.aborted || shown === latest.current.frame) return;
      working = true;
      setPicture(previous => ({ ...previous, busy: true, error: '' }));
      try {
        while (!controller.signal.aborted) {
          const target = latest.current.frame;
          for (let pass = 0; pass < 2; pass++) {
            try {
              const sample = await source.get(target);
              try {
                if (controller.signal.aborted || target !== latest.current.frame) break;
                const output = canvas.current, context = output?.getContext('2d', { alpha: false });
                if (!output || !context) throw new Error('Could not create the preview canvas.');
                if (context.isContextLost?.()) throw new Error('Preview memory was released by the browser. Retry the preview.');
                const size = reviewSize(sample.width, sample.height);
                if (output.width !== size.width || output.height !== size.height) { output.width = size.width; output.height = size.height; }
                sample.draw(context, 0, 0, size.width, size.height);
                output.hidden = false; output.dataset.frame = String(target);
                output.dataset.sourceWidth = String(sample.width); output.dataset.sourceHeight = String(sample.height);
                shown = target;
                setPicture({ width: sample.width, height: sample.height, busy: false, error: '', recovering: false });
                latest.current.onPresented(target);
              } finally { sample.close(); }
              break;
            } catch (error) {
              if (controller.signal.aborted || target !== latest.current.frame) break;
              if (!pass) { source.useNative(); setPicture(previous => ({ ...previous, recovering: true })); }
              else {
                failed = true; source.dispose();
                setPicture(previous => ({ ...previous, busy: false, recovering: false,
                  error: error instanceof Error ? error.message : 'Unable to decode this video. Try converting it to H.264 MP4.' }));
              }
            }
          }
          if (failed || target === latest.current.frame) break;
        }
      } finally { working = false; }
    };
    request.current = () => { void render(); };
    setPicture(previous => ({ ...previous, busy: true, error: '', recovering: false }));
    void loadVideoTools(() => import('./previewFrames'), controller.signal).then(module => {
      if (controller.signal.aborted) return;
      source = new module.PreviewFrames(file, index, canvas.current?.parentElement ?? undefined, REVIEW_PIXELS);
      void render();
    }).catch(error => {
      if (!controller.signal.aborted) setPicture(previous => ({ ...previous, busy: false, error: error.message }));
    });
    return () => { controller.abort(); source?.dispose(); request.current = () => {}; };
  }, [file, index, active, attempt, canvas]);
  useEffect(() => {
    const output = canvas.current;
    const restore = () => setAttempt(value => value + 1);
    const lost = (event: Event) => {
      event.preventDefault(); latest.current.onPresented(-1);
      setPicture(previous => ({ ...previous, busy: false, error: 'Preview memory was released by the browser. Retry the preview.' }));
    };
    output?.addEventListener('contextlost', lost);
    output?.addEventListener('contextrestored', restore);
    return () => {
      output?.removeEventListener('contextlost', lost); output?.removeEventListener('contextrestored', restore);
      if (output) output.width = output.height = 0;
    };
  }, [canvas]);
  return { ...picture, retry: () => setAttempt(value => value + 1) };
}
