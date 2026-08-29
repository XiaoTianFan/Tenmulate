import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  GripVertical,
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
import { DEFAULT_CAMERA } from '../app/defaults';
import { resolveTrajectory, type SpinKind } from '../engine/trajectory/physics';
import type { SceneMetrics } from '../engine/rendering/TennisScene';
import { AppHeader, type AppRoute } from './AppHeader';
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
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);
  const onMetrics = useCallback((_metrics: SceneMetrics) => undefined, []);
  const drill = history.present;
  const events = drill.events ?? [];
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const sourceShot = selected ? SHOT_BY_ID.get(selected.shotId) : SHOTS[0]!;
  const previewShot = sourceShot ? {
    ...sourceShot,
    paceKmh: selected?.paceKmh ?? sourceShot.paceKmh,
    spin: selected?.spin && selected.spin !== 'preset' ? selected.spin : sourceShot.spin,
    target: selected?.target ?? sourceShot.target,
    cameraMotion: selected?.cameraMotion ?? sourceShot.cameraMotion,
    cue: selected?.cue || sourceShot.cue,
  } : SHOTS[0]!;
  const trajectory = useMemo(() => resolveTrajectory(previewShot), [previewShot]);
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
            <SceneViewport camera={DEFAULT_CAMERA} trajectory={trajectory} surface={sourceShot?.surface ?? 'hard'} running resetToken={resetToken} showTrajectory loopTrajectory cameraMotion={null} onMetrics={onMetrics} />
            <div className="editor-scene-label"><span>Event {Math.max(1, events.findIndex((event) => event.id === selected?.id) + 1)}</span><strong>{sourceShot?.label}</strong></div>
          </div>
          <div className="timeline" aria-label="Deterministic drill timeline">
            <div className="timeline-toolbar">
              <strong>{drill.title}</strong>
              <span>{(events.length * drill.defaultInterval).toFixed(1)} s</span>
              <span className={validation.valid ? 'validation valid' : 'validation invalid'}><CheckCircle2 size={14} /> {validation.valid ? 'Valid' : `${validation.errors.length} issues`}</span>
            </div>
            <div className="timeline-body">
              {(['Opponent', 'Ball', 'Camera', 'Cue', 'Rest'] as const).map((track) => (
                <div className="timeline-track" key={track}>
                  <strong>{track}</strong>
                  <div className="track-events">
                    {events.map((event, index) => {
                      const shot = SHOT_BY_ID.get(event.shotId);
                      const text = track === 'Opponent' ? shot?.family : track === 'Ball' ? shot?.label : track === 'Camera' ? motionKey(event) : track === 'Cue' ? event.cue || shot?.cue : index === events.length - 1 ? 'set end' : '';
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
          <label className="stack-field"><span>Interval</span><input type="number" min="1" max="30" step="0.1" value={drill.defaultInterval} onChange={(event) => updateDrill({ defaultInterval: Number(event.target.value) })} /></label>
          <div className="inspector-divider"><span>Selected event</span><div><button type="button" onClick={duplicate} aria-label="Duplicate event"><Copy size={15} /></button><button type="button" onClick={remove} disabled={events.length === 1} aria-label="Delete event"><Trash2 size={15} /></button></div></div>
          {selected && sourceShot ? (
            <>
              <label className="stack-field"><span>Shot primitive</span><select value={selected.shotId} onChange={(event) => updateEvent({ shotId: event.target.value })}>{SHOTS.map((shot) => <option key={shot.id} value={shot.id}>{shot.label}</option>)}</select></label>
              <label className="stack-field"><span>Pace override</span><input type="number" min="20" max="260" placeholder={`${sourceShot.paceKmh} preset`} value={selected.paceKmh ?? ''} onChange={(event) => updateEvent({ paceKmh: event.target.value ? Number(event.target.value) : undefined })} /></label>
              <label className="stack-field"><span>Spin</span><select value={selected.spin ?? 'preset'} onChange={(event) => updateEvent({ spin: event.target.value as 'preset' | SpinKind })}><option value="preset">Shot preset</option><option value="flat">Flat</option><option value="topspin">Topspin</option><option value="slice">Slice</option><option value="kick">Kick</option><option value="sidespin">Sidespin</option></select></label>
              <label className="stack-field"><span>Net clearance</span><input type="number" min="0.08" max="1.8" step="0.02" value={selected.netClearanceM ?? ''} placeholder="0.24 session" onChange={(event) => updateEvent({ netClearanceM: event.target.value ? Number(event.target.value) : undefined })} /></label>
              {sourceShot.family === 'serve' ? <label className="stack-field"><span>Serve rhythm</span><select value={selected.serveRhythm ?? 'preset'} onChange={(event) => updateEvent({ serveRhythm: event.target.value as 'preset' | 'normal' | 'compact' })}><option value="preset">Shot preset</option><option value="normal">Normal · high toss</option><option value="compact">Compact · quick toss</option></select></label> : null}
              <div className="paired-fields"><label className="stack-field"><span>Target X</span><input type="number" min="-4.115" max="4.115" step="0.05" value={(selected.target?.x ?? sourceShot.target.x).toFixed(2)} onChange={(event) => updateEvent({ target: { x: Number(event.target.value), z: selected.target?.z ?? sourceShot.target.z } })} /></label><label className="stack-field"><span>Target Z</span><input type="number" min="-11.885" max="-0.01" step="0.05" value={(selected.target?.z ?? sourceShot.target.z).toFixed(2)} onChange={(event) => updateEvent({ target: { x: selected.target?.x ?? sourceShot.target.x, z: Number(event.target.value) } })} /></label></div>
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
    </main>
  );
}
