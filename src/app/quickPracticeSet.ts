/** Keep legacy totals intact, including a shorter final set, until a set control
 * is edited. New configurations always contain complete sets. */
export function quickPracticeSet(repetitions: number, workBlockSize: number) {
  const repsPerSet = Math.max(1, Math.floor(workBlockSize));
  return { repsPerSet, sets: Math.ceil(repetitions / repsPerSet),
    lastSetReps: repetitions % repsPerSet || repsPerSet };
}

export function quickPracticeSetTotal(repsPerSet: number, sets: number) {
  if (!Number.isInteger(repsPerSet) || repsPerSet < 1 || !Number.isInteger(sets) || sets < 1 || repsPerSet * sets > 1000) {
    throw new Error('Choose whole sets and repetitions, up to 1000 total repetitions.');
  }
  return repsPerSet * sets;
}
