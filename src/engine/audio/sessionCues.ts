import type { CompiledSession } from '../session/compileSession';

export type TimedCue = Readonly<{ time: number; kind: 'contact' | 'bounce' | 'footwork' }>;
export const sessionCues = (session: CompiledSession): TimedCue[] => {
  if (session.scheduledFlights) return [
    ...session.scheduledFlights.flatMap(flight => [
      { time: flight.startTime, kind: 'contact' as const },
      ...flight.trajectory.events.filter(event => event.type === 'bounce' && flight.startTime + event.time <= flight.endTime)
        .map(event => ({ time: flight.startTime + event.time, kind: 'bounce' as const })),
    ]),
    ...(session.playerEvents ?? []).map(event => ({ time: Math.max(0, event.startTime - .55), kind: 'footwork' as const })),
  ].sort((a, b) => a.time - b.time);
  return session.repetitions.flatMap(repetition => {
  const cues: TimedCue[] = [{ time: repetition.startTime, kind: 'contact' }];
  const bounce = repetition.trajectory.events.find(event => event.type === 'bounce');
  const receiver = repetition.trajectory.events.find(event => event.type === 'receiver-plane');
  if (bounce && bounce.time <= (repetition.rallyReturn?.contactTime ?? Infinity)) cues.push({ time: repetition.startTime + bounce.time, kind: 'bounce' });
  if(repetition.rallyReturn){
    const rally=repetition.rallyReturn;
    cues.push({time:repetition.startTime+rally.contactTime,kind:'contact'});
    const returnBounce=rally.trajectory.events.find(event=>event.type==='bounce');
    if(returnBounce)cues.push({time:repetition.startTime+rally.contactTime+returnBounce.time,kind:'bounce'});
  }
  const responseTime=repetition.rallyReturn?.contactTime??receiver?.time;
  if (responseTime!==undefined) cues.push({ time: repetition.startTime + Math.max(.08, responseTime - .55), kind: 'footwork' });
  return cues;
}).sort((a, b) => a.time - b.time);
};

/** Pauses and seeks do not replay an impact; ordinary frame crossings do. */
export const crossedCues = (cues: readonly TimedCue[], previous: number, current: number): readonly TimedCue[] =>
  current <= previous || current - previous > .2 ? [] : cues.filter(cue => cue.time > previous && cue.time <= current);
