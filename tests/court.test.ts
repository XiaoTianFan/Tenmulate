import { describe, expect, it } from 'vitest';
import { COURT } from '../src/domain/court';
import { VENUE_IDS } from '../src/domain/environment';
import { AUTHORED_VENUES } from '../src/engine/rendering/VenueAssetManager';
import { createCourt } from '../src/engine/rendering/buildCourt';

describe('Blender-only court presentation boundary', () => {
  it('retains regulation SI gameplay dimensions independently of scene assets', () => {
    expect(COURT.singlesWidth).toBe(8.23);
    expect(COURT.fullLength).toBe(23.77);
    expect(COURT.serviceLineFromNet).toBe(6.4);
    expect(COURT.netCenterHeight).toBe(.914);
    expect(COURT.netPostHeight).toBe(1.07);
    expect(Object.keys(AUTHORED_VENUES)).toEqual(VENUE_IDS);
  });
  it.each(['hard','clay','grass'] as const)('does not build duplicate procedural venues or nets for %s', surface => {
    const court = createCourt(surface);
    expect(court.group.children.map(c=>c.name)).toEqual(['temporary-ball-machine']);
    expect(court.group.getObjectByName('regulation-net')).toBeUndefined();
    expect(court.group.getObjectByName('procedural-court-presentation')).toBeUndefined();
  });
  it('keeps alternative playing surfaces as explicit material overrides', () => {
    const court = createCourt('hard');
    const uniforms = court.materialBundle.materials.court.userData.proceduralUniforms!;
    const color = uniforms.colorA.value.getHex();
    court.setSurface('clay');
    expect(uniforms.colorA.value.getHex()).not.toBe(color);
    expect(uniforms.pattern.value).toBe(1);
    expect(court.materialBundle.materials.court.roughness).toBeGreaterThan(.9);
  });
});
