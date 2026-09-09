import { useCallback, useEffect, useState } from 'react';
import { normalizeBallFocus, type BallFocusSettings } from '../engine/rendering/ballFocus';
import type { DrillDefinitionV2, SavedShotV2 } from '../content/types';
import { DEFAULT_APP_DATA, loadAppData, saveAppData, type AppDataV2, type CameraPositionPresetV1, type PerspectivePresetV1, type PracticePreferencesV1 } from '../storage/appStorage';

export const useAppData = () => {
  const [data, setData] = useState<AppDataV2>(() => typeof window === 'undefined' ? DEFAULT_APP_DATA : loadAppData());
  useEffect(() => saveAppData(data), [data]);

  const saveDrill = useCallback((drill: DrillDefinitionV2) => setData((current) => ({ ...current, customDrills: [...current.customDrills.filter((item) => item.id !== drill.id), structuredClone(drill)] })), []);
  const deleteDrill = useCallback((id: string) => setData((current) => ({ ...current, customDrills: current.customDrills.filter((item) => item.id !== id) })), []);
  const saveShot = useCallback((shot: SavedShotV2) => setData(current => ({...current,savedShots:[...current.savedShots.filter(item=>item.id!==shot.id),structuredClone(shot)]})),[]);
  const deleteShot = useCallback((id: string) => setData(current => ({...current,savedShots:current.savedShots.filter(item=>item.id!==id)})),[]);
  const saveDrillPlayerHand = useCallback((drillPlayerHand: AppDataV2['drillPlayerHand']) => setData(current => ({ ...current, drillPlayerHand })), []);
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
  // A pending practice form save must preserve independently changed visual preferences.
  const savePreferences = useCallback((preferences: Omit<PracticePreferencesV1, 'ballFocus'>) => setData((current) => ({
    ...current, preferences: { ...preferences, ballFocus: current.preferences.ballFocus },
  })), []);
  const saveBallFocus = useCallback((ballFocus: BallFocusSettings) => setData(current => ({
    ...current, preferences: { ...current.preferences, ballFocus: normalizeBallFocus(ballFocus) },
  })), []);

  return {
    data,
    saveDrill, deleteDrill, saveShot, deleteShot, saveCameraPositionPreset, savePerspectivePreset, savePreferences, saveBallFocus, saveDrillPlayerHand,
  };
};
