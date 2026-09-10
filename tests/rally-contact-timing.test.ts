import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OpponentRig } from '../src/engine/rendering/OpponentRig';
import { DRILL_BY_CATEGORY } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';
import { defaultReturnShot } from '../src/engine/session/returnShot';
import { motionEvent, minimumMotionGap, sampleOpponentTimeline, OPPONENT_MOTION } from '../src/engine/session/opponentTimeline';
import { MAX_OPPONENT_SPEED, planRecovery, RECEIVE_REACTION_SECONDS, recoveryCenter } from '../src/engine/session/opponentMovement';
import { compilePracticePreview, ContinuousPracticePreview } from '../src/engine/session/practicePreview';
import { sessionFlights } from '../src/engine/session/sessionFlights';
import { sampleTrajectoryAt } from '../src/engine/trajectory/physics';

const settings: SessionSettings = { mode: 'quick-practice', repetitions: 6, workBlockSize: 6, restSeconds: 0, shotIntervalSeconds: 5,
  rhythmPercent: 100, movementPercent: 100, variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: 70,
  spin: 'topspin', spinRateRpm: 1103, surface: 'hard', seed: '18427', opponentHand: 'right', serveRhythm: 'normal',
  practiceShotType: 'groundstroke', landingDepthM: 8.5, opponentPosition: { x: 0, z: 12.9 },
  rally: { landingZone: DEFAULT_RETURN_LANDING_ZONE, shot: defaultReturnShot('groundstroke'), opponentContactTiming: 'descent' } };
// The live practice setup, with the reported five-second interval. Keep this
// distinct from the default fixture: its deeper zones produce a faster bounce.
const deepSettings: SessionSettings = { ...settings, launchSpeedKmh: 61, spinRateRpm: 1224, variationPercent: 11,
  landingZone: { width: 3.3342819192956377, depth: 1.1324296593881265 }, landingDepthM: 10.756537948847688,
  aimDirectionDeg: -.37905758012539564, opponentPosition: { x: .16424851249214015, z: 13.870453607813742 },
  rally: { ...settings.rally!, landingZone: { minX: -.7453057031504453, maxX: .8546942968495548, minZ: 8.859818344206353, maxZ: 10.859818344206353 } } };
const drill = DRILL_BY_CATEGORY.get('Quick Rally')!;
afterEach(() => vi.restoreAllMocks());

describe('contact-anchored opponent reception', () => {
  it.each([settings, deepSettings])('keeps rendered descent, movement and stroke on one clock for $landingDepthM m landings', configuration => {
    for (const hand of ['right', 'left'] as const) for (const interval of [2.5, 5, 8]) {
      const session = compileSession(drill, { ...configuration, opponentHand: hand, shotIntervalSeconds: interval });
      expect(session.planningIssues ?? []).toEqual([]);
      expect(session.repetitions).toHaveLength(6);
      const events = session.repetitions.map(motionEvent);
      for (let i = 1; i < events.length; i++) {
        const previous = session.repetitions[i - 1]!, next = session.repetitions[i]!, event = events[i]!;
        const r = previous.rallyReturn!, contact = event.incomingContact!, plan = planRecovery(events[i - 1]!, event);
        expect(contact.phase).toBe('descent');
        expect(contact.releaseTime).toBeCloseTo(previous.startTime + r.contactTime, 8);
        expect(contact.contactTime).toBeCloseTo(event.contactTime, 8);
        expect(contact.contactTime - contact.apexTime!).toBeGreaterThan(.04);
        expect(contact.apexTime).toBeGreaterThan(contact.bounceTime!);
        // Check positions sent to the renderer, not just the velocity label.
        const before = sessionFlights(session, event.contactTime - .02)[0]!;
        const p = sampleTrajectoryAt(before.trajectory, before.time, false), hit = next.shot.source;
        expect(before.phase).toBe('return');
        expect((hit.y - p.y) / .02).toBeLessThan(-.3);
        expect(r.trajectory.samples.at(-1)!.position).toEqual(hit);
        expect(sampleOpponentTimeline(events, event.contactTime)!.event?.index).toBe(event.index);
        expect(minimumMotionGap(previous, next)).toBeLessThanOrEqual(event.contactTime - events[i - 1]!.contactTime + 1e-6);
        expect(plan.end).toBeCloseTo(event.start, 7);
        if (plan.reception === 'react') {
          expect(plan.splitEnd).toBeGreaterThanOrEqual(contact.releaseTime + RECEIVE_REACTION_SECONDS - 1e-8);
          expect(plan.approach!.start).toBe(plan.splitEnd);
          expect(plan.recover.end).toBeLessThanOrEqual(plan.splitStart + 1e-8);
        }
        let last = sampleOpponentTimeline(events, events[i - 1]!.end)!;
        for (let t = events[i - 1]!.end + 1 / 120; t <= event.contactTime; t += 1 / 120) {
          const pose = sampleOpponentTimeline(events, t)!;
          expect(Math.hypot(pose.root.x - last.root.x, pose.root.z - last.root.z) * 120).toBeLessThan(MAX_OPPONENT_SPEED + .02);
          last = pose;
        }
        expect(previous.timing!.limited).toBe(Math.abs(previous.timing!.actual - interval) > 1 / 240 + 1e-7);
      }
    }
  }, 20000);

  it('accelerates to read a normal return instead of using the slow anticipatory route', () => {
    const session = compileSession(drill, settings), a = motionEvent(session.repetitions[0]!), b = motionEvent(session.repetitions[1]!);
    const plan = planRecovery(a, b);
    expect(plan.reception).toBe('react');
    expect(plan.splitStart).toBeLessThan(b.incomingContact!.releaseTime);
    expect(plan.splitEnd).toBeGreaterThan(b.incomingContact!.releaseTime);
    expect(b.movementRate).toBeGreaterThan(1.3);
    expect(plan.approach!.end).toBeCloseTo(b.start, 8);
    const later = { ...b, start: a.end + 5, contactTime: a.end + 5.3,
      incomingContact: { ...b.incomingContact!, releaseTime: a.end + 2.5, contactTime: a.end + 5.3 } };
    expect(planRecovery(a, later).center).toEqual(recoveryCenter(a));
  });

  it.each(['right', 'left'] as const)('preserves the post-IK intercept through continuous preview joins (%s)', async hand => {
    const bytes = await readFile(new URL(`../public${OPPONENT_MOTION.url}`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
    const rig = new OpponentRig(); await rig.load();
    const preview = new ContinuousPracticePreview(compilePracticePreview(drill, { ...deepSettings, opponentHand: hand }));
    try {
      const seam = preview.frame(0).nextContact;
      const checkpoints = preview.frame(0).events.filter(event => event.incomingContact).map(event => event.contactTime);
      expect(checkpoints.some(time => time >= seam)).toBe(true);
      for (const time of checkpoints) {
        const before = preview.frame(time - 1 / 120), at = preview.frame(time);
        const ball = before.flights[0]!, pose = sampleOpponentTimeline(at.events, time)!;
        rig.sampleMotion(pose);
        const source = pose.event!.source;
        expect(rig.getContactPosition()!.distanceTo(new THREE.Vector3(source.x, source.y, source.z))).toBeLessThan(.002);
        expect(source.y).toBeLessThan(sampleTrajectoryAt(ball.trajectory, ball.time, false).y);
        expect(pose.event!.incomingContact!.phase).toBe('descent');
        expect(planRecovery(at.events.find(e => e.index === pose.event!.index - 1)!, pose.event!).end).toBeCloseTo(pose.event!.start, 7);
      }
      const original = preview.frame(seam - .3);
      preview.frame(seam + 2);
      expect(preview.frame(seam - .3)).toEqual(original);
    } finally { preview.dispose(); rig.dispose(); }
  }, 20000);
});
