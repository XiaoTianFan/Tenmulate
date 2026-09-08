import { createContext, useContext } from 'react';
import type { BallFocusSettings } from '../engine/rendering/ballFocus';

export const BallFocusContext = createContext<{
  settings: BallFocusSettings; onChange: (settings: BallFocusSettings) => void;
} | null>(null);

export function BallFocusControls() {
  const focus = useContext(BallFocusContext);
  if (!focus) return null;
  const { settings, onChange } = focus;
  return <div className="ball-focus-controls">
    <div className="toggle-field"><span>Ball highlight</span>
      <button type="button" role="switch" aria-label="Ball highlight"
        className={settings.enabled ? 'toggle active' : 'toggle'} aria-checked={settings.enabled}
        onClick={() => onChange({ ...settings, enabled: !settings.enabled })}><span /></button>
      <small>{settings.enabled ? 'On' : 'Off'}</small>
    </div>
  </div>;
}
