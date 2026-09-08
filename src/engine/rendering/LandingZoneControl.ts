import * as THREE from 'three';
import { landingZoneCenter, type LandingZone } from '../trajectory/landingZone';

export type LandingPoint = Readonly<{ x: number; z: number }>;
const ZONE_HEIGHT = .025;

/** Direct manipulation of the rendered area, constrained to the court plane. */
export class LandingZoneControl {
  readonly root = new THREE.Group();
  private readonly fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: 0xffe924, transparent: true, opacity: .13, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  private readonly outline = new THREE.LineLoop(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xffe924, transparent: true, opacity: .8, toneMapped: false }));
  private readonly bounceMarker = new THREE.Mesh(new THREE.TorusGeometry(.075, .015, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ZONE_HEIGHT);
  private zone: LandingZone | null = null;
  private target: LandingPoint = { x: 0, z: 0 };
  private onChange: ((point: LandingPoint) => void) | null = null;
  private pointer: { x: number; y: number } | null = null;
  private hovered = false;
  private selected = false;
  private drag: { start: THREE.Vector3; target: LandingPoint; clientX: number; clientY: number; moved: boolean } | null = null;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly canvas: HTMLCanvasElement) {
    this.root.name = 'LandingZone';
    this.root.visible = false;
    this.fill.name = 'LandingZoneArea';
    this.fill.rotation.x = -Math.PI / 2;
    this.outline.name = 'LandingZoneBoundary';
    this.bounceMarker.name = 'ActualBounce';
    this.bounceMarker.rotation.x = -Math.PI / 2;
    this.root.add(this.fill, this.outline, this.bounceMarker);
  }

  configure(target: LandingPoint, onChange: ((point: LandingPoint) => void) | null): void {
    this.target = this.zone ? landingZoneCenter(this.zone) : target;
    this.onChange = onChange;
    if (!onChange) { this.end(); this.leave(); }
  }

  setBounce(point: LandingPoint): void {
    this.bounceMarker.position.set(point.x, .04, point.z);
  }

  setZone(zone: LandingZone | null): void {
    this.zone = zone;
    this.root.visible = !!zone;
    if (!zone) { this.end(); this.leave(); return; }
    const center = landingZoneCenter(zone);
    this.target = center;
    this.fill.position.set(center.x, ZONE_HEIGHT, center.z);
    this.fill.scale.set(zone.maxX - zone.minX, zone.maxZ - zone.minZ, 1);
    this.outline.geometry.dispose();
    this.outline.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(zone.minX, .03, zone.minZ), new THREE.Vector3(zone.maxX, .03, zone.minZ),
      new THREE.Vector3(zone.maxX, .03, zone.maxZ), new THREE.Vector3(zone.minX, .03, zone.maxZ),
    ]);
  }

  update(): void {
    // A moving preview or camera can change what is under a stationary pointer.
    if (!this.drag && this.pointer) this.hovered = this.hit(this.pointer.x, this.pointer.y);
    this.fill.material.opacity = this.drag ? .32 : this.hovered || this.selected ? .25 : .13;
    this.outline.material.opacity = this.drag || this.hovered || this.selected ? 1 : .8;
    this.canvas.style.cursor = this.drag ? 'grabbing' : this.hovered ? 'grab' : '';
  }

  /** Diagnostic projections only; the visible area itself is the hit target. */
  screenPoints(): Record<string, Readonly<{ x: number; y: number; z: number }>> {
    if (!this.zone) return {};
    this.camera.updateMatrixWorld();
    const bounds = this.canvas.getBoundingClientRect(), zone = this.zone;
    return Object.fromEntries(Object.entries({
      center: landingZoneCenter(zone),
      nearLeft: { x: zone.minX, z: zone.minZ }, nearRight: { x: zone.maxX, z: zone.minZ },
      farRight: { x: zone.maxX, z: zone.maxZ }, farLeft: { x: zone.minX, z: zone.maxZ },
    }).map(([name, point]) => {
      const projected = new THREE.Vector3(point.x, ZONE_HEIGHT, point.z).project(this.camera);
      return [name, { x: (projected.x * .5 + .5) * bounds.width, y: (.5 - projected.y * .5) * bounds.height, z: projected.z }];
    }));
  }

  private ray(clientX: number, clientY: number): THREE.Ray {
    this.camera.updateMatrixWorld();
    const bounds = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2), this.camera);
    return this.raycaster.ray;
  }

  private hit(clientX: number, clientY: number): boolean {
    if (!this.root.visible || !this.onChange) return false;
    const bounds = this.canvas.getBoundingClientRect();
    if (clientX < bounds.left || clientY < bounds.top || clientX > bounds.left + bounds.width || clientY > bounds.top + bounds.height) return false;
    this.ray(clientX, clientY);
    this.root.updateMatrixWorld(true);
    return this.raycaster.intersectObject(this.fill, false).length > 0;
  }

  hover(clientX: number, clientY: number): boolean {
    this.pointer = { x: clientX, y: clientY };
    this.update();
    return !!this.drag || this.hovered;
  }

  begin(clientX: number, clientY: number): boolean {
    if (this.drag || !this.hover(clientX, clientY)) return false;
    const start = this.ray(clientX, clientY).intersectPlane(this.plane, new THREE.Vector3());
    if (!start) return false;
    // Keep the original grab offset. Recompiled zone updates must not rebase an
    // active gesture; both coordinates come from the same frozen court-plane hit.
    this.drag = { start, target: this.target, clientX, clientY, moved: false };
    this.selected = false;
    this.update();
    return true;
  }

  move(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag) return;
    this.pointer = { x: clientX, y: clientY };
    if (!drag.moved && Math.hypot(clientX - drag.clientX, clientY - drag.clientY) < 3) return;
    const point = this.ray(clientX, clientY).intersectPlane(this.plane, new THREE.Vector3());
    if (!point) return;
    drag.moved = true;
    this.onChange?.({ x: drag.target.x + point.x - drag.start.x, z: drag.target.z + point.z - drag.start.z });
  }

  end(): void {
    this.drag = null;
    this.update();
  }

  leave(): void {
    if (this.drag) return;
    this.pointer = null;
    this.hovered = false;
    this.selected = false;
    this.update();
  }

  key(key: string): boolean {
    if (!this.root.visible || !this.onChange || this.drag) return false;
    if (key === 'Enter' || key === ' ') { this.selected = true; this.update(); return true; }
    if (!this.selected) return false;
    if (key === 'Escape') { this.leave(); return true; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return false;
    // Keyboard directions follow the camera on the ground, including oblique views.
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
    forward.normalize();
    const direction = key === 'ArrowLeft' || key === 'ArrowRight'
      ? forward.clone().cross(new THREE.Vector3(0, 1, 0)) : forward;
    direction.multiplyScalar(key === 'ArrowLeft' || key === 'ArrowDown' ? -.2 : .2);
    this.onChange({ x: this.target.x + direction.x, z: this.target.z + direction.z });
    return true;
  }
}
