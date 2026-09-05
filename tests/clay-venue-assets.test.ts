import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { NodeIO, type Document, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshGPUInstancing, type InstancedMesh, type Transmission } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { COURT_ASSET_ANCHORS, validateVenueManifest } from '../src/engine/rendering/VenueAssetManager';

let document: Document;
let nodes: Node[];
let manifest: { bytes: number; sha256: string; seats: number; url: string };
let bytes: Uint8Array;
beforeAll(async () => {
  manifest = JSON.parse(await readFile('public/assets/venues/clay-sunset-arena/manifest.json', 'utf8'));
  bytes = await readFile(`public${manifest.url}`);
  await MeshoptDecoder.ready;
  document = await new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(bytes);
  nodes = document.getRoot().listNodes();
});

function bounds(node: Node): THREE.Box3 {
  const box = new THREE.Box3();
  const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for (const primitive of node.getMesh()!.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION')!;
    for (let i = 0; i < positions.getCount(); i++) {
      box.expandByPoint(new THREE.Vector3().fromArray(positions.getElement(i, [])).applyMatrix4(matrix));
    }
  }
  return box;
}

describe('shipped Blender clay arena', () => {
  it('has the declared hash, budget, regulation registration and actual ash seats', () => {
    validateVenueManifest(manifest, 'clay-sunset-arena');
    expect(bytes.length).toBe(manifest.bytes);
    expect(bytes.length).toBeLessThan(15 * 1024 * 1024);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
    for (const [name, expected] of Object.entries(COURT_ASSET_ANCHORS)) {
      const actual = nodes.find(n => n.getName() === name)?.getWorldTranslation();
      expect(actual, name).toBeDefined();
      expected.forEach((v, i) => expect(actual![i], name).toBeCloseTo(v, 3));
    }
    const seats = nodes.filter(n => n.getMesh()?.listPrimitives().some(p => p.getMaterial()?.getName().startsWith('Laminated ash')));
    const count = seats.reduce((sum, n) => sum + (n.getExtension<InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)?.getAttribute('TRANSLATION')?.getCount() ?? 0), 0);
    expect(count).toBeGreaterThan(13000);
    expect(count).toBeLessThan(16500);
    expect(count).toBe(manifest.seats);
  });

  it('retains original relightable clay PBR maps on both adjoining surfaces', () => {
    const surfaces = nodes.filter(n => ['court', 'runoff'].includes(String(n.getExtras().surfaceRole)));
    expect(surfaces).toHaveLength(2);
    for (const node of surfaces) {
      const mat = node.getMesh()!.listPrimitives()[0]!.getMaterial()!;
      expect(mat.getName()).toBe('Original rolled terracotta clay');
      expect(mat.getBaseColorTexture()).toBeTruthy();
      expect(mat.getNormalTexture()).toBeTruthy();
      expect(mat.getMetallicRoughnessTexture()).toBeTruthy();
      expect(bounds(node).max.y).toBeCloseTo(0, 3);
    }
    expect(document.getRoot().listMaterials().some(m => m.getName() === 'Forest green court padding')).toBe(true);
  });

  it('keeps doorway body volumes clear of walls, first-row terraces, stairs and furniture', () => {
    const lanes = nodes.filter(n => n.getExtras().role === 'clear-access-lane').map(node => {
      const center = new THREE.Vector3().fromArray(node.getWorldTranslation());
      const half = new THREE.Vector3().fromArray(node.getExtras().halfExtents as number[]).multiplyScalar(.98);
      return new THREE.Box3(center.clone().sub(half), center.clone().add(half));
    });
    expect(lanes).toHaveLength(4);
    const checked = nodes.filter(n => /Green perimeter|Recessed ground|Tier 1 (precast|riser|.*aisle|seat pedestals)|Player chair|player chair/.test(n.getName()));
    expect(checked.length).toBeGreaterThanOrEqual(7);
    for (const node of checked) {
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION')!;
        const indices = primitive.getIndices();
        const count = indices?.getCount() ?? positions.getCount();
        for (let i = 0; i < count; i += 3) {
          const box = new THREE.Box3();
          for (let j = 0; j < 3; j++) box.expandByPoint(new THREE.Vector3()
            .fromArray(positions.getElement(indices ? indices.getScalar(i+j) : i+j, [])).applyMatrix4(matrix));
          expect(lanes.some(lane => lane.intersectsBox(box)), `${node.getName()} obstructs a player entrance`).toBe(false);
        }
      }
    }
    expect(bounds(nodes.find(n => n.getExtras().arenaPart === 'perimeterWall')!).max.y).toBeCloseTo(2.1, 2);
  });

  it('places straight-stand seats on fixed court-aligned columns in both tiers', () => {
    const seats = nodes.filter(n => n.getMesh()?.listPrimitives().some(p => p.getMaterial()?.getName().startsWith('Laminated ash')));
    const tiers = [{base:2.47,rise:.39,offset:0,rows:24}, {base:14.15,rise:.55,offset:22.32,rows:16}];
    const counts = [0,0];
    const stands = new Set<string>();
    for (const node of seats) {
      const instances = node.getExtension<InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)!;
      const positions = instances.getAttribute('TRANSLATION')!;
      const rotations = instances.getAttribute('ROTATION');
      const world = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (let i=0;i<positions.getCount();i++) {
        const p = new THREE.Vector3().fromArray(positions.getElement(i, [])).applyMatrix4(world);
        const ti = p.y<14 ? 0 : 1;
        const tier = tiers[ti]!;
        // Meshopt recentres the shell at its bounding-box midpoint: height
        // (.41+.86)/2 and 0.042686875 m outward from the authored seat origin.
        const row = Math.round((p.y-.635-tier.base)/tier.rise);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(tier.rows);
        expect(Math.abs(p.y-.635-(tier.base+row*tier.rise))).toBeLessThan(.003);
        const d = tier.offset + row*.78 + .43 + .042686875;
        const side = Math.abs(Math.abs(p.x)-(12.2+d))<.003;
        const end = Math.abs(Math.abs(p.z)-(23.2+d))<.003;
        if (!side&&!end) continue; // Four deliberately fanned corner blocks.
        const t = side ? p.z : p.x;
        // Actual decoded coordinates, not metadata: columns never shift sideways.
        expect(Math.abs(t-Math.round(t/.56)*.56)).toBeLessThan(.003);
        const spacing = side ? 8 : 6;
        expect(Math.abs(t-Math.round(t/spacing)*spacing)).toBeGreaterThan(.867);
        const rotation = new THREE.Quaternion().fromArray(rotations?.getElement(i, []) ?? [0,0,0,1]);
        const forward = new THREE.Vector3(0,0,1).applyQuaternion(rotation).transformDirection(world);
        expect(Math.abs(side ? forward.z : forward.x)).toBeLessThan(.001);
        expect(side ? forward.x*Math.sign(p.x) : forward.z*Math.sign(p.z)).toBeLessThan(-.999);
        counts[ti]!++;
        stands.add(`${ti}:${side ? (p.x>0?'east':'west') : (p.z>0?'south':'north')}`);
      }
    }
    expect(counts[0]).toBeGreaterThan(4000);
    expect(counts[1]).toBeGreaterThan(5000);
    expect(stands.size).toBe(8);
  });

  it('exports eight axis-aligned main-stand stair meshes on shared aisle axes', () => {
    const aisles=nodes.filter(n=>n.getName().includes('orthogonal aisle stair treads'));
    expect(aisles).toHaveLength(8);
    for (const node of aisles) {
      const side=/East|West/.test(node.getName());
      const spacing=side?8:6;
      const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const positions=primitive.getAttribute('POSITION')!;
        for (let i=0;i<positions.getCount();i++) {
          const p=new THREE.Vector3().fromArray(positions.getElement(i,[])).applyMatrix4(matrix);
          const t=side?p.z:p.x;
          // Each edge is exactly +/-0.56 m from a fixed court-normal aisle axis.
          expect(Math.abs(Math.abs(t-Math.round(t/spacing)*spacing)-.56)).toBeLessThan(.003);
        }
      }
    }
  });

  it('holds ten overlapping roof wings halfway across the aperture with four independent light anchors', () => {
    const wings = nodes.filter(n => n.getExtras().role === 'retractable-roof-wing')
      .sort((a,b) => Number(a.getExtras().wingIndex)-Number(b.getExtras().wingIndex));
    expect(wings).toHaveLength(10);
    const intervals = wings.map(bounds);
    // Blender north +Y becomes glTF -Z. Aperture is [-28,31] in Z;
    // the foremost membrane ends at +1.5, leaving exactly 29.5/59 m open.
    expect(intervals[0]!.max.z).toBeCloseTo(1.5, 2);
    expect((31-intervals[0]!.max.z)/59).toBeCloseTo(.5, 3);
    expect(intervals.at(-1)!.min.z).toBeLessThan(-28);
    for (let i=1;i<intervals.length;i++) {
      expect(intervals[i]!.max.z).toBeLessThan(intervals[i-1]!.max.z);
      expect(intervals[i]!.max.z).toBeGreaterThan(intervals[i-1]!.min.z);
    }
    for (const wing of wings) {
      const box = bounds(wing);
      expect(wing.getExtras().roofOpenFraction).toBe(.5);
      expect(box.min.y).toBeGreaterThan(28.5);
      expect(box.max.x - box.min.x).toBeCloseTo(100, 1);
    }
    const lights = nodes.filter(n => n.getExtras().role === 'venue-light');
    expect(lights).toHaveLength(4);
    for (const light of lights) {
      const [x, y, z] = light.getWorldTranslation();
      expect(Math.abs(x)).toBe(20);
      expect(y).toBe(24.5);
      expect(Math.abs(z)).toBe(20);
      expect(light.getExtras().arenaPart).not.toBe('roof');
    }
  });

  it('exports thin double-sided translucent membranes and separate opaque truss geometry, without a solid soffit', () => {
    const skins = nodes.filter(n => n.getExtras().roofMembrane === true);
    expect(skins).toHaveLength(11);
    for (const node of skins) {
      expect(node.getExtras().arenaPart).toBe('roof');
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const mat = primitive.getMaterial()!;
        expect(mat.getAlphaMode()).toBe('OPAQUE'); // Transmission, not see-through alpha.
        expect(mat.getBaseColorFactor()[3]).toBe(1);
        expect(mat.getExtension<Transmission>('KHR_materials_transmission')?.getTransmissionFactor()).toBeCloseTo(.72, 3);
        expect(mat.getRoughnessFactor()).toBeCloseTo(.45, 3);
        expect(mat.getDoubleSided()).toBe(true);
        expect(mat.getMetallicFactor()).toBe(0);
      }
    }
    expect(nodes.some(n => /Fixed canopy underside/.test(n.getName()))).toBe(false);
    const trusses = nodes.filter(n => /exposed.*trusses/.test(n.getName()));
    expect(trusses).toHaveLength(2);
    for (const node of trusses) {
      expect(node.getExtras().roofMembrane).not.toBe(true);
      expect(node.getExtras().arenaPart).toBe('roof');
      expect(bounds(node).max.y-bounds(node).min.y).toBeGreaterThan(1.2);
      const prims=node.getMesh()!.listPrimitives();
      expect(prims.reduce((n,p) => n+p.getAttribute('POSITION')!.getCount(),0)).toBeGreaterThan(1000);
      for (const primitive of prims) expect(primitive.getMaterial()!.getAlphaMode()).toBe('OPAQUE');
    }
  });
});
