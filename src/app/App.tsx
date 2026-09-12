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
import { mergeBrowserDrills } from '../storage/projectCatalog';
import { useProjectShots } from '../hooks/useProjectShots';
import { mergeBrowserShots } from '../storage/projectShots';

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
      if (active) { const restored = reconcileEditorDraft(active, project.drills.find(drill => drill.id === active.drill.id)); drafts.put(restored); setEditorDrill(restored.drill); }
    }
    if (next === 'drills') void project.refresh();
    setRoute(next);
  };
  const cancel = () => { calculation.current?.abort(); setBusy(false); };
  const drillLaunch = async (drill: DrillDefinitionV2, rhythm?: number, interval?: number, movement?: number, rerun?: SessionLaunch) => {
    calculation.current?.abort(); const controller = new AbortController(); calculation.current = controller; setBusy(true);
    try {
      const preferences = appData.data.preferences;
      const settings = rerun ? { ...rerun.session.settings, seed: String(Number(rerun.session.settings.seed || '0') + 1) }
        : { ...defaultDrillSettings(drill, rhythm, interval, movement), surface: preferences.surface };
      const session = await compilePlayerDrillAsync(drill, settings, controller.signal);
      if (session.planningIssues?.length) { setMessage(session.planningIssues.map(issue => issue.message).join('\n')); return; }
      setLaunch({ session, camera: drill.events[0]!.camera, environment: preferences.environment, quality: preferences.quality,
        surface: settings.surface, trajectoryEnabled: false });
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
      : route === 'drills' ? <DrillLibraryScreen route={route} drills={mergeBrowserDrills(project.drills, appData.data.customDrills)} projectIds={project.drills.map(drill => drill.id)}
        projectStatus={project.status} writable={project.writable} onRoute={navigate}
        playerHand={appData.data.drillPlayerHand} onPlayerHandChange={appData.saveDrillPlayerHand}
        onRun={(drill, rhythm, interval, movement) => void drillLaunch(drill, rhythm, interval, movement)} onEdit={editDrill} onSave={project.save}
        onDelete={async id => { if (project.drills.some(drill => drill.id === id)) await project.remove(id); appData.deleteDrill(id); drafts.remove(id); }}/>
      : route === 'editor' ? <DrillEditorScreen key={editorDrill.id} route={route} initialDrill={editorDrill} initialPlayerHand={appData.data.drillPlayerHand} onPlayerHandChange={appData.saveDrillPlayerHand} surface={appData.data.preferences.surface}
        initialDraft={drafts.get(editorDrill.id)} onDraftChange={cacheDraft} writable={project.writable} projectStatus={project.status}
        savedShots={mergeBrowserShots(projectShots.shots, appData.data.savedShots)} shotsWritable={projectShots.writable} shotsStatus={projectShots.status}
        projectShotIds={projectShots.shots.map(shot => shot.id)} onSaveShot={projectShots.save}
        onDeleteShot={async id => { const shot = projectShots.shots.find(shot => shot.id === id) ?? appData.data.savedShots.find(shot => shot.id === id);
          if (projectShots.shots.some(shot => shot.id === id)) await projectShots.remove(id); appData.deleteShot(id, shot?.name); }} onRoute={navigate}
        onSave={project.save} onTest={drill => { void drillLaunch(drill); }}/>
      : <SetupScreen route={route} cameraPositionPresets={appData.data.cameraPositionPresets} perspectivePresets={appData.data.perspectivePresets}
        initialPreferences={appData.data.preferences} onRoute={navigate} onStart={setLaunch} onSaveCameraPositionPreset={appData.saveCameraPositionPreset}
        onSavePerspectivePreset={appData.savePerspectivePreset} onPreferencesChange={appData.savePreferences}/>}
    </Suspense>
    {busy ? <Modal title="Preparing drill" onClose={cancel} actions={<button type="button" className="secondary-button" onClick={cancel}>Cancel</button>}><p role="status">Connecting your shots, opponent returns and camera movement…</p></Modal> : null}
    {message ? <Modal title="Drill planning" onClose={() => setMessage(null)} actions={<button type="button" className="primary-button inline" onClick={() => setMessage(null)}>Close</button>}><p className="drill-planning-message">{message}</p></Modal> : null}
  </>;
}
