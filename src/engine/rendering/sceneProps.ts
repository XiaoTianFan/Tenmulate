import * as THREE from 'three';
import { COURT } from '../../domain/court';
import type { SceneMaterialLibrary } from './sceneMaterials';
import { box, markShadows } from './scenePrimitives';

// Temporary gameplay launcher only. Venue equipment is now Blender-authored.
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
