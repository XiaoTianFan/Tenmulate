import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_APP_DATA, DEFAULT_PREFERENCES, DEFAULT_CAMERA_POSITION_PRESETS, browserPresetOverrides, loadAppData, saveAppData } from '../src/storage/appStorage';
import { needsSaveDestination, writeBrowserData } from '../src/storage/savePolicy';
import { upsertProjectConfig, validateProjectConfigs } from '../src/storage/projectConfigs';
import { createProjectConfigStore, projectConfigsPlugin } from '../server/projectConfigs';
import { projectDrillsPlugin } from '../server/projectDrills';
import { projectShotsPlugin } from '../server/projectShots';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { mergeBrowserDrills, upsertProjectDrill } from '../src/storage/projectCatalog';
import bundled from '../src/content/project-configs.json';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { vi.unstubAllGlobals(); for (const cleanup of cleanups.splice(0)) await cleanup(); });
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
it('offers destinations only in development and never exposes project writes in production preview', () => {
  expect(needsSaveDestination(true)).toBe(true); expect(needsSaveDestination(false)).toBe(false);
  for (const plugin of [projectConfigsPlugin(), projectDrillsPlugin(), projectShotsPlugin()]) {
    expect(plugin.configureServer).toBeTypeOf('function'); expect(plugin.configurePreviewServer).toBeUndefined();
  }
});
it('does not acknowledge a browser save when durable storage fails', () => {
  const setItem = vi.fn(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
  expect(() => writeBrowserData({ setItem }, 'key', { hello: true })).toThrow('Nothing was saved');
  expect(setItem).toHaveBeenCalledTimes(1);
});
it('persists four independent practice configs, presets and browser deletions across reloads', () => {
  const configs = Object.fromEntries(['Quick Rally', 'Return Practice', 'Serve & Volley', 'Net & Overhead'].map((sessionCategory, i) => [sessionCategory, { ...DEFAULT_PREFERENCES, sessionCategory, launchSpeedKmh: 70 + i, seed: String(i + 10), camera: { ...DEFAULT_PREFERENCES.camera, yaw: i * 4 } }]));
  saveAppData({ ...DEFAULT_APP_DATA, practiceConfigs: configs, hiddenDrills: ['one'], hiddenShots: ['two'] });
  const reloaded = loadAppData(); expect(reloaded.practiceConfigs).toEqual(configs);
  expect(reloaded.preferences).toEqual(configs['Quick Rally']);
  expect(reloaded.hiddenDrills).toEqual(['one']); expect(reloaded.hiddenShots).toEqual(['two']);
});
it('replaces a bundled drill only in the browser, including same-name imports', () => {
  const source = PLAYER_DRILLS[0]!;
  const replacement = upsertProjectDrill({ schemaVersion: 1, drills: [...PLAYER_DRILLS] }, { ...source, id: 'imported-copy', description: 'Personal edit' }).drill;
  const visible = mergeBrowserDrills(PLAYER_DRILLS, [replacement]);
  expect(visible).toHaveLength(PLAYER_DRILLS.length);
  expect(visible[0]).toMatchObject({ id: source.id, description: 'Personal edit' });
  expect(PLAYER_DRILLS[0]!.description).not.toBe('Personal edit');
  expect(mergeBrowserDrills(PLAYER_DRILLS, [])).toEqual(PLAYER_DRILLS);
});
it('writes independent project config entries atomically and rejects stale revisions and invalid input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tenmulate-config-save-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'configs.json'); await writeFile(file, JSON.stringify(bundled));
  const store = createProjectConfigStore(file), first = await store.read();
  const config = { ...DEFAULT_PREFERENCES, launchSpeedKmh: 110, seed: '42' };
  const saved = await store.mutate('save', { revision: first.revision, change: { kind: 'practice', value: config } });
  expect(saved.practiceConfigs['Quick Rally']).toEqual(config);
  await expect(store.mutate('save', { revision: first.revision, change: { kind: 'practice', value: config } })).rejects.toThrow('catalog changed');
  const position = { ...DEFAULT_CAMERA_POSITION_PRESETS[0]!, position: { eyeHeight: 4, behindBaseline: 2, lateral: -2 } };
  const next = await store.mutate('save', { revision: saved.revision, change: { kind: 'position', value: position } });
  expect(next.practiceConfigs).toEqual(saved.practiceConfigs);
  expect((await createProjectConfigStore(file).read()).cameraPositionPresets).toEqual([position]);
  const bytes = await readFile(file, 'utf8');
  expect(JSON.parse(bytes)).not.toHaveProperty('revision');
  await expect(store.mutate('save', { revision: next.revision, change: { kind: 'practice', value: { ...config, camera: { ...config.camera, yaw: 999 } } } })).rejects.toThrow('camera');
  expect(await readFile(file, 'utf8')).toBe(bytes);
});
it('validates configs before accepting either destination, including all practice shot families', () => {
  for (const shotType of ['serve', 'groundstroke', 'volley', 'lob', 'overhead', 'drop-shot'] as const) {
    expect(() => upsertProjectConfig(validateProjectConfigs(bundled), { kind: 'practice', value: { ...DEFAULT_PREFERENCES, shotType } })).not.toThrow();
  }
  for (const change of [{ camera: {} }, { environment: {} }, { launchSpeedKmh: NaN }, { shotType: 'invalid' }, { seed: 'nope' }]) {
    expect(() => upsertProjectConfig(validateProjectConfigs(bundled), { kind: 'practice', value: { ...DEFAULT_PREFERENCES, ...change } as typeof DEFAULT_PREFERENCES })).toThrow();
  }
});

it('distinguishes explicit browser copies of built-in preset values from untouched defaults', () => {
  const defaults = DEFAULT_CAMERA_POSITION_PRESETS;
  expect(browserPresetOverrides(defaults, defaults, [])).toEqual([]);
  expect(browserPresetOverrides(defaults, defaults, [defaults[0]!.id])).toEqual([defaults[0]]);
  const legacy = { ...defaults[0]!, position: { ...defaults[0]!.position, lateral: 2 } };
  expect(browserPresetOverrides([legacy], defaults)).toEqual([legacy]);
});
