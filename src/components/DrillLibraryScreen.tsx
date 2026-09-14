import { t, message as translateMessage } from '../i18n/locale';
import { SaveCancelled } from '../storage/savePolicy';
import { useMemo, useRef, useState } from 'react';
import { Copy, Download, FileUp, PencilLine, Play, Trash2 } from 'lucide-react';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';
import { PLAYER_DRILLS } from '../content/playerDrills';
import { copyPlayerDrill, parsePlayerDrillJson } from '../content/playerMigration';
import type { DrillDefinitionV2, OpponentHand } from '../content/types';
import { playerDrillForHand } from '../content/playerHandedness';
import { drillNameKey } from '../storage/projectCatalog';
import { PlayerHandControls } from './PlayerHandControls';
import { RangeField } from './RangeField';
import { downloadDrill } from '../content/validation';
import { AppHeader, type AppRoute } from './AppHeader';
import { Modal } from './Modal';
import { maxDrillRepetitions, type DrillPracticeSet } from '../app/drillPracticeSet';

type Props = {
  route: AppRoute; drills: readonly DrillDefinitionV2[]; projectIds: readonly string[];
  writable: boolean; projectStatus: string;
  playerHand: OpponentHand; onPlayerHandChange: (hand: OpponentHand) => void;
  onRoute: (route: AppRoute) => void;
  onRun: (drill: DrillDefinitionV2, rhythm: number, interval: number, movement: number, practiceSet: DrillPracticeSet) => void;
  onEdit: (drill: DrillDefinitionV2) => void;
  onSave: (drill: DrillDefinitionV2) => Promise<DrillDefinitionV2>;
  onDelete: (id: string) => Promise<void>;
};

export function DrillLibraryScreen({ route, drills, projectIds, writable, projectStatus, playerHand, onPlayerHandChange, onRoute, onRun, onEdit, onSave, onDelete }: Props) {
  const [selectedId, setSelectedId] = useState(drills[0]?.id ?? '');
  const [rhythmOverride, setRhythmOverride] = useState<number | null>(null);
  const [intervalOverride, setIntervalOverride] = useState<number | null>(null);
  const [movementOverride, setMovementOverride] = useState<number | null>(null);
  const [repetitionsInput, setRepetitionsInput] = useState<string | null>(null);
  const [restInput, setRestInput] = useState('20');
  const [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const authored = drills.find(drill => drill.id === selectedId) ?? drills[0];
  const selected = useMemo(() => authored && playerDrillForHand(authored, playerHand), [authored, playerHand]);
  const inProject = !!selected && projectIds.includes(selected.id);
  const rhythm = rhythmOverride ?? selected?.defaultRhythmPercent ?? rhythmFromLegacyInterval(selected?.defaultInterval ?? 4.5);
  const interval = intervalOverride ?? selected?.defaultInterval ?? 4.5;
  const movement = movementOverride ?? selected?.defaultMovementPercent ?? 100;
  const maxRepetitions = selected ? maxDrillRepetitions(selected) : 1;
  const repetitionValue = repetitionsInput ?? String(Math.min(maxRepetitions, Math.max(1,
    Math.ceil((selected?.defaultRepetitions ?? 1) / Math.max(1, selected?.events.length ?? 1)))));
  const repetitions = Number(repetitionValue), restSeconds = Number(restInput);
  const validSet = repetitionValue.trim() !== '' && Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= maxRepetitions
    && restInput.trim() !== '' && Number.isFinite(restSeconds) && restSeconds >= 0 && restSeconds <= 120;
  const uniqueTitle = (base: string) => {
    let title = base, suffix = 2;
    while (drills.some(drill => drillNameKey(drill.title) === drillNameKey(title))) {
      const ending = ' ' + suffix++; title = base.slice(0, 100 - ending.length) + ending;
    }
    return title;
  };
  const createNew = () => {
    const source = copyPlayerDrill(playerDrillForHand(PLAYER_DRILLS[0]!, playerHand));
    onEdit({ ...source, title: uniqueTitle(t('New drill')), description: '', events: [], defaultRepetitions: 1 });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const saved = await onSave(parsePlayerDrillJson(await file.text()));
      setSelectedId(saved.id);
    } catch (error) { if (error instanceof SaveCancelled) return; setMessage(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try { await onDelete(selected.id); setSelectedId(''); }
    catch (error) { if (error instanceof SaveCancelled) return; setMessage(error instanceof Error ? error.message : 'Delete failed.'); }
    finally { setBusy(false); }
  };

  return <main className="app-shell library-shell">
    <AppHeader route={route} onRoute={onRoute}/>
    <section className="library-layout">
      <section className="drill-table" aria-label={t("Available drills")}>
        <header><span>{t("Drill library ·")} {drills.length}</span><span>{t("Family")}</span><span>{t("Your shots")}</span><span>{t("Rhythm")}</span></header>
        {drills.map(drill => <button key={drill.id} type="button" className={'drill-table-row' + (drill.id === selected?.id ? ' selected' : '')}
          onClick={() => { setSelectedId(drill.id); setRhythmOverride(null); setIntervalOverride(null); setMovementOverride(null); setRepetitionsInput(null); }}>
          <span><strong>{drill.title}</strong><small>{drill.description}</small></span><span>{t(drill.category)}</span>
          <span>{drill.events.length}</span><span>{drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)}%</span>
        </button>)}
        {!drills.length ? <p className="empty-library">{t("Create a drill or import JSON to start your library.")}</p> : null}
      </section>
      <aside className="library-inspector">
        <div className="library-inspector-body">
          {selected ? <>
            <span className="eyebrow">{inProject ? t("Default drill") : t("Browser drill")}</span>
            <h2>{selected.title}</h2><p>{selected.description}</p>
            <dl><div><dt>{t("Category")}</dt><dd>{t(selected.category)}</dd></div>
              <div><dt>{t("Sequence")}</dt><dd>{selected.events.length} {t("player shots")}</dd></div>
              <div><dt>{t("Storage")}</dt><dd>{inProject ? t("Project default") : t("This browser")}</dd></div></dl>
            <PlayerHandControls hand={playerHand} onChange={onPlayerHandChange}/>
            <RangeField label={t("Stroke rhythm")} value={rhythm} min={50} max={300} step={5} unit="%" onChange={setRhythmOverride}/>
            <RangeField label={t("Shot interval")} value={interval} min={1} max={30} step={.1} unit={t("s")} onChange={setIntervalOverride}/>
            <RangeField label={t("Movement pace")} value={movement} min={50} max={300} step={5} unit="%" onChange={setMovementOverride}/>
            <fieldset className="drill-practice-set">
              <legend>{t("Practice set")}</legend>
              <label><span>{t("Total repetitions")}</span><input type="number" min={1} max={maxRepetitions} step={1} value={repetitionValue}
                onChange={event => setRepetitionsInput(event.target.value)} /></label>
              <label><span>{t("Rest between repetitions (s)")}</span><input type="number" min={0} max={120} step={1} value={restInput}
                onChange={event => setRestInput(event.target.value)} /></label>
              <small aria-live="polite">{validSet ? t("{0} complete {1} · {2} player shots{3}", {"0": repetitions, "1": repetitions === 1 ? t('run') : t('runs'), "2": repetitions * selected.events.length, "3": repetitions > 1 ? t(' · {0}s rest between runs', { '0': restSeconds }) : t(' · no rest needed')})
                : t("Enter 1–{0} whole repetitions and 0–120 seconds of rest.", {"0": maxRepetitions})}</small>
            </fieldset>
            <button className="primary-button" type="button" disabled={busy || !validSet || !selected.events.length} onClick={() => onRun(selected, rhythm, interval, movement, { repetitions, restSeconds })}><Play size={17}/> {t("Run drill")}</button>
            <button className="secondary-button full-width" type="button" disabled={busy} onClick={() => onEdit(selected)}><PencilLine size={16}/> {t("Edit drill")}</button>
            <button className="secondary-button full-width" type="button" disabled={busy} onClick={() => {
              const copy = copyPlayerDrill(selected); onEdit({ ...copy, title: uniqueTitle(t('Copy of {0}', { '0': selected.title })) });
            }}><Copy size={16}/> {t("Make editable copy")}</button>
            <button className="text-action centered" type="button" onClick={() => downloadDrill(selected)}><Download size={15}/> {t("Export JSON")}</button>
            <button className="danger-action" type="button" disabled={busy || inProject && !writable} onClick={() => void remove()}><Trash2 size={15}/> {t("Delete drill")}</button>
          </> : <h2>{t("Drill library")}</h2>}
        </div>
        <div className="library-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={createNew}><PencilLine size={17}/> {t("Create new drill")}</button>
          <button className="secondary-button full-width" type="button" disabled={busy || !writable} onClick={() => inputRef.current?.click()}><FileUp size={16}/> {t("Import JSON")}</button>
          <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={event => void importFile(event.target.files?.[0])}/>
          <small role="status">{busy ? t("Saving…") : translateMessage(projectStatus)}</small>
        </div>
      </aside>
    </section>
    <footer className="safety-footer">{t("Drill library · Same-name saves update the existing drill")}</footer>
    {message ? <Modal title={t("Drill library")} onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>{t("Close")}</button>}><p>{translateMessage(message)}</p></Modal> : null}
  </main>;
}
