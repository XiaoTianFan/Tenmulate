import { lazy, Suspense, useState } from 'react';
import { DRILLS } from '../content/bundled';
import { createEditableCopy } from '../content/editing';
import type { DrillDefinitionV1 } from '../content/types';
import type { AppRoute } from '../components/AppHeader';
import { compileSession } from '../engine/session/compileSession';
import { useAppData } from '../hooks/useAppData';
import { createDefaultLaunch } from './defaults';
import type { SessionLaunch } from './types';
import { SharedCourtProvider } from '../components/SharedCourt';

const SetupScreen = lazy(() => import('../components/SetupScreen').then((module) => ({ default: module.SetupScreen })));
const RehearsalScreen = lazy(() => import('../components/RehearsalScreen').then((module) => ({ default: module.RehearsalScreen })));
const DrillLibraryScreen = lazy(() => import('../components/DrillLibraryScreen').then((module) => ({ default: module.DrillLibraryScreen })));
const DrillEditorScreen = lazy(() => import('../components/DrillEditorScreen').then((module) => ({ default: module.DrillEditorScreen })));

const LoadingScreen = () => <main className="route-loading" aria-live="polite"><strong>Tenmulate</strong><span>Preparing court…</span></main>;

export function App() {
  const appData = useAppData();
  return <SharedCourtProvider environment={appData.data.preferences.environment} quality={appData.data.preferences.quality}
    ballFocus={appData.data.preferences.ballFocus} onBallFocusChange={appData.saveBallFocus}>
    <AppRoutes appData={appData} />
  </SharedCourtProvider>;
}

function AppRoutes({ appData }: { appData: ReturnType<typeof useAppData> }) {
  const [route, setRoute] = useState<AppRoute>('practice');
  const [launch, setLaunch] = useState<SessionLaunch | null>(null);
  const [editorDrill, setEditorDrill] = useState<DrillDefinitionV1>(() => createEditableCopy(DRILLS[2]!));
  const drillLaunch = (drill: DrillDefinitionV1, rhythm?: number, interval?: number, movement?: number): SessionLaunch => ({
    ...createDefaultLaunch(drill, rhythm, interval, movement),
    environment: appData.data.preferences.environment, quality: appData.data.preferences.quality,
  });

  if (launch) {
    return <Suspense fallback={<LoadingScreen />}>
      <RehearsalScreen
        launch={launch}
        onExit={() => setLaunch(null)}
        onRandomize={() => setLaunch((current) => current ? {
          ...current,
          session: compileSession(current.session.drill, {
            ...current.session.settings,
            seed: String(Number(current.session.settings.seed || '0') + 1),
          }),
        } : current)}
      />
    </Suspense>;
  }

  const editDrill = (drill: DrillDefinitionV1) => {
    setEditorDrill(drill);
    setRoute('editor');
  };

  if (route === 'drills') {
    return <Suspense fallback={<LoadingScreen />}>
      <DrillLibraryScreen
        route={route}
        customDrills={appData.data.customDrills}
        onRoute={setRoute}
        onRun={(drill, rhythm, interval, movement) => setLaunch(drillLaunch(drill, rhythm, interval, movement))}
        onEdit={editDrill}
        onSave={appData.saveDrill}
        onDelete={appData.deleteDrill}
      />
    </Suspense>;
  }

  if (route === 'editor') {
    return <Suspense fallback={<LoadingScreen />}>
      <DrillEditorScreen
        key={editorDrill.id}
        route={route}
        initialDrill={editorDrill}
        savedShots={appData.data.savedShots}
        onSaveShot={appData.saveShot}
        onDeleteShot={appData.deleteShot}
        onRoute={setRoute}
        onSave={(drill) => { appData.saveDrill(drill); setEditorDrill(drill); }}
        onTest={(drill) => { setEditorDrill(drill); setLaunch(drillLaunch(drill)); }}
      />
    </Suspense>;
  }

  return <Suspense fallback={<LoadingScreen />}>
    <SetupScreen
      route={route}
      cameraPositionPresets={appData.data.cameraPositionPresets}
      perspectivePresets={appData.data.perspectivePresets}
      initialPreferences={appData.data.preferences}
      onRoute={setRoute}
      onStart={setLaunch}
      onSaveCameraPositionPreset={appData.saveCameraPositionPreset}
      onSavePerspectivePreset={appData.savePerspectivePreset}
      onPreferencesChange={appData.savePreferences}
    />
  </Suspense>;
}
