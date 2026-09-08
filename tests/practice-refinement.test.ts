import { describe, expect, it } from 'vitest';
import { resolveTrajectory } from '../src/engine/trajectory/physics';
import { practiceLandingTarget } from '../src/engine/trajectory/practiceProfiles';
import { DRILLS } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { planRecovery, sampleTravel, travelDuration, MAX_TRAVEL_ACCELERATION } from '../src/engine/session/opponentMovement';

const settings: SessionSettings = {repetitions:3,mode:'quick-practice',practiceShotType:'groundstroke',
  practiceStroke:'alternate',opponentPosition:{x:0,z:12.885},shotIntervalSeconds:8,rhythmPercent:100,
  movementPercent:80,trajectoryMode:'natural',variationPercent:0,timingVariationPercent:0,launchSpeedKmh:70,
  spin:'topspin',spinRateRpm:1103,landingDepthM:8.5,aimDirectionDeg:0,surface:'hard',seed:'refinement',
  opponentHand:'right',serveRhythm:'normal',workBlockSize:50,restSeconds:0};

describe('recovery-centered practice and independent clocks',()=>{
  it.each(['right','left'] as const)('steps the body to each side, moving contact while retaining the landing target (%s)',opponentHand=>{
    for(const practiceShotType of ['groundstroke','volley','overhead'] as const){
      const session=compileSession(DRILLS[0]!,{...settings,practiceShotType,opponentHand});
      const [a,b]=session.repetitions.map(motionEvent);
      expect(a!.home).toEqual({x:0,y:0,z:12.885});
      expect(a!.root.x*b!.root.x).toBeLessThan(0);
      expect(Math.abs(a!.root.x)).toBeCloseTo(.7,5);
      expect(Math.abs(b!.root.x)).toBeCloseTo(.8,5);
      expect(Math.abs(a!.source.x-b!.source.x)).toBeGreaterThan(1);
      expect(session.repetitions[0]!.shot.target).toEqual(session.repetitions[1]!.shot.target);
      expect(sampleOpponentTimeline(session.repetitions.map(motionEvent),session.duration)!.root).toEqual(a!.home);
    }
    const serve=compileSession(DRILLS[0]!,{...settings,practiceShotType:'serve',opponentHand});
    for(const event of serve.repetitions.map(motionEvent))expect(event.root.x).toBeCloseTo(0,5);
  });
  it('keeps stroke rate independent of interval and accelerates travel to meet a tight gap',()=>{
    const slow=compileSession(DRILLS[0]!,{...settings,rhythmPercent:70,movementPercent:50,shotIntervalSeconds:12});
    const fast=compileSession(DRILLS[0]!,{...settings,rhythmPercent:70,movementPercent:50,shotIntervalSeconds:4});
    const plan=(session:ReturnType<typeof compileSession>)=>planRecovery(motionEvent(session.repetitions[0]!),motionEvent(session.repetitions[1]!));
    const slowPlan=plan(slow),fastPlan=plan(fast);
    expect(fast.repetitions[0]!.motionRate).toBe(slow.repetitions[0]!.motionRate);
    expect(fast.repetitions[0]!.trajectory).toEqual(slow.repetitions[0]!.trajectory);
    expect(fastPlan.recover.end-fastPlan.recover.start).toBeLessThan(slowPlan.recover.end-slowPlan.recover.start);
    const quickStroke=compileSession(DRILLS[0]!,{...settings,rhythmPercent:150,shotIntervalSeconds:12});
    expect(quickStroke.repetitions[1]!.startTime-quickStroke.repetitions[0]!.startTime).toBeCloseTo(12,6);
    expect(motionEvent(quickStroke.repetitions[0]!).rate).toBe(1.5);
    expect(motionEvent(slow.repetitions[0]!).rate).toBe(.7);
  });
  it('expresses push-off and braking in velocity and body lean, with deterministic seeks',()=>{
    const from={x:0,y:0,z:13},to={x:0,y:0,z:5},duration=travelDuration(from,to);
    const leg={from,to,start:0,end:duration,fromYaw:Math.PI,toYaw:Math.PI,stage:'approach' as const};
    const start=sampleTravel(leg,0,'right'),push=sampleTravel(leg,duration*.13,'right');
    const cruise=sampleTravel(leg,duration*.5,'right'),brake=sampleTravel(leg,duration*.83,'right'),end=sampleTravel(leg,duration,'right');
    expect(start.movement!.speed).toBe(0);expect(end.movement!.speed).toBeLessThan(1e-8);
    expect(push.movement!.acceleration).toBeGreaterThan(0);expect(brake.movement!.acceleration).toBeLessThan(0);
    expect(push.travelLean).toBeGreaterThan(0);expect(brake.travelLean).toBeLessThan(0);
    expect(cruise.movement!.speed).toBeGreaterThan(push.movement!.speed);
    expect(push.movement!.acceleration).toBeLessThanOrEqual(MAX_TRAVEL_ACCELERATION+.001);
    expect(sampleTravel(leg,duration*.13,'right')).toEqual(push);
  });
});

describe('natural practice trajectory', () => {
  it('keeps a continuous low arc across the reported small heading changes', () => {
    const source={x:0,y:1.15,z:12.885};
    let previous=0;
    for(let direction=-10;direction<=10;direction+=.5){
      const result=resolveTrajectory({source,target:practiceLandingTarget(source,direction,8.5),
        aimDirectionDeg:direction,launchSpeedKmh:70,spin:'topspin',spinRateRpm:1103,
        surface:'hard',shotType:'groundstroke',trajectoryMode:'natural'});
      expect(result.apexHeight).toBeLessThan(4);
      expect(result.solution?.targetErrorM).toBeLessThan(.18);
      expect(result.solution?.status).not.toBe('unreachable');
      if(previous)expect(Math.abs(result.resolved.launchAngleDeg-previous)).toBeLessThan(3);
      previous=result.resolved.launchAngleDeg;
      expect(result.resolved.launchSpeedKmh).toBeGreaterThanOrEqual(70*.85-.001);
      expect(result.resolved.launchSpeedKmh).toBeLessThanOrEqual(70*1.15+.001);
    }
  });

  it('does not substitute a high lob when a low-power deep request cannot be met', () => {
    const result=resolveTrajectory({source:{x:0,y:1.15,z:17},target:{x:0,z:-11},
      aimDirectionDeg:0,launchSpeedKmh:35,spin:'topspin',spinRateRpm:3000,
      surface:'hard',trajectoryMode:'natural'});
    expect(result.solution?.status).toBe('unreachable');
    expect(result.resolved.launchSpeedKmh).toBeLessThanOrEqual(35*1.15+.001);
  });
});
