import { normalizeLandingZone } from '../engine/trajectory/landingZone';
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
import { SHOTS, SHOT_BY_ID } from '../content/bundled';
import { materializeEvents } from '../content/editing';
import type { DrillDefinitionV1, DrillEventV1 } from '../content/types';
import { downloadDrill, parseDrillJson, validateDrill } from '../content/validation';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';
import { DEFAULT_CAMERA } from '../app/defaults';
import { OPPONENT_POSITION_PRESETS } from '../domain/court';
import type { SpinKind } from '../engine/trajectory/physics';
import { compileSession } from '../engine/session/compileSession';
import type { CameraConfiguration, SceneMetrics } from '../engine/rendering/TennisScene';
import { AppHeader, type AppRoute } from './AppHeader';
import { CourtPlan, type CourtPoint } from './CourtPlan';
import { Modal } from './Modal';
import { SceneViewport } from './SceneViewport';

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
}>;

const makeEvent = (shotId = SHOTS[0]!.id): DrillEventV1 => ({
  id: `event-${crypto.randomUUID().slice(0, 8)}`,
  shotId,
});

const cameraMotions = {
  none: null,
  'move-left': { to: { lateral: -2.4, yaw: 6 }, duration: 1.2 },
  'move-right': { to: { lateral: 2.4, yaw: -6 }, duration: 1.2 },
  approach: { to: { behindBaseline: -4.5, fov: 76 }, duration: 1.45 },
  recover: { to: { lateral: 0, behindBaseline: 1.5, yaw: 0, pitch: -1.7, fov: 70 }, duration: 1.35 },
} as const;

function motionKey(event: DrillEventV1): keyof typeof cameraMotions {
  if (!event.cameraMotion) return 'none';
  const target = event.cameraMotion.to;
  if ((target.behindBaseline ?? 1.5) < 0) return 'approach';
  if ((target.lateral ?? 0) < 0) return 'move-left';
  if ((target.lateral ?? 0) > 0) return 'move-right';
  return 'recover';
}

export function DrillEditorScreen({ route, initialDrill, onRoute, onSave, onTest }: DrillEditorScreenProps) {
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
  const [previewCamera, setPreviewCamera] = useState<CameraConfiguration>({...DEFAULT_CAMERA,eyeHeight:3,behindBaseline:3,pitch:-8,fov:78});
  const [message, setMessage] = useState<string | null>(null);
  const [positionDraft, setPositionDraft] = useState<CourtPoint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);
  const onMetrics = useCallback((_metrics: SceneMetrics) => undefined, []);
  const drill = history.present;
  const events = drill.events ?? [];
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const sourceShot = selected ? SHOT_BY_ID.get(selected.shotId) : SHOTS[0]!;
  const previewSession = useMemo(() => {
    const base = sourceShot ?? SHOTS[0]!;
    const event = { ...selected, id: selected?.id ?? 'preview', shotId: base.id, paceKmh: selected?.paceKmh ?? base.paceKmh };
    return compileSession({ ...drill, events: [event], shotIds: [base.id] }, {
      repetitions: 2, mode: 'drill', shotIntervalSeconds:drill.defaultInterval, movementPercent:drill.defaultMovementPercent??100, trajectoryMode:'natural', rhythmPercent: drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval),
      variationPercent: 8, timingVariationPercent: 0, launchSpeedKmh: event.paceKmh, surface: base.surface,
      seed: 'editor-preview', spin: 'preset', opponentHand: base.opponentHand, workBlockSize: 2, restSeconds: 0,
      serveRhythm: 'preset', opponentPosition: event.opponentPosition ?? base.source, camera: DEFAULT_CAMERA,
    });
  }, [drill, selected, sourceShot]);
  const trajectory = (previewSession.repetitions[previewIndex] ?? previewSession.repetitions[0])!.trajectory;
  const zoneSize = normalizeLandingZone(selected?.landingZone, sourceShot?.family);
  const validation = validateDrill(drill);

  const commit = (next: DrillDefinitionV1) => setHistory((current) => ({ past: [...current.past.slice(-49), current.present], present: next, future: [] }));
  const updateDrill = (patch: Partial<DrillDefinitionV1>) => commit({ ...drill, ...patch });
  const replaceEvents = (nextEvents: readonly DrillEventV1[]) => updateDrill({
    events: nextEvents,
    shotIds: nextEvents.map((event) => event.shotId),
    defaultRepetitions: nextEvents.length,
  });
  const updateEvent = (patch: Partial<DrillEventV1>) => {
    if (!selected) return;
    replaceEvents(events.map((event) => event.id === selected.id ? { ...event, ...patch } : event));
    setResetToken((value) => value + 1);
  };
  const undo = () => setHistory((current) => current.past.length ? {
    past: current.past.slice(0, -1),
    present: current.past.at(-1)!,
    future: [current.present, ...current.future],
  } : current);
  const redo = () => setHistory((current) => current.future.length ? {
    past: [...current.past, current.present],
    present: current.future[0]!,
    future: current.future.slice(1),
  } : current);
  const addEvent = (shotId = SHOTS[0]!.id) => {
    const event = makeEvent(shotId);
    replaceEvents([...events, event]);
    setSelectedId(event.id);
  };
  const duplicate = () => {
    if (!selected) return;
    const clone = { ...selected, id: `event-${crypto.randomUUID().slice(0, 8)}` };
    const index = events.findIndex((event) => event.id === selected.id);
    replaceEvents([...events.slice(0, index + 1), clone, ...events.slice(index + 1)]);
    setSelectedId(clone.id);
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
      <AppHeader route={route} onRoute={onRoute} onDisplay={() => onRoute('practice')} onHelp={() => setMessage('Build a sequence from validated shot primitives. Drag event rows to reorder; every edit is previewed through the same physics engine used in rehearsal.')} />
      <section className="editor-workspace">
        <aside className="event-library">
          <header><h1>Shot events</h1><button type="button" aria-label="Add default event" onClick={() => addEvent()}><Plus size={18} /></button></header>
          <select aria-label="Shot to add" defaultValue="" onChange={(event) => { if (event.target.value) addEvent(event.target.value); event.target.value = ''; }}>
            <option value="" disabled>Add a shot…</option>
            {SHOTS.map((shot) => <option key={shot.id} value={shot.id}>{shot.label}</option>)}
          </select>
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
                  onClick={() => { setSelectedId(event.id); setResetToken((value) => value + 1); }}
                >
                  <GripVertical size={15} /><span>{String(index + 1).padStart(2, '0')}</span><strong>{shot?.label ?? event.shotId}</strong>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="editor-stage">
          <div className="editor-scene">
            <SceneViewport camera={previewCamera} trajectory={trajectory} surface={sourceShot?.surface ?? 'hard'} running resetToken={resetToken} showTrajectory loopTrajectory session={previewSession} onSessionIndex={onPreviewIndex} cameraMotion={null} onLandingChange={target => updateEvent({target})} onCameraLookChange={look=>setPreviewCamera(camera=>({...camera,...look}))} onCameraFovChange={fov=>setPreviewCamera(camera=>({...camera,fov}))} onMetrics={onMetrics} />
            <div className="editor-scene-label"><span>Event {Math.max(1, events.findIndex((event) => event.id === selected?.id) + 1)}</span><strong>{sourceShot?.label}</strong></div>
          </div>
          <div className="timeline" aria-label="Deterministic drill timeline">
            <div className="timeline-toolbar">
              <strong>{drill.title}</strong>
              <span>{drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)}% rhythm</span>
              <span className={validation.valid ? 'validation valid' : 'validation invalid'}><CheckCircle2 size={14} /> {validation.valid ? 'Valid' : `${validation.errors.length} issues`}</span>
            </div>
            <div className="timeline-body">
              {(['Opponent', 'Ball', 'Camera', 'Cue', 'Rest'] as const).map((track) => (
                <div className="timeline-track" key={track}>
                  <strong>{track}</strong>
                  <div className="track-events">
                    {events.map((event, index) => {
                      const shot = SHOT_BY_ID.get(event.shotId);
                      const text = track === 'Opponent' ? `${shot?.family ?? ''}${event.opponentPosition ? ` · ${event.opponentPosition.x.toFixed(1)}, ${event.opponentPosition.z.toFixed(1)}` : ''}` : track === 'Ball' ? shot?.label : track === 'Camera' ? motionKey(event) : track === 'Cue' ? event.cue || shot?.cue : index === events.length - 1 ? 'set end' : '';
                      return <button type="button" key={`${track}-${event.id}`} className={event.id === selected?.id ? 'timeline-clip selected' : 'timeline-clip'} onClick={() => setSelectedId(event.id)} title={text}>{text}</button>;
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
            <button type="button" onClick={() => downloadDrill(drill)} aria-label="Export"><Download size={17} /></button>
            <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
          </div>
          <label className="stack-field"><span>Drill title</span><input value={drill.title} maxLength={100} onChange={(event) => updateDrill({ title: event.target.value })} /></label>
          <label className="stack-field"><span>Description</span><textarea value={drill.description} maxLength={400} rows={3} onChange={(event) => updateDrill({ description: event.target.value })} /></label>
          <label className="stack-field"><span>Shot interval (s)</span><input aria-label="Editor shot interval" type="number" min="1" max="30" step="0.1" value={drill.defaultInterval} onChange={event=>updateDrill({defaultInterval:Number(event.target.value)})}/></label>
          <label className="stack-field"><span>Movement pace (%)</span><input aria-label="Editor movement pace" type="number" min="50" max="150" step="5" value={drill.defaultMovementPercent??100} onChange={event=>updateDrill({defaultMovementPercent:Number(event.target.value)})}/></label>
          <label className="stack-field"><span>Stroke rhythm (%)</span><input type="number" min="50" max="150" step="5" value={drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)} onChange={(event) => updateDrill({ defaultRhythmPercent: Number(event.target.value) })} /></label>
          <div className="inspector-divider"><span>Selected event</span><div><button type="button" onClick={duplicate} aria-label="Duplicate event"><Copy size={15} /></button><button type="button" onClick={remove} disabled={events.length === 1} aria-label="Delete event"><Trash2 size={15} /></button></div></div>
          {selected && sourceShot ? (
            <>
              <label className="stack-field"><span>Shot primitive</span><select value={selected.shotId} onChange={(event) => updateEvent({ shotId: event.target.value })}>{SHOTS.map((shot) => <option key={shot.id} value={shot.id}>{shot.label}</option>)}</select></label>
              <label className="stack-field"><span>Pace override</span><input type="number" min="20" max="260" placeholder={`${sourceShot.paceKmh} preset`} value={selected.paceKmh ?? ''} onChange={(event) => updateEvent({ paceKmh: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label className="stack-field"><span>Spin</span><select value={selected.spin ?? 'preset'} onChange={(event) => updateEvent({ spin: event.target.value as 'preset' | SpinKind })}><option value="preset">Shot preset</option><option value="flat">Flat</option><option value="topspin">Topspin</option><option value="slice">Slice</option><option value="kick">Kick</option><option value="sidespin">Sidespin</option></select></label>
              <label className="stack-field"><span>Net clearance</span><input type="number" min="0.08" max="1.8" step="0.02" value={selected.netClearanceM ?? ''} placeholder="0.24 session" onChange={(event) => updateEvent({ netClearanceM: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <button type="button" className="configuration-action editor-position-action" onClick={() => setPositionDraft(selected.opponentPosition ?? { x: sourceShot.source.x, z: sourceShot.source.z })}><MapPin size={16} /><span>Opponent position</span><small>{(selected.opponentPosition?.x ?? sourceShot.source.x).toFixed(1)}, {(selected.opponentPosition?.z ?? sourceShot.source.z).toFixed(1)} m</small></button>
              {sourceShot.family === 'serve' ? <label className="stack-field"><span>Serve rhythm</span><select value={selected.serveRhythm ?? 'preset'} onChange={(event) => updateEvent({ serveRhythm: event.target.value as 'preset' | 'normal' | 'compact' })}><option value="preset">Shot preset</option><option value="normal">Normal · high toss</option><option value="compact">Compact · quick toss</option></select></label> : null}
              <div className="paired-fields"><label className="stack-field"><span>Zone center X</span><input type="number" min="-4.115" max="4.115" step="0.05" value={(selected.target?.x ?? sourceShot.target.x).toFixed(2)} onChange={(event) => updateEvent({ target: { x: Number(event.target.value), z: selected.target?.z ?? sourceShot.target.z } })} /></label><label className="stack-field"><span>Zone center Z</span><input type="number" min="-11.885" max="-0.01" step="0.05" value={(selected.target?.z ?? sourceShot.target.z).toFixed(2)} onChange={(event) => updateEvent({ target: { x: selected.target?.x ?? sourceShot.target.x, z: Number(event.target.value) } })} /></label></div>
              <div className="paired-fields"><label className="stack-field"><span>Zone width (m)</span><input aria-label="Editor zone width" type="number" min="0.2" max="6" step="0.1" value={zoneSize.width} onChange={event => updateEvent({landingZone:{...zoneSize,width:Number(event.target.value)}})} /></label><label className="stack-field"><span>Zone depth (m)</span><input aria-label="Editor zone depth" type="number" min="0.2" max="6" step="0.1" value={zoneSize.depth} onChange={event => updateEvent({landingZone:{...zoneSize,depth:Number(event.target.value)}})} /></label></div>
              <small>Uniform landings within the highlighted court or service-box zone.</small>
              <small className={`trajectory-resolution${trajectory.solution?.status==='unreachable'?' warning':''}`} role="status">{trajectory.solution?.status==='unreachable'?'Sample outside this shot’s reach. Adjust pace, spin or zone.':`Resolved ${trajectory.resolved.launchSpeedKmh.toFixed(1)} km/h · ${Math.round(trajectory.resolved.spinRateRpm)} rpm for this landing.`}</small>
              <label className="stack-field"><span>Speed &amp; spin variation (±%)</span><input aria-label="Editor parameter variation" type="number" min="0" max="25" step="1" value={selected.variationPercent ?? 8} onChange={event => updateEvent({variationPercent:Number(event.target.value)})} /></label>
              <label className="stack-field"><span>Camera motion</span><select value={motionKey(selected)} onChange={(event) => updateEvent({ cameraMotion: cameraMotions[event.target.value as keyof typeof cameraMotions] })}>{Object.keys(cameraMotions).map((key) => <option key={key} value={key}>{key.replace('-', ' ')}</option>)}</select></label>
              <label className="stack-field"><span>Preparation cue</span><input maxLength={60} value={selected.cue ?? ''} placeholder={sourceShot.cue} onChange={(event) => updateEvent({ cue: event.target.value || undefined })} /></label>
            </>
          ) : null}
          {!validation.valid ? <ul className="validation-errors">{validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          <div className="editor-primary-actions">
            <button className="primary-button" type="button" disabled={!validation.valid} onClick={() => { onSave(drill); setMessage('Saved to this browser.'); }}><Save size={17} /> Save locally</button>
            <button className="secondary-button full-width" type="button" disabled={!validation.valid} onClick={() => onTest(drill)}><Play size={16} /> Test drill</button>
          </div>
        </aside>
      </section>
      {message ? <Modal title="Drill editor" onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>Close</button>}><p>{message}</p></Modal> : null}
      {positionDraft && selected && sourceShot ? <Modal title="Opponent position for this shot" onClose={() => setPositionDraft(null)} actions={<><button className="secondary-button" type="button" onClick={() => setPositionDraft(null)}>Cancel</button><button className="primary-button inline" type="button" onClick={() => { updateEvent({ opponentPosition: positionDraft }); setPositionDraft(null); }}>Apply to shot</button></>}><p>Drag the opponent anywhere on the floor plan, or start from a court preset. This origin is stored on the selected event only.</p><div className="court-preset-list">{OPPONENT_POSITION_PRESETS.map((preset) => <button type="button" key={preset.name} onClick={() => setPositionDraft(preset.point)}>{preset.name}</button>)}</div><CourtPlan opponent={positionDraft} landing={trajectory.events.find((event) => event.type === 'bounce')?.position ?? null} onOpponentChange={setPositionDraft} /><p className="calculation">Event position: {positionDraft.x.toFixed(2)}, {positionDraft.z.toFixed(2)} m</p></Modal> : null}
    </main>
  );
}
