import { landingZoneCenter } from '../engine/trajectory/landingZone';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  GripVertical,
  MapPin,
  Play,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { SHOTS, SHOT_BY_ID, drillShotPace } from '../content/bundled';
import { copyShotEvent, eventCamera, materializeEvents, snapshotShot } from '../content/editing';
import type { DrillDefinitionV1, DrillEventV1, SavedShotV1 } from '../content/types';
import { downloadDrill, parseDrillJson, validateDrill } from '../content/validation';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';
import { DEFAULT_CAMERA } from '../app/defaults';
import { OPPONENT_POSITION_PRESETS } from '../domain/court';
import { compileSession } from '../engine/session/compileSession';
import type { CameraConfiguration, SceneMetrics } from '../engine/rendering/TennisScene';
import { AppHeader, type AppRoute } from './AppHeader';
import { CourtPlan, type CourtPoint } from './CourtPlan';
import { Modal } from './Modal';
import { DrillShotControls, EditorNumber } from './DrillShotControls';
import { DEFAULT_RETURN_ZONE, RETURN_ZONE_RANGES } from '../engine/session/returnZone';
import { CourtViewport } from './SharedCourt';

type EditorHistory = Readonly<{
  past: readonly DrillDefinitionV1[];
  present: DrillDefinitionV1;
  future: readonly DrillDefinitionV1[];
}>;

type DrillEditorScreenProps = Readonly<{
  route: AppRoute;
  initialDrill: DrillDefinitionV1;
  onRoute: (route: AppRoute) => void;
  onSave: (drill: DrillDefinitionV1) => void;
  onTest: (drill: DrillDefinitionV1) => void;
  savedShots: readonly SavedShotV1[];
  onSaveShot: (shot: SavedShotV1) => void;
  onDeleteShot: (id: string) => void;
}>;

const makeEvent = (shotId = SHOTS[0]!.id): DrillEventV1 => ({
  id: `event-${crypto.randomUUID().slice(0, 8)}`,
  shotId,
});

export function DrillEditorScreen({ route, initialDrill, onRoute, onSave, onTest, savedShots, onSaveShot, onDeleteShot }: DrillEditorScreenProps) {
  const normalized = useMemo<DrillDefinitionV1>(() => ({
    ...initialDrill,
    events: materializeEvents(initialDrill),
    shotIds: materializeEvents(initialDrill).map((event) => event.shotId),
  }), [initialDrill]);
  const [history, setHistory] = useState<EditorHistory>({ past: [], present: normalized, future: [] });
  const [selectedId, setSelectedId] = useState(normalized.events?.[0]?.id ?? '');
  const [resetToken, setResetToken] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const onPreviewIndex = useCallback((index:number)=>setPreviewIndex(index),[]);
  const [viewDraft, setViewDraft] = useState<{id:string;camera:CameraConfiguration}|null>(null);
  const [overview, setOverview] = useState(false);
  const [shotDraft, setShotDraft] = useState<{id:string;name:string}|null>(null);
  const [shotNotice, setShotNotice] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [positionDraft, setPositionDraft] = useState<CourtPoint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);
  const onMetrics = useCallback((_metrics: SceneMetrics) => undefined, []);
  const drill = history.present;
  const events = drill.events ?? [];
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const sourceShot = selected ? SHOT_BY_ID.get(selected.shotId) : SHOTS[0]!;
  const cameraViews = useMemo(()=>{
    const views = new Map<string,CameraConfiguration>();let view:CameraConfiguration=DEFAULT_CAMERA;
    for(const event of events){view=eventCamera(event,view);views.set(event.id,view);}return views;
  },[events]);
  const shotCamera = cameraViews.get(selected?.id??'')??DEFAULT_CAMERA;
  const previewCamera = viewDraft?.id===selected?.id ? viewDraft!.camera : shotCamera;
  const displayCamera = useMemo(()=>overview?{...previewCamera,eyeHeight:10,behindBaseline:14,pitch:-32,yaw:0,fov:84}:previewCamera,[overview,previewCamera]);
  const returnZone = drill.returnZone??DEFAULT_RETURN_ZONE;
  const returnZonePreview = useMemo(()=>({zone:returnZone,camera:previewCamera}),[returnZone,previewCamera]);

  const previewSession = useMemo(() => {
    const base = sourceShot ?? SHOTS[0]!;
    const event = { ...selected, camera:shotCamera, id: selected?.id ?? 'preview', shotId: base.id, paceKmh: selected?.paceKmh ?? drillShotPace(base) };
    return compileSession({ ...drill, events: [event], shotIds: [base.id] }, {
      repetitions: 2, mode: 'drill', shotIntervalSeconds:drill.defaultInterval, movementPercent:drill.defaultMovementPercent??100, trajectoryMode:'natural', rhythmPercent: drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval),
      variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: event.paceKmh, surface: base.surface,
      seed: 'editor-preview', spin: 'preset', opponentHand: base.opponentHand, workBlockSize: 2, restSeconds: 0,
      serveRhythm: 'preset', opponentPosition: event.opponentPosition ?? base.source, camera: shotCamera,
    });
  }, [drill, selected, sourceShot, shotCamera]);
  const trajectory = (previewSession.repetitions[previewIndex] ?? previewSession.repetitions[0])!.trajectory;
  const validation = validateDrill(drill);
  const workingDrill: DrillDefinitionV1 = viewDraft ? {...drill,events:events.map(event=>event.id===viewDraft.id?{...event,camera:viewDraft.camera,cameraMotion:null}:event)} : drill;

  const commit = (next: DrillDefinitionV1) => setHistory((current) => ({ past: [...current.past.slice(-49), current.present], present: next, future: [] }));
  const updateDrill = (patch: Partial<DrillDefinitionV1>) => {setViewDraft(null);commit({ ...workingDrill, ...patch });};
  const replaceEvents = (nextEvents: readonly DrillEventV1[]) => updateDrill({
    events: nextEvents,
    shotIds: nextEvents.map((event) => event.shotId),
    defaultRepetitions: nextEvents.length,
  });
  const updateEvent = (patch: Partial<DrillEventV1>) => {
    if (!selected) return;
    replaceEvents((workingDrill.events??events).map((event) => event.id === selected.id ? { ...event, ...patch } : event));
    setResetToken((value) => value + 1);
  };
  const commitCamera = (camera:CameraConfiguration) => {
    setViewDraft(null);updateEvent({camera:{...camera,pitch:Math.max(-85,Math.min(85,camera.pitch))},cameraMotion:null});
  };
  const selectEvent = (id:string) => {if(viewDraft)commit(workingDrill);setViewDraft(null);setSelectedId(id);setResetToken(value=>value+1);};
  const undo = () => {setViewDraft(null);setResetToken(value=>value+1);setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1),
    present: current.past.at(-1)!,
    future: [current.present, ...current.future],
  } : current);};
  const redo = () => {setViewDraft(null);setResetToken(value=>value+1);setHistory((current) => current.future.length ? {
    past: [...current.past, current.present],
    present: current.future[0]!,
    future: current.future.slice(1),
  } : current);};
  const addEvent = (shotId = SHOTS[0]!.id) => {
    const saved = savedShots.find(item=>`saved:${item.id}`===shotId);
    const event = saved ? {...copyShotEvent(saved.event),label:saved.name} : makeEvent(shotId);
    replaceEvents([...(workingDrill.events??events), event]);
    setSelectedId(event.id);setResetToken(value=>value+1);
  };
  const duplicate = () => {
    if (!selected) return;
    const clone = copyShotEvent({...selected,camera:previewCamera});
    const index = events.findIndex((event) => event.id === selected.id);
    replaceEvents([...events.slice(0, index + 1), clone, ...events.slice(index + 1)]);
    setSelectedId(clone.id);setResetToken(value=>value+1);
  };
  const remove = () => {
    if (!selected || events.length === 1) return;
    const index = events.findIndex((event) => event.id === selected.id);
    const next = events.filter((event) => event.id !== selected.id);
    replaceEvents(next);
    setSelectedId(next[Math.min(index, next.length - 1)]!.id);
  };
  const reorder = (targetId: string) => {
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) return;
    const sourceIndex = events.findIndex((event) => event.id === sourceId);
    const targetIndex = events.findIndex((event) => event.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...events];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved!);
    replaceEvents(next);
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = parseDrillJson(await file.text());
      const next = { ...imported, events: materializeEvents(imported), shotIds: materializeEvents(imported).map((event) => event.shotId), category: 'Custom' as const };
      commit(next);
      setSelectedId(next.events[0]?.id ?? '');
      setMessage(`Loaded “${next.title}” into the editor. Save to keep it locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <main className="app-shell editor-shell">
      <AppHeader route={route} onRoute={onRoute} onDisplay={() => onRoute('practice')} onHelp={() => setMessage('Add default or saved shots, then drag the rows to order them. Set a view for each shot and your return-space dimensions. Test drill plays the full sequence with camera and opponent movement.')} />
      <section className="editor-workspace">
        <aside className="event-library">
          <header><h1>Shot events</h1><button type="button" aria-label="Add default event" onClick={() => addEvent()}><Plus size={18} /></button></header>
          <select aria-label="Shot to add" defaultValue="" onChange={(event) => { if (event.target.value) addEvent(event.target.value); event.target.value = ''; }}>
            <option value="" disabled>Add a shot…</option>
            <optgroup label="Default shots">{SHOTS.map((shot) => <option key={shot.id} value={shot.id}>{shot.label}</option>)}</optgroup>
            {savedShots.length ? <optgroup label="Saved shots">{savedShots.map(shot=><option key={shot.id} value={`saved:${shot.id}`}>{shot.name}</option>)}</optgroup> : null}
          </select>
          <p className="saved-shot-count" role="status">{shotNotice || `${savedShots.length} saved shots`}</p>
          <div className="event-list">
            {events.map((event, index) => {
              const shot = SHOT_BY_ID.get(event.shotId);
              return (
                <button
                  draggable
                  type="button"
                  key={event.id}
                  className={event.id === selected?.id ? 'event-row selected' : 'event-row'}
                  onDragStart={() => { dragId.current = event.id; }}
                  onDragOver={(dragEvent) => dragEvent.preventDefault()}
                  onDrop={() => reorder(event.id)}
                  onClick={() => selectEvent(event.id)}
                >
                  <GripVertical size={15} /><span>{String(index + 1).padStart(2, '0')}</span><strong>{event.label ?? shot?.label ?? event.shotId}</strong>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="editor-stage">
          <div className="editor-scene">
            <CourtViewport camera={displayCamera} trajectory={trajectory} surface={sourceShot?.surface ?? 'hard'} running resetToken={resetToken} showTrajectory loopTrajectory session={previewSession} onSessionIndex={onPreviewIndex} cameraMotion={null}
              returnZonePreview={returnZonePreview}
              onLandingZoneChange={zone => updateEvent({target: landingZoneCenter(zone), landingZone: {width: zone.maxX-zone.minX, depth: zone.maxZ-zone.minZ}})}
              onCameraLookChange={overview?undefined:look=>setViewDraft({id:selected!.id,camera:{...previewCamera,...look,pitch:Math.max(-85,Math.min(85,look.pitch))}})}
              onCameraFovChange={overview?undefined:fov=>setViewDraft({id:selected!.id,camera:{...previewCamera,fov}})}
              onCameraViewCommit={overview?undefined:commitCamera} onMetrics={onMetrics} />
            <div className="editor-scene-label"><span>Shot {Math.max(1, events.findIndex((event) => event.id === selected?.id) + 1)}</span><strong>{selected?.label??sourceShot?.label}</strong></div>
            <div className="editor-view-tools"><button type="button" aria-pressed={overview} onClick={()=>setOverview(value=>!value)}>{overview?'Back to shot view':'View return space'}</button><span><i className="return-swatch"/>Return <i className="landing-swatch"/>Landing</span></div>
          </div>
          <div className="timeline" aria-label="Deterministic drill timeline">
            <div className="timeline-toolbar">
              <strong>{drill.title}</strong>
              <span>{drill.defaultInterval.toFixed(1)} s default interval</span>
              <span className={validation.valid ? 'validation valid' : 'validation invalid'}><CheckCircle2 size={14} /> {validation.valid ? 'Valid' : `${validation.errors.length} issues`}</span>
            </div>
            <div className="timeline-body">
              {(['Opponent', 'Ball', 'Camera', 'Cue', 'Rest'] as const).map((track) => (
                <div className="timeline-track" key={track}>
                  <strong>{track}</strong>
                  <div className="track-events">
                    {events.map((event, index) => {
                      const shot = SHOT_BY_ID.get(event.shotId);
                      const text = track === 'Opponent' ? `${shot?.family ?? ''}${event.opponentPosition ? ` · ${event.opponentPosition.x.toFixed(1)}, ${event.opponentPosition.z.toFixed(1)}` : ''}` : track === 'Ball' ? shot?.label : track === 'Camera' ? `${cameraViews.get(event.id)!.lateral.toFixed(1)} m · ${cameraViews.get(event.id)!.yaw.toFixed(0)}°` : track === 'Cue' ? event.cue || shot?.cue : index === events.length - 1 ? 'set end' : '';
                      return <button type="button" key={`${track}-${event.id}`} className={event.id === selected?.id ? 'timeline-clip selected' : 'timeline-clip'} onClick={() => selectEvent(event.id)} title={text}>{text}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="event-inspector">
          <div className="editor-actions">
            <button type="button" onClick={undo} disabled={!history.past.length} aria-label="Undo"><Undo2 size={17} /></button>
            <button type="button" onClick={redo} disabled={!history.future.length} aria-label="Redo"><Redo2 size={17} /></button>
            <button type="button" onClick={() => inputRef.current?.click()} aria-label="Import"><Upload size={17} /></button>
            <button type="button" onClick={() => downloadDrill(workingDrill)} aria-label="Export"><Download size={17} /></button>
            <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
          </div>
          <details className="editor-section"><summary>Drill defaults</summary>
            <label className="stack-field"><span>Drill title</span><input value={drill.title} maxLength={100} onChange={e=>updateDrill({title:e.target.value})}/></label>
            <label className="stack-field"><span>Description</span><textarea value={drill.description} maxLength={400} rows={3} onChange={e=>updateDrill({description:e.target.value})}/></label>
            <EditorNumber label="Default shot interval (s)" value={drill.defaultInterval} min={1} max={30} step={.1} onChange={value=>updateDrill({defaultInterval:value??3.5})}/>
            <EditorNumber label="Default movement pace (%)" value={drill.defaultMovementPercent??100} min={50} max={300} step={5} onChange={value=>updateDrill({defaultMovementPercent:value??100})}/>
            <EditorNumber label="Default stroke rhythm (%)" value={drill.defaultRhythmPercent??rhythmFromLegacyInterval(drill.defaultInterval)} min={50} max={300} step={5} onChange={value=>updateDrill({defaultRhythmPercent:value??100})}/>
          </details>
          <details className="editor-section" open><summary><i className="return-swatch"/>Your return space</summary>
            <EditorNumber label="Forward distance (m)" value={returnZone.forward} min={RETURN_ZONE_RANGES.forward[0]} max={RETURN_ZONE_RANGES.forward[1]} step={.1} onChange={value=>updateDrill({returnZone:{...returnZone,forward:value??DEFAULT_RETURN_ZONE.forward}})}/>
            <div className="paired-fields">
              <EditorNumber label="Return width (m)" value={returnZone.width} min={RETURN_ZONE_RANGES.width[0]} max={RETURN_ZONE_RANGES.width[1]} step={.1} onChange={value=>updateDrill({returnZone:{...returnZone,width:value??DEFAULT_RETURN_ZONE.width}})}/>
              <EditorNumber label="Return depth (m)" value={returnZone.depth} min={RETURN_ZONE_RANGES.depth[0]} max={RETURN_ZONE_RANGES.depth[1]} step={.1} onChange={value=>updateDrill({returnZone:{...returnZone,depth:value??DEFAULT_RETURN_ZONE.depth}})}/>
            </div>
            <small>Match your available reach in meters. The blue zone follows each shot's camera.</small>
          </details>
          <div className="inspector-divider"><span>Selected event</span><div><button type="button" onClick={duplicate} aria-label="Duplicate event"><Copy size={15} /></button><button type="button" onClick={remove} disabled={events.length === 1} aria-label="Delete event"><Trash2 size={15} /></button></div></div>
          {selected && sourceShot ? <>
            <DrillShotControls event={selected} shot={sourceShot} drill={drill} camera={previewCamera} resolved={previewSession.repetitions[0]!} onChange={updateEvent} onCameraChange={commitCamera} onPosition={()=>setPositionDraft(selected.opponentPosition??{x:sourceShot.source.x,z:sourceShot.source.z})}/>
            <small className={`trajectory-resolution${trajectory.solution?.status==='unreachable'?' warning':''}`} role="status">{trajectory.solution?.status==='unreachable'?'Sample outside this shot’s reach. Adjust pace, spin or landing zone.':`Resolved ${trajectory.resolved.launchSpeedKmh.toFixed(1)} km/h · ${Math.round(trajectory.resolved.spinRateRpm)} rpm`}</small>
            <small className="return-space-status" role="status">{previewSession.repetitions[0]!.reachability.reachable?'This sample reaches your return space.':'This sample misses your return space. Adjust the shot view or landing zone.'}</small>
            <button className="secondary-button full-width save-shot-button" type="button" disabled={!validation.valid} onClick={()=>setShotDraft({id:'',name:selected.label??sourceShot.label})}><Save size={16}/> Save shot preset</button>
          </> : null}
          {!validation.valid ? <ul className="validation-errors">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          <div className="editor-primary-actions">
            <button className="primary-button" type="button" disabled={!validation.valid} onClick={() => { onSave(workingDrill); setMessage('Saved to this browser.'); }}><Save size={17} /> Save locally</button>
            <button className="secondary-button full-width" type="button" disabled={!validation.valid} onClick={() => onTest(workingDrill)}><Play size={16} /> Test drill</button>
          </div>
        </aside>
      </section>
      {shotDraft && selected ? <Modal title="Save shot preset" onClose={()=>setShotDraft(null)} actions={<>
        {shotDraft.id ? <button type="button" className="secondary-button" onClick={()=>{onDeleteShot(shotDraft.id);setShotNotice('Saved shot removed. Existing drills are unchanged.');setShotDraft(null);}}>Delete saved shot</button> : null}
        <button type="button" className="primary-button inline" disabled={!shotDraft.name.trim()} onClick={()=>{
          const name=shotDraft.name.trim();onSaveShot({id:shotDraft.id||`shot-${crypto.randomUUID()}`,name,event:snapshotShot({...selected,label:name},drill,previewCamera)});
          setShotNotice(`Saved “${name}”`);setShotDraft(null);
        }}>{shotDraft.id?'Update saved shot':'Save new shot'}</button>
      </>}>
        <label className="stack-field"><span>Save as</span><select aria-label="Save as" value={shotDraft.id} onChange={e=>setShotDraft({id:e.target.value,name:savedShots.find(item=>item.id===e.target.value)?.name??shotDraft.name})}><option value="">New saved shot</option>{savedShots.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="stack-field"><span>Preset name</span><input autoFocus maxLength={60} value={shotDraft.name} onChange={e=>setShotDraft({...shotDraft,name:e.target.value})}/></label>
        <p>Includes this shot’s opponent, camera, ball and timing settings. Add it to any drill from the shot list.</p>
      </Modal> : null}
      {message ? <Modal title="Drill editor" onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>Close</button>}><p>{message}</p></Modal> : null}
      {positionDraft && selected && sourceShot ? <Modal title="Opponent position for this shot" onClose={() => setPositionDraft(null)} actions={<><button className="secondary-button" type="button" onClick={() => setPositionDraft(null)}>Cancel</button><button className="primary-button inline" type="button" onClick={() => { updateEvent({ opponentPosition: positionDraft }); setPositionDraft(null); }}>Apply to shot</button></>}><p>Drag the opponent anywhere on the floor plan, or start from a court preset. This origin is stored on the selected event only.</p><div className="court-preset-list">{OPPONENT_POSITION_PRESETS.map((preset) => <button type="button" key={preset.name} onClick={() => setPositionDraft(preset.point)}>{preset.name}</button>)}</div><CourtPlan opponent={positionDraft} landing={trajectory.events.find((event) => event.type === 'bounce')?.position ?? null} onOpponentChange={setPositionDraft} /><p className="calculation">Event position: {positionDraft.x.toFixed(2)}, {positionDraft.z.toFixed(2)} m</p></Modal> : null}
    </main>
  );
}
