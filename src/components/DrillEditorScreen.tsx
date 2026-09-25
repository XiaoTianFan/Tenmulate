import { AudioSettings } from './AudioSettings';
import { usePreviewAudio } from '../hooks/usePreviewAudio';
import type { EnvironmentConfiguration } from '../domain/environment';
import { t, message as translateMessage } from '../i18n/locale';
import { SaveCancelled } from '../storage/savePolicy';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, Play, Save, Trash2 } from 'lucide-react';
import { openingFor } from '../content/playerShots';
import { snapshotPlayerShot } from '../content/playerMigration';
import { validatePlayerDrill } from '../content/playerValidation';
import type { DrillDefinitionV2, OpponentHand, PlayerShotEventV2, SavedShotV2 } from '../content/types';
import { openingZoneSource, playerDrillForHand, playerEventForHand } from '../content/playerHandedness';
import { PlayerHandControls } from './PlayerHandControls';
import { DEFAULT_CAMERA } from '../app/defaults';
import type { SurfaceId } from '../domain/court';
import { landingZoneLimits, landingZoneCenter, resolveLandingZone, type LandingZone } from '../engine/trajectory/landingZone';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { AppHeader, type AppRoute } from './AppHeader';
import { Modal } from './Modal';
import { SavedShotModal } from './SavedShotModal';
import { NewShotModal } from './NewShotModal';
import { DrillShotControls, EditorNumber, OpeningShotControls } from './DrillShotControls';
import { useEditorCameraMovement } from '../hooks/useEditorCameraMovement';
import { useCourtOverview } from '../hooks/useCourtOverview';
import { usePlayerDrillPreview } from '../hooks/usePlayerDrillPreview';
import { ShotLibrary } from './ShotLibrary';
import { DrillTimeline } from './DrillTimeline';
import { CameraTransitionControls } from './CameraTransitionControls';
import { CourtViewport } from './SharedCourt';
import type { EditorDraft } from '../storage/editorDrafts';

type Props = {
  environment: EnvironmentConfiguration;
  launching?: boolean;
  route: AppRoute; initialDrill: DrillDefinitionV2; surface: SurfaceId;
  initialPlayerHand: OpponentHand; onPlayerHandChange: (hand: OpponentHand) => void;
  onRoute: (route: AppRoute) => void; onSave: (drill: DrillDefinitionV2) => Promise<DrillDefinitionV2>; onTest: (drill: DrillDefinitionV2, showTrajectory: boolean) => void;
  initialDraft?: EditorDraft; onDraftChange: (draft: EditorDraft, previousId?: string) => void;
  writable: boolean; projectStatus: string;
  savedShots: readonly SavedShotV2[]; shotsWritable: boolean; shotsStatus: string; projectShotIds: readonly string[];
  onSaveShot: (shot: SavedShotV2, targetId?: string) => Promise<SavedShotV2>; onDeleteShot: (id: string) => Promise<void>;
};
const cloneEvent = (event: PlayerShotEventV2) => ({ ...structuredClone(event), id: `event-${crypto.randomUUID()}` });
const noMetrics = () => undefined;

const START_CLOCK = Object.freeze({ current: 0 });
export function DrillEditorScreen({ environment, route, launching = false, initialDrill, initialDraft, onDraftChange, writable, projectStatus, initialPlayerHand, onPlayerHandChange, surface, onRoute, onSave, onTest, savedShots, shotsWritable, shotsStatus, projectShotIds, onSaveShot, onDeleteShot }: Props) {
  const [drill, setDrill] = useState<DrillDefinitionV2>(() => {
    const copy = structuredClone(playerDrillForHand(initialDraft?.drill ?? initialDrill, initialPlayerHand));
    const fov = copy.events[0]?.camera.fov ?? DEFAULT_CAMERA.fov;
    return { ...copy, events: copy.events.map(event => ({ ...event, camera: { ...event.camera, fov } })),
      defaultRepetitions: Math.max(1, copy.events.length) };
  });
  const savedDrill = useRef(initialDraft?.savedDrill ?? drill);
  const [selectedId, setSelectedId] = useState(initialDraft?.selectedId ?? 'launch');
  const [viewDraft, setViewDraft] = useState<{ id: string; camera: CameraConfiguration } | null>(null);
  const [transitionCamera, setTransitionCamera] = useState<CameraConfiguration | null>(() =>
    (initialDrill.playerHand ?? 'right') === initialPlayerHand ? initialDraft?.transitionCamera ?? null : null);
  const [sequenceRange, setSequenceRange] = useState<{ start: number; end: number } | null>(null);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [zoneDraft, setZoneDraft] = useState<{ role: 'player' | 'opponent'; zone: LandingZone } | null>(null);
  const [overview, setOverview] = useState(initialDraft?.overview ?? false), [sequence, setSequence] = useState(false);
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLElement>(null), sections = useRef(initialDraft?.sections ?? {});
  const [previewIndex, setPreviewIndex] = useState(0);
  const [shotDraft, setShotDraft] = useState<{ mode: 'new' | 'update'; event: PlayerShotEventV2 } | null>(null);
  const [shotNotice, setShotNotice] = useState(''), [message, setMessage] = useState<string | null>(null);
  const [creatingShot, setCreatingShot] = useState(false), [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const clock = useRef(0);
  const events = drill.events;
  const playerHand = drill.playerHand ?? 'right';
  const openingId = selectedId.startsWith('opening:') ? selectedId.slice(8) : null;
  const transitionId = selectedId.startsWith('camera:') ? selectedId.slice(7) : null;
  const selected = events.find(event => event.id === (openingId ?? transitionId ?? selectedId)) ?? events[0];
  const nextEvent = events[events.indexOf(selected!) + 1];
  const isTransition = !!transitionId && !!selected && !!nextEvent;
  const isOpening = selectedId === 'launch' || !!openingId && !!selected?.openingFeed;
  const feed = openingId && selected?.openingFeed ? selected.openingFeed : drill.launch;
  const previewCamera = isTransition ? transitionCamera ?? { ...(selected?.camera ?? DEFAULT_CAMERA), ...selected?.cameraTransition?.movement?.waypoint }
    : viewDraft && viewDraft.id === selected?.id ? viewDraft.camera : selected?.camera ?? DEFAULT_CAMERA;
  const workingDrill = viewDraft ? { ...drill, events: events.map(event => ({ ...event,
    camera: event.id === viewDraft.id ? viewDraft.camera : { ...event.camera, fov: viewDraft.camera.fov } })) } : drill;
  const preview = usePlayerDrillPreview(drill, surface);
  const selection = useMemo(() => selected ? { eventId: selected.id, opening: isOpening, initialOpening: selectedId === 'launch' } : undefined, [selected?.id, isOpening, selectedId]);
  const shotDrill = useMemo(() => ({ ...drill,
    launch: zoneDraft?.role === 'opponent' && selectedId === 'launch' ? { ...drill.launch, landingZone: zoneDraft.zone } : drill.launch,
    events: drill.events.map(event => event.id !== selected?.id ? event : { ...event,
      ...(viewDraft?.id === event.id ? { camera: viewDraft.camera } : {}),
      ...(zoneDraft?.role === 'player' ? { landingZone: zoneDraft.zone } : {}),
      ...(zoneDraft?.role === 'opponent' && !isOpening ? { opponentReturn: { ...event.opponentReturn, landingZone: zoneDraft.zone } } : {}),
      ...(zoneDraft?.role === 'opponent' && openingId && event.openingFeed ? { openingFeed: { ...event.openingFeed, landingZone: zoneDraft.zone } } : {}),
    }),
  }), [drill, zoneDraft, viewDraft, selected?.id, selectedId, isOpening, openingId]);
  const latestDraft = useRef<EditorDraft>(null!);
  latestDraft.current = { drill: viewDraft ? { ...shotDrill, events: shotDrill.events.map(event => ({ ...event, camera: { ...event.camera, fov: viewDraft.camera.fov } })) } : shotDrill,
    selectedId, overview, transitionCamera, sections: sections.current, savedDrill: savedDrill.current };
  const captureDraft = useCallback(() => {
    const inspector = root.current?.querySelector('.event-inspector');
    if (inspector) latestDraft.current.inspectorScroll = inspector.scrollTop;
    onDraftChange(latestDraft.current);
  }, [onDraftChange]);
  useLayoutEffect(() => {
    const inspector = root.current?.querySelector('.event-inspector');
    root.current?.querySelectorAll('details').forEach(detail => {
      const key = detail.querySelector('summary')?.dataset.sectionKey ?? detail.querySelector('summary')?.textContent ?? '';
      if (Object.hasOwn(sections.current, key)) detail.open = sections.current[key]!;
    });
    if (inspector) inspector.scrollTop = initialDraft?.inspectorScroll ?? 0;
  // Restore the selection's sections only on mount, preserving subsequent user toggles.
  }, []);
  useLayoutEffect(() => { captureDraft(); }, [shotDrill, selectedId, overview, transitionCamera, captureDraft]);
  useLayoutEffect(() => () => { captureDraft(); }, [captureDraft]);
  useEffect(() => {
    const element = root.current;
    const toggle = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement) {
        sections.current[event.target.querySelector('summary')?.dataset.sectionKey ?? event.target.querySelector('summary')?.textContent ?? ''] = event.target.open; captureDraft();
      }
    };
    element?.addEventListener('toggle', toggle, true);
    return () => element?.removeEventListener('toggle', toggle, true);
  }, [captureDraft]);
  const shotPreview = usePlayerDrillPreview(shotDrill, surface, selection, !!zoneDraft || !!viewDraft);
  const session = sequence ? preview.session : shotPreview.session;
  const onPreviewAudioFrame = usePreviewAudio(environment, surface, !launching && !!session && (sequence ? preview.current : shotPreview.current), session);
  const compiled = preview.current ? preview.session?.playerEvents?.find(item => item.event.id === selected?.id) : undefined;
  const nextCompiled = preview.current ? preview.session?.playerEvents?.find(item => item.event.id === nextEvent?.id) : undefined;
  const transitionWindow = compiled && nextCompiled ? { start: compiled.startTime, end: nextCompiled.startTime } : undefined;
  const playingEvent = session?.playerEvents?.find(item => item.incomingIndex === previewIndex)?.event ?? events[0];
  const trajectory = session?.shotPreview?.opponent ?? session?.shotPreview?.player ?? session?.repetitions[0]?.trajectory;
  const validation = validatePlayerDrill(workingDrill);
  const nearZone = zoneDraft?.role === 'opponent' ? zoneDraft.zone : isOpening ? feed.landingZone : selected?.opponentReturn.landingZone;
  const nearLimits = useMemo(() => landingZoneLimits(isOpening ? feed.ball.family : 'groundstroke', isOpening ? openingZoneSource(feed) : { x: 0 }), [isOpening, feed]);
  const { container: sceneContainer, displayCamera, zoomOverview } = useCourtOverview(previewCamera, overview);
  useEffect(() => {
    if (!session) return;
    const start = sequence ? sequenceRange?.start ?? 0 : isOpening ? 0 : 2.4;
    const end = sequence ? sequenceRange?.end ?? session.duration : session.duration;
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
  }, [session, isOpening, sequence, sequenceRange]);

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
  const commitCamera = (camera: CameraConfiguration) => {
    if (isTransition) {
      setTransitionCamera(camera);
      if (events.some(event => event.camera.fov !== camera.fov)) replaceEvents(workingDrill.events.map(event => ({ ...event, camera: { ...event.camera, fov: camera.fov } })));
    } else replaceEvents(workingDrill.events.map(event => ({ ...event,
      camera: event.id === selected?.id ? { ...camera, pitch: Math.max(-85, Math.min(85, camera.pitch)) } : { ...event.camera, fov: camera.fov } })));
  };
  const draftCamera = useCallback((camera: CameraConfiguration) => {
    if (isTransition) setTransitionCamera(camera); else if (selected) setViewDraft({ id: selected.id, camera });
  }, [isTransition, selected]);
  const selectEvent = (id: string) => { if (viewDraft) commit(workingDrill); setViewDraft(null); setTransitionCamera(null); setZoneDraft(null); setSelectedId(id); setSequence(false); setSequenceRange(null); };
  const changePlayerHand = (hand: OpponentHand) => {
    if (hand === playerHand) return;
    setTransitionCamera(null); updateDrill(playerDrillForHand(workingDrill, hand)); onPlayerHandChange(hand);
  };
  const addEvent = (id = savedShots[0]?.id, insertion = events.length) => {
    if (events.length >= 200) { setMessage('A drill can contain up to 200 player shots.'); return; }
    const saved = savedShots.find(item => item.id === id);
    if (!saved) return;
    const source = { ...cloneEvent(saved.event), presetId: saved.id, label: saved.name };
    const oriented = playerEventForHand(source, saved.playerHand ?? 'right', playerHand);
    const event = { ...oriented, camera: { ...oriented.camera, fov: workingDrill.events[0]?.camera.fov ?? oriented.camera.fov } };
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
    replaceEvents(next); if (selectedId === id || transitionId === id) {
      setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? 'launch'); setTransitionCamera(null); setSequence(false);
    }
  };
  const reorder = (id: string, insertion: number) => {
    const next = [...workingDrill.events], from = next.findIndex(event => event.id === id); if (from < 0) return;
    const [event] = next.splice(from, 1); next.splice(insertion > from ? insertion - 1 : insertion, 0, event!); replaceEvents(next);
  };
  useEditorCameraMovement(previewCamera, !!selected && !overview && !sequence && !shotDraft && !message && !creatingShot && !libraryMenuOpen,
    draftCamera, commitCamera);
  const draftLook = useCallback((look: Pick<CameraConfiguration, 'yaw' | 'pitch'>) => {
    draftCamera({ ...previewCamera, ...look, pitch: Math.max(-85, Math.min(85, look.pitch)) });
  }, [draftCamera, previewCamera]);
  const lookEnabled = !!selected && !overview && !sequence;
  const issues = preview.current ? preview.session?.planningIssues ?? [] : [];
  const shotIssues = shotPreview.current ? shotPreview.session?.planningIssues ?? [] : [];

  const saveDrill = async () => {
    setSaving(true); captureDraft();
    try {
      const saved = await onSave(workingDrill);
      const previousId = drill.id;
      savedDrill.current = saved;
      setViewDraft(null); commit(saved);
      latestDraft.current = { ...latestDraft.current, drill: saved, savedDrill: saved };
      onDraftChange(latestDraft.current, previousId);
    } catch (error) { if (error instanceof SaveCancelled) return; setMessage(error instanceof Error ? error.message : 'Save failed. Your draft is retained.'); }
    finally { setSaving(false); }
  };
  return <main ref={root} className="app-shell editor-shell">
    <AppHeader route={route} onRoute={onRoute}/>
    <section className="editor-workspace">
      <ShotLibrary savedShots={savedShots} projectShotIds={projectShotIds} notice={shotNotice} writable={shotsWritable} onAdd={addEvent}
        onCreate={() => setCreatingShot(true)} onMenuChange={setLibraryMenuOpen}
        onDelete={async id => { const name = savedShots.find(shot => shot.id === id)?.name; await onDeleteShot(id); setShotNotice(`Deleted “${name}” from the shot library.`); }}/>
      <section className="editor-stage">
        <div className="editor-scene" ref={sceneContainer}>
          {trajectory && events.length ? <CourtViewport onPreviewAudioFrame={onPreviewAudioFrame} camera={displayCamera} courtOverview={overview} playerCamera={previewCamera} onPlayerCameraChange={overview && selected && !sequence ? commitCamera : undefined} trajectory={trajectory} surface={surface} running={!launching} resetToken={0} showTrajectory={showTrajectory || overview} showOpponentLandingZone session={launching ? undefined : session!} sessionClock={launching ? START_CLOCK : clock} followSessionCamera={sequence && !overview}
            shotPreviewPending={launching || (sequence ? !preview.current : !shotPreview.current)}
            nearLandingZone={sequence ? session?.repetitions[previewIndex]?.trajectory.intent.landingZone : nearZone} nearLandingZoneLimits={nearLimits} returnLandingZone={!sequence && zoneDraft?.role === 'player' ? zoneDraft.zone : (sequence ? playingEvent : selected)?.landingZone}
            onLandingZoneDraft={sequence || isTransition ? undefined : zone => setZoneDraft(zone ? { role: 'opponent', zone } : null)}
            onReturnLandingZoneDraft={sequence || isTransition ? undefined : zone => setZoneDraft(zone ? { role: 'player', zone } : null)}
            onSessionIndex={sequence ? index => setPreviewIndex(index) : undefined}
            opponentPlacement={overview && isOpening ? { ...feed.position, hand: feed.ball.hand } : undefined}
            onOpponentPositionChange={overview && isOpening ? placeOpponent : undefined}
            onLandingZoneChange={sequence || isTransition ? undefined : zone => isOpening ? updateFeed({ ...feed, landingZone: zone }) : selected && updateEvent({ opponentReturn: { ...selected.opponentReturn, landingZone: zone } })}
            onReturnLandingZoneChange={!sequence && !isTransition && selected ? zone => updateEvent({ landingZone: zone }) : undefined}
            onCameraLookChange={lookEnabled ? draftLook : undefined}
            onCameraFovChange={overview ? zoomOverview : lookEnabled ? fov => draftCamera({ ...previewCamera, fov }) : undefined}
            onCameraViewCommit={lookEnabled ? commitCamera : undefined} onMetrics={noMetrics}/> : <div className="editor-preview-loading">{events.length ? t("Preparing drill preview…") : t("Add your first shot from the library.")}</div>}
          <div className="editor-scene-label"><span>{isOpening ? t("Opening shot") : isTransition ? t("Camera {0} → {1}", {"0": events.indexOf(selected!) + 1, "1": events.indexOf(selected!) + 2}) : t("Your shot {0}", {"0": events.indexOf(selected!) + 1})}</span><strong>{isOpening ? t("Opponent initiates the rally") : isTransition ? `${selected.label} → ${nextEvent.label}` : selected?.label ?? t("Add a player shot")}</strong></div>
          <div className="editor-view-tools"><button type="button" role="switch" aria-label={t("Trajectory")} aria-checked={showTrajectory || overview} disabled={overview} title={overview ? t("Always shown in top-down view") : undefined} onClick={() => setShowTrajectory(value => !value)}>{t("Trajectory")} {showTrajectory || overview ? t("on") : t("off")}</button><button type="button" aria-pressed={overview} onClick={() => { setSequence(false); setOverview(value => !value); }}>{overview ? t("Back to shot view") : t("Top-down zones")}</button>
            {!isOpening && !isTransition && compiled ? <button type="button" disabled={sequence || !!viewDraft || !!zoneDraft || !preview.current || !!issues.length}
              onClick={() => { setSequenceRange({ start: Math.max(0, compiled.startTime - 1.5), end: compiled.responseIndex === undefined
                ? preview.session!.scheduledFlights!.find(flight => flight.phase === 'player' && flight.eventIndex === compiled.index)!.endTime
                : Math.min(nextCompiled?.startTime ?? preview.session!.duration, compiled.startTime + 1.2) }); setOverview(false); setSequence(true); }}>{t("Preview actual shot")} </button> : null}
            <span><i className="return-swatch"/>{t("Your landing")} <i className="landing-swatch"/>{isOpening ? t("Opening landing") : t("Opponent return")}</span></div>
          <div className="editor-preview-status" role="status">{sequence ? t("Actual sequence") : shotPreview.pending ? t("Updating shot…") : shotPreview.error || (shotIssues.length ? t("Shot needs adjustment") : issues.length ? t("Isolated shot · Sequence needs adjustment") : isOpening ? t("Opening preview") : t("Isolated shot · Estimated contact"))}</div>
        </div>
        <DrillTimeline drill={drill} selectedId={isOpening || isTransition ? selectedId : selected?.id ?? ''} onSelect={selectEvent} onInsert={addEvent} onMove={reorder} onRemove={remove}
          playing={sequence} previewDisabled={!session || preview.pending || !!preview.error || !validation.valid || !!issues.length}
          onPreview={() => { if (viewDraft) commit(workingDrill); setViewDraft(null); setSequenceRange(null); setOverview(false); setSequence(value => !value); }}/>
      </section>
      <aside className="event-inspector">
        <PlayerHandControls hand={playerHand} onChange={changePlayerHand}/>
        <details className="editor-section"><summary data-section-key="Drill configuration">{t("Drill configuration")}</summary>
          <label className="stack-field"><span>{t("Drill title")}</span><input value={drill.title} maxLength={100} onChange={e => updateDrill({ title: e.target.value })}/></label>
          <label className="stack-field"><span>{t("Description")}</span><textarea aria-label={t("Description")} value={drill.description} maxLength={400} rows={3} onChange={e => updateDrill({ description: e.target.value })}/></label>
          <EditorNumber label={t("Default player interval (s)")} value={drill.defaultInterval} min={1} max={30} step={.1} onChange={defaultInterval => updateDrill({ defaultInterval })}/>
          <EditorNumber label={t("Default movement pace (%)")} value={drill.defaultMovementPercent ?? 100} min={50} max={300} step={5} onChange={defaultMovementPercent => updateDrill({ defaultMovementPercent })}/>
          <EditorNumber label={t("Default stroke rhythm (%)")} value={drill.defaultRhythmPercent ?? 100} min={50} max={300} step={5} onChange={defaultRhythmPercent => updateDrill({ defaultRhythmPercent })}/>
        </details>
        <div className="inspector-divider"><span>{isOpening ? t("Opening shot") : isTransition ? t("Selected camera transition") : t("Selected player shot")}</span>{!isTransition ? <div><button type="button" onClick={duplicate} disabled={isOpening || !selected || events.length >= 200} aria-label={t("Duplicate event")}><Copy size={15}/></button><button type="button" onClick={() => remove()} disabled={isOpening || !selected} aria-label={t("Delete event")}><Trash2 size={15}/></button></div> : null}</div>
        {isOpening ? <><OpeningShotControls feed={feed} onChange={updateFeed} resolvedSpeedKmh={!shotPreview.pending ? shotPreview.session?.repetitions[0]?.trajectory.resolved.launchSpeedKmh : undefined}/><button type="button" className="secondary-button full-width" onClick={() => { setOverview(true); setSequence(false); }}>{t("Place opponent on court")}</button>{selected ? <button type="button" className="secondary-button full-width" onClick={() => updateFeed(openingFor(selected, feed.ball.family === 'serve'))}>{t("Use suggested opening for player shot")}</button> : null}</> : selected ? <>
          {isTransition ? <CameraTransitionControls configuration={selected.cameraTransition} camera={previewCamera} captureEnabled={!overview && !sequence}
            onChange={cameraTransition => updateEvent({ cameraTransition })} onView={setTransitionCamera}
            previewDisabled={!transitionWindow || preview.pending || !!issues.length || !!preview.error || sequence}
            onPreview={() => { if (!transitionWindow) return; setOverview(false); setSequenceRange({ start: transitionWindow.start, end: transitionWindow.end }); setSequence(true); }}/>
            : <DrillShotControls event={selected} drill={drill} camera={previewCamera} onChange={updateEvent} onCameraChange={commitCamera} onEditOpening={() => selectEvent(`opening:${selected.id}`)}/>}
          {compiled?.timing && !preview.pending ? <p className="saved-shot-count">{t("Player contacts")} {compiled.timing.actual.toFixed(2)} {t("s apart")}{compiled.timing.limited ? t(" · requested {0} s", {"0": compiled.timing.requested.toFixed(2)}) : ''}.</p> : null}
          <button className="secondary-button full-width save-shot-button" type="button" onClick={() => setShotDraft({ mode: selected.presetId ? 'update' : 'new', event: snapshotPlayerShot({ ...selected, camera: isTransition ? selected.camera : previewCamera }, workingDrill) })}><Save size={16}/> {t("Save shot")}</button>
        </> : null}
        <AudioSettings />
        {[...validation.errors, ...issues.map(issue => issue.message), ...shotIssues.map(issue => issue.message), ...(preview.error ? [preview.error] : [])].length ? <ul className="validation-errors">{[...new Set([...validation.errors, ...issues.map(issue => issue.message), ...shotIssues.map(issue => issue.message), ...(preview.error ? [preview.error] : [])])].map(error => <li key={error}>{translateMessage(error)}</li>)}</ul> : null}
        <div className="editor-primary-actions"><small className="project-save-status">{writable ? t("Draft retained here. Save drill to keep a library version.") : translateMessage(projectStatus)}</small><button className="primary-button" type="button" disabled={!validation.valid || !writable || saving} onClick={() => void saveDrill()}><Save size={17}/> {saving ? t("Saving…") : t("Save drill")}</button>
          <button className="secondary-button full-width" type="button" disabled={!validation.valid || preview.pending || !!issues.length || !!preview.error} onClick={() => onTest(workingDrill, showTrajectory)}><Play size={16}/> {t("Test drill")}</button></div>
      </aside>
    </section>
    {creatingShot ? <NewShotModal hand={playerHand} savedShots={savedShots} writable={shotsWritable} status={shotsStatus} onClose={() => setCreatingShot(false)}
      onSave={async shot => { const saved = await onSaveShot(shot); setShotNotice(`Created “${saved.name}”. Click or drag it onto the timeline.`); setCreatingShot(false); }}/> : null}
    {shotDraft ? <SavedShotModal {...shotDraft} playerHand={playerHand} savedShots={savedShots} writable={shotsWritable} projectStatus={shotsStatus} projectShotIds={projectShotIds} onClose={() => setShotDraft(null)}
      onSave={async (shot, targetId) => { const saved = await onSaveShot(shot, targetId); updateEvent({ presetId: saved.id, label: saved.name }); setShotNotice(`Saved “${saved.name}”.`); setShotDraft(null); }}
      onDelete={async id => { await onDeleteShot(id); setShotNotice('Shot removed from the library.'); setShotDraft(null); }}/>
      : null}
    {message ? <Modal title={t("Drill editor")} onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>{t("Close")}</button>}><p>{translateMessage(message)}</p></Modal> : null}
  </main>;
}
