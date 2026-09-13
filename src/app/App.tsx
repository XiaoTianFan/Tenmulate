import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER_DRILLS } from '../content/playerDrills';
import { copyPlayerDrill } from '../content/playerMigration';
import type { DrillDefinitionV2 } from '../content/types';
import type { AppRoute } from '../components/AppHeader';
import { compileSession } from '../engine/session/compileSession';
import { compilePlayerDrillAsync } from '../engine/session/playerDrillClient';
import { useAppData } from '../hooks/useAppData';
import { defaultDrillSettings } from './defaults';
import type { SessionLaunch } from './types';
import { SharedCourtProvider } from '../components/SharedCourt';
import { Modal } from '../components/Modal';
import { appStorageNotice } from '../storage/appStorage';
import { useProjectDrills } from '../hooks/useProjectDrills';
import { createEditorDraftCache, reconcileEditorDraft, type EditorDraft } from '../storage/editorDrafts';
import { upsertProjectDrill, mergeBrowserDrills } from '../storage/projectCatalog';
import { useProjectShots } from '../hooks/useProjectShots';
import { upsertProjectShot, mergeBrowserShots } from '../storage/projectShots';

import { useSaveSystem } from '../hooks/useSaveSystem';
import { useProjectConfigs } from '../hooks/useProjectConfigs';
import { DEFAULT_CAMERA_POSITION_PRESETS, DEFAULT_PERSPECTIVE_PRESETS, browserPresetOverrides, mergePresets } from '../storage/appStorage';

const SetupScreen = lazy(() => import('../components/SetupScreen').then(module => ({ default: module.SetupScreen })));
const RehearsalScreen = lazy(() => import('../components/RehearsalScreen').then(module => ({ default: module.RehearsalScreen })));
const DrillLibraryScreen = lazy(() => import('../components/DrillLibraryScreen').then(module => ({ default: module.DrillLibraryScreen })));
const DrillEditorScreen = lazy(() => import('../components/DrillEditorScreen').then(module => ({ default: module.DrillEditorScreen })));
const LoadingScreen = () => <main className="route-loading" aria-live="polite"><strong>Tenmulate</strong><span>Preparing court…</span></main>;

export function App() {
  const appData = useAppData();
  return <SharedCourtProvider environment={appData.data.preferences.environment} quality={appData.data.preferences.quality}
    ballFocus={appData.data.preferences.ballFocus} onBallFocusChange={appData.saveBallFocus}><AppRoutes appData={appData}/></SharedCourtProvider>;
}
function AppRoutes({ appData }: { appData: ReturnType<typeof useAppData> }) {
  const project = useProjectDrills();
  const projectShots = useProjectShots();
  const configs = useProjectConfigs(), saves = useSaveSystem();
  const drills = mergeBrowserDrills(project.drills, appData.data.customDrills).filter(item => !appData.data.hiddenDrills?.includes(item.id));
  const shots = mergeBrowserShots(projectShots.shots, appData.data.savedShots).filter(item => !appData.data.hiddenShots?.includes(item.id));
  const projectIds = project.drills.filter(item => !appData.data.customDrills.some(override => override.id === item.id)).map(item => item.id);
  const projectShotIds = projectShots.shots.filter(item => !appData.data.savedShots.some(override => override.id === item.id)).map(item => item.id);
  const clearBrowserAfterProject = (clear: () => void) => {
    try { clear(); } catch { throw new Error('The project default was saved, but its browser override could not be cleared. Allow browser storage and retry to make the project version visible here.'); }
  };
  const saveDrill = (drill: DrillDefinitionV2) => saves.run('Drill', project.writable, {
    browser: () => appData.saveDrill(upsertProjectDrill({ schemaVersion: 1, drills: [...drills] }, drill).drill, drill.id),
    project: async () => { const result = await project.save(drill); clearBrowserAfterProject(() => appData.clearDrillOverride(result, drill.id)); return result; },
  });
  const saveShot = (shot: import('../content/types').SavedShotV2, targetId?: string) => saves.run('Shot', projectShots.writable, {
    browser: () => appData.saveShot(upsertProjectShot({ schemaVersion: 1, shots: [...shots] }, shot, targetId).shot, shot.id),
    project: async () => { const result = await projectShots.save(shot, projectShots.shots.some(item => item.id === targetId) ? targetId : undefined); clearBrowserAfterProject(() => appData.clearShotOverride(result, shot.id)); return result; },
  });
  const saveConfig = (value: Omit<import('../storage/appStorage').PracticePreferencesV1, 'ballFocus'>) => {
    const config = { ...value, ballFocus: appData.data.preferences.ballFocus };
    return saves.run('Config', configs.writable, { browser: () => appData.saveConfig(config),
      project: async () => { await configs.save({ kind: 'practice', value: config }); clearBrowserAfterProject(() => appData.clearConfigOverride(config.sessionCategory)); } });
  };
  const savePosition = (value: import('../storage/appStorage').CameraPositionPresetV1) => saves.run('Camera preset', configs.writable, {
    browser: () => appData.saveCameraPositionPreset(value), project: async () => { await configs.save({ kind: 'position', value }); clearBrowserAfterProject(() => appData.clearPresetOverride('position', value.id)); },
  });
  const savePerspective = (value: import('../storage/appStorage').PerspectivePresetV1) => saves.run('Perspective preset', configs.writable, {
    browser: () => appData.savePerspectivePreset(value), project: async () => { await configs.save({ kind: 'perspective', value }); clearBrowserAfterProject(() => appData.clearPresetOverride('perspective', value.id)); },
  });
  const storageStatus = import.meta.env.DEV ? 'Choose where to save: project default or this browser.' : 'Saves stay in this browser on this device.';

  const [drafts] = useState(() => {
    try { return createEditorDraftCache(window.localStorage); } catch { return createEditorDraftCache(); }
  });
  const [route, setRoute] = useState<AppRoute>('practice');
  const [launch, setLaunch] = useState<SessionLaunch | null>(null);
  const [editorDrill, setEditorDrill] = useState<DrillDefinitionV2>(() => drafts.active()?.drill ?? copyPlayerDrill(PLAYER_DRILLS[2]!));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(() => appStorageNotice() || null);
  const calculation = useRef<AbortController | null>(null);
  useEffect(() => () => calculation.current?.abort(), []);
  useEffect(() => {
    const flush = () => { drafts.flush(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [drafts]);
  const cacheDraft = useCallback((draft: EditorDraft, previousId?: string) => { drafts.put(draft, previousId); }, [drafts]);
  const navigate = (next: AppRoute) => {
    drafts.flush();
    if (next === 'editor') {
      void projectShots.refresh();
      const active = drafts.active();
      if (active) { const restored = reconcileEditorDraft(active, drills.find(drill => drill.id === active.drill.id)); drafts.put(restored); setEditorDrill(restored.drill); }
    }
    if (next === 'drills') void project.refresh();
    setRoute(next);
  };
  const cancel = () => { calculation.current?.abort(); setBusy(false); };
  const drillLaunch = async (drill: DrillDefinitionV2, rhythm?: number, interval?: number, movement?: number, rerun?: SessionLaunch, trajectoryEnabled = false) => {
    calculation.current?.abort(); const controller = new AbortController(); calculation.current = controller; setBusy(true);
    try {
      const preferences = appData.data.preferences;
      const settings = rerun ? { ...rerun.session.settings, seed: String(Number(rerun.session.settings.seed || '0') + 1) }
        : { ...defaultDrillSettings(drill, rhythm, interval, movement), surface: preferences.surface };
      const session = await compilePlayerDrillAsync(drill, settings, controller.signal);
      if (session.planningIssues?.length) { setMessage(session.planningIssues.map(issue => issue.message).join('\n')); return; }
      setLaunch({ session, camera: drill.events[0]!.camera, environment: preferences.environment, quality: preferences.quality,
        surface: settings.surface, trajectoryEnabled: rerun?.trajectoryEnabled ?? trajectoryEnabled });
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Unable to prepare drill.'); }
    finally { if (calculation.current === controller) setBusy(false); }
  };
  const editDrill = (drill: DrillDefinitionV2) => {
    const cached = drafts.get(drill.id), restored = cached && reconcileEditorDraft(cached, drill);
    if (restored) drafts.put(restored);
    setEditorDrill(restored?.drill ?? drill); setRoute('editor');
  };
  return <>
    <Suspense fallback={<LoadingScreen/>}>
      {launch ? <RehearsalScreen launch={launch} onExit={() => { if (route === 'editor') setEditorDrill(drafts.active()?.drill ?? editorDrill); setLaunch(null); }} onRandomize={() => {
        if (launch.session.drill.schemaVersion === 2) void drillLaunch(launch.session.drill, undefined, undefined, undefined, launch);
        else setLaunch({ ...launch, session: compileSession(launch.session.drill, { ...launch.session.settings, seed: String(Number(launch.session.settings.seed || '0') + 1) }) });
      }}/>
      : route === 'drills' ? <DrillLibraryScreen route={route} drills={drills} projectIds={projectIds}
        projectStatus={storageStatus} writable={true} onRoute={navigate}
        playerHand={appData.data.drillPlayerHand} onPlayerHandChange={appData.saveDrillPlayerHand}
        onRun={(drill, rhythm, interval, movement) => void drillLaunch(drill, rhythm, interval, movement)} onEdit={editDrill} onSave={saveDrill}
        onDelete={async id => { if (import.meta.env.DEV && project.writable && projectIds.includes(id)) await project.remove(id); appData.deleteDrill(id); drafts.remove(id); }}/>
      : route === 'editor' ? <DrillEditorScreen key={editorDrill.id} route={route} initialDrill={editorDrill} initialPlayerHand={appData.data.drillPlayerHand} onPlayerHandChange={appData.saveDrillPlayerHand} surface={appData.data.preferences.surface}
        initialDraft={drafts.get(editorDrill.id)} onDraftChange={cacheDraft} writable={true} projectStatus={storageStatus}
        savedShots={shots} shotsWritable={true} shotsStatus={storageStatus}
        projectShotIds={projectShotIds} onSaveShot={saveShot}
        onDeleteShot={async id => { const shot = projectShots.shots.find(shot => shot.id === id) ?? appData.data.savedShots.find(shot => shot.id === id);
          if (import.meta.env.DEV && projectShots.writable && projectShotIds.includes(id)) await projectShots.remove(id); appData.deleteShot(id, shot?.name); }} onRoute={navigate}
        onSave={saveDrill} onTest={(drill, trajectoryEnabled) => { void drillLaunch(drill, undefined, undefined, undefined, undefined, trajectoryEnabled); }}/>
      : <SetupScreen route={route} cameraPositionPresets={mergePresets(mergePresets(DEFAULT_CAMERA_POSITION_PRESETS, configs.snapshot.cameraPositionPresets), browserPresetOverrides(appData.data.cameraPositionPresets, DEFAULT_CAMERA_POSITION_PRESETS, appData.data.cameraPresetOverrides))} perspectivePresets={mergePresets(mergePresets(DEFAULT_PERSPECTIVE_PRESETS, configs.snapshot.perspectivePresets), browserPresetOverrides(appData.data.perspectivePresets, DEFAULT_PERSPECTIVE_PRESETS, appData.data.perspectivePresetOverrides))}
        initialPreferences={appData.data.preferences} onRoute={navigate} onStart={setLaunch} onSaveCameraPositionPreset={savePosition}
        onSavePerspectivePreset={savePerspective} onSaveConfig={saveConfig} onRestoreBallFocus={appData.saveBallFocus} practiceConfigs={{ ...configs.snapshot.practiceConfigs, ...appData.data.practiceConfigs }} onPreferencesChange={appData.savePreferences}/>}
    </Suspense>
    {saves.ui}
    {busy ? <Modal title="Preparing drill" onClose={cancel} actions={<button type="button" className="secondary-button" onClick={cancel}>Cancel</button>}><p role="status">Connecting your shots, opponent returns and camera movement…</p></Modal> : null}
    {message ? <Modal title="Drill planning" onClose={() => setMessage(null)} actions={<button type="button" className="primary-button inline" onClick={() => setMessage(null)}>Close</button>}><p className="drill-planning-message">{message}</p></Modal> : null}
  </>;
}
