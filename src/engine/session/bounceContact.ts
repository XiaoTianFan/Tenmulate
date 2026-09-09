import type { ShotFamily } from '../../content/types';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';

export type BounceContactPhase = 'rise' | 'apex' | 'descent' | 'air';
export type BounceContactPreference = Readonly<{ phase: BounceContactPhase; time: number }>;

/** Prefer early descent, with occasional rising and apex contacts. Times come
 * from the actual first bounce, before the second bounce; no flight is retimed. */
export function bounceContactPreference(flight: ResolvedTrajectory, family: ShotFamily, draw: number): BounceContactPreference | null {
  if (family === 'serve' || family === 'volley' || family === 'overhead') return null;
  const bounce = flight.events.find(e => e.type === 'bounce');
  const end = flight.events.find(e => e.type === 'second-bounce')?.time ?? Infinity;
  const samples = flight.samples.filter(s => s.bounced && s.time < end);
  if (!bounce || !samples.length) return null;
  const apex = samples.reduce((a, b) => b.position.y > a.position.y ? b : a);
  const rise = apex.time - bounce.time;
  if (family === 'half-volley') return { phase: 'rise', time: bounce.time + Math.min(.1, rise * .25) };
  return draw < .25 ? { phase: 'rise', time: bounce.time + rise * .65 }
    : draw < .45 ? { phase: 'apex', time: apex.time }
      : { phase: 'descent', time: apex.time + Math.min(.2, rise * .28) };
}
export const bounceContactCost = (sample: FlightSample, preference: BounceContactPreference | null): number =>
  preference ? Math.abs(sample.time - preference.time) * 3 : 0;
export const bounceContactPhase = (sample: FlightSample): BounceContactPhase => !sample.bounced ? 'air'
  : Math.abs(sample.velocity.y) < .45 ? 'apex' : sample.velocity.y > 0 ? 'rise' : 'descent';
