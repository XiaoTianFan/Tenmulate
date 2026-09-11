import type { DrillDefinitionV2, PlayerShotEventV2 } from './types';
import { ballDefaults, openingFor, PLAYER_SHOT_BY_ID, receivingZone } from './playerShots';

function drill(id: string, title: string, description: string, category: DrillDefinitionV2['category'],
  ids: readonly string[], interval = 4.5, serve = false): DrillDefinitionV2 {
  const events = ids.map((shotId, index): PlayerShotEventV2 => ({ ...structuredClone(PLAYER_SHOT_BY_ID.get(shotId)!.event), id: `${id}-shot-${index + 1}` }));
  // Default responses feed the next authored player's hitting position. Once
  // authored, this zone remains independently editable and is never silently moved.
  const configured = events.map((event, index) => {
    const next = events[(index + 1) % events.length]!;
    return { ...event, opponentReturn: { ball: { ...(next.ball.family === 'volley'
      ? { ...ballDefaults(), paceKmh: 90, spin: 'flat' as const, spinRateRpm: 120, netClearanceM: .12 }
      : ballDefaults(next.ball.family === 'overhead' ? 'lob' : 'groundstroke')), stroke: 'auto' as const },
      landingZone: receivingZone(next.camera, next.ball.family, next.ball, {
        x: (event.landingZone.minX + event.landingZone.maxX) / 2,
        z: (event.landingZone.minZ + event.landingZone.maxZ) / 2 + 3,
      }) },
      ...(serve && index > 0 ? { openingFeed: openingFor(event, true) } : {}) };
  });
  return { schemaVersion: 2, id, title, description, category, launch: openingFor(events[0]!, serve), events: configured,
    defaultInterval: interval, defaultRhythmPercent: 100, defaultMovementPercent: 100, defaultRepetitions: Math.min(200, ids.length * 2) };
}
export const PLAYER_DRILLS: readonly DrillDefinitionV2[] = [
  drill('quick-rally', 'Crosscourt Rhythm', 'Play forehand and backhand crosscourt, recovering between your shots.', 'Quick Rally', ['fh-cross-deep', 'bh-cross-deep', 'fh-cross-mid', 'bh-cross-high']),
  drill('return-practice', 'Crosscourt serve returns', 'Read the opening serve and send your return deep crosscourt.', 'Return Practice', ['return-fh-cross', 'return-bh-cross'], 5, true),
  drill('tactical-pattern', 'Two crosscourt, then line', 'Build two forehands crosscourt, change down the line, then finish on the backhand.', 'Tactical Pattern', ['fh-cross-deep', 'fh-cross-mid', 'fh-line-deep', 'bh-cross-deep', 'bh-line-deep']),
  drill('serve-volley', 'Return and close', 'Return the opening serve, approach, and close for a volley.', 'Serve & Volley', ['return-fh-cross', 'approach-feed', 'volley-left', 'volley-right'], 4.8),
  drill('net-overhead', 'Two volleys and overhead', 'Play two volleys, track the opponent’s lob and finish overhead.', 'Net & Overhead', ['volley-left', 'volley-right', 'overhead-feed'], 4.8),
  drill('baseline-depth-ladder', 'Depth ladder', 'Vary your crosscourt placement from a short angle to a deep rally ball.', 'Quick Rally', ['short-angle-left', 'fh-cross-mid', 'bh-cross-deep', 'defensive-high-left']),
  drill('baseline-corner-switch', 'Corner switch', 'Move between your forehand and backhand corners, then play through the middle.', 'Quick Rally', ['fh-cross-deep', 'bh-cross-deep', 'body-neutral']),
  drill('baseline-short-deep', 'Short angle and deep reply', 'Create a short angle, recover, and send the next ball deep.', 'Quick Rally', ['short-angle-right', 'defensive-high-left', 'short-angle-left', 'bh-cross-high']),
  drill('return-rhythm-read', 'Normal and compact serve returns', 'Read different opening serve rhythms before your crosscourt return.', 'Return Practice', ['return-fh-cross', 'return-bh-cross'], 5, true),
  drill('return-lefty-patterns', 'Return a left-handed serve', 'Read a left-handed opening serve and play your return to the opposite corner.', 'Return Practice', ['return-fh-cross', 'return-bh-cross'], 5, true),
  drill('return-second-serve', 'Second-serve pressure', 'Attack the second serve with a deep player-authored return.', 'Return Practice', ['return-bh-cross', 'return-fh-cross'], 5, true),
  drill('tactical-inside-out', 'Inside-out escape', 'Play through the middle, run around the backhand and change direction with a forehand.', 'Tactical Pattern', ['body-neutral', 'fh-inside-out', 'fh-line-deep', 'bh-cross-deep']),
  drill('tactical-approach-close', 'Approach and close', 'Play your approach, move forward, then volley into alternating corners.', 'Tactical Pattern', ['approach-feed', 'volley-left', 'volley-right'], 4.8),
  drill('tactical-defend-finish', 'Defend then finish', 'Use your defensive ball to recover before changing direction down the line.', 'Tactical Pattern', ['defensive-high-left', 'body-neutral', 'bh-cross-high', 'fh-line-deep']),
  drill('net-half-volley', 'Half-volley and close', 'Take the ball just after the bounce, then close for two volleys.', 'Net & Overhead', ['half-volley-body', 'volley-left', 'volley-right'], 4.8),
  drill('custom-starter', 'Custom starter', 'Assemble your own player shots, opponent responses and court movement.', 'Custom', ['body-neutral', 'fh-cross-deep', 'bh-cross-deep']),
].map(drill => {
  const configure = (feed: DrillDefinitionV2['launch'], index: number) => ({ ...feed, ball: { ...feed.ball,
    ...(drill.id === 'return-rhythm-read' ? { serveRhythm: index % 2 ? 'compact' as const : 'normal' as const } : {}),
    ...(drill.id === 'return-lefty-patterns' ? { hand: 'left' as const, spin: 'slice' as const, spinRateRpm: 1400 } : {}),
    ...(drill.id === 'return-second-serve' ? { paceKmh: 110, spin: 'kick' as const, spinRateRpm: 2300 } : {}),
  } });
  return { ...drill, launch: configure(drill.id === 'serve-volley' ? openingFor(drill.events[0]!, true) : drill.launch, 0),
    events: drill.events.map((event, index) => event.openingFeed ? { ...event, openingFeed: configure(event.openingFeed, index) } : event) };
});
