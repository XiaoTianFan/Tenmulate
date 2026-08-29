import type { DrillDefinitionV1 } from '../content/types';
import { compileSession } from '../engine/session/compileSession';
import type { SessionLaunch } from './types';

export const DEFAULT_CAMERA = Object.freeze({
  eyeHeight: 1.7,
  behindBaseline: 1.5,
  lateral: 0,
  yaw: 0,
  pitch: -1.7,
  fov: 70,
});

export const createDefaultLaunch = (drill: DrillDefinitionV1): SessionLaunch => ({
  session: compileSession(drill, {
    repetitions: drill.events?.length ?? drill.defaultRepetitions,
    interval: drill.defaultInterval,
    variationPercent: 0,
    paceKmh: 78,
    surface: 'hard',
    seed: '18427',
    spin: 'preset',
    opponentHand: 'right',
  }),
  mode: 'rehearsal',
  camera: DEFAULT_CAMERA,
});
