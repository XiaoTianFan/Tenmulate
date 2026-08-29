import * as THREE from 'three';
import { VENUE_IDS, type VenueId } from '../../domain/environment';
import type { SceneMaterialLibrary } from './sceneMaterials';
import { box } from './scenePrimitives';
import {
  createBleachers,
  createBroadleafTree,
  createChainLinkPanel,
  createCypressTree,
  createFenceEnclosure,
  createHedge,
  createLightPole,
} from './sceneProps';

const createSkyDome = (horizon: number, zenith: number, cloudAmount = 0.38): THREE.Mesh => {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      horizonColor: { value: new THREE.Color(horizon) },
      zenithColor: { value: new THREE.Color(zenith) },
      cloudAmount: { value: cloudAmount },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 horizonColor;
      uniform vec3 zenithColor;
      uniform float cloudAmount;
      varying vec3 vDirection;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + vec2(1.7, 2.4);
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        float blend = pow(clamp(vDirection.y * 0.85 + 0.18, 0.0, 1.0), 0.72);
        vec3 sky = mix(horizonColor, zenithColor, blend);
        vec2 cloudUv = vDirection.xz * 3.4 / max(0.32, vDirection.y + 0.54);
        float cloudNoise = fbm(cloudUv);
        float altitudeMask = smoothstep(0.02, 0.2, vDirection.y) * (1.0 - smoothstep(0.56, 0.82, vDirection.y));
        float clouds = smoothstep(0.61, 0.77, cloudNoise) * altitudeMask * cloudAmount;
        vec3 cloudColor = mix(vec3(0.78, 0.84, 0.88), vec3(1.0), smoothstep(0.62, 0.88, cloudNoise));
        gl_FragColor = vec4(mix(sky, cloudColor, clouds), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(96, 32, 18), material);
  sky.name = 'procedural-sky-dome';
  sky.renderOrder = -10;
  return sky;
};

const createOutdoorClubhouse = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'clubhouse-and-veranda';
  group.add(box(18, 0.18, 6.8, materials.paleConcrete, 0, 0.09, 0));
  group.add(box(15.4, 3.75, 5.3, materials.warmWall, 0, 2.05, 0.55));
  group.add(box(15.9, 0.22, 2.25, materials.paleConcrete, 0, 0.28, -2.9));
  group.add(box(15.9, 0.16, 1.8, materials.paleConcrete, 0, 0.52, -2.55));

  for (const x of [-6.5, -3.25, 0, 3.25, 6.5]) {
    group.add(box(0.18, 3.2, 0.18, materials.paleConcrete, x, 2.15, -2.15));
  }
  for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) {
    group.add(box(1.5, 2.25, 0.08, materials.glass, x, 1.65, -2.12));
    group.add(box(0.09, 2.35, 0.12, materials.darkMetal, x - 0.8, 1.65, -2.1));
    group.add(box(0.09, 2.35, 0.12, materials.darkMetal, x + 0.8, 1.65, -2.1));
  }

  const leftRoof = box(16.9, 0.2, 4.1, materials.roof, 0, 4.16, -1.65);
  leftRoof.rotation.x = -0.28;
  const rightRoof = box(16.9, 0.2, 4.1, materials.roof, 0, 4.16, 2.15);
  rightRoof.rotation.x = 0.28;
  group.add(leftRoof, rightRoof);
  group.add(box(17.1, 0.16, 0.14, materials.lightMetal, 0, 4.43, 0.25));

  for (const x of [-7.25, 7.25]) {
    const planter = box(1.15, 0.55, 1.15, materials.paleConcrete, x, 0.36, -3.1);
    group.add(planter);
    group.add(createHedge(materials, 0.92, 0.72, 0.92, x, -3.1));
  }
  for (const x of [-6.1, -4.7, -1.2, 1.2, 4.7, 6.1]) {
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), materials.foliage[Math.abs(Math.round(x)) % materials.foliage.length]);
    shrub.position.set(x, 0.72, -2.72);
    shrub.scale.set(1, 1.35, 0.72);
    shrub.castShadow = true;
    group.add(shrub);
  }
  for (const roofX of [-7.2, -5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4, 7.2]) {
    const frontSeam = box(0.035, 0.06, 4.02, materials.lightMetal, roofX, 4.29, -1.65);
    frontSeam.rotation.x = -0.28;
    const rearSeam = box(0.035, 0.06, 4.02, materials.lightMetal, roofX, 4.29, 2.15);
    rearSeam.rotation.x = 0.28;
    group.add(frontSeam, rearSeam);
  }

  for (const child of [...group.children]) child.position.y += 2.6;
  group.add(box(18.6, 2.6, 7.1, materials.paleConcrete, 0, 1.3, 0));
  group.add(box(19.4, 0.18, 7.8, materials.concrete, 0, 2.57, -0.08));
  for (let step = 0; step < 12; step += 1) {
    group.add(box(5.2 + step * 0.36, 0.22, 0.52, materials.paleConcrete, 0, 0.12 + step * 0.22, -6.45 + step * 0.38));
  }
  for (const side of [-1, 1]) {
    group.add(box(5.1, 0.07, 0.07, materials.darkMetal, side * 5.85, 3.55, -3.35));
    for (const xOffset of [-2.4, 0, 2.4]) {
      group.add(box(0.06, 0.9, 0.06, materials.darkMetal, side * 5.85 + xOffset, 3.12, -3.35));
    }
  }
  group.position.set(0, 0, 22.25);
  return group;
};

const createOutdoorClub = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-outdoor-club';
  group.add(createSkyDome(0xb9ddf2, 0x4f98d1));
  group.add(box(58, 0.16, 76, materials.grass, 0, -0.18, 3));
  group.add(createFenceEnclosure(materials));
  group.add(createBleachers(materials, -1, 4, 12, 9.4));
  group.add(createBleachers(materials, 1, 4, 12, 9.4));
  const windscreen = new THREE.MeshStandardMaterial({ color: 0x174d3a, roughness: 0.92, transparent: true, opacity: 0.9 });
  group.add(box(21.8, 1.7, 0.045, windscreen, 0, 0.9, 16.18));
  group.add(createOutdoorClubhouse(materials));
  group.add(createHedge(materials, 8, 1.6, 1.5, -7.2, 17.5));
  group.add(createHedge(materials, 8, 1.6, 1.5, 7.2, 17.5));

  for (const [x, z] of [[-13.2, -14], [13.2, -14], [-13.2, 12.2], [13.2, 12.2]] as const) {
    group.add(createLightPole(materials, x, z, z < 0 ? 1 : -1));
  }
  const treePositions: readonly [number, number, number, number][] = [
    [-17, 13, 1.2, 0], [-14.5, 20.5, 1.45, 1], [-10.8, 25.5, 1.1, 2], [-19, 1, 1.25, 1],
    [17, 12.5, 1.3, 1], [14.8, 21.5, 1.48, 0], [10.8, 25.8, 1.05, 2], [19, 0, 1.2, 0],
    [-7.5, 28, 1.2, 1], [7.6, 28.5, 1.22, 0], [-22, 20, 1.45, 2], [22, 20, 1.4, 1],
    [-11, 29, 1.26, 0], [-4.5, 30, 1.18, 2], [4.4, 30, 1.2, 1], [11, 29, 1.28, 2],
  ];
  for (const [x, z, scale, variant] of treePositions) group.add(createBroadleafTree(materials, x, z, scale, variant));
  return group;
};

const createClayTerrace = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-terrace';
  group.add(createSkyDome(0xe7b681, 0x739fc1, 0.16));
  group.add(box(62, 0.18, 78, materials.clayStone, 0, -0.19, 4));
  group.add(createFenceEnclosure(materials, 22, 36.5, 3));
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 4; tier += 1) {
      const x = side * (8 + tier * 0.72);
      group.add(box(0.78, 0.42 + tier * 0.36, 15.5, materials.clayStone, x, (0.42 + tier * 0.36) / 2, 3));
      group.add(box(0.62, 0.08, 15.1, materials.terracotta, x - side * 0.05, 0.48 + tier * 0.36, 3));
    }
  }
  group.add(box(22, 2.6, 1.2, materials.clayStone, 0, 1.3, 19));
  group.add(box(12, 3.8, 4.2, materials.warmWall, 0, 2.05, 22.2));
  const roof = box(13, 0.22, 5.2, materials.terracotta, 0, 4.15, 22.2);
  roof.rotation.x = 0.03;
  group.add(roof);
  for (const x of [-4.2, 0, 4.2]) group.add(box(2.3, 2.3, 0.1, materials.glass, x, 1.75, 20.06));
  for (const side of [-1, 1]) {
    for (let z = -10; z <= 25; z += 6.8) group.add(createCypressTree(materials, side * 15.2, z, 1 + ((z + 10) % 3) * 0.08));
  }
  return group;
};

const createGrassParkNight = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-grass-park-night';
  group.add(createSkyDome(0x101f2a, 0x030811, 0));
  group.add(box(66, 0.18, 82, materials.grass, 0, -0.2, 3));
  group.add(createFenceEnclosure(materials, 23, 37, 2.8));
  group.add(createBleachers(materials, -1, 3, 10, 8));
  group.add(createBleachers(materials, 1, 3, 10, 8));
  for (const [x, z] of [[-12.8, -13], [12.8, -13], [-12.8, 13], [12.8, 13]] as const) {
    group.add(createLightPole(materials, x, z, z < 0 ? 1 : -1));
  }
  group.add(createHedge(materials, 24, 1.8, 1.8, 0, 18.2));
  for (let index = 0; index < 16; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const z = -15 + Math.floor(index / 2) * 6;
    group.add(createBroadleafTree(materials, side * (16 + (index % 3)), z, 1.3 + (index % 4) * 0.08, index));
  }
  return group;
};

const addIndoorShell = (
  group: THREE.Group,
  materials: SceneMaterialLibrary,
  wallMaterial: THREE.Material,
  width: number,
  height: number,
  length: number,
): void => {
  group.add(box(width, height, 0.25, wallMaterial, 0, height / 2, length / 2));
  group.add(box(0.25, height, length, wallMaterial, -width / 2, height / 2, 0));
  group.add(box(0.25, height, length, wallMaterial, width / 2, height / 2, 0));
  for (let z = -length / 2 + 2; z <= length / 2; z += 5.5) {
    group.add(box(width - 0.35, 0.13, 0.18, materials.darkMetal, 0, height - 0.35, z));
  }
};

const createTimberHall = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-timber-hall';
  group.add(box(36, 0.18, 58, materials.concrete, 0, -0.2, 1));
  addIndoorShell(group, materials, materials.warmWall, 30, 9.4, 47);
  group.add(box(29.6, 2.2, 0.3, materials.timber, 0, 1.1, 23.35));
  for (const side of [-1, 1]) {
    group.add(box(0.28, 2.2, 46.5, materials.timber, side * 14.82, 1.1, 0));
    for (let z = -15; z <= 17; z += 5.4) group.add(box(0.12, 4.8, 0.18, materials.timber, side * 14.66, 5.5, z));
    group.add(createBleachers(materials, side as -1 | 1, 3, 11, 8.6));
  }
  for (let x = -10; x <= 10; x += 5) group.add(box(3.2, 2.5, 0.1, materials.glass, x, 5.6, 23.2));
  for (let z = -18; z <= 18; z += 6) group.add(box(5.8, 0.08, 0.8, materials.lamp, 0, 8.75, z));
  return group;
};

const createClayStadium = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-stadium';
  group.add(box(48, 0.18, 68, materials.darkWall, 0, -0.2, 2));
  addIndoorShell(group, materials, materials.darkWall, 42, 14, 58);
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 9; tier += 1) {
      const x = side * (8 + tier * 0.72);
      const height = 0.45 + tier * 0.43;
      group.add(box(0.82, height, 24, materials.concrete, x, height / 2, 2));
      group.add(box(0.64, 0.1, 23.5, materials.blueSeat, x - side * 0.06, height + 0.06, 2));
    }
  }
  for (let tier = 0; tier < 7; tier += 1) {
    const z = 15.8 + tier * 0.72;
    const height = 0.45 + tier * 0.43;
    group.add(box(28 - tier * 0.5, height, 0.82, materials.concrete, 0, height / 2, z));
    group.add(box(27.4 - tier * 0.5, 0.1, 0.64, materials.blueSeat, 0, height + 0.06, z - 0.06));
  }
  for (const x of [-10, 0, 10]) for (const z of [-13, 10]) group.add(box(5.5, 0.1, 1.1, materials.lamp, x, 12.6, z));
  return group;
};

const createCoveredGrassArena = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-covered-grass-arena';
  group.add(box(48, 0.18, 68, materials.grass, 0, -0.2, 2));
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 6; tier += 1) {
      const x = side * (8 + tier * 0.75);
      const height = 0.4 + tier * 0.38;
      group.add(box(0.84, height, 21, materials.paleConcrete, x, height / 2, 2));
      group.add(box(0.64, 0.09, 20.5, materials.paleSeat, x - side * 0.06, height + 0.05, 2));
    }
  }
  for (let z = -22; z <= 24; z += 4.6) {
    for (const side of [-1, 1]) group.add(box(0.18, 11.5, 0.18, materials.lightMetal, side * 16.5, 5.75, z));
    const leftPanel = box(17, 0.16, 4.4, materials.roof, -8.1, 11.5, z);
    leftPanel.rotation.z = -0.12;
    const rightPanel = box(17, 0.16, 4.4, materials.roof, 8.1, 11.5, z);
    rightPanel.rotation.z = 0.12;
    group.add(leftPanel, rightPanel);
  }
  group.add(box(0.8, 0.12, 48, materials.glass, 0, 12.45, 1));
  for (let z = -18; z <= 18; z += 6) group.add(box(5.8, 0.1, 0.9, materials.lamp, 0, 11.35, z));
  group.add(box(34, 7, 0.24, materials.glass, 0, 5.2, 28));
  return group;
};

export const createVenueGroups = (materials: SceneMaterialLibrary): Readonly<Record<VenueId, THREE.Group>> => {
  const groups = {
    'outdoor-club': createOutdoorClub(materials),
    'clay-terrace': createClayTerrace(materials),
    'grass-park-night': createGrassParkNight(materials),
    'timber-hall': createTimberHall(materials),
    'clay-stadium': createClayStadium(materials),
    'covered-grass-arena': createCoveredGrassArena(materials),
  } satisfies Record<VenueId, THREE.Group>;
  for (const venue of VENUE_IDS) groups[venue].visible = venue === 'outdoor-club';
  return groups;
};
