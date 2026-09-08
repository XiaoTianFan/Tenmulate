import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshGPUInstancing } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { VENUE_IDS, normalizeEnvironmentConfiguration } from '../src/domain/environment';
import { COURT_ASSET_ANCHORS, selectVenueVariant } from '../src/engine/rendering/VenueAssetManager';
import { occupiedSeatIndices, validateSeatPlacements } from '../src/engine/rendering/AudienceSystem';

describe('all six shipped Blender venue variants', () => {
  it.each(VENUE_IDS)('%s has two valid, registered models and complete shared seat anchors', async id => {
    const manifest = JSON.parse(await readFile(`public/assets/venues/${id}/manifest.json`,'utf8'));
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const measured: number[] = [];
    for (const mode of ['quality','performance'] as const) {
      const variant = selectVenueVariant(manifest,mode);
      const bytes = await readFile(`public${variant.url}`);
      expect(bytes.length).toBe(variant.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(variant.sha256);
      const doc = await io.readBinary(bytes);
      const nodes = doc.getRoot().listNodes();
      for (const [name,position] of Object.entries(COURT_ASSET_ANCHORS)) {
        const node = nodes.find(n=>n.getName()===name)!;
        expect(node,name).toBeDefined();
        node.getWorldTranslation().forEach((v,i)=>expect(v).toBeCloseTo(position[i]!,3));
      }
      let triangles = 0;
      for (const node of nodes) {
        const instances = node.getExtension<import('@gltf-transform/extensions').InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)?.getAttribute('TRANSLATION')?.getCount() ?? 1;
        for (const p of node.getMesh()?.listPrimitives() ?? []) triangles += instances*(p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount())/3;
      }
      measured.push(triangles);
      expect(nodes.filter(n=>n.getExtras().surfaceRole==='court')).toHaveLength(1);
      expect(nodes.filter(n=>n.getExtras().surfaceRole==='runoff')).toHaveLength(1);
      if (mode==='performance') {
        expect(doc.getRoot().listExtensionsUsed().some(e=>e.extensionName==='KHR_materials_transmission')).toBe(false);
        const net = nodes.find(n=>n.getExtras().role==='performance-net')!;
        expect(net).toBeDefined();
        expect(net.getMesh()!.listPrimitives()[0]!.getMaterial()!.getAlphaMode()).toBe('MASK');
      }
      if (id==='timber-hall' || id==='clay-stadium' || id==='covered-grass-arena') {
        expect(nodes.filter(n=>n.getExtras().role==='venue-light')).toHaveLength(4);
        expect(nodes.some(n=>n.getExtras().arenaPart==='roof')).toBe(true);
        expect(manifest.seats).toBeGreaterThan(500);
        // Deduplication intentionally shares identical original micro-normal maps.
        expect(doc.getRoot().listTextures().length).toBeGreaterThanOrEqual(6);
      }
    }
    expect(measured[1]!).toBeLessThan(measured[0]!*.4);
    expect(manifest.performance.bytes).toBeLessThan(manifest.bytes*.65);
    expect(manifest.geometry.qualityTriangles).toBe(measured[0]);
    expect(manifest.geometry.performanceTriangles).toBe(measured[1]);
    const seats = await readFile(`public${manifest.audience.url}`);
    expect(createHash('sha256').update(seats).digest('hex')).toBe(manifest.audience.sha256);
    expect(manifest.audience.count).toBe(manifest.seats);
    const registration = JSON.parse(seats.toString());
    validateSeatPlacements(registration,manifest.seats);
    expect(new Set(registration.seats.map(p=>p.slice(0,3).join(','))).size).toBe(manifest.seats);
  });
});

describe('deterministic audience occupancy', () => {
  it('defaults every venue to half seated while preserving explicit occupancy', () => {
    for (const venue of VENUE_IDS) expect(normalizeEnvironmentConfiguration({venue}).audience).toBe('half');
    expect(normalizeEnvironmentConfiguration({audience:'empty'}).audience).toBe('empty');
    expect(normalizeEnvironmentConfiguration({audience:'half'}).audience).toBe('half');
    expect(normalizeEnvironmentConfiguration({audience:'full'}).audience).toBe('full');
    expect(normalizeEnvironmentConfiguration({audience:Infinity}).audience).toBe('half');
  });
  it('uses exact half, unique seats and stable identities without a per-frame random generator', () => {
    const half=occupiedSeatIndices(14381,'half');
    const full=occupiedSeatIndices(14381,'full');
    expect(half).toHaveLength(7190);
    expect(new Set(half).size).toBe(half.length);
    expect(half.every(i=>full.includes(i))).toBe(true);
    expect(occupiedSeatIndices(14381,'half')).toEqual(half);
    expect(occupiedSeatIndices(14381,'empty')).toEqual([]);
  });
  it('rejects invalid, unbounded or incomplete seat data', () => {
    for (const value of [null,{version:1,stride:4,count:1,seats:[[0,NaN,0,0]]},{version:1,stride:4,count:1,seats:[]},
      {version:1,stride:4,count:1,seats:[[500,0,0,0]]}]) expect(()=>validateSeatPlacements(value,1)).toThrow();
  });
});
