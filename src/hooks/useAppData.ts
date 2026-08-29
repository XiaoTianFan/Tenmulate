import { useCallback, useEffect, useState } from 'react';
import type { DrillDefinitionV1 } from '../content/types';
import { DEFAULT_APP_DATA, loadAppData, saveAppData, type AppDataV1, type PracticePreferencesV1, type SavedViewV1 } from '../storage/appStorage';

export const useAppData = () => {
  const [data, setData] = useState<AppDataV1>(() => typeof window === 'undefined' ? DEFAULT_APP_DATA : loadAppData());
  useEffect(() => saveAppData(data), [data]);

  const saveDrill = useCallback((drill: DrillDefinitionV1) => setData((current) => ({ ...current, customDrills: [...current.customDrills.filter((item) => item.id !== drill.id), drill] })), []);
  const deleteDrill = useCallback((id: string) => setData((current) => ({ ...current, customDrills: current.customDrills.filter((item) => item.id !== id) })), []);
  const saveView = useCallback((view: SavedViewV1) => setData((current) => ({ ...current, savedViews: [...current.savedViews.filter((item) => item.id !== view.id), view] })), []);
  const deleteView = useCallback((id: string) => setData((current) => ({ ...current, savedViews: current.savedViews.filter((item) => item.id !== id) })), []);
  const renameView = useCallback((id: string, name: string) => setData((current) => ({ ...current, savedViews: current.savedViews.map((item) => item.id === id ? { ...item, name } : item) })), []);
  const savePreferences = useCallback((preferences: PracticePreferencesV1) => setData((current) => ({ ...current, preferences })), []);

  return {
    data,
    saveDrill, deleteDrill, saveView, deleteView, renameView, savePreferences,
  };
};
