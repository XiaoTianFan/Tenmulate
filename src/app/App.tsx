import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
  const [route, setRoute] = useState<AppRoute>('practice');
  const [launch, setLaunch] = useState<SessionLaunch | null>(null);
  const [editorDrill, setEditorDrill] = useState<DrillDefinitionV2>(() => copyPlayerDrill(PLAYER_DRILLS[2]!));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(() => appStorageNotice() || null);
  const calculation = useRef<AbortController | null>(null);
  useEffect(() => () => calculation.current?.abort(), []);
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
  const editDrill = (drill: DrillDefinitionV2) => { setEditorDrill(drill); setRoute('editor'); };
  return <>
    <Suspense fallback={<LoadingScreen/>}>
      {launch ? <RehearsalScreen launch={launch} onExit={() => setLaunch(null)} onRandomize={() => {
        if (launch.session.drill.schemaVersion === 2) void drillLaunch(launch.session.drill, undefined, undefined, undefined, launch);
        else setLaunch({ ...launch, session: compileSession(launch.session.drill, { ...launch.session.settings, seed: String(Number(launch.session.settings.seed || '0') + 1) }) });
      }}/>
      : route === 'drills' ? <DrillLibraryScreen route={route} customDrills={appData.data.customDrills} onRoute={setRoute}
        onRun={(drill, rhythm, interval, movement) => void drillLaunch(drill, rhythm, interval, movement)} onEdit={editDrill} onSave={appData.saveDrill} onDelete={appData.deleteDrill}/>
      : route === 'editor' ? <DrillEditorScreen key={editorDrill.id} route={route} initialDrill={editorDrill} surface={appData.data.preferences.surface}
        savedShots={appData.data.savedShots} onSaveShot={appData.saveShot} onDeleteShot={appData.deleteShot} onRoute={setRoute}
        onSave={drill => { appData.saveDrill(drill); setEditorDrill(drill); }} onTest={drill => { setEditorDrill(drill); void drillLaunch(drill); }}/>
      : <SetupScreen route={route} cameraPositionPresets={appData.data.cameraPositionPresets} perspectivePresets={appData.data.perspectivePresets}
        initialPreferences={appData.data.preferences} onRoute={setRoute} onStart={setLaunch} onSaveCameraPositionPreset={appData.saveCameraPositionPreset}
        onSavePerspectivePreset={appData.savePerspectivePreset} onPreferencesChange={appData.savePreferences}/>}
    </Suspense>
    {busy ? <Modal title="Preparing drill" onClose={cancel} actions={<button type="button" className="secondary-button" onClick={cancel}>Cancel</button>}><p role="status">Connecting your shots, opponent returns and camera movement…</p></Modal> : null}
    {message ? <Modal title="Drill planning" onClose={() => setMessage(null)} actions={<button type="button" className="primary-button inline" onClick={() => setMessage(null)}>Close</button>}><p className="drill-planning-message">{message}</p></Modal> : null}
  </>;
}
