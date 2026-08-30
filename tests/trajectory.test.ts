import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';
import { POST_BOUNCE_SIMULATION_SECONDS, aimDirectionToCourtPoint, netHeightAt, resolveTrajectory } from '../src/engine/trajectory/physics';
import { PRACTICE_SHOT_PROFILES, legalServeTarget, practiceLandingTarget } from '../src/engine/trajectory/practiceProfiles';

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

  it('uses surface friction to slow clay rebounds more than grass', () => {
    const intent = {
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: 0.8, z: -8.3 },
      paceKmh: 78,
      spin: 'topspin' as const,
    };
    const reboundSample = (surface: 'clay' | 'grass') => {
      const trajectory = resolveTrajectory({ ...intent, surface });
      const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
      return trajectory.samples.find((sample) => sample.time >= bounce.time + 1 / 60)!;
    };
    const clay = reboundSample('clay');
    const grass = reboundSample('grass');
    const horizontalSpeed = (sample: typeof clay) => Math.hypot(sample.velocity.x, sample.velocity.z);

    expect(horizontalSpeed(clay)).toBeLessThan(horizontalSpeed(grass));
    expect(clay.velocity.y).toBeGreaterThan(grass.velocity.y);
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

  it('keeps an attainable landing depth independent from pace and minimum net clearance', () => {
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

    const fasterNet = faster.events.find((event) => event.type === 'net-crossing')!;
    const higherNet = higher.events.find((event) => event.type === 'net-crossing')!;
    expect(fasterNet.position.y).toBeGreaterThan(COURT.netCenterHeight + 0.2);
    expect(Math.abs(slowerBounce.position.z + 8)).toBeLessThan(0.25);
    expect(Math.abs(fasterBounce.position.z + 8)).toBeLessThan(0.25);
    expect(Math.abs(higherBounce.position.z + 8)).toBeLessThan(0.25);
    expect(higherNet.position.y).toBeGreaterThanOrEqual(netHeightAt(higherNet.position.x) + 0.85);
    expect(higherNet.position.y).toBeGreaterThan(fasterNet.position.y + 0.03);
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

  it('gives flat, topspin, and slice groundstrokes distinct trajectories', () => {
    const profile = PRACTICE_SHOT_PROFILES.groundstroke;
    const source = { ...profile.opponentPosition, y: profile.contactHeight };
    const trajectoryFor = (spin: 'flat' | 'topspin' | 'slice') => resolveTrajectory({
      source,
      target: { x: 0, z: -8 },
      aimDirectionDeg: 8,
      paceKmh: profile.defaultPaceKmh,
      netClearanceM: profile.defaultNetClearanceM,
      spin,
      shotType: 'groundstroke',
      surface: 'hard',
    });
    const flat = trajectoryFor('flat');
    const topspin = trajectoryFor('topspin');
    const slice = trajectoryFor('slice');

    expect(topspin.launchVelocity.y).not.toBeCloseTo(flat.launchVelocity.y, 2);
    expect(slice.launchVelocity.y).not.toBeCloseTo(flat.launchVelocity.y, 2);
    expect(topspin.events.find((event) => event.type === 'bounce')?.position.z).not.toBeCloseTo(slice.events.find((event) => event.type === 'bounce')?.position.z ?? 0, 1);
  });

  it('uses landing depth independently from recreational groundstroke pace and minimum net clearance', () => {
    const profile = PRACTICE_SHOT_PROFILES.groundstroke;
    const source = { ...profile.opponentPosition, y: profile.contactHeight };
    const target = practiceLandingTarget(source, 0, 10);
    const trajectory = resolveTrajectory({
      source,
      target,
      aimDirectionDeg: 0,
      paceKmh: 68,
      netClearanceM: 0.36,
      spin: 'flat',
      shotType: 'groundstroke',
      surface: 'hard',
    });
    const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
    const net = trajectory.events.find((event) => event.type === 'net-crossing')!;

    expect(net.time).toBeLessThan(bounce.time);
    expect(net.position.y).toBeGreaterThanOrEqual(netHeightAt(net.position.x) + 0.35);
    expect(bounce.position.z).toBeCloseTo(target.z, 1);
    expect(Math.hypot(...Object.values(trajectory.launchVelocity))).toBeCloseTo(68 / 3.6, 6);
  });

  it('resolves a lob as a high arc to a separately selected deep landing', () => {
    const profile = PRACTICE_SHOT_PROFILES.lob;
    const source = { ...profile.opponentPosition, y: profile.contactHeight };
    const target = practiceLandingTarget(source, -5, profile.defaultLandingDepthM);
    const trajectory = resolveTrajectory({
      source,
      target,
      aimDirectionDeg: -5,
      paceKmh: profile.defaultPaceKmh,
      netClearanceM: profile.defaultNetClearanceM,
      spin: profile.defaultSpin,
      shotType: 'lob',
      surface: 'hard',
    });
    const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
    const net = trajectory.events.find((event) => event.type === 'net-crossing')!;

    expect(net.time).toBeLessThan(bounce.time);
    expect(net.position.y).toBeGreaterThanOrEqual(netHeightAt(net.position.x) + 3.15);
    expect(trajectory.apexHeight).toBeGreaterThan(5);
    expect(trajectory.apexHeight).toBeLessThan(8.5);
    expect(bounce.position.z).toBeCloseTo(target.z, 1);
  });

  it('derives aim direction in the same player-view horizontal coordinate system', () => {
    const source = { x: 0, z: COURT.halfLength - 0.65 };
    expect(aimDirectionToCourtPoint(source, { x: 2, z: -8 })).toBeGreaterThan(0);
    expect(aimDirectionToCourtPoint(source, { x: -2, z: -8 })).toBeLessThan(0);
  });

  it('continues the physical trajectory for three seconds after first ground contact', () => {
    const trajectory = resolveTrajectory({
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 },
      target: { x: 0, z: -8 },
      aimDirectionDeg: 0,
      paceKmh: 78,
      netClearanceM: 0.35,
      spin: 'topspin',
      surface: 'hard',
    });
    const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
    const receiver = trajectory.events.find((event) => event.type === 'receiver-plane')!;
    const finalSample = trajectory.samples.at(-1)!;
    const postBounceSamples = trajectory.samples.filter((sample) => sample.time >= bounce.time);

    expect(finalSample.time - bounce.time).toBeGreaterThanOrEqual(POST_BOUNCE_SIMULATION_SECONDS);
    expect(finalSample.time).toBeGreaterThan(receiver.time);
    expect(finalSample.position.z).toBeLessThan(receiver.position.z);
    expect(Math.min(...postBounceSamples.map((sample) => sample.position.y))).toBeGreaterThanOrEqual(COURT.ballRadius);
  });

  it.each(['flat', 'slice', 'kick'] as const)('keeps a %s serve inside the diagonal service box', (spin) => {
    const profile = PRACTICE_SHOT_PROFILES.serve;
    const source = { ...profile.opponentPosition, y: profile.contactHeight };
    const target = legalServeTarget(source, spin === 'slice' ? -18 : 0, profile.defaultPaceKmh, profile.defaultNetClearanceM, spin);
    const trajectory = resolveTrajectory({
      source,
      target,
      aimDirectionDeg: spin === 'slice' ? -18 : 0,
      paceKmh: profile.defaultPaceKmh,
      netClearanceM: profile.defaultNetClearanceM,
      spin,
      shotType: 'serve',
      opponentHand: 'right',
      surface: 'hard',
    });
    const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
    expect(trajectory.events.find((event) => event.type === 'net-crossing')?.position.y ?? 0).toBeGreaterThan(COURT.netCenterHeight);
    expect(bounce.position.z).toBeGreaterThanOrEqual(-COURT.serviceLineFromNet);
    expect(bounce.position.z).toBeLessThan(0);
    expect(bounce.position.x).toBeLessThan(0);
    expect(Math.abs(bounce.position.x)).toBeLessThanOrEqual(COURT.singlesWidth / 2);
  });

  it('gives flat, slice, and kick serves distinct physical trajectories', () => {
    const profile = PRACTICE_SHOT_PROFILES.serve;
    const source = { ...profile.opponentPosition, y: profile.contactHeight };
    const trajectoryFor = (spin: 'flat' | 'slice' | 'kick') => resolveTrajectory({
      source,
      target: legalServeTarget(source, 0, profile.defaultPaceKmh, profile.defaultNetClearanceM, spin),
      aimDirectionDeg: 0,
      paceKmh: profile.defaultPaceKmh,
      netClearanceM: profile.defaultNetClearanceM,
      spin,
      shotType: 'serve',
      opponentHand: 'right',
      surface: 'hard',
    });
    const flat = trajectoryFor('flat');
    const slice = trajectoryFor('slice');
    const kick = trajectoryFor('kick');
    expect(slice.launchVelocity.x).not.toBeCloseTo(flat.launchVelocity.x, 2);
    expect(kick.launchVelocity.y).not.toBeCloseTo(flat.launchVelocity.y, 2);
    expect(kick.events.find((event) => event.type === 'bounce')?.position.z).not.toBeCloseTo(flat.events.find((event) => event.type === 'bounce')?.position.z ?? 0, 1);
  });

  it('models a volley as spin-free even if stale settings contain a spin value', () => {
    const base = {
      source: { x: 0, y: 1.32, z: 3.7 }, target: { x: 0, z: -4 }, aimDirectionDeg: 0,
      paceKmh: 62, netClearanceM: 0.15, shotType: 'volley' as const, surface: 'hard' as const,
    };
    expect(resolveTrajectory({ ...base, spin: 'flat' }).samples).toEqual(resolveTrajectory({ ...base, spin: 'kick' }).samples);
  });

  it('applies the practice bounce-height factor only to the post-impact arrival', () => {
    const base = {
      source: { x: 0, y: 1.15, z: COURT.halfLength - 0.65 }, target: { x: 0, z: -8 }, aimDirectionDeg: 0,
      paceKmh: 78, netClearanceM: 0.35, spin: 'topspin' as const, shotType: 'groundstroke' as const, surface: 'hard' as const,
    };
    const low = resolveTrajectory({ ...base, bounceFactor: 0.7 });
    const natural = resolveTrajectory({ ...base, bounceFactor: 1 });
    const high = resolveTrajectory({ ...base, bounceFactor: 1.3 });
    const postBounceApex = (trajectory: typeof natural) => {
      const bounce = trajectory.events.find((event) => event.type === 'bounce')!;
      return Math.max(...trajectory.samples.filter((sample) => sample.time > bounce.time).map((sample) => sample.position.y));
    };
    expect(low.launchVelocity).toEqual(natural.launchVelocity);
    expect(high.launchVelocity).toEqual(natural.launchVelocity);
    expect(postBounceApex(low)).toBeLessThan(postBounceApex(natural));
    expect(postBounceApex(high)).toBeGreaterThan(postBounceApex(natural));
    expect(postBounceApex(natural)).toBeGreaterThan(0.65);
  });
});
