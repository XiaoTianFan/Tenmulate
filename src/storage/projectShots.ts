import type { SavedShotV2 } from '../content/types.ts';
import { isPlayerSavedShot } from '../content/playerValidation.ts';
import { drillNameKey } from './projectCatalog.ts';

export type ProjectShots = { schemaVersion: 1; shots: SavedShotV2[] };
export type ProjectShotsSnapshot = ProjectShots & { revision: string };
export const PROJECT_SHOTS_ENDPOINT = '/__tenmulate/project/shots';
export const shotNameKey = drillNameKey;

/** Remove hidden legacy aliases too, so deleting a project slot cannot reveal
 * the same preset under an old browser ID on the next merge or reload. */
export function removeBrowserShot(shots: readonly SavedShotV2[], id: string, name?: string) {
  return shots.filter(shot => shot.id !== id && (name === undefined || shotNameKey(shot.name) !== shotNameKey(name)));
}

export function validateProjectShots(value: unknown): ProjectShots {
  const catalog = value as ProjectShots | null;
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.shots) || catalog.shots.length > 2000)
    throw new Error('Invalid project shot catalog.');
  const ids = new Set<string>(), names = new Set<string>();
  for (const shot of catalog.shots) {
    if (!isPlayerSavedShot(shot)) throw new Error('Invalid shot settings.');
    const name = shotNameKey(shot.name);
    if (!name || ids.has(shot.id) || names.has(name)) throw new Error('Project shot IDs and names must be unique.');
    ids.add(shot.id); names.add(name);
  }
  return catalog;
}

/** Explicit overwrite targets keep their identity, including system defaults. */
export function upsertProjectShot(catalog: ProjectShots, value: unknown, targetId?: string) {
  if (!isPlayerSavedShot(value)) throw new Error('Invalid shot settings.');
  const named = catalog.shots.find(shot => shotNameKey(shot.name) === shotNameKey(value.name));
  const target = targetId ? catalog.shots.find(shot => shot.id === targetId) : named ?? catalog.shots.find(shot => shot.id === value.id);
  if (targetId && !target) throw new Error('The selected project shot no longer exists. Choose another slot.');
  if (target && named && named.id !== target.id) throw new Error('Another shot already uses this name. Choose a different name or overwrite that slot.');
  const id = target?.id ?? value.id;
  const shot = structuredClone({ ...value, id, name: value.name.trim(), playerHand: value.playerHand ?? 'right',
    event: { ...value.event, id: `preset-${id}`, presetId: id, label: value.name.trim() } });
  const shots = [...catalog.shots], index = shots.findIndex(item => item.id === id);
  if (index < 0) shots.push(shot); else shots[index] = shot;
  return { catalog: validateProjectShots({ schemaVersion: 1, shots }), shot };
}

/** Browser-only presets remain available to explicitly promote into the project. */
export function mergeBrowserShots(project: readonly SavedShotV2[], browser: readonly SavedShotV2[]) {
  const ids = new Set(project.map(shot => shot.id)), names = new Set(project.map(shot => shotNameKey(shot.name)));
  return [...project, ...browser.filter(shot => {
    const name = shotNameKey(shot.name);
    if (ids.has(shot.id) || names.has(name)) return false;
    ids.add(shot.id); names.add(name); return true;
  })];
}
