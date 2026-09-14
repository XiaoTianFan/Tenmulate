import type { DrillDefinitionV2 } from '../content/types';
import { MAX_PLAYER_DRILL_SHOTS } from '../engine/session/compilePlayerDrill';

/** A repetition is one complete authored drill, not an individual player shot. */
export type DrillPracticeSet = Readonly<{ repetitions: number; restSeconds: number }>;
export const maxDrillRepetitions = (drill: DrillDefinitionV2) =>
  Math.max(1, Math.floor(MAX_PLAYER_DRILL_SHOTS / Math.max(1, drill.events.length)));

export function drillPracticeSetSettings(drill: DrillDefinitionV2, set: DrillPracticeSet) {
  if (!drill.events.length || !Number.isInteger(set.repetitions) || set.repetitions < 1 || set.repetitions > maxDrillRepetitions(drill)
    || !Number.isFinite(set.restSeconds) || set.restSeconds < 0 || set.restSeconds > 120) {
    throw new Error('Choose a valid drill repetition count and a rest between 0 and 120 seconds.');
  }
  return { repetitions: drill.events.length * set.repetitions, workBlockSize: drill.events.length, restSeconds: set.restSeconds };
}
