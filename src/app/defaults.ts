import type { DrillDefinitionV1 } from '../content/types';
import { DEFAULT_ENVIRONMENT } from '../domain/environment';
import { compileSession } from '../engine/session/compileSession';
import type { SessionLaunch } from './types';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';

export const DEFAULT_CAMERA = Object.freeze({
  eyeHeight: 1.7,
  behindBaseline: 1.5,
  lateral: 0,
  yaw: 0,
  pitch: -1.7,
  fov: 70,
});

export const createDefaultLaunch = (drill: DrillDefinitionV1, rhythmPercent = drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)): SessionLaunch => ({
  session: compileSession(drill, {
    repetitions: drill.defaultRepetitions,
    rhythmPercent, mode: 'drill', camera: DEFAULT_CAMERA,
    variationPercent: 0,
    timingVariationPercent: 0,
    launchSpeedKmh: 78,
    surface: 'hard',
    seed: '18427',
    spin: 'preset',
    spinRateRpm: undefined,
    opponentHand: 'right',
    workBlockSize: Math.min(4, drill.events?.length ?? drill.defaultRepetitions),
    restSeconds: 20,
    serveRhythm: 'preset',
  }),
  trajectoryEnabled: false,
  camera: DEFAULT_CAMERA,
  environment: DEFAULT_ENVIRONMENT,
  surface: 'hard',
  quality: 'auto',
});
