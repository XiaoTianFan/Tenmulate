import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CompiledSession } from '../engine/session/compileSession';

export type PlayerStatus = 'countdown' | 'playing' | 'resting' | 'paused' | 'completed';

export type SessionPlayer = Readonly<{
  status: PlayerStatus;
  elapsed: number;
  clock: Readonly<{ current: number }>;
  currentIndex: number;
  countdown: number | null;
  restRemaining: number | null;
  currentSet: number;
  setCount: number;
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
  const firstContact = session.repetitions[0]?.startTime ?? 3;

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
      if (status === 'countdown' || status === 'playing' || status === 'resting') {
        const previous = lastFrameRef.current ?? now;
        elapsedRef.current += Math.min(0.08, (now - previous) / 1000) * playbackRate;
        lastFrameRef.current = now;
        if (elapsedRef.current >= session.duration) {
          elapsedRef.current = session.duration;
          setElapsed(session.duration);
          setStatus('completed');
        } else {
          const resting = session.restPeriods.some((period) => elapsedRef.current >= period.startTime && elapsedRef.current < period.endTime);
          const nextStatus = elapsedRef.current < firstContact ? 'countdown' : resting ? 'resting' : 'playing';
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
  }, [playbackRate, session.duration, firstContact, session.restPeriods, status]);

  const actions = session.playerEvents ?? session.repetitions;
  const currentIndex = actions.reduce((active, repetition, index) => elapsed >= repetition.startTime ? index : active, session.playerEvents ? -1 : 0);
  const activeRest = session.restPeriods.find((period) => elapsed >= period.startTime && elapsed < period.endTime);

  const seekToIndex = useCallback((index: number) => {
    const actions = session.playerEvents ?? session.repetitions;
    const bounded = Math.min(actions.length - 1, Math.max(0, index));
    const nextElapsed = index < 0 && session.playerEvents ? 0 : actions[bounded]?.startTime ?? 0;
    elapsedRef.current = nextElapsed;
    setElapsed(nextElapsed);
    setStatus('paused');
  }, [session]);

  return useMemo(() => ({
    status,
    elapsed,
    clock: elapsedRef,
    currentIndex,
    countdown: status === 'countdown' ? Math.max(1, Math.ceil(firstContact - elapsed)) : null,
    restRemaining: activeRest ? Math.max(1, Math.ceil(activeRest.endTime - elapsed)) : null,
    currentSet: Math.floor(Math.max(0, currentIndex) / Math.max(1, session.settings.workBlockSize)) + 1,
    setCount: Math.ceil(actions.length / Math.max(1, session.settings.workBlockSize)),
    progress: session.duration <= 0 ? 0 : elapsed / session.duration,
    play: () => {
      const resting = session.restPeriods.some((period) => elapsedRef.current >= period.startTime && elapsedRef.current < period.endTime);
      setStatus(elapsedRef.current < firstContact ? 'countdown' : resting ? 'resting' : 'playing');
    },
    pause: () => setStatus('paused'),
    restart,
    previous: () => seekToIndex(currentIndex - 1),
    next: () => seekToIndex(currentIndex + 1),
  }), [activeRest, currentIndex, elapsed, firstContact, restart, seekToIndex, session, status]);
};
