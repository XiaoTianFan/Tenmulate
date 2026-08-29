import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';
import { createCourt } from '../src/engine/rendering/buildCourt';

describe('regulation court constants', () => {
  it('uses SI dimensions from the product contract', () => {
    expect(COURT.singlesWidth).toBe(8.23);
    expect(COURT.fullLength).toBe(23.77);
    expect(COURT.serviceLineFromNet).toBe(6.4);
    expect(COURT.netCenterHeight).toBe(0.914);
    expect(COURT.netPostHeight).toBe(1.07);
  });

  it.each(['hard', 'clay', 'grass'] as const)('builds all three venue shells independently of the %s court surface', (surface) => {
    const court = createCourt(surface);
    expect(Object.keys(court.venueGroups)).toEqual(['outdoor', 'club-hall', 'stadium']);
    expect(court.venueGroups.outdoor.visible).toBe(true);
    expect(court.venueGroups['club-hall'].visible).toBe(false);
    expect(court.venueGroups.stadium.visible).toBe(false);
    expect(court.group.children).toContain(court.venueGroups.outdoor);
  });
});
