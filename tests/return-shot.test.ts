import { describe, expect, it } from 'vitest';
import { DRILLS, SHOT_BY_ID, SHOTS } from '../src/content/bundled';
import type { ReturnShotType } from '../src/content/types';
import { resolveTrajectory } from '../src/engine/trajectory/physics';
import { defaultReturnShot, returnShotContacts } from '../src/engine/session/returnShot';
import { finishReturn, returnPlanCandidates } from '../src/engine/session/returnFlight';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';
import { DEFAULT_DRILL_CAMERA } from '../src/engine/session/cameraTimeline';
import { snapshotShot } from '../src/content/editing';
import { isSavedShot, parseDrillJson, validateDrill } from '../src/content/validation';
import { spinsForShot } from '../src/domain/shotKinds';

const settings: SessionSettings = { repetitions: 2, mode: 'drill', shotIntervalSeconds: 3.5, rhythmPercent: 100,
  variationPercent: 0, timingVariationPercent: 0, launchSpeedKmh: 75, surface: 'hard', seed: 'return-style',
  spin: 'preset', opponentHand: 'right', workBlockSize: 50, restSeconds: 0, serveRhythm: 'normal', cameraMotionScale: 0 };
const incoming = (id = 'body-neutral') => { const shot = SHOT_BY_ID.get(id)!; return resolveTrajectory({ ...shot,
  launchSpeedKmh: shot.paceKmh, trajectoryMode: 'natural', minimumNetClearanceM: shot.family === 'lob' ? 3.2 : .25 }); };
const cases: readonly [ReturnShotType, string][] = [['groundstroke', 'body-neutral'], ['drop-shot', 'body-neutral'],
  ['volley', 'body-neutral'], ['overhead', 'lob-deep'], ['lob', 'body-neutral']];

describe('independent return shots', () => {
  it.each(cases)('solves a physical %s from the incoming path and into its authored zone', (type, id) => {
    const flight = incoming(id), config = defaultReturnShot(type);
    const zone = type === 'drop-shot' ? { minX: -.8, maxX: .8, minZ: 1.2, maxZ: 3.2 } : DEFAULT_RETURN_LANDING_ZONE;
    const target = { x: .1, z: (zone.minZ + zone.maxZ) / 2 };
    const candidates = returnPlanCandidates(flight, 'groundstroke', zone, target, 3.5, config);
    expect(candidates.length).toBeGreaterThan(0);
    const choice = candidates[0]!, rally = finishReturn(choice);
    const contact = flight.samples.find(s => s.time === rally.contactTime)!;
    expect(contact).toBeDefined();
    expect(contact.bounced).toBe(type !== 'volley' && type !== 'overhead');
    if (type === 'overhead') expect(contact.position.y).toBeGreaterThanOrEqual(1.8);
    expect(rally.trajectory.intent.source).toEqual(contact.position);
    expect(rally.trajectory.intent.family).toBe(type);
    expect(rally.trajectory.intent.spin).toBe(config.spin);
    expect(rally.trajectory.samples.at(-1)!.position).toEqual(choice.source);
    const bounce = choice.rally.trajectory.events.find(e => e.type === 'bounce')!;
    expect(Math.hypot(bounce.position.x - target.x, bounce.position.z - target.z)).toBeLessThan(.18);
    expect(bounce.position.z).toBeGreaterThanOrEqual(zone.minZ);
    expect(bounce.position.z).toBeLessThanOrEqual(zone.maxZ);
  });
  it('changes return physics and next contact without changing the incoming shot', () => {
    const sessions = (['topspin', 'flat', 'slice'] as const).map(spin => compileSession({ ...DRILLS[0]!, shotIds: ['body-neutral'],
      events: [{ id: 'a', shotId: 'body-neutral', returnShot: defaultReturnShot('groundstroke', spin), cameraMotion: null }] }, settings));
    const first = sessions[0]!.repetitions[0]!;
    for (const [index, session] of sessions.entries()) {
      const rep = session.repetitions[0]!, next = session.repetitions[1]!;
      expect(rep.trajectory).toEqual(first.trajectory);
      expect(rep.rallyReturn).toBeDefined();
      expect(rep.rallyReturn!.trajectory.intent.spin).toBe(['topspin', 'flat', 'slice'][index]);
      expect(rep.rallyReturn!.trajectory.intent.target).toEqual(first.rallyReturn!.trajectory.intent.target);
      expect(rep.rallyReturn!.trajectory.samples.at(-1)!.position).toEqual(next.shot.source);
    }
    expect(new Set(sessions.map(s => s.repetitions[0]!.rallyReturn!.trajectory.launchVelocity.y)).size).toBe(3);
  });
  it('does not volley a serve or invent an overhead contact on a low ball', () => {
    expect(returnShotContacts(incoming('serve-deuce-t'), 'volley')).toHaveLength(0);
    expect(returnShotContacts(incoming('volley-left'), 'overhead')).toHaveLength(0);
  });
  it('stores return settings independently through preset snapshots and drill JSON', () => {
    const event = { id: 'a', shotId: 'body-neutral', returnShot: defaultReturnShot('drop-shot'), returnLandingZone: DEFAULT_RETURN_LANDING_ZONE };
    const drill = { ...DRILLS[0]!, shotIds: [event.shotId], events: [event] };
    const saved = snapshotShot(event, drill, DEFAULT_DRILL_CAMERA);
    expect(saved.returnShot).toEqual(event.returnShot);
    expect(isSavedShot({ id: 'return-preset', name: 'Drop return', event: saved })).toBe(true);
    expect(parseDrillJson(JSON.stringify({ ...drill, events: [saved] })).events![0]!.returnShot).toEqual(event.returnShot);
    for (const invalid of [{ ...event.returnShot, type: 'serve' }, { ...event.returnShot, spin: 'kick' },
      { ...event.returnShot, spin: 'sidespin' }, { ...event.returnShot, spinRateRpm: Infinity }, { ...event.returnShot, camera: 1 }]) {
      expect(validateDrill({ ...drill, events: [{ ...event, returnShot: invalid }] }).valid).toBe(false);
    }
  });
  it('offers serve-only axes only for serves and compiles old rally labels safely', () => {
    for (const shot of SHOTS) {
      expect(spinsForShot(shot.family).includes('kick')).toBe(shot.family === 'serve');
      expect(spinsForShot(shot.family).includes('sidespin')).toBe(shot.family === 'serve');
      expect(spinsForShot(shot.family)).toContain(shot.spin);
    }
    const drill = { ...DRILLS[0]!, shotIds: ['body-neutral'], events: [{ id: 'a', shotId: 'body-neutral', spin: 'kick' as const }] };
    expect(compileSession(drill, settings).repetitions[0]!.shot.spin).toBe('topspin');
    expect(snapshotShot(drill.events[0]!, drill, DEFAULT_DRILL_CAMERA).spin).toBe('topspin');
  });
});
