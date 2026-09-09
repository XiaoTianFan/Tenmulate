import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRILLS } from '../src/content/bundled';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { migratePlayerDrill } from '../src/content/playerMigration';
import { DEFAULT_APP_DATA, appStorageNotice, loadAppData, saveAppData } from '../src/storage/appStorage';

afterEach(() => vi.unstubAllGlobals());
describe('player-first storage migration', () => {
  it('keeps the original bytes and prefers the saved V2 edits on subsequent loads', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const original = JSON.stringify({ ...DEFAULT_APP_DATA, schemaVersion: 1, customDrills: [DRILLS[0]], savedShots: [] });
    values.set('tenmulate.appData.v1', original);
    const loaded = loadAppData();
    expect(loaded.customDrills).toEqual([migratePlayerDrill(DRILLS[0]!)]);
    expect(appStorageNotice()).toContain('Original data is retained');
    const edited = { ...loaded, customDrills: [{ ...PLAYER_DRILLS[0]!, title: 'My player tactics' }] };
    saveAppData(edited);
    expect(values.get('tenmulate.appData.v1')).toBe(original);
    expect(loadAppData()).toEqual(edited);
    expect(appStorageNotice()).toBe('');
  });
  it('preserves and reports legacy records that cannot safely convert', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const original = JSON.stringify({ ...DEFAULT_APP_DATA, schemaVersion: 1, customDrills: [{ schemaVersion: 1, title: 'Broken old draft' }] });
    values.set('tenmulate.appData.v1', original);
    const loaded = loadAppData();
    expect(appStorageNotice()).toContain('1 legacy item(s) need manual repair');
    saveAppData(loaded);
    expect(values.get('tenmulate.appData.v1')).toBe(original);
  });
});
