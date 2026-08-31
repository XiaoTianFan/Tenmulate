import { describe, expect, it } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { materializeEvents } from '../src/content/editing';
import { parseDrillJson, validateDrill } from '../src/content/validation';
import { OPPONENT_POSITION_LIMITS } from '../src/domain/court';
import { compileSession } from '../src/engine/session/compileSession';

describe('versioned drill documents', () => {
  it('materializes bundled shot sequences into editable events', () => {
    const events = materializeEvents(DRILLS[2]!);
    expect(events).toHaveLength(5);
    expect(events.map((event) => event.shotId)).toEqual(DRILLS[2]!.shotIds);
  });

  it('accepts local event overrides and compiles them exactly with variation disabled', () => {
    const source = DRILLS[0]!;
    const drill = {
      ...source,
      id: 'custom-contract-test',
      category: 'Custom' as const,
      events: [{
        id: 'event-one',
        shotId: 'fh-cross-deep',
        paceKmh: 101,
        spin: 'slice' as const,
        target: { x: 1.25, z: -7.5 },
        opponentPosition: { x: -2.5, z: 10.8 },
        cue: 'MOVE NOW',
      }],
      shotIds: ['fh-cross-deep'],
      defaultRepetitions: 1,
    };
    const validation = validateDrill(drill);
    expect(validation.valid).toBe(true);
    const session = compileSession(drill, {
      repetitions: 1,
      interval: 3,
      variationPercent: 0,
      timingVariationPercent: 0,
      launchSpeedKmh: 78,
      surface: 'hard',
      seed: '1',
      spin: 'preset',
      opponentHand: 'left',
      workBlockSize: 4,
      restSeconds: 20,
      serveRhythm: 'preset',
    });
    expect(session.repetitions[0]!.shot).toMatchObject({
      paceKmh: 101,
      spin: 'slice',
      target: { x: 1.25, z: -7.5 },
      source: { x: -2.5, y: 1.15, z: 10.8 },
      cue: 'MOVE NOW',
      opponentHand: 'left',
    });
  });

  it('rejects remote URLs, unknown primitives, invalid geometry, and unsupported schemas', () => {
    const invalid = {
      ...DRILLS[0],
      schemaVersion: 2,
      id: 'INVALID ID',
      description: 'Load https://example.com/remote.glb',
      events: [{ id: 'bad', shotId: 'not-a-shot', target: { x: 12, z: 1 } }],
    };
    const result = validateDrill(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/schemaVersion 1/);
    expect(result.errors.join(' ')).toMatch(/Remote URLs/);
    expect(result.errors.join(' ')).toMatch(/unknown shot/);
    expect(result.errors.join(' ')).toMatch(/outside the near singles court/);
  });

  it('reports malformed JSON without exposing parser internals', () => {
    expect(() => parseDrillJson('{bad json')).toThrow('not valid JSON');
  });

  it('rejects unsafe or unknown nested camera transforms', () => {
    const source = DRILLS[0]!;
    const result = validateDrill({
      ...source,
      id: 'unsafe-camera',
      events: [{ id: 'event-one', shotId: source.shotIds[0], cameraMotion: { to: { lateral: 999, roll: 20 }, duration: 0.01 } }],
      shotIds: [source.shotIds[0]],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/camera motion is invalid/);
  });

  it('accepts opponent positions in ITF runoff and rejects positions beyond it', () => {
    const source = DRILLS[0]!;
    const withinRunoff = validateDrill({
      ...source,
      id: 'runoff-position',
      events: [{ id: 'event-one', shotId: source.shotIds[0], opponentPosition: { x: OPPONENT_POSITION_LIMITS.halfWidth, z: OPPONENT_POSITION_LIMITS.halfLength } }],
      shotIds: [source.shotIds[0]],
    });
    const beyondRunoff = validateDrill({
      ...source,
      id: 'beyond-runoff-position',
      events: [{ id: 'event-one', shotId: source.shotIds[0], opponentPosition: { x: OPPONENT_POSITION_LIMITS.halfWidth + 0.01, z: 0 } }],
      shotIds: [source.shotIds[0]],
    });
    expect(withinRunoff.valid).toBe(true);
    expect(beyondRunoff.valid).toBe(false);
    expect(beyondRunoff.errors.join(' ')).toMatch(/outside the ITF competition runoff/);
  });
});
