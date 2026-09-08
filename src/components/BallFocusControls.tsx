import { createContext, useContext, useId } from 'react';
import { MAX_BALL_FOCUS_BLUR_PX, type BallFocusSettings } from '../engine/rendering/ballFocus';

export const BallFocusContext = createContext<{
  settings: BallFocusSettings; onChange: (settings: BallFocusSettings) => void;
} | null>(null);

export function BallFocusControls() {
  const focus = useContext(BallFocusContext), id = useId();
  if (!focus) return null;
  const { settings, onChange } = focus;
  return <div className="ball-focus-controls">
    <div className="toggle-field"><span>Ball focus</span>
      <button type="button" role="switch" aria-label="Ball focus" aria-controls={settings.enabled ? id : undefined}
        className={settings.enabled ? 'toggle active' : 'toggle'} aria-checked={settings.enabled}
        onClick={() => onChange({ ...settings, enabled: !settings.enabled })}><span /></button>
      <small>{settings.enabled ? 'On' : 'Off'}</small>
    </div>
    {settings.enabled ? <label id={id} className="range-field"><span>Maximum blur</span>
      <input aria-label="Maximum blur" type="range" min={0} max={MAX_BALL_FOCUS_BLUR_PX} step={.1}
        value={settings.maxBlurPx} onChange={event => onChange({ ...settings, maxBlurPx: Number(event.target.value) })} />
      <output>{settings.maxBlurPx.toFixed(1)}</output><small>px</small>
    </label> : null}
  </div>;
}
