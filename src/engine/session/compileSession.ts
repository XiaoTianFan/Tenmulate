import { planRecovery } from './opponentMovement';
import type { DrillDefinitionV1, ShotDefinitionV1 } from '../../content/types';
import { SHOT_BY_ID } from '../../content/bundled';
import type { SurfaceId } from '../../domain/court';
import type { OpponentHand, ServeRhythm } from '../../content/types';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { resolveTrajectory, type SpinKind } from '../trajectory/physics';
import { createSeededRandom } from '../random/seeded';
import { minimumMotionGap, motionEvent } from './opponentTimeline';
import type { MotionRepetition } from './opponentTimeline';
import { motionRateForRhythm, normalizeRhythm, rhythmFromLegacyInterval } from './rhythm';
import { assessReachability, cameraPlayerPosition, type Reachability } from './playerCoverage';
import { planRallyReturn, type RallyReturn } from './rally';
import type { Vec3 } from '../../domain/vector';
import {
  RETURN_SERVE_PATTERN,
  returnServeTarget,
  type ReturnReceiverSide,
  type ReturnServePlacement,
} from '../../domain/returnPractice';
import {
  PRACTICE_SHOT_PROFILES,
  legalServeTarget,
  practiceLandingTarget,
  spinForPracticeShot,
  spinRateForPracticeShot,
  type PracticeShotType,
} from '../trajectory/practiceProfiles';

export type SessionSettings = Readonly<{
  repetitions: number;
  /** Legacy import input only. New controls use rhythmPercent. */
  interval?: number;
  rhythmPercent?: number;
  mode?: 'quick-practice' | 'drill';
  camera?: Readonly<{ lateral: number; behindBaseline: number }>;
  variationPercent: number;
  timingVariationPercent: number;
  launchSpeedKmh: number;
  surface: SurfaceId;
  seed: string;
  spin: 'preset' | SpinKind;
  spinRateRpm?: number;
  practiceShotType?: PracticeShotType;
  bounceFactor?: number;
  opponentHand: OpponentHand;
  workBlockSize: number;
  restSeconds: number;
  serveRhythm: 'preset' | ServeRhythm;
  landingDepthM?: number;
  aimDirectionDeg?: number;
  opponentPosition?: Readonly<{ x: number; z: number }>;
  returnReceiverSide?: ReturnReceiverSide;
  windVelocity?: Vec3;
}>;

export type CompiledRepetition = MotionRepetition & Readonly<{
  index: number;
  shot: ShotDefinitionV1;
  trajectory: ResolvedTrajectory;
  startTime: number;
  returnServePlacement?: ReturnServePlacement;
  reachability: Reachability;
  rallyReturn?: RallyReturn;
  returnStatus: 'quick-practice' | 'end' | 'rest' | 'new-serve' | 'unreachable' | 'infeasible' | 'linked';
}>;

export type CompiledSession = Readonly<{
  solverVersion: 'ball-v6-spin-target';
  contentVersion: '2026.08.29';
  drill: DrillDefinitionV1;
  settings: SessionSettings;
  repetitions: readonly CompiledRepetition[];
  restPeriods: readonly Readonly<{ afterIndex: number; startTime: number; endTime: number }>[];
  duration: number;
  motionTimingAdjusted: boolean;
  rhythmPercent: number;
  mode: 'quick-practice' | 'drill';
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
  const startTime = 3;
  const mode = settings.mode ?? (settings.practiceShotType ? 'quick-practice' : 'drill');
  const rhythmPercent = normalizeRhythm(settings.rhythmPercent ?? drill.defaultRhythmPercent
    ?? rhythmFromLegacyInterval(settings.interval ?? drill.defaultInterval));
  const motionRate = motionRateForRhythm(rhythmPercent);
  const playerPosition = cameraPlayerPosition(settings.camera);
  const quickOrigin = settings.opponentPosition ?? (settings.practiceShotType
    ? PRACTICE_SHOT_PROFILES[settings.practiceShotType].opponentPosition
    : SHOT_BY_ID.get(sourceEvents[0]!.shotId)!.source);

  for (let index = 0; index < settings.repetitions; index += 1) {
    const sourceEvent = sourceEvents[index % sourceEvents.length];
    const shotId = sourceEvent?.shotId;
    const sourceShot = shotId ? SHOT_BY_ID.get(shotId) : undefined;
    if (!sourceShot) throw new Error(`Unknown bundled shot: ${shotId ?? '(missing)'}`);
    const variation = settings.variationPercent / 100;
    const xJitter = (random() * 2 - 1) * 0.55 * variation;
    const zJitter = (random() * 2 - 1) * 1.1 * variation;
    const speedJitter = (random() * 2 - 1) * settings.launchSpeedKmh * 0.12 * variation;
    const eventSpin = sourceEvent && 'spin' in sourceEvent ? sourceEvent.spin : undefined;
    const practiceProfile = settings.practiceShotType ? PRACTICE_SHOT_PROFILES[settings.practiceShotType] : null;
    const selectedSpin = settings.practiceShotType
      ? spinForPracticeShot(settings.practiceShotType, settings.spin)
      : eventSpin && eventSpin !== 'preset'
        ? eventSpin
        : settings.spin === 'preset' ? sourceShot.spin : settings.spin;
    const launchSpeedKmh = Math.max(25, (
      sourceEvent && 'paceKmh' in sourceEvent && sourceEvent.paceKmh
        ? sourceEvent.paceKmh
        : practiceProfile
          ? settings.launchSpeedKmh
          : settings.launchSpeedKmh + (sourceShot.paceKmh - 78) * 0.35
    ) + speedJitter);
    const source = {
      ...sourceShot.source,
      x: mode === 'quick-practice' ? quickOrigin.x : sourceEvent && 'opponentPosition' in sourceEvent && sourceEvent.opponentPosition
        ? sourceEvent.opponentPosition.x
        : settings.opponentPosition?.x ?? sourceShot.source.x,
      y: practiceProfile?.contactHeight ?? sourceShot.source.y,
      z: mode === 'quick-practice' ? quickOrigin.z : sourceEvent && 'opponentPosition' in sourceEvent && sourceEvent.opponentPosition
        ? sourceEvent.opponentPosition.z
        : settings.opponentPosition?.z ?? sourceShot.source.z,
    };
    const authoredTarget = {
      x: (sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.x : sourceShot.target.x) + xJitter,
      z: (sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.z : sourceShot.target.z) + zJitter,
    };
    const returnServePlacement = settings.practiceShotType === 'serve' && settings.returnReceiverSide
      ? RETURN_SERVE_PATTERN[index % RETURN_SERVE_PATTERN.length]
      : undefined;
    const target = returnServePlacement && settings.returnReceiverSide
      ? returnServeTarget(settings.returnReceiverSide, returnServePlacement, settings.landingDepthM ?? PRACTICE_SHOT_PROFILES.serve.defaultLandingDepthM)
      : settings.practiceShotType === 'serve'
        ? legalServeTarget(source, settings.aimDirectionDeg ?? 0, settings.landingDepthM ?? PRACTICE_SHOT_PROFILES.serve.defaultLandingDepthM)
      : practiceProfile
        ? practiceLandingTarget(source, settings.aimDirectionDeg ?? 0, settings.landingDepthM ?? practiceProfile.defaultLandingDepthM)
        : authoredTarget;
    const shot: ShotDefinitionV1 = {
      ...sourceShot,
      family: settings.practiceShotType ?? sourceShot.family,
      source,
      target,
      depth: settings.practiceShotType === 'serve'
        ? 'Service box'
        : practiceProfile
          ? Math.abs(target.z) >= 8.5 ? 'Deep' : Math.abs(target.z) >= 4.5 ? 'Mid' : 'Short'
          : sourceShot.depth,
      paceKmh: launchSpeedKmh,
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
        : practiceProfile?.minimumNetClearanceM ?? sourceShot.netClearanceM,
    };
    const trajectory = resolveTrajectory({
      ...shot, launchSpeedKmh,
      spinRateRpm: settings.practiceShotType ? spinRateForPracticeShot(settings.practiceShotType, selectedSpin, settings.spinRateRpm) : undefined,
      minimumNetClearanceM: shot.netClearanceM, shotType: settings.practiceShotType,
      aimDirectionDeg: returnServePlacement ? undefined : settings.aimDirectionDeg,
      windVelocity: settings.windVelocity, bounceFactor: settings.bounceFactor,
    });
    repetitions.push({
      index,
      shot,
      trajectory,
      startTime,
      returnServePlacement,
      motionRate, recoveryPolicy: mode === 'quick-practice' ? 'home' : 'auto',
      home: mode === 'quick-practice' ? { x: quickOrigin.x, y: 0, z: quickOrigin.z + .45 } : undefined,
      reachability: assessReachability(trajectory, playerPosition),
      returnStatus: mode === 'quick-practice' ? 'quick-practice' : 'end',
    });
  }

  let motionTimingAdjusted = false;
  // The initial home approach also has to finish before preparation starts.
  const first = repetitions[0];
  if (first?.home) {
    const event = motionEvent(first);
    const initial = { ...event, root: first.home, yaw: Math.PI, end: 0, recoveryPolicy: 'direct' as const };
    repetitions[0] = { ...first, startTime: Math.max(3, planRecovery(initial,event).requiredDuration + event.contactTime-event.start) };
  }
  for (let index = 1; index < repetitions.length; index += 1) {
    const previous = repetitions[index - 1]!, next = repetitions[index]!;
    const full = minimumMotionGap({ ...previous, motionRate: 1, recoveryPolicy: 'recover' }, { ...next, motionRate: 1 });
    const receiverTime = previous.reachability.contact?.time ?? previous.trajectory.events.find(e=>e.type==='receiver-plane')?.time ?? 2;
    const flightBaseline = mode === 'drill' ? receiverTime + Math.hypot(next.shot.source.x-playerPosition.x,next.shot.source.z-playerPosition.z)/(previous.trajectory.resolved.launchSpeedKmh/3.6)*1.5 : receiverTime+.35;
    const baseline = Math.max(full, flightBaseline);
    const variation = 1 + (timingRandom()*2-1)*Math.min(.5,Math.max(0,settings.timingVariationPercent/100));
    const requestedGap = baseline/(rhythmPercent/100)*variation;
    const proposed = { ...next, startTime: previous.startTime+requestedGap };
    const required = minimumMotionGap(previous, proposed);
    let gap = Math.max(requestedGap, required);
    const rest = index % workBlockSize === 0 && restSeconds > 0;
    if (mode === 'drill' && !rest && next.shot.family !== 'serve' && previous.reachability.reachable) {
      const rally = planRallyReturn(previous.trajectory,next.shot,playerPosition,required,gap);
      repetitions[index-1] = { ...previous, rallyReturn: rally ?? undefined, returnStatus: rally ? 'linked' : 'infeasible' };
      if(rally)gap=rally.contactTime+rally.duration;
    } else if (mode === 'drill') {
      repetitions[index-1] = { ...previous, returnStatus: rest ? 'rest' : next.shot.family==='serve' ? 'new-serve' : 'unreachable' };
    }
    if (rest) {
      const restStart=previous.startTime+Math.max(previous.trajectory.samples.at(-1)!.time,motionEvent(previous).end-previous.startTime);
      const restEnd=restStart+restSeconds;
      restPeriods.push({afterIndex:index-1,startTime:restStart,endTime:restEnd});
      gap=Math.max(gap,restEnd-previous.startTime+motionEvent(next).contactTime-motionEvent(next).start);
    }
    // Lock the chosen route before playback; a longer solved return must not
    // silently switch direct travel back to a full recovery detour.
    const route=planRecovery(motionEvent(previous),motionEvent(proposed));
    repetitions[index-1]={...repetitions[index-1]!,recoveryPolicy:mode==='quick-practice'?'home':!rest&&route.kind==='direct'?'direct':'recover'};
    repetitions[index] = { ...next, startTime: previous.startTime+gap };
    if(Math.abs(gap-requestedGap)>.001)motionTimingAdjusted=true;
  }
  const last = repetitions.at(-1);
  const duration = last ? Math.max(planRecovery(motionEvent(last)).end + .15,
    last.startTime + (last.trajectory.samples.at(-1)?.time ?? 0)) : startTime;

  return {
    solverVersion: 'ball-v6-spin-target',
    contentVersion: '2026.08.29',
    drill,
    settings: { ...settings, rhythmPercent, mode },
    repetitions,
    restPeriods,
    duration,
    motionTimingAdjusted, rhythmPercent, mode,
  };
};
