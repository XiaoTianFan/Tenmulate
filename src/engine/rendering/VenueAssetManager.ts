import * as THREE from 'three';
import { COURT, type SurfaceId } from '../../domain/court';
import type { SceneMaterialBundle } from './sceneMaterials';
import { installFilteredNet } from './filteredNet';

export const AUTHORED_VENUES = {
  'hard-open-arena': { surface: 'hard' },
  'clay-sunset-arena': { surface: 'clay' },
  'grass-center-court': { surface: 'grass' },
  'timber-hall': { surface: 'hard' },
  'clay-stadium': { surface: 'clay' },
  'covered-grass-arena': { surface: 'grass' },
} as const;
export type AuthoredVenueId = keyof typeof AUTHORED_VENUES;
export const isAuthoredVenue = (id: string): id is AuthoredVenueId => Object.hasOwn(AUTHORED_VENUES, id);

export type VenueAssetState = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'error' | 'disposed';
  loadedBytes: number;
  totalBytes: number;
  message?: string;
}>;
export type VenueManifest = Readonly<{
  id: AuthoredVenueId; version: number; compatibility: 'tenmulate-court-v1';
  url: string; bytes: number; sha256: string;
  performance?: VenueManifest;
  audience?: AudienceManifest;
}>;
export type VenueVariant = 'quality' | 'performance';
export type AudienceManifest = Readonly<{ url: string; bytes: number; sha256: string; count: number }>;

export const COURT_ASSET_ANCHORS: Readonly<Record<string, readonly number[]>> = {
  court_origin: [0, 0, 0], baseline_near: [0, 0, -COURT.halfLength],
  baseline_far: [0, 0, COURT.halfLength], net_center: [0, COURT.netCenterHeight, 0],
  doubles_left: [-COURT.doublesWidth / 2, 0, 0], doubles_right: [COURT.doublesWidth / 2, 0, 0],
};

export function validateVenueManifest(value: unknown, expectedId?: AuthoredVenueId, variant: VenueVariant = 'quality'): asserts value is VenueManifest {
  const m = value as Partial<VenueManifest> | null;
  if (!m || typeof m.id !== 'string' || !isAuthoredVenue(m.id) || (expectedId && m.id !== expectedId) || m.compatibility !== 'tenmulate-court-v1'
    || m.version !== 1 || !Number.isInteger(m.bytes) || m.bytes! <= 0 || m.bytes! > 15 * 1024 * 1024
    || typeof m.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(m.sha256)
    || typeof m.url !== 'string' || !new RegExp(`^/assets/venues/${m.id}/${m.id}${variant === 'performance' ? '\\.performance' : ''}\\.[a-f0-9]{12}\\.glb$`).test(m.url)
    || (variant === 'performance' && m.bytes! > 4 * 1024 * 1024)) {
    throw new Error('Unsupported arena asset manifest');
  }
}

export function selectVenueVariant(manifest: VenueManifest, variant: VenueVariant): VenueManifest {
  validateVenueManifest(manifest);
  if (variant === 'quality') return manifest;
  validateVenueManifest(manifest.performance, manifest.id, 'performance');
  return manifest.performance;
}

export function validateCourtRegistration(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  for (const [name, expected] of Object.entries(COURT_ASSET_ANCHORS)) {
    const node = root.getObjectByName(name);
    const position = node?.getWorldPosition(new THREE.Vector3());
    if (!position || position.toArray().some((v, i) => Math.abs(v - expected[i]!) > .002)) {
      throw new Error(`Arena court anchor mismatch: ${name}`);
    }
  }
  const roles = new Set<string>();
  root.traverse(object => { if (object instanceof THREE.Mesh) roles.add(String(object.userData.surfaceRole)); });
  if (!roles.has('court') || !roles.has('runoff')) throw new Error('Arena surface metadata is missing');
}

export function disposeVenue(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
    // InstancedMesh owns an instance matrix/color buffer in addition to its shared geometry.
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  for (const mat of materials) {
    for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    mat.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    const data = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) data.close();
    texture.dispose();
  }
}

/** Owns one optional venue. Network work is cancelled on deselection/unmount. */
export class VenueAssetManager {
  readonly group = new THREE.Group();
  state: VenueAssetState = { status: 'idle', loadedBytes: 0, totalBytes: 0 };
  private controller: AbortController | null = null;
  private asset: THREE.Group | null = null;
  private active = false;
  private roofVisible = true;
  private roofTransmission = 0;
  private generation = 0;
  private readonly surfaces = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  variant: VenueVariant = 'quality';
  audienceManifest: AudienceManifest | undefined;

  constructor(private readonly changed: () => void, readonly venueId: AuthoredVenueId = 'hard-open-arena') {
    this.group.name = `blender-${venueId}`;
    this.group.visible = false;
  }

  /** Approximate diffuse light through fabric without a second shadow map.
   * Opaque venues, inactive assets and roof cutaways keep normal full shadows. */
  get sunShadowIntensity(): number {
    return this.active && this.state.status === 'ready' && this.roofVisible
      ? 1 - this.roofTransmission : 1;
  }

  setActive(active: boolean): void {
    if (this.state.status === 'disposed') return;
    this.active = active;
    this.group.visible = active && this.asset !== null;
    if (!active && (this.controller || this.asset || this.state.status === 'error')) this.release();
    if (active && !this.asset && !this.controller && this.state.status !== 'error') void this.load();
  }

  setVariant(variant: VenueVariant): void {
    if (variant === this.variant || this.state.status === 'disposed') return;
    this.variant = variant;
    this.release();
    if (this.active) void this.load();
  }

  retry(): void {
    if (!this.active || this.state.status !== 'error') return;
    this.release();
    void this.load();
  }

  /** Only the active model remains resident. HTTP cache handles reuse. */
  private release(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    for (const [mesh, original] of this.surfaces) mesh.material = original;
    this.surfaces.clear();
    if (this.asset) disposeVenue(this.asset);
    this.group.clear();
    this.group.visible = false;
    this.asset = null;
    this.audienceManifest = undefined;
    this.roofTransmission = 0;
    this.update({ status: 'idle', loadedBytes: 0, totalBytes: 0 });
  }

  applySurface(surface: SurfaceId, bundle: SceneMaterialBundle, wetness: number): void {
    for (const [mesh, original] of this.surfaces) {
      const nativeSurface = surface === AUTHORED_VENUES[this.venueId].surface;
      mesh.material = nativeSurface ? original
        : mesh.userData.surfaceRole === 'court' ? bundle.materials.court : bundle.materials.runoff;
      if (nativeSurface) {
        for (const material of Array.isArray(original) ? original : [original]) {
          if (material instanceof THREE.MeshStandardMaterial) material.roughness = THREE.MathUtils.lerp(surface === 'clay' ? .98 : .9, surface === 'clay' ? .72 : .4, wetness);
        }
      }
    }
  }

  setRoofVisible(visible: boolean): void {
    this.roofVisible = visible;
    this.asset?.traverse(object => { if (object.userData.arenaPart === 'roof') object.visible = visible; });
  }

  private update(state: VenueAssetState): void { this.state = state; this.changed(); }

  private async load(): Promise<void> {
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ status: 'loading', loadedBytes: 0, totalBytes: 0 });
    let parsed: THREE.Group | null = null;
    try {
      const base = `/assets/venues/${this.venueId}/`;
      const response = await fetch(`${base}manifest.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Arena manifest HTTP ${response.status}`);
      const manifestText = await response.text();
      // A stale dev-server public index or a missing deployed file can return
      // the SPA shell with HTTP 200. Keep this distinct from corrupt model data.
      if (response.headers.get('content-type')?.includes('text/html') || manifestText.trimStart().startsWith('<')) {
        throw new Error(`Missing venue data for ${this.venueId}: the server returned a web page. Restart the local dev server or check the deployed venue assets, then retry.`);
      }
      let catalog: unknown;
      try { catalog = JSON.parse(manifestText); }
      catch { throw new Error(`Invalid venue manifest JSON for ${this.venueId}`); }
      validateVenueManifest(catalog, this.venueId);
      const manifest = selectVenueVariant(catalog, this.variant);
      const model = await fetch(manifest.url, { signal: controller.signal });
      if (!model.ok) throw new Error(`Arena model HTTP ${model.status}`);
      const chunks: Uint8Array[] = [];
      let loadedBytes = 0;
      const reader = model.body?.getReader();
      if (!reader) throw new Error('Arena response has no body');
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        loadedBytes += value.byteLength;
        if (loadedBytes > manifest.bytes) { await reader.cancel(); throw new Error('Arena asset exceeds its declared size'); }
        chunks.push(value);
        if (generation === this.generation) this.update({ status: 'loading', loadedBytes, totalBytes: manifest.bytes });
      }
      if (loadedBytes !== manifest.bytes) throw new Error('Incomplete arena download');
      const bytes = new Uint8Array(loadedBytes);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== manifest.sha256) throw new Error('Arena content hash mismatch');
      if (generation !== this.generation) return;
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/libs/meshopt_decoder.module.js'),
      ]);
      if (generation !== this.generation) return;
      parsed = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
        .parseAsync(bytes.buffer, base)).scene;
      if (generation !== this.generation) { disposeVenue(parsed); return; }
      validateCourtRegistration(parsed);
      parsed.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.receiveShadow = true;
        // A million seat triangles need not be redrawn into every shadow pass.
        object.castShadow = !(object instanceof THREE.InstancedMesh) && !/seat pedestals|net cords/i.test(object.name);
        if (object.userData.surfaceRole) object.castShadow = false;
        // Single-sided architectural sheets must still block sunlight from
        // either side. Visible material culling is unchanged.
        if (object.userData.arenaPart === 'roof') {
          for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.shadowSide = THREE.DoubleSide;
        }
        // Dense roof fabric participates in the architectural shadow pass.
        // Excluding it leaves high-contrast truss stripes across the playing area.
        // Visible rough transmission remains glTF-owned; depth shadows approximate
        // the fabric's continuous shade without changing other venues' lighting.
        if (object.userData.roofMembrane === true) {
          object.castShadow = true;
          for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
            mat.forceSinglePass = true;
            if (mat instanceof THREE.MeshPhysicalMaterial && Number.isFinite(mat.transmission)) {
              this.roofTransmission = Math.max(this.roofTransmission, THREE.MathUtils.clamp(mat.transmission, 0, .5));
            }
          }
        }
        if (object.userData.surfaceRole) this.surfaces.set(object, object.material);
      });
      installFilteredNet(parsed);
      const fixtures: THREE.Object3D[] = [];
      parsed.traverse(object => { if (object.userData.role === 'venue-light') fixtures.push(object); });
      // Legacy hard-arena anchors describe only two sides; preserve its four fixtures.
      const positions = fixtures.length === 4 ? fixtures.map(o => o.getWorldPosition(new THREE.Vector3()))
        : [-18, 18].flatMap(x => [-20, 20].map(z => new THREE.Vector3(x, 24, z)));
      for (const [index, position] of positions.entries()) {
        const light = new THREE.SpotLight(0xe7f2ff, 0, 110, .95, .65, 2);
        light.position.copy(position);
        light.userData.baseIntensity = Number(fixtures[index]?.userData.intensity) || 4500;
        light.target.position.set(0, 0, position.z * .2);
        parsed.add(light, light.target);
      }
      this.asset = parsed;
      this.audienceManifest = catalog.audience;
      this.setRoofVisible(this.roofVisible);
      this.group.add(parsed);
      this.group.visible = this.active;
      this.update({ status: 'ready', loadedBytes, totalBytes: manifest.bytes });
    } catch (error) {
      if (parsed && parsed !== this.asset) disposeVenue(parsed);
      if (generation === this.generation) {
        this.update({ status: 'error', loadedBytes: 0, totalBytes: 0,
          message: error instanceof Error ? error.message : 'Arena unavailable' });
        console.warn('Venue could not load. Retry or choose another venue.', error);
      }
    } finally {
      if (generation === this.generation) this.controller = null;
    }
  }

  dispose(): void {
    if (this.state.status === 'disposed') return;
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    // Restore owned materials before disposal: alternative surfaces borrow the court bundle.
    for (const [mesh, original] of this.surfaces) mesh.material = original;
    this.surfaces.clear();
    this.group.removeFromParent();
    if (this.asset) disposeVenue(this.asset);
    this.group.clear();
    this.asset = null;
    this.state = { status: 'disposed', loadedBytes: 0, totalBytes: 0 };
  }
}
