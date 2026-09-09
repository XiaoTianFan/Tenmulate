import { describe, expect, it } from 'vitest';
import { DRILLS, SHOTS } from '../src/content/bundled';
import { parseDrillJson, validateDrill } from '../src/content/validation';
import { compileSession, type SessionSettings } from '../src/engine/session/compileSession';
import { createSeededRandom } from '../src/engine/random/seeded';
import { defaultLandingZone, resolveLandingZone, sampleLandingZone } from '../src/engine/trajectory/landingZone';
import { PRACTICE_SHOT_PROFILES } from '../src/engine/trajectory/practiceProfiles';

const settings: SessionSettings = {repetitions:12,shotIntervalSeconds:5,rhythmPercent:100,movementPercent:100,
  variationPercent:8,timingVariationPercent:0,launchSpeedKmh:70,spin:'preset',surface:'hard',seed:'zone-test',
  opponentHand:'right',workBlockSize:50,restSeconds:0,serveRhythm:'preset',trajectoryMode:'natural'};

describe('uniform landing zones', () => {
  it.each(['groundstroke','serve'] as const)('has uniform area density including clipped %s edges', family => {
    const zone = resolveLandingZone({x:family==='serve' ? -.15 : 4,z:-6.2}, {width:2,depth:2},family,{x:1});
    const random = createSeededRandom('uniform'), bins = Array<number>(16).fill(0);
    let sumX=0,sumZ=0;
    for(let i=0;i<16000;i++){
      const point = sampleLandingZone(zone,random);
      const x=(point.x-zone.minX)/(zone.maxX-zone.minX),z=(point.z-zone.minZ)/(zone.maxZ-zone.minZ);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(1);
      expect(z).toBeGreaterThan(0); expect(z).toBeLessThan(1);
      bins[Math.floor(x*4)+4*Math.floor(z*4)]!++; sumX+=x; sumZ+=z;
    }
    expect(sumX/16000).toBeCloseTo(.5,2); expect(sumZ/16000).toBeCloseTo(.5,2);
    for(const count of bins)expect(Math.abs(count-1000)).toBeLessThan(110);
  });

  it.each(['groundstroke','serve','volley','overhead','lob','drop-shot'] as const)('samples %s landings and fits their actual bounces for both hands',practiceShotType=>{
    const profile=PRACTICE_SHOT_PROFILES[practiceShotType];
    for(const opponentHand of ['right','left'] as const){
      const session=compileSession(DRILLS[0]!,{...settings,practiceShotType,opponentHand,
        launchSpeedKmh:profile.defaultLaunchSpeedKmh,spin:profile.defaultSpin,spinRateRpm:profile.spinRates[profile.defaultSpin]?.defaultRpm,
        opponentPosition:profile.opponentPosition,landingDepthM:profile.defaultLandingDepthM});
      expect(new Set(session.repetitions.map(rep=>JSON.stringify(rep.shot.target))).size).toBe(12);
      for(const rep of session.repetitions){
        const zone=rep.trajectory.intent.landingZone!,target=rep.shot.target;
        expect(target.x).toBeGreaterThanOrEqual(zone.minX);expect(target.x).toBeLessThan(zone.maxX);
        expect(target.z).toBeGreaterThanOrEqual(zone.minZ);expect(target.z).toBeLessThan(zone.maxZ);
        const bounce=rep.trajectory.events.find(e=>e.type==='bounce')!;
        expect(rep.trajectory.solution?.status).not.toBe('unreachable');
        expect(Math.hypot(bounce.position.x-target.x,bounce.position.z-target.z)).toBeLessThan(.18);
      }
    }
  });

  it('applies zones to every drill primitive, including explicit per-event overrides',()=>{
    for(const shot of SHOTS){
      const session=compileSession({...DRILLS[0]!,shotIds:[shot.id],events:[{id:'event',shotId:shot.id,
        landingZone:{width:1,depth:1.5},variationPercent:12}]},{...settings,repetitions:3,mode:'drill'});
      for(const rep of session.repetitions){
        const zone=rep.trajectory.intent.landingZone!;
        expect(zone.maxX-zone.minX).toBeGreaterThan(0);
        expect(zone.maxZ-zone.minZ).toBeGreaterThan(0);
        expect(zone.maxX-zone.minX).toBeLessThanOrEqual(1.000001);
        expect(zone.maxZ-zone.minZ).toBeLessThanOrEqual(1.500001);
        expect(rep.trajectory.solution?.status,shot.id).not.toBe('unreachable');
        expect(rep.trajectory.solution!.targetErrorM,shot.id).toBeLessThan(.18);

        if(shot.family==='serve')expect(rep.shot.target.x*shot.source.x).toBeLessThan(0);
      }
      expect(session.repetitions[0]!.shot.target).not.toEqual(session.repetitions[1]!.shot.target);
    }
  }, 15000); // Full inverse-physics sweep, not a single lightweight unit case.

  it('keeps landing, speed, spin and timing random streams independent and replayable',()=>{
    const base={...settings,practiceShotType:'groundstroke' as const,spin:'topspin' as const,spinRateRpm:1103};
    const a=compileSession(DRILLS[0]!,base),b=compileSession(DRILLS[0]!,{...base,variationPercent:0,timingVariationPercent:20});
    expect(a.repetitions.map(r=>r.shot.target)).toEqual(b.repetitions.map(r=>r.shot.target));
    const c=compileSession(DRILLS[0]!,{...base,landingZone:{width:3,depth:3}});
    expect(a.repetitions.map(r=>r.shot.paceKmh)).toEqual(c.repetitions.map(r=>r.shot.paceKmh));
    expect(a.repetitions.map(r=>r.trajectory.intent.spinRateRpm)).toEqual(c.repetitions.map(r=>r.trajectory.intent.spinRateRpm));
    expect(a).toEqual(compileSession(DRILLS[0]!,base));
    for(const rep of a.repetitions){
      expect(rep.shot.paceKmh).toBeGreaterThanOrEqual(70*.92);expect(rep.shot.paceKmh).toBeLessThan(70*1.08);
      expect(rep.trajectory.intent.spinRateRpm!).toBeGreaterThanOrEqual(1103*.92);expect(rep.trajectory.intent.spinRateRpm!).toBeLessThan(1103*1.08);
    }
  });

  it('round-trips custom zones and parameter variation; legacy drills acquire family defaults',()=>{
    const event={id:'event',shotId:SHOTS[0]!.id,landingZone:{width:2.3,depth:1.4},variationPercent:15};
    const drill={...DRILLS[0]!,events:[event],shotIds:[event.shotId]};
    expect(parseDrillJson(JSON.stringify(drill)).events![0]).toEqual(event);
    for(const size of [0,-1,6.1,NaN,Infinity,'2'])expect(validateDrill({...drill,events:[{...event,landingZone:{width:size,depth:1}}]}).valid).toBe(false);
    for(const variation of [-1,26,NaN,Infinity])expect(validateDrill({...drill,events:[{...event,variationPercent:variation}]}).valid).toBe(false);
    expect(defaultLandingZone('serve')).toEqual({width:.9,depth:1.2});
  });
  it('slows a short half-volley to keep its sampled zone target, and reports an infeasible exact request',()=>{
    const drill={...DRILLS[0]!,events:undefined,shotIds:['half-volley-body']};
    const natural=compileSession(drill,{...settings,repetitions:3,trajectoryMode:'natural'});
    const exact=compileSession(drill,{...settings,repetitions:3,trajectoryMode:'exact'});
    expect(natural.repetitions.map(rep=>rep.shot.target)).toEqual(exact.repetitions.map(rep=>rep.shot.target));
    expect(natural.repetitions.every(rep=>rep.trajectory.solution?.status==='adjusted')).toBe(true);
    expect(exact.repetitions.some(rep=>rep.trajectory.solution?.status==='unreachable')).toBe(true);
    for(const rep of natural.repetitions){
      expect(rep.trajectory.resolved.launchSpeedKmh).toBeLessThan(rep.shot.paceKmh*.85);
      expect(rep.trajectory.resolved.launchSpeedKmh).toBeGreaterThanOrEqual(rep.shot.paceKmh*.5-1e-6);
    }
  });
});
