import { describe, expect, it } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { DEFAULT_DRILL_CAMERA as base, cameraTravelSeconds, sampleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../src/domain/camera';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { DEFAULT_RETURN_LANDING_ZONE } from '../src/engine/session/returnLandingZone';
import { parseDrillJson, validateDrill } from '../src/content/validation';

const settings: SessionSettings = { repetitions:4,mode:'drill',shotIntervalSeconds:1,rhythmPercent:100,variationPercent:0,timingVariationPercent:0,
  launchSpeedKmh:70,surface:'hard',seed:'camera',spin:'preset',opponentHand:'right',workBlockSize:50,restSeconds:0,serveRhythm:'preset' };
const drill = {...DRILLS[0]!,shotIds:['fh-cross-deep','bh-cross-deep','fh-cross-deep','bh-cross-deep'],events:[
  {id:'a',shotId:'fh-cross-deep',camera:{...base,lateral:-2,yaw:8}},
  {id:'b',shotId:'bh-cross-deep',camera:{...base,lateral:2,behindBaseline:2,yaw:-12,pitch:-3}},
  {id:'c',shotId:'fh-cross-deep',cameraMotion:null},
  {id:'d',shotId:'bh-cross-deep',camera:{...base,behindBaseline:-6,yaw:0}},
]};

describe('continuous drill camera and return space',()=>{
  it('holds authored views through shots, carries unscripted views, and finishes travel before stroke preparation',()=>{
    const session=compileSession(drill,settings), stages=session.cameraTimeline.transitions;
    expect(stages).toHaveLength(2);
    expect(session.repetitions[2]!.camera).toEqual(session.repetitions[1]!.camera);
    for (const rep of session.repetitions) {
      expect(sampleCameraTimeline(session.cameraTimeline,rep.startTime)).toEqual(rep.camera);
      if(rep.reachability.contact) expect(sampleCameraTimeline(session.cameraTimeline,rep.startTime+rep.reachability.contact.time-.001)).toEqual(rep.camera);
    }
    for(const stage of stages){
      const next=session.repetitions.find(rep=>rep.startTime>stage.end)!;
      expect(stage.end).toBeLessThanOrEqual(motionEvent(next).start+1e-8);
      expect(stage.from).not.toEqual(base);
    }
  });
  it('bounds speed and acceleration, has no boundary jumps, and tracks the actual moving opponent between shots',()=>{
    const session=compileSession(drill,settings), events=session.repetitions.map(motionEvent),dt=1/240;
    const position=(t:number)=>{const motion=sampleOpponentTimeline(events,t);return sampleCameraTimeline(session.cameraTimeline,t,motion?.root);};
    let last=position(0),velocity={x:0,z:0},peak=0;
    for(let t=dt;t<session.duration;t+=dt){
      const pose=position(t),v={x:(pose.lateral-last.lateral)/dt,z:(pose.behindBaseline-last.behindBaseline)/dt};
      peak=Math.max(peak,Math.hypot(v.x,v.z));
      expect(Math.hypot(v.x,v.z)).toBeLessThanOrEqual(4.501);
      expect(Math.hypot(v.x-velocity.x,v.z-velocity.z)/dt).toBeLessThanOrEqual(5.501);
      expect(Math.abs(wrapCameraAngle(pose.yaw-last.yaw))).toBeLessThan(2);
      last=pose;velocity=v;
    }
    expect(peak).toBeGreaterThan(1);
    for(const stage of session.cameraTimeline.transitions){
      const t=(stage.start+stage.end)/2,motion=sampleOpponentTimeline(events,t)!;
      const pose=position(t),look=cameraLookAtCourtPoint(pose,{...motion.root,y:1.35});
      expect(pose.yaw).toBeCloseTo(look.yaw,8);expect(pose.pitch).toBeCloseTo(look.pitch,8);
      for(const boundary of [stage.start,stage.end]) expect(Math.abs(wrapCameraAngle(position(boundary+.00001).yaw-position(boundary-.00001).yaw))).toBeLessThan(.001);
    }
  });
  it('is deterministic when seeking, wraps yaw by the short path, and supports stationary reduced-motion playback',()=>{
    const from={...base,yaw:179},to={...base,yaw:-179},end=cameraTravelSeconds(from,to);
    const timeline={initial:from,transitions:[{start:1,end:1+end,from,to}]};
    expect(Math.abs(sampleCameraTimeline(timeline,1+end/2).yaw)).toBe(180);
    const session=compileSession(drill,{...settings,cameraMotionScale:0});
    expect(session.cameraTimeline.transitions).toEqual([]);
    for(const t of [100,0,10,3,2]) expect(sampleCameraTimeline(session.cameraTimeline,t)).toEqual(base);
  });
  it('returns from the incoming path into a court-space zone independent of the camera',()=>{
    const config={...settings,repetitions:3,shotIntervalSeconds:3.5,seed:'gameplay'};
    const session=compileSession(DRILLS[0]!,config);
    expect(session.repetitions.some(rep=>rep.rallyReturn)).toBe(true);
    const other=compileSession(DRILLS[0]!,{...config,camera:{...base,lateral:6,behindBaseline:-8,yaw:90},cameraMotionScale:0});
    expect(session.repetitions[0]!.trajectory).toEqual(other.repetitions[0]!.trajectory);
    for(const rep of session.repetitions){
      if(rep.rallyReturn){
        const rally=rep.rallyReturn, bounce=rally.trajectory.events.find(e=>e.type==='bounce')!;
        expect(bounce.position.x).toBeGreaterThanOrEqual(DEFAULT_RETURN_LANDING_ZONE.minX-.04);
        expect(bounce.position.x).toBeLessThanOrEqual(DEFAULT_RETURN_LANDING_ZONE.maxX+.04);
        expect(bounce.position.z).toBeGreaterThanOrEqual(DEFAULT_RETURN_LANDING_ZONE.minZ-.04);
        expect(bounce.position.z).toBeLessThanOrEqual(DEFAULT_RETURN_LANDING_ZONE.maxZ+.04);
        expect(rally.trajectory.samples[0]!.position).toEqual(rep.trajectory.samples.find(s=>s.time===rally.contactTime)!.position);
        expect(rally.trajectory.samples.at(-1)!.position).toEqual(session.repetitions[rep.index+1]!.shot.source);
      }
    }
  });
  it('keeps opponent tracking continuous when an authored view faces across the yaw wrap',()=>{
    for(const yaw of [-179,179,170,-170]){
      const from={...base,lateral:-2,yaw},to={...base,lateral:2,yaw},end=cameraTravelSeconds(from,to),timeline={initial:from,transitions:[{start:0,end,from,to}]};
      let previous=sampleCameraTimeline(timeline,0,{x:-3,y:0,z:12});
      for(let time=1/240;time<end;time+=1/240){
        const pose=sampleCameraTimeline(timeline,time,{x:-3+time/end*6,y:0,z:12});
        expect(Math.abs(wrapCameraAngle(pose.yaw-previous.yaw))).toBeLessThan(5);
        previous=pose;
      }
    }
  });
  it('round-trips complete shot settings and rejects malformed return zones and camera views',()=>{
    const event={...drill.events[0]!,label:'My shot',stroke:'backhand' as const,opponentHand:'left' as const,spinRateRpm:1400,bounceFactor:.8,trajectoryMode:'exact' as const,rhythmPercent:125,movementPercent:75,intervalSeconds:6};
    const custom={...drill,events:[event],shotIds:[event.shotId],returnZone:{forward:2,width:4,depth:1}};
    expect(parseDrillJson(JSON.stringify(custom))).toEqual(custom);
    const rep=compileSession(custom,{...settings,repetitions:1}).repetitions[0]!;
    expect(rep.shot).toMatchObject({label:'My shot',stroke:'backhand',opponentHand:'left'});
    expect(rep.motionRate).toBe(1.25);expect(rep.movementRate).toBe(.75);expect(rep.intervalSeconds).toBe(6);
    expect(rep.trajectory.intent).toMatchObject({bounceFactor:.8,spinRateRpm:1400,trajectoryMode:'exact'});
    for(const invalid of [{forward:Infinity,width:2,depth:1},{forward:1,width:-1,depth:1},{forward:1,width:2,depth:1,extra:0}]) expect(validateDrill({...custom,returnZone:invalid}).valid).toBe(false);
    for(const invalid of [{yaw:0},{...base,yaw:NaN},{...base,roll:0}]) expect(validateDrill({...custom,events:[{...event,camera:invalid}]}).valid).toBe(false);
  });
});
