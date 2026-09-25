import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { movePlayerCamera, turnPlayerCamera, PlayerCameraControl } from './PlayerCameraControl';
import { COURT } from '../../domain/court';

const view = { lateral: 0, behindBaseline: 2, eyeHeight: 1.7, yaw: 0, pitch: 12, fov: 70 };
describe('top-down player camera editing', () => {
  it('moves toward the net without changing perspective and clamps court limits', () => {
    expect(movePlayerCamera(view, 3, 4)).toEqual({ ...view, lateral: 3, behindBaseline: -2 });
    expect(movePlayerCamera(view, 100, 100)).toEqual({ ...view, lateral: 7, behindBaseline: -10 });
  });
  it('uses the player camera forward direction, including both sides and behind', () => {
    const z = -COURT.halfLength - view.behindBaseline;
    expect(turnPlayerCamera(view, 2, z).yaw).toBe(90);
    expect(turnPlayerCamera(view, -2, z).yaw).toBe(-90);
    expect(turnPlayerCamera(view, 0, z - 2).yaw).toBe(180);
    expect(turnPlayerCamera(view, 0, z)).toBe(view);
  });
  it('commits once on release and restores cancelled gestures', () => {
    const camera = new THREE.PerspectiveCamera(70, 1, .1, 100);
    camera.position.set(0, 30, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 900 }) } as HTMLCanvasElement;
    const control = new PlayerCameraControl(camera, canvas), changed = vi.fn();
    control.configure(view, changed);
    const start = control.screenPoints()!.body;
    expect(control.begin(start.x, start.y)).toBe(true);
    control.move(start.x + 40, start.y - 40);
    expect(changed).not.toHaveBeenCalled();
    control.end(false);
    expect(control.screenPoints()!.body).toEqual(start);
    control.begin(start.x, start.y); control.move(start.x + 40, start.y - 40); control.end(true); control.end(true);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]![0].lateral).not.toBe(view.lateral);
    control.configure(null, null);
    expect(control.root.visible).toBe(false);
    expect(control.begin(start.x, start.y)).toBe(false);
  });
});
