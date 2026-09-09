import { describe, expect, it } from 'vitest';
import { integrateTrajectory, netHeightAt, resolveTrajectory, type ShotIntent } from '../src/engine/trajectory/physics';
import { resolveCourtFlight, rotateCourtFlight } from '../src/engine/session/courtFlight';
import { trajectoryReadout } from '../src/engine/trajectory/trajectoryReadout';

const deep: ShotIntent = {
  source: { x: 0, y: 1.15, z: 12.885 }, target: { x: 0, z: -10.5 },
  landingZone: { minX: -.8, maxX: .8, minZ: -11.5, maxZ: -9.5 },
  launchSpeedKmh: 61, spin: 'topspin', spinRateRpm: 1224,
  shotType: 'groundstroke', surface: 'hard', trajectoryMode: 'natural',
};
const clearance = (result: ReturnType<typeof resolveTrajectory>) => {
  const net = result.events.find(event => event.type === 'net-crossing')!;
  return net.position.y - netHeightAt(net.position.x);
};
const expectTarget = (result: ReturnType<typeof resolveTrajectory>) => {
  expect(result.solution!.status).not.toBe('unreachable');
  expect(result.solution!.targetErrorM).toBeLessThan(.18);
  const bounce = result.events.find(event => event.type === 'bounce')!;
  const net = result.events.find(event => event.type === 'net-crossing')!;
  expect(net.time).toBeLessThan(bounce.time);
  expect(clearance(result)).toBeGreaterThanOrEqual((result.intent.minimumNetClearanceM ?? .12) - .015);
};

describe('natural groundstroke arc selection', () => {
  it('checks the forward model against a published no-spin trajectory, independently of target fitting', () => {
    // Cross, Ball Trajectories, Fig 42.3: 30 m/s, 1 m contact, 8.1 degrees,
    // approximately 23.77 m carry. Ball size/ground contact differ slightly.
    const angle = 8.1 * Math.PI / 180;
    const result = integrateTrajectory({ ...deep, source: { x: 0, y: 1, z: 11.885 }, spinRateRpm: 0 },
      { x: 0, y: 30 * Math.sin(angle), z: -30 * Math.cos(angle) });
    const range = 11.885 - result.events.find(event => event.type === 'bounce')!.position.z;
    expect(range).toBeGreaterThan(23.1);
    expect(range).toBeLessThan(24.3);
  });

  it('uses reduced spin before increasing pace when the requested speed already permits a low deep ball', () => {
    const result = resolveTrajectory({ ...deep, source: { x: 0, y: 1.15, z: 6 }, target: { x: 0, z: -10 }, launchSpeedKmh: 70, spinRateRpm: 2000 });
    expectTarget(result);
    expect(result.resolved.launchSpeedKmh).toBeCloseTo(70, 6);
    expect(result.resolved.spinRateRpm).toBeLessThan(1000);
    expect(clearance(result)).toBeLessThan(1.7);
  });

  it('resolves identical physical paths for the player and opponent and reports the actual hovered path', () => {
    const opponent = resolveCourtFlight(deep);
    const player = resolveCourtFlight({ ...deep, source: { ...deep.source, z: -deep.source.z },
      target: { x: 0, z: -deep.target.z }, landingZone: { minX: -.8, maxX: .8, minZ: 9.5, maxZ: 11.5 } });
    expect(JSON.stringify(player.samples)).toEqual(JSON.stringify(rotateCourtFlight(opponent).samples));
    expect(trajectoryReadout(player).owner).toBe('player');
    expect(trajectoryReadout(opponent).owner).toBe('opponent');
    expect(trajectoryReadout(player).netHeight! - trajectoryReadout(player).netClearance!).toBeCloseTo(.914, 8);
    const rebound = { ...player, apexHeight: 99, samples: [...player.samples, { time: 9, bounced: true, position: { x: 0, y: 99, z: 10 }, velocity: { x: 0, y: 0, z: 0 } }] };
    expect(trajectoryReadout(rebound).peakHeight).toBe(trajectoryReadout(player).peakHeight);
  });
  it('lowers the reported slow/deep arc by jointly reducing topspin and fitting pace', () => {
    const result = resolveTrajectory(deep);
    expectTarget(result);
    // Previously 4.12 m above the tape / 5.07 m apex at 70.15 km/h, 979 rpm.
    expect(clearance(result)).toBeLessThan(1.8);
    expect(result.apexHeight).toBeLessThan(2.8);
    expect(result.resolved.spinRateRpm).toBeLessThan(600);
    expect(result.resolved.launchSpeedKmh).toBeLessThan(100);
    expect(result.intent).toBe(deep);
  });

  it('limits speed increases by reducing excessive spin for a moderate deep ball', () => {
    const result = resolveTrajectory({ ...deep, launchSpeedKmh: 80, spinRateRpm: 2500 });
    expectTarget(result);
    expect(result.resolved.launchSpeedKmh).toBeLessThan(105);
    expect(result.resolved.spinRateRpm).toBeLessThan(1250);
    expect(clearance(result)).toBeLessThan(1.8);
  });

  it('automatically supplies a low deep ball instead of making a very slow request a compulsory lob', () => {
    const result = resolveTrajectory({ ...deep, launchSpeedKmh: 45, spinRateRpm: 300 });
    expectTarget(result);
    expect(clearance(result)).toBeLessThan(1.8);
    expect(result.resolved.launchSpeedKmh).toBeLessThanOrEqual(110);
    const physical = integrateTrajectory({ ...result.intent, ...result.resolved }, result.launchVelocity);
    expect(result.samples).toEqual(physical.samples);
  });

  it('honors explicitly high clearance and keeps Exact and Lob available', () => {
    const high = resolveTrajectory({ ...deep, launchSpeedKmh: 70, minimumNetClearanceM: 4 });
    expectTarget(high);
    expect(clearance(high)).toBeGreaterThanOrEqual(3.985);
    const exact = resolveTrajectory({ ...deep, trajectoryMode: 'exact', launchSpeedKmh: 70 });
    expectTarget(exact);
    expect(exact.resolved.launchSpeedKmh).toBeCloseTo(70, 8);
    expect(exact.resolved.spinRateRpm).toBeCloseTo(1224, 8);
    expect(clearance(exact)).toBeGreaterThan(3.5);
    const lob = resolveTrajectory({ ...deep, source: { x: 0, y: 1.05, z: 6 }, target: { x: 0, z: -9.3 },
      shotType: 'lob', launchSpeedKmh: 52, spinRateRpm: 1199 });
    expectTarget(lob);
    expect(clearance(lob)).toBeGreaterThan(3.5);
  });

  it.each(['flat', 'topspin', 'slice'] as const)('keeps legal lower %s arcs across lateral deep targets', spin => {
    for (const x of [-3.5, 0, 3.5]) {
      const result = resolveTrajectory({ ...deep, target: { x, z: -10.5 }, launchSpeedKmh: 70, spin });
      expectTarget(result);
      expect(clearance(result)).toBeLessThan(3.5);
      expect(result.resolved.spinRateRpm).toBeGreaterThanOrEqual(spin === 'flat' ? 0 : 120 - 1e-8);
    }
  });

  it('preserves an already comfortable feed and never invents topspin', () => {
    const intent = { ...deep, source: { x: 0, y: 1.15, z: 6 }, target: { x: 0, z: -8 },
      launchSpeedKmh: 80, spinRateRpm: 0 };
    const result = resolveTrajectory(intent);
    expectTarget(result);
    expect(clearance(result)).toBeLessThan(1.25);
    expect(result.resolved.launchSpeedKmh).toBeCloseTo(80, 8);
    expect(result.resolved.spinRateRpm).toBe(0);
  });
});
