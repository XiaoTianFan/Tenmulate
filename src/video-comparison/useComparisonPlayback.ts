import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComparisonClip } from './types';
import { frameForTime, clipFrameRange } from './timeline';
import { ComparisonPlayback } from './playback';
import { loadVideoTools } from './loadVideoTools';

type Props = {
  clips: ComparisonClip[];
  canvases: Map<string, HTMLCanvasElement>;
  time: number;
  rate: number;
  linked: boolean;
  playing: boolean;
  active: boolean;
  onTime: (time: number) => void;
  onPause: () => void;
  onError: (message: string) => void;
  onCompatibility: () => void;
  onPresented?: (id: string, frame: number) => void;
};

/** Manual seeks and shared decoded-frame playback have separate ownership. */
export function useComparisonPlayback(props: Props): boolean {
  const latest = useRef(props);
  const [buffering, setBuffering] = useState(false);
  useLayoutEffect(() => { latest.current = props; });

  useEffect(() => {
    if (!props.playing || !props.active || !props.linked) { setBuffering(false); return; }
    let stopped = false, request = 0;
    const controller = new AbortController();
    let engine: ComparisonPlayback | undefined;
    setBuffering(true);
    const tick = (now: number) => {
      if (!engine) return;
      if (stopped || !latest.current.playing || !latest.current.active || !latest.current.linked) {
        engine.dispose(); return;
      }
      engine.setRate(latest.current.rate, now);
      const result = engine.tick(now);
      latest.current.onTime(result.time);
      setBuffering(result.buffering);
      if (result.ended) { latest.current.onPause(); return; }
      request = requestAnimationFrame(tick);
    };
    void loadVideoTools(() => import('./decodedVideo'), controller.signal).then(({ decodeVideo }) => {
      if (stopped) return;
      const state = latest.current;
      const followers = state.clips.flatMap(clip => {
        const canvas = state.canvases.get(clip.id);
        if (!canvas || !clip.index || clip.contact === null || clip.error) return [];
        const aligned = { ...clip, index: clip.index, contact: clip.contact };
        const first = frameForTime(aligned, state.time);
        return [{ clip: aligned, source: decodeVideo(clip.file, clip.index, first, canvas, () => {
          if (!stopped) latest.current.onCompatibility();
        }, clipFrameRange(aligned).end, frame => latest.current.onPresented?.(clip.id, frame), state.clips.length) }];
      });
      // Anchor only after the module is ready; network time must not advance clips.
      engine = new ComparisonPlayback(followers, state.time, state.rate, performance.now(), message => {
        latest.current.onError(message); latest.current.onPause();
      });
      request = requestAnimationFrame(tick);
    }).catch(error => {
      if (!stopped) { latest.current.onError(error instanceof Error ? error.message : 'Could not load video tools. Check your connection and try again.'); latest.current.onPause(); }
    });
    const hide = () => { if (document.hidden) latest.current.onPause(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      stopped = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', hide);
      controller.abort(); engine?.dispose();
    };
  }, [props.playing, props.active, props.linked]);
  return buffering;
}
