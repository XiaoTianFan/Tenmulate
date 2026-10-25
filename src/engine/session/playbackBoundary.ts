import type { CompiledSession } from './compileSession';

/** A partial session is a buffer, never an early end of the requested practice. */
export function playbackBoundary(session: CompiledSession, requestedTime: number) {
  const limit = session.preparation?.playableUntil ?? session.duration;
  return { time: Math.min(requestedTime, limit),
    buffering: !!session.preparation && requestedTime >= limit,
    completed: !session.preparation && requestedTime >= limit };
}
