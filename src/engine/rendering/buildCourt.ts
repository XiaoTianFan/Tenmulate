import * as THREE from 'three';
import { COURT, type SurfaceId } from '../../domain/court';
import { VENUE_IDS, type VenueId } from '../../domain/environment';
import { applyCourtSurface, createSceneMaterialBundle, type SceneMaterialBundle } from './sceneMaterials';
import { box } from './scenePrimitives';
import { createBallMachine, createNet, createRestBench, createUmpireChair } from './sceneProps';
import { createVenueGroups } from './sceneVenues';

export type CourtBuildResult = Readonly<{
  group: THREE.Group;
  presentation: THREE.Group;
  courtMaterial: THREE.MeshStandardMaterial;
  venueGroups: Readonly<Record<VenueId, THREE.Group>>;
  materialBundle: SceneMaterialBundle;
  setSurface: (surface: SurfaceId) => void;
}>;

const addLine = (
  group: THREE.Group,
  material: THREE.Material,
  width: number,
  depth: number,
  x: number,
  z: number,
): void => {
  const line = box(width, 0.0015, depth, material, x, 0.00075, z);
  line.name = 'court-line';
  group.add(line);
};

const createRunoffRing = (material: THREE.Material): THREE.Mesh => {
  const halfWidth = 12;
  const halfLength = 19.5;
  const innerHalfWidth = COURT.doublesWidth / 2;
  const innerHalfLength = COURT.halfLength;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfLength);
  shape.lineTo(halfWidth, -halfLength);
  shape.lineTo(halfWidth, halfLength);
  shape.lineTo(-halfWidth, halfLength);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-innerHalfWidth, -innerHalfLength);
  hole.lineTo(-innerHalfWidth, innerHalfLength);
  hole.lineTo(innerHalfWidth, innerHalfLength);
  hole.lineTo(innerHalfWidth, -innerHalfLength);
  hole.closePath();
  shape.holes.push(hole);
  const runoff = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  runoff.rotation.x = -Math.PI / 2;
  runoff.name = 'runoff-surface';
  runoff.receiveShadow = true;
  return runoff;
};

export const createCourt = (surface: SurfaceId): CourtBuildResult => {
  const group = new THREE.Group();
  group.name = 'tenmulate-canonical-court-world';
  const presentation = new THREE.Group();
  presentation.name = 'procedural-court-presentation';
  const materialBundle = createSceneMaterialBundle(surface);
  const { materials } = materialBundle;

  const runoff = createRunoffRing(materials.runoff);
  const playingSurface = box(COURT.doublesWidth, 0.04, COURT.fullLength, materials.court, 0, -0.02, 0);
  playingSurface.name = 'regulation-playing-surface';
  presentation.add(runoff, playingSurface);

  const lineWidth = 0.055;
  addLine(group, materials.line, COURT.doublesWidth + lineWidth, lineWidth, 0, -COURT.halfLength);
  addLine(group, materials.line, COURT.doublesWidth + lineWidth, lineWidth, 0, COURT.halfLength);
  addLine(group, materials.line, lineWidth, COURT.fullLength, -COURT.doublesWidth / 2, 0);
  addLine(group, materials.line, lineWidth, COURT.fullLength, COURT.doublesWidth / 2, 0);
  addLine(group, materials.line, lineWidth, COURT.fullLength, -COURT.singlesWidth / 2, 0);
  addLine(group, materials.line, lineWidth, COURT.fullLength, COURT.singlesWidth / 2, 0);
  addLine(group, materials.line, COURT.singlesWidth, lineWidth, 0, -COURT.serviceLineFromNet);
  addLine(group, materials.line, COURT.singlesWidth, lineWidth, 0, COURT.serviceLineFromNet);
  addLine(group, materials.line, lineWidth, COURT.serviceLineFromNet * 2, 0, 0);
  addLine(group, materials.line, 0.1, 0.22, 0, -COURT.halfLength);
  addLine(group, materials.line, 0.1, 0.22, 0, COURT.halfLength);

  // Move the regulation line meshes into the replaceable presentation layer.
  for (const child of [...group.children]) presentation.add(child);
  presentation.add(createNet(materials));
  group.add(createBallMachine(materials));
  presentation.add(createUmpireChair(materials));
  presentation.add(createRestBench(materials, -1));
  presentation.add(createRestBench(materials, 1));
  group.add(presentation);

  const venueGroups = createVenueGroups(materials);
  for (const venue of VENUE_IDS) group.add(venueGroups[venue]);

  return {
    group,
    presentation,
    courtMaterial: materials.court,
    venueGroups,
    materialBundle,
    setSurface: (nextSurface) => applyCourtSurface(materialBundle, nextSurface),
  };
};
