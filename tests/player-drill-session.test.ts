import { describe, expect, it } from 'vitest';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { sessionFlights } from '../src/engine/session/sessionFlights';
import { cameraEase, sampleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { motionEvent, minimumMotionGap } from '../src/engine/session/opponentTimeline';
import { PLAYER_CONTACT_RADIUS_M, contactDistance } from '../src/engine/session/courtFlight';
import { sessionCues } from '../src/engine/audio/sessionCues';
import { bounceContactPhase } from '../src/engine/session/bounceContact';
import { receivingZone } from '../src/content/playerShots';
import type { ContactTiming } from '../src/content/types';

const settings: SessionSettings = { repetitions: 4, mode: 'drill', launchSpeedKmh: 78, surface: 'hard', seed: 'player-drill-check',
  variationPercent: 0, timingVariationPercent: 0, spin: 'preset', opponentHand: 'right', workBlockSize: 50,
  restSeconds: 0, serveRhythm: 'normal' };
describe('player-owned drill clock and physical handoffs', () => {
  it.each((['rise', 'apex', 'descent'] as ContactTiming[]).flatMap(player =>
    (['rise', 'apex', 'descent'] as ContactTiming[]).map(opponent => [player, opponent] as const)))
  ('honors player %s and opponent %s contacts independently', (player, opponent) => {
    const original = PLAYER_DRILLS[0]!;
    const events = original.events.map(event => ({ ...event, ball: { ...event.ball, contactTiming: player },
      opponentReturn: { ...event.opponentReturn, ball: { ...event.opponentReturn.ball, contactTiming: opponent } } }));
    const drill = { ...original,
      launch: { ...original.launch, landingZone: receivingZone(events[0]!.camera, 'groundstroke', events[0]!.ball) },
      events: events.map((event, index) => {
        const next = events[(index + 1) % events.length]!;
        return { ...event, opponentReturn: { ...event.opponentReturn, landingZone: receivingZone(next.camera, next.ball.family, next.ball, {
          x: (event.landingZone.minX + event.landingZone.maxX) / 2, z: (event.landingZone.minZ + event.landingZone.maxZ) / 2 + 3,
        }) } };
      }) };
    const session = compileSession(drill, { ...settings, repetitions: 3 });
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents).toHaveLength(3);
    for (const event of session.playerEvents!) {
      expect(bounceContactPhase(session.repetitions[event.incomingIndex]!.reachability.contact!)).toBe(player);
      if (event.responseIndex !== undefined) expect(event.opponentContactPhase).toBe(opponent);
    }
  });
  it('connects the default player pattern with continuous contacts and one opening', () => {
    const drill = PLAYER_DRILLS[0]!, session = compileSession(drill, settings);
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents).toHaveLength(4);
    expect(session.scheduledFlights!.filter(f => f.phase === 'opening')).toHaveLength(1);
    for (const event of session.playerEvents!) {
      const incoming = session.repetitions[event.incomingIndex]!;
      const contact = incoming.reachability.contact!;
      expect(bounceContactPhase(contact)).toBe('descent');
      expect(contactDistance(contact, event.event)).toBeLessThanOrEqual(PLAYER_CONTACT_RADIUS_M);
      expect(event.trajectory.intent.source).toEqual(contact.position);
      expect(event.startTime).toBeCloseTo(incoming.startTime + contact.time, 8);
      if (event.responseIndex === undefined) continue;
      const response = session.repetitions[event.responseIndex]!;
      expect(event.opponentContactPhase).toBe('descent');
      expect(response.shot.source.y).toBeGreaterThanOrEqual(.65);
      const playerFlight = session.scheduledFlights!.find(f => f.owner === 'player' && f.eventIndex === event.index)!;
      expect(playerFlight.trajectory.samples.at(-1)!.position).toEqual(response.shot.source);
      expect(playerFlight.endTime).toBeCloseTo(response.startTime, 8);
      expect(response.incomingContact).toMatchObject({ releaseTime: event.startTime, contactTime: response.startTime, phase: 'descent' });
      expect(response.incomingContact!.apexTime).toBeLessThan(response.startTime);
    }
    for (let i = 1; i < session.repetitions.length; i++) {
      const a = session.repetitions[i - 1]!, b = session.repetitions[i]!;
      expect(minimumMotionGap(a, b)).toBeLessThanOrEqual(b.startTime - a.startTime + 1e-6);
      expect(motionEvent(b).start).toBeGreaterThanOrEqual(motionEvent(a).end - 1e-6);
    }
    for (const flight of session.scheduledFlights!) expect(sessionFlights(session, flight.startTime + .01)).toHaveLength(1);
    expect(sessionCues(session).filter(c => c.kind === 'contact')).toHaveLength(session.scheduledFlights!.length);
  });
  it.each(PLAYER_DRILLS.map(drill => [drill.id, drill] as const))('compiles the complete shipped player drill %s', (_id, drill) => {
    const session = compileSession(drill, { ...settings, repetitions: drill.events.length });
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents).toHaveLength(drill.events.length);
  });
  it.each(PLAYER_DRILLS.map(drill => [drill.id, drill] as const))('runs two sets with the application seed for %s', (_id, drill) => {
    const session = compileSession(drill, { ...settings, seed: '18427', repetitions: drill.defaultRepetitions,
      workBlockSize: drill.events.length, restSeconds: 20 });
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents).toHaveLength(drill.defaultRepetitions);
    expect(session.restPeriods).toHaveLength(1);
    expect(session.playerEvents!.map(event => event.setIndex)).toEqual(Array.from({ length: drill.defaultRepetitions }, (_, index) => Math.floor(index / drill.events.length)));
    for (let i = 1; i < session.cameraTimeline.transitions.length; i++) expect(session.cameraTimeline.transitions[i]!.start)
      .toBeGreaterThanOrEqual(session.cameraTimeline.transitions[i - 1]!.end - 1e-7);
    expect(session.scheduledFlights!.filter(f => f.phase === 'opening').length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < session.scheduledFlights!.length; i++) expect(session.scheduledFlights![i]!.startTime)
      .toBeGreaterThanOrEqual(session.scheduledFlights![i - 1]!.endTime - 1e-7);
  }, 15000);
  it('is deterministic and preserves authored camera views with smooth movement', () => {
    const session = compileSession(PLAYER_DRILLS[0]!, settings);
    expect(compileSession(PLAYER_DRILLS[0]!, settings)).toEqual(session);
    for (const stage of session.cameraTimeline.transitions) {
      expect(sampleCameraTimeline(session.cameraTimeline, stage.start).lateral).toBeCloseTo(stage.from.lateral, 7);
      expect(sampleCameraTimeline(session.cameraTimeline, stage.end).lateral).toBeCloseTo(stage.to.lateral, 7);
    }
    expect(cameraEase(.1)).toBeLessThan(.1);
    for (const event of session.playerEvents!) expect(sampleCameraTimeline(session.cameraTimeline, event.startTime)).toEqual(event.event.camera);
  });
  it('reports a camera/contact mismatch instead of creating a ball at an unrelated position', () => {
    const drill = PLAYER_DRILLS[0]!, event = drill.events[0]!;
    const session = compileSession({ ...drill, events: [{ ...event, camera: { ...event.camera, lateral: 7 } }] }, { ...settings, repetitions: 1 });
    expect(session.planningIssues?.[0]).toMatchObject({ phase: 'opening', index: 0 });
    expect(session.playerEvents).toHaveLength(0);
    expect(session.scheduledFlights).toHaveLength(1);
  });
  it('reduces camera movement without changing physical contacts, flights or timing', () => {
    const full = compileSession(PLAYER_DRILLS[0]!, { ...settings, repetitions: 2 });
    const reduced = compileSession(PLAYER_DRILLS[0]!, { ...settings, repetitions: 2, cameraMotionScale: 0 });
    expect(reduced.scheduledFlights).toEqual(full.scheduledFlights);
    expect(reduced.playerEvents).toEqual(full.playerEvents);
    for (let time = 0; time <= reduced.duration; time += .05)
      expect(sampleCameraTimeline(reduced.cameraTimeline, time, { x: 3, y: 0, z: 12 })).toEqual(reduced.cameraTimeline.initial);
  });
});
