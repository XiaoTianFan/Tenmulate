import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COURT } from '../src/domain/court';
import { VENUE_IDS, isOutdoorVenue } from '../src/domain/environment';
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
    expect(court.venueGroups['hard-open-arena'].visible).toBe(true);
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
    const arenaContracts = {
      'hard-open-arena': { tiers: 3, shape: 'rounded-rectangular-oval' },
      'clay-sunset-arena': { tiers: 4, shape: 'asymmetric-rounded-rectangle' },
      'grass-center-court': { tiers: 2, shape: 'squarish-continuous-bowl' },
    } as const;
    for (const [arena, contract] of Object.entries(arenaContracts) as [keyof typeof arenaContracts, (typeof arenaContracts)[keyof typeof arenaContracts]][]) {
      const bowl = court.venueGroups[arena].getObjectByName('four-sided-arena-seating-bowl')!;
      expect(bowl).toBeDefined();
      const tiers: THREE.Object3D[] = [];
      bowl.traverse((object) => {
        if (object.name === 'continuous-rounded-arena-tier') tiers.push(object);
      });
      expect(tiers).toHaveLength(contract.tiers);
      expect(bowl.userData.shape).toBe(contract.shape);
      expect(bowl.userData.approximateCapacity).toBeGreaterThanOrEqual(14_000);
      const visibleSeatCount = tiers.reduce((total, tier) => total + Number(tier.userData.visibleSeatCount ?? 0), 0);
      expect(visibleSeatCount, arena).toBeGreaterThanOrEqual(13_000);
      expect(visibleSeatCount, arena).toBeLessThanOrEqual(16_500);
      expect(court.venueGroups[arena].getObjectByName('unbranded-procedural-ad-ring')).toBeDefined();
      expect(court.venueGroups[arena].getObjectByName('open-roof-arena-canopy')).toBeDefined();
    }
    for (const indoor of ['timber-hall', 'clay-stadium', 'covered-grass-arena'] as const) {
      const names: string[] = [];
      court.venueGroups[indoor].traverse((object) => names.push(object.name));
      expect(names.some((name) => name.includes('bleacher') || name.includes('seating-bowl'))).toBe(false);
    }
  });

  it('grounds the runoff, playing slab, and court markings on one shared surface plane', () => {
    const court = createCourt('hard');
    const runoff = court.group.getObjectByName('runoff-surface') as THREE.Mesh;
    const playingSurface = court.group.getObjectByName('regulation-playing-surface') as THREE.Mesh;
    expect(runoff.geometry).toBeInstanceOf(THREE.ShapeGeometry);
    expect(runoff.position.y).toBe(0);
    playingSurface.geometry.computeBoundingBox();
    expect(playingSurface.position.y + playingSurface.geometry.boundingBox!.max.y).toBeCloseTo(0, 6);
    const lines = court.presentation.children.filter((child) => child.name === 'court-line') as THREE.Mesh[];
    expect(lines).toHaveLength(11);
    for (const line of lines) {
      line.geometry.computeBoundingBox();
      expect(line.position.y + line.geometry.boundingBox!.min.y).toBeCloseTo(0, 6);
    }
  });

  it('builds a dense net mesh with a regulation-width white top tape', () => {
    const court = createCourt('hard');
    const net = court.group.getObjectByName('regulation-net') as THREE.Group;
    const mesh = net.children.find((child) => child instanceof THREE.LineSegments) as THREE.LineSegments;
    const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count).toBeGreaterThan(13_000);
    expect(positions.getX(2) - positions.getX(0)).toBeLessThanOrEqual(0.0421);
    expect((mesh.material as THREE.LineBasicMaterial).opacity).toBe(0.68);
    const tape = net.getObjectByName('wide-regulation-net-tape') as THREE.Mesh;
    tape.geometry.computeBoundingBox();
    expect(tape.geometry.boundingBox!.max.y - tape.geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(0.075);
  });

  it('provides positioned artificial floodlights in every outdoor venue', () => {
    const court = createCourt('hard');
    for (const venue of VENUE_IDS.filter(isOutdoorVenue)) {
      let lightCount = 0;
      court.venueGroups[venue].traverse((object) => {
        if (object instanceof THREE.SpotLight) lightCount += 1;
      });
      expect(lightCount, venue).toBeGreaterThanOrEqual(12);
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
