import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompiledSession } from '../engine/session/compileSession';

export type PlayerStatus = 'countdown' | 'playing' | 'paused' | 'completed';

export type SessionPlayer = Readonly<{
  status: PlayerStatus;
  elapsed: number;
  currentIndex: number;
  countdown: number | null;
  progress: number;
  play: () => void;
  pause: () => void;
  restart: () => void;
  previous: () => void;
  next: () => void;
}>;

export const useSessionPlayer = (session: CompiledSession, playbackRate: number): SessionPlayer => {
  const [status, setStatus] = useState<PlayerStatus>('countdown');
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const publishRef = useRef(0);

  const restart = useCallback(() => {
    elapsedRef.current = 0;
    lastFrameRef.current = null;
    setElapsed(0);
    setStatus('countdown');
  }, []);

  useEffect(() => restart(), [restart, session]);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      if (status === 'countdown' || status === 'playing') {
        const previous = lastFrameRef.current ?? now;
        elapsedRef.current += Math.min(0.08, (now - previous) / 1000) * playbackRate;
        lastFrameRef.current = now;
        if (elapsedRef.current >= session.duration) {
          elapsedRef.current = session.duration;
          setElapsed(session.duration);
          setStatus('completed');
        } else {
          const nextStatus = elapsedRef.current < 3 ? 'countdown' : 'playing';
          if (nextStatus !== status) setStatus(nextStatus);
          if (now - publishRef.current >= 40) {
            setElapsed(elapsedRef.current);
            publishRef.current = now;
          }
        }
      } else {
        lastFrameRef.current = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playbackRate, session.duration, status]);

  const currentIndex = Math.min(
    session.repetitions.length - 1,
    Math.max(0, Math.floor(Math.max(0, elapsed - 3) / session.settings.interval)),
  );

  const seekToIndex = useCallback((index: number) => {
    const bounded = Math.min(session.repetitions.length - 1, Math.max(0, index));
    const nextElapsed = 3 + bounded * session.settings.interval;
    elapsedRef.current = nextElapsed;
    setElapsed(nextElapsed);
    setStatus('paused');
  }, [session]);

  return useMemo(() => ({
    status,
    elapsed,
    currentIndex,
    countdown: status === 'countdown' ? Math.max(1, Math.ceil(3 - elapsed)) : null,
    progress: session.duration <= 0 ? 0 : elapsed / session.duration,
    play: () => setStatus(elapsedRef.current < 3 ? 'countdown' : 'playing'),
    pause: () => setStatus('paused'),
    restart,
    previous: () => seekToIndex(currentIndex - 1),
    next: () => seekToIndex(currentIndex + 1),
  }), [currentIndex, elapsed, restart, seekToIndex, session.duration, status]);
};
