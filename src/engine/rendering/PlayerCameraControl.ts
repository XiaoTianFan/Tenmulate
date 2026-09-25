import * as THREE from 'three';
import { COURT } from '../../domain/court';
import { SHOT_CAMERA_RANGES } from '../../domain/cameraRanges';
import type { CameraConfiguration } from './TennisScene';

const clamp = (value: number, range: readonly number[]) => Math.max(range[0]!, Math.min(range[1]!, value));
export function movePlayerCamera(camera: CameraConfiguration, dx: number, dz: number): CameraConfiguration {
  return { ...camera, lateral: clamp(camera.lateral + dx, SHOT_CAMERA_RANGES.lateral),
    behindBaseline: clamp(camera.behindBaseline - dz, SHOT_CAMERA_RANGES.behindBaseline) };
}
export function turnPlayerCamera(camera: CameraConfiguration, x: number, z: number): CameraConfiguration {
  const dx = x - camera.lateral, dz = z + COURT.halfLength + camera.behindBaseline;
  return Math.hypot(dx, dz) < .1 ? camera : { ...camera, yaw: Math.atan2(dx, dz) * 180 / Math.PI };
}

/** Top-down camera glyph and heading handle. A gesture publishes one authored edit. */
export class PlayerCameraControl {
  readonly root = new THREE.Group();
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.08);
  private readonly hit = new THREE.Vector3();
  private value: CameraConfiguration | null = null;
  private change: ((camera: CameraConfiguration) => void) | null = null;
  private drag: { mode: 'move' | 'turn'; start: THREE.Vector3; original: CameraConfiguration } | null = null;
  private hovered: 'move' | 'turn' | null = null;
  constructor(private camera: THREE.PerspectiveCamera, private canvas: HTMLCanvasElement) {
    const material = new THREE.MeshBasicMaterial({ color: 0x74cfff, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const disk = new THREE.Mesh(new THREE.CircleGeometry(.55, 32), material);
    disk.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(.6, .67, 32), material);
    ring.rotation.x = -Math.PI / 2;
    // Camera body and lens, viewed from above.
    const white = new THREE.MeshBasicMaterial({ color: 0x08131a, depthTest: false, depthWrite: false, toneMapped: false });
    const body = new THREE.Mesh(new THREE.BoxGeometry(.52, .03, .36), white);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(.26, .03, .16), white);
    lens.position.z = .24;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(.055, .02, .85), material); stem.position.z = 1.12;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.23, .5, 3), material);
    arrow.rotation.x = Math.PI / 2; arrow.position.z = 1.7;
    const handle = new THREE.Mesh(new THREE.RingGeometry(.25, .34, 24), material);
    handle.rotation.x = -Math.PI / 2; handle.position.z = 2.2;
    this.root.add(disk, ring, body, lens, stem, arrow, handle);
    this.root.traverse(object => { object.renderOrder = 100; });
    body.renderOrder = lens.renderOrder = 101;
    this.root.name = 'PlayerCameraMarker'; this.root.visible = false;
  }
  configure(value: CameraConfiguration | null, change: ((camera: CameraConfiguration) => void) | null) {
    if (!value || !change) { this.end(false); this.value = null; this.hovered = null; }
    else if (!this.drag) this.value = value;
    this.change = change; this.update();
  }
  private point(x: number, y: number) {
    const b = this.canvas.getBoundingClientRect(); this.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2((x-b.left)/b.width*2-1, 1-(y-b.top)/b.height*2), this.camera);
    return this.ray.ray.intersectPlane(this.plane, this.hit);
  }
  screenPoints() {
    if (!this.value) return null;
    const b = this.canvas.getBoundingClientRect(), v = this.value, yaw = v.yaw*Math.PI/180;
    const project = (x: number, z: number) => {
      const p = new THREE.Vector3(x, .08, z).project(this.camera);
      return { x: b.left+(p.x+1)*b.width/2, y: b.top+(1-p.y)*b.height/2 };
    };
    const z = -COURT.halfLength-v.behindBaseline;
    return { body: project(v.lateral,z), heading: project(v.lateral+2.2*Math.sin(yaw),z+2.2*Math.cos(yaw)) };
  }
  hover(x: number, y: number) {
    const points = this.screenPoints();
    this.hovered = !points || !this.change ? null : Math.hypot(x-points.heading.x,y-points.heading.y)<16 ? 'turn'
      : Math.hypot(x-points.body.x,y-points.body.y)<20 ? 'move' : null;
    return !!this.hovered;
  }
  begin(x: number, y: number) {
    if (!this.hover(x,y) || !this.point(x,y) || !this.value) return false;
    this.drag = { mode: this.hovered!, start: this.hit.clone(), original: this.value }; return true;
  }
  move(x: number, y: number) {
    if (!this.drag || !this.point(x,y)) return;
    this.value = this.drag.mode === 'move' ? movePlayerCamera(this.drag.original,this.hit.x-this.drag.start.x,this.hit.z-this.drag.start.z)
      : turnPlayerCamera(this.drag.original,this.hit.x,this.hit.z);
    this.update();
  }
  end(commit: boolean) {
    if (!this.drag) return;
    const original = this.drag.original; this.drag = null;
    if (commit && this.value && JSON.stringify(this.value)!==JSON.stringify(original)) this.change?.(this.value);
    else this.value = original;
    this.update();
  }
  leave() { this.hovered = null; }
  get cursor() { return this.drag ? 'grabbing' : this.hovered === 'turn' ? 'crosshair' : this.hovered ? 'grab' : ''; }
  update() {
    this.root.visible = !!this.value;
    if (this.value) { this.root.position.set(this.value.lateral,.08,-COURT.halfLength-this.value.behindBaseline); this.root.rotation.y=this.value.yaw*Math.PI/180; }
  }
}
