import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { loadVideoTools } from '../loadVideoTools';
import type { PreviewFrames } from '../previewFrames';
import type { FrameIndex } from '../timeline';
import { LensRenderer } from './lensRenderer';

type Cached = { canvas: HTMLCanvasElement; width: number; height: number };
/** Latest request wins. Keep the last picture while decoding, cache a few owned
 * snapshots, and never enable marking against a stale picture. Lens edits reuse
 * the decoded snapshot rather than seeking again. All resources belong to this modal. */
export function useMarkingPreview(
  file: File,
  index: FrameIndex,
  frame: number,
  canvas: RefObject<HTMLCanvasElement | null>,
  lens = 0
) {
  const [picture, setPicture] = useState({
    frame: -1,
    width: 0,
    height: 0,
    error: ''
  });
  const [attempt, retry] = useState(0);
  const requested = useRef(frame),
    strength = useRef(lens),
    request = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    requested.current = frame;
    strength.current = lens;
    request.current();
  }, [frame, lens]);
  useEffect(() => {
    const visible = canvas.current;
    const controller = new AbortController(),
      cache = new Map<number, Cached>();
    let source: PreviewFrames | undefined,
      renderer: LensRenderer | undefined,
      working = false,
      displayed = -1;
    setPicture({ frame: -1, width: 0, height: 0, error: '' });
    const draw = (target: number) => {
      const cached = cache.get(target),
        output = canvas.current;
      if (!cached || !output || controller.signal.aborted) return false;
      cache.delete(target);
      cache.set(target, cached);
      if (strength.current || renderer) {
        renderer ??= new LensRenderer();
        renderer.draw(cached.canvas, output, strength.current);
      } else {
        if (output.width !== cached.canvas.width || output.height !== cached.canvas.height) {
          output.width = cached.canvas.width;
          output.height = cached.canvas.height;
        }
        output.getContext('2d', { alpha: false })!.drawImage(cached.canvas, 0, 0);
      }
      displayed = target;
      output.dataset.frame = String(target);
      setPicture({
        frame: target,
        width: cached.width,
        height: cached.height,
        error: ''
      });
      return true;
    };
    const render = async () => {
      if (!source || controller.signal.aborted) return;
      try {
        if (draw(requested.current) || working) return;
      } catch (error) {
        setPicture((previous) => ({
          ...previous,
          frame: -1,
          error: error instanceof Error ? error.message : 'No readable video frames.'
        }));
        return;
      }
      working = true;
      try {
        while (!controller.signal.aborted) {
          const target = requested.current;
          try {
            if (draw(target)) break;
            const sample = await source.get(target, -10);
            try {
              if (controller.signal.aborted) break;
              if (!sample.width || !sample.height) throw new Error('No readable video frames.');
              const snapshot = document.createElement('canvas'),
                context = snapshot.getContext('2d', { alpha: false });
              if (!context) throw new Error('No readable video frames.');
              const scale = Math.min(1, 2560 / sample.width, 1440 / sample.height);
              snapshot.width = Math.max(1, Math.round(sample.width * scale));
              snapshot.height = Math.max(1, Math.round(sample.height * scale));
              try {
                sample.draw(context, 0, 0, snapshot.width, snapshot.height);
              } catch (error) {
                snapshot.width = snapshot.height = 0;
                throw error;
              }
              cache.set(target, {
                canvas: snapshot,
                width: sample.width,
                height: sample.height
              });
              // At most four frames / 24 MiB, plus the visible canvas. Never retain VideoFrames.
              let bytes = [...cache.values()].reduce(
                (sum, v) => sum + v.canvas.width * v.canvas.height * 4,
                0
              );
              for (const [key, entry] of cache) {
                if (cache.size <= 4 && bytes <= 24 * 1024 * 1024) break;
                if (key === target) continue;
                bytes -= entry.canvas.width * entry.canvas.height * 4;
                entry.canvas.width = entry.canvas.height = 0;
                cache.delete(key);
              }
              if (requested.current === target) draw(target);
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
          if (requested.current === target || displayed === requested.current) break;
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
        source = new module.PreviewFrames(
          file,
          index,
          canvas.current?.parentElement ?? undefined,
          2560 * 1440
        );
        void render();
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPicture((previous) => ({ ...previous, error: error.message }));
      });
    return () => {
      controller.abort();
      source?.dispose();
      renderer?.dispose();
      request.current = () => {};
      cache.forEach((v) => {
        v.canvas.width = v.canvas.height = 0;
      });
      cache.clear();
      if (visible) visible.width = visible.height = 0;
    };
  }, [file, index, attempt, canvas]);
  return {
    ...picture,
    ready: picture.frame === frame && !picture.error,
    retry: () => retry((value) => value + 1)
  };
}
