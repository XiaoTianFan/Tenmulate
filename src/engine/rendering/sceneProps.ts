import * as THREE from 'three';
import { COURT } from '../../domain/court';
import type { SceneMaterialLibrary } from './sceneMaterials';
import { box, cylinder, instancedBoxes, markShadows, type BoxTransform } from './scenePrimitives';

const cloneDoubleSidedMaterial = (material: THREE.Material): THREE.Material => {
  const clone = material.clone();
  clone.side = THREE.DoubleSide;
  clone.onBeforeCompile = material.onBeforeCompile;
  clone.customProgramCacheKey = material.customProgramCacheKey;
  clone.userData = { ...material.userData };
  return clone;
};

export const createNet = (materials: SceneMaterialLibrary): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'regulation-net';
  const halfWidth = COURT.doublesWidth / 2 + 0.15;
  group.add(box(0.075, COURT.netPostHeight, 0.075, materials.darkMetal, -halfWidth, COURT.netPostHeight / 2, 0));
  group.add(box(0.075, COURT.netPostHeight, 0.075, materials.darkMetal, halfWidth, COURT.netPostHeight / 2, 0));

  const points: THREE.Vector3[] = [];
  // Court-independent density: narrow square-ish weave in every fallback venue.
  const divisions = Math.ceil(halfWidth * 2 / 0.042);
  for (let index = 0; index <= divisions; index += 1) {
    const x = -halfWidth + (index / divisions) * halfWidth * 2;
    const normalized = Math.abs(x / halfWidth);
    const top = COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7;
    points.push(new THREE.Vector3(x, 0.05, 0), new THREE.Vector3(x, top, 0));
  }
  for (let row = 1; row <= 24; row += 1) {
    const ratio = row / 25;
    for (let index = 0; index < divisions; index += 1) {
      const x1 = -halfWidth + (index / divisions) * halfWidth * 2;
      const x2 = -halfWidth + ((index + 1) / divisions) * halfWidth * 2;
      const topAt = (x: number) => COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * Math.abs(x / halfWidth) ** 1.7;
      points.push(new THREE.Vector3(x1, ratio * topAt(x1), 0), new THREE.Vector3(x2, ratio * topAt(x2), 0));
    }
  }
  const cords = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    // One-pixel WebGL lines cover more than the physical Blender cords at range;
    // soften their coverage so the tighter weave does not become a solid screen.
    new THREE.LineBasicMaterial({ color: 0x18231e, transparent: true, opacity: 0.68 }),
  );
  cords.name = 'dense-woven-net-cords';
  group.add(cords);
  const tapeVertices: number[] = [];
  const tapeIndices: number[] = [];
  const tapeSegments = 72;
  const tapeWidth = 0.075;
  for (let index = 0; index <= tapeSegments; index += 1) {
    const x = -halfWidth + (index / tapeSegments) * halfWidth * 2;
    const normalized = Math.abs(x / halfWidth);
    const y = COURT.netCenterHeight + (COURT.netPostHeight - COURT.netCenterHeight) * normalized ** 1.7 + 0.035;
    tapeVertices.push(x, y + tapeWidth / 2, -0.004, x, y - tapeWidth / 2, -0.004);
    if (index < tapeSegments) {
      const offset = index * 2;
      tapeIndices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
    }
  }
  const tapeGeometry = new THREE.BufferGeometry();
  tapeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tapeVertices, 3));
  tapeGeometry.setIndex(tapeIndices);
  tapeGeometry.computeVertexNormals();
  const tapeMaterial = cloneDoubleSidedMaterial(materials.line);
  const tape = new THREE.Mesh(tapeGeometry, tapeMaterial);
  tape.name = 'wide-regulation-net-tape';
  tape.castShadow = true;
  group.add(tape);
  group.add(box(0.035, COURT.netCenterHeight, 0.018, materials.line, 0, COURT.netCenterHeight / 2, 0));
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
  seatMaterial: THREE.Material = materials.blueSeat,
  compactScale = 0.68,
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
  group.add(instancedBoxes(0.42, 0.08, 0.42, seatMaterial, seats));
  group.add(instancedBoxes(0.08, 0.42, 0.42, seatMaterial, backs));
  const railX = -side * 0.46;
  group.add(box(0.055, 0.055, length, materials.darkMetal, railX, 1.03, 0));
  for (let z = -length / 2; z <= length / 2 + 0.01; z += 1.55) {
    group.add(box(0.055, 1.02, 0.055, materials.darkMetal, railX, 0.51, z));
  }
  group.scale.set(compactScale, compactScale, 1);
  group.position.set(side * 8.65, 0, 3.1);
  return group;
};

export type StadiumStandOptions = Readonly<{
  rows: number;
  columns: number;
  length: number;
  seatMaterial: THREE.Material;
  rowDepth?: number;
  rowRise?: number;
  aisleCount?: number;
  seatScale?: number;
}>;

export const createStadiumStand = (
  materials: SceneMaterialLibrary,
  side: -1 | 1,
  options: StadiumStandOptions,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = side < 0 ? 'west-multi-tier-stadium-stand' : 'east-multi-tier-stadium-stand';
  const rowDepth = options.rowDepth ?? 0.62;
  const rowRise = options.rowRise ?? 0.38;
  const seatScale = options.seatScale ?? 1;
  const aisleCount = options.aisleCount ?? 2;
  const columnSpacing = options.length / options.columns;
  const aisleColumns = new Set<number>();
  for (let aisle = 1; aisle <= aisleCount; aisle += 1) {
    const center = Math.round((options.columns * aisle) / (aisleCount + 1));
    aisleColumns.add(center - 1);
    aisleColumns.add(center);
  }

  const seats: BoxTransform[] = [];
  const backs: BoxTransform[] = [];
  const stepTransforms: BoxTransform[] = [];
  const aisleTransforms: BoxTransform[] = [];
  for (let row = 0; row < options.rows; row += 1) {
    const x = side * row * rowDepth;
    const rise = 0.34 + row * rowRise;
    stepTransforms.push({
      position: [x, rise / 2, 0],
      scale: [1, rise, 1],
    });
    for (let column = 0; column < options.columns; column += 1) {
      const z = -options.length / 2 + (column + 0.5) * columnSpacing;
      if (aisleColumns.has(column)) {
        if (column % 2 === 0) aisleTransforms.push({ position: [x - side * 0.02, rise + 0.045, z] });
        continue;
      }
      seats.push({
        position: [x - side * 0.08, rise + 0.12, z],
        rotation: [0, 0, side * -0.035],
      });
      backs.push({
        position: [x + side * 0.19, rise + 0.38, z],
        rotation: [0, 0, side * -0.08],
      });
    }
  }

  group.add(instancedBoxes(rowDepth + 0.08, 1, options.length, materials.concrete, stepTransforms));
  group.add(instancedBoxes(0.46 * seatScale, 0.09, 0.46 * seatScale, options.seatMaterial, seats));
  group.add(instancedBoxes(0.09, 0.46 * seatScale, 0.46 * seatScale, options.seatMaterial, backs));
  if (aisleTransforms.length > 0) {
    group.add(instancedBoxes(rowDepth * 0.9, 0.09, columnSpacing * 2.05, materials.paleConcrete, aisleTransforms));
  }

  const frontX = -side * 0.38;
  group.add(box(0.07, 0.07, options.length, materials.darkMetal, frontX, 1.02, 0));
  for (let z = -options.length / 2; z <= options.length / 2 + 0.01; z += 2.1) {
    group.add(box(0.065, 1.02, 0.065, materials.darkMetal, frontX, 0.51, z));
  }
  for (const aisle of Array.from({ length: aisleCount }, (_, index) => index + 1)) {
    const z = -options.length / 2 + options.length * aisle / (aisleCount + 1);
    const rail = box(options.rows * rowDepth, 0.055, 0.055, materials.lightMetal, side * (options.rows - 1) * rowDepth / 2, 0.95 + (options.rows - 1) * rowRise / 2, z);
    rail.rotation.z = side * Math.atan2((options.rows - 1) * rowRise, Math.max(0.1, (options.rows - 1) * rowDepth));
    group.add(rail);
  }
  return group;
};

export type RoundedArenaTierOptions = Readonly<{
  radiusX: number;
  radiusZ: number;
  exponent: number;
  rows: number;
  baseHeight: number;
  seatMaterial: THREE.Material;
  rowDepth?: number;
  rowRise?: number;
  seatSpacing?: number;
  aisleCount?: number;
  aisleWidth?: number;
  startAngle?: number;
  endAngle?: number;
}>;

const signedPower = (value: number, power: number): number => Math.sign(value) * Math.abs(value) ** power;

const superellipsePoint = (
  angle: number,
  radiusX: number,
  radiusZ: number,
  exponent: number,
): readonly [number, number] => {
  const power = 2 / exponent;
  return [
    radiusX * signedPower(Math.cos(angle), power),
    radiusZ * signedPower(Math.sin(angle), power),
  ];
};

const wrappedAngleDistance = (left: number, right: number): number => {
  const delta = Math.abs(left - right) % (Math.PI * 2);
  return Math.min(delta, Math.PI * 2 - delta);
};

const createSteppedBowlGeometry = (options: RoundedArenaTierOptions, segments: number): THREE.BufferGeometry => {
  const vertices: number[] = [];
  const indices: number[] = [];
  const start = options.startAngle ?? 0;
  const end = options.endAngle ?? Math.PI * 2;
  const rowDepth = options.rowDepth ?? 0.62;
  const rowRise = options.rowRise ?? 0.4;
  const pushQuad = (points: readonly (readonly [number, number, number])[]): void => {
    const offset = vertices.length / 3;
    for (const point of points) vertices.push(...point);
    indices.push(offset, offset + 2, offset + 1, offset + 2, offset + 3, offset + 1);
  };
  for (let row = 0; row < options.rows; row += 1) {
    const centerX = options.radiusX + row * rowDepth;
    const centerZ = options.radiusZ + row * rowDepth;
    const innerX = centerX - rowDepth * 0.48;
    const innerZ = centerZ - rowDepth * 0.48;
    const outerX = centerX + rowDepth * 0.5;
    const outerZ = centerZ + rowDepth * 0.5;
    const y = options.baseHeight + row * rowRise;
    const riserBottom = row === 0 ? options.baseHeight - 0.42 : y - rowRise + 0.015;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle0 = THREE.MathUtils.lerp(start, end, segment / segments);
      const angle1 = THREE.MathUtils.lerp(start, end, (segment + 1) / segments);
      const inner0 = superellipsePoint(angle0, innerX, innerZ, options.exponent);
      const inner1 = superellipsePoint(angle1, innerX, innerZ, options.exponent);
      const outer0 = superellipsePoint(angle0, outerX, outerZ, options.exponent);
      const outer1 = superellipsePoint(angle1, outerX, outerZ, options.exponent);
      pushQuad([
        [inner0[0], y, inner0[1]], [outer0[0], y, outer0[1]],
        [inner1[0], y, inner1[1]], [outer1[0], y, outer1[1]],
      ]);
      pushQuad([
        [outer0[0], riserBottom, outer0[1]], [outer0[0], y, outer0[1]],
        [outer1[0], riserBottom, outer1[1]], [outer1[0], y, outer1[1]],
      ]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const createRoundedArenaTier = (
  materials: SceneMaterialLibrary,
  options: RoundedArenaTierOptions,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'continuous-rounded-arena-tier';
  const start = options.startAngle ?? 0;
  const end = options.endAngle ?? Math.PI * 2;
  const span = end - start;
  const fullLoop = Math.abs(span - Math.PI * 2) < 0.01;
  const segments = Math.max(48, Math.round(144 * span / (Math.PI * 2)));
  const terrace = new THREE.Mesh(createSteppedBowlGeometry(options, segments), materials.concrete);
  terrace.name = 'stepped-rounded-concrete-bowl';
  terrace.castShadow = true;
  terrace.receiveShadow = true;
  group.add(terrace);

  const rowDepth = options.rowDepth ?? 0.62;
  const rowRise = options.rowRise ?? 0.4;
  const seats: BoxTransform[] = [];
  const backs: BoxTransform[] = [];
  const aisleCount = options.aisleCount ?? 12;
  const aisleWidth = options.aisleWidth ?? 0.045;
  const aisleAngles = Array.from({ length: aisleCount }, (_, index) => start + span * (index + 0.5) / aisleCount);
  for (let row = 0; row < options.rows; row += 1) {
    const radiusX = options.radiusX + row * rowDepth;
    const radiusZ = options.radiusZ + row * rowDepth;
    const circumference = Math.PI * (3 * (radiusX + radiusZ) - Math.sqrt((3 * radiusX + radiusZ) * (radiusX + 3 * radiusZ)));
    const columns = Math.max(24, Math.round(circumference * span / (Math.PI * 2) / (options.seatSpacing ?? 0.52)));
    for (let column = 0; column < columns; column += 1) {
      const angle = THREE.MathUtils.lerp(start, end, (column + 0.5) / columns);
      const inAisle = aisleAngles.some((aisleAngle) => (
        fullLoop ? wrappedAngleDistance(angle, aisleAngle) : Math.abs(angle - aisleAngle)
      ) < aisleWidth);
      if (inAisle) continue;
      const point = superellipsePoint(angle, radiusX, radiusZ, options.exponent);
      const normal = new THREE.Vector2(point[0] / (radiusX * radiusX), point[1] / (radiusZ * radiusZ)).normalize();
      const yaw = Math.atan2(normal.x, normal.y);
      const y = options.baseHeight + row * rowRise;
      seats.push({ position: [point[0] - normal.x * 0.07, y + 0.13, point[1] - normal.y * 0.07], rotation: [0, yaw, 0] });
      backs.push({ position: [point[0] + normal.x * 0.18, y + 0.38, point[1] + normal.y * 0.18], rotation: [0, yaw, 0] });
    }
  }
  group.add(instancedBoxes(0.46, 0.085, 0.42, options.seatMaterial, seats));
  group.add(instancedBoxes(0.46, 0.46, 0.085, options.seatMaterial, backs));

  const railPoints: THREE.Vector3[] = [];
  const railSamples = Math.max(48, Math.round(96 * span / (Math.PI * 2)));
  for (let sample = 0; sample <= railSamples; sample += 1) {
    const angle = THREE.MathUtils.lerp(start, end, sample / railSamples);
    const point = superellipsePoint(angle, options.radiusX - 0.42, options.radiusZ - 0.42, options.exponent);
    railPoints.push(new THREE.Vector3(point[0], options.baseHeight + 1.02, point[1]));
  }
  const railCurve = new THREE.CatmullRomCurve3(railPoints, fullLoop, 'catmullrom', 0.12);
  const rail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, railSamples * 2, 0.045, 6, fullLoop), materials.darkMetal);
  rail.name = 'rounded-front-guardrail';
  group.add(rail);
  for (let index = 0; index < railPoints.length; index += Math.max(1, Math.floor(railPoints.length / 26))) {
    const point = railPoints[index];
    group.add(box(0.055, 1.02, 0.055, materials.darkMetal, point.x, options.baseHeight + 0.51, point.z));
  }
  group.userData.visibleSeatCount = seats.length;
  return group;
};

export const createSuperellipseFascia = (
  material: THREE.Material,
  radiusX: number,
  radiusZ: number,
  exponent: number,
  y: number,
  height: number,
): THREE.Mesh => {
  const vertices: number[] = [];
  const indices: number[] = [];
  const segments = 160;
  for (let segment = 0; segment < segments; segment += 1) {
    const point0 = superellipsePoint(segment / segments * Math.PI * 2, radiusX, radiusZ, exponent);
    const point1 = superellipsePoint((segment + 1) / segments * Math.PI * 2, radiusX, radiusZ, exponent);
    const offset = vertices.length / 3;
    vertices.push(
      point0[0], y - height / 2, point0[1], point0[0], y + height / 2, point0[1],
      point1[0], y - height / 2, point1[1], point1[0], y + height / 2, point1[1],
    );
    indices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const roofMaterial = cloneDoubleSidedMaterial(material);
  const mesh = new THREE.Mesh(geometry, roofMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

export const createSuperellipseRoofRing = (
  material: THREE.Material,
  innerX: number,
  innerZ: number,
  outerX: number,
  outerZ: number,
  exponent: number,
  y: number,
): THREE.Mesh => {
  const vertices: number[] = [];
  const indices: number[] = [];
  const segments = 160;
  for (let segment = 0; segment < segments; segment += 1) {
    const angle0 = segment / segments * Math.PI * 2;
    const angle1 = (segment + 1) / segments * Math.PI * 2;
    const inner0 = superellipsePoint(angle0, innerX, innerZ, exponent);
    const inner1 = superellipsePoint(angle1, innerX, innerZ, exponent);
    const outer0 = superellipsePoint(angle0, outerX, outerZ, exponent);
    const outer1 = superellipsePoint(angle1, outerX, outerZ, exponent);
    const offset = vertices.length / 3;
    vertices.push(
      inner0[0], y, inner0[1], outer0[0], y, outer0[1],
      inner1[0], y, inner1[1], outer1[0], y, outer1[1],
    );
    indices.push(offset, offset + 2, offset + 1, offset + 2, offset + 3, offset + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const roofMaterial = cloneDoubleSidedMaterial(material);
  const mesh = new THREE.Mesh(geometry, roofMaterial);
  mesh.name = 'continuous-rounded-roof-ring';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
    const light = new THREE.SpotLight(0xe7f2ff, 28, 48, 0.62, 0.66, 1.15);
    light.name = 'fixture-aligned-floodlight';
    light.position.set(lampX, 8.88, faceZ * 0.12);
    light.userData.baseIntensity = 28;
    light.target.position.set(-x, -8.88, -z);
    group.add(light, light.target);
  }
  group.position.set(x, 0, z);
  return group;
};

export const createCeilingFixture = (
  materials: SceneMaterialLibrary,
  x: number,
  y: number,
  z: number,
  width = 4.8,
  baseIntensity = 42,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = 'aligned-ceiling-fixture';
  group.position.set(x, y, z);
  group.add(box(width + 0.2, 0.16, 0.72, materials.darkMetal, 0, 0, 0));
  const lens = box(width, 0.08, 0.58, materials.lamp, 0, -0.11, 0);
  lens.name = 'fixture-visible-lens';
  group.add(lens);
  const light = new THREE.SpotLight(0xe7f2ff, baseIntensity, 38, 0.82, 0.72, 1.25);
  light.name = 'fixture-aligned-light-source';
  light.position.set(0, -0.12, 0);
  light.userData.baseIntensity = baseIntensity;
  light.target.position.set(-x, -y, -z);
  group.add(light, light.target);
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
