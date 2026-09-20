import { t, message as translateMessage } from '../i18n/locale';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { DrillDefinitionV2 } from '../content/types';
import { AppHeader, type AppRoute } from '../components/AppHeader';
import { compileSession } from '../engine/session/compileSession';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import { compilePlayerDrillAsync } from '../engine/session/playerDrillClient';
import { useAppData } from '../hooks/useAppData';
import { defaultDrillSettings } from './defaults';
import type { DrillPracticeSet } from './drillPracticeSet';
import { useLocale } from '../i18n/locale';
import { localizeDefaultDrill, localizeDefaultShot, localizeDefaultPreset, localizeDefaults } from '../i18n/content';
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
const loadRehearsal = () => import('../components/RehearsalScreen').then(module => ({ default: module.RehearsalScreen }));
const RehearsalScreen = lazy(loadRehearsal);
const DrillLibraryScreen = lazy(() => import('../components/DrillLibraryScreen').then(module => ({ default: module.DrillLibraryScreen })));
const DrillEditorScreen = lazy(() => import('../components/DrillEditorScreen').then(module => ({ default: module.DrillEditorScreen })));
const LoadingScreen = () => <main className="route-loading" aria-live="polite"><strong>Tenmulate</strong><span>{t("Preparing court…")}</span></main>;

export function App() {
  useLocale();
  const appData = useAppData();
  return <SharedCourtProvider environment={appData.data.preferences.environment} quality={appData.data.preferences.quality}
    ballFocus={appData.data.preferences.ballFocus} onBallFocusChange={appData.saveBallFocus}><AppRoutes appData={appData}/></SharedCourtProvider>;
}
function AppRoutes({ appData }: { appData: ReturnType<typeof useAppData> }) {
  const project = useProjectDrills();
  const projectShots = useProjectShots();
  const configs = useProjectConfigs(), saves = useSaveSystem();
  const rawDrills = mergeBrowserDrills(project.drills, appData.data.customDrills).filter(item => !appData.data.hiddenDrills?.includes(item.id));
  const rawShots = mergeBrowserShots(projectShots.shots, appData.data.savedShots).filter(item => !appData.data.hiddenShots?.includes(item.id));
  const projectIds = project.drills.filter(item => !appData.data.customDrills.some(override => override.id === item.id)).map(item => item.id);
  const projectShotIds = projectShots.shots.filter(item => !appData.data.savedShots.some(override => override.id === item.id)).map(item => item.id);
  const drills = localizeDefaults(rawDrills, projectIds, localizeDefaultDrill);
  const shots = localizeDefaults(rawShots, projectShotIds, localizeDefaultShot);
  const positionOverrides = browserPresetOverrides(appData.data.cameraPositionPresets, DEFAULT_CAMERA_POSITION_PRESETS, appData.data.cameraPresetOverrides);
  const perspectiveOverrides = browserPresetOverrides(appData.data.perspectivePresets, DEFAULT_PERSPECTIVE_PRESETS, appData.data.perspectivePresetOverrides);
  const defaultPositions = mergePresets(DEFAULT_CAMERA_POSITION_PRESETS, configs.snapshot.cameraPositionPresets);
  const defaultPerspectives = mergePresets(DEFAULT_PERSPECTIVE_PRESETS, configs.snapshot.perspectivePresets);
  const positions = localizeDefaults(mergePresets(defaultPositions, positionOverrides), defaultPositions.filter(preset => !positionOverrides.some(item => item.id === preset.id)).map(preset => preset.id), localizeDefaultPreset);
  const perspectives = localizeDefaults(mergePresets(defaultPerspectives, perspectiveOverrides), defaultPerspectives.filter(preset => !perspectiveOverrides.some(item => item.id === preset.id)).map(preset => preset.id), localizeDefaultPreset);
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
  const [editorDrill, setEditorDrill] = useState<DrillDefinitionV2 | null>(() => drafts.active()?.drill ?? null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(() => appStorageNotice() || null);
  const calculation = useRef<AbortController | null>(null);
  useEffect(() => { void loadRehearsal(); }, []);
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
  const prepareDrill = useCallback(async (drill: DrillDefinitionV2, rhythm: number, interval: number, movement: number, practiceSet: DrillPracticeSet, signal: AbortSignal) => {
    await compilePlayerDrillAsync(drill, { ...defaultDrillSettings(drill, rhythm, interval, movement, practiceSet), surface: appData.data.preferences.surface }, signal);
  }, [appData.data.preferences.surface]);
  const drillLaunch = async (drill: DrillDefinitionV2, { rhythm, interval, movement, rerun, trajectoryEnabled = false, practiceSet, defaultContent = false }: {
    rhythm?: number; interval?: number; movement?: number; rerun?: SessionLaunch; trajectoryEnabled?: boolean; practiceSet?: DrillPracticeSet; defaultContent?: boolean;
  } = {}) => {
    practiceAudio.unlock();
    calculation.current?.abort(); const controller = new AbortController(); calculation.current = controller; setBusy(true);
    try {
      const preferences = appData.data.preferences;
      const settings = rerun ? { ...rerun.session.settings, seed: String(Number(rerun.session.settings.seed || '0') + 1) }
        : { ...defaultDrillSettings(drill, rhythm, interval, movement, practiceSet), surface: preferences.surface };
      const session = await compilePlayerDrillAsync(drill, settings, controller.signal);
      if (controller.signal.aborted) return;
      if (session.planningIssues?.length) { setMessage(session.planningIssues.map(issue => issue.message).join('\n')); return; }
      setLaunch({ session, camera: drill.events[0]!.camera, environment: preferences.environment, quality: preferences.quality,
        defaultContent: rerun?.defaultContent ?? defaultContent, surface: settings.surface, trajectoryEnabled: rerun?.trajectoryEnabled ?? trajectoryEnabled });
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
        if (launch.session.drill.schemaVersion === 2) void drillLaunch(launch.session.drill, { rerun: launch });
        else setLaunch({ ...launch, session: compileSession(launch.session.drill, { ...launch.session.settings, seed: String(Number(launch.session.settings.seed || '0') + 1) }) });
      }}/>
      : route === 'drills' ? <DrillLibraryScreen environment={appData.data.preferences.environment} surface={appData.data.preferences.surface} route={route} drills={drills} projectIds={projectIds}
        projectStatus={storageStatus} writable={true} onRoute={navigate}
        playerHand={appData.data.drillPlayerHand} onPlayerHandChange={appData.saveDrillPlayerHand} onPrepare={prepareDrill}
        onRun={(drill, rhythm, interval, movement, practiceSet) => void drillLaunch(drill, { rhythm, interval, movement, practiceSet, defaultContent: projectIds.includes(drill.id) })} onEdit={editDrill} onSave={saveDrill}
        onDelete={async id => { if (import.meta.env.DEV && project.writable && projectIds.includes(id)) await project.remove(id); appData.deleteDrill(id); drafts.remove(id); }}/>
      : route === 'editor' ? editorDrill ? <DrillEditorScreen environment={appData.data.preferences.environment} key={editorDrill.id} route={route} launching={busy} initialDrill={editorDrill} initialPlayerHand={appData.data.drillPlayerHand} onPlayerHandChange={appData.saveDrillPlayerHand} surface={appData.data.preferences.surface}
        initialDraft={drafts.get(editorDrill.id)} onDraftChange={cacheDraft} writable={true} projectStatus={storageStatus}
        savedShots={shots} shotsWritable={true} shotsStatus={storageStatus}
        projectShotIds={projectShotIds} onSaveShot={saveShot}
        onDeleteShot={async id => { const shot = projectShots.shots.find(shot => shot.id === id) ?? appData.data.savedShots.find(shot => shot.id === id);
          if (import.meta.env.DEV && projectShots.writable && projectShotIds.includes(id)) await projectShots.remove(id); appData.deleteShot(id, shot?.name); }} onRoute={navigate}
        onSave={saveDrill} onTest={(drill, trajectoryEnabled) => { void drillLaunch(drill, { trajectoryEnabled }); }}/>
      : <main className="app-shell editor-empty-shell">
        <AppHeader route={route} onRoute={navigate}/>
        <section className="editor-empty-state">
          <h1>{t('No drill open')}</h1>
          <p>{t('Open a drill or create a new one from the Drills page to start editing.')}</p>
          <button type="button" className="primary-button inline" onClick={() => navigate('drills')}>{t('Go to Drills')}</button>
        </section>
      </main>
      : <SetupScreen route={route} cameraPositionPresets={positions} perspectivePresets={perspectives}
        initialPreferences={appData.data.preferences} onRoute={navigate} onStart={setLaunch} onSaveCameraPositionPreset={savePosition}
        onSavePerspectivePreset={savePerspective} onSaveConfig={saveConfig} onRestoreBallFocus={appData.saveBallFocus} projectPracticeConfigs={configs.snapshot.practiceConfigs} practiceConfigs={{ ...configs.snapshot.practiceConfigs, ...appData.data.practiceConfigs }} onPreferencesChange={appData.savePreferences}/>}
    </Suspense>
    {saves.ui}
    {busy ? <Modal title={t("Preparing drill")} onClose={cancel} actions={<button type="button" className="secondary-button" onClick={cancel}>{t("Cancel")}</button>}><p role="status">{t("Connecting your shots, opponent returns and camera movement…")}</p></Modal> : null}
    {message ? <Modal title={t("Drill planning")} onClose={() => setMessage(null)} actions={<button type="button" className="primary-button inline" onClick={() => setMessage(null)}>{t("Close")}</button>}><p className="drill-planning-message">{translateMessage(message)}</p></Modal> : null}
  </>;
}
