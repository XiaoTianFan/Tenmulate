import { Fragment, useState, type DragEvent } from 'react';
import { Camera, Play, Plus, Square } from 'lucide-react';
import type { DrillDefinitionV2 } from '../content/types';
import { SHOT_DRAG_TYPE } from './ShotLibrary';

const EVENT_DRAG_TYPE = 'application/x-tenmulate-event';
const TRACKS = ['Your shot', 'Your ball', 'Opponent', 'Shot view', 'Cue'] as const;
export function DrillTimeline({ drill, selectedId, onSelect, onInsert, onMove, onRemove, playing, previewDisabled, onPreview }: {
  drill: DrillDefinitionV2; selectedId: string;
  onSelect: (id: string) => void; onInsert: (id: string, index: number) => void;
  onMove: (id: string, index: number) => void; onRemove: (id: string) => void;
  playing: boolean; previewDisabled: boolean; onPreview: () => void;
}) {
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const events = drill.events ?? [];
  const columns = events.flatMap((_, index) => index < events.length - 1 ? ['125px', '34px'] : ['125px']).concat('125px').join(' ');
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
      <strong>{drill.title}</strong><span>{events.length} player shots</span>
      <button type="button" className="sequence-preview-button" disabled={previewDisabled && !playing} aria-pressed={playing} onClick={onPreview}>{playing ? <Square size={14}/> : <Play size={14}/>} {playing ? 'Stop preview' : 'Preview sequence'}</button></div>
    <div className="timeline-body">
      {events.length ? TRACKS.map(track => <div className="timeline-track" key={track}>
        <strong>{track}</strong><div className="track-events" style={{ gridTemplateColumns: columns }}>
          {events.map((event, index) => {
            const camera = event.camera;
            const text = track === 'Your shot' ? `${index + 1}. ${event.openingFeed ? 'New point · ' : ''}${event.label}`
              : track === 'Your ball' ? `${Math.round(event.ball.paceKmh)} km/h · ${event.ball.spin}`
              : track === 'Opponent' ? index === events.length - 1 || events[index + 1]?.openingFeed ? 'Point ends' : `${event.opponentReturn.ball.family} · ${event.opponentReturn.ball.paceKmh} km/h`
              : track === 'Shot view' ? `${camera.lateral.toFixed(1)} m · ${camera.yaw.toFixed(0)}°` : event.cue;
            const custom = event.cameraTransition?.movement?.destination && event.cameraTransition.movement.destination !== 'auto'
              || Object.values(event.cameraTransition?.focus ?? {}).some(target => target.mode !== 'auto');
            return <Fragment key={event.id}><button type="button" draggable aria-label={`${track} ${index + 1}: ${text}`}
              className={`timeline-clip${event.id === selectedId ? ' selected' : ''}${dropIndex === index ? ' drop-before' : ''}`}
              onClick={() => onSelect(event.id)} title={`${text} · Right-click to remove`}
              onContextMenu={e => { e.preventDefault(); onRemove(event.id); }}
              onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(event.id); } }}
              onDragStart={e => { e.dataTransfer.setData(EVENT_DRAG_TYPE, event.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => setDropIndex(null)}
              onDragOver={e => { if (accepts(e)) { e.preventDefault(); e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); setDropIndex(index + (e.clientX > b.left + b.width / 2 ? 1 : 0)); } }}
              onDrop={e => { const b = e.currentTarget.getBoundingClientRect(); drop(e, index + (e.clientX > b.left + b.width / 2 ? 1 : 0)); }}
            >{text}</button>{index < events.length - 1 ? <div className="timeline-transition-slot">
              {track === 'Your shot' ? <button type="button" className={`timeline-camera-transition${selectedId === `camera:${event.id}` ? ' selected' : ''}`}
                aria-label={`Camera transition ${index + 1} to ${index + 2}`} aria-pressed={selectedId === `camera:${event.id}`}
                title={`Camera ${index + 1} → ${index + 2} · ${custom ? 'Custom' : 'Automatic'}`}
                onClick={() => onSelect(`camera:${event.id}`)}><Camera size={14}/><span>{custom ? 'Custom' : 'Auto'}</span></button> : null}
            </div> : null}</Fragment>;
          })}
          <div className={`timeline-drop-end${dropIndex === events.length ? ' active' : ''}`} aria-label="Drop shot at end"><Plus size={15}/></div>
        </div>
      </div>) : <div className="timeline-empty">Drop a shot here to start a drill.</div>}
    </div>
    <small className="timeline-help">Drag to add or reorder · Right-click a shot to remove · Select a narrow camera event to edit movement and focus</small>
  </div>;
}
