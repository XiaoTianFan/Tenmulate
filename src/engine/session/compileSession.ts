import { planRecovery } from './opponentMovement';
import type { DrillDefinitionV1, ShotDefinitionV1 } from '../../content/types';
import { SHOT_BY_ID } from '../../content/bundled';
import type { SurfaceId } from '../../domain/court';
import type { OpponentHand, ServeRhythm } from '../../content/types';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { aimDirectionToCourtPoint, defaultSpinRateRpm, resolveTrajectory, type SpinKind } from '../trajectory/physics';
import { normalizeLandingZone, resolveLandingZone, sampleLandingZone, sampleParameter, type LandingZoneSize } from '../trajectory/landingZone';
import { createSeededRandom } from '../random/seeded';
import { minimumMotionGap, motionEvent, motionClip, rotateMotionPoint, strokeForShot } from './opponentTimeline';
import type { MotionRepetition } from './opponentTimeline';
import { motionRateForRhythm, normalizeRhythm, normalizeShotInterval, rhythmFromLegacyInterval } from './rhythm';
import { assessReachability, cameraCoveragePath, type Reachability } from './playerCoverage';
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
  spinRateProfileForPracticeShot,
  type PracticeShotType,
} from '../trajectory/practiceProfiles';

export type SessionSettings = Readonly<{
  repetitions: number;
  /** Contact-to-contact interval, independent of the stroke source clock. */
  interval?: number;
  rhythmPercent?: number;
  shotIntervalSeconds?: number;
  movementPercent?: number;
  practiceStroke?: 'forehand' | 'backhand' | 'alternate';
  trajectoryMode?: 'natural' | 'exact';
  landingZone?: LandingZoneSize;
  mode?: 'quick-practice' | 'drill';
  camera?: Readonly<{ lateral: number; behindBaseline: number }>;
  cameraMotionScale?: number;
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
  previewLoop?: true;
  solverVersion: 'ball-v6-spin-target';
  plannerVersion: 'gameplay-rhythm-v3';
  contentVersion: '2026.09.08';
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
  const landingRandom = createSeededRandom(`${settings.seed}:landing`);
  const speedRandom = createSeededRandom(`${settings.seed}:speed`);
  const spinRandom = createSeededRandom(`${settings.seed}:spin`);
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
  const rhythmPercent = normalizeRhythm(settings.rhythmPercent ?? (settings.interval !== undefined
    ? rhythmFromLegacyInterval(settings.interval)
    : drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)));
  const motionRate = motionRateForRhythm(rhythmPercent);
  const movementRate = normalizeRhythm(settings.movementPercent ?? drill.defaultMovementPercent) / 100;
  const interval = normalizeShotInterval(settings.shotIntervalSeconds ?? settings.interval ?? drill.defaultInterval);
  const quickOrigin = settings.opponentPosition ?? (settings.practiceShotType
    ? PRACTICE_SHOT_PROFILES[settings.practiceShotType].opponentPosition
    : SHOT_BY_ID.get(sourceEvents[0]!.shotId)!.source);

  for (let index = 0; index < settings.repetitions; index += 1) {
    const sourceEvent = sourceEvents[index % sourceEvents.length];
    const shotId = sourceEvent?.shotId;
    const sourceShot = shotId ? SHOT_BY_ID.get(shotId) : undefined;
    if (!sourceShot) throw new Error(`Unknown bundled shot: ${shotId ?? '(missing)'}`);
    const eventVariation = sourceEvent && 'variationPercent' in sourceEvent ? sourceEvent.variationPercent : undefined;
    const variation = Math.min(.25, Math.max(0, (eventVariation ?? settings.variationPercent) / 100));
    const eventSpin = sourceEvent && 'spin' in sourceEvent ? sourceEvent.spin : undefined;
    const practiceProfile = settings.practiceShotType ? PRACTICE_SHOT_PROFILES[settings.practiceShotType] : null;
    const selectedSpin = settings.practiceShotType
      ? spinForPracticeShot(settings.practiceShotType, settings.spin)
      : eventSpin && eventSpin !== 'preset'
        ? eventSpin
        : settings.spin === 'preset' ? sourceShot.spin : settings.spin;
    const launchSpeedKmh = sampleParameter((
      sourceEvent && 'paceKmh' in sourceEvent && sourceEvent.paceKmh
        ? sourceEvent.paceKmh
        : practiceProfile
          ? settings.launchSpeedKmh
          : settings.launchSpeedKmh + (sourceShot.paceKmh - 78) * 0.35
    ), variation, practiceProfile?.launchSpeedRangeKmh.min ?? 25, practiceProfile?.launchSpeedRangeKmh.max ?? 260, speedRandom);
    let source = {
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
      x: sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.x : sourceShot.target.x,
      z: sourceEvent && 'target' in sourceEvent && sourceEvent.target ? sourceEvent.target.z : sourceShot.target.z,
    };
    const returnServePlacement = settings.practiceShotType === 'serve' && settings.returnReceiverSide
      ? RETURN_SERVE_PATTERN[index % RETURN_SERVE_PATTERN.length]
      : undefined;
    const center = returnServePlacement && settings.returnReceiverSide
      ? returnServeTarget(settings.returnReceiverSide, returnServePlacement, settings.landingDepthM ?? PRACTICE_SHOT_PROFILES.serve.defaultLandingDepthM)
      : settings.practiceShotType === 'serve'
        ? legalServeTarget(quickOrigin, settings.aimDirectionDeg ?? 0, settings.landingDepthM ?? PRACTICE_SHOT_PROFILES.serve.defaultLandingDepthM)
      : practiceProfile
        ? practiceLandingTarget(quickOrigin, settings.aimDirectionDeg ?? 0, settings.landingDepthM ?? practiceProfile.defaultLandingDepthM)
        : authoredTarget;
    const family = settings.practiceShotType ?? sourceShot.family;
    const eventZone = sourceEvent && 'landingZone' in sourceEvent ? sourceEvent.landingZone : undefined;
    const zoneSize = normalizeLandingZone(eventZone ?? settings.landingZone, family);
    const landingZone = resolveLandingZone(center, zoneSize, family, source);
    const target = sampleLandingZone(landingZone, landingRandom);
    let shot: ShotDefinitionV1 = {
      ...sourceShot,
      family,
      source,
      stroke: mode === 'quick-practice' && settings.practiceShotType && settings.practiceShotType !== 'serve'
        ? settings.practiceStroke === 'alternate' || !settings.practiceStroke ? index % 2 ? 'backhand' : 'forehand' : settings.practiceStroke
        : sourceShot.stroke,
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
      cameraMotion: mode === 'quick-practice' ? undefined : sourceEvent && 'cameraMotion' in sourceEvent && sourceEvent.cameraMotion !== undefined ? sourceEvent.cameraMotion ?? undefined : sourceShot.cameraMotion,
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
    if (mode === 'quick-practice') {
      const clipId = strokeForShot(shot,index), clip = motionClip(clipId);
      const side = (shot.stroke === 'backhand' ? -1 : 1) * (settings.opponentHand === 'left' ? -1 : 1);
      // The selected point is the body recovery center, not the ball emitter.
      const step = shot.family === 'serve' ? 0 : .7 + (index % 3) * .1;
      const root = { x:quickOrigin.x + side*step, z:quickOrigin.z };
      let yaw = Math.atan2(target.x-root.x,target.z-root.z);
      for(let iteration=0;iteration<8;iteration++){
        const offset=rotateMotionPoint(clip.contactLocal!,yaw,settings.opponentHand);
        source={x:root.x+offset.x,y:clipId==='backhand-overhead'?offset.y:source.y,z:root.z+offset.z};
        yaw=Math.atan2(target.x-source.x,target.z-source.z);
      }
      shot={...shot,source};
    }
    const nominalSpin = settings.practiceShotType ? spinRateForPracticeShot(settings.practiceShotType, selectedSpin, settings.spinRateRpm)
      : defaultSpinRateRpm({ spin: selectedSpin, family });
    const spinRange = settings.practiceShotType ? spinRateProfileForPracticeShot(settings.practiceShotType, selectedSpin) : null;
    const spinRateRpm = sampleParameter(nominalSpin, variation, spinRange?.minRpm ?? 0, spinRange?.maxRpm ?? 6000, spinRandom);
    const trajectory = resolveTrajectory({
      ...shot, landingZone, launchSpeedKmh, trajectoryMode: settings.trajectoryMode ?? 'natural',
      spinRateRpm,
      minimumNetClearanceM: shot.netClearanceM, shotType: settings.practiceShotType,
      aimDirectionDeg: returnServePlacement ? undefined : aimDirectionToCourtPoint(source,target),
      windVelocity: settings.windVelocity, bounceFactor: settings.bounceFactor,
    });
    repetitions.push({
      index,
      shot,
      trajectory,
      startTime,
      returnServePlacement,
      motionRate, movementRate, recoveryPolicy: mode === 'quick-practice' ? 'home' : 'auto',
      home: mode === 'quick-practice' ? { x: quickOrigin.x, y: 0, z: quickOrigin.z } : undefined,
      reachability: assessReachability(trajectory, cameraCoveragePath(settings.camera,shot.cameraMotion,settings.cameraMotionScale)),
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
    const variation = 1 + (timingRandom()*2-1)*Math.min(.5,Math.max(0,settings.timingVariationPercent/100));
    const requestedGap = interval*variation;
    const proposed = { ...next, startTime: previous.startTime+requestedGap };
    const rest = index % workBlockSize === 0 && restSeconds > 0;
    const schedulingPrevious = rest && mode === 'drill' ? { ...previous, recoveryPolicy: 'recover' as const } : previous;
    const required = minimumMotionGap(schedulingPrevious, proposed);
    let gap = Math.max(requestedGap, required);
    if (mode === 'drill' && !rest && next.shot.family !== 'serve' && previous.reachability.reachable) {
      const rally = planRallyReturn(previous.trajectory,next.shot,cameraCoveragePath(settings.camera,previous.shot.cameraMotion,settings.cameraMotionScale),gap,gap);
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
    const route=planRecovery(motionEvent(schedulingPrevious),motionEvent(proposed));
    repetitions[index-1]={...repetitions[index-1]!,recoveryPolicy:mode==='quick-practice'?'home':!rest&&route.kind==='direct'?'direct':'recover'};
    repetitions[index] = { ...next, startTime: previous.startTime+gap };
    if(Math.abs(gap-requestedGap)>.001)motionTimingAdjusted=true;
  }
  const last = repetitions.at(-1);
  const duration = last ? Math.max(planRecovery(motionEvent(last)).end + .15,
    last.startTime + (last.trajectory.samples.at(-1)?.time ?? 0)) : startTime;

  return {
    solverVersion: 'ball-v6-spin-target',
    plannerVersion: 'gameplay-rhythm-v3',
    contentVersion: '2026.09.08',
    drill,
    settings: { ...settings, rhythmPercent, shotIntervalSeconds: interval, movementPercent:movementRate*100, mode },
    repetitions,
    restPeriods,
    duration,
    motionTimingAdjusted, rhythmPercent, mode,
  };
};
