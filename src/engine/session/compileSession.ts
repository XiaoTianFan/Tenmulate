import type { DrillDefinitionV1, ShotDefinitionV1 } from '../../content/types';
import { SHOT_BY_ID } from '../../content/bundled';
import type { SurfaceId } from '../../domain/court';
import type { OpponentHand } from '../../content/types';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { resolveTrajectory, type SpinKind } from '../trajectory/physics';
import { createSeededRandom } from '../random/seeded';

export type SessionSettings = Readonly<{
  repetitions: number;
  interval: number;
  variationPercent: number;
  paceKmh: number;
  surface: SurfaceId;
  seed: string;
  spin: 'preset' | SpinKind;
  opponentHand: OpponentHand;
  workBlockSize: number;
  restSeconds: number;
}>;

export type CompiledRepetition = Readonly<{
  index: number;
  shot: ShotDefinitionV1;
  trajectory: ResolvedTrajectory;
  startTime: number;
}>;

export type CompiledSession = Readonly<{
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
  const repetitions: CompiledRepetition[] = [];
  const restPeriods: { afterIndex: number; startTime: number; endTime: number }[] = [];
  const workBlockSize = Math.max(1, Math.floor(settings.workBlockSize));
  const restSeconds = Math.max(0, settings.restSeconds);
  const sourceEvents = drill.events?.length
    ? drill.events
    : drill.shotIds.map((shotId, index) => ({ id: `${drill.id}-${index}`, shotId }));

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
    const shot: ShotDefinitionV1 = {
      ...sourceShot,
      target: {
        x: (sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.x : sourceShot.target.x) + xJitter,
        z: (sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.z : sourceShot.target.z) + zJitter,
      },
      paceKmh: Math.max(25, (sourceEvent && 'paceKmh' in sourceEvent && sourceEvent.paceKmh ? sourceEvent.paceKmh : settings.paceKmh + (sourceShot.paceKmh - 78) * 0.35) + paceJitter),
      surface: settings.surface,
      spin: eventSpin && eventSpin !== 'preset' ? eventSpin : settings.spin === 'preset' ? sourceShot.spin : settings.spin,
      opponentHand: settings.opponentHand,
      cameraMotion: sourceEvent && 'cameraMotion' in sourceEvent && sourceEvent.cameraMotion !== undefined ? sourceEvent.cameraMotion ?? undefined : sourceShot.cameraMotion,
      cue: sourceEvent && 'cue' in sourceEvent && sourceEvent.cue ? sourceEvent.cue : sourceShot.cue,
    };
    repetitions.push({
      index,
      shot,
      trajectory: resolveTrajectory(shot),
      startTime: 3 + index * settings.interval + Math.floor(index / workBlockSize) * restSeconds,
    });
  }

  for (let afterIndex = workBlockSize - 1; afterIndex < settings.repetitions - 1; afterIndex += workBlockSize) {
    const startTime = repetitions[afterIndex]!.startTime + settings.interval;
    restPeriods.push({ afterIndex, startTime, endTime: startTime + restSeconds });
  }

  return {
    drill,
    settings,
    repetitions,
    restPeriods,
    duration: (repetitions.at(-1)?.startTime ?? 3) + settings.interval,
  };
};
