import { DEFAULT_PREFERENCES, type PracticePreferencesV1 } from '../storage/appStorage';
import type { SessionCategory } from '../content/types';
import { OVERHEAD_PRACTICE_OPPONENT, QUICK_PRACTICE_VIEWS } from '../domain/practiceViews';
import { PRACTICE_SHOT_PROFILES, spinRateForPracticeShot } from '../engine/trajectory/practiceProfiles';

/** Reset bypasses browser overrides; project defaults remain the source of truth. */
export function practiceDefaults(category: SessionCategory, project: Record<string, PracticePreferencesV1>): PracticePreferencesV1 {
  if (project[category]) return structuredClone(project[category]);
  const overhead = category === 'Net & Overhead';
  const profile = PRACTICE_SHOT_PROFILES[overhead ? 'lob' : 'groundstroke'];
  return structuredClone({
    ...DEFAULT_PREFERENCES, sessionCategory: category,
    shotType: overhead ? 'lob' : 'groundstroke', spin: profile.defaultSpin,
    spinRateRpm: spinRateForPracticeShot(overhead ? 'lob' : 'groundstroke', profile.defaultSpin, undefined),
    launchSpeedKmh: profile.defaultLaunchSpeedKmh, landingDepthM: profile.defaultLandingDepthM,
    opponentPosition: overhead ? OVERHEAD_PRACTICE_OPPONENT : profile.opponentPosition,
    camera: overhead ? QUICK_PRACTICE_VIEWS.overhead : category === 'Serve & Volley' ? QUICK_PRACTICE_VIEWS.volley : DEFAULT_PREFERENCES.camera,
  });
}
