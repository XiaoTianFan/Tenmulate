import { describe, expect, it } from 'vitest';
import { DRILLS, SHOT_BY_ID } from '../src/content/bundled';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { PLAYER_SHOTS, PLAYER_SHOT_BY_ID, farZone, newPlayerEvent } from '../src/content/playerShots';
import { migratePlayerDrill, migratePlayerSavedShot, parsePlayerDrillJson, snapshotPlayerShot } from '../src/content/playerMigration';
import { isPlayerSavedShot, validatePlayerDrill } from '../src/content/playerValidation';

describe('player-first authoring and role migration', () => {
  it('authors every bundled drill with a distinct opponent opening and player-owned actions', () => {
    expect(PLAYER_DRILLS).toHaveLength(DRILLS.length);
    for (const drill of PLAYER_DRILLS) {
      expect(validatePlayerDrill(drill), drill.id).toMatchObject({ valid: true, errors: [] });
      expect(parsePlayerDrillJson(JSON.stringify(drill))).toEqual(drill);
      expect(['serve', 'groundstroke']).toContain(drill.launch.ball.family);
      for (const event of drill.events) {
        expect(event.landingZone.minZ).toBeGreaterThan(0);
        expect(event.opponentReturn.landingZone.maxZ).toBeLessThan(0);
        expect(event.ball.family).not.toBe('serve');
      }
    }
  });
  it('defines crosscourt and line placement from the player camera', () => {
    for (const side of ['fh', 'bh']) {
      const cross = PLAYER_SHOT_BY_ID.get(`${side}-cross-deep`)!.event;
      const line = PLAYER_SHOT_BY_ID.get(`${side}-line-deep`)!.event;
      expect(cross.camera.lateral * (cross.landingZone.minX + cross.landingZone.maxX)).toBeLessThan(0);
      expect(line.camera.lateral * (line.landingZone.minX + line.landingZone.maxX)).toBeGreaterThan(0);
      expect(cross.ball.stroke).toBe(side === 'fh' ? 'forehand' : 'backhand');
    }
    expect(PLAYER_SHOTS.every(shot => shot.event.ball.family !== 'serve')).toBe(true);
  });
  it('moves an old reply into the player role and the following feed into the response without mirroring world coordinates', () => {
    const old = { ...DRILLS[0]!, events: [
      { id: 'one', shotId: 'fh-cross-deep', camera: PLAYER_SHOTS[0]!.event.camera,
        target: { x: -2, z: -8 }, returnLandingZone: farZone(1, 7), returnShot: { type: 'drop-shot' as const, spin: 'slice' as const, spinRateRpm: 1777 } },
      { id: 'two', shotId: 'bh-cross-deep', paceKmh: 91, spin: 'flat' as const, spinRateRpm: 90, target: { x: 2, z: -9 } },
    ], shotIds: ['fh-cross-deep', 'bh-cross-deep'] };
    const next = migratePlayerDrill(old);
    expect(next.launch.landingZone).toMatchObject({ minX: -2.8, maxX: -1.2 });
    expect(next.events[0]).toMatchObject({ camera: old.events[0]!.camera, landingZone: old.events[0]!.returnLandingZone,
      ball: { family: 'drop-shot', spin: 'slice', spinRateRpm: 1777 }, opponentReturn: { ball: { family: 'groundstroke', paceKmh: 91, spin: 'flat', spinRateRpm: 90 } } });
    expect(next.events[0]!.opponentReturn.landingZone.minZ).toBe(-10);
    expect(next.events[0]!.label).toBe(`Reply to ${SHOT_BY_ID.get('fh-cross-deep')!.label}`);
    expect(migratePlayerDrill(next)).toEqual(next);
    expect(next).not.toBe(old);
    expect(parsePlayerDrillJson(JSON.stringify(old))).toEqual(next);
  });
  it('retains old serves as opening phases before player replies', () => {
    const migrated = migratePlayerDrill(DRILLS[1]!);
    expect(migrated.launch.ball.family).toBe('serve');
    expect(migrated.events.slice(1).every(event => event.openingFeed?.ball.family === 'serve')).toBe(true);
    expect(migrated.events.every(event => event.ball.family === 'groundstroke' && event.opponentReturn.ball.family !== 'serve')).toBe(true);
    expect(validatePlayerDrill(migrated)).toMatchObject({ valid: true });
  });
  it('takes complete independent snapshots and migrates saved replies once', () => {
    const drill = PLAYER_DRILLS[2]!, event = newPlayerEvent(), snapshot = snapshotPlayerShot(event, drill);
    expect(snapshot).toMatchObject({ intervalSeconds: drill.defaultInterval, rhythmPercent: 100, movementPercent: 100 });
    expect(snapshot.ball).not.toBe(event.ball); expect(snapshot.opponentReturn).not.toBe(event.opponentReturn);
    const saved = { schemaVersion: 2 as const, id: 'saved-one', name: 'My crosscourt', event: snapshot };
    expect(isPlayerSavedShot(saved)).toBe(true); expect(migratePlayerSavedShot(saved)).toEqual(saved);
    const old = { id: 'saved-old', name: 'Old forehand', event: { id: 'old-event', shotId: 'fh-cross-deep', returnLandingZone: farZone(-2, 8) } };
    const converted = migratePlayerSavedShot(old);
    expect(converted).toMatchObject({ schemaVersion: 2, name: 'Reply to Old forehand', event: { landingZone: old.event.returnLandingZone } });
    expect(isPlayerSavedShot(converted)).toBe(true);
  });
  it('snapshots and parses both contact timings as shot settings', () => {
    const drill = PLAYER_DRILLS[0]!, original = drill.events[0]!;
    const event = { ...original, ball: { ...original.ball, contactTiming: 'rise' as const },
      opponentReturn: { ...original.opponentReturn, ball: { ...original.opponentReturn.ball, contactTiming: 'apex' as const } } };
    const snapshot = snapshotPlayerShot(event, drill);
    expect(snapshot.ball.contactTiming).toBe('rise');
    expect(snapshot.opponentReturn.ball.contactTiming).toBe('apex');
    expect(parsePlayerDrillJson(JSON.stringify({ ...drill, events: [snapshot] })).events[0]).toEqual(snapshot);
  });
  it('rejects invalid roles, unknown nested fields, non-finite parameters and wrong court halves', () => {
    const base = PLAYER_DRILLS[0]!, event = base.events[0]!;
    const invalid = [
      { ...event, ball: { ...event.ball, family: 'serve' } },
      { ...event, ball: { ...event.ball, spin: 'kick' } },
      { ...event, ball: { ...event.ball, paceKmh: Infinity } },
      { ...event, ball: { ...event.ball, contactTiming: 'random' } },
      { ...event, opponentReturn: { ...event.opponentReturn, ball: { ...event.opponentReturn.ball, contactTiming: ['rise'] } } },
      { ...event, opponentReturn: { ...event.opponentReturn, position: { x: 0, z: 12 } } },
      { ...event, landingZone: event.opponentReturn.landingZone },
      { ...event, camera: { ...event.camera, roll: 0 } },
    ];
    for (const bad of invalid) expect(validatePlayerDrill({ ...base, events: [bad] }).valid).toBe(false);
    expect(validatePlayerDrill({ ...base, events: [event, event] }).valid).toBe(false);
    expect(validatePlayerDrill({ ...base, description: 'https://example.com' }).valid).toBe(false);
  });
});
