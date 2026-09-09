import { useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { SHOTS, SHOT_BY_ID, drillShotPace } from '../content/bundled';
import type { SavedShotV1 } from '../content/types';

export const SHOT_DRAG_TYPE = 'application/x-tenmulate-shot';
export function ShotLibrary({ savedShots, notice, onAdd }: {
  savedShots: readonly SavedShotV1[]; notice: string; onAdd: (id: string) => void;
}) {
  const [type, setType] = useState('all'), [source, setSource] = useState('all');
  const items = [
    ...SHOTS.map(shot => ({ id: shot.id, name: shot.label, family: shot.family, pace: drillShotPace(shot), saved: false })),
    ...savedShots.map(item => ({ id: `saved:${item.id}`, name: item.name,
      family: SHOT_BY_ID.get(item.event.shotId)!.family, pace: item.event.paceKmh ?? drillShotPace(SHOT_BY_ID.get(item.event.shotId)!), saved: true })),
  ].filter(item => (type === 'all' || item.family === type) && (source === 'all' || item.saved === (source === 'saved')));
  return <aside className="event-library">
    <header><h1>Shot library</h1><span>{items.length}</span></header>
    <div className="shot-library-filters">
      <select aria-label="Filter shots by type" value={type} onChange={event => setType(event.target.value)}>
        <option value="all">All shot types</option>
        {[...new Set(SHOTS.map(shot => shot.family))].map(family => <option key={family} value={family}>{family[0]!.toUpperCase() + family.slice(1)}</option>)}
      </select>
      <select aria-label="Shot library source" value={source} onChange={event => setSource(event.target.value)}>
        <option value="all">Default &amp; saved</option><option value="default">Default shots</option><option value="saved">Saved shots</option>
      </select>
    </div>
    <p className="saved-shot-count" role="status">{notice || 'Drag onto the timeline, or click to add.'}</p>
    <div className="event-list">
      {items.map(item => <button type="button" key={item.id} className="shot-library-card" draggable
        aria-label={`Add ${item.name}`} title={`Add ${item.name} to the timeline`}
        onDragStart={event => { event.dataTransfer.setData(SHOT_DRAG_TYPE, item.id); event.dataTransfer.effectAllowed = 'copy'; }}
        onClick={() => onAdd(item.id)}>
        <GripVertical size={15}/><span><strong>{item.name}</strong><small>{item.saved ? 'Saved · ' : ''}{item.family} · {Math.round(item.pace)} km/h</small></span><Plus size={16}/>
      </button>)}
      {!items.length ? <p className="saved-shot-count">No shots match this filter.</p> : null}
    </div>
  </aside>;
}
