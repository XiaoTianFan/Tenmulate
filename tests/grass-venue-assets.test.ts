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
  manifest = JSON.parse(await readFile('public/assets/venues/grass-center-court/manifest.json', 'utf8'));
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
    for (let i = 0; i < positions.getCount(); i++) box.expandByPoint(new THREE.Vector3()
      .fromArray(positions.getElement(i, [])).applyMatrix4(matrix));
  }
  return box;
}
function seatNodes() {
  return nodes.filter(n => n.getMesh()?.listPrimitives().some(p => p.getMaterial()?.getName().startsWith('Moulded garden green')));
}

describe('shipped Blender grass arena', () => {
  it('has bounded verified bytes, exact gameplay registration and real linked seats', () => {
    validateVenueManifest(manifest, 'grass-center-court');
    expect(bytes.length).toBe(manifest.bytes);
    expect(bytes.length).toBeLessThan(15*1024*1024);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
    for (const [name, expected] of Object.entries(COURT_ASSET_ANCHORS)) {
      const actual = nodes.find(n => n.getName() === name)?.getWorldTranslation();
      expect(actual, name).toBeDefined();
      expected.forEach((v, i) => expect(actual![i], name).toBeCloseTo(v, 3));
    }
    const count = seatNodes().reduce((sum, n) => sum + (n.getExtension<InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)
      ?.getAttribute('TRANSLATION')?.getCount() ?? 0), 0);
    expect(count).toBe(14381);
    expect(count).toBe(manifest.seats);
  });

  it('keeps the complete 22 by 41 m lawn with continuous world-registered PBR stripes', () => {
    const surfaces = nodes.filter(n => ['court','runoff'].includes(String(n.getExtras().surfaceRole)));
    expect(surfaces).toHaveLength(2);
    const lawn = new THREE.Box3();
    for (const node of surfaces) {
      const box = bounds(node);
      lawn.union(box);
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(box.max.y).toBeCloseTo(0, 3);
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const mat = primitive.getMaterial()!;
        expect(mat.getName()).toBe('Original striped ryegrass');
        expect(mat.getBaseColorTexture()).toBeTruthy();
        expect(mat.getNormalTexture()).toBeTruthy();
        expect(mat.getMetallicRoughnessTexture()).toBeTruthy();
        const positions = primitive.getAttribute('POSITION')!;
        const uv = primitive.getAttribute('TEXCOORD_0')!;
        for (let i=0;i<positions.getCount();i++) {
          const p = new THREE.Vector3().fromArray(positions.getElement(i,[])).applyMatrix4(matrix);
          const tex = uv.getElement(i,[]);
          expect(tex[0]).toBeCloseTo((p.x+11)/22, 3);
          // Blender Y becomes -Z, and glTF's texture V is inverted on export.
          expect(tex[1]).toBeCloseTo((p.z+20.5)/41, 3);
        }
      }
    }
    expect(lawn.getSize(new THREE.Vector3()).toArray()).toEqual(expect.arrayContaining([expect.closeTo(22,2),expect.closeTo(41,2)]));
  });

  it('has two separate five-truss banks and no folded roof crossing the open aperture', () => {
    const trusses = nodes.filter(n => n.getExtras().role === 'concertina-roof-truss');
    expect(trusses).toHaveLength(10);
    for (const bank of [-1,1]) {
      const selected = trusses.filter(n => n.getExtras().roofBank === bank);
      expect(selected).toHaveLength(5);
      expect(selected.map(n => n.getExtras().trussIndex).sort()).toEqual([0,1,2,3,4]);
    }
    const skins = nodes.filter(n => n.getExtras().roofMembrane === true);
    expect(skins).toHaveLength(8);
    for (const node of [...trusses,...skins]) {
      const b = bounds(node);
      expect(Math.min(Math.abs(b.min.z),Math.abs(b.max.z))).toBeGreaterThan(34);
      expect(b.min.y).toBeGreaterThan(22.3);
      expect(b.max.x-b.min.x).toBeGreaterThan(76.9);
      expect(b.max.x-b.min.x).toBeLessThan(77.4);
      expect(node.getExtras().arenaPart).toBe('roof');
    }
    for (const node of skins) {
      const mat = node.getMesh()!.listPrimitives()[0]!.getMaterial()!;
      expect(mat.getExtension<Transmission>('KHR_materials_transmission')?.getTransmissionFactor()).toBeCloseTo(.22,5);
      expect(mat.getRoughnessFactor()).toBeCloseTo(.6,5);
      expect(mat.getDoubleSided()).toBe(true);
    }
    expect(nodes.some(n => n.getName() === 'Opaque grid panel canopy underside')).toBe(true);
  });

  it('matches all ordinary seat row heights to the three authored rake profiles', () => {
    const tiers = [{rows:12,base:1.5,rise:.29},{rows:26,base:6.1,rise:.41},{rows:6,base:17.44,rise:.43}];
    const rows = tiers.map(() => new Set<number>());
    let matched = 0;
    for (const node of seatNodes()) {
      const instance = node.getExtension<InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)!;
      const translations = instance.getAttribute('TRANSLATION')!;
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (let i=0;i<translations.getCount();i++) {
        const p = new THREE.Vector3().fromArray(translations.getElement(i,[])).applyMatrix4(matrix);
        // Meshoptimizer recentres each shared shell at its local bounds midpoint.
        const base = p.y-(.415+.86)/2;
        const ti = tiers.findIndex(t => {
          const row = Math.round((base-t.base)/t.rise);
          return row>=0 && row<t.rows && Math.abs(base-t.base-row*t.rise)<.004;
        });
        if (ti>=0) { matched++; rows[ti]!.add(Math.round((base-tiers[ti]!.base)/tiers[ti]!.rise)); }
        else {
          // Seventy reserved pavilion chairs use a raised independent five-row dais.
          expect(p.z).toBeGreaterThan(22.5);
          expect(Math.abs(p.x)).toBeLessThan(5.5);
        }
      }
    }
    expect(matched).toBeGreaterThan(14300);
    expect(rows.map(r=>r.size)).toEqual([12,26,6]);
  });

  it('keeps the four player entrance body volumes clear of terraces and furniture', () => {
    const lanes = nodes.filter(n => n.getExtras().role === 'clear-access-lane').map(n => {
      const center = new THREE.Vector3().fromArray(n.getWorldTranslation());
      const half = new THREE.Vector3().fromArray(n.getExtras().halfExtents as number[]).multiplyScalar(.98);
      return new THREE.Box3(center.clone().sub(half),center.clone().add(half));
    });
    expect(lanes).toHaveLength(4);
    const checked = nodes.filter(n => /Low perimeter|Recessed player|Tier 1 (precast|riser|court-normal|seat pedestals)|Player chair|Green player/.test(n.getName()));
    expect(checked.length).toBeGreaterThanOrEqual(7);
    for (const node of checked) {
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION')!;
        const indices = primitive.getIndices();
        const count = indices?.getCount() ?? positions.getCount();
        for (let i=0;i<count;i+=3) {
          const box = new THREE.Box3();
          for (let j=0;j<3;j++) box.expandByPoint(new THREE.Vector3().fromArray(
            positions.getElement(indices?indices.getScalar(i+j):i+j,[])).applyMatrix4(matrix));
          expect(lanes.some(lane=>lane.intersectsBox(box)),`${node.getName()} obstructs entrance`).toBe(false);
        }
      }
    }
  });

  it('has an enclosed rear bowl, original pavilion and independent fixed light anchors', () => {
    const enclosure = nodes.find(n=>n.getName()==='Continuous inner enclosure and rear canopy reveal')!;
    expect(bounds(enclosure).max.y).toBeCloseTo(24.2,2);
    expect(enclosure.getMesh()!.listPrimitives()[0]!.getMaterial()!.getDoubleSided()).toBe(true);
    expect(nodes.some(n=>n.getName()==='Baseline garden pavilion and media wall')).toBe(true);
    const fixtures=nodes.filter(n=>n.getExtras().role==='venue-light');
    expect(fixtures).toHaveLength(4);
    for (const node of fixtures) {
      expect(node.getWorldTranslation()[1]).toBeCloseTo(19.8,3);
      expect(node.getExtras().arenaPart).not.toBe('roof');
    }
  });

  it('does not ship reference-event names or sponsor labels in scene identity', () => {
    const runtimeText = [...nodes,...document.getRoot().listMaterials(),...document.getRoot().listTextures()]
      .map(p=>`${p.getName()} ${JSON.stringify(p.getExtras())}`).join('\n');
    expect(runtimeText).not.toMatch(/wimbledon|aeltc|rolex|royal box|slazenger|ibm|leon labyk/i);
  });
});
