import { useCallback, useRef, useState } from 'react';
import { normalizeBallFocus, type BallFocusSettings } from '../engine/rendering/ballFocus';
import type { DrillDefinitionV2, SavedShotV2 } from '../content/types';
import { DEFAULT_APP_DATA, DEFAULT_CAMERA_POSITION_PRESETS, DEFAULT_PERSPECTIVE_PRESETS, browserPresetOverrides, loadAppData, saveAppData, type AppDataV2, type CameraPositionPresetV1, type PerspectivePresetV1, type PracticePreferencesV1 } from '../storage/appStorage';
import { validatePracticeConfig, validateProjectConfigs } from '../storage/projectConfigs';
import { removeBrowserShot, upsertProjectShot, shotNameKey } from '../storage/projectShots';
import { upsertProjectDrill, drillNameKey } from '../storage/projectCatalog';

export const useAppData = () => {
  const [stored, setStored] = useState<AppDataV2>(() => typeof window === 'undefined' ? DEFAULT_APP_DATA : loadAppData());
  const current = useRef(stored);
  const [preferences, setPreferences] = useState(stored.preferences);
  // Acknowledge durable storage before state changes. Unrelated saves must not
  // accidentally publish the live Quick Practice form.
  const commit = useCallback((update: (data: AppDataV2) => AppDataV2) => {
    const next = update(current.current); saveAppData(next); current.current = next; setStored(next); return next;
  }, []);
  const saveDrill = (drill: DrillDefinitionV2, sourceId = drill.id) => {
    const result = upsertProjectDrill({ schemaVersion: 1, drills: current.current.customDrills.filter(item => item.id !== sourceId || item.id === drill.id) }, drill);
    commit(data => ({ ...data, customDrills: result.catalog.drills, hiddenDrills: data.hiddenDrills?.filter(id => id !== result.drill.id) })); return result.drill;
  };
  const deleteDrill = (id: string) => { commit(data => ({ ...data, customDrills: data.customDrills.filter(item => item.id !== id), hiddenDrills: [...new Set([...(data.hiddenDrills ?? []), id])] })); };
  const saveShot = (shot: SavedShotV2, sourceId = shot.id) => {
    const result = upsertProjectShot({ schemaVersion: 1, shots: current.current.savedShots.filter(item => item.id !== sourceId || item.id === shot.id) }, shot);
    commit(data => ({ ...data, savedShots: result.catalog.shots, hiddenShots: data.hiddenShots?.filter(id => id !== result.shot.id) })); return result.shot;
  };
  const deleteShot = (id: string, name?: string) => { commit(data => ({ ...data, savedShots: removeBrowserShot(data.savedShots, id, name), hiddenShots: [...new Set([...(data.hiddenShots ?? []), id])] })); };
  const clearDrillOverride = (drill: DrillDefinitionV2, sourceId = drill.id) => { commit(data => ({ ...data, customDrills: data.customDrills.filter(item => item.id !== sourceId && item.id !== drill.id && drillNameKey(item.title) !== drillNameKey(drill.title)), hiddenDrills: data.hiddenDrills?.filter(id => id !== drill.id) })); };
  const clearShotOverride = (shot: SavedShotV2, sourceId = shot.id) => { commit(data => ({ ...data, savedShots: data.savedShots.filter(item => item.id !== sourceId && item.id !== shot.id && shotNameKey(item.name) !== shotNameKey(shot.name)), hiddenShots: data.hiddenShots?.filter(id => id !== shot.id) })); };
  const saveDrillPlayerHand = useCallback((drillPlayerHand: AppDataV2['drillPlayerHand']) => { commit(data => ({ ...data, drillPlayerHand })); }, [commit]);
  const saveCameraPositionPreset = (preset: CameraPositionPresetV1) => {
    validateProjectConfigs({ schemaVersion: 1, practiceConfigs: {}, cameraPositionPresets: [preset], perspectivePresets: [] });
    commit(data => ({ ...data, cameraPresetOverrides: [...new Set([...browserPresetOverrides(data.cameraPositionPresets, DEFAULT_CAMERA_POSITION_PRESETS, data.cameraPresetOverrides).map(item => item.id), preset.id])], cameraPositionPresets: [...data.cameraPositionPresets.filter(item => item.id !== preset.id), preset] })); };
  const savePerspectivePreset = (preset: PerspectivePresetV1) => {
    validateProjectConfigs({ schemaVersion: 1, practiceConfigs: {}, cameraPositionPresets: [], perspectivePresets: [preset] });
    commit(data => ({ ...data, perspectivePresetOverrides: [...new Set([...browserPresetOverrides(data.perspectivePresets, DEFAULT_PERSPECTIVE_PRESETS, data.perspectivePresetOverrides).map(item => item.id), preset.id])], perspectivePresets: [...data.perspectivePresets.filter(item => item.id !== preset.id), preset] })); };
  const saveConfig = (value: PracticePreferencesV1) => {
    validatePracticeConfig(value);
    commit(data => ({ ...data, preferences: value, practiceConfigs: { ...data.practiceConfigs, [value.sessionCategory]: value } }));
  };
  const clearConfigOverride = (category: string) => { commit(data => { const configs = { ...data.practiceConfigs }; delete configs[category]; return { ...data, practiceConfigs: configs }; }); };
  const clearPresetOverride = (kind: 'position' | 'perspective', id: string) => { commit(data => kind === 'position'
    ? { ...data, cameraPresetOverrides: data.cameraPresetOverrides?.filter(value => value !== id), cameraPositionPresets: data.cameraPositionPresets.filter(item => item.id !== id) }
    : { ...data, perspectivePresetOverrides: data.perspectivePresetOverrides?.filter(value => value !== id), perspectivePresets: data.perspectivePresets.filter(item => item.id !== id) }); };
  const savePreferences = useCallback((value: Omit<PracticePreferencesV1, 'ballFocus'>) => setPreferences(current => ({ ...value, ballFocus: current.ballFocus })), []);
  const saveBallFocus = useCallback((ballFocus: BallFocusSettings) => setPreferences(current => ({ ...current, ballFocus: normalizeBallFocus(ballFocus) })), []);
  return { data: { ...stored, preferences }, saveDrill, deleteDrill, saveShot, deleteShot, saveCameraPositionPreset, savePerspectivePreset,
    savePreferences, saveBallFocus, saveDrillPlayerHand, saveConfig, clearConfigOverride, clearPresetOverride, clearDrillOverride, clearShotOverride };
};
