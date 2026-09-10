import type { CameraFocusTarget, CameraMoveMoment, DrillCameraTransition } from '../content/types';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { COURT } from '../domain/court';
import { EditorNumber } from './DrillShotControls';

type Props = {
  configuration?: DrillCameraTransition; camera: CameraConfiguration; captureEnabled: boolean;
  onChange: (value: DrillCameraTransition | undefined) => void; onView: (camera: CameraConfiguration) => void;
  onPreview: () => void; previewDisabled: boolean;
};
const MOMENTS: [CameraMoveMoment, string][] = [['auto', 'Automatic'], ['player-hit', 'After my shot'],
  ['opponent-hit', 'At opponent contact'], ['after-split', 'After the split step']];
const FOCUS: [CameraFocusTarget['mode'], string][] = [['auto', 'Automatic'], ['ball', 'Ball only'], ['opponent', 'Opponent only'],
  ['next-shot', 'Next shot direction'], ['direction', 'Fixed direction'], ['point', 'Court point']];
const position = ({ lateral, behindBaseline, eyeHeight }: CameraConfiguration) => ({ lateral, behindBaseline, eyeHeight });
const direction = ({ yaw, pitch }: CameraConfiguration) => ({ yaw, pitch });
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
/** A view ray projected to court height; level/upward views use a point 12 m ahead. */
function viewPoint(camera: CameraConfiguration) {
  const yaw = camera.yaw * Math.PI / 180, pitch = camera.pitch * Math.PI / 180;
  const distance = Math.sin(pitch) < -.05 ? Math.min(35, camera.eyeHeight / -Math.sin(pitch)) : 12;
  return { x: clamp(camera.lateral + Math.sin(yaw) * Math.cos(pitch) * distance, -12, 12), y: 0,
    z: clamp(-COURT.halfLength - camera.behindBaseline + Math.cos(yaw) * Math.cos(pitch) * distance, -20, 20) };
}

export function CameraTransitionControls({ configuration, camera, captureEnabled, onChange, onView, onPreview, previewDisabled }: Props) {
  const movement = configuration?.movement ?? { destination: 'auto' as const };
  const updateMovement = (patch: Partial<NonNullable<DrillCameraTransition['movement']>>) =>
    onChange({ ...configuration, movement: { ...movement, ...patch } });
  const moment = (label: string, value: CameraMoveMoment | undefined, change: (value: CameraMoveMoment) => void) =>
    <label className="stack-field"><span>{label}</span><select aria-label={label} value={value ?? 'auto'} onChange={event => change(event.target.value as CameraMoveMoment)}>
      {MOMENTS.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select></label>;
  return <div className="camera-transition-controls">
    <p className="camera-authoring-hint">Use WASD to move, drag to look, and wheel to zoom. Capture a position or direction below. Zoom applies to the whole drill.</p>
    <details className="editor-section" open><summary>Movement</summary>
      <label className="stack-field"><span>Movement route</span><select aria-label="Movement route" value={movement.destination} onChange={e => {
        const destination = e.target.value as typeof movement.destination;
        updateMovement({ destination, ...(destination === 'waypoint' && !movement.waypoint ? { waypoint: position(camera) } : {}) });
      }}><option value="auto">Automatic</option><option value="neutral">Recover to neutral</option><option value="next-shot">Direct to next shot</option><option value="waypoint">Via a custom position</option></select></label>
      {movement.destination === 'auto' ? <small>Recover, split, then receive. Tactical approaches may advance before the opponent hits.</small> : <>
        {moment('Start movement', movement.start, start => updateMovement({ start }))}
        <EditorNumber label="Start delay (s)" value={movement.delaySeconds ?? 0} min={0} max={2} step={.05} onChange={delaySeconds => updateMovement({ delaySeconds })}/>
        {movement.destination !== 'next-shot' ? <>
          {moment('Continue to next shot', movement.resume, resume => updateMovement({ resume }))}
          <EditorNumber label="Continue delay (s)" value={movement.resumeDelaySeconds ?? 0} min={0} max={2} step={.05} onChange={resumeDelaySeconds => updateMovement({ resumeDelaySeconds })}/>
        </> : null}
        <label className="camera-auto-pace"><input type="checkbox" checked={movement.pacePercent === undefined} onChange={e => updateMovement({ pacePercent: e.target.checked ? undefined : 100 })}/> Automatic movement pace</label>
        {movement.pacePercent !== undefined ? <EditorNumber label="Transition pace (%)" value={movement.pacePercent} min={50} max={200} step={5} onChange={pacePercent => updateMovement({ pacePercent })}/> : null}
        {movement.destination === 'waypoint' ? <>
          <div className="camera-capture-actions"><button type="button" className="secondary-button" disabled={!captureEnabled} onClick={() => updateMovement({ waypoint: position(camera) })}>Capture position</button>
            <button type="button" className="secondary-button" onClick={() => onView({ ...camera, ...movement.waypoint })}>View saved position</button></div>
          <output className="camera-capture-value" aria-label="Saved intermediate position">{movement.waypoint?.lateral.toFixed(2)} m sideways · {movement.waypoint?.behindBaseline.toFixed(2)} m behind baseline · {movement.waypoint?.eyeHeight.toFixed(2)} m eye height</output>
        </> : null}
        <small>Automatic timing starts recovery after your shot and continues after the split step. Direct travel starts after the split. The next shot’s contact view remains the destination.</small>
      </>}
    </details>
    <details className="editor-section" open><summary>Focus</summary>
      {(['beforeReturn', 'afterReturn'] as const).map(phase => {
        const label = phase === 'beforeReturn' ? 'Before opponent contact' : 'After opponent contact';
        const value = configuration?.focus?.[phase] ?? { mode: 'auto' as const };
        const change = (patch: Partial<CameraFocusTarget>) => onChange({ ...configuration,
          focus: { ...configuration?.focus, [phase]: { ...value, ...patch } } });
        return <div className="camera-focus-phase" key={phase}>
          <label className="stack-field"><span>{label}</span><select aria-label={label} value={value.mode} onChange={e => {
            const mode = e.target.value as CameraFocusTarget['mode'];
            change({ mode, ...(mode === 'direction' && !value.direction ? { direction: direction(camera) } : {}),
              ...(mode === 'point' && !value.point ? { point: viewPoint(camera) } : {}) });
          }}>{FOCUS.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
          {value.mode === 'direction' ? <>
            <div className="camera-capture-actions"><button type="button" className="secondary-button" disabled={!captureEnabled} onClick={() => change({ direction: direction(camera) })}>Capture {phase === 'beforeReturn' ? 'before' : 'after'} direction</button>
              <button type="button" className="secondary-button" onClick={() => onView({ ...camera, ...value.direction })}>View saved direction</button></div>
            <output className="camera-capture-value">Yaw {value.direction?.yaw.toFixed(1)}° · Pitch {value.direction?.pitch.toFixed(1)}°</output>
          </> : value.mode === 'point' ? <>
            <button type="button" className="secondary-button full-width" disabled={!captureEnabled} onClick={() => change({ point: viewPoint(camera) })}>Capture {phase === 'beforeReturn' ? 'before' : 'after'} view center</button>
            {(['x', 'y', 'z'] as const).map(axis => <EditorNumber key={axis} label={`${label} target ${axis} (m)`} value={value.point?.[axis] ?? 0}
              min={axis === 'y' ? 0 : axis === 'x' ? -12 : -20} max={axis === 'y' ? 8 : axis === 'x' ? 12 : 20} step={.1}
              onChange={n => change({ point: { x: 0, y: 0, z: 0, ...value.point, [axis]: n } })}/>)}
          </> : null}
        </div>;
      })}
      <small>Focus changes blend at opponent contact and settle into your next shot’s saved direction before you hit. Automatic keeps the opponent in context; Ball only follows the ball freely.</small>
    </details>
    {!captureEnabled ? <p className="camera-authoring-hint">Return to shot view and stop playback to capture a view.</p> : null}
    <div className="camera-capture-actions"><button type="button" className="secondary-button" onClick={() => onChange(undefined)}>Reset to automatic</button>
      <button type="button" className="secondary-button" disabled={previewDisabled} onClick={onPreview}>Preview this transition</button></div>
  </div>;
}
