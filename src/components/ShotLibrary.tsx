import { useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { PLAYER_SHOT_BY_ID } from '../content/playerShots';
import type { SavedShotV2 } from '../content/types';
import { SHOT_TYPE_LABELS } from '../domain/shotKinds';

export const SHOT_DRAG_TYPE = 'application/x-tenmulate-shot';
export function ShotLibrary({ savedShots, projectShotIds, notice, onAdd }: {
  savedShots: readonly SavedShotV2[]; projectShotIds: readonly string[]; notice: string; onAdd: (id: string) => void;
}) {
  const [type, setType] = useState('all'), [source, setSource] = useState('all');
  const items = savedShots.map(item => ({ id: item.id, name: item.name,
    family: item.event.ball.family, pace: item.event.ball.paceKmh, default: PLAYER_SHOT_BY_ID.has(item.id), project: projectShotIds.includes(item.id) }))
    .filter(item => (type === 'all' || item.family === type) && (source === 'all' || (source === 'default' ? item.default : !item.default)));
  return <aside className="event-library">
    <header><h1>Your shots</h1><span>{items.length}</span></header>
    <div className="shot-library-filters">
      <select aria-label="Filter shots by type" value={type} onChange={event => setType(event.target.value)}>
        <option value="all">All shot types</option>
        {[...new Set(savedShots.map(shot => shot.event.ball.family))].map(family => <option key={family} value={family}>{SHOT_TYPE_LABELS[family]}</option>)}
      </select>
      <select aria-label="Shot library source" value={source} onChange={event => setSource(event.target.value)}>
        <option value="all">All library shots</option><option value="default">Default shots</option><option value="saved">Custom shots</option>
      </select>
    </div>
    <p className="saved-shot-count" role="status">{notice || 'Drag onto the timeline, or click to add.'}</p>
    <div className="event-list">
      {items.map(item => <button type="button" key={item.id} className="shot-library-card" draggable
        aria-label={`Add ${item.name}`} title={`Add ${item.name} to the timeline`}
        onDragStart={event => { event.dataTransfer.setData(SHOT_DRAG_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy'; }}
        onClick={() => onAdd(item.id)}>
        <GripVertical size={15}/><span><strong>{item.name}</strong><small>{!item.project ? 'Browser · ' : ''}{item.family} · {Math.round(item.pace)} km/h</small></span><Plus size={16}/>
      </button>)}
      {!items.length ? <p className="saved-shot-count">No shots match this filter.</p> : null}
    </div>
  </aside>;
}
