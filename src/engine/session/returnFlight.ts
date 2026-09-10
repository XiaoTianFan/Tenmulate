import { COURT } from '../../domain/court';
import type { ContactTiming, ReturnShotConfiguration, ShotFamily } from '../../content/types';
import type { Vec3 } from '../../domain/vector';
import type { LandingZone } from '../trajectory/landingZone';
import { netHeightAt, type FlightSample, type ResolvedTrajectory } from '../trajectory/physics';
import { resolveCourtFlight } from './courtFlight';
import { resolveReturnShot, RETURN_SHOT_PROFILES, returnShotContacts } from './returnShot';
import { bounceContactCost, bounceContactPreference, contactsForTiming } from './bounceContact';
import { CONTACT_COURT_LIMITS } from './playerCoverage';
export type RallyReturn = Readonly<{ trajectory: ResolvedTrajectory; contactTime: number;
  duration: number; contactErrorM: number; speedRatio: number }>;

export type ReturnCandidate = Readonly<{ rally: RallyReturn; contact: FlightSample; source: Vec3; gap: number }>;

/** Solve in the trajectory solver's canonical half, then rotate the complete
 * physical flight 180 degrees. No endpoint snapping or retiming of the ball. */
function returnFlight(incoming: ResolvedTrajectory, contact: FlightSample, target: { x: number; z: number },
  zone: LandingZone, pace: number, shot: ReturnShotConfiguration, accepts: (flight: ResolvedTrajectory) => boolean): ResolvedTrajectory {
  const profile = RETURN_SHOT_PROFILES[shot.type];
  return resolveCourtFlight({ source: contact.position, target, landingZone: zone,
    family: shot.type, spin: shot.spin, spinRateRpm: shot.spinRateRpm ?? profile.rpm,
    launchSpeedKmh: pace, trajectoryMode: 'natural', minimumNetClearanceM: profile.clearance,
    surface: incoming.intent.surface, windVelocity: incoming.intent.windVelocity,
    bounceFactor: incoming.intent.bounceFactor,
  }, accepts);
}

/** Bounded flight search. The compiler checks opponent/camera feasibility before
 * accepting a contact. The sampled bounce target stays fixed across candidates. */
export function returnPlanCandidates(incoming: ResolvedTrajectory, family: ShotFamily, zone: LandingZone,
  target: { x: number; z: number }, preferredGap: number, configuration?: ReturnShotConfiguration, opponentTiming: ContactTiming = 'descent',
  accepts?: (candidate: ReturnCandidate) => boolean): ReturnCandidate[] {
  if (family === 'serve') return [];
  const shot = resolveReturnShot(configuration, family), profile = RETURN_SHOT_PROFILES[shot.type];
  const contacts = contactsForTiming(incoming, shot.type, returnShotContacts(incoming, shot.type), shot.contactTiming);
  if (!contacts.length) return [];
  const playerPreference = bounceContactPreference(incoming, shot.type, shot.contactTiming);
  const playerCosts = new Map(contacts.map(contact => [contact.time, bounceContactCost(contact, playerPreference)]));
  const rank = (contact: FlightSample) => playerCosts.get(contact.time)! + Math.abs(contact.position.y - profile.height) * .15;
  const ranked = [...contacts].sort((a, b) => rank(a) - rank(b));
  // Nearby samples in one phase lead to nearly identical expensive flight fits.
  // Keep the preferred contact, plus the window's start when it is distinct.
  const selected = [ranked[0]!];
  if (Math.abs(contacts[0]!.time - selected[0]!.time) > .1) selected.push(contacts[0]!);
  const preferred = shot.paceKmh ?? profile.pace;
  const results: ReturnCandidate[] = [];
  const preferences = new Map<ResolvedTrajectory, ReturnType<typeof bounceContactPreference>>();
  for (const contact of selected) {
    const candidatesForFlight = (flight: ResolvedTrajectory): ReturnCandidate[] => {
      const net = flight.events.find(e => e.type === 'net-crossing');
      const bounce = flight.events.find(e => e.type === 'bounce');
      if (!net || net.position.y < netHeightAt(net.position.x) + COURT.ballRadius + .05 || !bounce
        || bounce.position.x < zone.minX - .04 || bounce.position.x > zone.maxX + .04
        || bounce.position.z < zone.minZ - .04 || bounce.position.z > zone.maxZ + .04) return [];
      const end = flight.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
      const eligible = (s: FlightSample) => s.time > net.time && s.time < end && s.position.z > .3
        && s.position.z <= CONTACT_COURT_LIMITS.halfLength && Math.abs(s.position.x) <= CONTACT_COURT_LIMITS.halfWidth
        && (family === 'volley' ? !s.bounced && s.position.z < COURT.serviceLineFromNet && s.position.y >= .65 && s.position.y <= 1.75
          : family === 'overhead' ? !s.bounced && s.position.y >= 1.8 && s.position.y <= 2.65
          : s.bounced && s.position.y >= (family === 'half-volley' ? .25 : .65) && s.position.y <= (family === 'half-volley' ? .8 : 1.5));
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
      return contactsForTiming(flight, family, samples, opponentTiming).map(sample => {
        // A later sample is a genuine intercept along this flight, not a new emitter.
        return { source: sample.position, contact: sample, gap: contact.time + sample.time,
          rally: { contactTime: contact.time, duration: sample.time, contactErrorM: 0,
            speedRatio: flight.resolved.launchSpeedKmh / preferred,
            trajectory: flight } };
      }).filter(c => !accepts || accepts(c));
    };
    // Timing selects a real intercept; it cannot lower the requested launch
    // energy again and turn a groundstroke into a lob just to fill an interval.
    for (const factor of shot.type === 'groundstroke' ? [1] : [1, .8, 1.2]) {
      const flight = returnFlight(incoming, contact, target, zone, preferred * factor, shot, f => candidatesForFlight(f).length > 0);
      preferences.set(flight, bounceContactPreference(flight, family, opponentTiming));
      results.push(...candidatesForFlight(flight));
    }
  }
  return results.sort((a, b) => {
    const score = (c: ReturnCandidate) => Math.abs(c.gap - preferredGap) * .2 + Math.abs(1 - c.rally.speedRatio) * .12
      + (playerCosts.get(c.rally.contactTime) ?? 0)
      + bounceContactCost(c.contact, preferences.get(c.rally.trajectory) ?? null)
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
