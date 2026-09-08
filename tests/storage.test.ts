import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRILLS } from '../src/content/bundled';
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
  it('migrates legacy landing points to zones and preserves edited dimensions',()=>{
    const save=(preferences:unknown)=>localStorage.setItem('tenmulate.appData.v1',JSON.stringify({schemaVersion:1,preferences}));
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
    localStorage.setItem('tenmulate.appData.v1',JSON.stringify({schemaVersion:1,preferences:legacy}));
    expect(loadAppData().preferences.rhythmPercent).toBe(50);
    localStorage.setItem('tenmulate.appData.v1',JSON.stringify({schemaVersion:1,preferences:{...legacy,rhythmPercent:125}}));
    expect(loadAppData().preferences.rhythmPercent).toBe(125);
    localStorage.setItem('tenmulate.appData.v1',JSON.stringify({schemaVersion:1,preferences:{...legacy,rhythmPercent:900}}));
    expect(loadAppData().preferences.rhythmPercent).toBe(150);
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
      movementPercent:100,practiceStroke:'alternate',trajectoryMode:'natural',
    });
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
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({ schemaVersion: 1, customDrills: [], savedViews: [] }));
    expect(loadAppData().preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('persists venue occupancy and quality while migrating old environments to Empty', () => {
    for (const audience of ['empty', 'half', 'full'] as const) {
      const data = { ...DEFAULT_APP_DATA, preferences: { ...DEFAULT_PREFERENCES, quality: 'performance' as const,
        environment: { ...DEFAULT_PREFERENCES.environment, venue: 'clay-stadium' as const, audience } } };
      saveAppData(data);
      expect(loadAppData().preferences).toMatchObject({ quality: 'performance', environment: { venue: 'clay-stadium', audience } });
    }
    const { audience: _oldAudience, ...oldEnvironment } = DEFAULT_PREFERENCES.environment;
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({ ...DEFAULT_APP_DATA,
      preferences: { ...DEFAULT_PREFERENCES, environment: oldEnvironment } }));
    expect(loadAppData().preferences.environment.audience).toBe('empty');
  });

  it('migrates the old on-court rally default behind the baseline', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { shotType: 'groundstroke', opponentPosition: { x: 0, z: 11.235 } },
    }));
    expect(loadAppData().preferences.opponentPosition).toEqual(DEFAULT_PREFERENCES.opponentPosition);
  });

  it('migrates the removed spin preset into a legal shot-aware selection', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { sessionCategory: 'Return Practice', spin: 'preset', bounceFactor: 9 },
    }));
    expect(loadAppData().preferences).toMatchObject({ shotType: 'serve', spin: 'flat', bounceFactor: 1.4 });
  });

  it('migrates a legacy zero-spin flat groundstroke to the low-spin floor', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { shotType: 'groundstroke', spin: 'flat', spinRateRpm: 0 },
    }));
    expect(loadAppData().preferences).toMatchObject({ shotType: 'groundstroke', spin: 'flat', spinRateRpm: 250 });
  });

  it('migrates the former on-court serve origin behind the baseline', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      preferences: { shotType: 'serve', opponentPosition: { x: -1.25, z: 11.705 } },
    }));
    expect(loadAppData().preferences.opponentPosition).toEqual({ x: -1.25, z: 12.235 });
  });

  it('migrates overhead practice to a bounded lob profile with independent landing depth', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
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
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [{ id: 'view-one', name: 'Projector', camera: DEFAULT_PREFERENCES.camera }],
    }));
    const migrated = loadAppData();
    expect(migrated.cameraPositionPresets[0]).toMatchObject({ id: 'position-view-one', name: 'Projector' });
    expect(migrated.perspectivePresets[0]).toMatchObject({ id: 'perspective-view-one', name: 'Projector' });
  });

  it('migrates the legacy left camera preset to player-view left', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      ...DEFAULT_APP_DATA,
      cameraPositionPresets: [
        { id: 'position-left', name: 'Left corner', position: { eyeHeight: 1.68, behindBaseline: 1.4, lateral: -2.6 } },
      ],
    }));
    expect(loadAppData().cameraPositionPresets[0]?.position.lateral).toBe(2.6);
  });

  it('adds the right receiver corner to a persisted legacy built-in camera set', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      ...DEFAULT_APP_DATA,
      cameraPositionPresets: DEFAULT_APP_DATA.cameraPositionPresets.filter((preset) => preset.id !== 'position-right'),
    }));
    const ids = loadAppData().cameraPositionPresets.map((preset) => preset.id);
    expect(ids).toEqual(['position-baseline', 'position-left', 'position-right', 'position-net', 'position-overhead']);
  });

  it('migrates legacy surface preferences into the canonical visual-and-physics surface', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
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
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
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
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
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
    localStorage.setItem('tenmulate.appData.v1', '{broken');
    expect(loadAppData()).toEqual(DEFAULT_APP_DATA);
  });
});
