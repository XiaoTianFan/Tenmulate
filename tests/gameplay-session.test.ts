import { describe, expect, it } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { MAX_OPPONENT_SPEED, planRecovery } from '../src/engine/session/opponentMovement';
import { assessReachability, movementReach } from '../src/engine/session/playerCoverage';

const settings: SessionSettings = { repetitions: 3, rhythmPercent: 100, variationPercent: 0, timingVariationPercent: 0,
  launchSpeedKmh: 70, surface: 'hard', seed: 'gameplay', spin: 'preset', opponentHand: 'right', workBlockSize: 50,
  restSeconds: 0, serveRhythm: 'preset', camera: {lateral:0,behindBaseline:1.5} };

describe('mode-aware gameplay planning', () => {
  it.each(['right','left'] as const)('returns quick practice to its selected home with continuous motion (%s)', opponentHand => {
    const session=compileSession(DRILLS[0]!,{...settings,opponentHand,practiceShotType:'groundstroke',opponentPosition:{x:2,z:9},rhythmPercent:150});
    const events=session.repetitions.map(motionEvent);
    for(let i=0;i<events.length-1;i++){
      const plan=planRecovery(events[i]!,events[i+1]!);
      expect(plan.kind).toBe('recovery');expect(plan.center).toEqual({x:2,y:0,z:9.45});
      expect(plan.end).toBeCloseTo(events[i+1]!.start,6);
    }
    let previous=sampleOpponentTimeline(events,0)!;
    for(let t=1/120;t<session.duration;t+=1/120){
      const current=sampleOpponentTimeline(events,t)!;
      expect(Math.hypot(current.root.x-previous.root.x,current.root.z-previous.root.z)*120).toBeLessThan(MAX_OPPONENT_SPEED+.02);
      previous=current;
    }
    expect(previous.root).toEqual(events[0]!.home);
    expect(session.repetitions.every(r=>!r.rallyReturn)).toBe(true);
  });
  it('chooses recovery at low rhythm and direct movement for fast wide drills',()=>{
    const drill={...DRILLS[0]!,events:[{id:'a',shotId:'fh-cross-deep',opponentPosition:{x:3.7,z:12.8}},
      {id:'b',shotId:'bh-cross-deep',opponentPosition:{x:-3.7,z:12.8}}]};
    const slow=compileSession(drill,{...settings,rhythmPercent:60});
    const fast=compileSession(drill,{...settings,rhythmPercent:150});
    expect(slow.repetitions[0]!.recoveryPolicy).toBe('recover');
    expect(fast.repetitions[0]!.recoveryPolicy).toBe('direct');
    expect(fast.repetitions[1]!.startTime).toBeLessThan(slow.repetitions[1]!.startTime);
    expect(fast.repetitions[0]!.trajectory).toEqual(slow.repetitions[0]!.trajectory);
  });
  it('links a reachable rally with the next actual racket contact',()=>{
    const session=compileSession(DRILLS[0]!,settings);
    const linked=session.repetitions.filter(r=>r.rallyReturn);
    expect(linked.length).toBeGreaterThan(0);
    for(const rep of linked){
      const rally=rep.rallyReturn!,next=session.repetitions[rep.index+1]!;
      expect(rep.startTime+rally.contactTime+rally.duration).toBeCloseTo(next.startTime,8);
      expect(rally.contactErrorM).toBeLessThan(.07);
      expect(rally.speedRatio).toBeGreaterThanOrEqual(.65);expect(rally.speedRatio).toBeLessThanOrEqual(1.35);
      expect(rally.trajectory.events.some(e=>e.type==='second-bounce')).toBe(false);
      expect(rally.trajectory.samples[0]!.position).toEqual(rep.trajectory.samples.find(s=>s.time===rally.contactTime)!.position);
    }
  });
  it('records unreachable feeds and respects rest and serve boundaries',()=>{
    const session=compileSession(DRILLS[0]!,{...settings,workBlockSize:1,restSeconds:10});
    expect(session.repetitions.every(r=>!r.rallyReturn)).toBe(true);
    for(const rest of session.restPeriods){
      expect(rest.endTime-rest.startTime).toBeCloseTo(10,8);
      expect(motionEvent(session.repetitions[rest.afterIndex+1]!).start).toBeGreaterThanOrEqual(rest.endTime-1e-8);
    }
    const trajectory=session.repetitions[0]!.trajectory;
    expect(assessReachability(trajectory,{x:40,z:-13}).reachable).toBe(false);
    expect(movementReach(.1)).toBe(0);
    expect(movementReach(1)).toBeLessThan(movementReach(2));
  });
});
