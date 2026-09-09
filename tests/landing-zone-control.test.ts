import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LandingZoneControl } from '../src/engine/rendering/LandingZoneControl';
import { editLandingZone, landingZoneCenter, landingZoneLimits, type LandingZone } from '../src/engine/trajectory/landingZone';

const zone: LandingZone = { minX: -1, maxX: 1, minZ: -9, maxZ: -7 };
function setup(position = [0, 2, -14]) {
  const camera = new THREE.PerspectiveCamera(65, 1.5, .1, 200);
  camera.position.set(position[0]!, position[1]!, position[2]!); camera.lookAt(0, 0, -8); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 900, height: 600 }), style: { cursor: '' } } as unknown as HTMLCanvasElement;
  const changes: LandingZone[] = [], control = new LandingZoneControl(camera, canvas);
  control.configure(next => { changes.push(next); control.acceptModel(); control.setZone(next); });
  control.setZone(zone); control.setBounce({ x: .2, z: -8.3 }); control.update();
  const project = (x: number, z: number) => {
    const p = new THREE.Vector3(x, .025, z).project(camera);
    return { x: 10 + (p.x * .5 + .5) * 900, y: 20 + (.5 - p.y * .5) * 600 };
  };
  return { camera, canvas, control, changes, project };
}

describe('landing-zone edit gestures', () => {
  it('clears a stale bounce when its authored zone changes, then accepts the new physical bounce', () => {
    const { control } = setup();
    expect(control.displayedBounce).toEqual({ x: .2, z: -8.3 });
    const next = { ...zone, minX: 2, maxX: 4 };
    control.setZone(next); control.update();
    expect(control.displayedBounce).toBeNull();
    control.setBounce({ x: 3, z: -8 }, next); control.update();
    expect(control.displayedBounce).toEqual({ x: 3, z: -8 });
    control.setBounce(null); control.update();
    expect(control.displayedBounce).toBeNull();
  });

  it('publishes transient zone drafts without committing a drill, and clears the draft on cancel', () => {
    const { control, changes, project } = setup(), drafts: Array<LandingZone | null> = [];
    control.setDraftListener(zone => drafts.push(zone));
    const start = project(0, -8), end = project(.7, -7.8);
    control.begin(start.x, start.y); control.move(end.x, end.y);
    expect(drafts[0]!.minX).toBeCloseTo(-.3);
    expect(changes).toEqual([]);
    control.end(false);
    expect(drafts.at(-1)).toBeNull();
    expect(changes).toEqual([]);
  });
  it.each([[0, 2, -14], [7, 6, -13], [-5, 5, -15]])('updates only geometry during a drag from %s,%s,%s and commits once', (...position) => {
    const { control, changes, project, canvas } = setup(position), start = project(.3, -8.15);
    expect(control.begin(start.x, start.y)).toBe(true); expect(canvas.style.cursor).toBe('grabbing');
    const outline = (control.root.getObjectByName('LandingZoneBoundary') as THREE.Line).geometry;
    for (let i = 1; i <= 100; i++) {
      const p = project(.3 + .6 * i / 100, -8.15 + .4 * i / 100); control.move(p.x, p.y);
      expect(changes).toHaveLength(0);
    }
    const area = control.root.getObjectByName('LandingZoneArea')!;
    expect(area.position.x).toBeCloseTo(.6, 5); expect(area.position.z).toBeCloseTo(-7.6, 5);
    expect(area.position.y).toBe(.025);
    expect((control.root.getObjectByName('LandingZoneBoundary') as THREE.Line).geometry).toBe(outline);
    control.setZone({ minX: -3, maxX: -1, minZ: -8, maxZ: -6 });
    expect(area.position.x).toBeCloseTo(.6, 5); // An advancing feed cannot rebase the held draft.
    control.end(); control.end();
    expect(changes).toHaveLength(1); expect(landingZoneCenter(changes[0]!).x).toBeCloseTo(.6, 5);
    expect(changes[0]!.maxX - changes[0]!.minX).toBeCloseTo(2, 5);
  });

  it.each([
    [-1, -9, -.3, -.4, 'minX', 'minZ'], [1, -9, .3, -.4, 'maxX', 'minZ'],
    [1, -7, .3, .4, 'maxX', 'maxZ'], [-1, -7, -.3, .4, 'minX', 'maxZ'],
  ] as const)('resizes corner %s,%s while anchoring the opposite corner', (x, z, dx, dz, xEdge, zEdge) => {
    const { control, changes, canvas, project } = setup([7, 6, -13]), start = project(x, z), end = project(x + dx, z + dz);
    expect(control.hover(start.x, start.y)).toBe(true); expect(canvas.style.cursor).toContain('resize');
    control.begin(start.x, start.y); control.move(end.x, end.y); expect(changes).toHaveLength(0); control.end();
    const result = changes[0]!;
    expect(result[xEdge]).toBeCloseTo(x + dx, 5); expect(result[zEdge]).toBeCloseTo(z + dz, 5);
    expect(result[xEdge === 'minX' ? 'maxX' : 'minX']).toBe(zone[xEdge === 'minX' ? 'maxX' : 'minX']);
    expect(result[zEdge === 'minZ' ? 'maxZ' : 'minZ']).toBe(zone[zEdge === 'minZ' ? 'maxZ' : 'minZ']);
  });

  it.each([[1, -8, .5, .3, 'x'], [0, -9, .3, -.5, 'z']] as const)('an edge at %s,%s changes only its dimension', (x, z, dx, dz, axis) => {
    const { control, changes, project } = setup([7, 6, -13]), start = project(x, z), end = project(x + dx, z + dz);
    control.begin(start.x, start.y); control.move(end.x, end.y); control.end();
    expect(changes).toHaveLength(1);
    if (axis === 'x') { expect(changes[0]!.maxX).toBeCloseTo(1.5); expect(changes[0]!.minZ).toBe(-9); expect(changes[0]!.maxZ).toBe(-7); }
    else { expect(changes[0]!.minZ).toBeCloseTo(-9.5); expect(changes[0]!.minX).toBe(-1); expect(changes[0]!.maxX).toBe(1); }
  });

  it('leaves empty court to the camera, ignores click jitter and cancels without committing', () => {
    const { control, changes, project, canvas } = setup(), p = project(0, -8), outside = project(-3, -8);
    expect(control.begin(outside.x, outside.y)).toBe(false);
    control.begin(p.x, p.y); control.move(p.x + 1, p.y + 1); control.end(); expect(changes).toHaveLength(0);
    control.begin(p.x, p.y); control.move(p.x + 25, p.y + 15); control.end(false); control.leave();
    expect(changes).toHaveLength(0); expect(canvas.style.cursor).toBe('');
    expect(control.root.getObjectByName('LandingZoneArea')!.position.x).toBe(0);
    control.configure(null); expect(control.begin(p.x, p.y)).toBe(false);
    control.setZone(null); expect(control.root.visible).toBe(false);
  });

  it('keeps dimensions positive and capped, and bounds the whole draft to the legal court', () => {
    const limits = landingZoneLimits('groundstroke', { x: 0 });
    const crossing = editLandingZone(zone, { x: -1, z: -1 }, 20, 20, limits);
    expect(crossing.maxX - crossing.minX).toBeCloseTo(.2); expect(crossing.maxZ - crossing.minZ).toBeCloseTo(.2);
    const expanded = editLandingZone(zone, { x: 1, z: 1 }, 20, 20, limits);
    expect(expanded.maxX).toBeLessThanOrEqual(limits.maxX); expect(expanded.maxZ - expanded.minZ).toBeLessThanOrEqual(6);
    const moved = editLandingZone(zone, { x: 0, z: 0 }, 200, -200, limits);
    expect(moved.maxX).toBe(limits.maxX); expect(moved.minZ).toBe(limits.minZ); expect(moved.maxZ - moved.minZ).toBe(2);
  });

  it('supports camera-relative keyboard movement after selection', () => {
    const { control, camera, changes } = setup([7, 6, -13]);
    expect(control.key('ArrowUp')).toBe(false); control.key('Enter');
    const forward = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize(); control.key('ArrowUp');
    expect(landingZoneCenter(changes[0]!).x).toBeCloseTo(forward.x * .2, 5);
    control.key('ArrowDown'); expect(landingZoneCenter(changes.at(-1)!).x).toBeCloseTo(0, 5);
    control.key('Escape'); expect(control.key('ArrowRight')).toBe(false);
  });
});
