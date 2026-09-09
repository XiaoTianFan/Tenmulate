import { useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { SHOT_BY_ID, drillShotPace } from '../content/bundled';
import type { DrillDefinitionV1 } from '../content/types';
import type { CameraConfiguration } from '../engine/rendering/TennisScene';
import { DEFAULT_RETURN_LANDING_ZONE } from '../engine/session/returnLandingZone';
import { SHOT_DRAG_TYPE } from './ShotLibrary';
import { normalizeShotSpin } from '../domain/shotKinds';

const EVENT_DRAG_TYPE = 'application/x-tenmulate-event';
const TRACKS = ['Shot', 'Ball', 'Return', 'Camera', 'Cue'] as const;
export function DrillTimeline({ drill, selectedId, cameras, onSelect, onInsert, onMove, onRemove }: {
  drill: DrillDefinitionV1; selectedId: string; cameras: ReadonlyMap<string, CameraConfiguration>;
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
    <div className="timeline-toolbar"><strong>{drill.title}</strong><span>{events.length} shots · {drill.defaultInterval.toFixed(1)} s interval</span></div>
    <div className="timeline-body">
      {events.length ? TRACKS.map(track => <div className="timeline-track" key={track}>
        <strong>{track}</strong><div className="track-events">
          {events.map((event, index) => {
            const shot = SHOT_BY_ID.get(event.shotId)!, camera = cameras.get(event.id)!;
            const zone = event.returnLandingZone ?? DEFAULT_RETURN_LANDING_ZONE;
            const text = track === 'Shot' ? `${index + 1}. ${event.label ?? shot.label}`
              : track === 'Ball' ? `${Math.round(event.paceKmh ?? drillShotPace(shot))} km/h · ${normalizeShotSpin(shot.family, event.spin === 'preset' || !event.spin ? shot.spin : event.spin)}`
              : track === 'Return' ? `${(zone.maxX-zone.minX).toFixed(1)} × ${(zone.maxZ-zone.minZ).toFixed(1)} m · ${((zone.maxZ+zone.minZ)/2).toFixed(1)} m deep`
              : track === 'Camera' ? `${camera.lateral.toFixed(1)} m · ${camera.yaw.toFixed(0)}°` : event.cue || shot.cue;
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
