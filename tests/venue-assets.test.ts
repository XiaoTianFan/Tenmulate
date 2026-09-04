import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshGPUInstancing } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class { setMeshoptDecoder() { return this; } parseAsync = parse; },
}));
import { COURT_ASSET_ANCHORS, VenueAssetManager, validateCourtRegistration, validateVenueManifest } from '../src/engine/rendering/VenueAssetManager';

const bytes = new Uint8Array([1, 2, 3]);
const manifest = {
  id: 'hard-open-arena', compatibility: 'tenmulate-court-v1', version: 1,
  url: '/assets/venues/hard-open-arena/hard-open-arena.abcdef123456.glb',
  bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
};
function registeredScene(): THREE.Group {
  const group = new THREE.Group();
  for (const [name, position] of Object.entries(COURT_ASSET_ANCHORS)) {
    const anchor = new THREE.Object3D();
    anchor.name = name;
    anchor.position.fromArray(position);
    group.add(anchor);
  }
  for (const role of ['court', 'runoff']) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
    mesh.userData.surfaceRole = role;
    group.add(mesh);
  }
  return group;
}
function serve(m = manifest, data = bytes) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(
    url.endsWith('.json') ? Response.json(m) : new Response(data),
  )));
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); parse.mockReset(); });

describe('authored venue boundary', () => {
  it('ships the declared bytes, seat instances and gameplay anchors in the actual decoded asset', async () => {
    const shipped = JSON.parse(await readFile('public/assets/venues/hard-open-arena/manifest.json', 'utf8'));
    validateVenueManifest(shipped);
    const data = await readFile(`public${shipped.url}`);
    expect(data.length).toBe(shipped.bytes);
    expect(createHash('sha256').update(data).digest('hex')).toBe(shipped.sha256);
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const document = await io.readBinary(data);
    const nodes = document.getRoot().listNodes();
    for (const [name, expected] of Object.entries(COURT_ASSET_ANCHORS)) {
      const actual = nodes.find(n => n.getName() === name)?.getWorldTranslation();
      expect(actual, name).toBeDefined();
      expected.forEach((v, i) => expect(actual![i], name).toBeCloseTo(v, 3));
    }
    const instances = nodes.reduce((sum, node) => sum + (node.getExtension<import('@gltf-transform/extensions').InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)?.getAttribute('TRANSLATION')?.getCount() ?? 0), 0);
    expect(instances).toBe(13216);
    expect(nodes.some(n => n.getExtras().surfaceRole === 'court')).toBe(true);
    expect(nodes.some(n => n.getExtras().surfaceRole === 'runoff')).toBe(true);
  });
  it('rejects unbounded, foreign, and incompatible manifests', () => {
    expect(() => validateVenueManifest(manifest)).not.toThrow();
    for (const invalid of [null, { ...manifest, bytes: 16*1024*1024 },
      { ...manifest, url: 'https://example.com/arena.glb' }, { ...manifest, compatibility: 'v2' }]) {
      expect(() => validateVenueManifest(invalid)).toThrow();
    }
  });
  it('uses gameplay coordinates, including export-axis conversion, as registration authority', () => {
    const scene = registeredScene();
    expect(() => validateCourtRegistration(scene)).not.toThrow();
    scene.getObjectByName('baseline_near')!.position.z *= -1;
    expect(() => validateCourtRegistration(scene)).toThrow('baseline_near');
  });
  it('reveals only a completely downloaded, hash-checked and registered scene', async () => {
    serve();
    parse.mockResolvedValue({ scene: registeredScene() });
    const manager = new VenueAssetManager(vi.fn());
    expect(fetch).not.toHaveBeenCalled();
    manager.setActive(true);
    expect(manager.group.visible).toBe(false);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(manager.group.visible).toBe(true);
    manager.setActive(false);
    expect(manager.group.visible).toBe(false);
    manager.setActive(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    manager.dispose();
    expect(manager.group.children).toHaveLength(0);
  });
  it('keeps fallback on content corruption without attempting glTF parsing', async () => {
    serve({ ...manifest, sha256: '0'.repeat(64) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new VenueAssetManager(vi.fn());
    manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('error'));
    expect(manager.group.visible).toBe(false);
    expect(parse).not.toHaveBeenCalled();
    manager.dispose();
  });
  it('disposes a parse result arriving after deselection and never reattaches it', async () => {
    serve();
    let finish: ((gltf: { scene: THREE.Group }) => void) | undefined;
    parse.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const manager = new VenueAssetManager(vi.fn());
    manager.setActive(true);
    await vi.waitFor(() => expect(parse).toHaveBeenCalledOnce());
    manager.setActive(false);
    const scene = registeredScene();
    const mesh = scene.children.find(o => o instanceof THREE.Mesh) as THREE.Mesh;
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    finish!({ scene });
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
    expect(manager.state.status).toBe('idle');
    expect(manager.group.children).toHaveLength(0);
    manager.dispose();
  });
  it('aborts an in-flight transfer when disposed', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => {
      signal = options.signal;
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }));
    const manager = new VenueAssetManager(vi.fn());
    manager.setActive(true);
    manager.dispose();
    expect(signal?.aborted).toBe(true);
    await Promise.resolve();
    expect(manager.state.status).toBe('disposed');
  });
});
