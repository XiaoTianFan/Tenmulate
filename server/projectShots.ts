import { PROJECT_SHOTS_ENDPOINT, upsertProjectShot, validateProjectShots, type ProjectShots } from '../src/storage/projectShots.ts';
import { createProjectStore, projectCatalogPlugin, projectMiddleware, RequestError } from './projectStore.ts';

const adapter = {
  endpoint: PROJECT_SHOTS_ENDPOINT, validate: validateProjectShots,
  change(current: ProjectShots, operation: 'save' | 'delete', body: Record<string, unknown>) {
    if (operation === 'save') {
      if (body.targetId !== undefined && typeof body.targetId !== 'string') throw new Error('Invalid shot slot.');
      const result = upsertProjectShot(current, body.shot, body.targetId as string | undefined);
      return { catalog: result.catalog, savedId: result.shot.id };
    }
    if (!current.shots.some(shot => shot.id === body.id)) throw new RequestError(404, 'Shot no longer exists.');
    return { catalog: { schemaVersion: 1 as const, shots: current.shots.filter(shot => shot.id !== body.id) } };
  },
};
export const createProjectShotStore = (file: string) => createProjectStore(file, adapter);
export const projectShotMiddleware = (file: string) => projectMiddleware(file, adapter);
export const projectShotsPlugin = (file = 'src/content/project-shots.json') => projectCatalogPlugin('tenmulate-project-shots', file, adapter);
