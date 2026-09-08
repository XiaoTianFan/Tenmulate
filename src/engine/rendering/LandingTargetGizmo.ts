import * as THREE from 'three';
import { landingZoneCenter, type LandingZone } from '../trajectory/landingZone';

export type LandingPoint = Readonly<{ x: number; z: number }>;
type Axis = 'X' | 'Z';
type Pick = { axis: Axis | null; sign: number };

/** A world-space, ground-plane translation gizmo. All visible controls are meshes. */
export class LandingTargetGizmo {
  readonly root = new THREE.Group();
  readonly zoneRoot = new THREE.Group();
  private readonly zoneFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: 0xffe924, transparent: true, opacity: .13, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  private readonly zoneOutline = new THREE.LineLoop(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffe924, transparent: true, opacity: .8, toneMapped: false }));
  private readonly bounceMarker = new THREE.Mesh(new THREE.TorusGeometry(.075, .015, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  private zone: LandingZone | null = null;
  private readonly arrows = new THREE.Group();
  private readonly center: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pickers: THREE.Object3D[] = [];
  private readonly axisMaterials: Record<Axis, THREE.MeshBasicMaterial>;
  private target: LandingPoint = { x: 0, z: 0 };
  private bounce = new THREE.Vector3();
  private onChange: ((point: LandingPoint) => void) | null = null;
  private hovered: Axis | null = null;
  private expanded = false;
  private drag: { pick: Pick; plane: THREE.Plane; start: THREE.Vector3; origin: THREE.Vector3;
    target: LandingPoint; screenX: number; screenY: number; moved: boolean } | null = null;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly canvas: HTMLCanvasElement) {
    this.root.name = 'LandingTargetGizmo';
    this.root.visible = false;
    this.zoneRoot.name = 'LandingZone';
    this.zoneRoot.visible = false;
    this.zoneFill.rotation.x = -Math.PI / 2;
    this.bounceMarker.rotation.x = -Math.PI / 2;
    this.zoneRoot.add(this.zoneFill, this.zoneOutline, this.bounceMarker);
    this.axisMaterials = {
      X: new THREE.MeshBasicMaterial({ color: 0xff6955, toneMapped: false }),
      Z: new THREE.MeshBasicMaterial({ color: 0x50b6ff, toneMapped: false }),
    };
    this.center = new THREE.Mesh(new THREE.SphereGeometry(.085, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe924, toneMapped: false }));
    this.center.name = 'LandingOrigin';
    this.center.userData.pick = { axis: null, sign: 0 };
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.14, .018, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe924, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    this.root.add(this.center, ring, this.arrows);
    this.pickers.push(this.center);
    for (const axis of ['X', 'Z'] as const) for (const sign of [-1, 1]) {
      const direction = new THREE.Vector3(axis === 'X' ? sign : 0, 0, axis === 'Z' ? sign : 0);
      const arrow = new THREE.Group();
      arrow.name = `Landing${axis}${sign > 0 ? 'Positive' : 'Negative'}`;
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.023, .023, .66, 12), this.axisMaterials[axis]);
      shaft.position.y = .55;
      const head = new THREE.Mesh(new THREE.ConeGeometry(.09, .23, 16), this.axisMaterials[axis]);
      head.position.y = .995;
      arrow.add(shaft, head);
      this.arrows.add(arrow);
      // A slightly wider invisible hit volume keeps the 3D arrows usable on touch.
      const picker = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1, 8),
        new THREE.MeshBasicMaterial({ visible: false }));
      picker.position.y = .65;
      picker.userData.pick = { axis, sign };
      arrow.add(picker);
      this.pickers.push(picker);
    }
  }

  configure(target: LandingPoint, onChange: ((point: LandingPoint) => void) | null): void {
    this.target = this.zone ? landingZoneCenter(this.zone) : target;
    this.onChange = onChange;
    this.root.visible = !!onChange;
    if (!onChange) { this.drag = null; this.expanded = false; }
  }

  setBounce(point: Readonly<{ x: number; y: number; z: number }>): void {
    this.bounceMarker.position.set(point.x, .04, point.z);
    const center = this.zone ? landingZoneCenter(this.zone) : point;
    this.bounce.set(center.x, .09, center.z);
    if (!this.drag) this.root.position.copy(this.bounce);
  }

  setZone(zone: LandingZone | null): void {
    this.zone = zone;
    this.zoneRoot.visible = !!zone;
    if (!zone) return;
    const center = landingZoneCenter(zone);
    this.target = center;
    this.zoneFill.position.set(center.x, .025, center.z);
    this.zoneFill.scale.set(zone.maxX - zone.minX, zone.maxZ - zone.minZ, 1);
    this.zoneOutline.geometry.dispose();
    this.zoneOutline.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(zone.minX, .03, zone.minZ), new THREE.Vector3(zone.maxX, .03, zone.minZ),
      new THREE.Vector3(zone.maxX, .03, zone.maxZ), new THREE.Vector3(zone.minX, .03, zone.maxZ),
    ]);
    this.bounce.set(center.x, .09, center.z);
    if (!this.drag) this.root.position.copy(this.bounce);
  }

  update(): void {
    if (!this.root.visible) return;
    // Perspective size adjustment changes only mesh scale, never axis orientation.
    if (!this.drag) this.root.scale.setScalar(THREE.MathUtils.clamp(this.camera.position.distanceTo(this.root.position) * .07, .65, 1.7));
    this.arrows.visible = this.expanded || !!this.drag;
    this.axisMaterials.X.color.setHex(this.hovered === 'X' ? 0xffe924 : 0xff6955);
    this.axisMaterials.Z.color.setHex(this.hovered === 'Z' ? 0xffe924 : 0x50b6ff);
    this.root.updateMatrixWorld(true);
  }

  /** Diagnostic projections only; interaction uses raycasts against the meshes. */
  screenPoints(): Record<string, Readonly<{x:number;y:number}>> {
    this.camera.updateMatrixWorld();
    const bounds=this.canvas.getBoundingClientRect();
    return Object.fromEntries(['Origin','XPositive','XNegative','ZPositive','ZNegative'].map(name=>{
      const point = name==='Origin' ? this.root.position.clone() : this.root.getObjectByName(`Landing${name}`)!
        .localToWorld(new THREE.Vector3(0,.85,0));
      point.project(this.camera);
      return [name,{x:(point.x*.5+.5)*bounds.width,y:(.5-point.y*.5)*bounds.height}];
    }));
  }

  private ray(clientX: number, clientY: number): THREE.Ray {
    this.camera.updateMatrixWorld();
    const bounds = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2), this.camera);
    return this.raycaster.ray;
  }

  private pick(clientX: number, clientY: number): Pick | null {
    this.ray(clientX, clientY);
    this.update();
    const hit = this.raycaster.intersectObjects(this.expanded ? this.pickers : [this.center], false)[0];
    return hit?.object.userData.pick ?? null;
  }

  hover(clientX: number, clientY: number): boolean {
    if (!this.root.visible || this.drag) return !!this.drag;
    const hit = this.pick(clientX, clientY);
    const bounds = this.canvas.getBoundingClientRect(), projected = this.root.position.clone().project(this.camera);
    const distance = Math.hypot(clientX - bounds.left - (projected.x * .5 + .5) * bounds.width,
      clientY - bounds.top - (-projected.y * .5 + .5) * bounds.height);
    this.expanded = !!hit || (projected.z >= -1 && projected.z <= 1 && distance < (this.expanded ? 85 : 18));
    this.hovered = hit?.axis ?? null;
    this.canvas.style.cursor = hit ? 'grab' : '';
    this.update();
    return this.expanded;
  }

  begin(clientX: number, clientY: number): boolean {
    if (!this.root.visible) return false;
    this.hover(clientX, clientY);
    const pick = this.pick(clientX, clientY);
    if (!pick) return false;
    this.expanded = true;
    // The plane contains the selected world axis and faces the camera as much
    // as possible, so projected-axis dragging works from oblique viewpoints too.
    const normal = this.camera.position.clone().sub(this.root.position);
    if (pick.axis === 'X') normal.x = 0;
    else if (pick.axis === 'Z') normal.z = 0;
    else normal.set(0, 1, 0);
    if (normal.lengthSq() < 1e-8) normal.set(0, 1, 0);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), this.root.position);
    const start = this.ray(clientX, clientY).intersectPlane(plane, new THREE.Vector3());
    if (!start) return false;
    this.drag = { pick, plane, start, origin: this.root.position.clone(), target: this.target,
      screenX: clientX, screenY: clientY, moved: false };
    this.canvas.style.cursor = 'grabbing';
    return true;
  }

  move(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag?.pick.axis) return;
    if (!drag.moved && Math.hypot(clientX - drag.screenX, clientY - drag.screenY) < 3) return;
    const point = this.ray(clientX, clientY).intersectPlane(drag.plane, new THREE.Vector3());
    if (!point) return;
    drag.moved = true;
    const axis = drag.pick.axis === 'X' ? 'x' : 'z', delta = point[axis] - drag.start[axis];
    this.root.position.copy(drag.origin);
    this.root.position[axis] += delta;
    this.onChange?.({ ...drag.target, [axis]: drag.target[axis] + delta });
  }

  end(cancel = false): void {
    const drag = this.drag;
    if (!cancel && drag?.pick.axis && !drag.moved) {
      const axis = drag.pick.axis === 'X' ? 'x' : 'z';
      this.onChange?.({ ...drag.target, [axis]: drag.target[axis] + .2 * drag.pick.sign });
    }
    this.drag = null;
    this.root.position.copy(this.bounce);
    this.canvas.style.cursor = '';
  }

  leave(): void {
    if (this.drag) return;
    this.expanded = false;
    this.hovered = null;
    this.canvas.style.cursor = '';
    this.update();
  }

  key(key: string): boolean {
    if (!this.root.visible || this.drag) return false;
    if (key === 'Enter' || key === ' ') { this.expanded = true; this.update(); return true; }
    if (!this.expanded) return false;
    if (key === 'Escape') { this.leave(); return true; }
    if (key.toLowerCase() === 'x' || key.toLowerCase() === 'z') {
      this.hovered = key.toUpperCase() as Axis;
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
      const axis = this.hovered === 'Z' ? 'z' : 'x';
      const points=this.screenPoints(),positive=points[axis==='x'?'XPositive':'ZPositive']!,origin=points.Origin!;
      const horizontal=key==='ArrowLeft'||key==='ArrowRight';
      const direction=horizontal?positive.x-origin.x:positive.y-origin.y;
      const sign=(Math.abs(direction)>.001?Math.sign(direction):1)*(key==='ArrowLeft'||key==='ArrowUp'?-1:1);
      this.onChange?.({ ...this.target, [axis]: this.target[axis] + sign * .2 });
    } else return false;
    this.update();
    return true;
  }
}
