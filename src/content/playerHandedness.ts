import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { LandingZone } from '../engine/trajectory/landingZone';
import type { DrillDefinitionV2, OpeningFeed, OpponentHand, PlayerShotEventV2 } from './types';

// Subtraction normalizes zero, so a mirror survives a JSON round trip exactly.
export const mirrorCourtX = (x: number) => 0 - x;
export const mirrorLandingZone = (zone: LandingZone): LandingZone => ({
  ...zone, minX: mirrorCourtX(zone.maxX), maxX: mirrorCourtX(zone.minX),
});
export const mirrorPlayerCamera = (camera: CameraConfiguration): CameraConfiguration => ({
  ...camera, lateral: mirrorCourtX(camera.lateral), yaw: mirrorCourtX(camera.yaw),
});
export const mirrorOpeningFeed = (feed: OpeningFeed): OpeningFeed => ({
  ...feed, position: { ...feed.position, x: mirrorCourtX(feed.position.x) },
  landingZone: mirrorLandingZone(feed.landingZone),
});

/** At the center mark either service box is possible. Keep the authored box
 * for zone constraints without moving the actual opponent position. */
export const openingZoneSource = (feed: OpeningFeed) => ({
  x: feed.position.x || (feed.landingZone.minX > 0 ? -1 : 1),
});

/** Layout orientation is explicit; names and the opponent's handedness never change. */
export function playerEventForHand(event: PlayerShotEventV2, from: OpponentHand, to: OpponentHand): PlayerShotEventV2 {
  if (from === to) return event.ball.hand === to ? event : { ...event, ball: { ...event.ball, hand: to } };
  return { ...event, camera: mirrorPlayerCamera(event.camera),
    ball: { ...event.ball, hand: to },
    landingZone: mirrorLandingZone(event.landingZone),
    opponentReturn: { ...event.opponentReturn, landingZone: mirrorLandingZone(event.opponentReturn.landingZone) },
    ...(event.openingFeed ? { openingFeed: mirrorOpeningFeed(event.openingFeed) } : {}),
  };
}

/** Pure and idempotent. Editing, exporting and playback consume this same layout. */
export function playerDrillForHand(drill: DrillDefinitionV2, hand: OpponentHand): DrillDefinitionV2 {
  const from = drill.playerHand ?? 'right';
  if (from === hand && drill.events.every(event => event.ball.hand === hand)) return drill;
  return { ...drill, playerHand: hand, launch: from === hand ? drill.launch : mirrorOpeningFeed(drill.launch),
    events: drill.events.map(event => playerEventForHand(event, from, hand)) };
}
