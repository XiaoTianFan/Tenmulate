import * as THREE from 'three';
import { editLandingZone, landingZoneCenter, landingZoneLimits, type LandingZone, type ZoneHandle } from '../trajectory/landingZone';

const HEIGHT = .025;
const MOVE: ZoneHandle = { x: 0, z: 0 };
const HANDLES: readonly ZoneHandle[] = [
  { x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 },
  { x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 },
];

/** Pointer movement edits only these meshes; the expensive session commits once on release. */
export class LandingZoneControl {
  readonly root = new THREE.Group();
  private readonly fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: 0xffe924, transparent: true, opacity: .13, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  private readonly outline = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)),
    new THREE.LineBasicMaterial({ color: 0xffe924, transparent: true, opacity: .8, toneMapped: false }));
  private readonly bounceMarker = new THREE.Mesh(new THREE.TorusGeometry(.075, .015, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  private readonly grips = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly intersection = new THREE.Vector3();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HEIGHT);
  private readonly lastCamera = new THREE.Matrix4();
  private readonly lastProjection = new THREE.Matrix4();
  private zone: LandingZone | null = null;
  private visible = true;
  private canonicalZone: LandingZone | null = null;
  private limits = landingZoneLimits('groundstroke', { x: 0 });
  private onChange: ((zone: LandingZone) => void) | null = null;
  private onDraft: ((zone: LandingZone | null) => void) | null = null;
  private bounceZone: LandingZone | null = null;
  private hasBounce = false;
  private showBounce: boolean;
  private pointer: { x: number; y: number; radius: number } | null = null;
  private hovered: ZoneHandle | null = null;
  private selected = false;
  private dirty = true;
  private pending = false;
  private drag: { start: THREE.Vector3; zone: LandingZone; limits: LandingZone; handle: ZoneHandle; clientX: number; clientY: number; moved: boolean } | null = null;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly canvas: HTMLCanvasElement,
    private readonly options: { color?: number; name?: string; showBounce?: boolean; sharedCursor?: boolean } = {}) {
    this.showBounce = options.showBounce !== false;
    this.root.name = 'LandingZone'; this.root.visible = false;
    this.fill.name = 'LandingZoneArea'; this.fill.rotation.x = -Math.PI / 2;
    this.outline.name = 'LandingZoneBoundary';
    this.bounceMarker.name = 'ActualBounce'; this.bounceMarker.rotation.x = -Math.PI / 2;
    this.grips.name = 'LandingZoneResizeGrips';
    const geometry = new THREE.BoxGeometry(.07, .015, .07);
    for (const handle of HANDLES) {
      const grip = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffe924, toneMapped: false }));
      grip.userData.handle = handle; this.grips.add(grip);
    }
    this.root.add(this.fill, this.outline, this.bounceMarker, this.grips);
    this.root.name = options.name ?? 'LandingZone';
    this.fill.material.color.setHex(options.color ?? 0xffe924);
    this.outline.material.color.setHex(options.color ?? 0xffe924);
  }

  configure(onChange: ((zone: LandingZone) => void) | null): void {
    this.onChange = onChange;
    if (!onChange) { this.end(false); this.leave(); }
  }

  /** A new compiled session acknowledges the one completed edit. */
  acceptModel(): void { this.pending = false; }
  setDraftListener(listener: ((zone: LandingZone | null) => void) | null): void { this.onDraft = listener; }
  setBounce(point: Readonly<{ x: number; z: number }> | null, zone = this.canonicalZone): void {
    this.hasBounce = !!point; this.bounceZone = zone;
    if (point) this.bounceMarker.position.set(point.x, .04, point.z);
  }
  setBounceVisible(visible: boolean): void { this.showBounce = visible; }
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) { this.end(false); this.leave(); }
    this.root.visible = visible && !!this.zone;
  }
  get displayedBounce(): { x: number; z: number } | null {
    return this.root.visible && this.bounceMarker.visible ? { x: this.bounceMarker.position.x, z: this.bounceMarker.position.z } : null;
  }

  setZone(zone: LandingZone | null, limits = this.limits): void {
    this.canonicalZone = zone; this.limits = limits;
    if (!zone) { this.pending = false; this.end(false); this.leave(); }
    if (!this.drag && !this.pending) this.draw(zone);
  }

  private draw(zone: LandingZone | null): void {
    this.zone = zone; this.root.visible = this.visible && !!zone; this.dirty = true;
    if (!zone) return;
    const center = landingZoneCenter(zone);
    this.fill.position.set(center.x, HEIGHT, center.z);
    this.fill.scale.set(zone.maxX - zone.minX, zone.maxZ - zone.minZ, 1);
    const positions = this.outline.geometry.getAttribute('position');
    HANDLES.forEach((handle, i) => {
      const x = handle.x < 0 ? zone.minX : handle.x > 0 ? zone.maxX : center.x;
      const z = handle.z < 0 ? zone.minZ : handle.z > 0 ? zone.maxZ : center.z;
      if (i < 4) positions.setXYZ(i, x, .03, z);
      this.grips.children[i]!.position.set(x, .04, z);
    });
    positions.needsUpdate = true; this.outline.geometry.computeBoundingSphere();
  }

  update(): void {
    this.camera.updateMatrixWorld();
    if (!this.drag && this.pointer && (this.dirty || !this.lastCamera.equals(this.camera.matrixWorld) || !this.lastProjection.equals(this.camera.projectionMatrix))) {
      this.hovered = this.hit(this.pointer.x, this.pointer.y, this.pointer.radius);
      this.lastCamera.copy(this.camera.matrixWorld); this.lastProjection.copy(this.camera.projectionMatrix); this.dirty = false;
    }
    this.fill.material.opacity = this.drag ? .3 : this.hovered || this.selected ? .23 : .13;
    this.outline.material.opacity = this.drag || this.hovered || this.selected ? 1 : .8;
    this.grips.visible = !!this.onChange && (!!this.hovered || !!this.drag || this.selected);
    const matches = this.zone && this.bounceZone && (['minX', 'maxX', 'minZ', 'maxZ'] as const).every(key => Math.abs(this.zone![key] - this.bounceZone![key]) < 1e-7);
    this.bounceMarker.visible = this.showBounce && this.hasBounce && !!matches && !this.drag && !this.pending;
    const active = this.drag?.handle ?? this.hovered;
    for (const grip of this.grips.children as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[]) {
      const h = grip.userData.handle as ZoneHandle, selected = active?.x === h.x && active.z === h.z;
      grip.material.color.setHex(selected ? 0xffffff : this.options.color ?? 0xffe924);
      grip.scale.setScalar(THREE.MathUtils.clamp(this.camera.position.distanceTo(grip.position) * .08, .7, 1.8) * (selected ? 1.3 : 1));
    }
    if (!this.options.sharedCursor && this.canvas.style.cursor !== this.cursor) this.canvas.style.cursor = this.cursor;
  }

  get cursor(): string {
    const active = this.drag?.handle ?? this.hovered;
    return active && (active.x || active.z) ? this.resizeCursor(active) : this.drag ? 'grabbing' : this.hovered ? 'grab' : '';
  }

  private resizeCursor(handle: ZoneHandle): string {
    const c = landingZoneCenter(this.zone!), a = this.project(c.x, c.z), b = this.project(c.x + handle.x, c.z + handle.z);
    const angle = ((Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) % 180 + 180) % 180;
    return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(angle / 45) % 4]!;
  }

  private project(x: number, z: number): { x: number; y: number; z: number } {
    const bounds = this.canvas.getBoundingClientRect(), p = new THREE.Vector3(x, HEIGHT, z).project(this.camera);
    return { x: (p.x * .5 + .5) * bounds.width, y: (.5 - p.y * .5) * bounds.height, z: p.z };
  }

  screenPoints(): Record<string, Readonly<{ x: number; y: number; z: number }>> {
    if (!this.zone || !this.root.visible) return {};
    const z = this.zone, c = landingZoneCenter(z);
    return { center: this.project(c.x, c.z), nearLeft: this.project(z.minX, z.minZ), nearRight: this.project(z.maxX, z.minZ),
      farRight: this.project(z.maxX, z.maxZ), farLeft: this.project(z.minX, z.maxZ), near: this.project(c.x, z.minZ),
      right: this.project(z.maxX, c.z), far: this.project(c.x, z.maxZ), left: this.project(z.minX, c.z) };
  }

  private ray(clientX: number, clientY: number): THREE.Ray {
    this.camera.updateMatrixWorld(); const b = this.canvas.getBoundingClientRect();
    this.ndc.set((clientX - b.left) / b.width * 2 - 1, 1 - (clientY - b.top) / b.height * 2);
    this.raycaster.setFromCamera(this.ndc, this.camera); return this.raycaster.ray;
  }

  private hit(clientX: number, clientY: number, radius: number): ZoneHandle | null {
    if (!this.zone || !this.root.visible || !this.onChange || this.pending) return null;
    const b = this.canvas.getBoundingClientRect(), x = clientX - b.left, y = clientY - b.top;
    if (x < 0 || y < 0 || x > b.width || y > b.height) return null;
    const point = this.ray(clientX, clientY).intersectPlane(this.plane, this.intersection), zone = this.zone;
    const inside = !!point && point.x >= zone.minX && point.x <= zone.maxX && point.z >= zone.minZ && point.z <= zone.maxZ;
    // Preserve a move region even when the zone projects smaller than a touch target.
    const insetX = (zone.maxX - zone.minX) / 4, insetZ = (zone.maxZ - zone.minZ) / 4;
    if (inside && point!.x > zone.minX + insetX && point!.x < zone.maxX - insetX
      && point!.z > zone.minZ + insetZ && point!.z < zone.maxZ - insetZ) return MOVE;
    const p = this.screenPoints(), corners = [p.nearLeft!, p.nearRight!, p.farRight!, p.farLeft!];
    // Corners win over edges; screen-distance tolerance stays usable at oblique views.
    for (let i = 0; i < 4; i++) if (corners[i]!.z > -1 && corners[i]!.z < 1 && Math.hypot(x - corners[i]!.x, y - corners[i]!.y) <= radius) return HANDLES[i]!;
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!, c = corners[(i + 1) % 4]!, dx = c.x - a.x, dy = c.y - a.y;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      if (a.z > -1 && c.z > -1 && a.z < 1 && c.z < 1 && Math.hypot(x - a.x - t * dx, y - a.y - t * dy) <= radius) return HANDLES[i + 4]!;
    }
    return inside ? MOVE : null;
  }

  hover(clientX: number, clientY: number, touch = false): boolean {
    this.pointer = { x: clientX, y: clientY, radius: touch ? 16 : 9 }; this.dirty = true; this.update();
    return !!this.drag || !!this.hovered;
  }

  begin(clientX: number, clientY: number, touch = false): boolean {
    if (this.drag || !this.hover(clientX, clientY, touch) || !this.zone) return false;
    const start = this.ray(clientX, clientY).intersectPlane(this.plane, new THREE.Vector3());
    if (!start) return false;
    this.drag = { start, zone: this.zone, limits: this.limits, handle: this.hovered!, clientX, clientY, moved: false };
    this.selected = false; this.update(); return true;
  }

  move(clientX: number, clientY: number): void {
    const drag = this.drag; if (!drag) return;
    this.pointer = { x: clientX, y: clientY, radius: this.pointer?.radius ?? 9 };
    if (!drag.moved && Math.hypot(clientX - drag.clientX, clientY - drag.clientY) < 3) return;
    const point = this.ray(clientX, clientY).intersectPlane(this.plane, this.intersection); if (!point) return;
    drag.moved = true;
    this.draw(editLandingZone(drag.zone, drag.handle, point.x - drag.start.x, point.z - drag.start.z, drag.limits));
    this.onDraft?.(this.zone);
    this.update();
  }

  end(commit = true): void {
    const drag = this.drag; this.drag = null;
    if (drag?.moved && commit && this.zone) { this.pending = true; this.onChange?.(this.zone); }
    else if (drag) this.draw(this.canonicalZone);
    if (drag) this.onDraft?.(null);
    this.dirty = true; this.update();
  }

  leave(): void {
    if (this.drag) return;
    this.pointer = null; this.hovered = null; this.selected = false; this.update();
  }

  key(key: string): boolean {
    if (!this.zone || !this.root.visible || !this.onChange || this.drag || this.pending) return false;
    if (key === 'Enter' || key === ' ') { this.selected = true; this.update(); return true; }
    if (!this.selected) return false;
    if (key === 'Escape') { this.leave(); return true; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return false;
    const forward = this.camera.getWorldDirection(new THREE.Vector3()).setY(0);
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1); forward.normalize();
    const direction = key === 'ArrowLeft' || key === 'ArrowRight' ? forward.clone().cross(new THREE.Vector3(0, 1, 0)) : forward;
    direction.multiplyScalar(key === 'ArrowLeft' || key === 'ArrowDown' ? -.2 : .2);
    const zone = editLandingZone(this.zone, MOVE, direction.x, direction.z, this.limits);
    this.draw(zone); this.pending = true; this.onChange(zone); return true;
  }
}
