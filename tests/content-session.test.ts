import { describe, expect, it } from 'vitest';
import { DRILLS, SHOTS } from '../src/content/bundled';
import { COURT } from '../src/domain/court';
import { compileSession } from '../src/engine/session/compileSession';
import { resolveTrajectory } from '../src/engine/trajectory/physics';

describe('bundled V1 content floor', () => {
  it('contains the required starter preset counts', () => {
    expect(SHOTS.filter((shot) => shot.family === 'groundstroke')).toHaveLength(12);
    expect(SHOTS.filter((shot) => shot.family === 'serve')).toHaveLength(8);
    expect(SHOTS.filter((shot) => ['volley', 'lob', 'overhead'].includes(shot.family))).toHaveLength(4);
    expect(DRILLS.map((drill) => drill.category)).toEqual([
      'Quick Rally',
      'Return Practice',
      'Tactical Pattern',
      'Serve & Volley',
      'Net & Overhead',
      'Custom',
    ]);
  });

  it.each(SHOTS.map((shot) => [shot.id, shot] as const))('%s resolves across the net and bounces on the near court', (_id, shot) => {
    const trajectory = resolveTrajectory(shot);
    const net = trajectory.events.find((event) => event.type === 'net-crossing');
    const bounce = trajectory.events.find((event) => event.type === 'bounce');
    expect(net, `${shot.id} did not cross the net`).toBeDefined();
    expect(net?.position.y ?? 0, `${shot.id} hit the net`).toBeGreaterThan(COURT.netCenterHeight);
    expect(bounce, `${shot.id} did not bounce`).toBeDefined();
    expect(Math.abs(bounce?.position.x ?? 99), `${shot.id} landed wide`).toBeLessThanOrEqual(COURT.singlesWidth / 2);
    expect(bounce?.position.z ?? 99, `${shot.id} landed beyond the near baseline`).toBeGreaterThanOrEqual(-COURT.halfLength);
    expect(bounce?.position.z ?? -99, `${shot.id} landed on the far side`).toBeLessThan(0);
  });
});

describe('session compiler', () => {
  const drill = DRILLS[0]!;
  const settings = {
    repetitions: 12,
    interval: 3.2,
    variationPercent: 8,
    paceKmh: 78,
    surface: 'hard' as const,
    seed: '18427',
    spin: 'preset' as const,
    opponentHand: 'right' as const,
    workBlockSize: 4,
    restSeconds: 20,
  };

  it('is deterministic for the same seed', () => {
    const first = compileSession(drill, settings);
    const second = compileSession(drill, settings);
    expect(first.repetitions.map((entry) => entry.shot.target)).toEqual(second.repetitions.map((entry) => entry.shot.target));
    expect(first.repetitions.map((entry) => entry.shot.paceKmh)).toEqual(second.repetitions.map((entry) => entry.shot.paceKmh));
  });

  it('changes only declared bounded values for a new seed', () => {
    const first = compileSession(drill, settings);
    const second = compileSession(drill, { ...settings, seed: '18428' });
    expect(first.repetitions.map((entry) => entry.shot.target)).not.toEqual(second.repetitions.map((entry) => entry.shot.target));
    for (const entry of second.repetitions) {
      const source = SHOTS.find((shot) => shot.id === entry.shot.id)!;
      expect(Math.abs(entry.shot.target.x - source.target.x)).toBeLessThanOrEqual(0.55 * 0.08 + Number.EPSILON);
      expect(Math.abs(entry.shot.target.z - source.target.z)).toBeLessThanOrEqual(1.1 * 0.08 + Number.EPSILON);
    }
  });

  it('inserts deterministic rest periods between configured work blocks', () => {
    const session = compileSession(drill, settings);
    expect(session.restPeriods.map((period) => period.afterIndex)).toEqual([3, 7]);
    expect(session.restPeriods[0]!.startTime).toBeCloseTo(15.8, 8);
    expect(session.restPeriods[0]!.endTime).toBeCloseTo(35.8, 8);
    expect(session.restPeriods[1]!.startTime).toBeCloseTo(48.6, 8);
    expect(session.restPeriods[1]!.endTime).toBeCloseTo(68.6, 8);
    expect(session.repetitions[4]!.startTime).toBe(35.8);
    expect(session.duration).toBeCloseTo(81.4, 8);
  });
});
