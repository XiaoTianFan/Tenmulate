import * as THREE from 'three';

export const box = (
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

export const cylinder = (
  radius: number,
  height: number,
  material: THREE.Material,
  x = 0,
  y = height / 2,
  z = 0,
  segments = 16,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

export type BoxTransform = Readonly<{
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
}>;

export const instancedBoxes = (
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  transforms: readonly BoxTransform[],
): THREE.InstancedMesh => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(width, height, depth), material, transforms.length);
  const helper = new THREE.Object3D();
  transforms.forEach((transform, index) => {
    helper.position.set(...transform.position);
    helper.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    helper.scale.set(...(transform.scale ?? [1, 1, 1]));
    helper.updateMatrix();
    mesh.setMatrixAt(index, helper.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

export const markShadows = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};
