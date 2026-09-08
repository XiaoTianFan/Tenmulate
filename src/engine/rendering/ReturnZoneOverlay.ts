import * as THREE from 'three';
import type { CameraConfiguration } from './TennisScene';
import { cameraPlayerPosition } from '../session/playerCoverage';
import { returnZoneCorners, type ReturnZone } from '../session/returnZone';

/** Editor-only footprint; geometry is reused while the view changes. */
export class ReturnZoneOverlay {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  constructor() {
    this.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute('position',this.geometry.getAttribute('position'));
    fillGeometry.setIndex([0,1,2,0,2,3]);
    const fill = new THREE.Mesh(fillGeometry,new THREE.MeshBasicMaterial({color:0x45bfff,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
    const edge = new THREE.LineLoop(this.geometry,new THREE.LineBasicMaterial({color:0x65cfff,transparent:true,opacity:1,depthWrite:false,toneMapped:false}));
    edge.position.y=.01;edge.renderOrder=2;
    // The mutable geometry must not retain a previous bounding sphere.
    fill.frustumCulled = edge.frustumCulled = false;
    this.group.add(fill,edge);this.group.visible=false;
  }
  update(zone: ReturnZone | null, camera: CameraConfiguration): void {
    this.group.visible = !!zone;
    if(!zone)return;
    const points=returnZoneCorners({...cameraPlayerPosition(camera),yaw:camera.yaw},zone),attribute=this.geometry.getAttribute('position');
    points.forEach((point,i)=>attribute.setXYZ(i,point.x,point.y,point.z));
    attribute.needsUpdate=true;
  }
}
