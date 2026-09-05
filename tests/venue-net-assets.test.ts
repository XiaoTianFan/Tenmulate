import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

async function loadVenue(id: string) {
  const manifest = JSON.parse(await readFile(`public/assets/venues/${id}/manifest.json`, 'utf8'));
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).readBinary(await readFile(`public${manifest.url}`));
}

describe('authored court visibility', () => {
  it.each(['hard-open-arena', 'clay-sunset-arena', 'grass-center-court'])('%s ships a tighter, thicker net weave', async id => {
    const document = await loadVenue(id);
    const nets = document.getRoot().listNodes().filter(n => n.getExtras().role === 'woven-net');
    expect(nets).toHaveLength(1);
    const net = nets[0]!;
    expect(net.getExtras()).toMatchObject({ meshPitch: .042, cordRadius: .0022, verticalCords: 306 });
    const rows = Number(net.getExtras().horizontalCords);
    expect(rows).toBeGreaterThanOrEqual(24);
    expect(rows).toBeLessThanOrEqual(25);
    const box = new THREE.Box3();
    const transform = new THREE.Matrix4().fromArray(net.getWorldMatrix());
    let triangles = 0;
    for (const primitive of net.getMesh()!.listPrimitives()) {
      triangles += primitive.getIndices()!.getCount() / 3;
      expect(primitive.getMaterial()!.getAlphaMode()).toBe('OPAQUE');
      const positions = primitive.getAttribute('POSITION')!;
      for (let i = 0; i < positions.getCount(); i++) box.expandByPoint(new THREE.Vector3()
        .fromArray(positions.getElement(i, [])).applyMatrix4(transform));
    }
    // Every cord segment remains a four-sided solid beam, not metadata alone.
    expect(triangles).toBe((306 + rows * 48) * 12);
    expect(box.max.x - box.min.x).toBeCloseTo(12.8024, 2);
    expect(box.max.z - box.min.z).toBeGreaterThan(.004);
    expect(box.max.z - box.min.z).toBeLessThan(.0048);
    expect(box.max.y).toBeCloseTo(1.0362, 3);
  });

  it('keeps grass albedo darker and greener for white-line contrast without baking lighting', async () => {
    const document = await loadVenue('grass-center-court');
    const grass = document.getRoot().listMaterials().find(m => m.getName() === 'Original striped ryegrass')!;
    const channels = (await sharp(Buffer.from(grass.getBaseColorTexture()!.getImage()!)).stats()).channels;
    const [r, g, b] = channels.map(c => c.mean / 255) as [number, number, number];
    const linear = (v: number) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    const luminance = .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
    // The pale initial map was approximately .29; bound the actual exported map.
    expect(luminance).toBeGreaterThan(.16);
    expect(luminance).toBeLessThan(.23);
    expect(g / r).toBeGreaterThan(1.27);
    expect(b).toBeLessThan(r);
    expect(grass.getNormalTexture()).toBeTruthy();
    expect(grass.getMetallicRoughnessTexture()).toBeTruthy();
  });
});
