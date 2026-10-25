import { expect, it } from 'vitest';
import { quickPracticeSet, quickPracticeSetTotal } from '../src/app/quickPracticeSet';

it('derives sets from existing saves without increasing a partial final set', () => {
  expect(quickPracticeSet(12, 4)).toEqual({ sets: 3, repsPerSet: 4, lastSetReps: 4 });
  expect(quickPracticeSet(10, 4)).toEqual({ sets: 3, repsPerSet: 4, lastSetReps: 2 });
  expect(quickPracticeSet(2, 4)).toEqual({ sets: 1, repsPerSet: 4, lastSetReps: 2 });
});

it('uses complete sets after either set control changes and bounds preparation work', () => {
  expect(quickPracticeSetTotal(4, 3)).toBe(12);
  expect(quickPracticeSetTotal(5, 3)).toBe(15);
  for (const [reps, sets] of [[0, 3], [4, 0], [1.5, 3], [4, NaN], [51, 20]]) {
    expect(() => quickPracticeSetTotal(reps!, sets!)).toThrow();
  }
});
