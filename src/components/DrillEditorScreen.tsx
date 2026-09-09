import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Play, Save, Trash2 } from 'lucide-react';
import { newPlayerEvent, openingFor, PLAYER_SHOTS, PLAYER_SHOT_BY_ID } from '../content/playerShots';
import { snapshotPlayerShot } from '../content/playerMigration';
import { validatePlayerDrill } from '../content/playerValidation';
import type { DrillDefinitionV2, OpponentHand, PlayerShotEventV2, SavedShotV2 } from '../content/types';
import { openingZoneSource, playerDrillForHand, playerEventForHand } from '../content/playerHandedness';
import { PlayerHandControls } from './PlayerHandControls';
import { DEFAULT_CAMERA } from '../app/defaults';
import type { SurfaceId } from '../domain/court';
import { landingZoneLimits, landingZoneCenter, resolveLandingZone } from '../engine/trajectory/landingZone';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { AppHeader, type AppRoute } from './AppHeader';
import { Modal } from './Modal';
import { DrillShotControls, EditorNumber, OpeningShotControls } from './DrillShotControls';
import { useEditorCameraMovement } from '../hooks/useEditorCameraMovement';
import { useCourtOverview } from '../hooks/useCourtOverview';
import { usePlayerDrillPreview } from '../hooks/usePlayerDrillPreview';
import { ShotLibrary } from './ShotLibrary';
import { DrillTimeline } from './DrillTimeline';
import { CourtViewport } from './SharedCourt';

type Props = {
  route: AppRoute; initialDrill: DrillDefinitionV2; surface: SurfaceId;
  initialPlayerHand: OpponentHand; onPlayerHandChange: (hand: OpponentHand) => void;
  onRoute: (route: AppRoute) => void; onSave: (drill: DrillDefinitionV2) => void; onTest: (drill: DrillDefinitionV2) => void;
  savedShots: readonly SavedShotV2[]; onSaveShot: (shot: SavedShotV2) => void; onDeleteShot: (id: string) => void;
};
const cloneEvent = (event: PlayerShotEventV2) => ({ ...structuredClone(event), id: `event-${crypto.randomUUID()}` });
const noMetrics = () => undefined;

export function DrillEditorScreen({ route, initialDrill, initialPlayerHand, onPlayerHandChange, surface, onRoute, onSave, onTest, savedShots, onSaveShot, onDeleteShot }: Props) {
  const [drill, setDrill] = useState(() => ({ ...structuredClone(playerDrillForHand(initialDrill, initialPlayerHand)), defaultRepetitions: Math.max(1, initialDrill.events.length) }));
  const [selectedId, setSelectedId] = useState('launch');
  const [viewDraft, setViewDraft] = useState<{ id: string; camera: CameraConfiguration } | null>(null);
  const [overview, setOverview] = useState(false), [sequence, setSequence] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [shotDraft, setShotDraft] = useState<{ id: string; name: string } | null>(null);
  const [shotNotice, setShotNotice] = useState(''), [message, setMessage] = useState<string | null>(null);
  const clock = useRef(0);
  const events = drill.events;
  const playerHand = drill.playerHand ?? 'right';
  const openingId = selectedId.startsWith('opening:') ? selectedId.slice(8) : null;
  const selected = events.find(event => event.id === (openingId ?? selectedId)) ?? events[0];
  const isOpening = selectedId === 'launch' || !!openingId && !!selected?.openingFeed;
  const feed = openingId && selected?.openingFeed ? selected.openingFeed : drill.launch;
  const previewCamera = viewDraft?.id === selected?.id ? viewDraft.camera : selected?.camera ?? DEFAULT_CAMERA;
  const workingDrill = viewDraft ? { ...drill, events: events.map(event => event.id === viewDraft.id ? { ...event, camera: viewDraft.camera } : event) } : drill;
  const preview = usePlayerDrillPreview(drill, surface), session = preview.session;
  const compiled = session?.playerEvents?.find(item => item.event.id === selected?.id);
  const playingEvent = session?.playerEvents?.find(item => item.incomingIndex === previewIndex)?.event ?? events[0];
  const trajectory = session?.repetitions[isOpening && !openingId ? 0 : compiled?.incomingIndex ?? 0]?.trajectory;
  const validation = validatePlayerDrill(workingDrill);
  const nearZone = isOpening ? feed.landingZone : selected?.opponentReturn.landingZone;
  const nearLimits = useMemo(() => landingZoneLimits(isOpening ? feed.ball.family : 'groundstroke', isOpening ? openingZoneSource(feed) : { x: 0 }), [isOpening, feed]);
  const { container: sceneContainer, displayCamera, zoomOverview } = useCourtOverview(previewCamera, overview);
  useEffect(() => {
    if (!session) return;
    const start = sequence || isOpening && !openingId ? 0 : Math.max(0, (session.repetitions[compiled?.incomingIndex ?? 0]?.startTime ?? 3) - .7);
    const next = compiled && session.playerEvents?.[compiled.index + 1];
    const end = sequence ? session.duration : isOpening ? compiled?.startTime ?? session.playerEvents?.[0]?.startTime ?? session.duration : next?.startTime ?? session.duration;
    clock.current = start;
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      if (previous && !document.hidden) clock.current += Math.min(.05, (now - previous) / 1000);
      previous = now;
      if (clock.current >= end) {
        if (sequence) { setSequence(false); return; }
        clock.current = start;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [session, compiled, isOpening, openingId, sequence]);

  const commit = (next: DrillDefinitionV2) => setDrill({ ...next, defaultRepetitions: Math.max(1, next.events.length) });
  const updateDrill = (patch: Partial<DrillDefinitionV2>) => { setViewDraft(null); commit({ ...workingDrill, ...patch }); };
  const replaceEvents = (next: readonly PlayerShotEventV2[]) => updateDrill({ events: next, defaultRepetitions: Math.max(1, next.length) });
  const updateEvent = (patch: Partial<PlayerShotEventV2>) => {
    if (selected) replaceEvents(workingDrill.events.map(event => event.id === selected.id ? { ...event, ...patch } : event));
  };
  const updateFeed = (next: typeof feed) => openingId ? updateEvent({ openingFeed: next }) : updateDrill({ launch: next });
  const placeOpponent = ({ x, z }: { x: number; z: number }) => {
    const position = { x, z };
    const next = { ...feed, position }, zone = feed.landingZone;
    updateFeed({ ...next, landingZone: resolveLandingZone(landingZoneCenter(zone), { width: zone.maxX - zone.minX, depth: zone.maxZ - zone.minZ }, feed.ball.family, openingZoneSource(next)) });
  };
  const commitCamera = (camera: CameraConfiguration) => updateEvent({ camera: { ...camera, pitch: Math.max(-85, Math.min(85, camera.pitch)) } });
  const selectEvent = (id: string) => { if (viewDraft) commit(workingDrill); setViewDraft(null); setSelectedId(id); setSequence(false); };
  const changePlayerHand = (hand: OpponentHand) => {
    if (hand === playerHand) return;
    updateDrill(playerDrillForHand(workingDrill, hand)); onPlayerHandChange(hand);
  };
  const addEvent = (id = PLAYER_SHOTS[0]!.id, insertion = events.length) => {
    if (events.length >= 200) { setMessage('A drill can contain up to 200 player shots.'); return; }
    const saved = savedShots.find(item => `saved:${item.id}` === id);
    if (!saved && !PLAYER_SHOT_BY_ID.has(id)) return;
    const source = saved ? { ...cloneEvent(saved.event), label: saved.name } : newPlayerEvent(id);
    const event = playerEventForHand(source, saved?.playerHand ?? 'right', playerHand);
    replaceEvents([...workingDrill.events.slice(0, insertion), event, ...workingDrill.events.slice(insertion)]);
    setSelectedId(event.id); setSequence(false);
  };
  const duplicate = () => {
    if (!selected) return;
    const event = cloneEvent({ ...selected, camera: previewCamera }), index = events.indexOf(selected);
    replaceEvents([...workingDrill.events.slice(0, index + 1), event, ...workingDrill.events.slice(index + 1)]); setSelectedId(event.id);
  };
  const remove = (id = selected?.id) => {
    const index = events.findIndex(event => event.id === id), next = workingDrill.events.filter(event => event.id !== id);
    replaceEvents(next); if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? 'launch');
  };
  const reorder = (id: string, insertion: number) => {
    const next = [...workingDrill.events], from = next.findIndex(event => event.id === id); if (from < 0) return;
    const [event] = next.splice(from, 1); next.splice(insertion > from ? insertion - 1 : insertion, 0, event!); replaceEvents(next);
  };
  useEditorCameraMovement(previewCamera, !!selected && !overview && !sequence && !shotDraft && !message,
    camera => setViewDraft({ id: selected!.id, camera }), commitCamera);
  const draftLook = useCallback((look: Pick<CameraConfiguration, 'yaw' | 'pitch'>) => {
    if (selected) setViewDraft({ id: selected.id, camera: { ...previewCamera, ...look, pitch: Math.max(-85, Math.min(85, look.pitch)) } });
  }, [selected, previewCamera]);
  const lookEnabled = !!selected && !overview && !sequence;
  const issues = preview.pending ? [] : session?.planningIssues ?? [];

  return <main className="app-shell editor-shell">
    <AppHeader route={route} onRoute={onRoute}/>
    <section className="editor-workspace">
      <ShotLibrary savedShots={savedShots} notice={shotNotice} onAdd={addEvent}/>
      <section className="editor-stage">
        <div className="editor-scene" ref={sceneContainer}>
          {trajectory && events.length ? <CourtViewport camera={displayCamera} trajectory={trajectory} surface={surface} running resetToken={0} showTrajectory session={session!} sessionClock={clock} followSessionCamera={sequence && !overview}
            nearLandingZone={sequence ? session?.repetitions[previewIndex]?.trajectory.intent.landingZone : nearZone} nearLandingZoneLimits={nearLimits} returnLandingZone={(sequence ? playingEvent : selected)?.landingZone}
            onSessionIndex={sequence ? index => setPreviewIndex(index) : undefined}
            opponentPlacement={overview && isOpening ? { ...feed.position, hand: feed.ball.hand } : undefined}
            onOpponentPositionChange={overview && isOpening ? placeOpponent : undefined}
            onLandingZoneChange={sequence ? undefined : zone => isOpening ? updateFeed({ ...feed, landingZone: zone }) : selected && updateEvent({ opponentReturn: { ...selected.opponentReturn, landingZone: zone } })}
            onReturnLandingZoneChange={!sequence && selected ? zone => updateEvent({ landingZone: zone }) : undefined}
            onCameraLookChange={lookEnabled ? draftLook : undefined}
            onCameraFovChange={overview ? zoomOverview : lookEnabled ? fov => setViewDraft({ id: selected!.id, camera: { ...previewCamera, fov } }) : undefined}
            onCameraViewCommit={lookEnabled ? commitCamera : undefined} onMetrics={noMetrics}/> : <div className="editor-preview-loading">{events.length ? 'Preparing drill preview…' : 'Add your first shot from the library.'}</div>}
          <div className="editor-scene-label"><span>{isOpening ? 'Opening shot' : `Your shot ${events.indexOf(selected!) + 1}`}</span><strong>{isOpening ? 'Opponent initiates the rally' : selected?.label ?? 'Add a player shot'}</strong></div>
          <div className="editor-view-tools"><button type="button" aria-pressed={overview} onClick={() => { setSequence(false); setOverview(value => !value); }}>{overview ? 'Back to shot view' : 'Top-down zones'}</button><span><i className="return-swatch"/>Your landing <i className="landing-swatch"/>{isOpening ? 'Opening landing' : 'Opponent return'}</span></div>
          <div className="editor-preview-status" role="status">{!validation.valid ? 'Adjust drill settings' : preview.pending ? 'Updating preview…' : preview.error || (issues.length ? 'Connection needs adjustment' : 'Preview ready')}</div>
        </div>
        <DrillTimeline drill={drill} selectedId={isOpening ? selectedId : selected?.id ?? ''} onSelect={selectEvent} onInsert={addEvent} onMove={reorder} onRemove={remove}
          playing={sequence} previewDisabled={!session || preview.pending || !!preview.error || !validation.valid || !!issues.length}
          onPreview={() => { if (viewDraft) commit(workingDrill); setViewDraft(null); setOverview(false); setSequence(value => !value); }}/>
      </section>
      <aside className="event-inspector">
        <PlayerHandControls hand={playerHand} onChange={changePlayerHand}/>
        <details className="editor-section"><summary>Drill configuration</summary>
          <label className="stack-field"><span>Drill title</span><input value={drill.title} maxLength={100} onChange={e => updateDrill({ title: e.target.value })}/></label>
          <label className="stack-field"><span>Description</span><textarea value={drill.description} maxLength={400} rows={3} onChange={e => updateDrill({ description: e.target.value })}/></label>
          <EditorNumber label="Default player interval (s)" value={drill.defaultInterval} min={1} max={30} step={.1} onChange={defaultInterval => updateDrill({ defaultInterval })}/>
          <EditorNumber label="Default movement pace (%)" value={drill.defaultMovementPercent ?? 100} min={50} max={300} step={5} onChange={defaultMovementPercent => updateDrill({ defaultMovementPercent })}/>
          <EditorNumber label="Default stroke rhythm (%)" value={drill.defaultRhythmPercent ?? 100} min={50} max={300} step={5} onChange={defaultRhythmPercent => updateDrill({ defaultRhythmPercent })}/>
        </details>
        <div className="inspector-divider"><span>{isOpening ? 'Opening shot' : 'Selected player shot'}</span><div><button type="button" onClick={duplicate} disabled={isOpening || !selected || events.length >= 200} aria-label="Duplicate event"><Copy size={15}/></button><button type="button" onClick={() => remove()} disabled={isOpening || !selected} aria-label="Delete event"><Trash2 size={15}/></button></div></div>
        {isOpening ? <><OpeningShotControls feed={feed} onChange={updateFeed}/><button type="button" className="secondary-button full-width" onClick={() => { setOverview(true); setSequence(false); }}>Place opponent on court</button>{selected ? <button type="button" className="secondary-button full-width" onClick={() => updateFeed(openingFor(selected, feed.ball.family === 'serve'))}>Use suggested opening for player shot</button> : null}</> : selected ? <>
          <DrillShotControls event={selected} drill={drill} camera={previewCamera} onChange={updateEvent} onCameraChange={commitCamera} onEditOpening={() => selectEvent(`opening:${selected.id}`)}/>
          {compiled?.timing && !preview.pending ? <p className="saved-shot-count">Player contacts {compiled.timing.actual.toFixed(2)} s apart{compiled.timing.limited ? ` · requested ${compiled.timing.requested.toFixed(2)} s` : ''}.</p> : null}
          <button className="secondary-button full-width save-shot-button" type="button" disabled={!validation.valid} onClick={() => setShotDraft({ id: '', name: selected.label })}><Save size={16}/> Save new shot</button>
          <button className="secondary-button full-width save-shot-button" type="button" disabled={!validation.valid || !savedShots.length} onClick={() => setShotDraft({ id: savedShots[0]!.id, name: savedShots[0]!.name })}><Save size={16}/> Update existing saved shot</button>
        </> : null}
        {[...validation.errors, ...issues.map(issue => issue.message), ...(preview.error ? [preview.error] : [])].length ? <ul className="validation-errors">{[...validation.errors, ...issues.map(issue => issue.message), ...(preview.error ? [preview.error] : [])].map(error => <li key={error}>{error}</li>)}</ul> : null}
        <div className="editor-primary-actions"><button className="primary-button" type="button" disabled={!validation.valid} onClick={() => { onSave(workingDrill); setMessage('Saved to this browser.'); }}><Save size={17}/> Save locally</button>
          <button className="secondary-button full-width" type="button" disabled={!validation.valid || preview.pending || !!issues.length || !!preview.error} onClick={() => onTest(workingDrill)}><Play size={16}/> Test drill</button></div>
      </aside>
    </section>
    {shotDraft && selected ? <Modal title="Save player shot preset" onClose={() => setShotDraft(null)} actions={<>
      {shotDraft.id ? <button type="button" className="secondary-button" onClick={() => { onDeleteShot(shotDraft.id); setShotNotice('Saved shot removed.'); setShotDraft(null); }}>Delete saved shot</button> : null}
      <button type="button" className="primary-button inline" disabled={!shotDraft.name.trim()} onClick={() => {
        const name = shotDraft.name.trim(); onSaveShot({ schemaVersion: 2, playerHand, id: shotDraft.id || `shot-${crypto.randomUUID()}`, name, event: snapshotPlayerShot({ ...selected, label: name, camera: previewCamera }, workingDrill) });
        setShotNotice(`Saved “${name}”`); setShotDraft(null);
      }}>{shotDraft.id ? 'Update saved shot' : 'Save new shot'}</button>
    </>}>
      <label className="stack-field"><span>Save as</span><select aria-label="Save as" value={shotDraft.id} onChange={e => setShotDraft({ id: e.target.value, name: savedShots.find(item => item.id === e.target.value)?.name ?? shotDraft.name })}><option value="">New saved shot</option>{savedShots.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label className="stack-field"><span>Preset name</span><input autoFocus maxLength={60} value={shotDraft.name} onChange={e => setShotDraft({ ...shotDraft, name: e.target.value })}/></label>
      <p>Includes your shot and landing zone, opponent return and its zone, camera, timing, hand and stroke settings.</p>
    </Modal> : null}
    {message ? <Modal title="Drill editor" onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>Close</button>}><p>{message}</p></Modal> : null}
  </main>;
}
