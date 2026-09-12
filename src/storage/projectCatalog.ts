import type { DrillDefinitionV2 } from '../content/types.ts';
import { validatePlayerDrill } from '../content/playerValidation.ts';

export type ProjectCatalog = { schemaVersion: 1; drills: DrillDefinitionV2[] };
export type ProjectCatalogSnapshot = ProjectCatalog & { revision: string };
export const PROJECT_DRILLS_ENDPOINT = '/__tenmulate/project/drills';
export const drillNameKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

export function validateProjectCatalog(value: unknown): ProjectCatalog {
  const catalog = value as ProjectCatalog | null;
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.drills) || catalog.drills.length > 1000)
    throw new Error('Invalid project drill catalog.');
  const ids = new Set<string>(), names = new Set<string>();
  for (const drill of catalog.drills) {
    const result = validatePlayerDrill(drill);
    if (!result.valid) throw new Error(`Invalid project drill: ${result.errors.join(' ')}`);
    const name = drillNameKey(drill.title);
    if (ids.has(drill.id) || names.has(name)) throw new Error('Project drill IDs and names must be unique.');
    ids.add(drill.id); names.add(name);
  }
  return catalog;
}

/** Names select an existing slot; its identity survives replacement and renames. */
export function upsertProjectDrill(catalog: ProjectCatalog, value: unknown) {
  const result = validatePlayerDrill(value);
  if (!result.valid) throw new Error(result.errors.join(' '));
  const input = value as DrillDefinitionV2;
  const target = catalog.drills.find(drill => drillNameKey(drill.title) === drillNameKey(input.title))
    ?? catalog.drills.find(drill => drill.id === input.id);
  const drill = structuredClone({ ...input, id: target?.id ?? input.id, title: input.title.trim(), defaultRepetitions: input.events.length });
  // A rename onto another slot replaces that slot and removes the old identity.
  const drills = catalog.drills.filter(item => item.id !== input.id || item.id === drill.id);
  const index = drills.findIndex(item => item.id === drill.id);
  if (index < 0) drills.push(drill); else drills[index] = drill;
  return { catalog: validateProjectCatalog({ schemaVersion: 1, drills }), drill };
}

/** Browser overrides take precedence; defaults remain available in other browsers. */
export function mergeBrowserDrills(project: readonly DrillDefinitionV2[], browser: readonly DrillDefinitionV2[]) {
  const ids = new Set<string>(), names = new Set<string>();
  return [...project.map(item => browser.find(value => value.id === item.id)
    ?? browser.find(value => drillNameKey(value.title) === drillNameKey(item.title)) ?? item), ...browser].filter(item => {
      const name = drillNameKey(item.title);
      if (ids.has(item.id) || names.has(name)) return false;
      ids.add(item.id); names.add(name); return true;
    });
}
