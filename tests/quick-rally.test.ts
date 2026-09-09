import { describe, expect, it } from 'vitest';
import { DRILL_BY_CATEGORY } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { preparePreviewBatch } from '../src/engine/session/practicePreview';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';
import { defaultReturnShot } from '../src/engine/session/returnShot';
import { bounceContactPhase } from '../src/engine/session/bounceContact';
import type { ContactTiming } from '../src/content/types';

const settings: SessionSettings = { mode: 'quick-practice', repetitions: 6, workBlockSize: 6, restSeconds: 0, shotIntervalSeconds: 5,
  rhythmPercent: 100, movementPercent: 100, variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: 70,
  spin: 'topspin', spinRateRpm: 1103, surface: 'hard', seed: '18427', opponentHand: 'right', serveRhythm: 'normal',
  practiceShotType: 'groundstroke', landingDepthM: 8.5, opponentPosition: { x: 0, z: 12.9 },
  rally: { landingZone: DEFAULT_RETURN_LANDING_ZONE, shot: defaultReturnShot('groundstroke') } };
const drill = DRILL_BY_CATEGORY.get('Quick Rally')!;
describe('physical Quick Rally returns', () => {
  it('connects real incoming and return contacts, including streamed batch seams', () => {
    const session = compileSession(drill, settings);
    expect(session.planningIssues ?? []).toEqual([]);
    const batch = preparePreviewBatch({ drill, settings, last: session.repetitions.at(-1)!, cycle: 1 });
    const reps = [...session.repetitions.slice(0, -1), batch.last, ...batch.next.repetitions];
    for (let i = 0; i < reps.length - 1; i++) {
      const a = reps[i]!, b = reps[i + 1]!, r = a.rallyReturn!;
      expect(a.returnStatus).toBe('linked');
      expect(r.trajectory.intent.source).toEqual(a.reachability.contact!.position);
      expect(r.trajectory.samples.at(-1)!.position).toEqual(b.shot.source);
      expect(a.startTime + r.contactTime + r.duration).toBeCloseTo(b.startTime, 8);
      expect(a.recoveryPolicy).not.toBe('home');
    }
    const phases = new Set(reps.flatMap(r => r.rallyReturn ? [bounceContactPhase(r.rallyReturn.trajectory.samples.at(-1)!)] : []));
    expect([...phases]).toEqual(['descent']);
    for (const rep of reps) if (rep.rallyReturn) expect(bounceContactPhase(rep.reachability.contact!)).toBe('descent');
  });
  it.each((['rise', 'apex', 'descent'] as ContactTiming[]).flatMap(player =>
    (['rise', 'apex', 'descent'] as ContactTiming[]).map(opponent => [player, opponent] as const)))
  ('honors player %s and opponent %s even when a faster interval is requested', (player, opponent) => {
    const session = compileSession(drill, { ...settings, repetitions: 3, shotIntervalSeconds: 2.5,
      rally: { ...settings.rally!, shot: { ...settings.rally!.shot, contactTiming: player }, opponentContactTiming: opponent } });
    expect(session.planningIssues ?? []).toEqual([]);
    expect(session.repetitions).toHaveLength(3);
    for (const rep of session.repetitions.slice(0, -1)) {
      expect(rep.returnStatus).toBe('linked');
      expect(bounceContactPhase(rep.reachability.contact!)).toBe(player);
      expect(bounceContactPhase(rep.rallyReturn!.trajectory.samples.at(-1)!)).toBe(opponent);
    }
  });
  it('keeps other Quick Practice modes as independent feeds', () => {
    const other = compileSession(DRILL_BY_CATEGORY.get('Return Practice')!, { ...settings, practiceShotType: 'serve' });
    expect(other.repetitions.every(r => !r.rallyReturn && r.returnStatus === 'quick-practice')).toBe(true);
  });
  it('uses a serve only to open a rally, then returns from the player ball', () => {
    const session = compileSession(drill, { ...settings, practiceShotType: 'serve', spin: 'flat', launchSpeedKmh: 150, landingDepthM: 5.2, opponentPosition: { x: -1, z: 12.4 }, repetitions: 3 });
    expect(session.planningIssues ?? []).toEqual([]);
    expect(session.repetitions.map(r => r.shot.family)).toEqual(['serve', 'groundstroke', 'groundstroke']);
    expect(session.repetitions[0]!.rallyReturn).toBeDefined();
  });
});
