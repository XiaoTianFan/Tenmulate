import { describe, expect, it } from 'vitest';
import { ballDefaults, openingFor, PLAYER_SHOT_BY_ID } from '../src/content/playerShots';
import { defaultDrillSettings } from '../src/app/defaults';
import type { DrillDefinitionV2 } from '../src/content/types';
import { compilePlayerDrill } from '../src/engine/session/compilePlayerDrill';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { landsInZone, playerContactAnchor, resolveCourtFlight, rotateCourtFlight } from '../src/engine/session/courtFlight';
import { integrateTrajectory, netHeightAt, type ShotIntent } from '../src/engine/trajectory/physics';

const intent: ShotIntent = { source: { x: 0, y: 1.6, z: 3.7 }, target: { x: 0, z: -9 },
  landingZone: { minX: -.8, maxX: .8, minZ: -10, maxZ: -8 }, family: 'volley',
  launchSpeedKmh: 45, spin: 'slice', spinRateRpm: 650, minimumNetClearanceM: .12,
  trajectoryMode: 'natural', surface: 'hard' };
const clearance = (flight: ReturnType<typeof resolveCourtFlight>) => {
  const net = flight.events.find(event => event.type === 'net-crossing')!;
  return net.position.y - netHeightAt(net.position.x);
};
function singleShot(preset: string, eyeHeight: number) {
  const source = PLAYER_SHOT_BY_ID.get(preset)!.event;
  const event = { ...source, camera: { ...source.camera, eyeHeight } };
  const drill: DrillDefinitionV2 = { schemaVersion: 2, id: 'net-contact', title: 'Net contact', description: '',
    category: 'Custom', playerHand: 'right', launch: openingFor(event), events: [event], defaultInterval: 5, defaultRepetitions: 1 };
  return { event, drill, settings: { ...defaultDrillSettings(drill), repetitions: 1, restSeconds: 0 } };
}

describe('direct volley and half-volley flights', () => {
  it.each([1.6, 1.9])('drives a high %s m volley flat or downward with a real landing', height => {
    for (const z of [3.7, 6]) {
      const flight = resolveCourtFlight({ ...intent, source: { ...intent.source, y: height, z } });
      expect(landsInZone(flight)).toBe(true);
      expect(flight.solution!.targetErrorM).toBeLessThan(.18);
      expect(flight.resolved.launchAngleDeg).toBeLessThan(1);
      expect(flight.apexHeight).toBeLessThanOrEqual(height + .03);
      expect(clearance(flight)).toBeGreaterThanOrEqual(.105);
      // Compare to independent forward integration: no hand-edited path samples.
      const physical = integrateTrajectory({ ...flight.intent, ...flight.resolved }, flight.launchVelocity);
      expect(flight.samples).toHaveLength(physical.samples.length);
      flight.samples.forEach((sample, index) => {
        expect(sample.time).toBe(physical.samples[index]!.time);
        for (const axis of ['x', 'y', 'z'] as const) expect(sample.position[axis]).toBeCloseTo(physical.samples[index]!.position[axis], 10);
      });
    }
  });

  it.each(['volley', 'half-volley'])('gives low %s contacts only the lift they need', family => {
    const flight = resolveCourtFlight({ ...intent, family, source: { x: 0, y: family === 'volley' ? .75 : .5, z: 6 }, launchSpeedKmh: 55 });
    expect(landsInZone(flight)).toBe(true);
    expect(flight.launchVelocity.y).toBeGreaterThan(0);
    expect(flight.resolved.launchAngleDeg).toBeLessThan(15);
    expect(clearance(flight)).toBeGreaterThanOrEqual(.105);
    expect(clearance(flight)).toBeLessThan(.4);
    expect(flight.apexHeight).toBeLessThan(1.5);
  });

  it.each(['volley', 'half-volley'])('uses the same physical %s solution for both sides', family => {
    const opponent = resolveCourtFlight({ ...intent, family, source: { ...intent.source, y: family === 'volley' ? 1.6 : .5 } });
    const rotated = rotateCourtFlight(opponent);
    const player = resolveCourtFlight(rotated.intent);
    expect(JSON.stringify(player.samples)).toEqual(JSON.stringify(rotated.samples));
  });

  it('honors Exact speed/spin and explicitly higher net clearance', () => {
    const exact = resolveCourtFlight({ ...intent, trajectoryMode: 'exact' });
    expect(exact.resolved.launchSpeedKmh).toBeCloseTo(45, 8);
    expect(exact.resolved.spinRateRpm).toBeCloseTo(650, 8);
    const high = resolveCourtFlight({ ...intent, minimumNetClearanceM: 1 });
    expect(landsInZone(high)).toBe(true);
    expect(clearance(high)).toBeGreaterThanOrEqual(.985);
    expect(ballDefaults('half-volley').netClearanceM).toBe(.12);
  });

  it('connects an opponent half-volley at a real low rising bounce contact', () => {
    const base = PLAYER_DRILLS.find(drill => drill.id === 'net-overhead')!, first = base.events[0]!;
    const event = { ...first, opponentReturn: { ...first.opponentReturn, ball: { ...ballDefaults('half-volley'), stroke: 'auto' as const } } };
    const drill = { ...base, events: [event, ...base.events.slice(1)] };
    const session = compilePlayerDrill(drill, defaultDrillSettings(drill), { eventId: event.id, opening: false });
    expect(session.planningIssues).toEqual([]);
    const [outgoing, reply] = session.scheduledFlights!;
    const contact = outgoing!.trajectory.samples.at(-1)!;
    expect(contact.bounced).toBe(true);
    expect(contact.velocity.y).toBeGreaterThan(.45);
    expect(contact.position.y).toBeGreaterThanOrEqual(.65);
    expect(contact.position.y).toBeLessThanOrEqual(.8);
    expect(reply!.trajectory.intent.source).toEqual(contact.position);
    expect(landsInZone(reply!.trajectory)).toBe(true);
    expect(reply!.trajectory.resolved.launchAngleDeg).toBeLessThan(20);
  });
});

describe('camera-relative player net contact', () => {
  it.each(['volley-left', 'half-volley-body'])('moves %s contact height with the camera in isolated and actual playback', preset => {
    const sessions = [1.5, 1.9].map(eyeHeight => {
      const { event, drill, settings } = singleShot(preset, eyeHeight);
      const isolated = compilePlayerDrill(drill, settings, { eventId: event.id, opening: false });
      expect(isolated.planningIssues).toEqual([]);
      const offset = preset === 'volley-left' ? .1 : 1.2;
      expect(isolated.shotPreview!.player!.intent.source.y).toBeCloseTo(eyeHeight - offset, 8);
      const full = compilePlayerDrill(drill, settings);
      expect(full.planningIssues).toEqual([]);
      const shot = full.playerEvents![0]!, contact = full.repetitions[shot.incomingIndex]!.reachability.contact!;
      expect(shot.trajectory.intent.source).toEqual(contact.position);
      expect(contact.bounced).toBe(preset === 'half-volley-body');
      if (contact.bounced) expect(contact.velocity.y).toBeGreaterThan(.45);
      expect(shot.contactCamera.eyeHeight).toBe(eyeHeight);
      return shot.trajectory.intent.source.y;
    });
    expect(sessions[1]! - sessions[0]!).toBeGreaterThan(.05);
  });

  it('keeps half-volley contact low even with an elevated camera', () => {
    const { event } = singleShot('half-volley-body', 8);
    expect(playerContactAnchor(event).y).toBe(.8);
    expect(playerContactAnchor({ ...event, camera: { ...event.camera, eyeHeight: .5 } }).y).toBe(.25);
  });
});
