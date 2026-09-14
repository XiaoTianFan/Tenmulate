import { describe, expect, it } from 'vitest';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { defaultDrillSettings } from '../src/app/defaults';
import { drillPracticeSetSettings, maxDrillRepetitions } from '../src/app/drillPracticeSet';
import { compileSession } from '../src/engine/session/compileSession';
import { motionEvent } from '../src/engine/session/opponentTimeline';

const drill = PLAYER_DRILLS.find(drill => drill.id === 'return-practice')!;

describe('complete drill repetitions and rest', () => {
  it('repeats the whole serve-return sequence and rests only between runs', () => {
    const settings = defaultDrillSettings(drill, undefined, undefined, undefined, { repetitions: 3, restSeconds: 7 });
    const session = compileSession(drill, settings);
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents!.map(event => event.event.id)).toEqual(Array.from({ length: 3 }, () => drill.events.map(event => event.id)).flat());
    expect(session.restPeriods).toHaveLength(2);
    for (const [index, rest] of session.restPeriods.entries()) {
      const lastIndex = (index + 1) * drill.events.length - 1;
      expect(rest.afterIndex).toBe(lastIndex);
      expect(rest.endTime - rest.startTime).toBeCloseTo(7);
      const winner = session.scheduledFlights!.find(flight => flight.phase === 'player' && flight.eventIndex === lastIndex)!;
      expect(rest.startTime).toBeGreaterThanOrEqual(winner.endTime);
      const next = session.playerEvents![lastIndex + 1]!;
      expect(motionEvent(session.repetitions[next.incomingIndex]!).start).toBeGreaterThanOrEqual(rest.endTime);
      expect(session.playerEvents![lastIndex]!.responseIndex).toBeUndefined();
    }
  });

  it.each([{ repetitions: 1, restSeconds: 20 }, { repetitions: 2, restSeconds: 0 }])('runs $repetitions complete repetitions without an extra rest', set => {
    const session = compileSession(drill, defaultDrillSettings(drill, undefined, undefined, undefined, set));
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents).toHaveLength(drill.events.length * set.repetitions);
    expect(session.restPeriods).toEqual([]);
    expect(session.playerEvents!.at(-1)!.responseIndex).toBeUndefined();
  });

  it('rejects invalid inputs and keeps the maximum within complete runs', () => {
    const oddLength = { ...drill, events: Array.from({ length: 7 }, () => drill.events[0]!) };
    expect(maxDrillRepetitions(oddLength)).toBe(28);
    expect(drillPracticeSetSettings(oddLength, { repetitions: 28, restSeconds: 120 })).toEqual({ repetitions: 196, workBlockSize: 7, restSeconds: 120 });
    for (const repetitions of [0, -1, 1.5, NaN, Infinity, 29]) expect(() => drillPracticeSetSettings(oddLength, { repetitions, restSeconds: 20 })).toThrow();
    for (const restSeconds of [-1, 121, NaN, Infinity]) expect(() => drillPracticeSetSettings(drill, { repetitions: 1, restSeconds })).toThrow();
  });
});
