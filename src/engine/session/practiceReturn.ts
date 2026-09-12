import type { ReturnShotType } from '../../content/types';
import type { CameraConfiguration } from '../rendering/TennisScene';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { sampleTrajectoryAt } from '../trajectory/physics';
import type { LandingZone } from '../trajectory/landingZone';
import { cameraPlayerPosition } from './playerCoverage';
import { contactsForTiming } from './bounceContact';
import { defaultReturnShot, RETURN_SHOT_PROFILES, returnShotContacts } from './returnShot';
import { landsInZone, resolveCourtFlight, trimFlight } from './courtFlight';
import type { RallyReturn } from './returnFlight';
import { cameraLookAtCourtPoint, wrapCameraAngle } from '../../domain/camera';

export type PracticeReturn = Readonly<{ type: ReturnShotType; landingZone: LandingZone }>;
export const practiceReturnType = (category: string): ReturnShotType => category === 'Serve & Volley' ? 'volley'
  : category === 'Net & Overhead' ? 'overhead' : 'groundstroke';

/** A player response to an independent feed finishes its own flight. It never
 * invents a second opponent hit or changes the incoming ball's contact sample. */
export function resolvePracticeReturn(incoming: ResolvedTrajectory, configuration: PracticeReturn, camera: CameraConfiguration,
  target: { x: number; z: number }): { rally: RallyReturn; contact: ResolvedTrajectory['samples'][number] } | undefined {
  const { type, landingZone } = configuration, profile = RETURN_SHOT_PROFILES[type], shot = defaultReturnShot(type);
  const player = cameraPlayerPosition(camera);
  const height = type === 'volley' ? camera.eyeHeight - .1 : type === 'overhead' ? camera.eyeHeight + .65 : profile.height;
  const contacts = contactsForTiming(incoming, type, returnShotContacts(incoming, type), shot.contactTiming)
    .filter(sample => type !== 'overhead' || sample.velocity.y < 0);
  const score = (sample: typeof contacts[number]) => Math.hypot(sample.position.x - player.x, sample.position.z - player.z - .65)
    + Math.abs(sample.position.y - height) * 2;
  contacts.sort((a, b) => score(a) - score(b));
  for (const contact of contacts.slice(0, 8)) {
    const trajectory = resolveCourtFlight({ source: contact.position, target, landingZone, family: type,
      spin: profile.spin, spinRateRpm: profile.rpm, launchSpeedKmh: profile.pace, minimumNetClearanceM: profile.clearance,
      trajectoryMode: 'natural', surface: incoming.intent.surface, windVelocity: incoming.intent.windVelocity,
      bounceFactor: incoming.intent.bounceFactor });
    if (landsInZone(trajectory)) {
      // An independent response ends the point at its second bounce. Keeping
      // seconds of rolling samples adds neither playable motion nor useful preview.
      const secondBounce = trajectory.events.find(event => event.type === 'second-bounce');
      const end = secondBounce && trajectory.samples.find(sample => sample.time >= secondBounce.time);
      const flight = end ? trimFlight(trajectory, end) : trajectory;
      return { contact, rally: { trajectory: flight, contactTime: contact.time,
        duration: flight.samples.at(-1)!.time, contactErrorM: 0, speedRatio: flight.resolved.launchSpeedKmh / profile.pace } };
    }
  }
  return undefined;
}

/** Deterministic look-only tracking; manual position and FOV stay authored. */
export function overheadPracticeCamera(base: CameraConfiguration, flight: ResolvedTrajectory, age: number, contactTime: number): CameraConfiguration {
  const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const weight = smooth(age / .6) * (1 - smooth((age - contactTime) / .8));
  const point = sampleTrajectoryAt(flight, Math.min(Math.max(0, age), contactTime), false);
  const player = cameraPlayerPosition(base), heading = base.yaw * Math.PI / 180;
  const forward = { x: Math.sin(heading), z: Math.cos(heading) };
  // Keep the focus slightly ahead as a lob passes over the viewer. A literal
  // look-at becomes a 180-degree turn at that point instead of an upward glance.
  const ahead = (point.x - player.x) * forward.x + (point.z - player.z) * forward.z;
  const shift = Math.max(0, .75 - ahead);
  const look = cameraLookAtCourtPoint(base, { ...point, x: point.x + forward.x * shift, z: point.z + forward.z * shift });
  return { ...base, yaw: base.yaw + wrapCameraAngle(look.yaw - base.yaw) * weight,
    pitch: base.pitch + (Math.max(base.pitch, Math.min(65, look.pitch)) - base.pitch) * weight };
}
