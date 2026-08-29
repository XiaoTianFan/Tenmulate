import * as THREE from 'three';
import { COURT } from '../../domain/court';
import type { SceneMaterialLibrary } from './sceneMaterials';
import { box, cylinder, instancedBoxes, markShadows, type BoxTransform } from './scenePrimitives';

export const createNet = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'regulation-net';
  const halfWidth = COURT.doublesWidth / 2 + 0.15;
  group.add(box(0.075, COURT.netPostHeight, 0.075, materials.darkMetal, -halfWidth, COURT.netPostHeight / 2, 0));
  group.add(box(0.075, COURT.netPostHeight, 0.075, materials.darkMetal, halfWidth, COURT.netPostHeight / 2, 0));

  const points: THREE.Vector3[] = [];
  const divisions = 28;
  for (let index = 0; index <= divisions; index += 1) {
    const x = -halfWidth + (index / divisions) * halfWidth * 2;
    const normalized = Math.abs(x / halfWidth);
    const top = COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7;
    points.push(new THREE.Vector3(x, 0.05, 0), new THREE.Vector3(x, top, 0));
  }
  for (let row = 1; row <= 10; row += 1) {
    const ratio = row / 11;
    for (let index = 0; index < divisions; index += 1) {
      const x1 = -halfWidth + (index / divisions) * halfWidth * 2;
      const x2 = -halfWidth + ((index + 1) / divisions) * halfWidth * 2;
      const topAt = (x: number) => COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * Math.abs(x / halfWidth) ** 1.7;
      points.push(new THREE.Vector3(x1, ratio * topAt(x1), 0), new THREE.Vector3(x2, ratio * topAt(x2), 0));
    }
  }
  group.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x34454a, transparent: true, opacity: 0.62 }),
  ));
  const tapePoints: THREE.Vector3[] = [];
  for (let index = 0; index <= 48; index += 1) {
    const x = -halfWidth + (index / 48) * halfWidth * 2;
    const normalized = Math.abs(x / halfWidth);
    const y = COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7 + 0.035;
    tapePoints.push(new THREE.Vector3(x, y, 0));
  }
  group.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(tapePoints),
    new THREE.LineBasicMaterial({ color: 0xf5f5ee }),
  ));
  return group;
};

export const createBallMachine = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'temporary-ball-machine';
  const accent = new THREE.MeshStandardMaterial({ color: 0xf2df21, roughness: 0.55 });
  group.add(box(0.72, 0.76, 0.55, materials.darkMetal, 0, 0.66, 0));
  group.add(box(0.5, 0.12, 0.58, accent, 0, 1.04, 0));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 24), materials.darkMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.18, -0.22);
  group.add(barrel);
  for (const x of [-0.34, 0.34]) {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.11, 20), materials.darkWall);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(x, 0.28, 0.08);
    group.add(tire);
  }
  group.position.set(0, 0, COURT.halfLength - 0.45);
  group.rotation.y = Math.PI;
  markShadows(group);
  return group;
};

export const createRestBench = (materials: SceneMaterialLibrary, side: -1 | 1): THREE.Group => {
  const group = new THREE.Group();
  group.name = side < 0 ? 'west-player-shelter' : 'east-player-shelter';
  group.add(box(0.62, 0.1, 2.4, materials.paleSeat, 0, 0.56, 0));
  group.add(box(0.1, 0.7, 2.4, materials.paleSeat, side * 0.25, 0.88, 0));
  for (const z of [-0.85, 0.85]) group.add(box(0.08, 0.55, 0.08, materials.lightMetal, 0, 0.27, z));
  for (const z of [-1.35, 1.35]) {
    group.add(box(0.08, 2.15, 0.08, materials.lightMetal, side * 0.5, 1.08, z));
  }
  const canopy = box(1.65, 0.12, 3.25, materials.blueSeat, side * 0.1, 2.18, 0);
  canopy.rotation.z = side * -0.08;
  group.add(canopy);
  group.position.set(side * 6.8, 0, 2.3);
  return group;
};

export const createUmpireChair = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'umpire-chair';
  group.add(box(0.75, 0.12, 0.62, materials.paleSeat, 0, 1.7, 0));
  group.add(box(0.75, 0.72, 0.1, materials.paleSeat, 0, 2.04, 0.27));
  group.add(box(0.9, 0.07, 0.74, materials.roof, 0, 2.48, 0));
  group.add(box(0.08, 1.7, 0.08, materials.lightMetal, -0.32, 0.85, 0));
  group.add(box(0.08, 1.7, 0.08, materials.lightMetal, 0.32, 0.85, 0));
  for (let rung = 0; rung < 6; rung += 1) group.add(box(0.66, 0.045, 0.045, materials.lightMetal, 0, 0.25 + rung * 0.25, -0.25));
  group.position.set(-6.3, 0, 0.2);
  return group;
};

export const createChainLinkPanel = (
  width: number,
  height: number,
  materials: SceneMaterialLibrary,
  spacing = 0.42,
): THREE.LineSegments => {
  const points: THREE.Vector3[] = [];
  for (let intercept = -width / 2 - height; intercept <= width / 2; intercept += spacing) {
    const x1 = Math.max(-width / 2, intercept);
    const y1 = x1 - intercept;
    const x2 = Math.min(width / 2, intercept + height);
    const y2 = x2 - intercept;
    if (x2 > x1) points.push(new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0));
  }
  for (let intercept = -width / 2; intercept <= width / 2 + height; intercept += spacing) {
    const x1 = Math.max(-width / 2, intercept - height);
    const y1 = -x1 + intercept;
    const x2 = Math.min(width / 2, intercept);
    const y2 = -x2 + intercept;
    if (x2 > x1) points.push(new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0));
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), materials.fence);
  lines.renderOrder = 1;
  return lines;
};

export const createFenceEnclosure = (
  materials: SceneMaterialLibrary,
  width = 22,
  length = 36.5,
  height = 3.3,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'chain-link-enclosure';
  const farZ = 16.25;
  const nearZ = farZ - length;
  const farPanel = createChainLinkPanel(width, height, materials);
  farPanel.position.set(0, 0.08, farZ);
  group.add(farPanel);
  for (const side of [-1, 1]) {
    const panel = createChainLinkPanel(length, height, materials);
    panel.rotation.y = Math.PI / 2;
    panel.position.set(side * width / 2, 0.08, (farZ + nearZ) / 2);
    group.add(panel);
  }
  const postTransforms: BoxTransform[] = [];
  for (let z = nearZ; z <= farZ + 0.01; z += 3.05) {
    postTransforms.push({ position: [-width / 2, height / 2, z] }, { position: [width / 2, height / 2, z] });
  }
  for (let x = -width / 2; x <= width / 2 + 0.01; x += 2.75) postTransforms.push({ position: [x, height / 2, farZ] });
  group.add(instancedBoxes(0.075, height + 0.15, 0.075, materials.fencePost, postTransforms));
  group.add(box(width, 0.065, 0.065, materials.fencePost, 0, height + 0.08, farZ));
  group.add(box(0.065, 0.065, length, materials.fencePost, -width / 2, height + 0.08, (farZ + nearZ) / 2));
  group.add(box(0.065, 0.065, length, materials.fencePost, width / 2, height + 0.08, (farZ + nearZ) / 2));
  return group;
};

export const createBleachers = (
  materials: SceneMaterialLibrary,
  side: -1 | 1,
  rows = 4,
  columns = 12,
  length = 9.4,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = side < 0 ? 'west-blue-bleachers' : 'east-blue-bleachers';
  const seats: BoxTransform[] = [];
  const backs: BoxTransform[] = [];
  for (let row = 0; row < rows; row += 1) {
    const x = side * row * 0.55;
    const y = 0.47 + row * 0.32;
    group.add(box(0.64, 0.25 + row * 0.32, length, materials.concrete, x, (0.25 + row * 0.32) / 2, 0));
    for (let column = 0; column < columns; column += 1) {
      const z = -length / 2 + 0.55 + column * ((length - 1.1) / Math.max(1, columns - 1));
      seats.push({ position: [x - side * 0.06, y, z] });
      backs.push({ position: [x + side * 0.2, y + 0.22, z] });
    }
  }
  group.add(instancedBoxes(0.42, 0.08, 0.42, materials.blueSeat, seats));
  group.add(instancedBoxes(0.08, 0.42, 0.42, materials.blueSeat, backs));
  const railX = -side * 0.46;
  group.add(box(0.055, 0.055, length, materials.darkMetal, railX, 1.03, 0));
  for (let z = -length / 2; z <= length / 2 + 0.01; z += 1.55) {
    group.add(box(0.055, 1.02, 0.055, materials.darkMetal, railX, 0.51, z));
  }
  group.scale.set(0.68, 0.68, 1);
  group.position.set(side * 8.65, 0, 3.1);
  return group;
};

export const createLightPole = (materials: SceneMaterialLibrary, x: number, z: number, faceZ: number): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'court-light-pole';
  group.add(cylinder(0.095, 9.2, materials.darkMetal, 0, 4.6, 0, 12));
  group.add(box(2.1, 0.11, 0.12, materials.darkMetal, 0, 9.05, 0));
  for (const lampX of [-0.78, -0.26, 0.26, 0.78]) {
    const lamp = box(0.4, 0.22, 0.16, materials.lamp, lampX, 8.88, faceZ * 0.12);
    lamp.rotation.x = faceZ * 0.18;
    group.add(lamp);
  }
  group.position.set(x, 0, z);
  return group;
};

export const createBroadleafTree = (
  materials: SceneMaterialLibrary,
  x: number,
  z: number,
  scale = 1,
  variant = 0,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'broadleaf-tree';
  group.add(cylinder(0.15 * scale, 2.8 * scale, materials.trunk, 0, 1.4 * scale, 0, 10));
  const foliage = materials.foliage[variant % materials.foliage.length];
  const clusters: readonly [number, number, number, number][] = [
    [0, 3.24, 0, 1.08], [-0.82, 3.02, 0.12, 0.82], [0.78, 3.07, 0.22, 0.88],
    [0.08, 3.86, -0.25, 0.76], [-0.5, 3.62, -0.52, 0.72], [0.52, 3.54, -0.48, 0.74],
    [-1.02, 3.45, -0.34, 0.62], [1.02, 3.42, -0.18, 0.64], [0.02, 2.9, 0.62, 0.76],
  ];
  for (const [cx, cy, cz, radius] of clusters) {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 14, 9), foliage);
    crown.position.set(cx * scale, cy * scale, cz * scale);
    crown.scale.y = 0.8;
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);
  }
  const leafGeometry = new THREE.DodecahedronGeometry(0.2 * scale, 0);
  const leafTufts = new THREE.InstancedMesh(leafGeometry, materials.foliage[(variant + 1) % materials.foliage.length], 28);
  const helper = new THREE.Object3D();
  for (let index = 0; index < 28; index += 1) {
    const angle = index * 2.399963 + variant * 0.71;
    const band = (index % 7) / 6;
    const radius = (0.72 + (index % 5) * 0.09) * scale;
    helper.position.set(
      Math.cos(angle) * radius,
      (2.72 + band * 1.34) * scale,
      Math.sin(angle) * radius * 0.72,
    );
    helper.scale.setScalar(0.72 + (index % 4) * 0.14);
    helper.rotation.set(angle * 0.17, angle, band * 0.4);
    helper.updateMatrix();
    leafTufts.setMatrixAt(index, helper.matrix);
  }
  leafTufts.castShadow = true;
  leafTufts.receiveShadow = true;
  group.add(leafTufts);
  group.position.set(x, 0, z);
  return group;
};

export const createCypressTree = (materials: SceneMaterialLibrary, x: number, z: number, scale = 1): THREE.Group => {
  const group = new THREE.Group();
  group.add(cylinder(0.11 * scale, 2.2 * scale, materials.trunk, 0, 1.1 * scale, 0, 10));
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.72 * scale, 4.8 * scale, 14), materials.foliage[2]);
  crown.position.y = 3.5 * scale;
  crown.castShadow = true;
  group.add(crown);
  group.position.set(x, 0, z);
  return group;
};

export const createHedge = (
  materials: SceneMaterialLibrary,
  width: number,
  height: number,
  depth: number,
  x: number,
  z: number,
): THREE.Group => {
  const group = new THREE.Group();
  group.add(box(width, height * 0.88, depth, materials.hedge, 0, height * 0.44, 0));
  const clumpCount = Math.max(3, Math.round(width / 0.65));
  const clumps = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(Math.min(0.38, height * 0.3), 1),
    materials.foliage[2],
    clumpCount,
  );
  const helper = new THREE.Object3D();
  for (let index = 0; index < clumpCount; index += 1) {
    helper.position.set(-width / 2 + (index + 0.5) * (width / clumpCount), height * 0.86, ((index % 3) - 1) * depth * 0.16);
    helper.scale.set(1.2, 0.62 + (index % 2) * 0.14, 1);
    helper.rotation.y = index * 1.7;
    helper.updateMatrix();
    clumps.setMatrixAt(index, helper.matrix);
  }
  clumps.castShadow = true;
  clumps.receiveShadow = true;
  group.add(clumps);
  group.position.set(x, 0, z);
  return group;
};
