import * as THREE from 'three';
import { COURT, type SurfaceId } from '../../domain/court';
import { VENUE_IDS, type VenueId } from '../../domain/environment';
import { applyCourtSurface, createSceneMaterialBundle, type SceneMaterialBundle } from './sceneMaterials';
import { box } from './scenePrimitives';
import { createBallMachine, createNet, createRestBench, createUmpireChair } from './sceneProps';
import { createVenueGroups } from './sceneVenues';

export type CourtBuildResult = Readonly<{
  group: THREE.Group;
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
  const line = box(width, 0.012, depth, material, x, 0.021, z);
  line.name = 'court-line';
  group.add(line);
};

export const createCourt = (surface: SurfaceId): CourtBuildResult => {
  const group = new THREE.Group();
  group.name = 'tenmulate-canonical-court-world';
  const materialBundle = createSceneMaterialBundle(surface);
  const { materials } = materialBundle;

  const runoff = box(24, 0.08, 39, materials.runoff, 0, -0.08, 0);
  runoff.name = 'runoff-surface';
  const playingSurface = box(COURT.doublesWidth, 0.04, COURT.fullLength, materials.court, 0, -0.02, 0);
  playingSurface.name = 'regulation-playing-surface';
  group.add(runoff, playingSurface);

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

  group.add(createNet(materials));
  group.add(createBallMachine(materials));
  group.add(createUmpireChair(materials));
  group.add(createRestBench(materials, -1));
  group.add(createRestBench(materials, 1));

  const venueGroups = createVenueGroups(materials);
  for (const venue of VENUE_IDS) group.add(venueGroups[venue]);

  return {
    group,
    courtMaterial: materials.court,
    venueGroups,
    materialBundle,
    setSurface: (nextSurface) => applyCourtSurface(materialBundle, nextSurface),
  };
};
