import { useState } from 'react';
import { DRILLS } from '../content/bundled';
import { createEditableCopy } from '../content/editing';
import type { DrillDefinitionV1 } from '../content/types';
import { DrillEditorScreen } from '../components/DrillEditorScreen';
import { DrillLibraryScreen } from '../components/DrillLibraryScreen';
import { SetupScreen } from '../components/SetupScreen';
import { RehearsalScreen } from '../components/RehearsalScreen';
import type { AppRoute } from '../components/AppHeader';
import { compileSession } from '../engine/session/compileSession';
import { useAppData } from '../hooks/useAppData';
import { createDefaultLaunch } from './defaults';
import type { SessionLaunch } from './types';

export function App() {
  const [route, setRoute] = useState<AppRoute>('practice');
  const [launch, setLaunch] = useState<SessionLaunch | null>(null);
  const [editorDrill, setEditorDrill] = useState<DrillDefinitionV1>(() => createEditableCopy(DRILLS[2]!));
  const appData = useAppData();

  if (launch) {
    return (
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
    );
  }

  const editDrill = (drill: DrillDefinitionV1) => {
    setEditorDrill(drill);
    setRoute('editor');
  };

  if (route === 'drills') {
    return (
      <DrillLibraryScreen
        route={route}
        customDrills={appData.data.customDrills}
        onRoute={setRoute}
        onRun={(drill) => setLaunch(createDefaultLaunch(drill))}
        onEdit={editDrill}
        onSave={appData.saveDrill}
        onDelete={appData.deleteDrill}
      />
    );
  }

  if (route === 'editor') {
    return (
      <DrillEditorScreen
        key={editorDrill.id}
        route={route}
        initialDrill={editorDrill}
        onRoute={setRoute}
        onSave={(drill) => { appData.saveDrill(drill); setEditorDrill(drill); }}
        onTest={(drill) => setLaunch(createDefaultLaunch(drill))}
      />
    );
  }

  return (
    <SetupScreen
      route={route}
      savedViews={appData.data.savedViews}
      onRoute={setRoute}
      onStart={setLaunch}
      onSaveView={appData.saveView}
      onDeleteView={appData.deleteView}
      onRenameView={appData.renameView}
    />
  );
}
