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
const grassManifest = { ...manifest, id: 'grass-center-court',
  url: '/assets/venues/grass-center-court/grass-center-court.abcdef123456.glb' };
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
  it.each(['timber-hall', 'clay-stadium', 'covered-grass-arena'] as const)(
    'explains an HTML manifest response for %s and recovers on retry', async venueId => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><html>App shell</html>',
        { headers: { 'content-type': 'text/html' } })));
      const manager = new VenueAssetManager(vi.fn(), venueId);
      manager.setActive(true);
      await vi.waitFor(() => expect(manager.state.status).toBe('error'));
      expect(manager.state.message).toContain(venueId);
      expect(manager.state.message).toContain('Restart the local dev server');
      expect(fetch).toHaveBeenCalledOnce();
      expect(parse).not.toHaveBeenCalled();
      expect(manager.group.visible).toBe(false);
      serve({ ...manifest, id: venueId, url: `/assets/venues/${venueId}/${venueId}.abcdef123456.glb` });
      parse.mockResolvedValue({ scene: registeredScene() });
      manager.retry();
      await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
      expect(manager.group.visible).toBe(true);
      manager.dispose();
    },
  );
  it('detects an HTML body even without its content type and identifies malformed JSON', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('  <!doctype html><html>App shell</html>')));
    const manager = new VenueAssetManager(vi.fn());
    manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('error'));
    expect(manager.state.message).toContain('server returned a web page');
    vi.mocked(fetch).mockResolvedValue(new Response('{broken JSON'));
    manager.retry();
    await vi.waitFor(() => expect(manager.state.status).toBe('error'));
    expect(manager.state.message).toBe('Invalid venue manifest JSON for hard-open-arena');
    expect(parse).not.toHaveBeenCalled();
    manager.dispose();
  });
  it('selects Performance before download and fails closed if the variant is missing', async () => {
    const performance = { ...manifest, url: '/assets/venues/hard-open-arena/hard-open-arena.performance.abcdef123456.glb' };
    serve({ ...manifest, performance } as typeof manifest);
    parse.mockImplementation(async () => ({ scene: registeredScene() }));
    const manager = new VenueAssetManager(vi.fn());
    manager.setVariant('performance'); manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      '/assets/venues/hard-open-arena/manifest.json', performance.url]);
    manager.dispose();
    serve(); vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = new VenueAssetManager(vi.fn()); missing.setVariant('performance'); missing.setActive(true);
    await vi.waitFor(() => expect(missing.state.status).toBe('error'));
    expect(fetch).toHaveBeenCalledOnce(); expect(missing.group.children).toHaveLength(0); missing.dispose();
  });
  it('disposes a stale Quality parse after a variant switch and recovers from a failed transfer', async () => {
    const performance = { ...manifest, url: '/assets/venues/hard-open-arena/hard-open-arena.performance.abcdef123456.glb' };
    serve({ ...manifest, performance } as typeof manifest);
    let finish: ((result: { scene: THREE.Group }) => void) | undefined;
    parse.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockImplementation(async () => ({ scene: registeredScene() }));
    const manager = new VenueAssetManager(vi.fn()); manager.setActive(true);
    await vi.waitFor(() => expect(finish).toBeDefined());
    manager.setVariant('performance');
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    const stale = registeredScene(); const disposed = vi.spyOn((stale.children.find(o => o instanceof THREE.Mesh) as THREE.Mesh).geometry, 'dispose');
    finish!({ scene: stale }); await vi.waitFor(() => expect(disposed).toHaveBeenCalledOnce());
    expect(manager.group.children).not.toContain(stale); manager.dispose();
    serve(); vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    const retry = new VenueAssetManager(vi.fn()); retry.setActive(true);
    await vi.waitFor(() => expect(retry.state.status).toBe('error'));
    retry.retry(); await vi.waitFor(() => expect(retry.state.status).toBe('ready')); retry.dispose();
  });
  it('keeps the stadium, shade and surface overrides until its replacement is complete', async () => {
    const performance = { ...manifest, url: '/assets/venues/hard-open-arena/hard-open-arena.performance.abcdef123456.glb' };
    const audience = { url: '/seats.json', bytes: 12, sha256: 'abc', count: 4 };
    serve({ ...manifest, performance, audience } as typeof manifest);
    const current = registeredScene(), replacement = registeredScene();
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial({ transmission: .3 }));
    roof.userData.roofMembrane = true; current.add(roof);
    let finish: ((result: { scene: THREE.Group }) => void) | undefined;
    parse.mockResolvedValueOnce({ scene: current }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const changed = vi.fn(), manager = new VenueAssetManager(changed);
    manager.setActive(true); await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    const court = current.children.find(o => o.userData.surfaceRole === 'court') as THREE.Mesh;
    const original = court.material as THREE.Material;
    const originalDispose = vi.spyOn(original, 'dispose');
    const bundle = createSceneMaterialBundle('clay');
    const borrowedDispose = vi.spyOn(bundle.materials.court, 'dispose');
    manager.applySurface('clay', bundle, 0);
    changed.mockImplementation(() => {
      expect(manager.hasAsset).toBe(true);
      expect(manager.group.children).toHaveLength(1);
      expect(manager.group.visible).toBe(true);
    });
    manager.setVariant('performance');
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(manager.state.status).toBe('loading');
    expect(manager.group.children).toEqual([current]);
    expect(manager.renderedVariant).toBe('quality');
    expect(manager.sunShadowIntensity).toBeCloseTo(.7);
    expect(manager.audienceManifest).toEqual(audience);
    expect(court.material).toBe(bundle.materials.court);
    expect(originalDispose).not.toHaveBeenCalled();
    finish!({ scene: replacement });
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(manager.group.children).toEqual([replacement]);
    expect(manager.renderedVariant).toBe('performance');
    expect(manager.sunShadowIntensity).toBe(1);
    expect(originalDispose).toHaveBeenCalledOnce();
    expect(borrowedDispose).not.toHaveBeenCalled();
    manager.dispose();
    for (const mat of Object.values(bundle.materials)) mat.dispose();
  });
  it('keeps the committed variant on failed replacement and replaces it on retry', async () => {
    const performance = { ...manifest, url: '/assets/venues/hard-open-arena/hard-open-arena.performance.abcdef123456.glb' };
    serve({ ...manifest, performance } as typeof manifest);
    const current = registeredScene(), replacement = registeredScene();
    parse.mockResolvedValueOnce({ scene: current }).mockRejectedValueOnce(new Error('Replacement failed')).mockResolvedValueOnce({ scene: replacement });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new VenueAssetManager(vi.fn()); manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    manager.setVariant('performance');
    await vi.waitFor(() => expect(manager.state.status).toBe('error'));
    expect(manager.state.message).toBe('Replacement failed');
    expect(manager.hasAsset && manager.group.visible).toBe(true);
    expect(manager.group.children).toEqual([current]);
    expect(manager.renderedVariant).toBe('quality');
    manager.retry();
    expect(manager.group.children).toEqual([current]);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(manager.group.children).toEqual([replacement]);
    expect(manager.renderedVariant).toBe('performance');
    manager.dispose();
  });
  it.each(['quality', 'inactive', 'disposed'] as const)('cancels a staged replacement when returning to %s', async action => {
    const performance = { ...manifest, url: '/assets/venues/hard-open-arena/hard-open-arena.performance.abcdef123456.glb' };
    serve({ ...manifest, performance } as typeof manifest);
    const current = registeredScene();
    let finish: ((result: { scene: THREE.Group }) => void) | undefined;
    parse.mockResolvedValueOnce({ scene: current }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const manager = new VenueAssetManager(vi.fn()); manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    manager.setVariant('performance'); await vi.waitFor(() => expect(finish).toBeDefined());
    if (action === 'quality') manager.setVariant('quality');
    else if (action === 'inactive') manager.setActive(false);
    else manager.dispose();
    const stale = registeredScene(), mesh = stale.children.find(o => o instanceof THREE.Mesh) as THREE.Mesh;
    const disposed = vi.spyOn(mesh.geometry, 'dispose');
    finish!({ scene: stale }); await vi.waitFor(() => expect(disposed).toHaveBeenCalledOnce());
    expect(manager.group.children).toEqual(action === 'quality' ? [current] : []);
    expect(manager.state.status).toBe(action === 'quality' ? 'ready' : action === 'inactive' ? 'idle' : 'disposed');
    expect(manager.renderedVariant).toBe(action === 'quality' ? 'quality' : null);
    manager.dispose();
  });
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
    expect(() => validateVenueManifest(grassManifest, 'grass-center-court')).not.toThrow();
    expect(() => validateVenueManifest(grassManifest, 'clay-sunset-arena')).toThrow();
    expect(() => validateVenueManifest(clayManifest, 'grass-center-court')).toThrow();
  });
  it('loads only the activated manager and releases deselected scenes', async () => {
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
    await vi.waitFor(() => expect(clay.state.status).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(hard.group.children).toHaveLength(0);
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
  it('loads grass independently, preserves native turf and releases its completed scene', async () => {
    serve(grassManifest);
    const scene = registeredScene();
    parse.mockResolvedValue({scene});
    const grass = new VenueAssetManager(vi.fn(),'grass-center-court');
    const hard = new VenueAssetManager(vi.fn(),'hard-open-arena');
    const clay = new VenueAssetManager(vi.fn(),'clay-sunset-arena');
    expect(fetch).not.toHaveBeenCalled();
    grass.setActive(true);
    await vi.waitFor(()=>expect(grass.state.status).toBe('ready'));
    expect(hard.state.status).toBe('idle');
    expect(clay.state.status).toBe('idle');
    expect(vi.mocked(fetch).mock.calls.every(([url])=>String(url).includes('grass-center-court'))).toBe(true);
    const mesh=scene.children.find(o=>o.userData.surfaceRole==='court') as THREE.Mesh;
    const native=mesh.material;
    const bundle=createSceneMaterialBundle('clay');
    grass.applySurface('grass',bundle,0);
    expect(mesh.material).toBe(native);
    grass.applySurface('clay',bundle,0);
    expect(mesh.material).toBe(bundle.materials.court);
    grass.applySurface('grass',bundle,0);
    expect(mesh.material).toBe(native);
    grass.setActive(false);
    expect(grass.group.children).toHaveLength(0);
    grass.setActive(true);
    await vi.waitFor(() => expect(grass.state.status).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(grass.group.visible).toBe(true);
    grass.dispose(); hard.dispose(); clay.dispose();
    for (const mat of Object.values(bundle.materials).flat()) mat.dispose();
  });
  it('keeps dense fabric and roof trusses casting continuous shade with cutaway visibility', async () => {
    serve(clayManifest);
    const scene = registeredScene();
    const skin = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial({
      transmission:.32, roughness:.58, side:THREE.DoubleSide,
    }));
    skin.userData={arenaPart:'roof',roofMembrane:true};
    const truss = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    truss.userData.arenaPart='roof';
    scene.add(skin,truss);
    parse.mockResolvedValue({scene});
    const manager = new VenueAssetManager(vi.fn(),'clay-sunset-arena');
    expect(manager.sunShadowIntensity).toBe(1);
    manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(manager.sunShadowIntensity).toBeCloseTo(.68);
    expect(skin.castShadow).toBe(true);
    expect(skin.material.shadowSide).toBe(THREE.DoubleSide);
    expect(skin.material.transparent).toBe(false);
    expect(skin.material.transmission).toBe(.32);
    expect(skin.material.roughness).toBe(.58);
    expect(skin.material.forceSinglePass).toBe(true);
    expect(truss.castShadow).toBe(true);
    expect(truss.material.shadowSide).toBe(THREE.DoubleSide);
    manager.setRoofVisible(false);
    expect(manager.sunShadowIntensity).toBe(1);
    expect(skin.visible || truss.visible).toBe(false);
    manager.setRoofVisible(true);
    expect(manager.sunShadowIntensity).toBeCloseTo(.68);
    expect(skin.visible && truss.visible).toBe(true);
    manager.setActive(false);
    expect(manager.sunShadowIntensity).toBe(1);
    manager.setActive(true);
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(manager.sunShadowIntensity).toBeCloseTo(.68);
    manager.dispose();
    expect(manager.sunShadowIntensity).toBe(1);
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
    await vi.waitFor(() => expect(manager.state.status).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(4);
    manager.dispose();
    expect(manager.group.children).toHaveLength(0);
  });
  it('shows an error on content corruption without parsing or substituting another venue', async () => {
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
