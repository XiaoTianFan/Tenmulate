import { planRecovery } from './opponentMovement';
import type { DrillDefinitionV1, DrillEventV1, ShotDefinitionV1 } from '../../content/types';
import { SHOT_BY_ID } from '../../content/bundled';
import type { SurfaceId } from '../../domain/court';
import type { OpponentHand, ServeRhythm } from '../../content/types';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { aimDirectionToCourtPoint, defaultSpinRateRpm, resolveTrajectory, type SpinKind } from '../trajectory/physics';
import { normalizeLandingZone, resolveLandingZone, sampleLandingZone, sampleParameter, type LandingZoneSize } from '../trajectory/landingZone';
import { createSeededRandom } from '../random/seeded';
import { minimumMotionGap, motionEvent, motionClip, rotateMotionPoint, strokeForShot, withPreparedApproach } from './opponentTimeline';
import type { MotionRepetition } from './opponentTimeline';
import { motionRateForRhythm, normalizeRhythm, normalizeShotInterval, rhythmFromLegacyInterval } from './rhythm';
import { assessReachability, cameraPlayerPosition, type Reachability } from './playerCoverage';
import type { CameraConfiguration } from '../rendering/TennisScene';
import { cameraTravelSeconds, DEFAULT_DRILL_CAMERA, interpolateCamera, type CameraTimeline, type CameraTransition } from './cameraTimeline';
import { DEFAULT_RETURN_ZONE } from './returnZone';
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
  camera?: Partial<CameraConfiguration>;
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
  camera: CameraConfiguration;
  intervalSeconds: number;
  returnServePlacement?: ReturnServePlacement;
  reachability: Reachability;
  rallyReturn?: RallyReturn;
  returnStatus: 'quick-practice' | 'end' | 'rest' | 'new-serve' | 'unreachable' | 'infeasible' | 'linked';
}>;

export type CompiledSession = Readonly<{
  previewLoop?: true;
  solverVersion: 'ball-v6-spin-target';
  plannerVersion: 'gameplay-rhythm-v5';
  contentVersion: '2026.09.08';
  drill: DrillDefinitionV1;
  settings: SessionSettings;
  repetitions: readonly CompiledRepetition[];
  restPeriods: readonly Readonly<{ afterIndex: number; startTime: number; endTime: number }>[];
  duration: number;
  motionTimingAdjusted: boolean;
  rhythmPercent: number;
  mode: 'quick-practice' | 'drill';
  cameraTimeline: CameraTimeline;
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
  const sourceEvents: readonly DrillEventV1[] = drill.events?.length
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
  const baseCamera = { ...DEFAULT_DRILL_CAMERA, ...settings.camera };
  let authoredCamera = baseCamera;
  const cameraScale = Math.max(0, Math.min(1, settings.cameraMotionScale ?? 1));
  const returnZone = mode === 'drill' ? drill.returnZone ?? DEFAULT_RETURN_ZONE : undefined;
  const cameraTransitions: CameraTransition[] = [];
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
        : sourceEvent?.stroke ?? sourceShot.stroke,
      target,
      depth: settings.practiceShotType === 'serve'
        ? 'Service box'
        : practiceProfile
          ? Math.abs(target.z) >= 8.5 ? 'Deep' : Math.abs(target.z) >= 4.5 ? 'Mid' : 'Short'
          : sourceShot.depth,
      paceKmh: launchSpeedKmh,
      surface: settings.surface,
      spin: selectedSpin,
      opponentHand: sourceEvent?.opponentHand ?? settings.opponentHand,
      label: sourceEvent?.label ?? sourceShot.label,
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
      : sourceEvent?.spinRateRpm ?? settings.spinRateRpm ?? defaultSpinRateRpm({ spin: selectedSpin, family });
    const spinRange = settings.practiceShotType ? spinRateProfileForPracticeShot(settings.practiceShotType, selectedSpin) : null;
    const spinRateRpm = sampleParameter(nominalSpin, variation, spinRange?.minRpm ?? 0, spinRange?.maxRpm ?? 6000, spinRandom);
    const trajectory = resolveTrajectory({
      ...shot, landingZone, launchSpeedKmh, trajectoryMode: sourceEvent?.trajectoryMode ?? settings.trajectoryMode ?? 'natural',
      spinRateRpm,
      minimumNetClearanceM: shot.netClearanceM, shotType: settings.practiceShotType,
      aimDirectionDeg: returnServePlacement ? undefined : aimDirectionToCourtPoint(source,target),
      windVelocity: settings.windVelocity, bounceFactor: sourceEvent?.bounceFactor ?? settings.bounceFactor,
    });
    // Legacy destination views remain usable, but an unscripted shot holds the
    // preceding view instead of resetting to the session launch camera.
    authoredCamera = sourceEvent?.camera ?? (shot.cameraMotion ? { ...authoredCamera, ...shot.cameraMotion.to } : authoredCamera);
    const camera = interpolateCamera(baseCamera, authoredCamera, cameraScale);
    repetitions.push({
      index,
      shot,
      trajectory,
      startTime,
      camera,
      intervalSeconds: normalizeShotInterval(sourceEvent?.intervalSeconds ?? interval),
      returnServePlacement,
      motionRate: sourceEvent?.rhythmPercent === undefined ? motionRate : motionRateForRhythm(sourceEvent.rhythmPercent),
      movementRate: sourceEvent?.movementPercent === undefined ? movementRate : normalizeRhythm(sourceEvent.movementPercent) / 100,
      recoveryPolicy: mode === 'quick-practice' ? 'home' : 'auto',
      home: mode === 'quick-practice' ? { x: quickOrigin.x, y: 0, z: quickOrigin.z } : undefined,
      reachability: assessReachability(trajectory, { ...cameraPlayerPosition(camera), yaw: camera.yaw }, returnZone),
      returnStatus: mode === 'quick-practice' ? 'quick-practice' : 'end',
    });
  }

  let motionTimingAdjusted = false;
  // The initial home approach also has to finish before preparation starts.
  const first = repetitions[0] ? withPreparedApproach(null, repetitions[0]) : undefined;
  if (first?.home) {
    const event = motionEvent(first);
    const initial = { ...event, root: first.home, yaw: Math.PI, end: 0, recoveryPolicy: 'direct' as const };
    repetitions[0] = { ...first, startTime: Math.max(3, planRecovery(initial,event).requiredDuration + event.contactTime-event.start) };
  }
  for (let index = 1; index < repetitions.length; index += 1) {
    const previous = repetitions[index - 1]!;
    const rest = index % workBlockSize === 0 && restSeconds > 0;
    const schedulingPrevious = rest && mode === 'drill' ? { ...previous, recoveryPolicy: 'recover' as const } : previous;
    const variation = 1 + (timingRandom()*2-1)*Math.min(.5,Math.max(0,settings.timingVariationPercent/100));
    const requestedGap = previous.intervalSeconds*variation;
    // Entry selection must see the requested contact clock. The draft's common
    // initial time would incorrectly force a direct route for later repetitions.
    const next = withPreparedApproach(schedulingPrevious, { ...repetitions[index]!, startTime: previous.startTime+requestedGap });
    const proposed = next;
    const required = minimumMotionGap(schedulingPrevious, proposed);
    const cameraTravel = mode === 'drill' ? cameraTravelSeconds(previous.camera, next.camera, next.movementRate) : 0;
    const lead = motionEvent(next).contactTime - motionEvent(next).start;
    const release = previous.reachability.contact?.time ?? previous.trajectory.samples.at(-1)!.time;
    let gap = Math.max(requestedGap, required, cameraTravel > 0 ? release + cameraTravel + lead : 0);
    if (mode === 'drill' && !rest && next.shot.family !== 'serve' && previous.reachability.reachable) {
      const rally = planRallyReturn(previous.trajectory,next.shot,{...cameraPlayerPosition(previous.camera),yaw:previous.camera.yaw},gap,gap,returnZone,
        cameraTravel > 0 ? gap-cameraTravel-lead : Infinity);
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
    if (cameraTravel > 0) {
      const departure = previous.startTime + (repetitions[index-1]!.rallyReturn?.contactTime ?? release);
      cameraTransitions.push({ start: departure, end: departure+cameraTravel, from: previous.camera, to: next.camera });
    }
    if(Math.abs(gap-requestedGap)>.001)motionTimingAdjusted=true;
  }
  const last = repetitions.at(-1);
  const duration = last ? Math.max(planRecovery(motionEvent(last)).end + .15,
    last.startTime + (last.trajectory.samples.at(-1)?.time ?? 0)) : startTime;

  return {
    solverVersion: 'ball-v6-spin-target',
    plannerVersion: 'gameplay-rhythm-v5',
    contentVersion: '2026.09.08',
    drill,
    settings: { ...settings, rhythmPercent, shotIntervalSeconds: interval, movementPercent:movementRate*100, mode },
    repetitions,
    restPeriods,
    duration,
    motionTimingAdjusted, rhythmPercent, mode,
    cameraTimeline: { initial: repetitions[0]?.camera ?? baseCamera, transitions: cameraTransitions },
  };
};
