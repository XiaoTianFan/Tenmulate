import type { CompiledSession } from '../session/compileSession';

export type TimedCue = Readonly<{ time: number; kind: 'contact' | 'bounce' | 'footwork' }>;
export const sessionCues = (session: CompiledSession): TimedCue[] => session.repetitions.flatMap(repetition => {
  const cues: TimedCue[] = [{ time: repetition.startTime, kind: 'contact' }];
  const bounce = repetition.trajectory.events.find(event => event.type === 'bounce');
  const receiver = repetition.trajectory.events.find(event => event.type === 'receiver-plane');
  if (bounce) cues.push({ time: repetition.startTime + bounce.time, kind: 'bounce' });
  if (receiver) cues.push({ time: repetition.startTime + Math.max(.08, receiver.time - .55), kind: 'footwork' });
  return cues;
}).sort((a, b) => a.time - b.time);

/** Pauses and seeks do not replay an impact; ordinary frame crossings do. */
export const crossedCues = (cues: readonly TimedCue[], previous: number, current: number): readonly TimedCue[] =>
  current <= previous || current - previous > .2 ? [] : cues.filter(cue => cue.time > previous && cue.time <= current);
