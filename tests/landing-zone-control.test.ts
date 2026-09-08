import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LandingZoneControl, type LandingPoint } from '../src/engine/rendering/LandingZoneControl';

function setup(position = [0, 2, -14]) {
  const camera = new THREE.PerspectiveCamera(65, 1.5, .1, 200);
  camera.position.set(position[0]!, position[1]!, position[2]!);
  camera.lookAt(0, 0, -8); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 900, height: 600 }), style: { cursor: '' } } as unknown as HTMLCanvasElement;
  const changes: LandingPoint[] = [];
  const control = new LandingZoneControl(camera, canvas);
  const apply = (point: LandingPoint) => {
    changes.push(point);
    // Model updates during a gesture cannot change its original grab offset.
    control.setZone({ minX: point.x - 1, maxX: point.x + 1, minZ: point.z - 1, maxZ: point.z + 1 });
    control.configure(point, apply);
  };
  control.configure({ x: 0, z: -8 }, apply);
  control.setZone({ minX: -1, maxX: 1, minZ: -9, maxZ: -7 });
  control.setBounce({ x: .2, z: -8.3 }); control.update();
  const project = (x: number, z: number) => {
    const point = new THREE.Vector3(x, .025, z).project(camera);
    return { x: 10 + (point.x * .5 + .5) * 900, y: 20 + (.5 - point.y * .5) * 600 };
  };
  return { camera, canvas, control, changes, project };
}

describe('direct landing-zone manipulation', () => {
  it.each([[0, 2, -14], [7, 6, -13], [-5, 5, -15]])('grabs the area off-center and freely translates both court coordinates from %s,%s,%s', (...position) => {
    const { control, canvas, changes, project } = setup(position);
    const start = project(.7, -8.6);
    expect(control.hover(start.x, start.y)).toBe(true);
    expect(canvas.style.cursor).toBe('grab');
    expect(control.begin(start.x, start.y)).toBe(true);
    expect(changes).toHaveLength(0);
    expect(canvas.style.cursor).toBe('grabbing');
    for (const [dx, dz] of [[.4, .35], [.8, -.5], [-1.1, .6]]) {
      const end = project(.7 + dx!, -8.6 + dz!);
      control.move(end.x, end.y);
      expect(changes.at(-1)!.x).toBeCloseTo(dx!, 5);
      expect(changes.at(-1)!.z).toBeCloseTo(-8 + dz!, 5);
      expect(control.root.getObjectByName('LandingZoneArea')!.position.y).toBe(.025);
    }
    control.end(); control.leave();
    expect(canvas.style.cursor).toBe('');
    const after = changes.length;
    control.move(start.x, start.y);
    expect(changes).toHaveLength(after);
  });

  it('highlights only the visible area and leaves empty court, hidden zones and read-only previews to the camera', () => {
    const { control, canvas, project } = setup();
    const inside = project(-.8, -7.3), outside = project(-1.15, -7.3);
    const fill = control.root.getObjectByName('LandingZoneArea') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    expect(control.hover(inside.x, inside.y)).toBe(true);
    expect(fill.material.opacity).toBe(.25);
    expect(control.hover(outside.x, outside.y)).toBe(false);
    expect(fill.material.opacity).toBe(.13);
    expect(control.begin(outside.x, outside.y)).toBe(false);
    control.configure({ x: 0, z: -8 }, null);
    expect(control.begin(inside.x, inside.y)).toBe(false);
    control.setZone(null);
    expect(control.hover(inside.x, inside.y)).toBe(false);
    expect(canvas.style.cursor).toBe('');
    expect(control.root.visible).toBe(false);
    expect(control.root.children.map(child => child.name)).toEqual(['LandingZoneArea', 'LandingZoneBoundary', 'ActualBounce']);
  });

  it('clicks and sub-threshold jitter do not move the zone; interrupted gestures release ownership', () => {
    const { control, changes, canvas, project } = setup();
    const point = project(.3, -8.4);
    control.begin(point.x, point.y); control.move(point.x + 1, point.y + 1); control.end();
    expect(changes).toHaveLength(0);
    control.begin(point.x, point.y);
    control.setZone(null);
    control.move(point.x + 40, point.y + 40);
    expect(changes).toHaveLength(0);
    expect(canvas.style.cursor).toBe('');
  });

  it('refreshes stationary hover when the preview zone moves', () => {
    const { control, canvas, project } = setup();
    const point = project(.8, -8);
    control.hover(point.x, point.y);
    expect(canvas.style.cursor).toBe('grab');
    control.setZone({ minX: -3, maxX: -1, minZ: -9, maxZ: -7 }); control.update();
    expect(canvas.style.cursor).toBe('');
  });

  it('supports camera-relative keyboard movement after explicit selection', () => {
    const { control, camera, changes } = setup([7, 6, -13]);
    expect(control.key('ArrowUp')).toBe(false);
    expect(control.key('Enter')).toBe(true);
    const forward = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    control.key('ArrowUp');
    expect(changes[0]!.x).toBeCloseTo(forward.x * .2, 5);
    expect(changes[0]!.z).toBeCloseTo(-8 + forward.z * .2, 5);
    control.key('ArrowDown');
    expect(changes.at(-1)!.x).toBeCloseTo(0, 5);
    expect(changes.at(-1)!.z).toBeCloseTo(-8, 5);
    control.key('ArrowRight'); control.key('ArrowLeft');
    expect(changes.at(-1)!.x).toBeCloseTo(0, 5);
    expect(changes.at(-1)!.z).toBeCloseTo(-8, 5);
    control.key('Escape');
    expect(control.key('ArrowRight')).toBe(false);
  });
});
