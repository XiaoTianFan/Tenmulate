import { lazy, Suspense, useState } from 'react';
import { DRILLS } from '../content/bundled';
import { createEditableCopy } from '../content/editing';
import type { DrillDefinitionV1 } from '../content/types';
import type { AppRoute } from '../components/AppHeader';
import { compileSession } from '../engine/session/compileSession';
import { useAppData } from '../hooks/useAppData';
import { createDefaultLaunch } from './defaults';
import type { SessionLaunch } from './types';

const SetupScreen = lazy(() => import('../components/SetupScreen').then((module) => ({ default: module.SetupScreen })));
const RehearsalScreen = lazy(() => import('../components/RehearsalScreen').then((module) => ({ default: module.RehearsalScreen })));
const DrillLibraryScreen = lazy(() => import('../components/DrillLibraryScreen').then((module) => ({ default: module.DrillLibraryScreen })));
const DrillEditorScreen = lazy(() => import('../components/DrillEditorScreen').then((module) => ({ default: module.DrillEditorScreen })));

const LoadingScreen = () => <main className="route-loading" aria-live="polite"><strong>Tenmulate</strong><span>Preparing court…</span></main>;

export function App() {
  const [route, setRoute] = useState<AppRoute>('practice');
  const [launch, setLaunch] = useState<SessionLaunch | null>(null);
  const [editorDrill, setEditorDrill] = useState<DrillDefinitionV1>(() => createEditableCopy(DRILLS[2]!));
  const appData = useAppData();

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
        onRun={(drill) => setLaunch(createDefaultLaunch(drill))}
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
        onRoute={setRoute}
        onSave={(drill) => { appData.saveDrill(drill); setEditorDrill(drill); }}
        onTest={(drill) => setLaunch(createDefaultLaunch(drill))}
      />
    </Suspense>;
  }

  return <Suspense fallback={<LoadingScreen />}>
    <SetupScreen
      route={route}
      savedViews={appData.data.savedViews}
      initialPreferences={appData.data.preferences}
      onRoute={setRoute}
      onStart={setLaunch}
      onSaveView={appData.saveView}
      onDeleteView={appData.deleteView}
      onRenameView={appData.renameView}
      onPreferencesChange={appData.savePreferences}
    />
  </Suspense>;
}
