import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
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

  it.each(['hard', 'clay', 'grass'] as const)('builds all nine canonical scenes independently of the %s court surface', (surface) => {
    const court = createCourt(surface);
    expect(Object.keys(court.venueGroups)).toEqual(VENUE_IDS);
    expect(court.venueGroups['outdoor-club'].visible).toBe(true);
    for (const venue of VENUE_IDS.slice(1)) expect(court.venueGroups[venue].visible).toBe(false);
    for (const venue of VENUE_IDS) expect(court.group.children).toContain(court.venueGroups[venue]);
  });

  it('switches procedural surface shader uniforms without rebuilding scene geometry', () => {
    const court = createCourt('hard');
    const uniforms = court.materialBundle.materials.court.userData.proceduralUniforms!;
    const hardColor = uniforms.colorA.value.getHex();
    court.setSurface('clay');
    expect(court.materialBundle.textures).toHaveLength(0);
    expect(uniforms.colorA.value.getHex()).not.toBe(hardColor);
    expect(uniforms.pattern.value).toBe(1);
    expect(court.courtMaterial.onBeforeCompile).toBeTypeOf('function');
    expect(court.courtMaterial.roughness).toBeGreaterThan(0.9);
  });

  it('keeps arenas outdoors and all indoor venues free of audience seating', () => {
    const court = createCourt('hard');
    for (const arena of ['hard-open-arena', 'clay-sunset-arena', 'grass-center-court'] as const) {
      const bowl = court.venueGroups[arena].getObjectByName('four-sided-arena-seating-bowl')!;
      expect(bowl).toBeDefined();
      const standNames: string[] = [];
      bowl.traverse((object) => {
        if (object.name.includes('multi-tier-stadium-stand')) standNames.push(object.name);
      });
      expect(standNames).toHaveLength(8);
      expect(court.venueGroups[arena].getObjectByName('unbranded-procedural-ad-ring')).toBeDefined();
      expect(court.venueGroups[arena].getObjectByName('open-roof-arena-canopy')).toBeDefined();
    }
    for (const indoor of ['timber-hall', 'clay-stadium', 'covered-grass-arena'] as const) {
      const names: string[] = [];
      court.venueGroups[indoor].traverse((object) => names.push(object.name));
      expect(names.some((name) => name.includes('bleacher') || name.includes('seating-bowl'))).toBe(false);
    }
  });

  it('aligns indoor light sources with visible lenses and builds an upright barrel vault', () => {
    const court = createCourt('grass');
    const hall = court.venueGroups['covered-grass-arena'];
    expect(hall.name).toBe('scene-barrel-vault-grass-hall');
    const fixtures = hall.children.filter((child) => child.name === 'aligned-ceiling-fixture');
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      const lens = fixture.getObjectByName('fixture-visible-lens')!;
      const light = fixture.getObjectByName('fixture-aligned-light-source')!;
      expect(lens.position.distanceTo(light.position)).toBeLessThan(0.02);
    }
    let roofPanelCount = 0;
    hall.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material === court.materialBundle.materials.ceiling) roofPanelCount += 1;
    });
    expect(roofPanelCount).toBeGreaterThanOrEqual(18);
  });
});
