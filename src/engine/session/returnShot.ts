import type { ReturnShotConfiguration, ReturnShotType, ShotFamily } from '../../content/types';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';
import { legalReturnContacts } from './playerCoverage';

export const RETURN_SHOT_PROFILES: Readonly<Record<ReturnShotType, {
  spin: ReturnShotConfiguration['spin']; rpm: number; pace: number; clearance: number; height: number;
}>> = {
  groundstroke: { spin: 'topspin', rpm: 600, pace: 70, clearance: .25, height: 1.05 },
  'drop-shot': { spin: 'slice', rpm: 1400, pace: 38, clearance: .12, height: .9 },
  volley: { spin: 'slice', rpm: 650, pace: 60, clearance: .12, height: 1.3 },
  overhead: { spin: 'flat', rpm: 760, pace: 95, clearance: .12, height: 2.3 },
  lob: { spin: 'topspin', rpm: 1100, pace: 60, clearance: 2.5, height: 1.05 },
};
export const defaultReturnShot = (type: ReturnShotType, spin = RETURN_SHOT_PROFILES[type].spin): ReturnShotConfiguration => ({
  type, spin, spinRateRpm: spin === RETURN_SHOT_PROFILES[type].spin ? RETURN_SHOT_PROFILES[type].rpm
    : spin === 'flat' ? type === 'volley' ? 0 : 120 : spin === 'slice' ? 1253 : 600,
});
/** Old drills implicitly lobbed to the next overhead. Explicit choices never depend on that next shot. */
export const resolveReturnShot = (shot?: ReturnShotConfiguration, nextFamily?: ShotFamily): ReturnShotConfiguration =>
  shot ? { ...shot, spinRateRpm: shot.spinRateRpm ?? defaultReturnShot(shot.type, shot.spin).spinRateRpm }
    : defaultReturnShot(nextFamily === 'overhead' ? 'lob' : 'groundstroke');

export function returnShotContacts(incoming: ResolvedTrajectory, type: ReturnShotType): readonly FlightSample[] {
  return legalReturnContacts(incoming).filter(sample => type === 'volley'
    ? !sample.bounced && sample.position.y >= .65 && sample.position.y <= 1.75
    : type === 'overhead' ? !sample.bounced && sample.position.y >= 1.8 && sample.position.y <= 2.65
      : sample.bounced && sample.position.y >= (type === 'drop-shot' ? .25 : .55) && sample.position.y <= 1.5);
}
