import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LandingTargetGizmo, type LandingPoint } from '../src/engine/rendering/LandingTargetGizmo';

describe('world-space landing gizmo',()=>{
  it.each([[0,2,-14],[7,6,-13]])('raycasts and drags the actual court axes from camera %s,%s,%s',(x,y,z)=>{
    const camera=new THREE.PerspectiveCamera(65,1.5,.1,200);
    camera.position.set(x,y,z);camera.lookAt(0,0,-8);camera.updateMatrixWorld();
    const canvas={getBoundingClientRect:()=>({left:10,top:20,width:900,height:600}),style:{cursor:''}} as unknown as HTMLCanvasElement;
    let target:LandingPoint={x:0,z:-8};
    const gizmo=new LandingTargetGizmo(camera,canvas);
    gizmo.configure(target,point=>{target=point;});
    gizmo.setZone({minX:-1,maxX:1,minZ:-9,maxZ:-7});
    gizmo.setBounce({x:.2,y:.034,z:-8.3});gizmo.update();
    const project=(point:THREE.Vector3)=>{point.project(camera);return{x:10+(point.x*.5+.5)*900,y:20+(.5-point.y*.5)*600};};
    const origin=project(gizmo.root.position.clone());
    expect(gizmo.hover(origin.x,origin.y)).toBe(true);
    expect(gizmo.zoneRoot.children[0]!.scale.toArray()).toEqual([2,2,1]);
    for(const axis of ['X','Z'] as const){
      const arrow=gizmo.root.getObjectByName(`Landing${axis}Positive`)!;
      const point=arrow.localToWorld(new THREE.Vector3(0,.85,0));
      const vector=point.clone().sub(gizmo.root.position).normalize();
      expect(vector.distanceTo(new THREE.Vector3(axis==='X'?1:0,0,axis==='Z'?1:0))).toBeLessThan(1e-8);
      const start=project(point.clone()), end=project(point.clone().add(new THREE.Vector3(axis==='X'?.4:0,0,axis==='Z'?.4:0)));
      expect(gizmo.begin(start.x,start.y)).toBe(true);
      gizmo.move(end.x,end.y);gizmo.end();
      if(axis==='X'){expect(target.x).toBeCloseTo(.4,4);expect(target.z).toBe(-8);}
      else {expect(target.x).toBe(0);expect(target.z).toBeCloseTo(-7.6,4);}
      expect(canvas.style.cursor).toBe('');
    }
    expect(gizmo.root.position.toArray()).toEqual([0,.09,-8]);
    gizmo.leave();expect(gizmo.begin(0,0)).toBe(false);
    gizmo.configure(target,null);expect(gizmo.hover(origin.x,origin.y)).toBe(false);
  });
});
