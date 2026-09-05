import * as THREE from 'three';
import type { SurfaceId } from '../../domain/court';
import { applyCourtSurface, createSceneMaterialBundle } from './sceneMaterials';
import { createBallMachine } from './sceneProps';

/** Gameplay equipment and surface overrides only. Visible courts, markings,
 * nets, architecture and seating are authored in Blender. */
export const createCourt = (surface: SurfaceId) => {
  const group = new THREE.Group();
  group.name = 'tenmulate-canonical-court-world';
  const materialBundle = createSceneMaterialBundle(surface);
  group.add(createBallMachine(materialBundle.materials));
  return { group, materialBundle, setSurface: (next: SurfaceId) => applyCourtSurface(materialBundle, next) };
};
