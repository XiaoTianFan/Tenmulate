import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createProjectShotStore, projectShotMiddleware } from '../server/projectShots';
import { PLAYER_SHOTS } from '../src/content/playerShots';
import { playerEventForHand } from '../src/content/playerHandedness';
import type { SavedShotV2 } from '../src/content/types';
import { mergeBrowserShots, PROJECT_SHOTS_ENDPOINT, upsertProjectShot, validateProjectShots } from '../src/storage/projectShots';
import packaged from '../src/content/project-shots.json';

const shots: SavedShotV2[] = PLAYER_SHOTS.map(shot => ({ schemaVersion: 2, playerHand: 'right', ...shot }));
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'tenmulate-shots-'));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'shots.json');
  await writeFile(file, JSON.stringify({ schemaVersion: 1, shots }));
  return { file, store: createProjectShotStore(file) };
}

describe('project shot library', () => {
  it('packages a valid editable catalog and rejects duplicate slots and malformed shots', () => {
    expect(() => validateProjectShots(packaged)).not.toThrow();
    expect(() => validateProjectShots({ schemaVersion: 1, shots: [shots[0], shots[0]] })).toThrow('unique');
    expect(() => validateProjectShots({ schemaVersion: 1, shots: [{ ...shots[0], event: {} }] })).toThrow('Invalid shot');
  });
  it('overwrites any default slot with the full snapshot and retains its identity on disk', async () => {
    const { store, file } = await fixture(), initial = await store.read();
    const target = shots[0]!, input = structuredClone(shots[2]!);
    const update: SavedShotV2 = { ...input, name: 'Updated crosscourt', playerHand: 'left', event: {
      ...playerEventForHand(input.event, 'right', 'left'), intervalSeconds: 5, movementPercent: 145,
      rhythmPercent: 130, cameraTransition: { focus: { beforeReturn: { mode: 'opponent' } }, movement: { destination: 'neutral' } },
      ball: { ...input.event.ball, paceKmh: 64, contactTiming: 'apex' },
      opponentReturn: { ...input.event.opponentReturn, ball: { ...input.event.opponentReturn.ball, contactTiming: 'rise' } },
    } };
    const result = await store.mutate('save', { revision: initial.revision, shot: update, targetId: target.id });
    expect(result.savedId).toBe(target.id);
    expect(result.shots).toHaveLength(shots.length);
    const reopened = (await createProjectShotStore(file).read()).shots[0]!;
    expect(reopened).toEqual({ ...update, id: target.id, event: { ...update.event, id: `preset-${target.id}`, presetId: target.id, label: update.name } });
    expect(reopened.event.cameraTransition).toEqual(update.event.cameraTransition);
    expect(playerEventForHand(reopened.event, reopened.playerHand!, 'right').camera.lateral).toBe(input.event.camera.lateral);
    expect(result.shots[2]).toEqual(shots[2]);
  });
  it('new same-name saves update a slot without duplicating it, while different names create slots', () => {
    const initial = { schemaVersion: 1 as const, shots };
    const first = upsertProjectShot(initial, { ...shots[0], id: 'new-shot', name: ' FOREHAND  CROSSCOURT DEEP ' });
    expect(first.shot.id).toBe(shots[0]!.id);
    expect(first.catalog.shots).toHaveLength(shots.length);
    expect(upsertProjectShot(first.catalog, { ...shots[0], id: 'custom-shot', name: 'My custom shot' }).catalog.shots).toHaveLength(shots.length + 1);
  });
  it('never overwrites a different named slot when an explicit target was chosen', () => {
    const initial = { schemaVersion: 1 as const, shots };
    expect(() => upsertProjectShot(initial, shots[1], shots[0]!.id)).toThrow('Another shot');
    expect(() => upsertProjectShot(initial, shots[0], 'removed-slot')).toThrow('no longer exists');
  });
  it('preserves valid disk data after rejected edits and stale or concurrent writes', async () => {
    const { store, file } = await fixture(), initial = await store.read(), before = await readFile(file, 'utf8');
    await expect(store.mutate('save', { revision: initial.revision, shot: { ...shots[0], event: {} } })).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe(before);
    const first = store.mutate('save', { revision: initial.revision, shot: { ...shots[0], name: 'First update' }, targetId: shots[0]!.id });
    const second = store.mutate('save', { revision: initial.revision, shot: { ...shots[0], name: 'Stale update' }, targetId: shots[0]!.id });
    await first; await expect(second).rejects.toThrow('catalog changed');
    expect((await store.read()).shots[0]!.name).toBe('First update');
  });
  it('does not reinsert a deleted default or reset a damaged catalog', async () => {
    const { store, file } = await fixture(), initial = await store.read();
    await store.mutate('delete', { revision: initial.revision, id: shots[0]!.id });
    expect((await createProjectShotStore(file).read()).shots.some(shot => shot.id === shots[0]!.id)).toBe(false);
    await writeFile(file, 'damaged');
    await expect(store.read()).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('damaged');
  });
  it('keeps browser-only presets recoverable and uses the project copy after promotion', () => {
    const legacy = { ...shots[0]!, id: 'legacy', name: 'Legacy shot' };
    expect(mergeBrowserShots(shots, [shots[0]!, legacy])).toHaveLength(shots.length + 1);
    const promoted = upsertProjectShot({ schemaVersion: 1, shots }, legacy);
    expect(mergeBrowserShots(promoted.catalog.shots, [legacy])).toEqual(promoted.catalog.shots);
  });
  it('shares disk updates across HTTP clients and rejects foreign or unframed mutations', async () => {
    const { file } = await fixture(), middleware = projectShotMiddleware(file);
    const server = createServer((req, res) => void middleware(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanups.unshift(() => new Promise<void>(resolve => server.close(() => resolve())));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}${PROJECT_SHOTS_ENDPOINT}`;
    const initial = await (await fetch(url)).json();
    const headers = { 'Content-Type': 'application/json', 'X-Tenmulate-Project': '1' };
    const body = JSON.stringify({ revision: initial.revision, targetId: shots[0]!.id, shot: { ...shots[0], name: 'HTTP update' } });
    expect((await fetch(url, { method: 'PUT', headers: { ...headers, Origin: 'https://foreign.example' }, body })).status).toBe(403);
    expect((await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })).status).toBe(403);
    expect((await fetch(url, { method: 'PUT', headers, body })).status).toBe(200);
    expect((await (await fetch(url)).json()).shots[0].name).toBe('HTTP update');
    expect(JSON.parse(await readFile(file, 'utf8')).shots[0].name).toBe('HTTP update');
  });
});
