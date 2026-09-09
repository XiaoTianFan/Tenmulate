import { netHeightAt, type ResolvedTrajectory } from './physics';

/** Measurements for the actual hovered flight, in court metres. Peak excludes
 * the rebound so a high bounce is never reported as the pre-bounce arc. */
export function trajectoryReadout(flight: ResolvedTrajectory) {
  const net = flight.events.find(event => event.type === 'net-crossing');
  const bounce = flight.events.find(event => event.type === 'bounce');
  const peakHeight = Math.max(flight.intent.source.y, net?.position.y ?? 0,
    ...flight.samples.filter(sample => !sample.bounced && sample.time <= (bounce?.time ?? Infinity)).map(sample => sample.position.y));
  return { owner: flight.intent.source.z < 0 ? 'player' as const : 'opponent' as const,
    peakHeight, netHeight: net?.position.y,
    netClearance: net ? net.position.y - netHeightAt(net.position.x) : undefined };
}
