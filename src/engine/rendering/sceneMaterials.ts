import * as THREE from 'three';
import type { SurfaceId } from '../../domain/court';

export type SceneMaterialLibrary = Readonly<{
  court: THREE.MeshStandardMaterial;
  runoff: THREE.MeshStandardMaterial;
  line: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  lightMetal: THREE.MeshStandardMaterial;
  blueSeat: THREE.MeshStandardMaterial;
  greenSeat: THREE.MeshStandardMaterial;
  warmSeat: THREE.MeshStandardMaterial;
  paleSeat: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  paleConcrete: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  fence: THREE.LineBasicMaterial;
  fencePost: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  warmWall: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  clayStone: THREE.MeshStandardMaterial;
  terracotta: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  hedge: THREE.MeshStandardMaterial;
  foliage: readonly THREE.MeshStandardMaterial[];
  trunk: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  darkWall: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
}>;

export type SceneMaterialBundle = Readonly<{
  materials: SceneMaterialLibrary;
  surfaceMaps: Readonly<Record<SurfaceId, THREE.Texture>>;
  runoffMaps: Readonly<Record<SurfaceId, THREE.Texture>>;
  textures: readonly THREE.Texture[];
}>;

const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const createSurfaceTexture = (
  color: number,
  seed: number,
  variation: number,
  repeatX: number,
  repeatY: number,
  stripeStrength = 0,
): THREE.DataTexture => {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  const base = new THREE.Color(color);
  const random = seededRandom(seed);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const grain = (random() - 0.5) * variation;
      const stripe = stripeStrength === 0 ? 0 : (((x >> 3) % 2 === 0 ? 1 : -1) * stripeStrength);
      const index = (y * size + x) * 4;
      data[index] = Math.round(THREE.MathUtils.clamp((base.r + grain + stripe) * 255, 0, 255));
      data[index + 1] = Math.round(THREE.MathUtils.clamp((base.g + grain + stripe) * 255, 0, 255));
      data[index + 2] = Math.round(THREE.MathUtils.clamp((base.b + grain + stripe) * 255, 0, 255));
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

const createMicroNormalTexture = (seed: number, repeatX: number, repeatY: number): THREE.DataTexture => {
  const size = 96;
  const random = seededRandom(seed);
  const heights = new Float32Array(size * size);
  for (let index = 0; index < heights.length; index += 1) heights[index] = random();
  const data = new Uint8Array(size * size * 4);
  const sample = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * 0.32;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * 0.32;
      const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
      const index = (y * size + x) * 4;
      data[index] = Math.round((normal.x * 0.5 + 0.5) * 255);
      data[index + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      data[index + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

const standard = (color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial => (
  new THREE.MeshStandardMaterial({ color, roughness, metalness })
);

export const createSceneMaterialBundle = (surface: SurfaceId): SceneMaterialBundle => {
  const hard = createSurfaceTexture(0x3b83b8, 81, 0.018, 7, 15);
  const clay = createSurfaceTexture(0xb55e35, 143, 0.075, 10, 22);
  const grass = createSurfaceTexture(0x477b3d, 277, 0.04, 8, 18, 0.018);
  const runoff = createSurfaceTexture(0x6f965f, 391, 0.018, 8, 14);
  const concrete = createSurfaceTexture(0xb3b4ae, 503, 0.045, 8, 8);
  const timber = createSurfaceTexture(0x9a6742, 631, 0.045, 2, 10, 0.012);
  const roof = createSurfaceTexture(0x87939a, 719, 0.026, 14, 2, 0.014);
  const courtNormal = createMicroNormalTexture(809, 12, 24);
  const runoffNormal = createMicroNormalTexture(907, 12, 22);
  const surfaceMaps: Readonly<Record<SurfaceId, THREE.Texture>> = { hard, clay, grass };
  const runoffMaps: Readonly<Record<SurfaceId, THREE.Texture>> = { hard: runoff, clay, grass };

  const court = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: surfaceMaps[surface],
    normalMap: courtNormal,
    normalScale: new THREE.Vector2(0.16, 0.16),
    roughness: surface === 'hard' ? 0.78 : 0.94,
  });

  return {
    textures: [hard, clay, grass, runoff, concrete, timber, roof, courtNormal, runoffNormal],
    surfaceMaps,
    runoffMaps,
    materials: {
      court,
      runoff: new THREE.MeshStandardMaterial({ color: 0xffffff, map: runoff, normalMap: runoffNormal, normalScale: new THREE.Vector2(0.12, 0.12), roughness: 0.92 }),
      line: standard(0xf5f4e9, 0.78),
      darkMetal: standard(0x172127, 0.42, 0.58),
      lightMetal: standard(0x718087, 0.4, 0.7),
      blueSeat: new THREE.MeshStandardMaterial({ color: 0x176ea8, roughness: 0.52, metalness: 0.08, emissive: 0x0c3450, emissiveIntensity: 0.34 }),
      greenSeat: new THREE.MeshStandardMaterial({ color: 0x1d5944, roughness: 0.6, emissive: 0x071f17, emissiveIntensity: 0.28 }),
      warmSeat: new THREE.MeshStandardMaterial({ color: 0x825236, roughness: 0.7, emissive: 0x28150c, emissiveIntensity: 0.22 }),
      paleSeat: standard(0xd6ddda, 0.7),
      concrete: new THREE.MeshStandardMaterial({ color: 0xffffff, map: concrete, roughness: 0.9 }),
      paleConcrete: standard(0xd8d5ca, 0.9),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x90b8c6, roughness: 0.1, metalness: 0.05, transmission: 0.1, transparent: true, opacity: 0.62 }),
      fence: new THREE.LineBasicMaterial({ color: 0x4f6b60, transparent: true, opacity: 0.28 }),
      fencePost: standard(0x38544a, 0.48, 0.62),
      timber: new THREE.MeshStandardMaterial({ color: 0xffffff, map: timber, roughness: 0.72, emissive: 0x2a160c, emissiveIntensity: 0.2 }),
      warmWall: standard(0xe3dfd0, 0.86),
      roof: new THREE.MeshStandardMaterial({ color: 0xffffff, map: roof, roughness: 0.58, metalness: 0.36, emissive: 0x1a2226, emissiveIntensity: 0.3 }),
      clayStone: standard(0xc7a273, 0.94),
      terracotta: standard(0xa94f2d, 0.88),
      grass: standard(0x3e7041, 0.96),
      hedge: standard(0x285737, 0.96),
      foliage: [standard(0x2c6941, 0.96), standard(0x397b4a, 0.94), standard(0x1e5237, 0.98)],
      trunk: standard(0x5e4935, 0.98),
      lamp: new THREE.MeshStandardMaterial({ color: 0xf2f4e9, emissive: 0xd9e8ff, emissiveIntensity: 0.38, roughness: 0.28 }),
      darkWall: standard(0x242c30, 0.82),
      ceiling: new THREE.MeshStandardMaterial({ color: 0xdbe1df, roughness: 0.78, emissive: 0x4b5250, emissiveIntensity: 0.24 }),
    },
  };
};

export const applyCourtSurface = (bundle: SceneMaterialBundle, surface: SurfaceId): void => {
  bundle.materials.court.map = bundle.surfaceMaps[surface];
  bundle.materials.runoff.map = bundle.runoffMaps[surface];
  bundle.materials.court.roughness = surface === 'hard' ? 0.78 : 0.94;
  bundle.materials.court.needsUpdate = true;
  bundle.materials.runoff.needsUpdate = true;
};
