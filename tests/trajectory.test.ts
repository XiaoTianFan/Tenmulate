import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';
import { resolveTrajectory } from '../src/engine/trajectory/physics';

describe('fixed-step trajectory solver', () => {
  it('clears the net and lands near the authored target', () => {
    const trajectory = resolveTrajectory({
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: -2.35, z: -8.9 },
      paceKmh: 78,
      spin: 'topspin',
      surface: 'hard',
    });
    const net = trajectory.events.find((event) => event.type === 'net-crossing');
    const bounce = trajectory.events.find((event) => event.type === 'bounce');
    expect(net).toBeDefined();
    expect(net?.position.y ?? 0).toBeGreaterThan(COURT.netCenterHeight);
    expect(bounce).toBeDefined();
    expect(bounce?.position.x).toBeCloseTo(-2.35, 1);
    expect(bounce?.position.z).toBeCloseTo(-8.9, 1);
  });

  it('keeps surface physics separate from visual trajectory intent', () => {
    const base = {
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: 0.8, z: -8.3 },
      paceKmh: 72,
      spin: 'flat' as const,
    };
    const hard = resolveTrajectory({ ...base, surface: 'hard' });
    const grass = resolveTrajectory({ ...base, surface: 'grass' });
    const hardArrival = hard.events.find((event) => event.type === 'receiver-plane');
    const grassArrival = grass.events.find((event) => event.type === 'receiver-plane');
    expect(hardArrival).toBeDefined();
    expect(grassArrival).toBeDefined();
    expect(grassArrival?.position.y).not.toBeCloseTo(hardArrival?.position.y ?? 0, 3);
  });

  it('reports both pre-bounce and post-bounce speeds for coach diagnostics', () => {
    const trajectory = resolveTrajectory({
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: 0.8, z: -8.4 },
      paceKmh: 82,
      spin: 'topspin',
      surface: 'hard',
    });
    const bounce = trajectory.events.find((event) => event.type === 'bounce');
    expect(bounce?.postSpeedKmh).toBeGreaterThan(0);
    expect(bounce?.postSpeedKmh ?? Infinity).toBeLessThan(bounce?.speedKmh ?? 0);
  });

  it('supports authored net clearance without changing the landing target contract', () => {
    const target = { x: -1.2, z: -8.4 };
    const trajectory = resolveTrajectory({
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 }, target, paceKmh: 76, spin: 'topspin', surface: 'hard', netClearanceM: 1.1,
    });
    const net = trajectory.events.find((event) => event.type === 'net-crossing')!;
    const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
    expect(net.position.y).toBeGreaterThanOrEqual(COURT.netCenterHeight + 1.05);
    expect(bounce.position.x).toBeCloseTo(target.x, 1);
    expect(bounce.position.z).toBeCloseTo(target.z, 1);
  });

  it('models sidespin as a distinct curved launch solution', () => {
    const base = { source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 }, target: { x: 1.4, z: -8.1 }, paceKmh: 74, surface: 'hard' as const };
    const flat = resolveTrajectory({ ...base, spin: 'flat' });
    const sidespin = resolveTrajectory({ ...base, spin: 'sidespin' });
    expect(sidespin.launchVelocity.x).not.toBeCloseTo(flat.launchVelocity.x, 3);
    expect(sidespin.events.find((event) => event.type === 'bounce')?.position.x).toBeCloseTo(1.4, 1);
  });

  it('uses air-relative forces so side wind shifts the authored calm-air landing', () => {
    const intent = {
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: 0, z: -8.5 },
      paceKmh: 78,
      spin: 'topspin' as const,
      surface: 'hard' as const,
    };
    const calm = resolveTrajectory(intent);
    const windy = resolveTrajectory({ ...intent, windVelocity: { x: 8, y: 0, z: 0 } });
    const calmBounce = calm.events.find((event) => event.type === 'bounce')!;
    const windyBounce = windy.events.find((event) => event.type === 'bounce')!;
    expect(windyBounce.position.x).toBeGreaterThan(calmBounce.position.x + 0.1);
  });

  it('replays the same wind configuration deterministically', () => {
    const intent = {
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 }, target: { x: -1, z: -8.2 }, paceKmh: 80,
      spin: 'slice' as const, surface: 'clay' as const, windVelocity: { x: -4, y: 0, z: 3 },
    };
    expect(resolveTrajectory(intent).events).toEqual(resolveTrajectory(intent).events);
  });

  it('derives a physical landing point from direction, pace, and net clearance', () => {
    const source = { x: 0, y: 1.15, z: COURT.halfLength - 0.65 };
    const base = {
      source,
      target: { x: 0, z: -8 },
      aimDirectionDeg: 0,
      spin: 'topspin' as const,
      surface: 'hard' as const,
    };
    const slower = resolveTrajectory({ ...base, paceKmh: 62, netClearanceM: 0.24 });
    const faster = resolveTrajectory({ ...base, paceKmh: 96, netClearanceM: 0.24 });
    const higher = resolveTrajectory({ ...base, paceKmh: 96, netClearanceM: 0.9 });
    const slowerBounce = slower.events.find((event) => event.type === 'bounce')!;
    const fasterBounce = faster.events.find((event) => event.type === 'bounce')!;
    const higherBounce = higher.events.find((event) => event.type === 'bounce')!;

    expect(faster.events.find((event) => event.type === 'net-crossing')?.position.y ?? 0).toBeGreaterThan(COURT.netCenterHeight + 0.2);
    expect(fasterBounce.position.z).toBeLessThan(slowerBounce.position.z);
    expect(higherBounce.position.z).toBeLessThan(fasterBounce.position.z);
  });

  it('uses right-left aim direction to move the calculated landing point', () => {
    const base = {
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: 0, z: -8 },
      paceKmh: 78,
      netClearanceM: 0.35,
      spin: 'flat' as const,
      surface: 'hard' as const,
    };
    const left = resolveTrajectory({ ...base, aimDirectionDeg: -12 });
    const right = resolveTrajectory({ ...base, aimDirectionDeg: 12 });
    expect(left.events.find((event) => event.type === 'bounce')!.position.x).toBeLessThan(0);
    expect(right.events.find((event) => event.type === 'bounce')!.position.x).toBeGreaterThan(0);
  });
});
