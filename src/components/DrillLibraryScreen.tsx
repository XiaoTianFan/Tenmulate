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

type Props = {
  route: AppRoute; drills: readonly DrillDefinitionV2[]; projectIds: readonly string[];
  writable: boolean; projectStatus: string;
  playerHand: OpponentHand; onPlayerHandChange: (hand: OpponentHand) => void;
  onRoute: (route: AppRoute) => void;
  onRun: (drill: DrillDefinitionV2, rhythm: number, interval: number, movement: number) => void;
  onEdit: (drill: DrillDefinitionV2) => void;
  onSave: (drill: DrillDefinitionV2) => Promise<DrillDefinitionV2>;
  onDelete: (id: string) => Promise<void>;
};

export function DrillLibraryScreen({ route, drills, projectIds, writable, projectStatus, playerHand, onPlayerHandChange, onRoute, onRun, onEdit, onSave, onDelete }: Props) {
  const [selectedId, setSelectedId] = useState(drills[0]?.id ?? '');
  const [rhythmOverride, setRhythmOverride] = useState<number | null>(null);
  const [intervalOverride, setIntervalOverride] = useState<number | null>(null);
  const [movementOverride, setMovementOverride] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const authored = drills.find(drill => drill.id === selectedId) ?? drills[0];
  const selected = useMemo(() => authored && playerDrillForHand(authored, playerHand), [authored, playerHand]);
  const inProject = !!selected && projectIds.includes(selected.id);
  const rhythm = rhythmOverride ?? selected?.defaultRhythmPercent ?? rhythmFromLegacyInterval(selected?.defaultInterval ?? 4.5);
  const interval = intervalOverride ?? selected?.defaultInterval ?? 4.5;
  const movement = movementOverride ?? selected?.defaultMovementPercent ?? 100;
  const uniqueTitle = (base: string) => {
    let title = base, suffix = 2;
    while (drills.some(drill => drillNameKey(drill.title) === drillNameKey(title))) {
      const ending = ' ' + suffix++; title = base.slice(0, 100 - ending.length) + ending;
    }
    return title;
  };
  const createNew = () => {
    const source = copyPlayerDrill(playerDrillForHand(PLAYER_DRILLS[0]!, playerHand));
    onEdit({ ...source, title: uniqueTitle('New drill'), description: '', events: [], defaultRepetitions: 1 });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const saved = await onSave(parsePlayerDrillJson(await file.text()));
      setSelectedId(saved.id); setMessage('Saved “' + saved.title + '” to the project.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    try { await onDelete(selected.id); setSelectedId(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Delete failed.'); }
    finally { setBusy(false); }
  };

  return <main className="app-shell library-shell">
    <AppHeader route={route} onRoute={onRoute}/>
    <section className="library-layout">
      <section className="drill-table" aria-label="Available drills">
        <header><span>Drill library · {drills.length}</span><span>Family</span><span>Your shots</span><span>Rhythm</span></header>
        {drills.map(drill => <button key={drill.id} type="button" className={'drill-table-row' + (drill.id === selected?.id ? ' selected' : '')}
          onClick={() => { setSelectedId(drill.id); setRhythmOverride(null); setIntervalOverride(null); setMovementOverride(null); }}>
          <span><strong>{drill.title}</strong><small>{drill.description}</small></span><span>{drill.category}</span>
          <span>{drill.events.length}</span><span>{drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)}%</span>
        </button>)}
        {!drills.length ? <p className="empty-library">Create a drill or import JSON to start your library.</p> : null}
      </section>
      <aside className="library-inspector">
        <div className="library-inspector-body">
          {selected ? <>
            <span className="eyebrow">{inProject ? 'Project drill' : 'Browser recovery'}</span>
            <h2>{selected.title}</h2><p>{selected.description}</p>
            <dl><div><dt>Category</dt><dd>{selected.category}</dd></div>
              <div><dt>Sequence</dt><dd>{selected.events.length} player shots</dd></div>
              <div><dt>Storage</dt><dd>{inProject ? 'Project' : 'Browser · save to project'}</dd></div></dl>
            <PlayerHandControls hand={playerHand} onChange={onPlayerHandChange}/>
            <RangeField label="Stroke rhythm" value={rhythm} min={50} max={300} step={5} unit="%" onChange={setRhythmOverride}/>
            <RangeField label="Shot interval" value={interval} min={1} max={30} step={.1} unit="s" onChange={setIntervalOverride}/>
            <RangeField label="Movement pace" value={movement} min={50} max={300} step={5} unit="%" onChange={setMovementOverride}/>
            <button className="primary-button" type="button" disabled={busy} onClick={() => onRun(selected, rhythm, interval, movement)}><Play size={17}/> Run drill</button>
            <button className="secondary-button full-width" type="button" disabled={busy} onClick={() => onEdit(selected)}><PencilLine size={16}/> Edit drill</button>
            <button className="secondary-button full-width" type="button" disabled={busy} onClick={() => {
              const copy = copyPlayerDrill(selected); onEdit({ ...copy, title: uniqueTitle(copy.title) });
            }}><Copy size={16}/> Make editable copy</button>
            <button className="text-action centered" type="button" onClick={() => downloadDrill(selected)}><Download size={15}/> Export JSON</button>
            <button className="danger-action" type="button" disabled={busy || inProject && !writable} onClick={() => void remove()}><Trash2 size={15}/> Delete drill</button>
          </> : <h2>Drill library</h2>}
        </div>
        <div className="library-actions">
          <button className="primary-button" type="button" disabled={busy} onClick={createNew}><PencilLine size={17}/> Create new drill</button>
          <button className="secondary-button full-width" type="button" disabled={busy || !writable} onClick={() => inputRef.current?.click()}><FileUp size={16}/> Import JSON</button>
          <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={event => void importFile(event.target.files?.[0])}/>
          <small role="status">{busy ? 'Updating project…' : projectStatus}</small>
        </div>
      </aside>
    </section>
    <footer className="safety-footer">Project drill library · Same-name saves update the existing drill</footer>
    {message ? <Modal title="Drill library" onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>Close</button>}><p>{message}</p></Modal> : null}
  </main>;
}
