import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComparisonClip } from './types';
import { clamp, comparisonRange, frameAt, frameSeekTime, mediaTime } from './timeline';

type Props = {
  clips: ComparisonClip[];
  videos: Map<string, HTMLVideoElement>;
  time: number;
  linked: boolean;
  playing: boolean;
  active: boolean;
  onTime: (time: number) => void;
  onPause: () => void;
  onError: (message: string) => void;
};

/** One wall clock; media clocks are followers. Buffering pauses the whole group. */
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
      const target = frameSeekTime(clip.index, frame);
      if (Math.abs(video.currentTime - target) > 0.0001) video.currentTime = target;
    }
  }, [props.clips, props.videos, props.time, props.linked, props.playing, props.active]);

  useEffect(() => {
    if (!props.playing || !props.active || !props.linked) { setBuffering(false); return; }
    let stopped = false, request = 0, previous = performance.now();
    const pending = new Set<HTMLVideoElement>();
    const tick = (now: number) => {
      if (stopped) return;
      const state = latest.current;
      const ready = state.clips.flatMap(clip => clip.index && clip.contact !== null && !clip.error
        ? [{ ...clip, index: clip.index, contact: clip.contact }] : []);
      const range = comparisonRange(ready);
      const followers = ready.map(clip => ({ clip, video: state.videos.get(clip.id), target: mediaTime(clip, state.time) }));
      const isMoving = ({ clip, target }: typeof followers[number]) => target >= clip.index.timestamps[0]!
        && target < clip.index.timestamps[clip.index.timestamps.length - 1]!;
      const waiting = followers.some(item => isMoving(item) && (!item.video || item.video.seeking || item.video.readyState < 3));
      setBuffering(waiting);
      const time = clamp(state.time + (waiting ? 0 : Math.min((now - previous) / 1000, 0.1)), range.start, range.end);
      previous = now;
      for (const item of followers) {
        const { clip, video } = item;
        if (!video || video.readyState < 1) continue;
        const target = mediaTime(clip, time);
        const frame = frameAt(clip.index, target);
        if (waiting || !isMoving({ ...item, target })) {
          video.pause();
          if (!waiting && !video.seeking && frameAt(clip.index, video.currentTime) !== frame) video.currentTime = frameSeekTime(clip.index, frame);
          continue;
        }
        video.playbackRate = clip.speed;
        if (!video.seeking && Math.abs(video.currentTime - target) > Math.max(0.04, 2 / clip.index.fps)) {
          video.currentTime = frameSeekTime(clip.index, frame);
        }
        if (video.paused && !pending.has(video)) {
          pending.add(video);
          void video.play().then(() => { if (stopped) video.pause(); }).catch(error => {
            if (!stopped && error?.name !== 'AbortError') {
              state.onError('Playback could not start. Try another video codec.'); state.onPause();
            }
          }).finally(() => pending.delete(video));
        }
      }
      state.onTime(time);
      if (time >= range.end) { state.onPause(); return; }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) latest.current.onPause(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      stopped = true; cancelAnimationFrame(request); document.removeEventListener('visibilitychange', hide);
      for (const video of latest.current.videos.values()) video.pause();
    };
  }, [props.playing, props.active, props.linked]);
  return buffering;
}
