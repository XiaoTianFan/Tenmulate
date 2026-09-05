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
import { createSceneMaterialBundle } from '../src/engine/rendering/sceneMaterials';

const bytes = new Uint8Array([1, 2, 3]);
const manifest = {
  id: 'hard-open-arena', compatibility: 'tenmulate-court-v1', version: 1,
  url: '/assets/venues/hard-open-arena/hard-open-arena.abcdef123456.glb',
  bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
};
const clayManifest = { ...manifest, id: 'clay-sunset-arena',
  url: '/assets/venues/clay-sunset-arena/clay-sunset-arena.abcdef123456.glb' };
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
    const declaredSeats = shipped.seats;
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
    const seatNodes = nodes.filter(n => n.getMesh()?.listPrimitives().some(p => p.getMaterial()?.getName().startsWith('Moulded polypropylene')));
    const instances = seatNodes.reduce((sum, node) => sum + (node.getExtension<import('@gltf-transform/extensions').InstancedMesh>(EXTMeshGPUInstancing.EXTENSION_NAME)?.getAttribute('TRANSLATION')?.getCount() ?? 0), 0);
    expect(instances).toBe(13304);
    expect(instances).toBe(declaredSeats);
    expect(nodes.some(n => n.getExtras().surfaceRole === 'court')).toBe(true);
    expect(nodes.some(n => n.getExtras().surfaceRole === 'runoff')).toBe(true);
  });
  it('keeps all four doorway approaches clear in the actual exported geometry', async () => {
    const shipped = JSON.parse(await readFile('public/assets/venues/hard-open-arena/manifest.json', 'utf8'));
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const nodes = (await io.readBinary(await readFile(`public${shipped.url}`))).getRoot().listNodes();
    const lanes = nodes.filter(n => n.getExtras().role === 'clear-access-lane').map(node => {
      const center = new THREE.Vector3().fromArray(node.getWorldTranslation());
      const half = new THREE.Vector3().fromArray(node.getExtras().halfExtents as number[]).multiplyScalar(.98);
      // Floor/threshold contact is intended; reserve a clear body-height volume.
      return new THREE.Box3(center.clone().sub(half), center.clone().add(half));
    });
    expect(lanes).toHaveLength(4);
    const checked = nodes.filter(n => /Outer padded|Separate low|Flush recessed|Access frame|Player bench/.test(n.getName()));
    expect(checked.length).toBeGreaterThanOrEqual(6);
    for (const node of checked) {
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute('POSITION')!;
        const indices = primitive.getIndices();
        const count = indices?.getCount() ?? positions.getCount();
        for (let i = 0; i < count; i += 3) {
          const box = new THREE.Box3();
          for (let j = 0; j < 3; j++) {
            const vertex = indices ? indices.getScalar(i + j) : i + j;
            box.expandByPoint(new THREE.Vector3().fromArray(positions.getElement(vertex, [])).applyMatrix4(matrix));
          }
          expect(lanes.some(lane => lane.intersectsBox(box)), `${node.getName()} blocks an entrance`).toBe(false);
        }
      }
    }
    const wall = nodes.find(n => n.getExtras().arenaPart === 'perimeterWall');
    const low = nodes.find(n => n.getExtras().arenaPart === 'lowBoards');
    expect(wall).toBeDefined();
    expect(low).toBeDefined();
    const bounds = (node: NonNullable<typeof wall>) => {
      const box = new THREE.Box3();
      const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()!.listPrimitives()) {
        const positions = primitive.getAttribute('POSITION')!;
        for (let i = 0; i < positions.getCount(); i++) box.expandByPoint(new THREE.Vector3().fromArray(positions.getElement(i, [])).applyMatrix4(matrix));
      }
      return box;
    };
    expect(bounds(wall!).max.y).toBeCloseTo(2.35, 2);
    expect(bounds(low!).max.y).toBeCloseTo(.42, 2);
    const leaves = nodes.filter(n => n.getExtras().role === 'sliding-roof-leaf');
    expect(leaves).toHaveLength(2);
    for (const leaf of leaves) {
      const box = bounds(leaf);
      expect(box.min.x > 16.5 || box.max.x < -16.5).toBe(true);
      expect(box.min.y).toBeGreaterThan(30);
    }
  });
  it('rejects unbounded, foreign, and incompatible manifests', () => {
    expect(() => validateVenueManifest(manifest)).not.toThrow();
    for (const invalid of [null, { ...manifest, bytes: 16*1024*1024 },
      { ...manifest, url: 'https://example.com/arena.glb' }, { ...manifest, compatibility: 'v2' }]) {
      expect(() => validateVenueManifest(invalid)).toThrow();
    }
    expect(() => validateVenueManifest(clayManifest, 'clay-sunset-arena')).not.toThrow();
    expect(() => validateVenueManifest(clayManifest, 'hard-open-arena')).toThrow();
    expect(() => validateVenueManifest(manifest, 'clay-sunset-arena')).toThrow();
    expect(() => validateVenueManifest({ ...clayManifest, url: manifest.url })).toThrow();
    expect(() => validateVenueManifest({ ...manifest, id: 'foreign-arena' })).toThrow();
  });
  it('loads only the activated manager and keeps hard/clay state and cached scenes separate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(
      url.endsWith('.json') ? Response.json(url.includes('clay-sunset-arena') ? clayManifest : manifest) : new Response(bytes),
    )));
    parse.mockImplementation(async () => ({ scene: registeredScene() }));
    const hard = new VenueAssetManager(vi.fn());
    const clay = new VenueAssetManager(vi.fn(), 'clay-sunset-arena');
    clay.setActive(true);
    await vi.waitFor(() => expect(clay.state.status).toBe('ready'));
    expect(hard.state.status).toBe('idle');
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).includes('clay-sunset-arena'))).toBe(true);
    clay.setActive(false);
    hard.setActive(true);
    await vi.waitFor(() => expect(hard.state.status).toBe('ready'));
    expect(clay.group.visible).toBe(false);
    expect(hard.group.visible).toBe(true);
    expect(hard.group.children[0]).not.toBe(clay.group.children[0]);
    hard.setActive(false);
    clay.setActive(true);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(clay.group.visible).toBe(true);
    hard.dispose();
    clay.dispose();
  });
  it('preserves native clay materials, uses fixed light anchors and never disposes borrowed surfaces', async () => {
    serve(clayManifest);
    const scene = registeredScene();
    for (const x of [-20, 20]) for (const z of [-20, 20]) {
      const fixture = new THREE.Object3D();
      fixture.userData.role = 'venue-light';
      fixture.position.set(x, 24.5, z);
      scene.add(fixture);
    }
    parse.mockResolvedValue({ scene });
    const manager = new VenueAssetManager(vi.fn(), 'clay-sunset-arena');
    manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    const lights = scene.children.filter(o => o instanceof THREE.SpotLight);
    expect(lights.map(l => l.position.toArray())).toEqual([[-20,24.5,-20],[-20,24.5,20],[20,24.5,-20],[20,24.5,20]]);
    const court = scene.children.find(o => o.userData.surfaceRole === 'court') as THREE.Mesh;
    const original = court.material;
    const bundle = createSceneMaterialBundle('hard');
    const borrowedDispose = vi.spyOn(bundle.materials.court, 'dispose');
    const originalDispose = vi.spyOn(original as THREE.Material, 'dispose');
    manager.applySurface('clay', bundle, .5);
    expect(court.material).toBe(original);
    expect((court.material as THREE.MeshStandardMaterial).roughness).toBeCloseTo(.85);
    manager.applySurface('hard', bundle, 0);
    expect(court.material).toBe(bundle.materials.court);
    manager.dispose();
    expect(originalDispose).toHaveBeenCalledOnce();
    expect(borrowedDispose).not.toHaveBeenCalled();
    for (const mat of Object.values(bundle.materials).flat()) mat.dispose();
  });
  it('rejects a hard manifest delivered to the clay manager before requesting its GLB', async () => {
    serve(manifest);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new VenueAssetManager(vi.fn(), 'clay-sunset-arena');
    manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('error'));
    expect(fetch).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
    expect(manager.group.visible).toBe(false);
    manager.dispose();
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
