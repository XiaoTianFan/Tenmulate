import { useState } from 'react';
import { SetupScreen } from '../components/SetupScreen';
import { RehearsalScreen } from '../components/RehearsalScreen';
import type { AppRoute } from '../components/AppHeader';
import { compileSession } from '../engine/session/compileSession';
import type { SessionLaunch } from './types';

export function App() {
  const [route, setRoute] = useState<AppRoute>('practice');
  const [launch, setLaunch] = useState<SessionLaunch | null>(null);

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

  return <SetupScreen route={route} onRoute={setRoute} onStart={setLaunch} />;
}
