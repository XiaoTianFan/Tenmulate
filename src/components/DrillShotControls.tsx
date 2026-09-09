import { RangeField } from './RangeField';
import { BallFocusControls } from './BallFocusControls';
import type { DrillDefinitionV1, DrillEventV1, ReturnShotType, ShotDefinitionV1 } from '../content/types';
import { SHOTS, drillShotPace } from '../content/bundled';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { DEFAULT_CAMERA_POSITION_PRESETS } from '../storage/appStorage';
import { cameraLookAtCourtPoint } from '../domain/camera';
import { COURT } from '../domain/court';
import { SHOT_CAMERA_RANGES } from '../engine/session/cameraTimeline';
import { defaultSpinRateRpm, type SpinKind } from '../engine/trajectory/physics';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';
import type { CompiledRepetition } from '../engine/session/compileSession';
import { normalizeShotSpin, SHOT_TYPE_LABELS, spinsForShot } from '../domain/shotKinds';
import { defaultReturnShot, RETURN_SHOT_PROFILES } from '../engine/session/returnShot';

export function EditorNumber({label,value,fallback,min,max,step=1,onChange}: {
  label:string;value:number|undefined;fallback?:number;min:number;max:number;step?:number;onChange:(value:number|undefined)=>void;
}) {
  return <label className="stack-field"><span>{label}</span><input aria-label={label} type="number" min={min} max={max} step={step}
    value={value === undefined ? '' : Number(value.toFixed(2))} placeholder={fallback === undefined ? undefined : `${Number(fallback.toFixed(2))} default`}
    onChange={event=>onChange(event.target.value === '' ? undefined : Number(event.target.value))} /></label>;
}

export function DrillShotControls({event,shot,drill,camera,resolved,onChange,onCameraChange}: {
  event:DrillEventV1;shot:ShotDefinitionV1;drill:DrillDefinitionV1;camera:CameraConfiguration;
  resolved:CompiledRepetition;
  onChange:(patch:Partial<DrillEventV1>)=>void;onCameraChange:(camera:CameraConfiguration)=>void;
}) {
  const spin=normalizeShotSpin(shot.family, event.spin && event.spin!=='preset' ? event.spin : shot.spin);
  const returnShot = resolved.returnShot;
  const selectShot = (shotId: string) => onChange({ shotId, spin: undefined, spinRateRpm: undefined,
    paceKmh: undefined, netClearanceM: undefined, target: undefined, landingZone: undefined, stroke: undefined });
  const cameraFields: readonly [keyof CameraConfiguration,string,number][] = [
    ['lateral','Camera sideways (m)',.1],['behindBaseline','Behind baseline (m)',.1],['eyeHeight','Eye height (m)',.01],
    ['yaw','Camera heading (°)',1],['pitch','Camera tilt (°)',1],['fov','Field of view (°)',1],
  ];
  return <div className="shot-controls">
    <label className="stack-field"><span>Shot name</span><input maxLength={60} value={event.label ?? ''} placeholder={shot.label} onChange={e=>onChange({label:e.target.value||undefined})}/></label>
    <details className="editor-section" open><summary>Opponent shot</summary>
      <label className="stack-field"><span>Shot type</span><select aria-label="Opponent shot type" value={shot.family} onChange={e=>selectShot(SHOTS.find(item=>item.family===e.target.value)!.id)}>{Object.entries(SHOT_TYPE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="stack-field"><span>Shot preset</span><select aria-label="Shot preset" value={event.shotId} onChange={e=>selectShot(e.target.value)}>{SHOTS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="stack-field"><span>Spin type</span><select aria-label="Opponent spin type" value={spin} onChange={e=>onChange({spin:e.target.value as SpinKind, spinRateRpm:undefined})}>{spinsForShot(shot.family).map(value=><option key={value} value={value}>{value[0]!.toUpperCase()+value.slice(1)}</option>)}</select></label>
      <div className="paired-fields">
        <label className="stack-field"><span>Playing hand</span><select aria-label="Playing hand" value={event.opponentHand??shot.opponentHand} onChange={e=>onChange({opponentHand:e.target.value as 'left'|'right'})}><option value="right">Right</option><option value="left">Left</option></select></label>
        {shot.family !== 'serve' ? <label className="stack-field"><span>Stroke side</span><select aria-label="Stroke side" value={event.stroke??shot.stroke??''} onChange={e=>onChange({stroke:e.target.value as 'forehand'|'backhand'||undefined})}><option value="">Shot default</option><option value="forehand">Forehand</option><option value="backhand">Backhand</option></select></label> : null}
      </div>
    </details>
    <details className="editor-section return-shot-section" open><summary>Return zone</summary>
      <label className="stack-field"><span>Shot type</span><select aria-label="Return shot type" value={returnShot.type} onChange={e=>onChange({returnShot:defaultReturnShot(e.target.value as ReturnShotType)})}>{Object.keys(RETURN_SHOT_PROFILES).map(type=><option key={type} value={type}>{SHOT_TYPE_LABELS[type as ReturnShotType]}</option>)}</select></label>
      <label className="stack-field"><span>Spin type</span><select aria-label="Return spin type" value={returnShot.spin} onChange={e=>onChange({returnShot:defaultReturnShot(returnShot.type,e.target.value as typeof returnShot.spin)})}>{spinsForShot(returnShot.type).map(spin=><option key={spin} value={spin}>{spin[0]!.toUpperCase()+spin.slice(1)}</option>)}</select></label>
      <RangeField commitOnRelease label="Return spin rate" value={returnShot.spinRateRpm ?? RETURN_SHOT_PROFILES[returnShot.type].rpm} min={0} max={6000} step={50} unit="rpm" onChange={spinRateRpm=>onChange({returnShot:{...returnShot,spinRateRpm}})}/>
      <small role="status">{resolved.returnStatus === 'linked' ? 'Return linked to the next shot.' : resolved.returnStatus === 'new-serve' ? 'Next shot starts a new serve.' : 'New feed needed for this return, interval or ball path.'}</small>
    </details>
    <details className="editor-section" open><summary>Ball &amp; rhythm</summary>
      <RangeField commitOnRelease label="Launch speed" value={event.paceKmh ?? drillShotPace(shot)} min={20} max={260} onChange={paceKmh=>onChange({paceKmh})} step={1} unit="km/h"/>
      <RangeField commitOnRelease label="Spin rate" value={event.spinRateRpm ?? defaultSpinRateRpm({...shot,spin})} min={0} max={6000} step={50} onChange={spinRateRpm=>onChange({spinRateRpm})} unit="rpm"/>
      <RangeField commitOnRelease label="Shot Variation" value={event.variationPercent ?? 8} min={0} max={25} onChange={variationPercent=>onChange({variationPercent})} step={1} unit="%"/>
      <label className="stack-field"><span>Trajectory style</span><select aria-label="Trajectory style" value={event.trajectoryMode??'natural'} onChange={e=>onChange({trajectoryMode:e.target.value as 'natural'|'exact'})}><option value="natural">Natural target</option><option value="exact">Exact speed &amp; spin</option></select></label>
      <div className="ball-secondary-fields">
        <RangeField commitOnRelease label="Net clearance" value={event.netClearanceM ?? shot.netClearanceM??.24} min={.08} max={1.8} step={.02} onChange={netClearanceM=>onChange({netClearanceM})} unit="m"/>
        <RangeField commitOnRelease label="Bounce factor" value={event.bounceFactor ?? 1} min={.6} max={1.4} step={.05} onChange={bounceFactor=>onChange({bounceFactor})} unit="×"/>
      </div>
      <RangeField commitOnRelease label="Shot interval" value={event.intervalSeconds ?? drill.defaultInterval} min={1} max={30} step={.1} onChange={intervalSeconds=>onChange({intervalSeconds})} unit="s"/>
      <RangeField commitOnRelease label="Stroke rhythm" value={event.rhythmPercent ?? drill.defaultRhythmPercent??rhythmFromLegacyInterval(drill.defaultInterval)} min={50} max={300} step={5} onChange={rhythmPercent=>onChange({rhythmPercent})} unit="%"/>
      <RangeField commitOnRelease label="Movement pace" value={event.movementPercent ?? drill.defaultMovementPercent??100} min={50} max={300} step={5} onChange={movementPercent=>onChange({movementPercent})} unit="%"/>
      <small role="status">Resolved {Math.round((resolved.motionRate??1)*100)}% stroke · {Math.round((resolved.movementRate??1)*100)}% movement.{resolved.timing ? ` ${resolved.timing.limited?'Shortest feasible interval: ':''}${resolved.timing.actual.toFixed(2)} s${resolved.timing.limited?'.':' between shots.'}` : ''}</small>
      {shot.family==='serve'?<label className="stack-field"><span>Serve rhythm</span><select aria-label="Serve rhythm" value={event.serveRhythm && event.serveRhythm !== 'preset' ? event.serveRhythm : shot.serveRhythm ?? 'normal'} onChange={e=>onChange({serveRhythm:e.target.value as 'normal'|'compact'})}><option value="normal">Normal</option><option value="compact">Compact</option></select></label>:null}
      <label className="stack-field"><span>Preparation cue</span><input maxLength={60} value={event.cue??''} placeholder={shot.cue} onChange={e=>onChange({cue:e.target.value||undefined})}/></label>
    </details>
    <details className="editor-section"><summary>Perspective</summary>
      <BallFocusControls />
      <div className="court-preset-list">{DEFAULT_CAMERA_POSITION_PRESETS.map(preset=><button type="button" key={preset.id} onClick={()=>{
        const position={...camera,...preset.position};
        onCameraChange({...position,...cameraLookAtCourtPoint(position,preset.lookAt??{x:0,y:0,z:COURT.halfLength})});
      }}>{preset.name}</button>)}</div>
      <div className="paired-fields">{cameraFields.map(([key,label,step])=><EditorNumber key={key} label={label} value={camera[key]} min={SHOT_CAMERA_RANGES[key][0]} max={SHOT_CAMERA_RANGES[key][1]} step={step} onChange={value=>{
        if(value!==undefined)onCameraChange({...camera,[key]:Math.max(SHOT_CAMERA_RANGES[key][0],Math.min(SHOT_CAMERA_RANGES[key][1],value))});
      }}/>)}</div>
      <small>WASD to move · Shift for faster movement · Page Up/Down for height · Drag to look · Wheel to zoom.</small>
    </details>
  </div>;
}
