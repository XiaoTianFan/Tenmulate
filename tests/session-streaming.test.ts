import { expect, it } from 'vitest';
import { DRILL_BY_CATEGORY } from '../src/content/bundled';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { defaultDrillSettings } from '../src/app/defaults';
import { compileSession, type CompiledSession, type SessionSettings } from '../src/engine/session/compileSession';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';
import { defaultReturnShot } from '../src/engine/session/returnShot';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { sampleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { spatialSessionCues } from '../src/engine/audio/spatialCues';
import { playbackBoundary } from '../src/engine/session/playbackBoundary';
import { sessionFlights } from '../src/engine/session/sessionFlights';

const quick: SessionSettings = { mode: 'quick-practice', repetitions: 9, workBlockSize: 3, restSeconds: 5, shotIntervalSeconds: 5,
  rhythmPercent: 100, movementPercent: 100, variationPercent: 8, timingVariationPercent: 8, launchSpeedKmh: 70,
  spin: 'topspin', spinRateRpm: 1103, surface: 'hard', seed: '18427', opponentHand: 'right', serveRhythm: 'normal',
  practiceShotType: 'groundstroke', landingDepthM: 8.5, opponentPosition: { x: 0, z: 12.9 },
  rally: { landingZone: DEFAULT_RETURN_LANDING_ZONE, shot: defaultReturnShot('groundstroke') } };

function assertStable(prefixes: CompiledSession[], final: CompiledSession) {
  expect(prefixes.length).toBeGreaterThan(0);
  expect(final.preparation).toBeUndefined();
  expect(final.planningIssues ?? []).toEqual([]);
  const finalMotion = final.repetitions.map(motionEvent), finalCues = spatialSessionCues(final);
  let previousLimit = 0;
  for (const prefix of prefixes) {
    const limit = prefix.preparation!.playableUntil;
    expect(limit).toBeGreaterThan(previousLimit); previousLimit = limit;
    expect(limit).toBeLessThan(final.duration);
    expect(prefix.preparation!.totalRepetitions).toBe(final.settings.repetitions);
    const prefixMotion = prefix.repetitions.map(motionEvent);
    const checkedFlights = new Set();
    for (let time = 0; time <= limit; time += .137) {
      const pose = sampleOpponentTimeline(prefixMotion, time), fullPose = sampleOpponentTimeline(finalMotion, time);
      expect(pose, `opponent at ${time}`).toEqual(fullPose);
      expect(sampleCameraTimeline(prefix.cameraTimeline, time, pose?.root), `camera at ${time}`)
        .toEqual(sampleCameraTimeline(final.cameraTimeline, time, fullPose?.root));
      const flights = sessionFlights(prefix, time), fullFlights = sessionFlights(final, time);
      expect(flights.map(({ trajectory: _, ...flight }) => flight)).toEqual(fullFlights.map(({ trajectory: _, ...flight }) => flight));
      flights.forEach((flight, index) => {
        if (checkedFlights.has(flight.trajectory)) return;
        checkedFlights.add(flight.trajectory); expect(flight.trajectory).toEqual(fullFlights[index]!.trajectory);
      });
    }
    expect(spatialSessionCues(prefix).filter(cue => cue.time < limit)).toEqual(finalCues.filter(cue => cue.time < limit));
    expect(playbackBoundary(prefix, limit + 10)).toEqual({ time: limit, buffering: true, completed: false });
  }
  expect(playbackBoundary(final, final.duration + 10)).toEqual({ time: final.duration, buffering: false, completed: true });
}

it.each([false, true])('streams exact quick practice with rally=%s, seeded variation and set endings', rally => {
  const settings = { ...quick, rally: rally ? quick.rally : undefined };
  const prefixes: CompiledSession[] = [];
  const final = compileSession(DRILL_BY_CATEGORY.get('Quick Rally')!, settings, undefined, session => prefixes.push(structuredClone(session)));
  expect(final).toEqual(compileSession(DRILL_BY_CATEGORY.get('Quick Rally')!, settings));
  expect(prefixes[0]!.repetitions).toHaveLength(2);
  assertStable(prefixes, final);
}, 30_000);

it.each(PLAYER_DRILLS.map(drill => [drill.id, drill] as const))('streams stable motion, camera and cues for %s', (_, drill) => {
  const settings = { ...defaultDrillSettings(drill), repetitions: Math.max(7, drill.events.length * 2) };
  const prefixes: CompiledSession[] = [];
  const final = compileSession(drill, settings, undefined, session => prefixes.push(structuredClone(session)));
  expect(final).toEqual(compileSession(drill, settings));
  assertStable(prefixes, final);
}, 30_000);

it('completes short sessions without publishing a misleading partial ending', () => {
  const prefixes: CompiledSession[] = [];
  const final = compileSession(DRILL_BY_CATEGORY.get('Quick Rally')!, { ...quick, repetitions: 2 }, undefined, session => prefixes.push(session));
  expect(prefixes).toEqual([]); expect(final.preparation).toBeUndefined();
  expect(final.repetitions).toHaveLength(2);
});
