import type { CameraConfiguration } from '../rendering/TennisScene';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { AudioCueCursor, type SpatialCue } from './spatialCues';
export type PreviewFlight = Readonly<{ trajectory: ResolvedTrajectory; time: number }>;
export type PreviewAudioFrame = (time: number, flights: readonly PreviewFlight[], camera: CameraConfiguration) => void;

/** Flight age comes from the renderer, including continuous-preview batch offsets. */
export function previewFlightCues(time: number, flights: readonly PreviewFlight[]): SpatialCue[] {
  return flights.flatMap(({ trajectory, time: age }, index) => {
    const start = time - age;
    const id = `${Math.round(start * 1000000)}:${index}`;
    return [{ id: `contact:${id}`, kind: 'contact' as const, time: start, position: trajectory.intent.source, family: trajectory.intent.family ?? trajectory.intent.shotType, spin: trajectory.intent.spin, speedKmh: trajectory.resolved.launchSpeedKmh },
      ...trajectory.events.filter(event => event.type === 'bounce').map((event, i) => ({ id: `bounce:${id}:${i}`, kind: 'bounce' as const, time: start + event.time, position: event.position, speedKmh: event.speedKmh }))];
  });
}

/** A zero-time opening must sound again when its editor preview loops. */
export class PreviewAudioCursor extends AudioCueCursor {
  private lastTime = 0;
  override advance(cues: readonly SpatialCue[], current: number, running: boolean) {
    if (running && current === 0 && this.lastTime > 0) this.reset();
    this.lastTime = current;
    return super.advance(cues, current, running);
  }
}
