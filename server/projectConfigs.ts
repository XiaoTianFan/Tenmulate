import { PROJECT_CONFIGS_ENDPOINT, upsertProjectConfig, validateProjectConfigs, type ConfigChange, type ProjectConfigs } from '../src/storage/projectConfigs.ts';
import { createProjectStore, projectCatalogPlugin, RequestError } from './projectStore.ts';
const adapter = { endpoint: PROJECT_CONFIGS_ENDPOINT, validate: validateProjectConfigs,
  change(current: ProjectConfigs, operation: 'save' | 'delete', body: Record<string, unknown>) {
    if (operation !== 'save') throw new RequestError(405, 'Configuration deletion is not supported.');
    return { catalog: upsertProjectConfig(current, body.change as ConfigChange) };
  } };
export const createProjectConfigStore = (file: string) => createProjectStore(file, adapter);
export const projectConfigsPlugin = (file = 'src/content/project-configs.json') => projectCatalogPlugin('tenmulate-project-configs', file, adapter);
