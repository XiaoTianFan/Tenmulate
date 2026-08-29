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
});
