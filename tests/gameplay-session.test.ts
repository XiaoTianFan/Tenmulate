import { describe, expect, it } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { motionEvent, sampleOpponentTimeline } from '../src/engine/session/opponentTimeline';
import { MAX_OPPONENT_SPEED, planRecovery } from '../src/engine/session/opponentMovement';
import { assessReachability, movementReach } from '../src/engine/session/playerCoverage';
import { cameraCoveragePath, playerAt, PLAYER_COVERAGE } from '../src/engine/session/playerCoverage';
import { sessionFlights } from '../src/engine/session/sessionFlights';
import { sampleTrajectoryAt } from '../src/engine/trajectory/physics';

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
    const shortRest=compileSession(drill,{...settings,rhythmPercent:150,workBlockSize:1,restSeconds:.5});
    for(const session of [fast,shortRest]){
      const events=session.repetitions.map(motionEvent);
      let previous=sampleOpponentTimeline(events,0)!;
      for(let t=1/120;t<session.duration;t+=1/120){
        const current=sampleOpponentTimeline(events,t)!;
        expect(Math.hypot(current.root.x-previous.root.x,current.root.z-previous.root.z)*120).toBeLessThan(MAX_OPPONENT_SPEED+.02);
        previous=current;
      }
    }
  });
  it('links a reachable rally with the next actual racket contact',()=>{
    const session=compileSession(DRILLS[0]!,settings);
    const linked=session.repetitions.filter(r=>r.rallyReturn);
    expect(linked.length).toBeGreaterThan(0);
    for(const rep of linked){
      const rally=rep.rallyReturn!,next=session.repetitions[rep.index+1]!;
      expect(rep.startTime+rally.contactTime+rally.duration).toBeCloseTo(next.startTime,8);
      expect(rally.contactErrorM).toBeLessThan(.025);
      expect(rally.speedRatio).toBeGreaterThanOrEqual(.65);expect(rally.speedRatio).toBeLessThanOrEqual(1.35);
      expect(rally.trajectory.apexHeight).toBeLessThanOrEqual(6);
      expect(rally.trajectory.events.some(e=>e.type==='second-bounce')).toBe(false);
      expect(rally.trajectory.samples[0]!.position).toEqual(rep.trajectory.samples.find(s=>s.time===rally.contactTime)!.position);
      const handoff=rep.startTime+rally.contactTime;
      expect(sessionFlights(session,handoff).map(f=>f.phase)).toEqual(['return']);
      expect(sessionFlights(session,next.startTime).map(f=>f.phase)).toEqual(['outgoing']);
      const incoming=sampleTrajectoryAt(rep.trajectory,rally.contactTime,false);
      expect(rally.trajectory.samples[0]!.position).toEqual(incoming);
      const sampled=sessionFlights(session,handoff+.2);
      sessionFlights(session,next.startTime+1);
      expect(sessionFlights(session,handoff+.2)).toEqual(sampled);
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
    expect(trajectory.resolved.launchSpeedKmh).toBeCloseTo(session.repetitions[0]!.shot.paceKmh,8);
  });
  it('uses camera position, scripted motion and a modest display allowance',()=>{
    const path=cameraCoveragePath({lateral:2,behindBaseline:1.5},{to:{lateral:-2,behindBaseline:-4},duration:2},.5);
    expect(playerAt(path,0).x).toBe(2);expect(playerAt(path,2).x).toBe(0);
    expect(playerAt(path,1).x).toBe(1);
    expect(playerAt(cameraCoveragePath({lateral:2,behindBaseline:1.5},{to:{lateral:-2},duration:2},0),2).x).toBe(2);
    const t=1,ramp=PLAYER_COVERAGE.speedMps/PLAYER_COVERAGE.acceleration,active=t-PLAYER_COVERAGE.reactionSeconds;
    const benchmark=active<ramp?.5*PLAYER_COVERAGE.acceleration*active*active:PLAYER_COVERAGE.speedMps*(active-ramp/2);
    expect(movementReach(t)).toBeCloseTo(benchmark*1.12,8);
  });
  it('approaches the net directly after serve and suppresses the overhead proxy toss',()=>{
    const drill=DRILLS.find(d=>d.id==='serve-volley')!;
    const session=compileSession(drill,{...settings,rhythmPercent:150});
    expect(session.repetitions[0]!.recoveryPolicy).toBe('direct');
    const plan=planRecovery(...session.repetitions.slice(0,2).map(motionEvent) as [ReturnType<typeof motionEvent>,ReturnType<typeof motionEvent>]);
    expect(plan.recover.stage).toBe('approach');expect(plan.recover.to.z).toBeLessThan(plan.recover.from.z-3);
    const overhead=compileSession(drill,{...settings,practiceShotType:'overhead',repetitions:2});
    const event=motionEvent(overhead.repetitions[0]!);
    expect(event.tossEnabled).toBe(false);
    expect(sampleOpponentTimeline([event],event.start+1)?.toss).toBeNull();
  });
});
