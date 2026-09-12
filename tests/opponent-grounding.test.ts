import { expect, it } from 'vitest';
import { groundedOpponentContacts, opponentContactCeiling } from '../src/engine/session/opponentContact';
import { resolveCourtFlight } from '../src/engine/session/courtFlight';
import type { FlightSample } from '../src/engine/trajectory/physics';

const sample = (time: number, height: number, vy: number, bounced = true): FlightSample => ({
  time, position: { x: 0, y: height, z: 11 }, velocity: { x: 0, y: vy, z: 3 }, bounced,
});
const rise = sample(1.2, 1.35, 2), apex = sample(1.5, 1.6, 0), high = sample(1.65, 1.45, -1);
const reachable = sample(1.85, 1.05, -2), late = sample(2, .8, -3);
const flight = { ...resolveCourtFlight({ source: { x: 0, y: 1, z: -12 }, target: { x: 0, z: 9 },
  launchSpeedKmh: 65, spin: 'topspin', surface: 'hard' }),
  samples: [rise, apex, high, reachable, late],
  events: [{ type: 'bounce' as const, time: 1, position: { x: 0, y: .03, z: 9 }, speedKmh: 30 },
    { type: 'second-bounce' as const, time: 2.3, position: { x: 0, y: .03, z: 13 }, speedKmh: 20 }],
};

it.each(['rise', 'apex', 'descent'] as const)('waits for a real supported contact when the requested %s is too high', timing => {
  const contacts = groundedOpponentContacts(flight, 'groundstroke', flight.samples, timing, 1.1);
  expect(contacts).toEqual([reachable, late]);
  expect(contacts[0]).toBe(reachable); // Original sample, position and clock stay together.
  expect(flight.samples[1]).toBe(apex);
});

it('keeps a supported apex and never converts a half-volley or volley into a different bounce phase', () => {
  expect(groundedOpponentContacts(flight, 'groundstroke', flight.samples, 'apex', 1.7)).toEqual([apex]);
  expect(groundedOpponentContacts(flight, 'half-volley', [rise], 'rise', 1.1)).toEqual([]);
  const volley = [sample(.5, 1.8, -2, false), sample(.7, 1.3, -3, false)];
  expect(groundedOpponentContacts(flight, 'volley', volley, 'apex', 1.4)).toEqual([volley[1]]);
  expect(groundedOpponentContacts(flight, 'groundstroke', [apex, high], 'apex', 1.1)).toEqual([]);
});

it('uses the selected clip height and keeps automatic sides free to follow footwork', () => {
  const ball = { family: 'groundstroke' as const, spin: 'slice' as const };
  expect(opponentContactCeiling({ ...ball, stroke: 'forehand' })).toBeCloseTo(.9873, 3);
  expect(opponentContactCeiling({ ...ball, stroke: 'backhand' })).toBeCloseTo(1.1796, 3);
  expect(opponentContactCeiling({ ...ball, stroke: 'auto' })).toBeCloseTo(.9873, 3);
});
