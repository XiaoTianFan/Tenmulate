import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHOTS, DRILLS } from '../src/content/bundled';
import { OpponentRig } from '../src/engine/rendering/OpponentRig';
import { compileSession } from '../src/engine/session/compileSession';
import { motionEvent, minimumMotionGap, sampleOpponentTimeline, strokeForShot, OPPONENT_MOTION, MAX_OPPONENT_SPEED, type MotionRepetition, type StrokeId } from '../src/engine/session/opponentTimeline';

const repetition = (clip: StrokeId, index = 0, x = 0, z = 12.5, hand: 'left' | 'right' = 'right'): MotionRepetition => ({
  index, startTime: 3 + index * 8, shot: { ...SHOTS[0]!, family: clip === 'serve' ? 'serve' : 'groundstroke',
    stroke: clip === 'serve' ? undefined : clip.startsWith('backhand') ? 'backhand' : 'forehand', spin: clip.endsWith('slice') ? 'slice' : 'topspin', opponentHand: hand, serveRhythm: 'normal',
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
  it.each(['forehand', 'backhand', 'forehand-slice', 'backhand-slice', 'serve'] as const)('%s hits the exact launch point for either hand and reproduces arbitrary seeks', async clip => {
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
    expect(clips.has('run-forward')).toBe(true);
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
  it('keeps the baked racket orientation continuous through the drop, strike and recovery',async()=>{
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const mixer=new THREE.AnimationMixer(gltf.scene),racket=gltf.scene.getObjectByName('TennisRacket')!;
    for(const clip of gltf.animations){
      mixer.stopAllAction();const action=mixer.clipAction(clip).play();action.paused=true;
      let previous:THREE.Quaternion|undefined;
      for(let frame=0;frame<=Math.round(clip.duration*60);frame++){
        action.time=Math.min(frame/60,clip.duration);mixer.update(0);gltf.scene.updateMatrixWorld(true);
        const rotation=racket.getWorldQuaternion(new THREE.Quaternion());
        if(previous)expect(rotation.angleTo(previous),`${clip.name} at ${frame/60}`).toBeLessThan(THREE.MathUtils.degToRad(40));
        previous=rotation;
      }
    }
  });
  it.each(['forehand','backhand','forehand-slice','backhand-slice','serve'] as const)('%s visibly coils the exported shoulder line and changes the real grip bevel', async clip => {
    const rig=await loadRig(),event=motionEvent(repetition(clip)),metadata=OPPONENT_MOTION.clips[clip];
    const point=(name:string)=>rig.group.worldToLocal(rig.group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()));
    const chest=()=>{const v=point('upperarm_r').sub(point('upperarm_l'));return Math.atan2(v.z,-v.x);};
    // Several preparation frames, not one peak or a recipe/metadata claim.
    for(const fraction of [.55,.65,.75]){
      rig.sampleMotion(sampleOpponentTimeline([event],event.start+metadata.contact*fraction)!);
      expect(Math.abs(chest())).toBeGreaterThan(1.15);
    }
    for(const fraction of [.7,1,1.12]){
      rig.sampleMotion(sampleOpponentTimeline([event],event.start+metadata.contact*fraction)!);
      const racket=rig.group.getObjectByName('TennisRacket')!;
      const knuckle=racket.worldToLocal(rig.group.getObjectByName('index_01_r')!.getWorldPosition(new THREE.Vector3()));
      const bevel=1+Math.atan2(-knuckle.z,knuckle.x)/(Math.PI/4);
      expect(bevel).toBeCloseTo(clip==='forehand'?4:2,2);
      expect(Math.hypot(knuckle.x,knuckle.z)).toBeGreaterThan(.018);
      expect(Math.hypot(knuckle.x,knuckle.z)).toBeLessThan(.031);
    }
    rig.sampleMotion(sampleOpponentTimeline([event],event.start)!);
    expect(Math.abs(chest())).toBeLessThan(.01);
    rig.sampleMotion(sampleOpponentTimeline([event],event.end)!);
    expect(Math.abs(chest())).toBeLessThan(.01);
    rig.dispose();
  });
  it('selects both slices through compiled spin controls while a slice serve stays a serve',()=>{
    const base=repetition('forehand').shot;
    expect(strokeForShot({...base,spin:'slice',stroke:'forehand'},0)).toBe('forehand-slice');
    expect(strokeForShot({...base,spin:'slice',stroke:'backhand'},0)).toBe('backhand-slice');
    expect(strokeForShot({...base,spin:'slice',family:'serve'},0)).toBe('serve');
    const session=compileSession(DRILLS[0]!,{repetitions:4,interval:4,variationPercent:0,timingVariationPercent:0,launchSpeedKmh:78,surface:'hard',seed:'slices',spin:'slice',opponentHand:'right',workBlockSize:4,restSeconds:0,serveRhythm:'preset'});
    expect(session.repetitions.every(rep=>motionEvent(rep).clip.endsWith('-slice'))).toBe(true);
  });
  it('keeps the supporting backhand hand above the dominant hand on the handle',async()=>{
    const rig=await loadRig(),event=motionEvent(repetition('backhand'));
    for(const time of [.65,.8,1.033333,1.2,1.4]){
      rig.sampleMotion(sampleOpponentTimeline([event],event.start+time)!);
      const racket=rig.group.getObjectByName('TennisRacket')!;
      const knuckle=racket.worldToLocal(rig.group.getObjectByName('index_01_l')!.getWorldPosition(new THREE.Vector3()));
      expect(1+Math.atan2(-knuckle.z,knuckle.x)/(Math.PI/4)).toBeCloseTo(3,1);
      expect(Math.hypot(knuckle.x,knuckle.z)).toBeGreaterThan(.018);
      expect(Math.hypot(knuckle.x,knuckle.z)).toBeLessThan(.031);
      expect(knuckle.y).toBeGreaterThan(.12);
      expect(knuckle.y).toBeLessThan(.15);
    }
    rig.dispose();
  });
  it.each(['forehand-slice','backhand-slice'] as const)('%s carries the racket high to level and forward through contact',async clip=>{
    const rig=await loadRig(),event=motionEvent(repetition(clip));
    const sampleAt=(offset:number)=>{rig.sampleMotion(sampleOpponentTimeline([event],event.contactTime+offset)!);return rig.group.worldToLocal(rig.getContactPosition()!.clone());};
    const load=sampleAt(-.4),contact=sampleAt(0),finish=sampleAt(.25);
    expect(load.y-contact.y).toBeGreaterThan(.3);
    expect(contact.z-load.z).toBeGreaterThan(.25);
    expect(finish.z-contact.z).toBeGreaterThan(.08);
    expect(Math.abs(finish.y-contact.y)).toBeLessThan(.16);
    const support=rig.group.getObjectByName('hand_l')!.getWorldPosition(new THREE.Vector3());
    expect(support.distanceTo(rig.getRacketSocket('right')!.getWorldPosition(new THREE.Vector3()))).toBeGreaterThan(.3);
    rig.dispose();
  });
  it.each([[3.5,12.5,-3.5,12.5],[-3.5,12.5,3.5,12.5],[0,13,0,6.5],[0,6.5,0,13],[-3.5,13,3.5,6.5]])('runs a full route %j with large strides, travel-facing shoulders and stable seeks',async(ax,az,bx,bz)=>{
    const events=[motionEvent(repetition('forehand',0,ax,az)),motionEvent(repetition('forehand',1,bx,bz))],rig=await loadRig();
    const heading=Math.atan2(events[1]!.root.x-events[0]!.root.x,events[1]!.root.z-events[0]!.root.z);
    const samples=[];
    for(let time=events[0]!.end+.01;time<events[1]!.start;time+=1/60){
      const pose=sampleOpponentTimeline(events,time)!;
      if(pose.layers.some(l=>l.clip==='run-forward'&&l.weight>.999))samples.push({time,pose});
    }
    expect(samples.length).toBeGreaterThan(25);
    const middle=samples[Math.floor(samples.length*.5)]!;
    expect(Math.abs(Math.atan2(Math.sin(middle.pose.yaw-heading),Math.cos(middle.pose.yaw-heading)))).toBeLessThan(.12);
    rig.sampleMotion(middle.pose);
    const shoulder=rig.group.getObjectByName('upperarm_r')!.getWorldPosition(new THREE.Vector3()).sub(rig.group.getObjectByName('upperarm_l')!.getWorldPosition(new THREE.Vector3()));
    const facing=new THREE.Vector3(shoulder.z,0,-shoulder.x).normalize();
    expect(facing.dot(new THREE.Vector3(Math.sin(heading),0,Math.cos(heading)))).toBeGreaterThan(.96);
    const next=sampleOpponentTimeline(events,middle.time+.58)!;
    expect(Math.hypot(next.footTargets!.left.x-middle.pose.footTargets!.left.x,next.footTargets!.left.z-middle.pose.footTargets!.left.z)).toBeGreaterThan(1.25);
    const before=rig.group.getObjectByName('Head')!.matrixWorld.clone();
    rig.sampleMotion(middle.pose);expect(rig.group.getObjectByName('Head')!.matrixWorld.elements).toEqual(before.elements);
    rig.sampleMotion(sampleOpponentTimeline(events,events[1]!.contactTime)!);rig.sampleMotion(middle.pose);
    expect(rig.group.getObjectByName('Head')!.matrixWorld.elements.every((v,i)=>Math.abs(v-before.elements[i]!)<1e-6)).toBe(true);
    rig.dispose();
  });
});
