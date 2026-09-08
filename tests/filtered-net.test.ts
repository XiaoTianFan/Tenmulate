import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {installFilteredNet} from '../src/engine/rendering/filteredNet';
import {disposeVenue} from '../src/engine/rendering/VenueAssetManager';

describe('filtered authored net',()=>{
 it.each(['woven-net','performance-net'])('keeps %s registration and disposes its presentation with the venue',role=>{
  const root=new THREE.Group();root.position.set(2,0,1);
  const source=new THREE.Mesh(new THREE.BoxGeometry(12.8,1.01,.0044),new THREE.MeshBasicMaterial());
  source.position.set(-2,.565,-1);source.userData={role,meshPitch:.042,cordRadius:.0022};root.add(source);
  const tape=new THREE.Mesh(new THREE.BoxGeometry(12.8,.05,.02),new THREE.MeshBasicMaterial());root.add(tape);
  root.updateWorldMatrix(true,true);
  const expected=new THREE.Box3().setFromObject(source);
  const net=installFilteredNet(root)!;
  const bounds=new THREE.Box3().setFromObject(net);
  expect(bounds.min.x).toBeCloseTo(expected.min.x,5);expect(bounds.max.x).toBeCloseTo(expected.max.x,5);
  expect(bounds.min.y).toBeCloseTo(expected.min.y,5);expect(bounds.max.y).toBeCloseTo(expected.max.y,5);
  expect(bounds.min.z).toBeCloseTo(0,5);expect(source.visible).toBe(false);expect(tape.visible).toBe(true);
  const centerTop=new THREE.Vector3().fromBufferAttribute(net.geometry.attributes.position!,49).applyMatrix4(root.matrixWorld);
  expect(centerTop.y).toBeCloseTo(expected.max.y-.156,5);
  expect((net.material as THREE.Material).depthWrite).toBe(false);
  const geometryDispose=vi.spyOn(net.geometry,'dispose'),materialDispose=vi.spyOn(net.material as THREE.Material,'dispose');
  disposeVenue(root);expect(geometryDispose).toHaveBeenCalledOnce();expect(materialDispose).toHaveBeenCalledOnce();
 });
});
