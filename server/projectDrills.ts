import { PROJECT_DRILLS_ENDPOINT, upsertProjectDrill, validateProjectCatalog, type ProjectCatalog } from '../src/storage/projectCatalog';
import { createProjectStore, projectCatalogPlugin, projectMiddleware, RequestError } from './projectStore';

const adapter = {
  endpoint: PROJECT_DRILLS_ENDPOINT, validate: validateProjectCatalog,
  change(current: ProjectCatalog, operation: 'save' | 'delete', body: Record<string, unknown>) {
    if (operation === 'save') {
      const result = upsertProjectDrill(current, body.drill);
      return { catalog: result.catalog, savedId: result.drill.id };
    }
    if (!current.drills.some(drill => drill.id === body.id)) throw new RequestError(404, 'Drill no longer exists.');
    return { catalog: { schemaVersion: 1 as const, drills: current.drills.filter(drill => drill.id !== body.id) } };
  },
};
export const createProjectDrillStore = (file: string) => createProjectStore(file, adapter);
export const projectDrillMiddleware = (file: string) => projectMiddleware(file, adapter);
export const projectDrillsPlugin = (file = 'src/content/project-drills.json') => projectCatalogPlugin('tenmulate-project-drills', file, adapter);
