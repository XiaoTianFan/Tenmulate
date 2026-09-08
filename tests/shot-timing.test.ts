import {describe,it,expect} from 'vitest';
import {compileSession,type SessionSettings} from '../src/engine/session/compileSession';
import {compilePracticePreview,ContinuousPracticePreview} from '../src/engine/session/practicePreview';
import {motionEvent,minimumMotionGap,sampleOpponentTimeline} from '../src/engine/session/opponentTimeline';
import {planRecovery,MAX_OPPONENT_SPEED} from '../src/engine/session/opponentMovement';
import {DRILLS} from '../src/content/bundled';
import {PRACTICE_SHOT_PROFILES} from '../src/engine/trajectory/practiceProfiles';

const settings:SessionSettings={mode:'quick-practice',practiceShotType:'groundstroke',repetitions:6,
 shotIntervalSeconds:3,rhythmPercent:150,movementPercent:150,variationPercent:0,timingVariationPercent:0,
 launchSpeedKmh:70,spin:'topspin',spinRateRpm:1103,opponentPosition:{x:0,z:12.885},landingDepthM:8.5,
 surface:'hard',seed:'interval-primary',opponentHand:'right',serveRhythm:'normal',workBlockSize:50,restSeconds:0};

describe('interval-first pace search',()=>{
 it.each(['groundstroke','volley','serve','overhead'] as const)('fits a 3 second %s interval and preserves motion budgets',practiceShotType=>{
  const p=PRACTICE_SHOT_PROFILES[practiceShotType];
  const session=compileSession(DRILLS[0]!,{...settings,practiceShotType,opponentPosition:p.opponentPosition,
   launchSpeedKmh:p.defaultLaunchSpeedKmh,spin:p.defaultSpin,spinRateRpm:undefined,landingDepthM:p.defaultLandingDepthM});
  for(let i=1;i<session.repetitions.length;i++) {
   const a=session.repetitions[i-1]!,b=session.repetitions[i]!;
   expect(b.startTime-a.startTime).toBeCloseTo(3,6);expect(a.timing?.limited).toBe(false);
   expect(minimumMotionGap(a,b)).toBeLessThanOrEqual(3+1e-6);
   expect(a.motionRate).toBeLessThanOrEqual(3);expect(a.movementRate).toBeLessThanOrEqual(3);
   const next=motionEvent(b),plan=planRecovery(motionEvent(a),next),arrival=plan.approach??plan.recover;
   expect(arrival.end).toBeCloseTo(next.start,7);
  }
 });
 it('reports the shortest bounded result for an impossible interval instead of teleporting',()=>{
  const session=compileSession(DRILLS[0]!,{...settings,shotIntervalSeconds:1});
  const events=session.repetitions.map(motionEvent);
  expect(session.repetitions[0]!.timing?.limited).toBe(true);
  for(let i=1;i<session.repetitions.length;i++) {
   const a=session.repetitions[i-1]!,b=session.repetitions[i]!;
   expect(b.startTime-a.startTime+1e-6).toBeGreaterThanOrEqual(minimumMotionGap(a,b));
  }
  let previous=sampleOpponentTimeline(events,0)!;
  for(let t=1/120;t<session.duration;t+=1/120){const current=sampleOpponentTimeline(events,t)!;
   expect(Math.hypot(current.root.x-previous.root.x,current.root.z-previous.root.z)*120).toBeLessThan(MAX_OPPONENT_SPEED+.02);previous=current;}
 });
 it('uses secondary preferences when there is room and never resamples the ball to change pace',()=>{
  const slow=compileSession(DRILLS[0]!,{...settings,rhythmPercent:75,movementPercent:65,shotIntervalSeconds:15});
  const fast=compileSession(DRILLS[0]!,{...settings,rhythmPercent:75,movementPercent:65});
  expect(slow.repetitions.every(r=>r.motionRate===.75&&r.movementRate===.65)).toBe(true);
  expect(fast.repetitions.map(r=>r.trajectory)).toEqual(slow.repetitions.map(r=>r.trajectory));
  expect(fast.repetitions[1]!.startTime-fast.repetitions[0]!.startTime).toBeCloseTo(3,6);
  expect(compileSession(DRILLS[0]!,{...settings,rhythmPercent:75,movementPercent:65})).toEqual(fast);
 });
 it('fits continuous practice batch joins and reproduces backward seeks',()=>{
  const preview=new ContinuousPracticePreview(compilePracticePreview(DRILLS[0]!,settings));
  const times=new Set<number>();
  for(let time=0;time<60;time+=2)preview.frame(time).events.forEach(e=>times.add(e.contactTime));
  const ordered=[...times].sort((a,b)=>a-b);
  for(let i=1;i<ordered.length;i++)expect(ordered[i]!-ordered[i-1]!).toBeCloseTo(3,6);
  const first=preview.frame(1);preview.frame(58);expect(preview.frame(1)).toEqual(first);
 });
});
