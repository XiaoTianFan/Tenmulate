import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_DRILLS as DRILLS } from '../src/content/playerDrills';
import { DEFAULT_APP_DATA, DEFAULT_PREFERENCES, loadAppData, saveAppData } from '../src/storage/appStorage';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

describe('local application data', () => {
  beforeEach(() => vi.stubGlobal('localStorage', new MemoryStorage()));
  it('defaults both contact timings to descent and preserves explicit independent choices', () => {
    for (const value of [undefined, 'invalid', null, ['rise']]) {
      localStorage.setItem('tenmulate.appData.v2', JSON.stringify({ schemaVersion: 2, preferences: {
        opponentContactTiming: value, rallyShot: { ...DEFAULT_PREFERENCES.rallyShot, contactTiming: value },
      } }));
      expect(loadAppData().preferences).toMatchObject({ opponentContactTiming: 'descent', rallyShot: { contactTiming: 'descent' } });
    }
    const preferences = { ...DEFAULT_PREFERENCES, opponentContactTiming: 'apex' as const,
      rallyShot: { ...DEFAULT_PREFERENCES.rallyShot, contactTiming: 'rise' as const } };
    saveAppData({ ...DEFAULT_APP_DATA, preferences });
    expect(loadAppData().preferences).toEqual(preferences);
  });
  it('loads old shot records with descent timing without moving their authored zones or camera', () => {
    const drill = DRILLS[0]!, event = drill.events[0]!;
    const oldEvent = { ...event, ball: { ...event.ball, contactTiming: undefined },
      opponentReturn: { ...event.opponentReturn, ball: { ...event.opponentReturn.ball, contactTiming: undefined } } };
    const oldDrill = { ...drill, events: [oldEvent] };
    saveAppData({ ...DEFAULT_APP_DATA, customDrills: [oldDrill], savedShots: [{ schemaVersion: 2, id: 'saved-old', name: 'Old shot', event: oldEvent }] });
    const loaded = loadAppData();
    for (const shot of [loaded.customDrills[0]!.events[0]!, loaded.savedShots[0]!.event]) {
      expect(shot.ball.contactTiming).toBe('descent');
      expect(shot.opponentReturn.ball.contactTiming).toBe('descent');
      expect(shot.camera).toEqual(event.camera);
      expect(shot.landingZone).toEqual(event.landingZone);
      expect(shot.opponentReturn.landingZone).toEqual(event.opponentReturn.landingZone);
    }
    saveAppData(loaded);
    expect(loadAppData()).toEqual(loaded);
  });
  it('retains Quick Rally return settings while safely defaulting older or malformed preferences', () => {
    const rallyShot = { type: 'groundstroke' as const, spin: 'slice' as const, spinRateRpm: 1250, paceKmh: 65 };
    const rallyLandingZone = { minX: -2, maxX: 1, minZ: 7, maxZ: 9 };
    saveAppData({ ...DEFAULT_APP_DATA, preferences: { ...DEFAULT_PREFERENCES, rallyShot, rallyLandingZone } });
    expect(loadAppData().preferences).toMatchObject({ rallyShot, rallyLandingZone });
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({ schemaVersion: 2, preferences: { rallyShot: { type: 'unknown', spin: 'kick' }, rallyLandingZone: { minX: 99 } } }));
    expect(loadAppData().preferences).toMatchObject({ rallyShot: DEFAULT_PREFERENCES.rallyShot, rallyLandingZone: DEFAULT_PREFERENCES.rallyLandingZone });
  });
  it('migrates preset serve rhythm to Normal while preserving explicit choices', () => {
    expect(DEFAULT_PREFERENCES.serveRhythm).toBe('normal');
    for (const [stored, expected] of [['preset', 'normal'], [undefined, 'normal'], ['normal', 'normal'], ['compact', 'compact']] as const) {
      localStorage.setItem('tenmulate.appData.v2', JSON.stringify({ schemaVersion: 1, preferences: { serveRhythm: stored } }));
      const migrated = loadAppData();
      expect(migrated.preferences.serveRhythm).toBe(expected);
      saveAppData(migrated);
      expect(loadAppData().preferences.serveRhythm).toBe(expected);
    }
  });
  it('preserves the ball highlight toggle and removes obsolete blur preferences', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({schemaVersion:1, preferences:{ballFocus:undefined}}));
    expect(loadAppData().preferences.ballFocus).toEqual({enabled:false});
    saveAppData({...DEFAULT_APP_DATA, preferences:{...DEFAULT_PREFERENCES,ballFocus:{enabled:true}}});
    expect(loadAppData().preferences.ballFocus).toEqual({enabled:true});
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({schemaVersion:1, preferences:{ballFocus:{enabled:true,maxBlurPx:999}}}));
    const migrated = loadAppData();
    expect(migrated.preferences.ballFocus).toEqual({enabled:true});
    saveAppData(migrated);
    expect(JSON.parse(localStorage.getItem('tenmulate.appData.v2')!).preferences.ballFocus).toEqual({enabled:true});
  });
  it('migrates legacy landing points to zones and preserves edited dimensions',()=>{
    const save=(preferences:unknown)=>localStorage.setItem('tenmulate.appData.v2',JSON.stringify({schemaVersion:1,preferences}));
    save({...DEFAULT_PREFERENCES,landingZone:undefined});
    expect(loadAppData().preferences.landingZone).toEqual({width:1.6,depth:2});
    save({...DEFAULT_PREFERENCES,shotType:'serve',landingZone:undefined});
    expect(loadAppData().preferences.landingZone).toEqual({width:.9,depth:1.2});
    save({...DEFAULT_PREFERENCES,landingZone:{width:2.7,depth:1.3}});
    expect(loadAppData().preferences.landingZone).toEqual({width:2.7,depth:1.3});
    save({...DEFAULT_PREFERENCES,landingZone:{width:null,depth:-5}});
    expect(loadAppData().preferences.landingZone).toEqual({width:1.6,depth:.2});
  });
  it('migrates seconds once and gives persisted rhythm precedence',()=>{
    const legacy={...DEFAULT_PREFERENCES,rhythmPercent:undefined,interval:7};
    localStorage.setItem('tenmulate.appData.v2',JSON.stringify({schemaVersion:1,preferences:legacy}));
    expect(loadAppData().preferences.rhythmPercent).toBe(50);
    localStorage.setItem('tenmulate.appData.v2',JSON.stringify({schemaVersion:1,preferences:{...legacy,rhythmPercent:125}}));
    expect(loadAppData().preferences.rhythmPercent).toBe(125);
    localStorage.setItem('tenmulate.appData.v2',JSON.stringify({schemaVersion:1,preferences:{...legacy,rhythmPercent:900}}));
    expect(loadAppData().preferences.rhythmPercent).toBe(300);
  });

  it('uses the reference Rally ball settings for a clean application', () => {
    expect(DEFAULT_PREFERENCES).toMatchObject({
      sessionCategory: 'Quick Rally',
      trajectoryEnabled: true,
      shotType: 'groundstroke',
      launchSpeedKmh: 70,
      spin: 'topspin',
      spinRateRpm: 1103,
      landingDepthM: 8.5,
      interval: 5,
      movementPercent:100,practiceStroke:'auto',trajectoryMode:'natural',
    });
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({schemaVersion: 1,
      preferences: {...DEFAULT_PREFERENCES, practiceStroke: 'alternate'}}));
    expect(loadAppData().preferences.practiceStroke).toBe('auto');
  });

  it('round-trips custom drills, split presets, and practice preferences', () => {
    const data = {
      ...DEFAULT_APP_DATA,
      customDrills: [{ ...DRILLS[0]!, id: 'saved-drill', category: 'Custom' as const }],
      cameraPositionPresets: [{ id: 'position-one', name: 'Projector', position: { eyeHeight: 1.7, behindBaseline: 2, lateral: 0 } }],
      perspectivePresets: [{ id: 'perspective-one', name: 'Projector POV', perspective: { yaw: 0, pitch: -1.7, fov: 66 } }],
      preferences: { ...DEFAULT_PREFERENCES, interval:9.2,rhythmPercent:70,movementPercent:135,practiceStroke:'backhand' as const,trajectoryMode:'exact' as const, launchSpeedKmh: 96, spinRateRpm: 2400, quality: 'performance' as const },
    };
    saveAppData(data);
    expect(loadAppData()).toEqual(data);
  });

  it('migrates older V1 data that predates persisted preferences', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({ schemaVersion: 1, customDrills: [], savedViews: [] }));
    expect(loadAppData().preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('persists chosen occupancy and quality while defaulting missing occupancy to Half seated', () => {
    for (const audience of ['empty', 'half', 'full'] as const) {
      const data = { ...DEFAULT_APP_DATA, preferences: { ...DEFAULT_PREFERENCES, quality: 'performance' as const,
        environment: { ...DEFAULT_PREFERENCES.environment, venue: 'clay-stadium' as const, audience } } };
      saveAppData(data);
      expect(loadAppData().preferences).toMatchObject({ quality: 'performance', environment: { venue: 'clay-stadium', audience } });
    }
    const { audience: _oldAudience, ...oldEnvironment } = DEFAULT_PREFERENCES.environment;
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({ ...DEFAULT_APP_DATA,
      preferences: { ...DEFAULT_PREFERENCES, environment: oldEnvironment } }));
    expect(loadAppData().preferences.environment.audience).toBe('half');
  });

  it('migrates the old on-court rally default behind the baseline', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { shotType: 'groundstroke', opponentPosition: { x: 0, z: 11.235 } },
    }));
    expect(loadAppData().preferences.opponentPosition).toEqual(DEFAULT_PREFERENCES.opponentPosition);
  });

  it('migrates the removed spin preset into a legal shot-aware selection', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { sessionCategory: 'Return Practice', spin: 'preset', bounceFactor: 9 },
    }));
    expect(loadAppData().preferences).toMatchObject({ shotType: 'serve', spin: 'flat', bounceFactor: 1.4 });
  });

  it('preserves a saved spin-free flat groundstroke', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { shotType: 'groundstroke', spin: 'flat', spinRateRpm: 0 },
    }));
    expect(loadAppData().preferences).toMatchObject({ shotType: 'groundstroke', spin: 'flat', spinRateRpm: 0 });
  });

  it('migrates the former on-court serve origin behind the baseline', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { shotType: 'serve', opponentPosition: { x: -1.25, z: 11.705 } },
    }));
    expect(loadAppData().preferences.opponentPosition).toEqual({ x: -1.25, z: 12.235 });
  });

  it('migrates overhead practice to a bounded lob profile with independent landing depth', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { sessionCategory: 'Net & Overhead', pace: 999, netClearanceM: -2, landingDepthM: 999 },
    }));
    expect(loadAppData().preferences).toMatchObject({
      shotType: 'lob',
      spin: 'topspin',
      launchSpeedKmh: 105,
      spinRateRpm: 1199,
      landingDepthM: 11.635,
    });
  });

  it('migrates coupled saved views into independent position and perspective presets', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [{ id: 'view-one', name: 'Projector', camera: DEFAULT_PREFERENCES.camera }],
    }));
    const migrated = loadAppData();
    expect(migrated.cameraPositionPresets[0]).toMatchObject({ id: 'position-view-one', name: 'Projector' });
    expect(migrated.perspectivePresets[0]).toMatchObject({ id: 'perspective-view-one', name: 'Projector' });
  });

  it('migrates the legacy left camera preset to player-view left', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      ...DEFAULT_APP_DATA,
      cameraPositionPresets: [
        { id: 'position-left', name: 'Left corner', position: { eyeHeight: 1.68, behindBaseline: 1.4, lateral: -2.6 } },
      ],
    }));
    expect(loadAppData().cameraPositionPresets[0]?.position.lateral).toBe(3.6);
  });

  it('migrates untouched corner/net defaults and preserves customized positions', () => {
    const custom = { id: 'position-left', name: 'Left corner', position: { eyeHeight: 1.8, behindBaseline: 2, lateral: 3 } };
    saveAppData({ ...DEFAULT_APP_DATA, cameraPositionPresets: [custom,
      { id: 'position-right', name: 'Right corner', position: { eyeHeight: 1.68, behindBaseline: 1.4, lateral: -2.6 } },
      { id: 'position-net', name: 'At the net', position: { eyeHeight: 1.66, behindBaseline: -6.7, lateral: -.4 } }] });
    const presets = loadAppData().cameraPositionPresets;
    expect(presets[0]).toEqual(custom);
    expect(presets[1]).toEqual(DEFAULT_APP_DATA.cameraPositionPresets.find(p => p.id === 'position-right'));
    expect(presets[2]).toEqual(DEFAULT_APP_DATA.cameraPositionPresets.find(p => p.id === 'position-net'));
  });

  it('adds the right receiver corner to a persisted legacy built-in camera set', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      ...DEFAULT_APP_DATA,
      cameraPositionPresets: DEFAULT_APP_DATA.cameraPositionPresets.filter((preset) => preset.id !== 'position-right'),
    }));
    const ids = loadAppData().cameraPositionPresets.map((preset) => preset.id);
    expect(ids).toEqual(['position-baseline', 'position-left', 'position-right', 'position-net', 'position-overhead']);
  });

  it('migrates legacy surface preferences into the canonical visual-and-physics surface', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [],
      preferences: { surface: 'clay' },
    }));
    expect(loadAppData().preferences.surface).toBe('clay');
    expect(loadAppData().preferences).not.toHaveProperty('visualSurface');
    expect(loadAppData().preferences).not.toHaveProperty('physicsSurface');
  });

  it('uses the saved bounce surface as the canonical surface over a legacy appearance', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [],
      preferences: { visualSurface: 'clay', physicsSurface: 'grass' },
    }));
    expect(loadAppData().preferences.surface).toBe('grass');
    expect(loadAppData().preferences).not.toHaveProperty('visualSurface');
    expect(loadAppData().preferences).not.toHaveProperty('physicsSurface');
  });

  it('normalizes legacy and invalid environment weather and wind fields', () => {
    localStorage.setItem('tenmulate.appData.v2', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [],
      preferences: { environment: { venue: 'outdoor-club', lightIntensity: 99, weather: 'hail', windSpeedMps: -4 } },
    }));
    expect(loadAppData().preferences.environment).toMatchObject({
      venue: 'hard-open-arena', weather: 'clear', weatherIntensity: 0, windSpeedMps: 0, timeOfDay: 14, lightIntensity: 1.5,
    });
  });

  it('fails closed on corrupt storage', () => {
    localStorage.setItem('tenmulate.appData.v2', '{broken');
    expect(loadAppData()).toEqual(DEFAULT_APP_DATA);
  });
});
