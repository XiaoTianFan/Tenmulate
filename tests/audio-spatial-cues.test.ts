import { expect, it } from 'vitest';
import { AudioCueCursor, cueSpatialMix, spatialSessionCues, type SpatialCue } from '../src/engine/audio/spatialCues';
import type { CompiledSession } from '../src/engine/session/compileSession';

const cues: SpatialCue[] = [0, .1, .3, 1].map((time, index) => ({ time, id: `contact:${index}`, kind: 'contact' }));
it('plays an exact-zero opening only once, including after explicit restart', () => {
  const cursor = new AudioCueCursor();
  expect(cursor.advance(cues, 0, true)).toEqual([cues[0]]);
  expect(cursor.advance(cues, 0, true)).toEqual([]);
  expect(cursor.advance(cues, .1, true)).toEqual([cues[1]]);
  cursor.reset();
  expect(cursor.advance(cues, 0, true)).toEqual([cues[0]]);
});

it('suppresses paused crossings, forward/backward seeks and stale impacts on resume', () => {
  const cursor = new AudioCueCursor();
  cursor.advance(cues, 0, true);
  expect(cursor.advance(cues, .1, false)).toEqual([]);
  expect(cursor.advance(cues, .1, true)).toEqual([]);
  expect(cursor.advance(cues, 1, true)).toEqual([]);
  expect(cursor.advance(cues, .3, false)).toEqual([]);
  expect(cursor.advance(cues, .31, true)).toEqual([]);
});

it('keeps cue dispatch bounded by the authoritative clock at every supported rate', () => {
  const dense: SpatialCue[] = Array.from({ length: 101 }, (_, i) => ({ id: `contact:${i}`, time: i * .1, kind: 'contact' }));
  for (const rate of [.5, .75, 1, 1.25]) {
    const cursor = new AudioCueCursor(), emitted: SpatialCue[] = [], delays: number[] = [];
    for (let time = 0; time <= 10.1; time += rate / 60) {
      for (const cue of cursor.advance(dense, time, true)) { emitted.push(cue); delays.push(time - cue.time); }
    }
    expect(emitted).toHaveLength(101);
    expect(new Set(emitted.map(cue => cue.id)).size).toBe(101);
    delays.sort((a, b) => a - b);
    expect(delays[Math.floor(delays.length * .95)]).toBeLessThan(.04);
  }
});

it('uses physical metadata and clips bounces at the flight end without altering the session', () => {
  const position = { x: 2, y: 1, z: 10 };
  // Explicit adapter fixture. Physics is not mocked or evaluated by this test.
  const session = { scheduledFlights: [{ startTime: 0, endTime: .4,
    trajectory: { intent: { source: position }, resolved: { launchSpeedKmh: 130 },
      events: [{ type: 'bounce', time: .3, position: { x: 1, y: 0, z: -3 }, speedKmh: 90 },
        { type: 'bounce', time: .5, position, speedKmh: 40 }] } }], playerEvents: [] } as unknown as CompiledSession;
  const before = JSON.stringify(session);
  const result = spatialSessionCues(session);
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ kind: 'contact', time: 0, position, speedKmh: 130 });
  expect(result[1]).toMatchObject({ kind: 'bounce', time: .3, speedKmh: 90 });
  expect(JSON.stringify(session)).toBe(before);
});

it('follows the camera axis and retains readable near/far impacts', () => {
  const camera = { lateral: 0, eyeHeight: 1.7, behindBaseline: 1.5, yaw: 0 };
  const near = cueSpatialMix({ x: -2, y: 1, z: -10 }, camera);
  const far = cueSpatialMix({ x: -2, y: 1, z: 10 }, camera);
  expect(near.pan).toBeGreaterThan(0);
  expect(cueSpatialMix({ x: 2, y: 1, z: -10 }, camera).pan).toBeLessThan(0);
  expect(cueSpatialMix({ x: -2, y: 1, z: -10 }, { ...camera, yaw: 180 }).pan).toBeLessThan(0);
  expect(far.gain).toBeLessThan(near.gain);
  expect(far.gain).toBeGreaterThanOrEqual(.38);
});
