import { useCallback, useEffect, useState } from 'react';
import type { DrillDefinitionV1 } from '../content/types';
import { DEFAULT_APP_DATA, loadAppData, saveAppData, type AppDataV1, type CameraPositionPresetV1, type PerspectivePresetV1, type PracticePreferencesV1 } from '../storage/appStorage';

export const useAppData = () => {
  const [data, setData] = useState<AppDataV1>(() => typeof window === 'undefined' ? DEFAULT_APP_DATA : loadAppData());
  useEffect(() => saveAppData(data), [data]);

  const saveDrill = useCallback((drill: DrillDefinitionV1) => setData((current) => ({ ...current, customDrills: [...current.customDrills.filter((item) => item.id !== drill.id), drill] })), []);
  const deleteDrill = useCallback((id: string) => setData((current) => ({ ...current, customDrills: current.customDrills.filter((item) => item.id !== id) })), []);
  const saveCameraPositionPreset = useCallback((preset: CameraPositionPresetV1) => setData((current) => ({
    ...current,
    cameraPositionPresets: current.cameraPositionPresets.some((item) => item.id === preset.id)
      ? current.cameraPositionPresets.map((item) => item.id === preset.id ? preset : item)
      : [...current.cameraPositionPresets, preset],
  })), []);
  const savePerspectivePreset = useCallback((preset: PerspectivePresetV1) => setData((current) => ({
    ...current,
    perspectivePresets: current.perspectivePresets.some((item) => item.id === preset.id)
      ? current.perspectivePresets.map((item) => item.id === preset.id ? preset : item)
      : [...current.perspectivePresets, preset],
  })), []);
  const savePreferences = useCallback((preferences: PracticePreferencesV1) => setData((current) => ({ ...current, preferences })), []);

  return {
    data,
    saveDrill, deleteDrill, saveCameraPositionPreset, savePerspectivePreset, savePreferences,
  };
};
