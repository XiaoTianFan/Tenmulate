import { describe, expect, it } from 'vitest';
import { resolveTrajectory } from '../src/engine/trajectory/physics';
import { practiceLandingTarget } from '../src/engine/trajectory/practiceProfiles';

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
