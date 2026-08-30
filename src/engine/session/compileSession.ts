import type { DrillDefinitionV1, ShotDefinitionV1 } from '../../content/types';
import { SHOT_BY_ID } from '../../content/bundled';
import type { SurfaceId } from '../../domain/court';
import type { OpponentHand, ServeRhythm } from '../../content/types';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { resolveTrajectory, type SpinKind } from '../trajectory/physics';
import { createSeededRandom } from '../random/seeded';
import type { Vec3 } from '../../domain/vector';
import {
  PRACTICE_SHOT_PROFILES,
  legalServeTarget,
  spinForPracticeShot,
  type PracticeShotType,
} from '../trajectory/practiceProfiles';

export type SessionSettings = Readonly<{
  repetitions: number;
  interval: number;
  variationPercent: number;
  timingVariationPercent: number;
  paceKmh: number;
  surface: SurfaceId;
  seed: string;
  spin: 'preset' | SpinKind;
  practiceShotType?: PracticeShotType;
  bounceFactor?: number;
  opponentHand: OpponentHand;
  workBlockSize: number;
  restSeconds: number;
  serveRhythm: 'preset' | ServeRhythm;
  netClearanceM: number;
  aimDirectionDeg?: number;
  opponentPosition?: Readonly<{ x: number; z: number }>;
  windVelocity?: Vec3;
}>;

export type CompiledRepetition = Readonly<{
  index: number;
  shot: ShotDefinitionV1;
  trajectory: ResolvedTrajectory;
  startTime: number;
}>;

export type CompiledSession = Readonly<{
  solverVersion: 'ball-v4-shot-profiles';
  contentVersion: '2026.08.29';
  drill: DrillDefinitionV1;
  settings: SessionSettings;
  repetitions: readonly CompiledRepetition[];
  restPeriods: readonly Readonly<{ afterIndex: number; startTime: number; endTime: number }>[];
  duration: number;
}>;

export const compileSession = (
  drill: DrillDefinitionV1,
  settings: SessionSettings,
): CompiledSession => {
  const random = createSeededRandom(settings.seed);
  const timingRandom = createSeededRandom(`${settings.seed}:timing`);
  const repetitions: CompiledRepetition[] = [];
  const restPeriods: { afterIndex: number; startTime: number; endTime: number }[] = [];
  const workBlockSize = Math.max(1, Math.floor(settings.workBlockSize));
  const restSeconds = Math.max(0, settings.restSeconds);
  const sourceEvents = drill.events?.length
    ? drill.events
    : drill.shotIds.map((shotId, index) => ({ id: `${drill.id}-${index}`, shotId }));
  let startTime = 3;

  for (let index = 0; index < settings.repetitions; index += 1) {
    const sourceEvent = sourceEvents[index % sourceEvents.length];
    const shotId = sourceEvent?.shotId;
    const sourceShot = shotId ? SHOT_BY_ID.get(shotId) : undefined;
    if (!sourceShot) throw new Error(`Unknown bundled shot: ${shotId ?? '(missing)'}`);
    const variation = settings.variationPercent / 100;
    const xJitter = (random() * 2 - 1) * 0.55 * variation;
    const zJitter = (random() * 2 - 1) * 1.1 * variation;
    const paceJitter = (random() * 2 - 1) * settings.paceKmh * 0.12 * variation;
    const eventSpin = sourceEvent && 'spin' in sourceEvent ? sourceEvent.spin : undefined;
    const practiceProfile = settings.practiceShotType ? PRACTICE_SHOT_PROFILES[settings.practiceShotType] : null;
    const selectedSpin = settings.practiceShotType
      ? spinForPracticeShot(settings.practiceShotType, settings.spin)
      : eventSpin && eventSpin !== 'preset'
        ? eventSpin
        : settings.spin === 'preset' ? sourceShot.spin : settings.spin;
    const paceKmh = Math.max(25, (
      sourceEvent && 'paceKmh' in sourceEvent && sourceEvent.paceKmh
        ? sourceEvent.paceKmh
        : practiceProfile
          ? settings.paceKmh
          : settings.paceKmh + (sourceShot.paceKmh - 78) * 0.35
    ) + paceJitter);
    const source = {
      ...sourceShot.source,
      x: sourceEvent && 'opponentPosition' in sourceEvent && sourceEvent.opponentPosition
        ? sourceEvent.opponentPosition.x
        : settings.opponentPosition?.x ?? sourceShot.source.x,
      y: practiceProfile?.contactHeight ?? sourceShot.source.y,
      z: sourceEvent && 'opponentPosition' in sourceEvent && sourceEvent.opponentPosition
        ? sourceEvent.opponentPosition.z
        : settings.opponentPosition?.z ?? sourceShot.source.z,
    };
    const authoredTarget = {
      x: (sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.x : sourceShot.target.x) + xJitter,
      z: (sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.z : sourceShot.target.z) + zJitter,
    };
    const target = settings.practiceShotType === 'serve'
      ? legalServeTarget(source, settings.aimDirectionDeg ?? 0, paceKmh, settings.netClearanceM, selectedSpin)
      : authoredTarget;
    const shot: ShotDefinitionV1 = {
      ...sourceShot,
      family: settings.practiceShotType ?? sourceShot.family,
      source,
      target,
      depth: settings.practiceShotType === 'serve' ? 'Service box' : sourceShot.depth,
      paceKmh,
      surface: settings.surface,
      spin: selectedSpin,
      opponentHand: settings.opponentHand,
      cameraMotion: sourceEvent && 'cameraMotion' in sourceEvent && sourceEvent.cameraMotion !== undefined ? sourceEvent.cameraMotion ?? undefined : sourceShot.cameraMotion,
      cue: sourceEvent && 'cue' in sourceEvent && sourceEvent.cue ? sourceEvent.cue : sourceShot.cue,
      serveRhythm: (settings.practiceShotType ?? sourceShot.family) === 'serve'
        ? sourceEvent && 'serveRhythm' in sourceEvent && sourceEvent.serveRhythm && sourceEvent.serveRhythm !== 'preset'
          ? sourceEvent.serveRhythm
          : settings.serveRhythm === 'preset' ? sourceShot.serveRhythm : settings.serveRhythm
        : undefined,
      netClearanceM: sourceEvent && 'netClearanceM' in sourceEvent && sourceEvent.netClearanceM !== undefined
        ? sourceEvent.netClearanceM
        : settings.netClearanceM,
    };
    repetitions.push({
      index,
      shot,
      trajectory: resolveTrajectory({
        ...shot,
        shotType: settings.practiceShotType,
        aimDirectionDeg: settings.aimDirectionDeg,
        windVelocity: settings.windVelocity,
        bounceFactor: settings.bounceFactor,
      }),
      startTime,
    });
    const timingVariation = Math.min(0.5, Math.max(0, settings.timingVariationPercent / 100));
    const gap = Math.max(0.5, settings.interval * (1 + (timingRandom() * 2 - 1) * timingVariation));
    startTime += gap;
    const blockEnds = (index + 1) % workBlockSize === 0 && index < settings.repetitions - 1;
    if (blockEnds) {
      restPeriods.push({ afterIndex: index, startTime, endTime: startTime + restSeconds });
      startTime += restSeconds;
    }
  }

  return {
    solverVersion: 'ball-v4-shot-profiles',
    contentVersion: '2026.08.29',
    drill,
    settings,
    repetitions,
    restPeriods,
    duration: startTime,
  };
};
