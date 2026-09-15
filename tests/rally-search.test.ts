import { beforeAll, describe, expect, it } from 'vitest';
import { DRILL_BY_CATEGORY } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { preparePreviewBatch } from '../src/engine/session/practicePreview';
import { acceptsPlayerReturn, defaultReturnShot } from '../src/engine/session/returnShot';
import { rallyZoneTargets, returnPlanCandidates } from '../src/engine/session/returnFlight';
import { landsInZone } from '../src/engine/session/courtFlight';
import { groundedOpponentShot } from '../src/engine/session/opponentContact';

// Captured failing setup; independent of the owner's mutable project catalog.
const settings: SessionSettings = {
  mode: 'quick-practice', repetitions: 6, workBlockSize: 6, restSeconds: 0,
  shotIntervalSeconds: 3.5, rhythmPercent: 100, movementPercent: 100,
  variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: 70,
  spin: 'topspin', spinRateRpm: 1103, surface: 'hard', seed: '18427',
  opponentHand: 'right', serveRhythm: 'normal', practiceShotType: 'groundstroke',
  bounceFactor: 1.05, landingDepthM: 9.925564585312655, aimDirectionDeg: .27589754836908725,
  landingZone: { width: 3.044956162321569, depth: 2 }, opponentPosition: { x: 0, z: 12.885 },
  camera: { eyeHeight: 1.7, behindBaseline: 3.073458097776985, lateral: .026121382228864155 },
  rally: { landingZone: { minX: -1.811829434141369, maxX: 1.593052335639538,
    minZ: 9.024200091949796, maxZ: 11.024200091949796 },
    shot: defaultReturnShot('groundstroke'), opponentContactTiming: 'descent' },
};
const drill = DRILL_BY_CATEGORY.get('Quick Rally')!;

describe.sequential('reported deep-zone rally across consecutive randomized batches', () => {
  let session: ReturnType<typeof compileSession>;
  beforeAll(() => {
    session = compileSession(drill, settings);
    expect(session.planningIssues ?? []).toEqual([]);
  }, 60_000);
  // Keep every seam and all 72 returned shots. A case is one real preview batch,
  // so failures identify the cycle instead of timing out the entire soak.
  for (let cycle = 1; cycle <= 12; cycle++) it(`keeps batch ${cycle} connected`, () => {
    const batch = preparePreviewBatch({ drill, settings, last: session.repetitions.at(-1)!, cycle });
    expect(batch.next.planningIssues ?? [], `cycle ${cycle}`).toEqual([]);
    expect(batch.next.repetitions).toHaveLength(6);
    const reps = [batch.last, ...batch.next.repetitions];
    for (let i = 0; i < reps.length - 1; i++) {
      const rep = reps[i]!, next = reps[i + 1]!;
      expect(rep.returnStatus).toBe('linked');
      expect(landsInZone(rep.trajectory)).toBe(true);
      expect(landsInZone(rep.rallyReturn!.trajectory)).toBe(true);
      expect(groundedOpponentShot(next.shot)).toBe(true);
      expect(next.camera).toEqual(rep.camera);
      expect(rep.rallyReturn!.trajectory.samples.at(-1)!.position).toEqual(next.shot.source);
      expect(rep.startTime + rep.rallyReturn!.contactTime + rep.rallyReturn!.duration).toBeCloseTo(next.startTime, 8);
    }
    session = batch.next;
  }, 60_000);
});

it('searches the remaining real player contact samples when preferred contacts are rejected', () => {
  const incoming = compileSession(drill, { ...settings, repetitions: 1 }).repetitions[0]!.trajectory;
  const zone = settings.rally!.landingZone, target = { x: 0, z: 10 };
  const preferred = returnPlanCandidates(incoming, 'groundstroke', zone, target, 3.5, settings.rally!.shot);
  const triedTimes = new Set(preferred.map(c => c.rally.contactTime));
  expect(triedTimes.size).toBeGreaterThan(0);
  const accepts = (c: typeof preferred[number]) => !triedTimes.has(c.rally.contactTime);
  expect(returnPlanCandidates(incoming, 'groundstroke', zone, target, 3.5, settings.rally!.shot, 'descent', accepts)).toHaveLength(0);
  const recovered = returnPlanCandidates(incoming, 'groundstroke', zone, target, 3.5, settings.rally!.shot, 'descent', accepts, Infinity, true);
  expect(recovered.length).toBeGreaterThan(0);
  expect(recovered.every(accepts)).toBe(true);
  expect(recovered.every(c => incoming.samples.some(s => s.time === c.rally.contactTime))).toBe(true);
});

it('never expands an explicitly fixed landing point and reports impossible zones', () => {
  const zone = { minX: 0, maxX: 0, minZ: 20, maxZ: 20 };
  expect([...rallyZoneTargets(zone, { x: 0, z: 20 })]).toEqual([{ x: 0, z: 20 }]);
  const session = compileSession(drill, { ...settings, repetitions: 2,
    rally: { ...settings.rally!, landingZone: zone, playerShotPolicy: 'automatic' } });
  expect(session.planningIssues?.[0]?.phase).toBe('response');
  expect(session.repetitions).toHaveLength(1);
  expect(session.repetitions[0]!.returnStatus).toBe('infeasible');
});

it('can replace an automatic player-shot preference while preserving an explicit one', () => {
  const first = compileSession(drill, { ...settings, repetitions: 1, launchSpeedKmh: 110, spin: 'flat', spinRateRpm: 120 }).repetitions[0]!;
  const shot = defaultReturnShot('overhead');
  expect(acceptsPlayerReturn(first.trajectory, shot)).toBe(false);
  const last = { ...first, returnShot: shot };
  const explicit = compileSession(drill, { ...settings, repetitions: 1,
    rally: { ...settings.rally!, shot, playerShotPolicy: 'configured' } }, last);
  expect(explicit.planningIssues?.length).toBeGreaterThan(0);
  const automatic = compileSession(drill, { ...settings, repetitions: 1,
    rally: { ...settings.rally!, shot, playerShotPolicy: 'automatic' } }, last);
  expect(automatic.planningIssues ?? []).toEqual([]);
  expect(automatic.repetitions[0]!.returnStatus).toBe('linked');
  expect(automatic.repetitions[0]!.returnShot.type).not.toBe('overhead');
}, 20_000);


