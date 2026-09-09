import type { ContactTiming, ShotFamily } from '../../content/types';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';

export type BounceContactPhase = 'rise' | 'apex' | 'descent' | 'air';
export type BounceContactPreference = Readonly<{ phase: BounceContactPhase; time: number }>;

export const normalizeContactTiming = (value: unknown): ContactTiming => value === 'rise' || value === 'apex' ? value : 'descent';
export const usesBounceContact = (family: ShotFamily): boolean => !['serve', 'volley', 'overhead'].includes(family);

/** Prefer the configured phase, defaulting to early descent. Times come
 * from the actual first bounce, before the second bounce; no flight is retimed. */
export function bounceContactPreference(flight: ResolvedTrajectory, family: ShotFamily, timing: ContactTiming = 'descent'): BounceContactPreference | null {
  if (!usesBounceContact(family)) return null;
  const bounce = flight.events.find(e => e.type === 'bounce');
  const end = flight.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
  const samples = flight.samples.filter(s => s.bounced && s.time < end);
  if (!bounce || !samples.length) return null;
  const apex = samples.reduce((a, b) => b.position.y > a.position.y ? b : a);
  const rise = apex.time - bounce.time;
  if (family === 'half-volley') return { phase: 'rise', time: bounce.time + Math.min(.1, rise * .25) };
  return timing === 'rise' ? { phase: 'rise', time: bounce.time + rise * .65 }
    : timing === 'apex' ? { phase: 'apex', time: apex.time }
      : { phase: 'descent', time: apex.time + Math.min(.2, rise * .28) };
}
/** Phase is a contact constraint; interval fitting cannot switch to an early
 * rebound to meet a short requested interval. Family-specific eligibility is
 * still enforced by the caller (half volleys have a fixed rising contact). */
export function contactsForTiming(flight: ResolvedTrajectory, family: ShotFamily, contacts: readonly FlightSample[], timing: ContactTiming = 'descent'): FlightSample[] {
  if (!usesBounceContact(family)) return [...contacts];
  const phase = family === 'half-volley' ? 'rise' : timing;
  const end = flight.events.find(event => event.type === 'second-bounce')?.time ?? Infinity;
  return contacts.filter(sample => sample.time < end && bounceContactPhase(sample) === phase);
}
export const bounceContactCost = (sample: FlightSample, preference: BounceContactPreference | null): number =>
  preference ? Math.abs(sample.time - preference.time) * 3 : 0;
export const bounceContactPhase = (sample: FlightSample): BounceContactPhase => !sample.bounced ? 'air'
  : Math.abs(sample.velocity.y) < .45 ? 'apex' : sample.velocity.y > 0 ? 'rise' : 'descent';
