import { defaultReturnShot } from '../src/engine/session/returnShot';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OpponentRig} from '../src/engine/rendering/OpponentRig';
import {motionClip,motionEvent,withPreparedApproach,sampleOpponentTimeline,OPPONENT_MOTION,type StrokeId} from '../src/engine/session/opponentTimeline';
import {planRecovery,sampleTravel,type TravelLeg} from '../src/engine/session/opponentMovement';
import {compileSession} from '../src/engine/session/compileSession';
import {SHOTS,DRILLS} from '../src/content/bundled';

const bytes=await readFile(new URL(`../public${OPPONENT_MOTION.url}`,import.meta.url));
const loadRig=async()=>{const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue(model);const rig=new OpponentRig();await rig.load();return rig;};
afterEach(()=>vi.restoreAllMocks());
const rep=(clip:StrokeId,hand:'left'|'right',rate=1)=>({index:0,startTime:5,motionRate:rate,preparedApproach:true,
  home:{x:0,y:0,z:13},shot:{...SHOTS[0]!,family:clip.endsWith('volley')?'volley' as const:'groundstroke' as const,
    stroke:clip.startsWith('backhand')?'backhand' as const:'forehand' as const,spin:clip.endsWith('slice')?'slice' as const:'topspin' as const,
    opponentHand:hand,source:{x:(clip.startsWith('backhand')?-3:3)*(hand==='left'?-1:1),y:clip==='forehand-slice'?.98:1.1,z:12.8},target:{x:0,z:-8}}});
const clips=['forehand','backhand','forehand-slice','backhand-slice','forehand-volley','backhand-volley'] as const;
describe('prepared stroke entries after travel',()=>{
 it.each(clips)('%s stays turned through arrival and preserves the hit in both hands',async clip=>{
  const rig=await loadRig();
  const point=(name:string)=>rig.group.getObjectByName(name)!.getWorldPosition(new T.Vector3());
  for(const hand of ['right','left'] as const)for(const rate of [.5,1,1.5,2.25,3]){
   const repetition=rep(clip,hand,rate),event=motionEvent(repetition),entry=motionClip(clip).preparedEntry!;
   expect(entry).toBeDefined();expect(event.contactTime-event.start).toBeCloseTo((motionClip(clip).contact!-entry.time)/rate,8);
   const coil=()=>{const line=point('upperarm_r').sub(point('upperarm_l')).applyAxisAngle(new T.Vector3(0,1,0),-event.yaw);line.x*=hand==='left'?-1:1;return Math.abs(Math.atan2(line.z,-line.x));};
   for(const offset of [-.15,-.05,0,.015]){
    const sample=sampleOpponentTimeline([event],event.start+offset/rate)!;rig.sampleMotion(sample);
    if(offset>=-.05)expect(coil(),`${clip} ${hand} at ${offset}`).toBeGreaterThan(.65);
    const layer=sample.layers.find(l=>l.clip===clip)!;
    expect(layer.time).toBeCloseTo(entry.time+offset,7);
    expect(layer.weight).toBeGreaterThan(0);
   }
   rig.sampleMotion(sampleOpponentTimeline([event],event.start-1e-5)!);const before=['pelvis','hand_l','hand_r','foot_l','foot_r'].map(point);
   rig.sampleMotion(sampleOpponentTimeline([event],event.start+1e-5)!);before.forEach((p,i)=>expect(p.distanceTo(point(['pelvis','hand_l','hand_r','foot_l','foot_r'][i]!))).toBeLessThan(.001));
   const hit=sampleOpponentTimeline([event],event.contactTime)!;rig.sampleMotion(hit);const contact=rig.getContactPosition()!.clone();
   expect(contact.distanceTo(new T.Vector3(event.source.x,event.source.y,event.source.z))).toBeLessThan(.002);
   // The rejected arrival held this exact racket pose for .18 seconds. Measure
   // body-relative racket travel to exclude root translation as a false pass.
   const racket=(offset:number)=>{const sample=sampleOpponentTimeline([event],event.start+offset/rate)!;rig.sampleMotion(sample);
    return rig.getContactPosition()!.clone().sub(new T.Vector3(sample.root.x,sample.root.y,sample.root.z)).applyAxisAngle(new T.Vector3(0,1,0),-sample.yaw);};
   expect(racket(-.08).distanceTo(racket(-.04)),`${clip} moving preparation`).toBeGreaterThan(.001);
   rig.sampleMotion(sampleOpponentTimeline([event],event.start-.2)!);rig.sampleMotion(hit);expect(rig.getContactPosition()!.distanceTo(contact)).toBeLessThan(1e-7);
   // The former full-ready entry reproduces and rejects the reported net-facing reset.
   const legacy=motionEvent({...repetition,preparedApproach:false});rig.sampleMotion(sampleOpponentTimeline([legacy],legacy.start)!);expect(coil()).toBeLessThan(.2);
  }
  rig.dispose();
 });
 it('uses a full preparation without an incoming leg, including serves',()=>{
  const standalone={...rep('forehand','right'),home:undefined};expect(withPreparedApproach(null,standalone).preparedApproach).toBe(false);
  const serve={...standalone,shot:{...standalone.shot,family:'serve' as const}};expect(withPreparedApproach(null,serve).preparedApproach).toBe(false);
 });
 it('blends slide braking into the prepared pose without a ready-pose endpoint',()=>{
  const event=motionEvent(rep('backhand','right'));
  for(const clip of ['slide-left','slide-right','slide-forward'] as const){
   const leg:TravelLeg={from:{x:0,y:0,z:13},to:event.root,start:0,end:2,fromYaw:Math.PI,toYaw:event.yaw,stage:'approach',clip,arrival:event};
   const before=sampleTravel(leg,1.75,'right'),end=sampleTravel(leg,2,'right');
   expect(before.layers.some(l=>l.clip===clip&&l.weight>0)).toBe(true);expect(before.layers.some(l=>l.clip===event.clip&&l.weight>0)).toBe(true);
   expect(end.layers.filter(l=>l.weight>0)).toEqual([{clip:event.clip,time:event.entryTime,weight:1}]);
  }
 });
 it('completes the same preparation when a reserved approach becomes a turn in place',()=>{
  const event=motionEvent(rep('forehand','right'));
  const leg:TravelLeg={from:event.root,to:event.root,start:0,end:1,fromYaw:Math.PI,toYaw:event.yaw,stage:'approach',arrival:event};
  expect(sampleTravel(leg,0,'right').layers.find(l=>l.clip===event.clip)?.weight).toBe(0);
  expect(sampleTravel(leg,.5,'right').layers.find(l=>l.clip===event.clip)?.weight).toBeCloseTo(.5);
  expect(sampleTravel(leg,1,'right').layers.filter(l=>l.weight>0)).toEqual([{clip:event.clip,time:event.entryTime,weight:1}]);
 });
 it.each(['quick-practice','drill'] as const)('the %s compiler reserves and plays the same prepared approach',mode=>{
  const session=compileSession(DRILLS[0]!,{mode,...(mode==='quick-practice'?{practiceShotType:'groundstroke' as const,rally:{landingZone:DEFAULT_RETURN_LANDING_ZONE,shot:defaultReturnShot('groundstroke')}}:{}),repetitions:3,shotIntervalSeconds:4,rhythmPercent:100,movementPercent:100,
   variationPercent:0,timingVariationPercent:0,launchSpeedKmh:70,surface:'hard',seed:'prepared',spin:'topspin',opponentHand:'right',workBlockSize:3,restSeconds:0,serveRhythm:'normal'});
  const events=session.repetitions.map(motionEvent);expect(events.some(e=>(e.entryTime??0)>0)).toBe(true);
  for(let i=1;i<events.length;i++){const plan=planRecovery(events[i-1]!,events[i]!);expect(plan.end).toBeLessThanOrEqual(events[i]!.start+1e-6);}
 });
 it('prepares a repeated same-position drill shot after its full recovery route',()=>{
  const drill={...DRILLS[0]!,events:[0,1].map(i=>({id:`same-${i}`,shotId:SHOTS[0]!.id,opponentPosition:{x:3,z:12.5}}))};
  const session=compileSession(drill,{mode:'drill',repetitions:2,shotIntervalSeconds:12,rhythmPercent:100,movementPercent:100,
   landingZone:{width:0.2,depth:0.2},variationPercent:0,timingVariationPercent:0,launchSpeedKmh:70,surface:'hard',seed:'same-point',spin:'topspin',opponentHand:'right',workBlockSize:1,restSeconds:8,serveRhythm:'normal'});
  const [previous,next]=session.repetitions.map(motionEvent);const plan=planRecovery(previous!,next!);
  expect(plan.kind).toBe('recovery');expect(next!.entryTime).toBeGreaterThan(0);
  expect(plan.approach!.arrival?.entryTime).toBe(next!.entryTime);
 });
});
