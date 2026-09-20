import type { CompiledSession } from '../session/compileSession';
import type { ResolvedTrajectory } from '../trajectory/physics';
import { sessionCues, type TimedCue } from './sessionCues';
import type { Vec3 } from '../../domain/vector';
import { COURT } from '../../domain/court';

export type SpatialCue = TimedCue & Readonly<{ id: string; position?: Vec3; speedKmh?: number; family?: string; spin?: string }>;

/** Adds physical metadata without changing the existing training cue contract. */
export function spatialSessionCues(session: CompiledSession): SpatialCue[] {
  const flights: { start: number; end: number; trajectory: ResolvedTrajectory }[] = session.scheduledFlights
    ? session.scheduledFlights.map(flight => ({ start: flight.startTime, end: flight.endTime, trajectory: flight.trajectory }))
    : session.repetitions.flatMap(repetition => [
      { start: repetition.startTime, end: repetition.startTime + (repetition.rallyReturn?.contactTime ?? Infinity), trajectory: repetition.trajectory },
      ...(repetition.rallyReturn ? [{ start: repetition.startTime + repetition.rallyReturn.contactTime,
        end: Infinity, trajectory: repetition.rallyReturn.trajectory }] : []),
    ]);
  const cues: SpatialCue[] = [];
  flights.forEach((flight, index) => {
    cues.push({ id: `contact:${index}`, time: flight.start, kind: 'contact',
      position: flight.trajectory.intent.source, family: flight.trajectory.intent.family ?? flight.trajectory.intent.shotType, spin: flight.trajectory.intent.spin, speedKmh: flight.trajectory.resolved.launchSpeedKmh });
    flight.trajectory.events.forEach((event, eventIndex) => {
      if (event.type !== 'bounce' || flight.start + event.time > flight.end) return;
      cues.push({ id: `bounce:${index}:${eventIndex}`, time: flight.start + event.time, kind: 'bounce',
        position: event.position, speedKmh: event.speedKmh });
    });
  });
  sessionCues(session).filter(cue => cue.kind === 'footwork').forEach((cue, index) => cues.push({ ...cue, id: `footwork:${index}` }));
  return cues.sort((a, b) => a.time - b.time);
}

/** No wall-clock scheduling ahead of the simulation's capped frame clock. */
export class AudioCueCursor {
  private previous = 0;
  private first = true;
  reset() { this.previous = 0; this.first = true; }
  advance(cues: readonly SpatialCue[], current: number, running: boolean) {
    const previous = this.previous;
    this.previous = current;
    if (!running) { this.first = false; return []; }
    const initial = this.first;
    this.first = false;
    if (current < previous || current - previous > .2) return [];
    return cues.filter(cue => (cue.time > previous || (initial && cue.time === 0)) && cue.time <= current);
  }
}

export function cueSpatialMix(position: Vec3 | undefined, camera: Readonly<{ lateral: number; behindBaseline: number; eyeHeight: number; yaw: number }>) {
  if (!position) return { pan: 0, gain: 1 };
  const dx = position.x - camera.lateral, dz = position.z + COURT.halfLength + camera.behindBaseline;
  const distance = Math.hypot(dx, dz, position.y - camera.eyeHeight);
  // The camera convention faces +Z at zero yaw; right is negative local X.
  const yaw = camera.yaw * Math.PI / 180;
  const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
  return { pan: Math.max(-.85, Math.min(.85, right / Math.max(3, distance))), gain: Math.max(.38, 1 / (1 + distance * .035)) };
}
