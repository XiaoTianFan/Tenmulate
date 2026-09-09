import { COURT } from '../../domain/court';
import type { ShotFamily } from '../../content/types';
import type { Vec3 } from '../../domain/vector';
import type { LandingZone } from '../trajectory/landingZone';
import { aimDirectionToCourtPoint, netHeightAt, resolveTrajectory, type FlightSample, type ResolvedTrajectory } from '../trajectory/physics';
import { legalReturnContacts } from './playerCoverage';
export type RallyReturn = Readonly<{ trajectory: ResolvedTrajectory; contactTime: number;
  duration: number; contactErrorM: number; speedRatio: number }>;

export type ReturnCandidate = Readonly<{ rally: RallyReturn; contact: FlightSample; source: Vec3; gap: number }>;
const rotate = (p: Vec3): Vec3 => ({ x: -p.x, y: p.y, z: -p.z });

/** Solve in the trajectory solver's canonical half, then rotate the complete
 * physical flight 180 degrees. No endpoint snapping or retiming of the ball. */
function returnFlight(incoming: ResolvedTrajectory, contact: FlightSample, target: { x: number; z: number },
  zone: LandingZone, pace: number, overhead: boolean): ResolvedTrajectory {
  const source = rotate(contact.position), mirroredTarget = { x: -target.x, z: -target.z };
  const flight = resolveTrajectory({ source, target: mirroredTarget,
    aimDirectionDeg: aimDirectionToCourtPoint(source, mirroredTarget),
    family: overhead ? 'lob' : 'groundstroke', spin: 'topspin', spinRateRpm: overhead ? 1100 : 600,
    launchSpeedKmh: pace, trajectoryMode: 'natural', minimumNetClearanceM: overhead ? 2.5 : .25,
    surface: incoming.intent.surface, windVelocity: incoming.intent.windVelocity && rotate(incoming.intent.windVelocity),
    bounceFactor: incoming.intent.bounceFactor,
  });
  return { ...flight, intent: { ...flight.intent, source: contact.position, target, landingZone: zone,
    aimDirectionDeg: undefined, windVelocity: incoming.intent.windVelocity },
    launchVelocity: rotate(flight.launchVelocity),
    samples: flight.samples.map(s => ({ ...s, position: rotate(s.position), velocity: rotate(s.velocity) })),
    events: flight.events.map(e => ({ ...e, position: rotate(e.position) })) };
}

/** Bounded flight search. The compiler checks opponent/camera feasibility before
 * accepting a contact. The sampled bounce target stays fixed across candidates. */
export function returnPlanCandidates(incoming: ResolvedTrajectory, family: ShotFamily, zone: LandingZone,
  target: { x: number; z: number }, preferredGap: number): ReturnCandidate[] {
  if (family === 'serve') return [];
  const legal = legalReturnContacts(incoming);
  const bounced = legal.filter(s => s.bounced && s.position.y >= .55 && s.position.y <= 1.5);
  const contacts = bounced.length ? bounced : legal;
  if (!contacts.length) return [];
  const ranked = [...contacts].sort((a, b) => Math.abs(a.position.y - 1.05) - Math.abs(b.position.y - 1.05));
  const selected = [...new Set([ranked[0]!, contacts[0]!])];
  const preferred = incoming.resolved.launchSpeedKmh;
  const results: ReturnCandidate[] = [];
  for (const contact of selected) {
    for (const factor of [1, .8, 1.2]) {
      const flight = returnFlight(incoming, contact, target, zone, Math.max(45, Math.min(135, preferred * factor)), family === 'overhead');
      const net = flight.events.find(e => e.type === 'net-crossing');
      const bounce = flight.events.find(e => e.type === 'bounce');
      if (!net || net.position.y < netHeightAt(net.position.x) + COURT.ballRadius + .05 || !bounce
        || bounce.position.x < zone.minX - .04 || bounce.position.x > zone.maxX + .04
        || bounce.position.z < zone.minZ - .04 || bounce.position.z > zone.maxZ + .04) continue;
      const end = flight.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
      const eligible = (s: FlightSample) => s.time > net.time && s.time < end && s.position.z > .3
        && s.position.z < COURT.halfLength + 3 && Math.abs(s.position.x) < COURT.singlesWidth / 2 + 1.5
        && (family === 'volley' ? !s.bounced && s.position.z < COURT.serviceLineFromNet && s.position.y >= .65 && s.position.y <= 1.75
          : family === 'overhead' ? !s.bounced && s.position.y >= 1.8 && s.position.y <= 2.65
          : s.bounced && s.position.y >= (family === 'half-volley' ? .25 : .55) && s.position.y <= (family === 'half-volley' ? .8 : 1.5));
      const samples = flight.samples.filter(eligible);
      // Include the precise requested clock when it lies inside a legal segment.
      const desired = preferredGap - contact.time;
      const upper = flight.samples.findIndex(s => s.time >= desired);
      if (upper > 0) {
        const a = flight.samples[upper - 1]!, b = flight.samples[upper]!;
        if (eligible(a) && eligible(b)) {
          const t = (desired - a.time) / (b.time - a.time);
          const mix = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
          samples.push({ time: desired, position: mix(a.position, b.position), velocity: mix(a.velocity, b.velocity), bounced: a.bounced });
        }
      }
      for (const sample of samples) {
        // A later sample is a genuine intercept along this flight, not a new emitter.
        results.push({ source: sample.position, contact: sample, gap: contact.time + sample.time,
          rally: { contactTime: contact.time, duration: sample.time, contactErrorM: 0,
            speedRatio: flight.resolved.launchSpeedKmh / preferred,
            trajectory: flight } });
      }
    }
  }
  return results.sort((a, b) => {
    const score = (c: ReturnCandidate) => Math.abs(c.gap - preferredGap) + Math.abs(1 - c.rally.speedRatio) * .12
      + Math.abs(c.source.y - (family === 'overhead' ? 2.3 : family === 'half-volley' ? .5 : 1.05)) * .04;
    return score(a) - score(b);
  });
}

/** Trim only the accepted flight. Candidate scans share immutable simulation data. */
export function finishReturn(candidate: ReturnCandidate): RallyReturn {
  const { rally, contact } = candidate, flight = rally.trajectory;
  return { ...rally, trajectory: { ...flight,
    samples: [...flight.samples.filter(s => s.time < contact.time), contact],
    events: flight.events.filter(e => e.time <= contact.time) } };
}
