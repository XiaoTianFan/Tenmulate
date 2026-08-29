import * as THREE from 'three';
import { COURT, type SurfaceId } from '../../domain/court';
import type { VenueId } from '../../domain/environment';

const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5ee, roughness: 0.86 });

const box = (
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const addLine = (group: THREE.Group, width: number, depth: number, x: number, z: number): void => {
  group.add(box(width, 0.012, depth, lineMaterial, x, 0.021, z));
};

const createNet = (): THREE.Group => {
  const group = new THREE.Group();
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x182126, roughness: 0.68 });
  const meshMaterial = new THREE.LineBasicMaterial({ color: 0xbcc6c7, transparent: true, opacity: 0.5 });
  const halfWidth = COURT.doublesWidth / 2 + 0.15;
  group.add(box(0.075, COURT.netPostHeight, 0.075, postMaterial, -halfWidth, COURT.netPostHeight / 2, 0));
  group.add(box(0.075, COURT.netPostHeight, 0.075, postMaterial, halfWidth, COURT.netPostHeight / 2, 0));

  const points: THREE.Vector3[] = [];
  const divisions = 22;
  for (let index = 0; index <= divisions; index += 1) {
    const x = -halfWidth + (index / divisions) * halfWidth * 2;
    const normalized = Math.abs(x / halfWidth);
    const top = COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7;
    points.push(new THREE.Vector3(x, 0.05, 0), new THREE.Vector3(x, top, 0));
  }
  for (let row = 1; row <= 8; row += 1) {
    const ratio = row / 9;
    for (let index = 0; index < divisions; index += 1) {
      const x1 = -halfWidth + (index / divisions) * halfWidth * 2;
      const x2 = -halfWidth + ((index + 1) / divisions) * halfWidth * 2;
      const y1 = ratio * (COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * Math.abs(x1 / halfWidth) ** 1.7);
      const y2 = ratio * (COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * Math.abs(x2 / halfWidth) ** 1.7);
      points.push(new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0));
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  group.add(new THREE.LineSegments(geometry, meshMaterial));
  const tapePoints: THREE.Vector3[] = [];
  for (let index = 0; index <= 48; index += 1) {
    const x = -halfWidth + (index / 48) * halfWidth * 2;
    const normalized = Math.abs(x / halfWidth);
    const y = COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7 + 0.035;
    tapePoints.push(new THREE.Vector3(x, y, 0));
  }
  const tapeGeometry = new THREE.BufferGeometry().setFromPoints(tapePoints);
  group.add(new THREE.Line(tapeGeometry, new THREE.LineBasicMaterial({ color: 0xf5f5ee, linewidth: 1 })));
  return group;
};

const createBallMachine = (): THREE.Group => {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x151e22, roughness: 0.46, metalness: 0.45 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xf2df21, roughness: 0.55 });
  const wheel = new THREE.MeshStandardMaterial({ color: 0x050708, roughness: 0.72 });
  group.add(box(0.72, 0.76, 0.55, dark, 0, 0.66, 0));
  group.add(box(0.5, 0.12, 0.58, accent, 0, 1.04, 0));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 24), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.18, -0.22);
  group.add(barrel);
  for (const x of [-0.34, 0.34]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.11, 20), wheel);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, 0.28, 0.08);
    group.add(tire);
  }
  group.position.set(0, 0, COURT.halfLength - 0.45);
  group.rotation.y = Math.PI;
  return group;
};

const createBench = (x: number): THREE.Group => {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x50636a, roughness: 0.55, metalness: 0.5 });
  const seat = new THREE.MeshStandardMaterial({ color: 0xd8e0df, roughness: 0.7 });
  group.add(box(2.2, 0.12, 0.55, seat, 0, 0.55, 0));
  group.add(box(2.2, 0.72, 0.1, seat, 0, 0.92, 0.24));
  group.add(box(0.08, 0.55, 0.08, metal, -0.82, 0.27, 0));
  group.add(box(0.08, 0.55, 0.08, metal, 0.82, 0.27, 0));
  group.position.set(x, 0, 1.9);
  return group;
};

const createUmpireChair = (): THREE.Group => {
  const group = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x19496f, roughness: 0.6 });
  group.add(box(0.75, 0.12, 0.62, blue, 0, 1.7, 0));
  group.add(box(0.75, 0.72, 0.1, blue, 0, 2.04, 0.27));
  group.add(box(0.08, 1.7, 0.08, blue, -0.32, 0.85, 0));
  group.add(box(0.08, 1.7, 0.08, blue, 0.32, 0.85, 0));
  for (let rung = 0; rung < 5; rung += 1) {
    group.add(box(0.66, 0.045, 0.045, blue, 0, 0.3 + rung * 0.27, -0.25));
  }
  group.position.set(-6.35, 0, 0.25);
  return group;
};

const createOutdoorBackdrop = (): THREE.Group => {
  const group = new THREE.Group();
  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x153b32, roughness: 0.92 });
  const standMaterial = new THREE.MeshStandardMaterial({ color: 0x164c72, roughness: 0.66 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xaab4b5, roughness: 0.88 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x5f4933, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x2d6a43, roughness: 0.96 });

  group.add(box(22, 3.25, 0.12, fenceMaterial, 0, 1.62, 16.2));
  group.add(box(0.12, 3.25, 37, fenceMaterial, -11, 1.62, -0.5));
  group.add(box(0.12, 3.25, 37, fenceMaterial, 11, 1.62, -0.5));

  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 4; tier += 1) {
      group.add(box(2.5, 0.32, 8.5 - tier * 0.55, concrete, side * (7.35 + tier * 0.42), 0.16 + tier * 0.32, 3.2));
      group.add(box(2.1, 0.12, 8.1 - tier * 0.55, standMaterial, side * (7.28 + tier * 0.42), 0.38 + tier * 0.32, 3.2));
    }
  }

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 1.25 - Math.PI * 0.125;
    const radius = 17 + (index % 3) * 1.5;
    const tree = new THREE.Group();
    tree.add(box(0.28, 2.6, 0.28, trunk, 0, 1.3, 0));
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45 + (index % 4) * 0.16, 1), leaves);
    crown.position.y = 3.2;
    crown.castShadow = true;
    tree.add(crown);
    tree.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius + 2);
    group.add(tree);
  }
  return group;
};

const createHallBackdrop = (): THREE.Group => {
  const group = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: 0xd5d8d4, roughness: 0.9, side: THREE.DoubleSide });
  const lowerWall = new THREE.MeshStandardMaterial({ color: 0x214a52, roughness: 0.82 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x34444b, roughness: 0.48, metalness: 0.55 });
  const seat = new THREE.MeshStandardMaterial({ color: 0x356a82, roughness: 0.7 });
  group.add(box(28, 7.5, 0.22, wall, 0, 3.75, 17.6));
  group.add(box(0.22, 7.5, 42, wall, -14, 3.75, -1.2));
  group.add(box(0.22, 7.5, 42, wall, 14, 3.75, -1.2));
  group.add(box(27.7, 1.65, 0.25, lowerWall, 0, 0.83, 17.42));
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 3; tier += 1) {
      group.add(box(2.7, 0.28, 9 - tier * 0.45, seat, side * (7.4 + tier * 0.48), 0.25 + tier * 0.3, 3));
    }
  }
  for (let z = -17; z <= 17; z += 6.8) {
    const beam = box(28, 0.13, 0.13, steel, 0, 7.1, z);
    group.add(beam);
  }
  return group;
};

const createStadiumBackdrop = (): THREE.Group => {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8e989b, roughness: 0.92 });
  const seats = new THREE.MeshStandardMaterial({ color: 0x173f64, roughness: 0.7 });
  const wall = new THREE.MeshStandardMaterial({ color: 0x171e23, roughness: 0.76, side: THREE.DoubleSide });
  group.add(box(34, 8.5, 0.3, wall, 0, 4.25, 20));
  group.add(box(0.3, 8.5, 46, wall, -17, 4.25, -1));
  group.add(box(0.3, 8.5, 46, wall, 17, 4.25, -1));
  for (const side of [-1, 1]) {
    for (let tier = 0; tier < 7; tier += 1) {
      group.add(box(3.2, 0.32, 16 - tier * 0.65, concrete, side * (7.4 + tier * 0.68), 0.18 + tier * 0.38, 2.2));
      group.add(box(2.75, 0.13, 15.5 - tier * 0.65, seats, side * (7.3 + tier * 0.68), 0.42 + tier * 0.38, 2.2));
    }
  }
  for (let tier = 0; tier < 5; tier += 1) {
    group.add(box(26 - tier * 1.2, 0.3, 1.25, concrete, 0, 0.18 + tier * 0.4, 14.5 + tier * 0.72));
    group.add(box(25.4 - tier * 1.2, 0.12, 0.9, seats, 0, 0.42 + tier * 0.4, 14.4 + tier * 0.72));
  }
  return group;
};

export const createCourt = (surface: SurfaceId): { group: THREE.Group; courtMaterial: THREE.MeshStandardMaterial; venueGroups: Readonly<Record<VenueId, THREE.Group>> } => {
  const group = new THREE.Group();
  const runoff = new THREE.MeshStandardMaterial({ color: 0x557d5b, roughness: 0.95 });
  const surfaceColors: Record<SurfaceId, number> = {
    hard: 0x2f6c9b,
    clay: 0xa9532d,
    grass: 0x4c793d,
  };
  const courtMaterial = new THREE.MeshStandardMaterial({ color: surfaceColors[surface], roughness: 0.88 });
  group.add(box(24, 0.08, 39, runoff, 0, -0.08, 0));
  group.add(box(COURT.doublesWidth, 0.04, COURT.fullLength, courtMaterial, 0, -0.02, 0));

  const lineWidth = 0.055;
  addLine(group, COURT.doublesWidth + lineWidth, lineWidth, 0, -COURT.halfLength);
  addLine(group, COURT.doublesWidth + lineWidth, lineWidth, 0, COURT.halfLength);
  addLine(group, lineWidth, COURT.fullLength, -COURT.doublesWidth / 2, 0);
  addLine(group, lineWidth, COURT.fullLength, COURT.doublesWidth / 2, 0);
  addLine(group, lineWidth, COURT.fullLength, -COURT.singlesWidth / 2, 0);
  addLine(group, lineWidth, COURT.fullLength, COURT.singlesWidth / 2, 0);
  addLine(group, COURT.singlesWidth, lineWidth, 0, -COURT.serviceLineFromNet);
  addLine(group, COURT.singlesWidth, lineWidth, 0, COURT.serviceLineFromNet);
  addLine(group, lineWidth, COURT.serviceLineFromNet * 2, 0, 0);
  addLine(group, 0.1, 0.22, 0, -COURT.halfLength);
  addLine(group, 0.1, 0.22, 0, COURT.halfLength);

  group.add(createNet());
  group.add(createBallMachine());
  group.add(createUmpireChair());
  group.add(createBench(6.8));
  const venueGroups = {
    outdoor: createOutdoorBackdrop(),
    'club-hall': createHallBackdrop(),
    stadium: createStadiumBackdrop(),
  } satisfies Record<VenueId, THREE.Group>;
  for (const [venue, venueGroup] of Object.entries(venueGroups)) {
    venueGroup.visible = venue === 'outdoor';
    group.add(venueGroup);
  }
  return { group, courtMaterial, venueGroups };
};
