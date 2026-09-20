import { expect, it } from 'vitest';
import { previewFlightCues, PreviewAudioCursor } from '../src/engine/audio/previewCues';
import { AudioCueCursor } from '../src/engine/audio/spatialCues';
import type { ResolvedTrajectory } from '../src/engine/trajectory/physics';

const trajectory = { intent: { source: { x: 0, y: 2, z: 10 } }, resolved: { launchSpeedKmh: 90 },
  events: [{ type: 'bounce', time: .1, position: { x: 0, y: 0, z: -4 }, speedKmh: 60 }] } as unknown as ResolvedTrajectory;

it('uses rendered flight ages for new continuous batches instead of the original session times', () => {
  const cursor = new AudioCueCursor();
  cursor.advance([], 99.99, true);
  const start = previewFlightCues(100.01, [{ trajectory, time: .01 }]);
  expect(cursor.advance(start, 100.01, true).map(cue => cue.kind)).toEqual(['contact']);
  const bounce = previewFlightCues(100.11, [{ trajectory, time: .11 }]);
  expect(cursor.advance(bounce, 100.11, true).map(cue => cue.kind)).toEqual(['bounce']);
  expect(cursor.advance(bounce, 100.11, true)).toEqual([]);
});

it('replays an editor loop after its clock wraps without replaying crossed cues on a seek', () => {
  const cursor = new AudioCueCursor();
  const cues = previewFlightCues(2.51, [{ trajectory, time: .11 }]);
  cursor.advance([], 2.39, true);
  expect(cursor.advance(cues, 2.51, true)).toHaveLength(2);
  expect(cursor.advance(cues, 2.39, true)).toEqual([]);
  expect(cursor.advance(cues, 2.51, true)).toHaveLength(2);
  expect(cursor.advance(cues, 5, true)).toEqual([]);
  expect(cursor.advance(cues, 2.51, false)).toEqual([]);
});

it('sounds a zero-time opening once per preview loop', () => {
  const cursor = new PreviewAudioCursor();
  const cues = previewFlightCues(0, [{ trajectory, time: 0 }]);
  expect(cursor.advance(cues, 0, true)).toHaveLength(1);
  expect(cursor.advance(cues, 0, true)).toEqual([]);
  cursor.advance([], 3, true);
  expect(cursor.advance(cues, 0, true)).toHaveLength(1);
});
