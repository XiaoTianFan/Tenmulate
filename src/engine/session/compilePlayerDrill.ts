import { resolveOpponentStroke } from './opponentStroke';
import { groundedOpponentShot, opponentContactCeiling } from './opponentContact';
import type { OpponentBall, DrillDefinitionV2, OpeningFeed, PlayerShotEventV2, ShotDefinitionV1 } from '../../content/types';
import type { CompiledRepetition, CompiledSession, SessionSettings } from './compileSession';
import type { Vec3 } from '../../domain/vector';
import type { CameraConfiguration } from '../rendering/TennisScene';
import type { FlightSample, ResolvedTrajectory } from '../trajectory/physics';
import { sampleLandingZone, sampleParameter, type LandingZone } from '../trajectory/landingZone';
import { createSeededRandom } from '../random/seeded';
import { cameraTravelSeconds, DEFAULT_DRILL_CAMERA, type CameraTransition } from './cameraTimeline';
import { planTennisCamera, TENNIS_CAMERA, type TennisCameraExchange } from './tennisCamera';
import { cameraPlayerPosition, type Reachability } from './playerCoverage';
import { contactDistance, contactHeight, landsInZone, opponentContacts, playerContacts, playerFamilyContacts, playerContactAnchor, playerContactCamera, playerContactHeight, playerContactHeightCost, resolveCourtFlight, trimFlight } from './courtFlight';
import { minimumMotionGap, motionClip, motionEvent, rotateMotionPoint, strokeForShot, withPreparedApproach } from './opponentTimeline';
import { planRecovery } from './opponentMovement';
import { normalizeRhythm, normalizeShotInterval } from './rhythm';
import { solveShotInterval } from './shotTiming';
import { defaultReturnShot } from './returnShot';
import { bounceContactCost, bounceContactPhase, bounceContactPreference, incomingContact, type BounceContactPhase } from './bounceContact';

export type ScheduledDrillFlight = Readonly<{ owner: 'player' | 'opponent'; phase: 'opening' | 'player' | 'response';
  eventIndex: number; startTime: number; endTime: number; trajectory: ResolvedTrajectory }>;
export type CompiledPlayerEvent = Readonly<{ index: number; event: PlayerShotEventV2; setIndex: number;
  contactCamera: CameraConfiguration;
  startTime: number; incomingIndex: number; responseIndex?: number; trajectory: ResolvedTrajectory;
  timing?: Readonly<{ requested: number; actual: number; limited: boolean }>;
  opponentContactPhase?: BounceContactPhase; }>;
export type DrillPlanningIssue = Readonly<{ index: number; phase: 'opening' | 'player' | 'response'; message: string }>;
type IncomingFit = { trajectory: ResolvedTrajectory; contact: FlightSample | null; score: number };
export type PlayerShotSelection = Readonly<{ eventId: string; opening: boolean; initialOpening?: boolean }>;
export type ShotPreviewTrajectories = Readonly<{ player?: ResolvedTrajectory; opponent?: ResolvedTrajectory }>;

export function compilePlayerDrill(drill: DrillDefinitionV2, settings: SessionSettings, selection?: PlayerShotSelection): CompiledSession {
  if (!drill.events.length) throw new Error('A drill needs at least one player shot.');
  const count = Math.max(1, Math.min(200, Math.floor(settings.repetitions)));
  const rhythm = normalizeRhythm(settings.rhythmPercent ?? drill.defaultRhythmPercent ?? 100);
  const movement = normalizeRhythm(settings.movementPercent ?? drill.defaultMovementPercent ?? 100);
  const interval = normalizeShotInterval(settings.shotIntervalSeconds ?? settings.interval ?? drill.defaultInterval);
  const workBlock = Math.max(1, Math.min(drill.events.length, Math.floor(settings.workBlockSize)));
  const continuesPoint = (sequence: readonly PlayerShotEventV2[], index: number) =>
    !!sequence[index + 1] && (index + 1) % workBlock !== 0 && !sequence[index + 1]!.openingFeed;
  const cameraScale = Math.max(0, Math.min(1, settings.cameraMotionScale ?? 1));
  let initialCamera = drill.events[0]!.camera;
  const events = Array.from({ length: count }, (_, index) => {
    const event = drill.events[index % drill.events.length]!;
    return event.camera.fov === initialCamera.fov ? event : { ...event, camera: { ...event.camera, fov: initialCamera.fov } };
  });
  const repetitions: CompiledRepetition[] = [], playerEvents: CompiledPlayerEvent[] = [], flights: ScheduledDrillFlight[] = [];
  const issues: DrillPlanningIssue[] = [], restPeriods: { afterIndex: number; startTime: number; endTime: number }[] = [];
  const transitions: CameraTransition[] = [];
  const cameraExchanges: TennisCameraExchange[] = [];
  let incoming: IncomingFit | null = null, incomingIndex = -1, setIndex = -1;
  let endTime = 0, lastCamera: CameraConfiguration = initialCamera, motionTimingAdjusted = false;

  const random = (role: string, index: number, parameter: string) => createSeededRandom(`${settings.seed}:player-drill:${role}:${index}:${parameter}`);
  const sampleZone = (zone: LandingZone, role: string, index: number) => {
    const draw = random(role, index, 'landing');
    const x = draw(), z = draw();
    // Reflect the horizontal quantile, not just the rectangle. Uniform coverage
    // and the seed's relative placement remain consistent when changing hands.
    let axis = 0;
    return sampleLandingZone(zone, () => axis++ === 0 ? drill.playerHand === 'left' ? 1 - x : x : z);
  };
  const sampleBall = (ball: OpponentBall, role: string, index: number): OpponentBall => ({ ...ball,
    paceKmh: sampleParameter(ball.paceKmh, ball.variationPercent / 100, 20, 260, random(role, index, 'speed')),
    spinRateRpm: sampleParameter(ball.spinRateRpm, ball.variationPercent / 100, 0, 6000, random(role, index, 'spin')) });
  const resolve = (source: Vec3, ball: OpponentBall, zone: LandingZone, target: { x: number; z: number }, pace = ball.paceKmh,
    accepts?: (flight: ResolvedTrajectory) => boolean, fixedLaunchSpeed = false) =>
    resolveCourtFlight({ source, target, landingZone: zone, family: ball.family, opponentHand: ball.hand,
      launchSpeedKmh: pace, spin: ball.spin, spinRateRpm: ball.spinRateRpm, surface: settings.surface,
      minimumNetClearanceM: ball.netClearanceM, bounceFactor: ball.bounceFactor, trajectoryMode: ball.trajectoryMode, windVelocity: settings.windVelocity, fixedLaunchSpeed }, accepts);
  const fitIncoming = (source: Vec3, ball: OpponentBall, zone: LandingZone, target: { x: number; z: number }, receiver?: PlayerShotEventV2, desired?: number,
    canReceive?: (contact: FlightSample) => boolean, preferHeight = true): IncomingFit => {
    let best: IncomingFit | undefined;
    const receivingContacts = (flight: ResolvedTrajectory) => receiver ? playerContacts(flight, receiver).filter(contact => !canReceive || canReceive(contact)) : [];
    const netReceiver = receiver && ['volley', 'half-volley'].includes(receiver.ball.family);
    const matchesHeight = (contact: FlightSample) => !netReceiver || Math.abs(contact.position.y - playerContactHeight(receiver!)) <= .15;
    for (const factor of ball.trajectoryMode === 'exact' || ['groundstroke', 'approach', 'half-volley'].includes(ball.family) ? [1] : [1, .85, 1.15]) {
      let trajectory = resolve(source, ball, zone, target, ball.paceKmh * factor,
        receiver ? flight => receivingContacts(flight).length > 0 : undefined);
      if (preferHeight && netReceiver && ball.trajectoryMode === 'natural' && !receivingContacts(trajectory).some(matchesHeight)) {
        const preferred = resolve(source, ball, zone, target, ball.paceKmh * factor,
          flight => receivingContacts(flight).some(matchesHeight));
        // Eye height is a preference, not permission to discard an otherwise
        // playable feed when no physical contact reaches that height.
        if (landsInZone(preferred) && receivingContacts(preferred).some(matchesHeight)) trajectory = preferred;
      }
      const eligible = receiver && landsInZone(trajectory) ? receivingContacts(trajectory) : [];
      const comfortable = eligible.filter(matchesHeight), contacts = comfortable.length ? comfortable : eligible;
      const preference = receiver ? bounceContactPreference(trajectory, receiver.ball.family, receiver.ball.contactTiming) : null;
      const scoreContact = (contact: FlightSample) => (desired === undefined ? 0 : Math.abs(contact.time - desired))
        + bounceContactCost(contact, preference) + contactDistance(contact, receiver!) * .24 + playerContactHeightCost(contact, receiver!);
      const contact = [...contacts].sort((a, b) => scoreContact(a) - scoreContact(b))[0] ?? null;
      const score = (receiver ? contact ? scoreContact(contact) : 1000 : landsInZone(trajectory) ? 0 : 1000) + Math.abs(1 - factor) * .15;
      if (!best || score < best.score) best = { trajectory, contact, score };
      if (!receiver && score < 1) break;
    }
    return best!;
  };
  const shotDefinition = (source: Vec3, ball: OpponentBall, target: { x: number; z: number }, label: string): ShotDefinitionV1 => ({
    schemaVersion: 1, id: 'resolved-opponent-contact', label, cue: label, family: ball.family, source, target,
    paceKmh: ball.paceKmh, spin: ball.spin, opponentHand: ball.hand, stroke: ball.stroke === 'auto' ? 'forehand' : ball.stroke, surface: settings.surface,
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
    setIndex = Math.floor(index / workBlock);
    const ball = sampleBall(feed.ball, 'opening', index), target = sampleZone(feed.landingZone, 'opening', index);
    const sourceHeight = Math.min(contactHeight(ball.family), opponentContactCeiling({ ...ball, stroke: ball.stroke === 'auto' ? 'forehand' : ball.stroke }));
    let source = { ...feed.position, y: sourceHeight };
    // The authored opening position is the opponent's body root.
    for (let iteration = 0; iteration < 5; iteration++) {
      const shot = shotDefinition(source, ball, target, 'Opening shot'), clip = motionClip(strokeForShot(shot, repetitions.length));
      const yaw = Math.atan2(target.x - source.x, target.z - source.z), offset = rotateMotionPoint(clip.contactLocal!, yaw, ball.hand);
      source = { x: feed.position.x + offset.x, y: sourceHeight, z: feed.position.z + offset.z };
    }
    // Serve reception owns its pace and viewpoint. Fit the illustrative player
    // response to that serve, never slow the serve to reach a player-shot phase.
    const serve = ball.family === 'serve';
    const serveFlight = serve ? resolve(source, ball, feed.landingZone, target, ball.paceKmh, undefined, true) : undefined;
    const serveContact = serveFlight && landsInZone(serveFlight) ? [...playerFamilyContacts(serveFlight, event)]
      .sort((a, b) => contactDistance(a, event) - contactDistance(b, event)
        || Math.abs(a.position.y - playerContactHeight(event)) - Math.abs(b.position.y - playerContactHeight(event)))[0] ?? null : null;
    const fit: IncomingFit = serveFlight ? { trajectory: serveFlight, contact: serveContact, score: 0 }
      : fitIncoming(source, ball, feed.landingZone, target, event);
    const contactCamera = !serve && fit.contact ? playerContactCamera(event, fit.contact.position) : event.camera;
    if (index === 0 && !selection) initialCamera = contactCamera;
    let rep = repetition(shotDefinition(source, ball, target, 'Opening shot'), fit.trajectory, Math.max(3, endTime + .5), event);
    const previous = repetitions.at(-1), lead = motionEvent(rep).contactTime - motionEvent(rep).start;
    const restStart = endTime, restSeconds = index > 0 && index % workBlock === 0 ? Math.max(0, settings.restSeconds) : 0;
    const travel = index === 0 ? 0 : cameraTravelSeconds(lastCamera, contactCamera, movement / 100);
    const departure = index === 0 ? 0 : (playerEvents.at(-1)?.startTime ?? endTime) + TENNIS_CAMERA.release;
    const reset = { start: departure, end: departure + travel, from: lastCamera, to: contactCamera };
    let time = Math.max(3, endTime + restSeconds + lead + .15, departure + travel + (serve ? lead : 0));
    if (previous) {
      rep = withPreparedApproach(previous, { ...rep, startTime: time });
      const solved = solveShotInterval(previous, rep, time - previous.startTime);
      repetitions[previous.index] = { ...solved.previous, recoveryPolicy: 'recover' };
      time = previous.startTime + solved.gap; rep = solved.next;
    }
    if (restSeconds) restPeriods.push({ afterIndex: index - 1, startTime: restStart, endTime: restStart + restSeconds });
    rep = { ...rep, startTime: time }; repetitions.push(rep); incomingIndex = rep.index; incoming = fit;
    const previousPlayer = playerEvents.at(-1), configuration = previousPlayer?.event.cameraTransition;
    const custom = configuration && (configuration.movement && configuration.movement.destination !== 'auto'
      || Object.values(configuration.focus ?? {}).some(target => target.mode !== 'auto'));
    if (custom && previousPlayer && fit.contact) {
      const plan = planTennisCamera({ start: previousPlayer.startTime, end: time + fit.contact.time, opponentContact: time,
        from: lastCamera, to: contactCamera, playerTarget: previousPlayer.trajectory.intent.target,
        currentFamily: previousPlayer.event.ball.family, nextFamily: event.ball.family, opponentFamily: ball.family,
        movementRate: movement / 100, configuration });
      // Between points, Automatic movement keeps the existing reset before the
      // feed. Focus can still be authored without changing that movement clock.
      const authored = !configuration.movement || configuration.movement.destination === 'auto'
        ? { ...plan, strategy: 'custom' as const, legs: travel > 0 ? [reset] : [], advance: undefined,
          ready: contactCamera, feasible: true, requiredSeconds: travel, availableSeconds: time - departure }
        : plan;
      if (!authored.feasible) issues.push({ index, phase: 'opening', message: `Camera before shot ${index + 1}: this route needs more travel time. Start earlier, shorten the delay or move the intermediate position closer.` });
      else transitions.push(...authored.legs);
      cameraExchanges.push({ ...authored, outgoing: previousPlayer.trajectory, ...(!serve ? { incoming: fit.trajectory } : {}) });
      if (serve) {
        // Keep the authored between-point route, but finish it before the toss.
        // The next serve never starts while that route or its focus turn runs.
        time = Math.max(time, authored.end + lead);
        repetitions[rep.index] = { ...rep, startTime: time };
      }
    } else if (travel > 0) transitions.push(reset);
    addFlight('opponent', 'opening', index, time, fit.trajectory, fit.contact);
    lastCamera = contactCamera;
  };

  let shotPreview: ShotPreviewTrajectories | undefined;
  let opponentIdle: CompiledSession['opponentIdle'];
  if (selection) {
    // Editing a shot must not depend on an earlier/next camera being reachable.
    // Use the same seeded physics and real bounce contacts as gameplay, but start
    // at this player's configured racket anchor. Point endings match gameplay.
    const index = drill.events.findIndex(event => event.id === selection.eventId);
    const event = drill.events[index];
    if (!event) throw new Error('The selected shot no longer exists.');
    if (selection.opening) {
      startPoint(selection.initialOpening ? drill.launch : event.openingFeed ?? drill.launch, event, index);
      const trajectory = repetitions[0]!.trajectory;
      shotPreview = { opponent: trajectory };
      if (!landsInZone(trajectory)) issues.push({ index, phase: 'opening', message: 'The opening ball cannot reach its landing zone with these settings.' });
    } else {
      const continues = continuesPoint(drill.events, index);
      const ball = sampleBall(event.ball, 'player', index), target = sampleZone(event.landingZone, 'player', index);
      const playerFlight = resolve(playerContactAnchor(event), ball, event.landingZone, target, ball.paceKmh,
        continues ? flight => opponentContacts(flight, event.opponentReturn.ball).length > 0 : undefined);
      shotPreview = { player: playerFlight };
      const playerTime = 3;
      if (!continues) {
        // A winner keeps its complete flight and never schedules a return swing.
        const feed = drill.events.slice(0, index + 1).reverse().find(candidate => candidate.openingFeed)?.openingFeed ?? drill.launch;
        opponentIdle = { ...feed.position, hand: feed.ball.hand };
        addFlight('player', 'player', index, playerTime, playerFlight);
        if (!landsInZone(playerFlight)) issues.push({ index, phase: 'player', message: 'The player ball cannot reach its landing zone with these settings.' });
      } else {
        const response = event.opponentReturn, replyBall = sampleBall(response.ball, 'response', index);
        const replyTarget = sampleZone(response.landingZone, 'response', index);
        const preference = bounceContactPreference(playerFlight, replyBall.family, replyBall.contactTiming);
        const rank = (contact: FlightSample) => bounceContactCost(contact, preference)
          + Math.abs(contact.position.y - contactHeight(replyBall.family)) * .4;
        const contacts = landsInZone(playerFlight) ? [...opponentContacts(playerFlight, replyBall)].sort((a, b) => rank(a) - rank(b)) : [];
        let reply: { contact: FlightSample; trajectory: ResolvedTrajectory } | undefined;
        for (const contact of contacts.slice(0, 8)) {
          const fit = fitIncoming(contact.position, replyBall, response.landingZone, replyTarget);
          if (landsInZone(fit.trajectory)) { reply = { contact, trajectory: fit.trajectory }; break; }
        }
        addFlight('player', 'player', index, playerTime, playerFlight, reply?.contact);
        if (reply) {
          const time = playerTime + reply.contact.time;
          repetitions.push(resolveOpponentStroke(null, repetition(shotDefinition(reply.contact.position, replyBall, replyTarget, `${event.label} — opponent return`), reply.trajectory, time, event), replyBall.stroke));
          addFlight('opponent', 'response', index, time, reply.trajectory);
          shotPreview = { player: playerFlight, opponent: reply.trajectory };
        } else issues.push({ index, phase: landsInZone(playerFlight) ? 'response' : 'player', message: landsInZone(playerFlight)
          ? 'The opponent cannot return this ball with the selected shot type and contact timing. Adjust the player ball or opponent contact timing.'
          : 'The player ball cannot reach its landing zone with these settings.' });
      }
    }
  }

  for (let index = 0; !selection && index < events.length; index++) {
    const event = events[index]!, next = events[index + 1];
    const newPoint = index === 0 || index % workBlock === 0 || !!event.openingFeed;
    if (newPoint) startPoint(event.openingFeed ?? drill.launch, event, index);
    const current: IncomingFit | null = incoming;
    if (!current?.contact) {
      const serve = newPoint && repetitions[incomingIndex]?.shot.family === 'serve';
      issues.push({ index, phase: newPoint ? 'opening' : 'player', message: serve
        ? !current || !landsInZone(current.trajectory)
          ? `Opening serve ${index + 1}: the configured speed cannot reach this landing zone with the current spin and net clearance. Adjust the serve or landing zone; its speed and your camera are kept fixed.`
          : `Opening serve ${index + 1}: this serve has no legal ${event.ball.family} return contact. Change the player shot type; the serve speed and your camera are kept fixed.`
        : `Shot ${index + 1}: the incoming ball does not reach this ${event.ball.family} at the player camera with the selected contact timing. Adjust the preceding return zone, ball settings, contact timing or camera.` });
      break;
    }
    const arrival = repetitions[incomingIndex]!, playerTime = arrival.startTime + current.contact.time;
    const fixedOpening = newPoint && arrival.shot.family === 'serve';
    const contactCamera = fixedOpening ? event.camera : playerContactCamera(event, current.contact.position);
    if (newPoint && cameraExchanges.at(-1)?.end !== playerTime) cameraExchanges.push({ ...planTennisCamera({ start: transitions.at(-1)?.end ?? 0, end: playerTime,
      opponentContact: arrival.startTime, from: contactCamera, to: contactCamera, opening: true,
      playerTarget: current.trajectory.intent.target, currentFamily: event.ball.family, nextFamily: event.ball.family,
      opponentFamily: arrival.shot.family }), incoming: current.trajectory,
      ...(fixedOpening ? { fixedCamera: contactCamera } : {}) });
    repetitions[incomingIndex] = { ...arrival, reachability: { ...arrival.reachability, reachable: true, reason: 'reachable', contact: current.contact } };
    const ball = sampleBall(event.ball, 'player', index), target = sampleZone(event.landingZone, 'player', index);
    const continues = continuesPoint(events, index);
    const response = event.opponentReturn, replyBall = sampleBall(response.ball, 'response', index);
    const replyTarget = sampleZone(response.landingZone, 'response', index);
    const previous = repetitions.at(-1)!;
    const reachableOpponentContacts = (flight: ResolvedTrajectory) => opponentContacts(flight, replyBall).filter(contact => {
      const time = playerTime + contact.time;
      const shot = shotDefinition(contact.position, replyBall, replyTarget, `${event.label} — opponent return`);
      const ceiling = resolveOpponentStroke({ ...previous, motionRate: 3, movementRate: 3 },
        { ...previous, index: repetitions.length, shot, startTime: time, motionRate: 3, movementRate: 3,
          incomingContact: incomingContact(flight, contact, playerTime) }, replyBall.stroke);
      return groundedOpponentShot(ceiling.shot) && minimumMotionGap({ ...previous, motionRate: 3, movementRate: 3 }, ceiling) <= time - previous.startTime + 1e-8;
    });
    let playerFlight = resolve(current.contact.position, ball, event.landingZone, target, ball.paceKmh,
      continues ? flight => reachableOpponentContacts(flight).length > 0 : undefined);
    playerEvents.push({ index, event, contactCamera, setIndex, startTime: playerTime, incomingIndex, trajectory: playerFlight });
    if (!landsInZone(playerFlight)) {
      addFlight('player', 'player', index, playerTime, playerFlight);
      issues.push({ index, phase: 'player', message: `Shot ${index + 1}: the player ball cannot reach its landing zone with these settings.` }); break;
    }
    // The last player action finishes the point. Its response configuration is
    // retained for reuse/reordering, but no extra opponent stroke is invented.
    if (!continues) { addFlight('player', 'player', index, playerTime, playerFlight); continue; }
    const requested = normalizeShotInterval(event.intervalSeconds ?? interval);
    const receiver = continues ? next : undefined;
    const cameraPlan = (opponentTime: number, nextContact: FlightSample) => planTennisCamera({ start: playerTime, opponentContact: opponentTime,
      end: opponentTime + nextContact.time, from: contactCamera, to: playerContactCamera(next, nextContact.position), playerTarget: target,
      currentFamily: event.ball.family, nextFamily: next.ball.family, opponentFamily: replyBall.family,
      movementRate: normalizeRhythm(next.movementPercent ?? movement) / 100, configuration: event.cameraTransition });
    const fitResponse = (flight: ResolvedTrajectory, feasibilityOnly = false) => {
      // Filter motion feasibility before reducing the physics search. A short
      // legal window near the end of a bounce must not disappear in downsampling.
      const eligible = reachableOpponentContacts(flight);
      const desired = requested / 2;
      const preference = bounceContactPreference(flight, replyBall.family, replyBall.contactTiming);
      const rank = (c: FlightSample) => bounceContactCost(c, preference) + Math.abs(c.time - desired) * .25 + Math.abs(c.position.y - contactHeight(replyBall.family)) * .4;
      const ranked = [...eligible].sort((a, b) => rank(a) - rank(b));
      const selected: FlightSample[] = [];
      for (const c of [eligible.at(-1), eligible[0], ...ranked]) if (c && selected.length < 8 && selected.every(s => Math.abs(s.time - c.time) > .07)) selected.push(c);
      let best: { contact: FlightSample; fit: IncomingFit; rep: CompiledRepetition; score: number } | undefined;
      for (const contact of selected) {
        const time = playerTime + contact.time;
        const draftShot = shotDefinition(contact.position, replyBall, replyTarget, `${event.label} — opponent return`);
        const fit = fitIncoming(contact.position, replyBall, response.landingZone, replyTarget, receiver, requested - contact.time,
          sample => cameraPlan(time, sample).feasible, !feasibilityOnly);
        if (!landsInZone(fit.trajectory) || receiver && !fit.contact) continue;
        const total = contact.time + (fit.contact?.time ?? 0);
        const postureCost = Math.max(0, contactHeight(replyBall.family) - contact.position.y) ** 2 * 8;
        const score = (receiver ? Math.abs(total - requested) + fit.score * .1 : Math.abs(contact.time - desired)) + postureCost + bounceContactCost(contact, preference);
        if (!best || score < best.score) best = { contact, fit, rep: resolveOpponentStroke(previous, { ...repetition(draftShot, fit.trajectory, time, event),
          incomingContact: incomingContact(flight, contact, playerTime) }, replyBall.stroke), score };
        if (feasibilityOnly) break;
      }
      return best;
    };
    let best = fitResponse(playerFlight);
    if (!best && ball.trajectoryMode === 'natural' && ['volley', 'half-volley'].includes(ball.family)) {
      // A flatter volley shortens the exchange. If its first fit cannot feed the
      // next player, select physical speed/spin candidates with that whole link
      // in view; do not slow the clock or lift the ball after it has been hit.
      playerFlight = resolve(current.contact.position, ball, event.landingZone, target, ball.paceKmh,
        flight => !!fitResponse(flight, true));
      best = fitResponse(playerFlight);
      playerEvents[index] = { ...playerEvents[index]!, trajectory: playerFlight };
    }
    if (!best) {
      addFlight('player', 'player', index, playerTime, playerFlight);
      issues.push({ index, phase: 'response', message: `Shot ${index + 1}: the opponent cannot connect this landing, response and next player position. Adjust the return zone, shot type, pace, contact timing or next camera.${event.cameraTransition?.movement && event.cameraTransition.movement.destination !== 'auto' ? ' The custom camera route must also fit: try starting earlier, shortening delays or moving the intermediate position closer.' : ''}` }); break;
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
    playerEvents[index] = { ...playerEvents[index]!, responseIndex: best.rep.index, opponentContactPhase: bounceContactPhase(best.contact),
      ...(continues ? { timing: { requested, actual, limited: Math.abs(actual - requested) > 1 / 240 } } : {}) };
    addFlight('player', 'player', index, playerTime, playerFlight, best.contact);
    addFlight('opponent', 'response', index, best.rep.startTime, best.fit.trajectory, best.fit.contact);
    if (receiver && best.fit.contact) {
      const plan = cameraPlan(best.rep.startTime, best.fit.contact);
      transitions.push(...plan.legs);
      cameraExchanges.push({ ...plan, outgoing: playerFlight, incoming: best.fit.trajectory });
    }
    incoming = best.fit; incomingIndex = best.rep.index;
    lastCamera = receiver && best.fit.contact ? playerContactCamera(receiver, best.fit.contact.position) : contactCamera;
    if (solved.previous.motionRate !== previous.motionRate || solved.next.motionRate !== best.rep.motionRate || Math.abs(actual - requested) > .01) motionTimingAdjusted = true;
  }
  const last = repetitions.at(-1);
  return { solverVersion: 'ball-v12-opening-serve-pace', plannerVersion: 'gameplay-player-drills-v21', contentVersion: '2026.09.09',
    drill, settings: { ...settings, mode: 'drill', rhythmPercent: rhythm, movementPercent: movement, shotIntervalSeconds: interval, workBlockSize: workBlock },
    mode: 'drill', repetitions, restPeriods, duration: Math.max(endTime, last ? planRecovery(motionEvent(last)).end + .15 : 3),
    motionTimingAdjusted, rhythmPercent: rhythm, cameraTimeline: { initial: initialCamera ?? DEFAULT_DRILL_CAMERA,
      transitions, ...(!selection ? { tennis: { exchanges: cameraExchanges, motionScale: cameraScale } } : {}) },
    playerEvents, scheduledFlights: flights, planningIssues: issues, ...(shotPreview ? { shotPreview } : {}), ...(opponentIdle ? { opponentIdle } : {}) };
}
