import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHOTS, DRILLS } from '../src/content/bundled';
import { OpponentRig } from '../src/engine/rendering/OpponentRig';
import { compileSession } from '../src/engine/session/compileSession';
import { motionEvent, minimumMotionGap, sampleOpponentTimeline, OPPONENT_MOTION, MAX_OPPONENT_SPEED, type MotionRepetition } from '../src/engine/session/opponentTimeline';

const repetition = (clip: 'forehand' | 'backhand' | 'serve', index = 0, x = 0, z = 12.5, hand: 'left' | 'right' = 'right'): MotionRepetition => ({
  index, startTime: 3 + index * 8, shot: { ...SHOTS[0]!, family: clip === 'serve' ? 'serve' : 'groundstroke',
    stroke: clip === 'serve' ? undefined : clip, opponentHand: hand, serveRhythm: 'normal',
    source: { x, y: clip === 'serve' ? 2.75 : 1.1, z }, target: { x: 1.7, z: -9 } },
});
const bytes = await readFile(new URL(`../public${OPPONENT_MOTION.url}`, import.meta.url));
const loadRig = async () => {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  const rig = new OpponentRig(); await rig.load(); return rig;
};
afterEach(() => vi.restoreAllMocks());

describe('local motion asset and shared contact clock', () => {
  it('ships the validated content-addressed animation bundle', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(OPPONENT_MOTION.sha256);
    expect(bytes.length).toBe(OPPONENT_MOTION.bytes);
  });
  it.each(['forehand', 'backhand', 'serve'] as const)('%s hits the exact launch point for either hand and reproduces arbitrary seeks', async clip => {
    const rig = await loadRig();
    for (const hand of ['right', 'left'] as const) {
      const event = motionEvent(repetition(clip, 0, 2, 12.8, hand));
      const sample = sampleOpponentTimeline([event], event.contactTime)!;
      rig.sampleMotion(sample);
      const contact = rig.getContactPosition()!;
      expect(contact.distanceTo(new THREE.Vector3(event.source.x, event.source.y, event.source.z))).toBeLessThan(.002);
      const wrist = rig.group.getObjectByName('hand_r')!.getWorldPosition(new THREE.Vector3());
      rig.sampleMotion(sampleOpponentTimeline([event], event.start)!);
      expect(rig.group.getObjectByName('hand_r')!.getWorldPosition(new THREE.Vector3()).distanceTo(wrist)).toBeGreaterThan(.15);
      rig.sampleMotion(sample);
      expect(rig.getContactPosition()!.distanceTo(contact)).toBeLessThan(1e-6);
      rig.sampleMotion(sample);
      expect(rig.getContactPosition()!.distanceTo(contact)).toBeLessThan(1e-6);
    }
    rig.dispose();
  });
  it('hands a continuous serve toss to the outgoing ball without an extra contact ball', () => {
    const event = motionEvent(repetition('serve'));
    expect(sampleOpponentTimeline([event], event.contactTime - .00001)!.toss).not.toBeNull();
    const toss = sampleOpponentTimeline([event], event.contactTime - .00001)!.toss!;
    expect(Math.hypot(toss.x - event.source.x, toss.y - event.source.y, toss.z - event.source.z)).toBeLessThan(.001);
    expect(sampleOpponentTimeline([event], event.contactTime)!.toss).toBeNull();
  });
  it('moves laterally and in depth without root teleportation or exceeding the travel speed', async () => {
    const a = repetition('forehand'), b = repetition('backhand', 1, -3, 8), c = repetition('serve', 2, 2, 13);
    const events = [a, b, c].map(motionEvent), rig = await loadRig();
    let previous = sampleOpponentTimeline(events, 0)!;
    const clips = new Set<string>();
    for (let t = 1 / 120; t < events[2]!.end; t += 1 / 120) {
      const sample = sampleOpponentTimeline(events, t)!;
      expect(Math.hypot(sample.root.x - previous.root.x, sample.root.z - previous.root.z) * 120).toBeLessThanOrEqual(MAX_OPPONENT_SPEED + .01);
      sample.layers.forEach(layer => clips.add(layer.clip));
      if (sample.footTargets && sample.layers[1]!.weight > .999) {
        rig.sampleMotion(sample);
        for (const [side, target] of Object.entries(sample.footTargets)) {
          const actual = rig.group.getObjectByName(`foot_${side === 'left' ? 'l' : 'r'}`)!.getWorldPosition(new THREE.Vector3());
          expect(actual.distanceTo(new THREE.Vector3(target.x, target.y, target.z))).toBeLessThan(.015);
        }
      }
      previous = sample;
    }
    expect(clips.has('forehand') && clips.has('backhand') && clips.has('serve')).toBe(true);
    expect([...clips].some(clip => clip.startsWith('move-'))).toBe(true);
    rig.dispose();
  });
  it('extends impossible cadence while preserving complete strokes, rest duration and the last ball flight', () => {
    const session = compileSession(DRILLS[0]!, { repetitions: 6, interval: .5, variationPercent: 0, timingVariationPercent: 0,
      launchSpeedKmh: 78, surface: 'hard', seed: 'motion', spin: 'preset', opponentHand: 'right', workBlockSize: 3, restSeconds: 20, serveRhythm: 'preset' });
    expect(session.motionTimingAdjusted).toBe(true);
    for (let i = 1; i < session.repetitions.length; i++) {
      const a = session.repetitions[i - 1]!, b = session.repetitions[i]!;
      expect(b.startTime - a.startTime).toBeGreaterThanOrEqual(minimumMotionGap(a, b) - 1e-8);
    }
    expect(session.restPeriods[0]!.endTime - session.restPeriods[0]!.startTime).toBe(20);
    const last = session.repetitions.at(-1)!;
    expect(session.duration).toBeGreaterThanOrEqual(last.startTime + last.trajectory.samples.at(-1)!.time);
  });
  it('finishes travel then holds ready during a long rest, with a split-step before preparation', () => {
    const a = motionEvent(repetition('forehand')), b = motionEvent({ ...repetition('backhand', 1, -2), startTime: 30 });
    const waiting = sampleOpponentTimeline([a, b], 20)!;
    expect(waiting.root).toEqual(b.root);
    expect(waiting.layers[0]!.clip).toBe('ready');
    expect(sampleOpponentTimeline([a, b], b.start - .3)!.layers[0]!.clip).toBe('split-step');
  });
});
