import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import type { DrillDefinitionV1 } from '../content/types';
import { validateDrill } from '../content/validation';

const STORAGE_KEY = 'tenmulate.appData.v1';

export type SavedViewV1 = Readonly<{
  id: string;
  name: string;
  camera: CameraConfiguration;
}>;

export type AppDataV1 = Readonly<{
  schemaVersion: 1;
  customDrills: readonly DrillDefinitionV1[];
  savedViews: readonly SavedViewV1[];
}>;

export const DEFAULT_APP_DATA: AppDataV1 = {
  schemaVersion: 1,
  customDrills: [],
  savedViews: [],
};

export const loadAppData = (): AppDataV1 => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<AppDataV1>;
    if (parsed.schemaVersion !== 1) return DEFAULT_APP_DATA;
    const customDrills = Array.isArray(parsed.customDrills)
      ? parsed.customDrills.filter((drill) => validateDrill(drill).valid)
      : [];
    const savedViews = Array.isArray(parsed.savedViews)
      ? parsed.savedViews.filter((view): view is SavedViewV1 => Boolean(view && typeof view.id === 'string' && typeof view.name === 'string' && view.camera))
      : [];
    return { schemaVersion: 1, customDrills, savedViews };
  } catch {
    return DEFAULT_APP_DATA;
  }
};

export const saveAppData = (data: AppDataV1): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
