import { expect, it } from 'vitest';
import { DRILL_BY_CATEGORY } from '../src/content/bundled';
import { defaultDrillSettings } from '../src/app/defaults';
import { QUICK_PRACTICE_VIEWS, OVERHEAD_PRACTICE_OPPONENT } from '../src/domain/practiceViews';
import { COURT } from '../src/domain/court';
import { returnServerPosition } from '../src/domain/returnPractice';
import { compileSession } from '../src/engine/session/compileSession';
import { sessionFlights } from '../src/engine/session/sessionFlights';
import { compilePracticePreview, preparePreviewBatch, ContinuousPracticePreview } from '../src/engine/session/practicePreview';
import { overheadPracticeCamera } from '../src/engine/session/practiceReturn';
import { landsInZone } from '../src/engine/session/courtFlight';
import { PRACTICE_SHOT_PROFILES } from '../src/engine/trajectory/practiceProfiles';

const modes = [
  { category: 'Return Practice', shotType: 'serve', type: 'groundstroke', camera: { eyeHeight: 1.68, behindBaseline: 2.8, lateral: 3.6, yaw: -10, pitch: -2, fov: 70 }, opponent: returnServerPosition('left') },
  { category: 'Serve & Volley', shotType: 'groundstroke', type: 'volley', camera: QUICK_PRACTICE_VIEWS.volley, opponent: { x: 0, z: 12.9 } },
  { category: 'Net & Overhead', shotType: 'lob', type: 'overhead', camera: QUICK_PRACTICE_VIEWS.overhead, opponent: OVERHEAD_PRACTICE_OPPONENT },
] as const;
const zone = { minX: -2, maxX: 1, minZ: 7, maxZ: 10 };
function setup(mode: typeof modes[number], hand: 'right' | 'left') {
  const drill = DRILL_BY_CATEGORY.get(mode.category)!, profile = PRACTICE_SHOT_PROFILES[mode.shotType];
  return { drill, settings: { ...defaultDrillSettings(drill), mode: 'quick-practice' as const, repetitions: 3, workBlockSize: 3, restSeconds: 0,
    camera: mode.camera, practiceShotType: mode.shotType, opponentPosition: mode.opponent, opponentHand: hand,
    landingDepthM: profile.defaultLandingDepthM, launchSpeedKmh: profile.defaultLaunchSpeedKmh,
    spin: profile.defaultSpin, practiceReturn: { type: mode.type, landingZone: zone } } };
}

it.each(modes)('animates every $category return from a physical contact through its blue landing zone', mode => {
  for (const hand of ['right', 'left'] as const) {
    const { drill, settings } = setup(mode, hand), session = compileSession(drill, settings);
    expect(session.planningIssues ?? []).toEqual([]);
    expect(session.repetitions).toHaveLength(3);
    for (const rep of session.repetitions) {
      const response = rep.rallyReturn!;
      expect(response).toBeDefined();
      expect(response.trajectory.intent.family).toBe(mode.type);
      expect(response.trajectory.intent.landingZone).toEqual(zone);
      expect(landsInZone(response.trajectory)).toBe(true);
      const contact = rep.trajectory.samples.find(sample => sample.time === response.contactTime)!;
      expect(response.trajectory.intent.source).toEqual(contact.position);
      expect(contact.bounced).toBe(mode.type === 'groundstroke');
      if (mode.type === 'overhead') expect(contact.velocity.y).toBeLessThan(0);
      const start = rep.startTime + response.contactTime;
      expect(sessionFlights(session, start - .001)[0]!.phase).toBe('outgoing');
      expect(sessionFlights(session, start)[0]!.phase).toBe('return');
      if (rep === session.repetitions.at(-1)) expect(session.duration).toBeGreaterThanOrEqual(start + response.duration - 1e-8);
    }
  }
});

it.each(modes)('keeps the final $category return visible across a streamed preview seam', mode => {
  const { drill, settings } = setup(mode, 'right'), session = compilePracticePreview(drill, settings), last = session.repetitions.at(-1)!;
  const batch = preparePreviewBatch({ drill, settings, last, cycle: 1 });
  const time = batch.last.startTime + batch.last.rallyReturn!.contactTime + .05;
  const preview = new ContinuousPracticePreview(session);
  expect(preview.frame(time).flights.some(flight => flight.phase === 'return' && flight.index === batch.last.index)).toBe(true);
  expect(batch.last.timing!.actual).toBeCloseTo(batch.next.repetitions[0]!.startTime - batch.last.startTime, 8);
});

it('starts overheads at the T, volleys between the T and net, and tracks the lob without moving the camera', () => {
  const { drill, settings } = setup(modes[2], 'right'), rep = compileSession(drill, settings).repetitions[0]!;
  const base = QUICK_PRACTICE_VIEWS.overhead, hit = rep.rallyReturn!.contactTime;
  expect(-COURT.halfLength - base.behindBaseline).toBeCloseTo(-COURT.serviceLineFromNet);
  expect(-COURT.halfLength - QUICK_PRACTICE_VIEWS.volley.behindBaseline).toBeCloseTo(-COURT.serviceLineFromNet / 2);
  const look = overheadPracticeCamera(base, rep.trajectory, hit, hit);
  expect(look.pitch).toBeGreaterThan(base.pitch);
  expect(look).toMatchObject({ eyeHeight: base.eyeHeight, lateral: 0, behindBaseline: base.behindBaseline, fov: base.fov });
  expect(overheadPracticeCamera(base, rep.trajectory, hit + 1, hit)).toEqual(base);
});

it('keeps overhead tracking continuous when a lob passes behind the T', () => {
  for (const hand of ['right', 'left'] as const) {
    const { drill, settings } = setup(modes[2], hand), session = compileSession(drill, settings);
    for (const rep of session.repetitions) {
      const hit = rep.rallyReturn!.contactTime, base = QUICK_PRACTICE_VIEWS.overhead;
      let previous: ReturnType<typeof overheadPracticeCamera> = base;
      for (let age = 0; age < hit + 1; age += 1 / 240) {
        const view = overheadPracticeCamera(base, rep.trajectory, age, hit);
        expect(Math.abs(view.yaw - base.yaw)).toBeLessThan(60);
        expect(Math.abs(view.yaw - previous.yaw)).toBeLessThan(3);
        expect(Math.abs(view.pitch - previous.pitch)).toBeLessThan(3);
        previous = view;
      }
    }
  }
});
