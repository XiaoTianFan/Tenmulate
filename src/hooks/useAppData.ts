import { useEffect, useState } from 'react';
import type { DrillDefinitionV1 } from '../content/types';
import { DEFAULT_APP_DATA, loadAppData, saveAppData, type AppDataV1, type SavedViewV1 } from '../storage/appStorage';

export const useAppData = () => {
  const [data, setData] = useState<AppDataV1>(() => typeof window === 'undefined' ? DEFAULT_APP_DATA : loadAppData());
  useEffect(() => saveAppData(data), [data]);

  return {
    data,
    saveDrill: (drill: DrillDefinitionV1) => setData((current) => ({ ...current, customDrills: [...current.customDrills.filter((item) => item.id !== drill.id), drill] })),
    deleteDrill: (id: string) => setData((current) => ({ ...current, customDrills: current.customDrills.filter((item) => item.id !== id) })),
    saveView: (view: SavedViewV1) => setData((current) => ({ ...current, savedViews: [...current.savedViews.filter((item) => item.id !== view.id), view] })),
    deleteView: (id: string) => setData((current) => ({ ...current, savedViews: current.savedViews.filter((item) => item.id !== id) })),
    renameView: (id: string, name: string) => setData((current) => ({ ...current, savedViews: current.savedViews.map((item) => item.id === id ? { ...item, name } : item) })),
  };
};
