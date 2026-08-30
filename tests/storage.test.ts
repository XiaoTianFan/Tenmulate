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

  it('round-trips custom drills, split presets, and practice preferences', () => {
    const data = {
      ...DEFAULT_APP_DATA,
      customDrills: [{ ...DRILLS[0]!, id: 'saved-drill', category: 'Custom' as const }],
      cameraPositionPresets: [{ id: 'position-one', name: 'Projector', position: { eyeHeight: 1.7, behindBaseline: 2, lateral: 0 } }],
      perspectivePresets: [{ id: 'perspective-one', name: 'Projector POV', perspective: { yaw: 0, pitch: -1.7, fov: 66 } }],
      preferences: { ...DEFAULT_PREFERENCES, pace: 96, quality: 'performance' as const },
    };
    saveAppData(data);
    expect(loadAppData()).toEqual(data);
  });

  it('migrates older V1 data that predates persisted preferences', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({ schemaVersion: 1, customDrills: [], savedViews: [] }));
    expect(loadAppData().preferences).toEqual(DEFAULT_PREFERENCES);
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

  it('migrates the original coupled surface preference into independent visual and physics choices', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [],
      preferences: { surface: 'clay' },
    }));
    expect(loadAppData().preferences.visualSurface).toBe('clay');
    expect(loadAppData().preferences.physicsSurface).toBe('clay');
  });

  it('normalizes legacy and invalid environment weather and wind fields', () => {
    localStorage.setItem('tenmulate.appData.v1', JSON.stringify({
      schemaVersion: 1,
      customDrills: [],
      savedViews: [],
      preferences: { environment: { venue: 'outdoor-club', lightIntensity: 99, weather: 'hail', windSpeedMps: -4 } },
    }));
    expect(loadAppData().preferences.environment).toMatchObject({
      venue: 'outdoor-club', weather: 'clear', weatherIntensity: 0, windSpeedMps: 0, timeOfDay: 14, lightIntensity: 1.5,
    });
  });

  it('fails closed on corrupt storage', () => {
    localStorage.setItem('tenmulate.appData.v1', '{broken');
    expect(loadAppData()).toEqual(DEFAULT_APP_DATA);
  });
});
