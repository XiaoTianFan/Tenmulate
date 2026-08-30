import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cameraLookAfterDrag, cameraRotationRadians, wrapCameraAngle, type CameraLook } from '../src/domain/camera';

const forwardFor = (look: CameraLook): THREE.Vector3 => {
  const rotation = cameraRotationRadians(look);
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(rotation.pitch, rotation.yaw, 0, 'YXZ'));
};

describe('360-degree camera look controls', () => {
  it('wraps yaw and pitch through a complete revolution', () => {
    expect(wrapCameraAngle(181)).toBe(-179);
    expect(wrapCameraAngle(-181)).toBe(179);
    expect(wrapCameraAngle(765)).toBe(45);
  });

  it('accumulates left-drag movement without clamping at the old limits', () => {
    expect(cameraLookAfterDrag({ yaw: 170, pitch: 175 }, -100, -50)).toEqual({
      yaw: -168,
      pitch: -174,
    });
  });

  it('supports forward, side, vertical, and backward camera orientations', () => {
    expect(forwardFor({ yaw: 0, pitch: 0 }).toArray()).toEqual([
      expect.closeTo(0, 8),
      expect.closeTo(0, 8),
      expect.closeTo(1, 8),
    ]);
    expect(forwardFor({ yaw: 90, pitch: 0 }).toArray()).toEqual([
      expect.closeTo(1, 8),
      expect.closeTo(0, 8),
      expect.closeTo(0, 8),
    ]);
    expect(forwardFor({ yaw: 0, pitch: 90 }).toArray()).toEqual([
      expect.closeTo(0, 8),
      expect.closeTo(1, 8),
      expect.closeTo(0, 8),
    ]);
    expect(forwardFor({ yaw: 0, pitch: 180 }).toArray()).toEqual([
      expect.closeTo(0, 8),
      expect.closeTo(0, 8),
      expect.closeTo(-1, 8),
    ]);
  });
});
