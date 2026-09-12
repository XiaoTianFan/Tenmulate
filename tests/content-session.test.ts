import { describe, expect, it } from 'vitest';
import { DRILLS, SHOTS } from '../src/content/bundled';
import { COURT } from '../src/domain/court';
import { RETURN_SERVE_PATTERN, returnServerPosition } from '../src/domain/returnPractice';
import { compileSession } from '../src/engine/session/compileSession';
import { minimumMotionGap, motionEvent } from '../src/engine/session/opponentTimeline';
import { resolveTrajectory } from '../src/engine/trajectory/physics';

describe('bundled V1 content floor', () => {
  it('contains the required starter preset counts', () => {
    expect(SHOTS.filter((shot) => shot.family === 'groundstroke')).toHaveLength(12);
    expect(SHOTS.filter((shot) => shot.family === 'serve')).toHaveLength(8);
    expect(SHOTS.filter((shot) => ['volley', 'lob', 'overhead'].includes(shot.family))).toHaveLength(4);
    expect([...new Set(DRILLS.map((drill) => drill.category))]).toEqual([
      'Quick Rally',
      'Return Practice',
      'Tactical Pattern',
      'Serve & Volley',
      'Net & Overhead',
      'Custom',
    ]);
    expect(DRILLS.filter((drill) => drill.category === 'Quick Rally')).toHaveLength(4);
    expect(DRILLS.filter((drill) => drill.category === 'Return Practice')).toHaveLength(4);
    expect(DRILLS.filter((drill) => drill.category === 'Tactical Pattern')).toHaveLength(4);
    expect(SHOTS.some((shot) => shot.family === 'approach')).toBe(true);
    expect(SHOTS.some((shot) => shot.family === 'half-volley')).toBe(true);
    expect(new Set(SHOTS.filter((shot) => shot.family === 'serve').map((shot) => shot.serveRhythm))).toEqual(new Set(['normal', 'compact']));
  });

  it.each(SHOTS.map((shot) => [shot.id, shot] as const))('%s resolves across the net and bounces on the near court', (_id, shot) => {
    const trajectory = resolveTrajectory({
      ...shot,
      launchSpeedKmh: shot.paceKmh,
      minimumNetClearanceM: shot.netClearanceM,
    });
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
    timingVariationPercent: 0,
    launchSpeedKmh: 78,
    surface: 'hard' as const,
    seed: '18427',
    spin: 'preset' as const,
    opponentHand: 'right' as const,
    workBlockSize: 4,
    restSeconds: 20,
    serveRhythm: 'preset' as const,
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
      expect(Math.abs(entry.shot.target.x - source.target.x)).toBeLessThanOrEqual(0.8 + Number.EPSILON);
      expect(Math.abs(entry.shot.target.z - source.target.z)).toBeLessThanOrEqual(1 + Number.EPSILON);
    }
  });

  it('inserts deterministic rest periods between configured work blocks', () => {
    const session = compileSession(drill, settings);
    expect(session.restPeriods.map((period) => period.afterIndex)).toEqual([3, 7]);
    for (const period of session.restPeriods) {
      // Rest starts after the outgoing flight, with the next preparation reserved.
      const previous = session.repetitions[period.afterIndex]!;
      expect(period.startTime).toBeGreaterThanOrEqual(previous.startTime + previous.trajectory.samples.at(-1)!.time);
      expect(period.endTime - period.startTime).toBeCloseTo(settings.restSeconds, 8);
      expect(motionEvent(session.repetitions[period.afterIndex + 1]!).start).toBeGreaterThanOrEqual(period.endTime - 1e-8);
    }
    // The last outgoing ball now finishes before the session completion screen.
    const last = session.repetitions.at(-1)!;
    expect(session.duration).toBeGreaterThanOrEqual(last.startTime + last.trajectory.samples.at(-1)!.time);
    expect(session.duration).toBeGreaterThanOrEqual(motionEvent(last).end);
    expect(session.duration).toBeLessThan(last.startTime + 12);
  });

  it('applies seeded timing variation without changing the three-second countdown or rest duration', () => {
    const varied = compileSession(drill, { ...settings, timingVariationPercent: 20 });
    const replay = compileSession(drill, { ...settings, timingVariationPercent: 20 });
    expect(varied.repetitions.map((entry) => entry.startTime)).toEqual(replay.repetitions.map((entry) => entry.startTime));
    expect(varied.repetitions[0]!.startTime).toBe(3);
    const requiredGap=minimumMotionGap(varied.repetitions[0]!,varied.repetitions[1]!);
    expect(varied.repetitions[1]!.startTime).toBeGreaterThanOrEqual(3 + Math.max(settings.interval * .8,requiredGap)-1e-8);
    expect(varied.repetitions[1]!.startTime).toBeLessThan(15);
    expect(varied.repetitions[0]!.trajectory).toEqual(compileSession(drill, { ...settings, timingVariationPercent: 0 }).repetitions[0]!.trajectory);
    expect(varied.restPeriods[0]!.endTime - varied.restPeriods[0]!.startTime).toBeCloseTo(20, 8);
  });

  it('compiles a selected quick-practice serve from serve contact height into a legal service box', () => {
    const session = compileSession(drill, {
      ...settings,
      repetitions: 1,
      practiceShotType: 'serve',
      spin: 'kick',
      spinRateRpm: 3200,
      launchSpeedKmh: 135,
      landingDepthM: 5.05,
      bounceFactor: 1.2,
      opponentPosition: returnServerPosition('right'),
      aimDirectionDeg: 0,
    });
    const repetition = session.repetitions[0]!;
    const bounce = repetition.trajectory.events.find((event) => event.type === 'bounce')!;
    expect(repetition.shot.family).toBe('serve');
    expect(repetition.shot.source.y).toBeCloseTo(2.720799, 5);
    expect(repetition.shot.spin).toBe('kick');
    expect(bounce.position.z).toBeGreaterThanOrEqual(-COURT.serviceLineFromNet);
    expect(bounce.position.z).toBeLessThan(0);
    expect(bounce.position.x).toBeLessThan(0);
  });

  it('preserves an explicitly spin-free flat groundstroke', () => {
    const session = compileSession(drill, {
      ...settings,
      repetitions: 1,
      practiceShotType: 'groundstroke',
      spin: 'flat',
      spinRateRpm: 0,
      variationPercent: 0, trajectoryMode: 'exact',
      launchSpeedKmh: 68,
      landingDepthM: 9.5,
    });

    expect(session.repetitions[0]!.shot.spin).toBe('flat');
    expect(session.repetitions[0]!.trajectory.resolved.spinRateRpm).toBe(0);
    expect(session.repetitions[0]!.trajectory.resolved.spinParameter).toBe(0);
  });

  it('alternates T, body, and wide serves toward the selected receiver corner', () => {
    const leftSession = compileSession(drill, {
      ...settings,
      repetitions: 6,
      practiceShotType: 'serve',
      spin: 'flat',
      spinRateRpm: 1179,
      launchSpeedKmh: 135,
      landingDepthM: 5.05,
      opponentPosition: returnServerPosition('left'),
      returnReceiverSide: 'left',
    });
    const rightSession = compileSession(drill, {
      ...settings,
      repetitions: 3,
      practiceShotType: 'serve',
      spin: 'flat',
      spinRateRpm: 1179,
      launchSpeedKmh: 135,
      landingDepthM: 5.05,
      opponentPosition: returnServerPosition('right'),
      returnReceiverSide: 'right',
    });

    expect(leftSession.repetitions.map((entry) => entry.returnServePlacement)).toEqual([...RETURN_SERVE_PATTERN, ...RETURN_SERVE_PATTERN]);
    expect(leftSession.repetitions.every((entry, i) => Math.abs(entry.shot.target.x - [0.28, 2.25, 3.895][i % 3]!) <= .45)).toBe(true);
    expect(leftSession.repetitions.every(entry => entry.shot.target.x > 0 && entry.shot.target.x < 4.115)).toBe(true);
    expect(leftSession.repetitions.every((entry) => entry.shot.source.x < 0 && motionEvent(entry).root.z > COURT.halfLength)).toBe(true);
    expect(rightSession.repetitions.every((entry, i) => Math.abs(entry.shot.target.x + [0.28, 2.25, 3.895][i]!) <= .45)).toBe(true);
    expect(rightSession.repetitions.every(entry => entry.shot.target.x < 0 && entry.shot.target.x > -4.115)).toBe(true);
    expect(rightSession.repetitions.every((entry) => entry.shot.source.x > 0 && motionEvent(entry).root.z > COURT.halfLength)).toBe(true);
  });

  it('compiles overhead practice as a high lob to the selected landing depth', () => {
    const session = compileSession(drill, {
      ...settings,
      repetitions: 1,
      practiceShotType: 'lob',
      spin: 'topspin',
      spinRateRpm: 1200,
      launchSpeedKmh: 52,
      landingDepthM: 9.3,
      opponentPosition: { x: 1.1, z: 6 },
      aimDirectionDeg: 0,
    });
    const repetition = session.repetitions[0]!;
    const bounce = repetition.trajectory.events.find((event) => event.type === 'bounce')!;
    const net = repetition.trajectory.events.find((event) => event.type === 'net-crossing')!;
    expect(repetition.shot.family).toBe('lob');
    expect(repetition.shot.source.y).toBe(1.05);
    expect(repetition.trajectory.intent.landingZone).toMatchObject({minZ:-10.3,maxZ:-8.3});
    expect(net.time).toBeLessThan(bounce.time);
    expect(repetition.trajectory.apexHeight).toBeGreaterThan(5);
    expect(bounce.position.z).toBeCloseTo(repetition.shot.target.z, 1);
  });
});
