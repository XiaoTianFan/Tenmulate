import { useMemo, useRef, useState } from 'react';
import { Copy, Download, FileUp, PencilLine, Play, Trash2 } from 'lucide-react';
import { rhythmFromLegacyInterval } from '../engine/session/rhythm';
import { PLAYER_DRILLS as DRILLS } from '../content/playerDrills';
import { copyPlayerDrill as createEditableCopy, parsePlayerDrillJson as parseDrillJson } from '../content/playerMigration';
import type { DrillDefinitionV2, OpponentHand } from '../content/types';
import { playerDrillForHand } from '../content/playerHandedness';
import { PlayerHandControls } from './PlayerHandControls';
import { downloadDrill } from '../content/validation';
import type { AppRoute } from './AppHeader';
import { AppHeader } from './AppHeader';
import { Modal } from './Modal';
import { OfflineStatus } from './OfflineStatus';

type DrillLibraryScreenProps = Readonly<{
  route: AppRoute;
  customDrills: readonly DrillDefinitionV2[];
  playerHand: OpponentHand;
  onPlayerHandChange: (hand: OpponentHand) => void;
  onRoute: (route: AppRoute) => void;
  onRun: (drill: DrillDefinitionV2, rhythmPercent: number, interval: number, movementPercent: number) => void;
  onEdit: (drill: DrillDefinitionV2) => void;
  onSave: (drill: DrillDefinitionV2) => void;
  onDelete: (id: string) => void;
}>;

export function DrillLibraryScreen({ route, customDrills, playerHand, onPlayerHandChange, onRoute, onRun, onEdit, onSave, onDelete }: DrillLibraryScreenProps) {
  const allDrills = [...DRILLS, ...customDrills];
  const [selectedId, setSelectedId] = useState(allDrills[0]?.id ?? '');
  const [rhythmOverride, setRhythmOverride] = useState<number | null>(null);
  const [intervalOverride,setIntervalOverride]=useState<number|null>(null);
  const [movementOverride,setMovementOverride]=useState<number|null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const authored = allDrills.find((drill) => drill.id === selectedId) ?? allDrills[0];
  const selected = useMemo(() => authored && playerDrillForHand(authored, playerHand), [authored, playerHand]);
  const isCustom = Boolean(selected && customDrills.some((drill) => drill.id === selected.id));

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const drill = parseDrillJson(await file.text());
      onSave(drill);
      setSelectedId(drill.id);
      setMessage(`Imported “${drill.title}” into local storage.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <main className="app-shell library-shell">
      <AppHeader route={route} onRoute={onRoute} />
      <section className="library-layout">
        <aside className="library-filter">
          <h1>Drill library</h1>
          <p>Tactics built around your shots.</p>
          <PlayerHandControls hand={playerHand} onChange={onPlayerHandChange}/>
          <button className="primary-button" type="button" onClick={() => onEdit(createEditableCopy(playerDrillForHand(DRILLS[5]!, playerHand)))}><PencilLine size={17} /> New custom drill</button>
          <button className="secondary-button library-import" type="button" onClick={() => inputRef.current?.click()}><FileUp size={16} /> Import JSON</button>
          <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
          <OfflineStatus />
        </aside>

        <section className="drill-table" aria-label="Available drills">
          <header><span>Drill</span><span>Family</span><span>Your shots</span><span>Rhythm</span></header>
          {allDrills.map((drill) => (
            <button key={drill.id} type="button" className={drill.id === selected?.id ? 'drill-table-row selected' : 'drill-table-row'} onClick={() => { setSelectedId(drill.id); setRhythmOverride(null); setIntervalOverride(null); setMovementOverride(null); }}>
              <span><strong>{drill.title}</strong><small>{drill.description}</small></span>
              <span>{drill.category}</span>
              <span>{drill.events.length}</span>
              <span>{drill.defaultRhythmPercent ?? rhythmFromLegacyInterval(drill.defaultInterval)}%</span>
            </button>
          ))}
        </section>

        {selected ? (
          <aside className="library-inspector">
            <span className="eyebrow">{isCustom ? 'Local custom drill' : 'Bundled drill'}</span>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
            <dl>
              <div><dt>Category</dt><dd>{selected.category}</dd></div>
              <div><dt>Sequence</dt><dd>{selected.events.length} player shots</dd></div>
              <div><dt>Default set</dt><dd>{selected.defaultRepetitions} player shots</dd></div>
              <div><dt>Rhythm</dt><dd>{rhythmOverride ?? selected.defaultRhythmPercent ?? rhythmFromLegacyInterval(selected.defaultInterval)}%</dd></div>
              <div><dt>Storage</dt><dd>{isCustom ? 'This browser' : 'App bundle'}</dd></div>
            </dl>
            <label className="stack-field"><span>Stroke rhythm (%)</span><input aria-label="Drill rhythm" type="range" min="50" max="300" step="5" value={rhythmOverride ?? selected.defaultRhythmPercent ?? rhythmFromLegacyInterval(selected.defaultInterval)} onChange={event => setRhythmOverride(Number(event.target.value))} /></label>
            <label className="stack-field"><span>Shot interval (s)</span><input aria-label="Drill shot interval" type="number" min="1" max="30" step="0.1" value={intervalOverride??selected.defaultInterval} onChange={event=>setIntervalOverride(Number(event.target.value))}/></label>
            <label className="stack-field"><span>Movement pace (%)</span><input aria-label="Drill movement pace" type="range" min="50" max="300" step="5" value={movementOverride??selected.defaultMovementPercent??100} onChange={event=>setMovementOverride(Number(event.target.value))}/></label>
            <button className="primary-button" type="button" onClick={() => onRun(selected, rhythmOverride ?? selected.defaultRhythmPercent ?? rhythmFromLegacyInterval(selected.defaultInterval), intervalOverride??selected.defaultInterval, movementOverride??selected.defaultMovementPercent??100)}><Play size={17} /> Run drill</button>
            <button className="secondary-button full-width" type="button" onClick={() => onEdit(isCustom ? selected : createEditableCopy(selected))}>{isCustom ? <PencilLine size={16} /> : <Copy size={16} />} {isCustom ? 'Edit drill' : 'Make editable copy'}</button>
            <button className="text-action centered" type="button" onClick={() => downloadDrill(selected)}><Download size={15} /> Export JSON</button>
            {isCustom ? <button className="danger-action" type="button" onClick={() => { onDelete(selected.id); setSelectedId(DRILLS[0]!.id); }}><Trash2 size={15} /> Delete local drill</button> : null}
          </aside>
        ) : null}
      </section>
      <footer className="safety-footer">Local-first authoring · Imported files are validated before storage</footer>
      {message ? <Modal title="Drill library" onClose={() => setMessage(null)} actions={<button className="primary-button inline" type="button" onClick={() => setMessage(null)}>Close</button>}><p>{message}</p></Modal> : null}
    </main>
  );
}
