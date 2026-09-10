import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';
import { resolveCourtBounce, SURFACE_PROFILES, surfaceRestitution } from '../src/engine/trajectory/courtBounce';
import { integrateTrajectory, type ResolvedTrajectory, type ShotIntent } from '../src/engine/trajectory/physics';
import { resolveCourtFlight, rotateCourtFlight } from '../src/engine/session/courtFlight';

const rebound = (flight: ResolvedTrajectory) => {
  const first = flight.events.find(e => e.type === 'bounce')!.time;
  const second = flight.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
  return flight.samples.filter(s => s.time >= first && s.time < second);
};
const peak = (flight: ResolvedTrajectory) => Math.max(...rebound(flight).map(s => s.position.y));
const intent: ShotIntent = { source: { x: 0, y: 1.05, z: 12.5 }, target: { x: -1, z: -9.5 },
  landingZone: { minX: -1.5, maxX: -.5, minZ: -10, maxZ: -9 }, launchSpeedKmh: 70,
  spin: 'topspin', spinRateRpm: 600, shotType: 'groundstroke', trajectoryMode: 'natural', surface: 'hard', bounceFactor: 1 };

describe('calibrated deformable tennis-ball bounce', () => {
  it('meets the ITF Type 2 reference drop, measuring to the bottom of the ball', () => {
    const flight = integrateTrajectory({ ...intent, source: { x: 0, y: 2.54 + COURT.ballRadius, z: 5 },
      spin: 'flat', spinRateRpm: 0, launchSpeedKmh: 0 }, { x: 0, y: 0, z: 0 });
    // ITF TB 04/01: 254 cm drop, 135–147 cm rebound on a rigid reference.
    // Forward integration includes drag on both sides of the impact.
    expect(peak(flight) - COURT.ballRadius).toBeGreaterThanOrEqual(1.35);
    expect(peak(flight) - COURT.ballRadius).toBeLessThanOrEqual(1.47);
  });

  it('matches oblique court measurements without confusing total and vertical impact speed', () => {
    // Cross 2003: oblique hard/clay COR usually 0.8–0.9; the simple drop is lower.
    const impact = { x: 0, y: -7, z: 20 };
    for (const surface of [SURFACE_PROFILES.hard, SURFACE_PROFILES.clay]) {
      const out = resolveCourtBounce(impact, { x: 0, y: 0, z: 0 }, surface);
      expect(out.velocity.y / 7).toBeGreaterThan(.8);
      expect(out.velocity.y / 7).toBeLessThan(.91);
      expect(out.velocity.z / 20).toBeGreaterThan(.4);
      expect(out.velocity.z / 20).toBeLessThan(.65);
      expect(out.velocity.y / 7).toBeGreaterThan(surfaceRestitution(surface, { ...impact, z: 0 }));
    }
  });

  it('keeps impact energy passive across surface, angle and spin without a practice override', () => {
    const energy = (v: { x: number; y: number; z: number }, w: typeof v) =>
      v.x ** 2 + v.y ** 2 + v.z ** 2 + .55 * COURT.ballRadius ** 2 * (w.x ** 2 + w.y ** 2 + w.z ** 2);
    for (const surface of Object.values(SURFACE_PROFILES)) for (const normal of [.2, 2, 7, 15, 30])
      for (const horizontal of [0, 2, 10, 30, 60]) for (const rpm of [-6000, -1200, 0, 1200, 6000]) {
        const v = { x: horizontal * .6, y: -normal, z: horizontal * .8 };
        const rate = rpm * Math.PI / 30, w = { x: rate * .8, y: rate * .2, z: -rate * .6 };
        const out = resolveCourtBounce(v, w, surface);
        expect(energy(out.velocity, out.spin), JSON.stringify({ surface: surface.id, normal, horizontal, rpm })).toBeLessThanOrEqual(energy(v, w) + 1e-7);
        expect(out.velocity.y).toBeGreaterThan(0);
      }
  });

  it('uses the same higher rebound on either side while preserving landing geometry', () => {
    const opponent = resolveCourtFlight(intent), player = resolveCourtFlight({ ...intent,
      source: { x: -intent.source.x, y: 1.05, z: -12.5 }, target: { x: 1, z: 9.5 },
      landingZone: { minX: .5, maxX: 1.5, minZ: 9, maxZ: 10 } });
    expect(player.samples).toEqual(rotateCourtFlight(opponent).samples);
    expect(peak(opponent)).toBeGreaterThan(.95);
    expect(peak(opponent)).toBeLessThan(Math.max(...opponent.samples.filter(s => !s.bounced).map(s => s.position.y)));
    const landing = opponent.events.find(e => e.type === 'bounce')!.position;
    expect(landing.x).toBeCloseTo(intent.target.x, 1);
    expect(landing.z).toBeCloseTo(intent.target.z, 1);
  });

  it('keeps bounce factor independent of the complete incoming flight and first landing', () => {
    const shots = [.6, 1, 1.4].map(bounceFactor => integrateTrajectory({ ...intent, bounceFactor }, { x: 0, y: 5, z: -20 }));
    for (const flight of shots) {
      expect(flight.samples.filter(s => !s.bounced)).toEqual(shots[1]!.samples.filter(s => !s.bounced));
      expect(flight.events.find(e => e.type === 'bounce')!.position).toEqual(shots[1]!.events.find(e => e.type === 'bounce')!.position);
    }
    expect(peak(shots[0]!)).toBeLessThan(peak(shots[1]!));
    expect(peak(shots[2]!)).toBeGreaterThan(peak(shots[1]!));
  });

  it('has no artificial upward impulse on a shallow impact and retains surface differences', () => {
    const spin = { x: 0, y: 0, z: 0 }, velocity = { x: 0, y: -.01, z: 20 };
    const grazing = resolveCourtBounce(velocity, spin, SURFACE_PROFILES.hard);
    expect(grazing.velocity.y).toBeLessThan(.01);
    const impact = { x: 0, y: -7, z: 20 };
    const results = ['grass', 'hard', 'clay'].map(surface => resolveCourtBounce(impact, spin, SURFACE_PROFILES[surface as keyof typeof SURFACE_PROFILES]));
    expect(results[0]!.velocity.y).toBeLessThan(results[1]!.velocity.y);
    expect(results[1]!.velocity.y).toBeLessThan(results[2]!.velocity.y);
    expect(results[0]!.velocity.z).toBeGreaterThan(results[1]!.velocity.z);
    expect(results[1]!.velocity.z).toBeGreaterThan(results[2]!.velocity.z);
  });
});
