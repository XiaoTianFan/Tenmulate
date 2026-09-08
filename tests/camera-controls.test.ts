import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOV_MAX,
  CAMERA_FOV_MIN,
  cameraFovAfterWheel,
  cameraLookAfterDrag,
  cameraRotationRadians,
  cameraLookAtCourtPoint,
  wrapCameraAngle,
  type CameraLook,
} from '../src/domain/camera';
import { DEFAULT_CAMERA_POSITION_PRESETS } from '../src/storage/appStorage';
import { COURT } from '../src/domain/court';

const forwardFor = (look: CameraLook): THREE.Vector3 => {
  const rotation = cameraRotationRadians(look);
  return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(rotation.pitch, rotation.yaw, 0, 'YXZ'));
};

describe('360-degree camera look controls', () => {
  it('aims both wider, deeper corners and the centered volley position at the far baseline center', () => {
    for (const preset of DEFAULT_CAMERA_POSITION_PRESETS.filter(p => p.lookAt)) {
      const p = preset.position, target = new THREE.Vector3(0, 0, COURT.halfLength);
      const origin = new THREE.Vector3(p.lateral, p.eyeHeight, -COURT.halfLength - p.behindBaseline);
      const direction = forwardFor(cameraLookAtCourtPoint(p, preset.lookAt!));
      expect(direction.distanceTo(target.sub(origin).normalize())).toBeLessThan(1e-8);
      if (preset.id === 'position-net') { expect(origin.z).toBeCloseTo(-COURT.serviceLineFromNet + 1); expect(origin.x).toBe(0); }
      else { expect(p.behindBaseline).toBeGreaterThan(1.4); expect(Math.abs(p.lateral)).toBeGreaterThan(2.6); expect(Math.abs(p.lateral)).toBeLessThan(COURT.singlesWidth / 2); }
    }
  });
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

  it('zooms with the wheel and clamps the widened horizontal FOV range', () => {
    expect(cameraFovAfterWheel(70, -100)).toBe(67);
    expect(cameraFovAfterWheel(70, 100)).toBe(73);
    expect(cameraFovAfterWheel(6, -1_000)).toBe(CAMERA_FOV_MIN);
    expect(cameraFovAfterWheel(159, 1_000)).toBe(CAMERA_FOV_MAX);
  });
});
