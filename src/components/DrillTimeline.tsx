import { useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import type { DrillDefinitionV2 } from '../content/types';
import { SHOT_DRAG_TYPE } from './ShotLibrary';

const EVENT_DRAG_TYPE = 'application/x-tenmulate-event';
const TRACKS = ['Your shot', 'Your ball', 'Opponent', 'Camera', 'Cue'] as const;
export function DrillTimeline({ drill, selectedId, onSelect, onInsert, onMove, onRemove }: {
  drill: DrillDefinitionV2; selectedId: string;
  onSelect: (id: string) => void; onInsert: (id: string, index: number) => void;
  onMove: (id: string, index: number) => void; onRemove: (id: string) => void;
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const events = drill.events ?? [];
  const accepts = (event: DragEvent) => [SHOT_DRAG_TYPE, EVENT_DRAG_TYPE].some(type => event.dataTransfer.types.includes(type));
  const drop = (event: DragEvent, index: number) => {
    if (!accepts(event)) return;
    event.preventDefault(); event.stopPropagation(); setDropIndex(null);
    const shot = event.dataTransfer.getData(SHOT_DRAG_TYPE), id = event.dataTransfer.getData(EVENT_DRAG_TYPE);
    if (shot) onInsert(shot, index); else if (id) onMove(id, index);
  };
  return <div className="timeline" aria-label="Drill timeline" onDragOver={event => {
    if (accepts(event)) { event.preventDefault(); setDropIndex(events.length); }
  }} onDrop={event => drop(event, events.length)} onDragLeave={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null);
  }}>
    <div className="timeline-toolbar"><button type="button" className={`opening-chip${selectedId === 'launch' ? ' selected' : ''}`} onClick={() => onSelect('launch')}>Opening · Opponent {drill.launch.ball.family === 'serve' ? 'serve' : 'feed'}</button>
      {events.map((event, index) => event.openingFeed ? <button type="button" key={event.id} className={`opening-chip${selectedId === `opening:${event.id}` ? ' selected' : ''}`} onClick={() => onSelect(`opening:${event.id}`)}>Opening before {index + 1}</button> : null)}
      <strong>{drill.title}</strong><span>{events.length} player shots</span></div>
    <div className="timeline-body">
      {events.length ? TRACKS.map(track => <div className="timeline-track" key={track}>
        <strong>{track}</strong><div className="track-events">
          {events.map((event, index) => {
            const camera = event.camera;
            const text = track === 'Your shot' ? `${index + 1}. ${event.openingFeed ? 'New point · ' : ''}${event.label}`
              : track === 'Your ball' ? `${Math.round(event.ball.paceKmh)} km/h · ${event.ball.spin}`
              : track === 'Opponent' ? index === events.length - 1 || events[index + 1]?.openingFeed ? 'Point ends' : `${event.opponentReturn.ball.family} · ${event.opponentReturn.ball.paceKmh} km/h`
              : track === 'Camera' ? `${camera.lateral.toFixed(1)} m · ${camera.yaw.toFixed(0)}°` : event.cue;
            return <button type="button" draggable key={event.id} aria-label={`${track} ${index + 1}: ${text}`}
              className={`timeline-clip${event.id === selectedId ? ' selected' : ''}${dropIndex === index ? ' drop-before' : ''}`}
              onClick={() => onSelect(event.id)} title={`${text} · Right-click to remove`}
              onContextMenu={e => { e.preventDefault(); onRemove(event.id); }}
              onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(event.id); } }}
              onDragStart={e => { e.dataTransfer.setData(EVENT_DRAG_TYPE, event.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => setDropIndex(null)}
              onDragOver={e => { if (accepts(e)) { e.preventDefault(); e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); setDropIndex(index + (e.clientX > b.left + b.width / 2 ? 1 : 0)); } }}
              onDrop={e => { const b = e.currentTarget.getBoundingClientRect(); drop(e, index + (e.clientX > b.left + b.width / 2 ? 1 : 0)); }}
            >{text}</button>;
          })}
          <div className={`timeline-drop-end${dropIndex === events.length ? ' active' : ''}`} aria-label="Drop shot at end"><Plus size={15}/></div>
        </div>
      </div>) : <div className="timeline-empty">Drop a shot here to start a drill.</div>}
    </div>
    <small className="timeline-help">Drag to add or reorder · Right-click to remove · Undo restores a removed shot</small>
  </div>;
}
