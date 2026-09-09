import type { DrillBall, DrillDefinitionV2, OpeningFeed, PlayerShotEventV2, ShotDefinitionV1 } from '../../content/types';
import type { CompiledRepetition, CompiledSession, SessionSettings } from './compileSession';
import type { Vec3 } from '../../domain/vector';
import type { CameraConfiguration } from '../rendering/TennisScene';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';
import { sampleLandingZone, sampleParameter, type LandingZone } from '../trajectory/landingZone';
import { createSeededRandom } from '../random/seeded';
import { cameraTravelSeconds, DEFAULT_DRILL_CAMERA, interpolateCamera, type CameraTransition } from './cameraTimeline';
import { cameraPlayerPosition, type Reachability } from './playerCoverage';
import { contactDistance, contactHeight, landsInZone, opponentContacts, playerContacts, resolveCourtFlight, trimFlight } from './courtFlight';
import { minimumMotionGap, motionClip, motionEvent, rotateMotionPoint, strokeForShot, withPreparedApproach } from './opponentTimeline';
import { planRecovery } from './opponentMovement';
import { normalizeRhythm, normalizeShotInterval } from './rhythm';
import { solveShotInterval } from './shotTiming';
import { defaultReturnShot } from './returnShot';

export type ScheduledDrillFlight = Readonly<{ owner: 'player' | 'opponent'; phase: 'opening' | 'player' | 'response';
  eventIndex: number; startTime: number; endTime: number; trajectory: ResolvedTrajectory }>;
export type CompiledPlayerEvent = Readonly<{ index: number; event: PlayerShotEventV2; setIndex: number;
  startTime: number; incomingIndex: number; responseIndex?: number; trajectory: ResolvedTrajectory;
  timing?: Readonly<{ requested: number; actual: number; limited: boolean }>; }>;
export type DrillPlanningIssue = Readonly<{ index: number; phase: 'opening' | 'player' | 'response'; message: string }>;
type IncomingFit = { trajectory: ResolvedTrajectory; contact: FlightSample | null; score: number };

export function compilePlayerDrill(drill: DrillDefinitionV2, settings: SessionSettings): CompiledSession {
  if (!drill.events.length) throw new Error('A drill needs at least one player shot.');
  const count = Math.max(1, Math.min(200, Math.floor(settings.repetitions)));
  const rhythm = normalizeRhythm(settings.rhythmPercent ?? drill.defaultRhythmPercent ?? 100);
  const movement = normalizeRhythm(settings.movementPercent ?? drill.defaultMovementPercent ?? 100);
  const interval = normalizeShotInterval(settings.shotIntervalSeconds ?? settings.interval ?? drill.defaultInterval);
  const workBlock = Math.max(1, Math.min(drill.events.length, Math.floor(settings.workBlockSize)));
  const cameraScale = Math.max(0, Math.min(1, settings.cameraMotionScale ?? 1));
  const initialCamera = drill.events[0]!.camera;
  const events = Array.from({ length: count }, (_, index) => drill.events[index % drill.events.length]!);
  const repetitions: CompiledRepetition[] = [], playerEvents: CompiledPlayerEvent[] = [], flights: ScheduledDrillFlight[] = [];
  const issues: DrillPlanningIssue[] = [], restPeriods: { afterIndex: number; startTime: number; endTime: number }[] = [];
  const transitions: CameraTransition[] = [];
  let incoming: IncomingFit | null = null, incomingIndex = -1, setIndex = -1;
  let endTime = 0, lastCamera: CameraConfiguration = initialCamera, motionTimingAdjusted = false;

  const random = (role: string, index: number, parameter: string) => createSeededRandom(`${settings.seed}:player-drill:${role}:${index}:${parameter}`);
  const sampleBall = (ball: DrillBall, role: string, index: number): DrillBall => ({ ...ball,
    paceKmh: sampleParameter(ball.paceKmh, ball.variationPercent / 100, 20, 260, random(role, index, 'speed')),
    spinRateRpm: sampleParameter(ball.spinRateRpm, ball.variationPercent / 100, 0, 6000, random(role, index, 'spin')) });
  const resolve = (source: Vec3, ball: DrillBall, zone: LandingZone, target: { x: number; z: number }, pace = ball.paceKmh) =>
    resolveCourtFlight({ source, target, landingZone: zone, family: ball.family, opponentHand: ball.hand,
      launchSpeedKmh: pace, spin: ball.spin, spinRateRpm: ball.spinRateRpm, surface: settings.surface,
      minimumNetClearanceM: ball.netClearanceM, bounceFactor: ball.bounceFactor, trajectoryMode: ball.trajectoryMode, windVelocity: settings.windVelocity });
  const fitIncoming = (source: Vec3, ball: DrillBall, zone: LandingZone, target: { x: number; z: number }, receiver?: PlayerShotEventV2, desired?: number): IncomingFit => {
    let best: IncomingFit | undefined;
    for (const factor of ball.trajectoryMode === 'exact' ? [1] : [1, .85, 1.15]) {
      const trajectory = resolve(source, ball, zone, target, ball.paceKmh * factor);
      const contacts = receiver && landsInZone(trajectory) ? playerContacts(trajectory, receiver) : [];
      const scoreContact = (contact: FlightSample) => (desired === undefined ? 0 : Math.abs(contact.time - desired))
        + contactDistance(contact, receiver!) * .24 + Math.abs(contact.position.y - contactHeight(receiver!.ball.family)) * .1;
      const contact = [...contacts].sort((a, b) => scoreContact(a) - scoreContact(b))[0] ?? null;
      const score = (receiver ? contact ? scoreContact(contact) : 1000 : landsInZone(trajectory) ? 0 : 1000) + Math.abs(1 - factor) * .15;
      if (!best || score < best.score) best = { trajectory, contact, score };
      if (!receiver && score < 1) break;
    }
    return best!;
  };
  const shotDefinition = (source: Vec3, ball: DrillBall, target: { x: number; z: number }, label: string): ShotDefinitionV1 => ({
    schemaVersion: 1, id: 'resolved-opponent-contact', label, cue: label, family: ball.family, source, target,
    paceKmh: ball.paceKmh, spin: ball.spin, opponentHand: ball.hand, stroke: ball.stroke, surface: settings.surface,
    direction: Math.abs(target.x) < .5 ? 'Body' : target.x > 0 ? 'Near left' : 'Near right',
    depth: ball.family === 'serve' ? 'Service box' : Math.abs(target.z) > 8 ? 'Deep' : Math.abs(target.z) > 4.5 ? 'Mid' : 'Short',
    serveRhythm: ball.serveRhythm, netClearanceM: ball.netClearanceM });
  const repetition = (shot: ShotDefinitionV1, trajectory: ResolvedTrajectory, time: number, event: PlayerShotEventV2): CompiledRepetition => {
    const reachability: Reachability = { reachable: false, reason: 'outside-coverage', contact: null, playerPosition: cameraPlayerPosition(event.camera), marginM: 0 };
    return { index: repetitions.length, shot, trajectory, startTime: time, camera: event.camera,
      intervalSeconds: event.intervalSeconds ?? interval, motionRate: normalizeRhythm(event.rhythmPercent ?? rhythm) / 100,
      movementRate: normalizeRhythm(event.movementPercent ?? movement) / 100, recoveryPolicy: 'auto', reachability,
      returnLandingZone: event.landingZone, returnShot: defaultReturnShot('groundstroke'), returnStatus: 'end' };
  };
  const addFlight = (owner: ScheduledDrillFlight['owner'], phase: ScheduledDrillFlight['phase'], eventIndex: number,
    startTime: number, trajectory: ResolvedTrajectory, contact?: FlightSample | null) => {
    const flight = contact ? trimFlight(trajectory, contact) : trajectory;
    flights.push({ owner, phase, eventIndex, startTime, endTime: startTime + flight.samples.at(-1)!.time, trajectory: flight });
    endTime = Math.max(endTime, flights.at(-1)!.endTime);
  };
  const startPoint = (feed: OpeningFeed, event: PlayerShotEventV2, index: number) => {
    setIndex++;
    const ball = sampleBall(feed.ball, 'opening', index), target = sampleLandingZone(feed.landingZone, random('opening', index, 'landing'));
    let source = { ...feed.position, y: contactHeight(ball.family) };
    // The authored opening position is the opponent's body root.
    for (let iteration = 0; iteration < 5; iteration++) {
      const shot = shotDefinition(source, ball, target, 'Opening shot'), clip = motionClip(strokeForShot(shot, repetitions.length));
      const yaw = Math.atan2(target.x - source.x, target.z - source.z), offset = rotateMotionPoint(clip.contactLocal!, yaw, ball.hand);
      source = { x: feed.position.x + offset.x, y: contactHeight(ball.family), z: feed.position.z + offset.z };
    }
    const fit = fitIncoming(source, ball, feed.landingZone, target, event);
    let rep = repetition(shotDefinition(source, ball, target, 'Opening shot'), fit.trajectory, Math.max(3, endTime + .5), event);
    const previous = repetitions.at(-1), lead = motionEvent(rep).contactTime - motionEvent(rep).start;
    const restStart = endTime, restSeconds = index > 0 && index % workBlock === 0 ? Math.max(0, settings.restSeconds) : 0;
    const travel = cameraTravelSeconds(lastCamera, event.camera, movement / 100);
    const departure = index === 0 ? 0 : playerEvents.at(-1)?.startTime ?? endTime;
    if (travel > 0) transitions.push({ start: departure, end: departure + travel, from: lastCamera, to: event.camera });
    let time = Math.max(3, endTime + restSeconds + lead + .15, departure + travel);
    if (previous) {
      rep = withPreparedApproach(previous, { ...rep, startTime: time });
      const solved = solveShotInterval(previous, rep, time - previous.startTime);
      repetitions[previous.index] = { ...solved.previous, recoveryPolicy: 'recover' };
      time = previous.startTime + solved.gap; rep = solved.next;
    }
    if (restSeconds) restPeriods.push({ afterIndex: index - 1, startTime: restStart, endTime: restStart + restSeconds });
    rep = { ...rep, startTime: time }; repetitions.push(rep); incomingIndex = rep.index; incoming = fit;
    addFlight('opponent', 'opening', index, time, fit.trajectory, fit.contact);
    lastCamera = event.camera;
  };

  for (let index = 0; index < events.length; index++) {
    const event = events[index]!, next = events[index + 1];
    const newPoint = index === 0 || index % workBlock === 0 || !!event.openingFeed;
    if (newPoint) startPoint(event.openingFeed ?? drill.launch, event, index);
    const current: IncomingFit | null = incoming;
    if (!current?.contact) {
      issues.push({ index, phase: newPoint ? 'opening' : 'player', message: `Shot ${index + 1}: the incoming ball does not reach this ${event.ball.family} at the player camera. Adjust the preceding return zone, ball settings or camera.` });
      break;
    }
    const arrival = repetitions[incomingIndex]!, playerTime = arrival.startTime + current.contact.time;
    repetitions[incomingIndex] = { ...arrival, reachability: { ...arrival.reachability, reachable: true, reason: 'reachable', contact: current.contact } };
    const ball = sampleBall(event.ball, 'player', index), target = sampleLandingZone(event.landingZone, random('player', index, 'landing'));
    const playerFlight = resolve(current.contact.position, ball, event.landingZone, target);
    playerEvents.push({ index, event, setIndex, startTime: playerTime, incomingIndex, trajectory: playerFlight });
    if (!landsInZone(playerFlight)) {
      addFlight('player', 'player', index, playerTime, playerFlight);
      issues.push({ index, phase: 'player', message: `Shot ${index + 1}: the player ball cannot reach its landing zone with these settings.` }); break;
    }
    const continues = !!next && (index + 1) % workBlock !== 0 && !next.openingFeed;
    // The last player action finishes the point. Its response configuration is
    // retained for reuse/reordering, but no extra opponent stroke is invented.
    if (!continues) { addFlight('player', 'player', index, playerTime, playerFlight); continue; }
    const response = event.opponentReturn, replyBall = sampleBall(response.ball, 'response', index);
    const replyTarget = sampleLandingZone(response.landingZone, random('response', index, 'landing'));
    const requested = normalizeShotInterval(event.intervalSeconds ?? interval);
    const receiver = continues ? next : undefined;
    const eligible = opponentContacts(playerFlight, replyBall);
    const desired = requested / 2;
    const ranked = [...eligible].sort((a, b) => Math.abs(a.time - desired) + Math.abs(a.position.y - contactHeight(replyBall.family)) * .1
      - Math.abs(b.time - desired) - Math.abs(b.position.y - contactHeight(replyBall.family)) * .1);
    const selected: FlightSample[] = [];
    for (const c of [...ranked, eligible[0], eligible.at(-1)]) if (c && selected.length < 8 && selected.every(s => Math.abs(s.time - c.time) > .07)) selected.push(c);
    const previous = repetitions.at(-1)!;
    let best: { contact: FlightSample; fit: IncomingFit; rep: CompiledRepetition; score: number } | undefined;
    const preferredTravel = receiver ? cameraTravelSeconds(event.camera, receiver.camera, normalizeRhythm(receiver.movementPercent ?? movement) / 100) : 0;
    const minimumTravel = receiver ? cameraTravelSeconds(event.camera, receiver.camera, 3) : 0;
    for (const contact of selected) {
      const time = playerTime + contact.time;
      const draftShot = shotDefinition(contact.position, replyBall, replyTarget, `${event.label} — opponent return`);
      // Motion feasibility uses the same route selector as final playback.
      const ceiling = withPreparedApproach({ ...previous, motionRate: 3, movementRate: 3 },
        { ...previous, index: repetitions.length, shot: draftShot, startTime: time, motionRate: 3, movementRate: 3 });
      if (minimumMotionGap({ ...previous, motionRate: 3, movementRate: 3 }, ceiling) > time - previous.startTime + 1e-8) continue;
      const fit = fitIncoming(contact.position, replyBall, response.landingZone, replyTarget, receiver, requested - contact.time);
      if (!landsInZone(fit.trajectory) || receiver && (!fit.contact || contact.time + fit.contact.time < minimumTravel + .12)) continue;
      const total = contact.time + (fit.contact?.time ?? 0);
      const score = receiver ? Math.abs(total - requested) + fit.score * .1 : Math.abs(contact.time - desired);
      if (!best || score < best.score) best = { contact, fit, rep: repetition(draftShot, fit.trajectory, time, event), score };
    }
    if (!best) {
      addFlight('player', 'player', index, playerTime, playerFlight);
      issues.push({ index, phase: 'response', message: `Shot ${index + 1}: the opponent cannot connect this landing, response and next player position. Adjust the return zone, shot type, pace or next camera.` }); break;
    }
    const gap = best.rep.startTime - previous.startTime, solved = solveShotInterval(previous, best.rep, gap);
    if (solved.gap > gap + 1e-7) {
      addFlight('player', 'player', index, playerTime, playerFlight);
      issues.push({ index, phase: 'response', message: `Shot ${index + 1}: the opponent needs more travel or preparation time for this return.` }); break;
    }
    const route = planRecovery(motionEvent(solved.previous), motionEvent(solved.next));
    repetitions[previous.index] = { ...solved.previous, recoveryPolicy: route.kind === 'direct' ? 'direct' : 'recover' };
    repetitions.push({ ...solved.next, startTime: best.rep.startTime });
    const actual = best.contact.time + (best.fit.contact?.time ?? best.fit.trajectory.samples.at(-1)!.time);
    const travel = Math.max(minimumTravel, Math.min(preferredTravel, actual - .12));
    playerEvents[index] = { ...playerEvents[index]!, responseIndex: best.rep.index,
      ...(continues ? { timing: { requested, actual, limited: Math.abs(actual - requested) > 1 / 240 } } : {}) };
    addFlight('player', 'player', index, playerTime, playerFlight, best.contact);
    addFlight('opponent', 'response', index, best.rep.startTime, best.fit.trajectory, best.fit.contact);
    if (receiver && travel > 0) transitions.push({ start: playerTime, end: playerTime + travel, from: event.camera, to: receiver.camera });
    incoming = best.fit; incomingIndex = best.rep.index; lastCamera = receiver?.camera ?? event.camera;
    if (solved.previous.motionRate !== previous.motionRate || solved.next.motionRate !== best.rep.motionRate || Math.abs(actual - requested) > .01) motionTimingAdjusted = true;
  }
  const last = repetitions.at(-1);
  return { solverVersion: 'ball-v8-shot-spin', plannerVersion: 'gameplay-player-drills-v11', contentVersion: '2026.09.09',
    drill, settings: { ...settings, mode: 'drill', rhythmPercent: rhythm, movementPercent: movement, shotIntervalSeconds: interval, workBlockSize: workBlock },
    mode: 'drill', repetitions, restPeriods, duration: Math.max(endTime, last ? planRecovery(motionEvent(last)).end + .15 : 3),
    motionTimingAdjusted, rhythmPercent: rhythm, cameraTimeline: { initial: initialCamera ?? DEFAULT_DRILL_CAMERA,
      transitions: transitions.map(stage => ({ ...stage, from: interpolateCamera(initialCamera, stage.from, cameraScale),
        to: interpolateCamera(initialCamera, stage.to, cameraScale) })) },
    playerEvents, scheduledFlights: flights, planningIssues: issues };
}
