import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComparisonClip } from './types';
import { frameAt, mediaTime } from './timeline';
import { ComparisonPlayback, seekVideoFrame } from './playback';

type Props = {
  clips: ComparisonClip[];
  videos: Map<string, HTMLVideoElement>;
  time: number;
  rate: number;
  linked: boolean;
  playing: boolean;
  active: boolean;
  onTime: (time: number) => void;
  onPause: () => void;
  onError: (message: string) => void;
};

/** Manual seeks and continuous native playback have separate ownership. */
export function useComparisonPlayback(props: Props): boolean {
  const latest = useRef(props);
  const [buffering, setBuffering] = useState(false);
  useLayoutEffect(() => { latest.current = props; });

  useEffect(() => {
    if (props.playing && props.active && props.linked) return;
    for (const clip of props.clips) {
      const video = props.videos.get(clip.id);
      if (!video) continue;
      video.pause();
      if (!clip.index || video.readyState < 1 || clip.error) continue;
      const frame = props.linked && clip.contact !== null
        ? frameAt(clip.index, mediaTime({ index: clip.index, contact: clip.contact, speed: clip.speed }, props.time)) : clip.frame;
      seekVideoFrame(video, clip.index, frame);
    }
  }, [props.clips, props.videos, props.time, props.linked, props.playing, props.active]);

  useEffect(() => {
    if (!props.playing || !props.active || !props.linked) { setBuffering(false); return; }
    let stopped = false, request = 0;
    const state = latest.current;
    const followers = state.clips.flatMap(clip => {
      const video = state.videos.get(clip.id);
      return video && clip.index && clip.contact !== null && !clip.error
        ? [{ clip: { index: clip.index, contact: clip.contact, speed: clip.speed }, video }] : [];
    });
    const engine = new ComparisonPlayback(followers, state.time, state.rate, performance.now(), message => {
      latest.current.onError(message); latest.current.onPause();
    });
    const tick = (now: number) => {
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
    request = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) latest.current.onPause(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      stopped = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', hide);
      engine.dispose();
    };
  }, [props.playing, props.active, props.linked]);
  return buffering;
}
