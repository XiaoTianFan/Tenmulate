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
  createStadiumStand,
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

type ArenaIdentity = 'hard' | 'clay' | 'grass';

const createArenaBowl = (
  materials: SceneMaterialLibrary,
  identity: ArenaIdentity,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'four-sided-arena-seating-bowl';
  group.userData.identity = identity;
  const compact = identity === 'clay';
  const lowerSeat = identity === 'hard' ? materials.blueSeat : identity === 'grass' ? materials.greenSeat : materials.warmSeat;
  const upperSeat = identity === 'hard' ? materials.darkWall : materials.greenSeat;
  const sideLength = compact ? 39 : 43;
  const endLength = compact ? 29 : 33;

  for (const side of [-1, 1]) {
    const lower = createStadiumStand(materials, side as -1 | 1, {
      rows: compact ? 7 : 8,
      columns: compact ? 58 : 68,
      length: sideLength,
      seatMaterial: lowerSeat,
      aisleCount: 3,
    });
    lower.position.set(side * 12.9, 0.78, 0);
    const upper = createStadiumStand(materials, side as -1 | 1, {
      rows: compact ? 8 : 10,
      columns: compact ? 62 : 74,
      length: sideLength + 4,
      seatMaterial: upperSeat,
      rowDepth: 0.66,
      rowRise: 0.43,
      aisleCount: 3,
    });
    upper.position.set(side * (compact ? 17.25 : 17.8), compact ? 4.45 : 4.8, 0);
    group.add(lower, upper);
    group.add(box(2.35, 1.42, sideLength + 5.4, materials.darkWall, side * (compact ? 17.2 : 17.7), 4.05, 0));
    group.add(box(2.8, 0.24, sideLength + 6, materials.paleConcrete, side * (compact ? 17.2 : 17.7), 4.78, 0));
    for (const z of [-13, 0, 13]) {
      group.add(box(0.28, 2.35, 3.2, materials.darkMetal, side * 16.02, 3.25, z));
      group.add(box(0.36, 0.16, 3.6, materials.lamp, side * 15.84, 4.38, z));
    }
  }

  const lowerFar = createStadiumStand(materials, 1, {
    rows: compact ? 6 : 7, columns: compact ? 42 : 50, length: endLength, seatMaterial: lowerSeat, aisleCount: 2,
  });
  lowerFar.position.set(0, 0.78, 16.35);
  lowerFar.rotation.y = -Math.PI / 2;
  const lowerNear = createStadiumStand(materials, -1, {
    rows: compact ? 5 : 6, columns: compact ? 40 : 48, length: endLength, seatMaterial: lowerSeat, aisleCount: 2,
  });
  lowerNear.position.set(0, 0.78, -19.55);
  lowerNear.rotation.y = -Math.PI / 2;
  const upperFar = createStadiumStand(materials, 1, {
    rows: compact ? 7 : 9, columns: compact ? 50 : 58, length: endLength + 5, seatMaterial: upperSeat, rowDepth: 0.66, rowRise: 0.43, aisleCount: 2,
  });
  upperFar.position.set(0, compact ? 4.3 : 4.65, compact ? 20.1 : 20.45);
  upperFar.rotation.y = -Math.PI / 2;
  const upperNear = createStadiumStand(materials, -1, {
    rows: compact ? 6 : 8, columns: compact ? 48 : 56, length: endLength + 5, seatMaterial: upperSeat, rowDepth: 0.66, rowRise: 0.43, aisleCount: 2,
  });
  upperNear.position.set(0, compact ? 4.3 : 4.65, compact ? -23.1 : -23.55);
  upperNear.rotation.y = -Math.PI / 2;
  group.add(lowerFar, lowerNear, upperFar, upperNear);
  group.add(box(endLength + 6, 1.42, 2.4, materials.darkWall, 0, 3.98, compact ? 20.1 : 20.4));
  group.add(box(endLength + 6, 1.42, 2.4, materials.darkWall, 0, 3.98, compact ? -23.1 : -23.5));
  for (const z of [compact ? 20 : 20.3, compact ? -23 : -23.4]) {
    group.add(box(endLength + 7, 0.24, 2.8, materials.paleConcrete, 0, 4.72, z));
    for (const x of [-9.5, 0, 9.5]) group.add(box(3, 2.25, 0.3, materials.darkMetal, x, 3.23, z + Math.sign(z) * -1.16));
  }
  return group;
};

const createArenaCanopy = (materials: SceneMaterialLibrary, identity: ArenaIdentity): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'open-roof-arena-canopy';
  group.userData.identity = identity;
  const sideY = identity === 'grass' ? 15.1 : identity === 'hard' ? 14.45 : 13.85;
  const roofMaterial = identity === 'grass' ? materials.greenSeat : materials.paleConcrete;
  for (const side of [-1, 1]) {
    for (let z = -27; z <= 27; z += 7.7) {
      const canopy = box(11.5, 0.36, 7.35, roofMaterial, side * 23.4, sideY, z);
      canopy.rotation.z = side * -0.07;
      group.add(canopy);
    }
    group.add(box(1.05, 1.1, 57, materials.darkWall, side * 27.9, sideY - 0.82, 0));
    group.add(box(0.34, 0.34, 57, materials.lightMetal, side * 28.35, sideY + 0.35, 0));
  }
  for (const end of [-1, 1]) {
    for (let x = -19.5; x <= 19.5; x += 6.5) {
      const canopy = box(6.2, 0.36, 10.5, roofMaterial, x, sideY + 0.35, end * 27.4);
      canopy.rotation.x = end * -0.06;
      group.add(canopy);
    }
    group.add(box(43, 0.95, 0.9, materials.darkWall, 0, sideY - 0.55, end * 32.15));
  }
  for (const side of [-1, 1]) {
    for (let z = -27; z <= 27; z += 7.7) {
      group.add(box(0.24, sideY - 4.1, 0.24, materials.lightMetal, side * 28.1, (sideY + 4.1) / 2, z));
      for (const direction of [-1, 1]) {
        const brace = box(8.8, 0.19, 0.19, materials.lightMetal, side * 24, sideY - 1.55, z + direction * 1.6);
        brace.rotation.z = side * direction * 0.45;
        group.add(brace);
      }
    }
  }
  for (const end of [-1, 1]) {
    for (const x of [-18, -12, -6, 0, 6, 12, 18]) {
      group.add(box(0.2, 0.2, 10.5, materials.lightMetal, x, sideY + 0.18, end * 27.4));
      const upright = box(0.2, 4.2, 0.2, materials.lightMetal, x, sideY - 2.1, end * 32);
      group.add(upright);
    }
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
  group.add(box(72, 0.24, 92, materials.concrete, 0, -0.25, 2));
  group.add(createAdRing(materials));
  group.add(createArenaBowl(materials, 'hard'));
  group.add(createArenaCanopy(materials, 'hard'));
  group.add(createScoreboard(materials));
  for (const x of [-9, 0, 9]) group.add(createCeilingFixture(materials, x, 11.8, 14.4, 4.2, 34));
  return group;
};

const createClaySunsetArena = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-clay-sunset-arena';
  group.add(box(76, 0.24, 96, materials.clayStone, 0, -0.25, 2));
  group.add(createAdRing(materials));
  group.add(createArenaBowl(materials, 'clay'));
  group.add(createArenaCanopy(materials, 'clay'));
  group.add(createScoreboard(materials, 9));
  for (const side of [-1, 1]) group.add(box(7, 3.2, 20, materials.greenSeat, side * 19.2, 5.6, 0));
  for (const x of [-10, 0, 10]) group.add(createCeilingFixture(materials, x, 12, 14.3, 4.5, 32));
  return group;
};

const createGrassCenterCourt = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'scene-grass-center-court';
  group.add(box(78, 0.24, 98, materials.darkWall, 0, -0.25, 2));
  group.add(createAdRing(materials));
  group.add(createArenaBowl(materials, 'grass'));
  group.add(createArenaCanopy(materials, 'grass'));
  group.add(createScoreboard(materials, 8.8));
  for (const side of [-1, 1]) for (const z of [-14, -5, 5, 14]) group.add(box(2.2, 7.5, 3, materials.paleConcrete, side * 17.4, 4.2, z));
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
