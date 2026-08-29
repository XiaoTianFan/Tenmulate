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
  duration: number;
}>;

export const compileSession = (
  drill: DrillDefinitionV1,
  settings: SessionSettings,
): CompiledSession => {
  const random = createSeededRandom(settings.seed);
  const repetitions: CompiledRepetition[] = [];

  for (let index = 0; index < settings.repetitions; index += 1) {
    const shotId = drill.shotIds[index % drill.shotIds.length];
    const sourceShot = shotId ? SHOT_BY_ID.get(shotId) : undefined;
    if (!sourceShot) throw new Error(`Unknown bundled shot: ${shotId ?? '(missing)'}`);
    const variation = settings.variationPercent / 100;
    const xJitter = (random() * 2 - 1) * 0.55 * variation;
    const zJitter = (random() * 2 - 1) * 1.1 * variation;
    const paceJitter = (random() * 2 - 1) * settings.paceKmh * 0.12 * variation;
    const shot: ShotDefinitionV1 = {
      ...sourceShot,
      target: { x: sourceShot.target.x + xJitter, z: sourceShot.target.z + zJitter },
      paceKmh: Math.max(25, settings.paceKmh + (sourceShot.paceKmh - 78) * 0.35 + paceJitter),
      surface: settings.surface,
      spin: settings.spin === 'preset' ? sourceShot.spin : settings.spin,
      opponentHand: settings.opponentHand,
    };
    repetitions.push({
      index,
      shot,
      trajectory: resolveTrajectory(shot),
      startTime: 3 + index * settings.interval,
    });
  }

  return {
    drill,
    settings,
    repetitions,
    duration: 3 + settings.repetitions * settings.interval,
  };
};
