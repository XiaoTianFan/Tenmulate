import { describe, it, expect } from 'vitest';
import { SHOTS } from '../src/content/bundled';
import { motionEvent, minimumMotionGap, sampleOpponentTimeline, OPPONENT_MOTION } from '../src/engine/session/opponentTimeline';
import { planRecovery, recoveryCenter, sampleTravel, sampleMovementDrill, MOVEMENT_DRILLS, MAX_OPPONENT_SPEED, MAX_TRAVEL_ACCELERATION, travelDuration } from '../src/engine/session/opponentMovement';

const rep=(x:number,index=0,hand:'left'|'right'='right',z=12.8)=>({index,startTime:3+index*10,shot:{...SHOTS[0]!,family:'groundstroke' as const,stroke:(x>0?'forehand':'backhand') as 'forehand'|'backhand',opponentHand:hand,source:{x,y:1.1,z},target:{x:0,z:-9}}});
describe('court recovery and distance-driven footwork',()=>{
  it.each(['right','left'] as const)('recovers wide shots, splits at center and launches to same or opposite side (%s)',hand=>{
    for(const nextX of [3.5,-3.5]){
      const a=rep(hand==='right'?3.5:-3.5,0,hand),b=rep(nextX,1,hand);
      b.startTime=a.startTime+minimumMotionGap(a,b);
      const events=[motionEvent(a),motionEvent(b)],plan=planRecovery(events[0]!,events[1]!);
      expect(plan.center.x).toBe(hand==='right'?.55:-.55);expect(plan.center.z).toBeGreaterThan(12);
      expect(plan.recover.crossover).toBe(true);
      const split=sampleOpponentTimeline(events,plan.splitStart+.3)!;
      expect(split.root).toEqual(plan.center);expect(split.layers[0]!.clip).toBe('split-step');
      const approach=sampleOpponentTimeline(events,(plan.approach!.start+plan.approach!.end)/2)!;
      expect(approach.movement!.stage).toBe('approach');
      expect(Math.sign(approach.root.x-plan.center.x)).toBe(Math.sign(events[1]!.root.x-plan.center.x));
      expect(plan.end).toBeCloseTo(events[1]!.start,7);
    }
  });
  it('recovers the final shot and keeps net recovery near the net',()=>{
    const event=motionEvent(rep(3));const last=sampleOpponentTimeline([event],planRecovery(event).end+.1)!;
    expect(last.root).toEqual(recoveryCenter(event));
    expect(recoveryCenter(motionEvent(rep(2,0,'right',4))).z).toBeLessThan(6);
  });
  it.each([.5,1.5,4,8,12])('bounds speed and acceleration for a %s m leg',d=>{
    const from={x:0,y:0,z:13},to={x:d,y:0,z:13},duration=travelDuration(from,to);
    const leg={from,to,start:0,end:duration,fromYaw:Math.PI,toYaw:Math.PI,stage:'approach' as const};
    let previous=sampleTravel(leg,0,'right'),lastSpeed=0;
    for(let t=1/240;t<=duration;t+=1/240){
      const s=sampleTravel(leg,t,'right'),speed=s.movement!.speed;
      expect(Math.hypot(s.root.x-previous.root.x,s.root.z-previous.root.z)*240).toBeLessThanOrEqual(MAX_OPPONENT_SPEED+.001);
      expect(Math.abs(speed-lastSpeed)*240).toBeLessThanOrEqual(MAX_TRAVEL_ACCELERATION+.001);
      previous=s;lastSpeed=speed;
    }
  });
  it('changes cadence with distance covered, keeps stance feet fixed and lowers forward recovery',()=>{
    const from={x:0,y:0,z:13},to={x:0,y:0,z:5},duration=travelDuration(from,to);
    const leg={from,to,start:0,end:duration,fromYaw:Math.PI,toYaw:Math.PI,stage:'approach' as const};
    let plantedPairs=0;
    for(let t=.3;t<duration-.3;t+=1/240){
      const a=sampleTravel(leg,t,'right'),b=sampleTravel(leg,t+1/240,'right');
      expect(a.movement!.phase*2.15).toBeCloseTo(a.movement!.distance,8);
      for(const side of ['left','right'] as const){
        const x=a.footTargets![side],y=b.footTargets![side];
        const plantedHeight=.087*OPPONENT_MOTION.scale+OPPONENT_MOTION.floorOffset;
        expect(x.y-plantedHeight).toBeLessThan(.205);
        if(Math.abs(x.y-y.y)<1e-8&&x.y<plantedHeight+.02){expect(Math.hypot(x.x-y.x,x.z-y.z)).toBeLessThan(.00001);plantedPairs++;}
      }
    }
    expect(plantedPairs).toBeGreaterThan(100);
  });
  it('exposes every requested movement and reproduces backwards seeks at three walking paces',()=>{
    expect(MOVEMENT_DRILLS.length).toBe(19);
    for(let i=0;i<MOVEMENT_DRILLS.length;i++)for(const hand of ['right','left'] as const){
      const a=sampleMovementDrill(i,.8,hand);sampleMovementDrill(i,6,hand);
      expect(sampleMovementDrill(i,.8,hand)).toEqual(a);
      expect(a.layers.reduce((n,l)=>n+l.weight,0)).toBeCloseTo(1,8);
    }
    const speeds=[0,1,2].map(i=>Math.max(...Array.from({length:120},(_,j)=>sampleMovementDrill(i,j/30).movement!.speed)));
    expect(speeds[0]).toBeLessThan(speeds[1]!);expect(speeds[1]).toBeLessThan(speeds[2]!);
  });
});
