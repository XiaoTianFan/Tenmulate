import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { playerDrillForHand } from '../src/content/playerHandedness';
import { defaultDrillSettings } from '../src/app/defaults';
import { compilePlayerDrill } from '../src/engine/session/compilePlayerDrill';
import { playerContactAnchor, PLAYER_CONTACT_RADIUS_M } from '../src/engine/session/courtFlight';
import { sampleCameraTimeline } from '../src/engine/session/cameraTimeline';
import { cameraRotationRadians } from '../src/domain/camera';
import { COURT } from '../src/domain/court';

// Owner's September 12 Crosscourt Rhythm geometry. Keep the regression stable
// when the live project catalog is edited; it is not a test fixture authority.
const base = PLAYER_DRILLS[0]!;
const forehand = { ...base.events[0]!, camera: { eyeHeight: 1.7, behindBaseline: 3.520091892001894,
  lateral: -2.751175569004377, yaw: 9.77779418945363, pitch: -3.166664428709737, fov: 70 },
  landingZone: { minX: 2.2386390229653887, maxX: 3.8386390229653893, minZ: 8.975058268656095, maxZ: 10.975058268656095 },
  opponentReturn: { ...base.events[0]!.opponentReturn,
    landingZone: { minX: 2.3555002935719704, maxX: 3.5555002935719706, minZ: -10.115514076399428, maxZ: -8.715514076399428 } } };
const backhand = { ...base.events[1]!, camera: { eyeHeight: 1.7, behindBaseline: 3.877305197509668,
  lateral: 2.9950708856053896, yaw: -8.637041015625755, pitch: -1.7000134277350298, fov: 70 },
  landingZone: { minX: -3.8048956349007734, maxX: -2.2048956349007733, minZ: 8.941305494280966, maxZ: 10.941305494280966 },
  opponentReturn: { ...base.events[1]!.opponentReturn,
    landingZone: { minX: -3.6805337598074948, maxX: -2.4805337598074946, minZ: -10.662701159142816, maxZ: -9.262701159142818 } } };
const fixture = { ...base, defaultInterval: 5, launch: { ...base.launch,
  landingZone: { minX: -3.995, maxX: -2.795, minZ: -10.226747119811177, maxZ: -8.002792448290156 } },
  events: [forehand, backhand,
    { ...forehand, id: 'third', intervalSeconds: 4.5, camera: { ...forehand.camera, yaw: 13.52594482421921, pitch: -3.0037054443350826 } },
    { ...backhand, id: 'fourth', camera: { ...backhand.camera, lateral: 3 } }] };

describe('physical contact camera framing', () => {
  it.each(['right', 'left'] as const)('keeps %s-handed strokes in front and on their racket side without moving the ball', hand => {
    const drill = playerDrillForHand(fixture, hand), snapshot = structuredClone(drill);
    const session = compilePlayerDrill(drill, { ...defaultDrillSettings(drill), repetitions: 4, restSeconds: 0 });
    expect(session.planningIssues).toEqual([]); expect(session.playerEvents).toHaveLength(4);
    for (const event of session.playerEvents!) {
      const contact = event.trajectory.intent.source, authored = event.event.camera;
      const pose = sampleCameraTimeline(session.cameraTimeline, event.startTime);
      const anchor = playerContactAnchor({ ...event.event, camera: pose });
      expect(anchor.x).toBeCloseTo(contact.x, 8); expect(anchor.z).toBeCloseTo(contact.z, 8);
      expect(contact).toEqual(session.repetitions[event.incomingIndex]!.reachability.contact!.position);
      expect(Math.hypot(pose.lateral - authored.lateral, pose.behindBaseline - authored.behindBaseline)).toBeLessThanOrEqual(PLAYER_CONTACT_RADIUS_M);
      expect(pose).toMatchObject({ yaw: authored.yaw, pitch: authored.pitch, eyeHeight: authored.eyeHeight, fov: authored.fov });
      expect(sampleCameraTimeline(session.cameraTimeline, event.startTime - .05)).toEqual(pose);
    }
    const e = session.playerEvents![2]!, pose = e.contactCamera;
    const camera = new PerspectiveCamera(2 * Math.atan(Math.tan(pose.fov * Math.PI / 360) / (1600 / 940)) * 180 / Math.PI, 1600 / 940, .01, 1000);
    camera.position.set(pose.lateral, pose.eyeHeight, -COURT.halfLength - pose.behindBaseline);
    const r = cameraRotationRadians(pose); camera.rotation.set(r.pitch, r.yaw, 0, 'YXZ'); camera.updateMatrixWorld();
    const p = e.trajectory.samples.find(s => s.time >= .05)!.position;
    const projected = new Vector3(p.x, p.y, p.z).project(camera);
    expect(projected.x * (hand === 'right' ? 1 : -1)).toBeGreaterThan(.2);
    expect(drill).toEqual(snapshot);
  });
});
