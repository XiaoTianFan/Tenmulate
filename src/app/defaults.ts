import type { DrillDefinition } from '../content/types';
import { DEFAULT_ENVIRONMENT } from '../domain/environment';
import { compileSession, type SessionSettings } from '../engine/session/compileSession';
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

export const defaultDrillSettings = (drill: DrillDefinition, rhythmPercent = drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval), interval = drill.defaultInterval, movementPercent = drill.defaultMovementPercent ?? 100): SessionSettings => ({
    repetitions: drill.defaultRepetitions,
    rhythmPercent, shotIntervalSeconds: interval, movementPercent, trajectoryMode: 'natural', mode: 'drill', camera: DEFAULT_CAMERA,
    variationPercent: 8,
    timingVariationPercent: 0,
    launchSpeedKmh: 78,
    surface: 'hard',
    seed: '18427',
    spin: 'preset',
    spinRateRpm: undefined,
    opponentHand: 'right',
    workBlockSize: drill.schemaVersion === 2 ? drill.events.length : Math.min(4, drill.events?.length ?? drill.defaultRepetitions),
    restSeconds: 20,
    serveRhythm: 'preset',
});

export const createDefaultLaunch = (drill: DrillDefinition, rhythmPercent?: number, interval?: number, movementPercent?: number): SessionLaunch => ({
  session: compileSession(drill, defaultDrillSettings(drill, rhythmPercent, interval, movementPercent)),
  trajectoryEnabled: false,
  camera: DEFAULT_CAMERA,
  environment: DEFAULT_ENVIRONMENT,
  surface: 'hard',
  quality: 'auto',
});
