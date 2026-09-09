import * as THREE from 'three';
import { OPPONENT_POSITION_LIMITS } from '../../domain/court';

export type OpponentPlacement = Readonly<{ x: number; z: number; hand: 'left' | 'right' }>;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** A court-plane gesture on the mannequin's body. Only release publishes an edit. */
export class OpponentPositionControl {
  readonly root = new THREE.Mesh(new THREE.RingGeometry(.46, .5, 40), new THREE.MeshBasicMaterial({ color: 0x74cfff, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  private readonly ray = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();
  private readonly box = new THREE.Box3();
  private canonical: OpponentPlacement | null = null;
  position: OpponentPlacement | null = null;
  private change: ((point: OpponentPlacement) => void) | null = null;
  private drag: { start: THREE.Vector3; position: OpponentPlacement } | null = null;
  private hovered = false;
  constructor(private camera: THREE.PerspectiveCamera, private canvas: HTMLCanvasElement) {
    this.root.rotation.x = -Math.PI / 2; this.root.visible = false;
    this.root.name = 'OpponentPlacementHover';
  }
  configure(position: OpponentPlacement | null, change: ((point: OpponentPlacement) => void) | null) {
    this.change = change;
    if (!position || position.x !== this.canonical?.x || position.z !== this.canonical?.z || position.hand !== this.canonical?.hand) {
      this.canonical = position; if (!this.drag) this.position = position;
    }
    if (!position || !change) { this.end(false); this.leave(); }
  }
  private rayAt(x: number, y: number) {
    const b = this.canvas.getBoundingClientRect();
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2((x - b.left) / b.width * 2 - 1, 1 - (y - b.top) / b.height * 2), this.camera);
  }
  hover(x: number, y: number): boolean {
    if (!this.position || !this.change) return false;
    this.rayAt(x, y);
    const p = this.position;
    this.box.min.set(p.x - .52, 0, p.z - .52); this.box.max.set(p.x + .52, 1.95, p.z + .52);
    this.hovered = this.ray.ray.intersectsBox(this.box); this.update(); return this.hovered;
  }
  begin(x: number, y: number) {
    if (!this.hover(x, y) || !this.ray.ray.intersectPlane(this.plane, this.hit)) return false;
    this.drag = { start: this.hit.clone(), position: this.position! }; return true;
  }
  move(x: number, y: number) {
    if (!this.drag) return;
    this.rayAt(x, y); if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return;
    const { start, position } = this.drag;
    this.position = { ...position, x: clamp(position.x + this.hit.x - start.x, -OPPONENT_POSITION_LIMITS.halfWidth, OPPONENT_POSITION_LIMITS.halfWidth),
      z: clamp(position.z + this.hit.z - start.z, .7, OPPONENT_POSITION_LIMITS.halfLength) };
    this.update();
  }
  end(commit: boolean) {
    if (!this.drag) return;
    const moved = this.position; this.drag = null;
    if (commit && moved) { this.canonical = moved; this.change?.(moved); }
    else this.position = this.canonical;
    this.update();
  }
  leave() { this.hovered = false; this.update(); }
  get cursor() { return this.drag ? 'grabbing' : this.hovered ? 'grab' : ''; }
  update() {
    this.root.visible = !!this.position && (!!this.drag || this.hovered);
    if (this.position) this.root.position.set(this.position.x, .035, this.position.z);
  }
  screenPoint() {
    if (!this.position) return null;
    const p = new THREE.Vector3(this.position.x, 1, this.position.z).project(this.camera), b = this.canvas.getBoundingClientRect();
    return { x: b.left + (p.x + 1) * b.width / 2, y: b.top + (1 - p.y) * b.height / 2 };
  }
  dispose() { this.root.geometry.dispose(); this.root.material.dispose(); }
}
