import * as THREE from 'three';
import type { AudienceOccupancy, VenueId } from '../../domain/environment';
import type { AudienceManifest, VenueVariant } from './VenueAssetManager';

export type SeatPlacement = readonly [number, number, number, number];
export type AudienceState = Readonly<{ status: 'empty' | 'loading' | 'ready' | 'error'; count: number; message?: string }>;

export const seatHash = (index: number): number => {
  let x = (index + 1031) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
};

/** Exact half occupancy, stable identities and a strict subset of full. */
export function occupiedSeatIndices(count: number, occupancy: AudienceOccupancy): number[] {
  if (occupancy === 'empty') return [];
  const indices = Array.from({ length: count }, (_, i) => i);
  if (occupancy === 'half') return indices.sort((a, b) => seatHash(a) - seatHash(b)).slice(0, Math.floor(count / 2));
  return indices;
}

export function validateSeatPlacements(value: unknown, expectedCount: number): asserts value is { seats: SeatPlacement[] } {
  const data = value as { version?: number; stride?: number; count?: number; seats?: unknown[] } | null;
  if (!data || data.version !== 1 || data.stride !== 4 || data.count !== expectedCount || !Array.isArray(data.seats)
    || data.seats.length !== expectedCount || expectedCount < 1 || expectedCount > 20000
    || data.seats.some(s => !Array.isArray(s) || s.length !== 4 || s.some(v => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 150))) {
    throw new Error('Invalid audience seat registration');
  }
}

/** One shared pair of sprite textures for the active venue, instanced in spatial
 * chunks. No Sprite objects, skeletons, per-seat updates or blended sorting. */
export class AudienceSystem {
  readonly group = new THREE.Group();
  state: AudienceState = { status: 'empty', count: 0 };
  private key = '';
  private generation = 0;
  private controller: AbortController | null = null;
  private seats: SeatPlacement[] = [];
  private material: THREE.MeshStandardMaterial | null = null;
  private textures: THREE.Texture[] = [];
  private occupancy: AudienceOccupancy = 'empty';
  private time = { value: 0 };
  private motion = { value: 1 };
  private reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  private variant: VenueVariant = 'quality';

  constructor() { this.group.name = 'instanced-seated-audience'; }

  apply(venue: VenueId, descriptor: AudienceManifest | undefined, occupancy: AudienceOccupancy, variant: VenueVariant): void {
    this.occupancy = occupancy;
    this.variant = variant;
    if (occupancy === 'empty' || !descriptor) {
      if (this.key) this.clear();
      return;
    }
    const key = `${venue}:${descriptor.sha256}:${variant}`;
    if (key === this.key) {
      if (this.state.status === 'ready' && this.state.count !== occupiedCount(this.seats.length, occupancy)) this.rebuild();
      return;
    }
    this.clear();
    this.key = key;
    this.state = { status: 'loading', count: 0 };
    void this.load(venue, descriptor, variant);
  }

  update(elapsed: number): void {
    this.time.value = elapsed;
    this.motion.value = this.variant === 'performance' || this.reducedMotion?.matches ? 0 : 1;
  }

  retry(): void { if (this.state.status === 'error') this.key = ''; }

  private async load(venue: VenueId, descriptor: AudienceManifest, variant: VenueVariant): Promise<void> {
    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const bitmaps: ImageBitmap[] = [];
    try {
      if (!Number.isInteger(descriptor.bytes) || descriptor.bytes <= 0 || descriptor.bytes > 2*1024*1024
        || !/^[a-f0-9]{64}$/.test(descriptor.sha256)
        || descriptor.url !== `/assets/venues/${venue}/audience-seats.${descriptor.sha256.slice(0,12)}.json`) throw new Error('Invalid audience manifest');
      const response = await fetch(descriptor.url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Audience seats HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      if (bytes.byteLength !== descriptor.bytes || Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('') !== descriptor.sha256) throw new Error('Audience seats integrity mismatch');
      const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
      validateSeatPlacements(data, descriptor.count);
      // Sequential bitmap ownership ensures abort/error cleanup also covers the
      // first decoded image if the second request fails.
      for (const view of ['front','back']) {
        const image = await fetch(`/assets/audience/spectators-${view}-${variant === 'performance' ? '512' : '1024'}.webp`, { signal: controller.signal });
        if (!image.ok) throw new Error(`Audience artwork HTTP ${image.status}`);
        bitmaps.push(await createImageBitmap(await image.blob(), { imageOrientation: 'flipY' }));
      }
      if (generation !== this.generation) { bitmaps.forEach(b => b.close()); return; }
      this.seats = data.seats;
      this.textures = bitmaps.map(bitmap => {
        const texture = new THREE.Texture(bitmap);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
        return texture;
      });
      const material = new THREE.MeshStandardMaterial({ map: this.textures[0], roughness: .94, side: THREE.DoubleSide });
      material.forceSinglePass = true;
      material.onBeforeCompile = shader => {
        shader.uniforms.audienceTime = this.time;
        shader.uniforms.audienceMotion = this.motion;
        shader.uniforms.audienceBack = { value: this.textures[1] };
        shader.vertexShader = `attribute vec3 audienceStyle; varying vec3 vAudienceStyle; uniform float audienceTime; uniform float audienceMotion;\n${shader.vertexShader}`
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vAudienceStyle = audienceStyle;
            transformed.x += sin(audienceTime * 1.3 + audienceStyle.y) * .012 * audienceStyle.z * audienceMotion * smoothstep(-.5,.6,position.y);`);
        shader.fragmentShader = `varying vec3 vAudienceStyle; uniform sampler2D audienceBack;\n${shader.fragmentShader}`
          .replace('#include <map_fragment>', `
            vec2 localUV = vMapUv;
            if (!gl_FrontFacing) localUV.x = 1.0-localUV.x;
            vec2 tile = vec2(mod(vAudienceStyle.x,4.0),3.0-floor(vAudienceStyle.x/4.0));
            vec2 atlasUV = (clamp(localUV,vec2(.012),vec2(.988)) + tile) / 4.0;
            vec4 person = gl_FrontFacing ? texture2D(map,atlasUV) : texture2D(audienceBack,atlasUV);
            // Generated artwork uses an explicit magenta key. GPU cutout keeps
            // white clothing and avoids transparent sorting / full-quad overdraw.
            if (min(person.r,person.b)-person.g > .12) discard;
            diffuseColor *= person;
          `);
      };
      material.customProgramCacheKey = () => 'seated-audience-v1';
      this.material = material;
      this.rebuild();
    } catch (error) {
      bitmaps.forEach(b => b.close());
      if (generation === this.generation) this.state = { status: 'error', count: 0, message: error instanceof Error ? error.message : 'Audience unavailable' };
    } finally { if (generation === this.generation) this.controller = null; }
  }

  private rebuild(): void {
    this.clearMeshes();
    if (!this.material) return;
    const chunks = new Map<string, number[]>();
    const occupied = occupiedSeatIndices(this.seats.length, this.occupancy);
    for (const i of occupied) {
      const p = this.seats[i]!;
      const key = `${Math.floor(p[0]/20)},${Math.floor(p[2]/20)}`;
      const chunk = chunks.get(key) ?? [];
      chunk.push(i); chunks.set(key, chunk);
    }
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const up = new THREE.Vector3(0,1,0);
    for (const [key, indices] of chunks) {
      const geometry = new THREE.PlaneGeometry(1.3,1.4);
      const styles = new Float32Array(indices.length*3);
      const mesh = new THREE.InstancedMesh(geometry, this.material, indices.length);
      mesh.name = `spectator-chunk-${key}`;
      indices.forEach((id, i) => {
        const p = this.seats[id]!;
        const h = seatHash(id);
        const size = .95 + (h % 11)*.01;
        position.set(p[0] + Math.sin(p[3])*.10,p[1]+.71*size,p[2]+Math.cos(p[3])*.10);
        rotation.setFromAxisAngle(up,p[3]);
        matrix.compose(position,rotation,new THREE.Vector3(size,size,size));
        mesh.setMatrixAt(i,matrix);
        styles.set([h%16,(h%628)/100,h%7===0?1:0],i*3);
      });
      geometry.setAttribute('audienceStyle',new THREE.InstancedBufferAttribute(styles,3));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.computeBoundingSphere();
      // Small shader sway stays inside the culling bound.
      if (mesh.boundingSphere) mesh.boundingSphere.radius += .03;
      this.group.add(mesh);
    }
    this.state = { status: 'ready', count: occupied.length };
  }

  private clearMeshes(): void {
    for (const object of this.group.children) if (object instanceof THREE.InstancedMesh) { object.geometry.dispose(); object.dispose(); }
    this.group.clear();
  }

  private clear(): void {
    this.generation += 1;
    this.controller?.abort(); this.controller = null;
    this.clearMeshes();
    this.material?.dispose(); this.material = null;
    for (const texture of this.textures) { (texture.image as ImageBitmap).close(); texture.dispose(); }
    this.textures = []; this.seats = []; this.key = '';
    this.state = { status: 'empty', count: 0 };
  }

  dispose(): void { this.clear(); this.group.removeFromParent(); }
}

const occupiedCount = (count: number, occupancy: AudienceOccupancy) => occupancy === 'full' ? count : occupancy === 'half' ? Math.floor(count/2) : 0;
