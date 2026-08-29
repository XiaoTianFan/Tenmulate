import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';
import { VENUE_IDS } from '../src/domain/environment';
import { createCourt } from '../src/engine/rendering/buildCourt';

describe('regulation court constants', () => {
  it('uses SI dimensions from the product contract', () => {
    expect(COURT.singlesWidth).toBe(8.23);
    expect(COURT.fullLength).toBe(23.77);
    expect(COURT.serviceLineFromNet).toBe(6.4);
    expect(COURT.netCenterHeight).toBe(0.914);
    expect(COURT.netPostHeight).toBe(1.07);
  });

  it.each(['hard', 'clay', 'grass'] as const)('builds all six canonical scenes independently of the %s court surface', (surface) => {
    const court = createCourt(surface);
    expect(Object.keys(court.venueGroups)).toEqual(VENUE_IDS);
    expect(court.venueGroups['outdoor-club'].visible).toBe(true);
    for (const venue of VENUE_IDS.slice(1)) expect(court.venueGroups[venue].visible).toBe(false);
    for (const venue of VENUE_IDS) expect(court.group.children).toContain(court.venueGroups[venue]);
  });

  it('switches appearance maps without rebuilding scene geometry', () => {
    const court = createCourt('hard');
    const hardMap = court.courtMaterial.map;
    court.setSurface('clay');
    expect(court.courtMaterial.map).not.toBe(hardMap);
    expect(court.courtMaterial.map).toBe(court.materialBundle.surfaceMaps.clay);
    expect(court.materialBundle.materials.runoff.map).toBe(court.materialBundle.runoffMaps.clay);
    expect(court.courtMaterial.roughness).toBeGreaterThan(0.9);
  });
});
