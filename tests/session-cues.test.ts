import { expect, it } from 'vitest';
import { crossedCues, type TimedCue } from '../src/engine/audio/sessionCues';
it('plays each timeline crossing once and ignores paused frames and seeks', () => {
  const cues: TimedCue[] = [{ time: 3, kind: 'contact' }, { time: 3.5, kind: 'bounce' }];
  expect(crossedCues(cues, 2.99, 3.01)).toEqual([cues[0]]);
  expect(crossedCues(cues, 3.01, 3.01)).toEqual([]);
  expect(crossedCues(cues, 3.01, 3.02)).toEqual([]);
  expect(crossedCues(cues, 3.8, 2.99)).toEqual([]);
  expect(crossedCues(cues, 0, 3.5)).toEqual([]);
  expect(crossedCues(cues, 3.49, 3.51)).toEqual([cues[1]]);
});
