import * as THREE from 'three';
import { VENUE_IDS, type VenueId } from '../../domain/environment';
import type { SceneMaterialLibrary } from './sceneMaterials';
import { box } from './scenePrimitives';
import {
  createBleachers,
  createBroadleafTree,
  createCeilingFixture,
  createCypressTree,
  createFenceEnclosure,
  createHedge,
  createLightPole,
  createRoundedArenaTier,
  createSuperellipseFascia,
  createSuperellipseRoofRing,
} from './sceneProps';

const addPathNetwork = (group: THREE.Group, materials: SceneMaterialLibrary, width: number, length: number): void => {
  group.add(box(width, 0.08, 2.2, materials.paleConcrete, 0, -0.09, -20));
  group.add(box(2.4, 0.08, length, materials.paleConcrete, -15, -0.09, 2));
  group.add(box(2.4, 0.08, length, materials.paleConcrete, 15, -0.09, 2));
  for (const side of [-1, 1]) {
    group.add(box(0.16, 0.34, length, materials.clayStone, side * 16.35, 0.08, 2));
  }
};

const createClubhouse = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'clubhouse-veranda-context';
  group.add(box(20, 0.18, 8.2, materials.concrete, 0, 0.08, 0));
  group.add(box(17.8, 4.8, 6.2, materials.warmWall, 0, 2.5, 0.5));
  for (const x of [-6.5, -3.2, 0, 3.2, 6.5]) {
    group.add(box(2.1, 2.25, 0.1, materials.glass, x, 2.25, -2.65));
    group.add(box(0.12, 3.4, 0.14, materials.darkMetal, x - 1.18, 2.3, -2.7));
  }
  for (const x of [-7.8, -5.2, -2.6, 0, 2.6, 5.2, 7.8]) group.add(box(0.14, 3.2, 0.14, materials.lightMetal, x, 1.6, -4.15));
  const roofLeft = box(10.2, 0.22, 7.2, materials.roof, -4.8, 5.35, 0.4);
  roofLeft.rotation.z = 0.12;
  const roofRight = box(10.2, 0.22, 7.2, materials.roof, 4.8, 5.35, 0.4);
  roofRight.rotation.z = -0.12;
  group.add(roofLeft, roofRight);
  group.position.set(0, 0, 25);
  return group;
};

const createOutdoorClub = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-outdoor-club';
  group.add(box(72, 0.18, 92, materials.grass, 0, -0.2, 6));
  addPathNetwork(group, materials, 34, 54);
  group.add(createFenceEnclosure(materials));
  group.add(createBleachers(materials, -1, 4, 12, 9.4));
  group.add(createBleachers(materials, 1, 4, 12, 9.4));
  group.add(createClubhouse(materials));
  group.add(createHedge(materials, 9.2, 1.55, 1.4, -8, 17.7));
  group.add(createHedge(materials, 9.2, 1.55, 1.4, 8, 17.7));
  for (const [x, z] of [[-13.2, -14], [13.2, -14], [-13.2, 12.2], [13.2, 12.2]] as const) group.add(createLightPole(materials, x, z, z < 0 ? 1 : -1));
  const trees: readonly [number, number, number, number][] = [
    [-21, -12, 1.25, 0], [-20, -2, 1.5, 1], [-21, 10, 1.35, 2], [-20, 22, 1.55, 0],
    [21, -12, 1.35, 1], [20, -2, 1.45, 0], [21, 10, 1.4, 2], [20, 22, 1.5, 1],
    [-14, 32, 1.25, 1], [-7, 34, 1.45, 2], [7, 34, 1.4, 0], [14, 32, 1.3, 1],
  ];
  for (const tree of trees) group.add(createBroadleafTree(materials, ...tree));
  group.add(box(11, 3.4, 5.2, materials.warmWall, -25, 1.7, 23));
  group.add(box(12, 0.22, 6.2, materials.roof, -25, 3.55, 23));
  return group;
};

const createClayTerrace = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-terrace';
  group.add(box(72, 0.18, 94, materials.clayStone, 0, -0.2, 7));
  group.add(createFenceEnclosure(materials, 22, 36.5, 3));
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 7; tier += 1) {
      const x = side * (7.8 + tier * 0.8);
      group.add(box(0.9, 0.44 + tier * 0.38, 23, materials.clayStone, x, (0.44 + tier * 0.38) / 2, 2));
      group.add(box(0.68, 0.09, 22.4, materials.terracotta, x - side * 0.08, 0.5 + tier * 0.38, 2));
    }
    group.add(box(0.28, 4.2, 34, materials.clayStone, side * 14.2, 2.1, 2));
    group.add(createHedge(materials, 1.4, 1.45, 34, side * 15.4, 2));
  }
  group.add(box(30, 3.8, 1.4, materials.clayStone, 0, 1.9, 20));
  group.add(box(19, 5.2, 7, materials.warmWall, 0, 5.8, 25));
  group.add(box(21, 0.32, 8.1, materials.terracotta, 0, 8.55, 25));
  for (const x of [-6.5, -2.2, 2.2, 6.5]) group.add(box(2.4, 2.8, 0.12, materials.glass, x, 5.8, 21.45));
  for (let step = 0; step < 13; step += 1) group.add(box(5 + step * 0.4, 0.22, 0.5, materials.clayStone, 0, 0.12 + step * 0.23, 17 + step * 0.43));
  for (const side of [-1, 1]) for (let z = -15; z <= 33; z += 6) group.add(createCypressTree(materials, side * 18, z, 1.15));
  for (const x of [-11, -7, 7, 11]) group.add(createCypressTree(materials, x, 34, 1.25));
  for (const [x, z] of [[-13.4, -14], [13.4, -14], [-13.4, 13], [13.4, 13]] as const) group.add(createLightPole(materials, x, z, z < 0 ? 1 : -1));
  return group;
};

const createGrassPark = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-grass-park-night';
  group.add(box(84, 0.18, 104, materials.grass, 0, -0.2, 8));
  group.add(createFenceEnclosure(materials, 23, 37, 2.8));
  addPathNetwork(group, materials, 38, 64);
  group.add(createHedge(materials, 32, 1.6, 2, 0, 19.5));
  group.add(createHedge(materials, 2, 1.5, 44, -14.7, 2));
  group.add(createHedge(materials, 2, 1.5, 44, 14.7, 2));
  group.add(box(17, 3.6, 6, materials.warmWall, 0, 1.8, 28));
  const pavilionRoof = box(19, 0.24, 7.2, materials.roof, 0, 3.85, 28);
  pavilionRoof.rotation.x = 0.08;
  group.add(pavilionRoof);
  for (const [x, z] of [[-12.8, -13], [12.8, -13], [-12.8, 13], [12.8, 13]] as const) group.add(createLightPole(materials, x, z, z < 0 ? 1 : -1));
  for (let index = 0; index < 22; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const z = -20 + Math.floor(index / 2) * 5.6;
    group.add(createBroadleafTree(materials, side * (20 + (index % 3) * 1.8), z, 1.25 + (index % 4) * 0.1, index));
  }
  return group;
};

const createAdRing = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'unbranded-procedural-ad-ring';
  group.add(box(24.8, 1.05, 0.24, materials.adBoard, 0, 0.55, 15.2));
  group.add(box(24.8, 1.05, 0.24, materials.adBoard, 0, 0.55, -16.4));
  for (const side of [-1, 1]) group.add(box(0.24, 1.05, 31.6, materials.adBoard, side * 12.3, 0.55, -0.6));
  for (const z of [-16.25, 15.05]) {
    for (let x = -10.5; x <= 10.5; x += 3.5) {
      group.add(box(1.55, 0.09, 0.035, materials.lamp, x, 0.56, z));
      group.add(box(0.32, 0.09, 0.04, materials.lamp, x + 1.02, 0.56, z));
    }
  }
  for (const side of [-1, 1]) {
    for (let z = -13.8; z <= 12.8; z += 3.8) {
      group.add(box(0.035, 0.09, 1.62, materials.lamp, side * 12.15, 0.56, z));
    }
  }
  return group;
};

const createHardOvalBowl = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'four-sided-arena-seating-bowl';
  group.userData = { identity: 'hard', shape: 'rounded-rectangular-oval', approximateCapacity: 14800 };
  group.add(createRoundedArenaTier(materials, {
    radiusX: 13.1, radiusZ: 17.8, exponent: 3.1, rows: 15, baseHeight: 0.65,
    rowDepth: 0.52, rowRise: 0.32, seatSpacing: 0.46, seatMaterial: materials.blueSeat, aisleCount: 16,
  }));
  const lowerFascia = createSuperellipseFascia(materials.darkWall, 20.35, 25.05, 3.1, 5.5, 1.35);
  lowerFascia.name = 'hard-arena-lower-concourse';
  group.add(lowerFascia);
  group.add(createRoundedArenaTier(materials, {
    radiusX: 21.2, radiusZ: 25.9, exponent: 3.05, rows: 9, baseHeight: 6.05,
    rowDepth: 0.58, rowRise: 0.38, seatSpacing: 0.46, seatMaterial: materials.blueSeat, aisleCount: 18,
  }));
  group.add(createRoundedArenaTier(materials, {
    radiusX: 26.2, radiusZ: 31.3, exponent: 2.85, rows: 25, baseHeight: 9.55,
    rowDepth: 0.5, rowRise: 0.3, seatSpacing: 0.46, seatMaterial: materials.darkWall, aisleCount: 20,
  }));
  group.add(createSuperellipseFascia(materials.darkWall, 25.3, 30.4, 2.9, 8.7, 1.0));
  return group;
};

const createClayAsymmetricBowl = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'four-sided-arena-seating-bowl';
  group.userData = { identity: 'clay', shape: 'asymmetric-rounded-rectangle', approximateCapacity: 15000 };
  group.add(createRoundedArenaTier(materials, {
    radiusX: 12.8, radiusZ: 17.4, exponent: 5.5, rows: 15, baseHeight: 0.65,
    rowDepth: 0.45, rowRise: 0.27, seatSpacing: 0.46, seatMaterial: materials.warmSeat, aisleCount: 14,
  }));
  group.add(createSuperellipseFascia(materials.darkWall, 19.45, 24.05, 5.4, 4.85, 1.15));
  group.add(createRoundedArenaTier(materials, {
    radiusX: 19.9, radiusZ: 24.5, exponent: 5.4, rows: 16, baseHeight: 5.45,
    rowDepth: 0.4, rowRise: 0.27, seatSpacing: 0.46, seatMaterial: materials.greenSeat, aisleCount: 16,
  }));
  group.add(createRoundedArenaTier(materials, {
    radiusX: 25.9, radiusZ: 30.5, exponent: 5.8, rows: 28, baseHeight: 9.7,
    rowDepth: 0.46, rowRise: 0.27, seatSpacing: 0.46, seatMaterial: materials.darkWall, aisleCount: 18,
    startAngle: Math.PI * 0.06, endAngle: Math.PI * 0.94,
  }));
  group.add(createRoundedArenaTier(materials, {
    radiusX: 25.7, radiusZ: 30.3, exponent: 5.8, rows: 24, baseHeight: 9.7,
    rowDepth: 0.46, rowRise: 0.27, seatSpacing: 0.46, seatMaterial: materials.greenSeat, aisleCount: 8,
    startAngle: Math.PI * 1.08, endAngle: Math.PI * 1.92,
  }));
  return group;
};

const createGrassContinuousBowl = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'four-sided-arena-seating-bowl';
  group.userData = { identity: 'grass', shape: 'squarish-continuous-bowl', approximateCapacity: 14900 };
  group.add(createRoundedArenaTier(materials, {
    radiusX: 12.9, radiusZ: 17.9, exponent: 4.7, rows: 19, baseHeight: 0.62,
    rowDepth: 0.42, rowRise: 0.28, seatSpacing: 0.46, seatMaterial: materials.greenSeat, aisleCount: 16,
  }));
  group.add(createSuperellipseFascia(materials.darkWall, 20.7, 25.7, 4.7, 5.45, 1.25));
  group.add(createRoundedArenaTier(materials, {
    radiusX: 21.2, radiusZ: 26.2, exponent: 4.7, rows: 34, baseHeight: 6.0,
    rowDepth: 0.52, rowRise: 0.34, seatSpacing: 0.46, seatMaterial: materials.greenSeat, aisleCount: 20,
  }));
  return group;
};

const createHardArenaRoof = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'open-roof-arena-canopy';
  group.userData.identity = 'hard';
  group.add(createSuperellipseRoofRing(materials.darkWall, 23.5, 29.2, 36.5, 43.5, 3, 17.1));
  group.add(createSuperellipseFascia(materials.darkWall, 30.2, 36.4, 3, 16.45, 1.25));
  group.add(createSuperellipseFascia(materials.lightMetal, 23.5, 29.2, 3, 17.05, 0.28));
  return group;
};

const createClayArenaRoof = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'open-roof-arena-canopy';
  group.userData.identity = 'clay';
  for (const side of [-1, 1]) {
    const canopy = box(11.5, 0.42, 68, materials.roof, side * 31, 18.15, 0);
    canopy.rotation.z = side * -0.055;
    group.add(canopy);
    group.add(box(0.8, 1.1, 68, materials.darkWall, side * 36.1, 17.5, 0));
  }
  group.add(box(50, 0.42, 11, materials.roof, 0, 18.55, 33.2));
  for (let x = -22; x <= 22; x += 5.5) group.add(box(0.18, 0.18, 11, materials.lightMetal, x, 18.3, 33.2));
  return group;
};

const createGrassArenaRoof = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'open-roof-arena-canopy';
  group.userData.identity = 'grass';
  group.add(createSuperellipseRoofRing(materials.greenSeat, 22.5, 28.5, 38.5, 44, 4.8, 17.9));
  group.add(createSuperellipseFascia(materials.darkWall, 31, 36.4, 4.8, 17.2, 1.25));
  group.add(createSuperellipseFascia(materials.lightMetal, 22.5, 28.5, 4.8, 17.8, 0.32));
  for (let x = -20; x <= 20; x += 5) {
    const brace = box(0.2, 0.2, 10.5, materials.lightMetal, x, 18.08, 33.2);
    group.add(brace);
  }
  return group;
};

const createArenaFloodlightSystem = (materials: SceneMaterialLibrary, y: number, intensity: number): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'arena-dawn-night-floodlights';
  for (const z of [-20.2, 20.2]) {
    for (const x of [-12, -4, 4, 12]) group.add(createCeilingFixture(materials, x, y, z, 3.4, intensity));
  }
  for (const x of [-17.2, 17.2]) {
    for (const z of [-8, 8]) group.add(createCeilingFixture(materials, x, y - 0.7, z, 3.2, intensity * 0.86));
  }
  return group;
};

const createScoreboard = (materials: SceneMaterialLibrary, y = 8.5): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'generic-score-display';
  group.add(box(7.2, 3.5, 0.4, materials.darkMetal, 0, y, 23));
  group.add(box(6.5, 2.75, 0.12, materials.adBoard, 0, y, 22.75));
  for (const x of [-2.2, 0, 2.2]) group.add(box(1.35, 0.18, 0.08, materials.lamp, x, y, 22.65));
  return group;
};

const createHardOpenArena = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-hard-open-arena';
  group.add(box(86, 0.24, 104, materials.darkWall, 0, -0.25, 2));
  group.add(createAdRing(materials));
  group.add(createHardOvalBowl(materials));
  group.add(createHardArenaRoof(materials));
  group.add(createScoreboard(materials, 10.2));
  group.add(createArenaFloodlightSystem(materials, 16.45, 42));
  return group;
};

const createClaySunsetArena = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-sunset-arena';
  group.add(box(88, 0.24, 108, materials.clayStone, 0, -0.25, 2));
  group.add(createAdRing(materials));
  group.add(createClayAsymmetricBowl(materials));
  group.add(createClayArenaRoof(materials));
  group.add(createScoreboard(materials, 10.4));
  group.add(createArenaFloodlightSystem(materials, 17.45, 44));
  return group;
};

const createGrassCenterCourt = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-grass-center-court';
  group.add(box(90, 0.24, 110, materials.darkWall, 0, -0.25, 2));
  group.add(createAdRing(materials));
  group.add(createGrassContinuousBowl(materials));
  group.add(createGrassArenaRoof(materials));
  group.add(createScoreboard(materials, 9.5));
  group.add(createArenaFloodlightSystem(materials, 17.15, 40));
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
  group.add(box(width, height, 0.3, wallMaterial, 0, height / 2, length / 2));
  group.add(box(0.3, height, length, wallMaterial, -width / 2, height / 2, 0));
  group.add(box(0.3, height, length, wallMaterial, width / 2, height / 2, 0));
  group.add(box(width - 0.4, 1.05, 0.24, materials.darkWall, 0, 0.53, length / 2 - 0.2));
  for (const side of [-1, 1]) {
    group.add(box(0.24, 1.05, length - 0.5, materials.darkWall, side * (width / 2 - 0.18), 0.53, 0));
    for (let z = -length / 2 + 2; z <= length / 2 - 1; z += 4.1) {
      group.add(box(0.16, height - 0.6, 0.22, materials.lightMetal, side * (width / 2 - 0.22), (height - 0.6) / 2, z));
      group.add(box(0.26, 2.1, 2.4, materials.darkWall, side * (width / 2 - 0.35), 3.8, z + 1.45));
    }
  }
  for (let z = -length / 2 + 2; z <= length / 2; z += 5.5) group.add(box(width - 0.5, 0.14, 0.2, materials.darkMetal, 0, height - 0.35, z));
  for (const x of [-width * 0.31, 0, width * 0.31]) {
    group.add(box(2.6, 3.15, 0.22, materials.darkMetal, x, 1.58, length / 2 - 0.35));
    group.add(box(2.05, 2.5, 0.12, materials.glass, x, 1.62, length / 2 - 0.49));
  }
};

const addHallFixtures = (group: THREE.Group, materials: SceneMaterialLibrary, y: number, baseIntensity: number): void => {
  for (const x of [-7, 0, 7]) for (const z of [-15, -5, 5, 15]) group.add(createCeilingFixture(materials, x, y, z, 4.4, baseIntensity));
};

const createTimberHall = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-timber-hall';
  group.add(box(38, 0.18, 60, materials.concrete, 0, -0.2, 1));
  addIndoorShell(group, materials, materials.warmWall, 31, 8, 49);
  for (let z = -22; z <= 22; z += 5.5) {
    for (const side of [-1, 1]) group.add(box(0.34, 7.8, 0.4, materials.timber, side * 14.8, 3.9, z));
    const left = box(15.2, 0.3, 5.3, materials.ceiling, -7.4, 9.2, z + 2.65);
    left.rotation.z = 0.17;
    const right = box(15.2, 0.3, 5.3, materials.ceiling, 7.4, 9.2, z + 2.65);
    right.rotation.z = -0.17;
    group.add(left, right);
  }
  for (let x = -11; x <= 11; x += 4.4) group.add(box(3.3, 2.7, 0.1, materials.glass, x, 4.8, 24.35));
  for (const side of [-1, 1]) {
    group.add(box(0.55, 0.65, 42, materials.darkMetal, side * 13.4, 6.85, 0));
    for (let z = -18; z <= 18; z += 6) group.add(box(0.14, 1.8, 0.14, materials.lightMetal, side * 13.4, 7.8, z));
  }
  addHallFixtures(group, materials, 9.65, 38);
  return group;
};

const createClayHall = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-hall';
  group.add(box(40, 0.18, 62, materials.darkWall, 0, -0.2, 1));
  addIndoorShell(group, materials, materials.paleConcrete, 34, 10.5, 51);
  group.add(box(33.7, 0.28, 50.8, materials.ceiling, 0, 10.45, 0));
  for (let z = -22; z <= 22; z += 5.5) {
    group.add(box(33, 0.24, 0.3, materials.darkMetal, 0, 9.95, z));
    for (const x of [-15, -7.5, 0, 7.5, 15]) group.add(box(0.18, 0.18, 5.2, materials.darkMetal, x, 10, z + 2.6));
  }
  for (const x of [-10, -3.3, 3.3, 10]) group.add(box(4.8, 2.5, 0.1, materials.glass, x, 5.2, 25.3));
  for (const side of [-1, 1]) {
    group.add(box(0.7, 0.7, 43, materials.lightMetal, side * 14.4, 8.2, 0));
    for (let z = -18; z <= 18; z += 6) group.add(box(0.16, 1.4, 0.16, materials.darkMetal, side * 14.4, 8.9, z));
  }
  addHallFixtures(group, materials, 9.6, 46);
  return group;
};

const createBarrelGrassHall = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-barrel-vault-grass-hall';
  group.add(box(40, 0.18, 62, materials.grass, 0, -0.2, 1));
  const width = 32;
  const length = 51;
  const wallHeight = 5.8;
  group.add(box(0.3, wallHeight, length, materials.warmWall, -width / 2, wallHeight / 2, 0));
  group.add(box(0.3, wallHeight, length, materials.warmWall, width / 2, wallHeight / 2, 0));
  group.add(box(width, wallHeight, 0.3, materials.warmWall, 0, wallHeight / 2, length / 2));
  const radius = width / 2;
  const segments = 18;
  const panelWidth = Math.PI * radius / segments + 0.08;
  for (let index = 0; index < segments; index += 1) {
    const theta = (index + 0.5) / segments * Math.PI;
    const panel = box(panelWidth, 0.18, length, materials.ceiling, Math.cos(theta) * radius, wallHeight + Math.sin(theta) * radius, 0);
    panel.rotation.z = theta + Math.PI / 2;
    group.add(panel);
  }
  const endSliceWidth = width / 22;
  for (let slice = 0; slice < 22; slice += 1) {
    const x = -width / 2 + (slice + 0.5) * endSliceWidth;
    const capHeight = Math.sqrt(Math.max(0, radius * radius - x * x));
    const material = slice % 4 === 1 || slice % 4 === 2 ? materials.glass : materials.ceiling;
    group.add(box(endSliceWidth + 0.04, capHeight, 0.22, material, x, wallHeight + capHeight / 2, length / 2 - 0.14));
  }
  for (let z = -24; z <= 24; z += 6) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.13, 6, 48, Math.PI), materials.lightMetal);
    rib.position.set(0, wallHeight, z);
    rib.castShadow = true;
    group.add(rib);
  }
  for (const x of [-7, 0, 7]) {
    const roofY = wallHeight + Math.sqrt(Math.max(0, radius * radius - x * x));
    for (const z of [-15, -5, 5, 15]) {
      group.add(box(0.08, roofY - 12.15, 0.08, materials.darkMetal, x, 12.15 + (roofY - 12.15) / 2, z));
      group.add(createCeilingFixture(materials, x, 12.2, z, 4.2, 42));
    }
  }
  return group;
};

export const createVenueGroups = (materials: SceneMaterialLibrary): Readonly<Record<VenueId, THREE.Group>> => {
  const groups = {
    'outdoor-club': createOutdoorClub(materials),
    'clay-terrace': createClayTerrace(materials),
    'grass-park-night': createGrassPark(materials),
    'hard-open-arena': createHardOpenArena(materials),
    'clay-sunset-arena': createClaySunsetArena(materials),
    'grass-center-court': createGrassCenterCourt(materials),
    'timber-hall': createTimberHall(materials),
    'clay-stadium': createClayHall(materials),
    'covered-grass-arena': createBarrelGrassHall(materials),
  } satisfies Record<VenueId, THREE.Group>;
  for (const venue of VENUE_IDS) groups[venue].visible = venue === 'outdoor-club';
  return groups;
};
