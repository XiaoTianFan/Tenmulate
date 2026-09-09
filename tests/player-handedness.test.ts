import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { PLAYER_SHOTS } from '../src/content/playerShots';
import { mirrorLandingZone, mirrorPlayerCamera, openingZoneSource, playerDrillForHand, playerEventForHand } from '../src/content/playerHandedness';
import { landingZoneLimits } from '../src/engine/trajectory/landingZone';
import { isPlayerSavedShot, validatePlayerDrill } from '../src/content/playerValidation';
import { parsePlayerDrillJson } from '../src/content/playerMigration';
import { playerContactAnchor } from '../src/engine/session/courtFlight';
import { cameraLookAtCourtPoint } from '../src/domain/camera';
import { defaultDrillSettings } from '../src/app/defaults';
import { compileSession } from '../src/engine/session/compileSession';
import { DEFAULT_APP_DATA, loadAppData, saveAppData } from '../src/storage/appStorage';

afterEach(() => vi.unstubAllGlobals());
describe('player handedness and court reflection', () => {
  it('mirrors every player preset and racket anchor without renaming it or changing the opponent hand', () => {
    for (const { event } of PLAYER_SHOTS) {
      const original = structuredClone(event), mirrored = playerEventForHand(event, 'right', 'left');
      expect(event).toEqual(original);
      expect(mirrored).toMatchObject({ id: event.id, label: event.label, cue: event.cue,
        ball: { ...event.ball, hand: 'left' }, opponentReturn: { ball: event.opponentReturn.ball } });
      const before = playerContactAnchor(event), after = playerContactAnchor(mirrored);
      expect(after).toEqual({ ...before, x: 0 - before.x });
      expect(mirrored.landingZone).toEqual(mirrorLandingZone(event.landingZone));
      expect(mirrored.opponentReturn.landingZone).toEqual(mirrorLandingZone(event.opponentReturn.landingZone));
      expect(playerEventForHand(mirrored, 'left', 'right')).toEqual(original);
      expect(playerEventForHand(mirrored, 'left', 'left')).toBe(mirrored);
    }
  });
  it('reflects arbitrary camera headings about the centerline while retaining depth, tilt and field of view', () => {
    const camera = { ...PLAYER_SHOTS[0]!.event.camera, lateral: -3.125, yaw: 37.5, pitch: -4.3, fov: 82 };
    const target = { x: 2.1, y: 1.4, z: 10 };
    const reflected = mirrorPlayerCamera(camera);
    expect(reflected).toEqual({ ...camera, lateral: 3.125, yaw: -37.5 });
    const before = cameraLookAtCourtPoint(camera, target), after = cameraLookAtCourtPoint(reflected, { ...target, x: -target.x });
    expect(after.yaw).toBeCloseTo(-before.yaw, 12); expect(after.pitch).toBeCloseTo(before.pitch, 12);
    expect(mirrorPlayerCamera(reflected)).toEqual(camera);
  });
  it('mirrors openings and saved left-handed layouts exactly once across JSON reloads', () => {
    for (const source of PLAYER_DRILLS) {
      const right = { ...source, playerHand: 'right' as const }, left = playerDrillForHand(right, 'left');
      expect(validatePlayerDrill(left).errors).toEqual([]);
      expect(left.launch.position).toEqual({ ...right.launch.position, x: 0 - right.launch.position.x });
      expect(left.launch.ball).toEqual(right.launch.ball);
      left.events.forEach((event, i) => expect(event.openingFeed?.ball).toEqual(right.events[i]!.openingFeed?.ball));
      const reloaded = parsePlayerDrillJson(JSON.stringify(left));
      expect(playerDrillForHand(reloaded, 'left')).toBe(reloaded);
      expect(playerDrillForHand(reloaded, 'right')).toEqual(JSON.parse(JSON.stringify(right)));
    }
  });
  it('retains the shared preference and saved-shot orientation without changing Quick Practice or source presets', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const source = PLAYER_SHOTS[0]!.event, left = playerEventForHand(source, 'right', 'left');
    const shot = { schemaVersion: 2 as const, playerHand: 'left' as const, id: 'my-left-shot', name: source.label, event: left };
    saveAppData({ ...DEFAULT_APP_DATA, drillPlayerHand: 'left', savedShots: [shot], customDrills: [playerDrillForHand(PLAYER_DRILLS[0]!, 'left')] });
    const loaded = loadAppData();
    expect(loaded.drillPlayerHand).toBe('left'); expect(loaded.preferences).toEqual(DEFAULT_APP_DATA.preferences);
    expect(loaded.savedShots).toEqual([shot]);
    expect(playerEventForHand(loaded.savedShots[0]!.event, loaded.savedShots[0]!.playerHand!, 'right')).toEqual(source);
    const older = { ...DEFAULT_APP_DATA, drillPlayerHand: undefined };
    values.set('tenmulate.appData.v2', JSON.stringify(older)); expect(loadAppData().drillPlayerHand).toBe('right');
    expect(validatePlayerDrill({ ...PLAYER_DRILLS[0], playerHand: 'invalid' }).valid).toBe(false);
    expect(isPlayerSavedShot({ ...shot, playerHand: 'invalid' })).toBe(false);
  });
  it('keeps a center-mark opening in its reflected service box through editing', () => {
    const serve = PLAYER_DRILLS.find(drill => drill.launch.ball.family === 'serve')!;
    const original = { ...serve, launch: { ...serve.launch, position: { ...serve.launch.position, x: 0 } } };
    for (const hand of ['right', 'left'] as const) {
      const drill = playerDrillForHand(original, hand), zone = drill.launch.landingZone;
      expect(validatePlayerDrill(drill).valid).toBe(true);
      const limits = landingZoneLimits('serve', openingZoneSource(drill.launch));
      expect(zone.minX).toBeGreaterThanOrEqual(limits.minX); expect(zone.maxX).toBeLessThanOrEqual(limits.maxX);
      expect(drill.launch.position.x).toBe(0);
    }
  });
  it('uses one selected player hand even for older drafts with per-shot hand overrides', () => {
    const source = PLAYER_DRILLS[0]!;
    const mixed = { ...source, events: source.events.map((event, i) => i === 1 ? { ...event, ball: { ...event.ball, hand: 'left' as const } } : event) };
    const right = playerDrillForHand(mixed, 'right'), left = playerDrillForHand(mixed, 'left');
    expect(right.events.every(event => event.ball.hand === 'right')).toBe(true);
    expect(left.events.every(event => event.ball.hand === 'left')).toBe(true);
    expect(right.events.map(event => event.camera)).toEqual(mixed.events.map(event => event.camera));
    expect(mixed.events[1]!.ball.hand).toBe('left');
  });
  it.each(PLAYER_DRILLS.map(drill => [drill.id, drill] as const))('plays two left-handed sets with unchanged opponent hands: %s', (_id, original) => {
    const drill = playerDrillForHand(original, 'left'), settings = defaultDrillSettings(drill);
    const session = compileSession(drill, settings);
    expect(session.planningIssues).toEqual([]);
    expect(session.playerEvents).toHaveLength(settings.repetitions);
    for (const event of session.playerEvents!) {
      expect(event.event.ball.hand).toBe('left');
      const before = original.events[event.index % original.events.length]!;
      expect(event.event.label).toBe(before.label);
      expect(event.event.opponentReturn.ball.hand).toBe(before.opponentReturn.ball.hand);
      const arriving = session.repetitions[event.incomingIndex]!;
      expect(event.trajectory.intent.source).toEqual(arriving.reachability.contact!.position);
    }
    for (let i = 1; i < session.scheduledFlights!.length; i++) expect(session.scheduledFlights![i]!.startTime)
      .toBeGreaterThanOrEqual(session.scheduledFlights![i - 1]!.endTime - 1e-7);
  }, 15000);
  it('reflects seeded landing samples and repeats the same left-handed solution deterministically', () => {
    const right = PLAYER_DRILLS[0]!, left = playerDrillForHand(right, 'left');
    const settings = { ...defaultDrillSettings(right), repetitions: 2 };
    const a = compileSession(right, settings), b = compileSession(left, settings);
    expect(b.planningIssues).toEqual([]);
    expect(compileSession(left, settings)).toEqual(b);
    a.scheduledFlights!.forEach((flight, i) => {
      const target = b.scheduledFlights![i]!.trajectory.intent.target;
      expect(target.x).toBeCloseTo(-flight.trajectory.intent.target.x, 10);
      expect(target.z).toBeCloseTo(flight.trajectory.intent.target.z, 10);
    });
  }, 15000);
});
