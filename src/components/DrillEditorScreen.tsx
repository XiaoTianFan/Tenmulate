import { landingZoneCenter } from '../engine/trajectory/landingZone';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Play,
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
import { COURT } from '../domain/court';
import { compileSession } from '../engine/session/compileSession';
import type { CameraConfiguration, SceneMetrics } from '../engine/rendering/TennisScene';
import { AppHeader, type AppRoute } from './AppHeader';
import { Modal } from './Modal';
import { DrillShotControls, EditorNumber } from './DrillShotControls';
import { DEFAULT_RETURN_LANDING_ZONE } from '../engine/session/returnLandingZone';
import { defaultReturnShot, resolveReturnShot } from '../engine/session/returnShot';
import { useEditorCameraMovement } from '../hooks/useEditorCameraMovement';
import { ShotLibrary } from './ShotLibrary';
import { DrillTimeline } from './DrillTimeline';
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
  returnShot: defaultReturnShot('groundstroke'),
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
  const sceneContainer = useRef<HTMLDivElement>(null);
  const [sceneAspect, setSceneAspect] = useState(1.6);
  useEffect(() => {
    const element = sceneContainer.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSceneAspect(entry.contentRect.width / Math.max(1, entry.contentRect.height)); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
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
  const previewCamera = viewDraft && viewDraft.id === selected?.id ? viewDraft.camera : shotCamera;
  const displayCamera = useMemo(() => overview ? {
    eyeHeight: Math.max(10, (COURT.halfLength + 2) * sceneAspect), behindBaseline: -COURT.halfLength,
    lateral: 0, pitch: -90, yaw: 0, fov: 90,
  } : previewCamera, [overview, previewCamera, sceneAspect]);
  const returnLandingZone = selected?.returnLandingZone ?? DEFAULT_RETURN_LANDING_ZONE;

  const previewSession = useMemo(() => {
    const base = sourceShot ?? SHOTS[0]!;
    const event = { ...selected, camera:shotCamera, id: selected?.id ?? 'preview', shotId: base.id, paceKmh: selected?.paceKmh ?? drillShotPace(base) };
    event.returnShot = resolveReturnShot(selected?.returnShot,
      SHOT_BY_ID.get(events[(events.indexOf(selected!) + 1) % events.length]?.shotId ?? base.id)?.family);
    return compileSession({ ...drill, events: [event], shotIds: [base.id] }, {
      repetitions: 2, mode: 'drill', shotIntervalSeconds:drill.defaultInterval, movementPercent:drill.defaultMovementPercent??100, trajectoryMode:'natural', rhythmPercent: drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval),
      variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: event.paceKmh, surface: base.surface,
      seed: 'editor-preview', spin: 'preset', opponentHand: base.opponentHand, workBlockSize: 2, restSeconds: 0,
      serveRhythm: 'preset', camera: shotCamera,
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
    defaultRepetitions: Math.max(1, nextEvents.length),
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
  const addEvent = (shotId = SHOTS[0]!.id, insertion = events.length) => {
    if (events.length >= 200) { setMessage('A drill can contain up to 200 shots.'); return; }
    const saved = savedShots.find(item => `saved:${item.id}` === shotId);
    if (!saved && !SHOT_BY_ID.has(shotId)) return;
    const event = saved ? { ...copyShotEvent(saved.event), label: saved.name } : makeEvent(shotId);
    const current = workingDrill.events ?? events;
    replaceEvents([...current.slice(0, insertion), event, ...current.slice(insertion)]);
    setSelectedId(event.id); setResetToken(value => value + 1);
  };
  const duplicate = () => {
    if (!selected) return;
    const clone = copyShotEvent({...selected,camera:previewCamera});
    const index = events.findIndex((event) => event.id === selected.id);
    replaceEvents([...events.slice(0, index + 1), clone, ...events.slice(index + 1)]);
    setSelectedId(clone.id);setResetToken(value=>value+1);
  };
  const remove = (id = selected?.id) => {
    if (!id) return;
    const index = events.findIndex(event => event.id === id);
    const next = (workingDrill.events ?? events).filter(event => event.id !== id);
    replaceEvents(next);
    if (selected?.id === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? '');
    setResetToken(value => value + 1);
  };
  const reorder = (id: string, insertion: number) => {
    const current = workingDrill.events ?? events, from = current.findIndex(event => event.id === id);
    if (from < 0) return;
    const next = [...current], [moved] = next.splice(from, 1);
    next.splice(insertion > from ? insertion - 1 : insertion, 0, moved!);
    replaceEvents(next);
  };
  useEditorCameraMovement(previewCamera, !!selected && !overview && !shotDraft && !message,
    camera => setViewDraft({ id: selected!.id, camera }), commitCamera);
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
      <AppHeader route={route} onRoute={onRoute} />
      <section className="editor-workspace">
        <ShotLibrary savedShots={savedShots} notice={shotNotice} onAdd={addEvent}/>

        <section className="editor-stage">
          <div className="editor-scene" ref={sceneContainer}>
            <CourtViewport camera={displayCamera} trajectory={trajectory} surface={sourceShot?.surface ?? 'hard'} running resetToken={resetToken} showTrajectory loopTrajectory session={previewSession} onSessionIndex={onPreviewIndex} cameraMotion={null}
              returnLandingZone={selected ? returnLandingZone : undefined}
              onReturnLandingZoneChange={selected ? zone => updateEvent({returnLandingZone:zone}) : undefined}
              onLandingZoneChange={selected ? zone => updateEvent({target: landingZoneCenter(zone), landingZone: {width: zone.maxX-zone.minX, depth: zone.maxZ-zone.minZ}}) : undefined}
              onCameraLookChange={overview||!selected?undefined:look=>setViewDraft({id:selected!.id,camera:{...previewCamera,...look,pitch:Math.max(-85,Math.min(85,look.pitch))}})}
              onCameraFovChange={overview||!selected?undefined:fov=>setViewDraft({id:selected!.id,camera:{...previewCamera,fov}})}
              onCameraViewCommit={overview?undefined:commitCamera} onMetrics={onMetrics} />
            <div className="editor-scene-label"><span>{selected ? `Shot ${events.findIndex(event => event.id === selected.id) + 1}` : 'Empty drill'}</span><strong>{selected ? selected.label??sourceShot?.label : 'Add a shot from the library'}</strong></div>
            <div className="editor-view-tools"><button type="button" aria-pressed={overview} onClick={()=>setOverview(value=>!value)}>{overview?'Back to shot view':'Top-down zones'}</button><span><i className="return-swatch"/>Your return <i className="landing-swatch"/>Incoming</span></div>
          </div>
          <DrillTimeline drill={drill} selectedId={selected?.id ?? ''} cameras={cameraViews}
            onSelect={selectEvent} onInsert={addEvent} onMove={reorder} onRemove={remove}/>
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
          <div className="inspector-divider"><span>Selected event</span><div><button type="button" onClick={duplicate} disabled={!selected || events.length >= 200} aria-label="Duplicate event"><Copy size={15} /></button><button type="button" onClick={() => remove()} disabled={!selected} aria-label="Delete event"><Trash2 size={15} /></button></div></div>
          {selected && sourceShot ? <>
            <DrillShotControls event={selected} shot={sourceShot} drill={drill} camera={previewCamera} resolved={previewSession.repetitions[0]!} onChange={updateEvent} onCameraChange={commitCamera}/>
            <small className={`trajectory-resolution${trajectory.solution?.status==='unreachable'?' warning':''}`} role="status">{trajectory.solution?.status==='unreachable'?'Sample outside this shot’s reach. Adjust pace, spin or landing zone.':`Resolved ${trajectory.resolved.launchSpeedKmh.toFixed(1)} km/h · ${Math.round(trajectory.resolved.spinRateRpm)} rpm`}</small>
            <button className="secondary-button full-width save-shot-button" type="button" disabled={!validation.valid} onClick={()=>setShotDraft({id:'',name:selected.label??sourceShot.label})}><Save size={16}/> Save new shot</button>
            <button className="secondary-button full-width save-shot-button" type="button" disabled={!validation.valid || !savedShots.length} onClick={()=>setShotDraft({id:savedShots[0]!.id,name:savedShots[0]!.name})}><Save size={16}/> Update existing saved shot</button>
          </> : null}
          {!events.length ? <p className="saved-shot-count">Add a shot to save or test this drill.</p>
            : !validation.valid ? <ul className="validation-errors">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          <div className="editor-primary-actions">
            <button className="primary-button" type="button" disabled={!validation.valid} onClick={() => { onSave(workingDrill); setMessage('Saved to this browser.'); }}><Save size={17} /> Save locally</button>
            <button className="secondary-button full-width" type="button" disabled={!validation.valid} onClick={() => onTest(workingDrill)}><Play size={16} /> Test drill</button>
          </div>
        </aside>
      </section>
      {shotDraft && selected ? <Modal title="Save shot preset" onClose={()=>setShotDraft(null)} actions={<>
        {shotDraft.id ? <button type="button" className="secondary-button" onClick={()=>{onDeleteShot(shotDraft.id);setShotNotice('Saved shot removed. Existing drills are unchanged.');setShotDraft(null);}}>Delete saved shot</button> : null}
        <button type="button" className="primary-button inline" disabled={!shotDraft.name.trim()} onClick={()=>{
          const name=shotDraft.name.trim();onSaveShot({id:shotDraft.id||`shot-${crypto.randomUUID()}`,name,event:snapshotShot({...selected,label:name},workingDrill,previewCamera)});
          setShotNotice(`Saved “${name}”`);setShotDraft(null);
        }}>{shotDraft.id?'Update saved shot':'Save new shot'}</button>
      </>}>
        <label className="stack-field"><span>Save as</span><select aria-label="Save as" value={shotDraft.id} onChange={e=>setShotDraft({id:e.target.value,name:savedShots.find(item=>item.id===e.target.value)?.name??shotDraft.name})}><option value="">New saved shot</option>{savedShots.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="stack-field"><span>Preset name</span><input autoFocus maxLength={60} value={shotDraft.name} onChange={e=>setShotDraft({...shotDraft,name:e.target.value})}/></label>
        <p>Includes both landing zones, return shot and spin, camera, ball, timing, playing hand and stroke settings. Add it to any drill from the shot list.</p>
      </Modal> : null}
      {message ? <Modal title="Drill editor" onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>Close</button>}><p>{message}</p></Modal> : null}

    </main>
  );
}
