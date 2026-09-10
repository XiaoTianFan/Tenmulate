import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createProjectDrillStore, projectDrillMiddleware } from '../server/projectDrills';
import { PLAYER_DRILLS } from '../src/content/playerDrills';
import { mergeBrowserDrills, PROJECT_DRILLS_ENDPOINT, validateProjectCatalog } from '../src/storage/projectCatalog';
import catalog from '../src/content/project-drills.json';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'tenmulate-drills-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'drills.json');
  await writeFile(file, JSON.stringify({ schemaVersion: 1, drills: PLAYER_DRILLS.slice(0, 2) }));
  return { file, store: createProjectDrillStore(file) };
}
describe('project drill persistence', () => {
  it('ships a valid catalog with the current starter library', () => {
    expect(validateProjectCatalog(catalog).drills).toHaveLength(PLAYER_DRILLS.length);
  });
  it('writes complete settings to disk and survives reopening with stable identity', async () => {
    const { file, store } = await fixture(), current = await store.read();
    const drill = { ...current.drills[0]!, events: current.drills[0]!.events.map(event => ({ ...event,
      cameraTransition: { movement: { destination: 'waypoint' as const, waypoint: { lateral: 1, behindBaseline: -6, eyeHeight: 1.7 } }, focus: { beforeReturn: { mode: 'opponent' as const } } } })) };
    const saved = await store.mutate('save', { revision: current.revision, drill });
    expect(saved.savedId).toBe(drill.id);
    expect(saved.drills[0]!.defaultRepetitions).toBe(drill.events.length);
    expect((await createProjectDrillStore(file).read()).drills[0]!.events).toEqual(drill.events);
  });
  it('overwrites a same-name slot, including whitespace/case, without creating a copy', async () => {
    const { store } = await fixture(), current = await store.read();
    const drill = { ...structuredClone(current.drills[0]!), id: 'new-copy', title: '  CROSSCOURT   Rhythm  ', description: 'Updated' };
    const saved = await store.mutate('save', { revision: current.revision, drill });
    expect(saved.drills).toHaveLength(2);
    expect(saved.savedId).toBe(current.drills[0]!.id);
    expect(saved.drills[0]!.description).toBe('Updated');
  });
  it('renames in place and merges onto another named slot without duplicate identities', async () => {
    const { store } = await fixture(), current = await store.read();
    const saved = await store.mutate('save', { revision: current.revision, drill: { ...current.drills[0], title: current.drills[1]!.title } });
    expect(saved.drills).toHaveLength(1);
    expect(saved.savedId).toBe(current.drills[1]!.id);
  });
  it('rejects invalid edits and stale/concurrent saves without changing the accepted data', async () => {
    const { store, file } = await fixture(), current = await store.read();
    const before = await readFile(file, 'utf8');
    await expect(store.mutate('save', { revision: current.revision, drill: { ...current.drills[0], events: [] } })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(before);
    const first = store.mutate('save', { revision: current.revision, drill: { ...current.drills[0], title: 'First edit' } });
    const second = store.mutate('save', { revision: current.revision, drill: { ...current.drills[0], title: 'Stale edit' } });
    await first; await expect(second).rejects.toThrow('catalog changed');
    expect((await store.read()).drills[0]!.title).toBe('First edit');
  });
  it('does not reset a damaged catalog or report a successful write', async () => {
    const { file, store } = await fixture();
    await writeFile(file, 'damaged');
    await expect(store.mutate('save', { drill: PLAYER_DRILLS[0], revision: '' })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('damaged');
  });
  it('retains unmatched browser saves, while project entries take precedence', () => {
    const local = { ...PLAYER_DRILLS[0]!, id: 'browser-only', title: 'My old drill' };
    expect(mergeBrowserDrills(PLAYER_DRILLS, [PLAYER_DRILLS[0]!, local])).toHaveLength(PLAYER_DRILLS.length + 1);
    expect(mergeBrowserDrills([...PLAYER_DRILLS, local], [local])).toHaveLength(PLAYER_DRILLS.length + 1);
  });
  it('serves separate clients from the same disk catalog and denies foreign-origin writes', async () => {
    const { file } = await fixture();
    const middleware = projectDrillMiddleware(file);
    const server = createServer((req, res) => void middleware(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanups.unshift(() => new Promise<void>(resolve => server.close(() => resolve())));
    const address = server.address() as { port: number }, url = `http://127.0.0.1:${address.port}${PROJECT_DRILLS_ENDPOINT}`;
    const current = await (await fetch(url)).json();
    const headers = { 'Content-Type': 'application/json', 'X-Tenmulate-Project': '1' };
    const body = JSON.stringify({ revision: current.revision, drill: { ...current.drills[0], title: 'HTTP save' } });
    expect((await fetch(url, { method: 'PUT', headers: { ...headers, Origin: 'https://foreign.example' }, body })).status).toBe(403);
    expect((await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })).status).toBe(403);
    const saved = await fetch(url, { method: 'PUT', headers, body }); expect(saved.status).toBe(200);
    expect((await (await fetch(url)).json()).drills[0].title).toBe('HTTP save');
    const revision = (await (await fetch(url)).json()).revision;
    expect((await fetch(url, { method: 'DELETE', headers, body: JSON.stringify({ revision, id: current.drills[0].id }) })).status).toBe(200);
    expect((await (await fetch(url)).json()).drills).toHaveLength(1);
  });
});
