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
    for (let tier = 0; tier < 6; tier += 1) {
      const x = side * (8 + tier * 0.72);
      group.add(box(0.78, 0.42 + tier * 0.36, 18.5, materials.clayStone, x, (0.42 + tier * 0.36) / 2, 2.4));
      group.add(box(0.62, 0.08, 18.1, materials.terracotta, x - side * 0.05, 0.48 + tier * 0.36, 2.4));
    }
    group.add(box(0.22, 3.4, 20, materials.clayStone, side * 12.3, 1.7, 3));
  }
  group.add(box(25, 3.2, 1.2, materials.clayStone, 0, 1.6, 19));
  group.add(box(15.5, 4.5, 5, materials.warmWall, 0, 4.85, 23));
  group.add(box(17, 0.28, 6.1, materials.terracotta, 0, 7.18, 23));
  for (const x of [-5.2, -1.75, 1.75, 5.2]) {
    group.add(box(1.65, 2.25, 0.12, materials.darkWall, x, 4.55, 20.46));
    group.add(box(0.26, 2.45, 0.34, materials.warmWall, x - 1.02, 4.58, 20.36));
    group.add(box(0.26, 2.45, 0.34, materials.warmWall, x + 1.02, 4.58, 20.36));
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.14, 8, 24, Math.PI), materials.warmWall);
    arch.position.set(x, 5.7, 20.34);
    arch.castShadow = true;
    group.add(arch);
  }
  for (let step = 0; step < 12; step += 1) {
    group.add(box(4.8 + step * 0.3, 0.22, 0.5, materials.clayStone, 0, 0.12 + step * 0.22, 17.3 + step * 0.4));
  }
  group.add(createHedge(materials, 8.4, 1.15, 1.1, -8.2, 19.2));
  group.add(createHedge(materials, 8.4, 1.15, 1.1, 8.2, 19.2));
  for (const side of [-1, 1]) {
    for (let z = -10; z <= 28; z += 6.2) group.add(createCypressTree(materials, side * 15.2, z, 1 + ((z + 10) % 3) * 0.08));
  }
  for (const x of [-10, -6.5, 6.5, 10]) group.add(createCypressTree(materials, x, 27.5, 1.15));
  return group;
};

const createGrassParkNight = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-grass-park-night';
  group.add(createSkyDome(0x101f2a, 0x030811, 0));
  group.add(box(66, 0.18, 82, materials.grass, 0, -0.2, 3));
  group.add(createFenceEnclosure(materials, 23, 37, 2.8));
  const westStand = createBleachers(materials, -1, 7, 24, 18, materials.greenSeat, 0.9);
  const eastStand = createBleachers(materials, 1, 7, 24, 18, materials.greenSeat, 0.9);
  westStand.position.set(-8.25, 0, 2.5);
  eastStand.position.set(8.25, 0, 2.5);
  group.add(westStand, eastStand);
  const farStand = createBleachers(materials, 1, 6, 24, 17, materials.greenSeat, 0.88);
  farStand.position.set(0, 0, 17.4);
  farStand.rotation.y = -Math.PI / 2;
  group.add(farStand);
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
  addIndoorShell(group, materials, materials.warmWall, 30, 10.2, 47);
  group.add(box(29.6, 2.2, 0.3, materials.timber, 0, 1.1, 23.35));
  for (const side of [-1, 1]) {
    group.add(box(0.28, 2.2, 46.5, materials.timber, side * 14.82, 1.1, 0));
    group.add(createBleachers(materials, side as -1 | 1, 6, 20, 16, materials.blueSeat, 0.86));
  }
  for (let z = -20; z <= 21; z += 5.4) {
    for (const side of [-1, 1]) group.add(box(0.34, 7.2, 0.42, materials.timber, side * 14.3, 3.6, z));
    const leftRafter = box(14.5, 0.38, 0.42, materials.timber, -7.15, 8.55, z);
    leftRafter.rotation.z = 0.19;
    const rightRafter = box(14.5, 0.38, 0.42, materials.timber, 7.15, 8.55, z);
    rightRafter.rotation.z = -0.19;
    group.add(leftRafter, rightRafter);
    const leftRoof = box(14.4, 0.12, 5.25, materials.ceiling, -7.1, 8.72, z + 2.65);
    leftRoof.rotation.z = 0.19;
    const rightRoof = box(14.4, 0.12, 5.25, materials.ceiling, 7.1, 8.72, z + 2.65);
    rightRoof.rotation.z = -0.19;
    group.add(leftRoof, rightRoof);
  }
  for (let x = -11; x <= 11; x += 4.4) {
    group.add(box(3.4, 3.2, 0.1, materials.glass, x, 5.5, 23.18));
    group.add(box(0.12, 3.5, 0.18, materials.darkMetal, x - 1.8, 5.5, 23.08));
  }
  for (let z = -18; z <= 18; z += 6) group.add(box(5.8, 0.08, 0.8, materials.lamp, 0, 9.45, z));
  return group;
};

const createClayStadium = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-stadium';
  group.add(box(48, 0.18, 68, materials.darkWall, 0, -0.2, 2));
  addIndoorShell(group, materials, materials.darkWall, 42, 14, 58);
  const westStand = createBleachers(materials, -1, 10, 32, 25, materials.warmSeat, 1);
  const eastStand = createBleachers(materials, 1, 10, 32, 25, materials.warmSeat, 1);
  westStand.position.set(-8.2, 0, 2);
  eastStand.position.set(8.2, 0, 2);
  group.add(westStand, eastStand);
  const farStand = createBleachers(materials, 1, 8, 34, 27, materials.warmSeat, 0.96);
  farStand.position.set(0, 0, 16.5);
  farStand.rotation.y = -Math.PI / 2;
  group.add(farStand);
  for (const x of [-9, 0, 9]) {
    group.add(box(3.2, 2.7, 0.18, materials.darkWall, x, 1.35, 20.8));
    group.add(box(3.5, 0.24, 0.5, materials.lightMetal, x, 2.75, 20.7));
  }
  group.add(box(9, 2.2, 0.3, materials.darkWall, 0, 7.8, 23.6));
  group.add(box(6.8, 1.1, 0.12, materials.glass, 0, 7.8, 23.42));
  for (let z = -24; z <= 25; z += 5.5) {
    group.add(box(41, 0.22, 0.28, materials.darkMetal, 0, 13.2, z));
    for (const x of [-18, -9, 0, 9, 18]) group.add(box(0.16, 0.16, 5.1, materials.darkMetal, x, 13.05, z + 2.55));
  }
  for (const x of [-10, 0, 10]) for (const z of [-13, 10]) group.add(box(5.5, 0.1, 1.1, materials.lamp, x, 12.6, z));
  return group;
};

const createCoveredGrassArena = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-covered-grass-arena';
  group.add(box(48, 0.18, 68, materials.grass, 0, -0.2, 2));
  const westStand = createBleachers(materials, -1, 7, 28, 22, materials.greenSeat, 0.94);
  const eastStand = createBleachers(materials, 1, 7, 28, 22, materials.greenSeat, 0.94);
  westStand.position.set(-8.15, 0, 2);
  eastStand.position.set(8.15, 0, 2);
  group.add(westStand, eastStand);
  for (let z = -22; z <= 24; z += 4.6) {
    for (const side of [-1, 1]) group.add(box(0.18, 11.5, 0.18, materials.lightMetal, side * 16.5, 5.75, z));
    const leftPanel = box(17, 0.16, 4.4, materials.ceiling, -8.1, 11.5, z);
    leftPanel.rotation.z = -0.12;
    const rightPanel = box(17, 0.16, 4.4, materials.ceiling, 8.1, 11.5, z);
    rightPanel.rotation.z = 0.12;
    group.add(leftPanel, rightPanel);
  }
  group.add(box(0.8, 0.12, 48, materials.glass, 0, 12.45, 1));
  for (let z = -18; z <= 18; z += 6) group.add(box(5.8, 0.1, 0.9, materials.lamp, 0, 11.35, z));
  group.add(box(34, 7, 0.24, materials.glass, 0, 5.2, 28));
  for (let x = -15; x <= 15; x += 5) group.add(box(0.14, 7.2, 0.2, materials.darkMetal, x, 5.2, 27.85));
  for (const x of [-13, -8, 8, 13]) group.add(createBroadleafTree(materials, x, 31, 1.15, Math.round(x)));
  const farStand = createBleachers(materials, 1, 5, 24, 18, materials.greenSeat, 0.82);
  farStand.position.set(0, 0, 18.2);
  farStand.rotation.y = -Math.PI / 2;
  group.add(farStand);
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
