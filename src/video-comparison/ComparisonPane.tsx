import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Crosshair, Crop, FlipHorizontal2, GripVertical, X } from 'lucide-react';
import { t } from '../i18n/locale';
import { clamp, clipFrameRange, formatTime } from './timeline';
import type { ComparisonClip } from './types';
import { ClipTimeline } from './ClipTimeline';
import { CropEditor } from './CropEditor';
import { FULL_CROP, normalizeCrop, type CropRect } from './crop';

type Props = {
  clip: ComparisonClip; frame: number; position: number; count: number; held: boolean;
  onFrame: (frame: number) => void; onContact: () => void; onSpeed: (speed: number) => void;
  onRemove: () => void; onResize: (width: number) => void; onMove: (direction: number) => void;
  onDrag: (id: string, x: number, y: number) => void; onDragEnd: () => void;
  onVideo: (id: string, video: HTMLVideoElement | null) => void; onError: () => void; onReady: () => void;
  onCanvas: (id: string, canvas: HTMLCanvasElement | null) => void;
  onMirror: () => void; onCrop: (crop?: CropRect) => void; onTrim: (trim?: { start: number; end: number }) => void; onPause: () => void;
};

export function ComparisonPane({ clip, frame, position, count, held, onFrame, onContact, onSpeed, onRemove, onResize, onMove, onDrag, onDragEnd, onVideo, onCanvas, onMirror, onCrop, onTrim, onPause, onError, onReady }: Props) {
  const mirrored = clip.mirrored ?? false;
  const resize = useRef<{ x: number; width: number } | null>(null);
  const fine = useRef<{ x: number; frame: number } | null>(null);
  const last = (clip.index?.timestamps.length ?? 1) - 1;
  const excerpt = clip.index ? clipFrameRange({ ...clip, index: clip.index }) : { start: 0, end: last };
  const [cropping, setCropping] = useState(false), [dimensions, setDimensions] = useState({ width: 16, height: 9 });
  const [size, setSize] = useState({ width: 1, height: 1 });
  const wrap = useRef<HTMLDivElement>(null), originalCrop = useRef<CropRect | undefined>(undefined);
  useEffect(() => {
    const observer = new ResizeObserver(entries => { const box = entries[0]!.contentRect; setSize({ width: box.width, height: box.height }); });
    if (wrap.current) observer.observe(wrap.current);
    return () => observer.disconnect();
  }, []);
  const crop = cropping ? FULL_CROP : normalizeCrop(clip.crop);
  const aspect = dimensions.width * crop.width / (dimensions.height * crop.height);
  const pictureWidth = Math.min(size.width, size.height * aspect), pictureHeight = pictureWidth / aspect;
  const imageStyle = { width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%` };
  const capture = (event: PointerEvent<HTMLElement>) => event.currentTarget.setPointerCapture(event.pointerId);
  return <article className={`comparison-pane${mirrored ? ' is-mirrored' : ''}`} data-clip-id={clip.id} style={{ width: clip.width }} aria-label={clip.name}>
    <header className="comparison-pane-header"
      onPointerDown={event => { if (!(event.target as HTMLElement).closest('button')) capture(event); }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onDrag(clip.id, event.clientX, event.clientY); }}
      onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
      <button className="comparison-grip" aria-label={t('Drag to reorder {name}', { name: clip.name })} title={t('Drag to reorder')}
        onPointerDown={event => { capture(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onDrag(clip.id, event.clientX, event.clientY); }}
        onPointerUp={onDragEnd} onPointerCancel={onDragEnd}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onMove(event.key === 'ArrowLeft' ? -1 : 1); } }}><GripVertical size={18}/></button>
      <span className="comparison-number">{String(position + 1).padStart(2, '0')}</span>
      <h2 title={clip.name}>{clip.name}</h2>
      <button type="button" className="comparison-crop" aria-label={t('Crop {name}', { name: clip.name })} aria-pressed={cropping || !!clip.crop}
        disabled={!clip.index || !!clip.error} title={t('Crop video')} onClick={() => {
          onPause(); if (cropping) setCropping(false); else { originalCrop.current = clip.crop; setCropping(true); }
        }}><Crop size={17}/></button>
      <button type="button" className="comparison-mirror" aria-label={t('Mirror {name}', { name: clip.name })} aria-pressed={mirrored}
        title={t(mirrored ? 'Restore original orientation' : 'Mirror video horizontally')} disabled={cropping} onClick={onMirror}><FlipHorizontal2 size={17}/></button>
      <button aria-label={t('Remove {name}', { name: clip.name })} onClick={onRemove}><X size={17}/></button>
    </header>
    <div className={`comparison-video-wrap${cropping ? ' is-cropping' : ''}`} ref={wrap}>
      <div className="comparison-picture" style={{ width: pictureWidth, height: pictureHeight }}>
        <div className="comparison-source" style={{ ...imageStyle, transform: mirrored && !cropping ? 'scaleX(-1)' : undefined,
          transformOrigin: mirrored && !cropping ? `${(crop.x + crop.width / 2) * 100}% 50%` : undefined }}>
          <video ref={element => onVideo(clip.id, element)} src={clip.url} muted playsInline preload="auto" disablePictureInPicture
            onLoadedMetadata={event => setDimensions({ width: event.currentTarget.videoWidth || 16, height: event.currentTarget.videoHeight || 9 })}
            onLoadedData={onReady} onError={onError} aria-label={t('Video: {name}', { name: clip.name })}/>
          <canvas ref={element => onCanvas(clip.id, element)} className="comparison-playback-frame" hidden aria-hidden="true"/>
        </div>
        {cropping ? <CropEditor crop={clip.crop} sourceAspect={dimensions.width / dimensions.height} viewportAspect={size.width / (size.height + 104)}
          toolbarTarget={wrap.current} onChange={onCrop} onDone={() => setCropping(false)} onCancel={() => { onCrop(originalCrop.current); setCropping(false); }}/> : null}
      </div>
      {held ? <span className="comparison-held">{t('Holding edge frame')}</span> : null}
      {!clip.index && !clip.error ? <span className="comparison-loading" role="status">{t('Reading frame timestamps…')}</span> : null}
      {clip.error ? <div className="comparison-video-error" role="alert">{t(clip.error)}<button onClick={onRemove}>{t('Remove clip')}</button></div> : null}
    </div>
    <div className="comparison-pane-controls">
      <div className="comparison-frame-info"><span>{t('Frame {frame} / {total}', { frame: frame + 1, total: last + 1 })}</span>
        <span>{clip.index ? `${clip.index.fps.toFixed(2)} ${t(clip.index.variable ? 'fps · variable' : 'fps')}` : '—'}</span></div>
      <ClipTimeline clip={clip} frame={frame} onFrame={onFrame} onTrim={onTrim}/>
      <div className="comparison-fine-scrub" role="slider" tabIndex={clip.index && !clip.error ? 0 : -1}
        aria-disabled={!clip.index || !!clip.error} aria-label={t('Fine scrub {name}', { name: clip.name })}
        aria-valuemin={excerpt.start + 1} aria-valuemax={excerpt.end + 1} aria-valuenow={frame + 1}
        onPointerDown={event => { if (!clip.index || clip.error) return; capture(event); fine.current = { x: event.clientX, frame }; }}
        onPointerMove={event => { if (fine.current && event.currentTarget.hasPointerCapture(event.pointerId)) onFrame(clamp(fine.current.frame + Math.round((event.clientX - fine.current.x) / 8), excerpt.start, excerpt.end)); }}
        onPointerUp={() => { fine.current = null; }} onPointerCancel={() => { fine.current = null; }}
        onKeyDown={event => { if (!clip.index || clip.error) return; if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); onFrame(event.key === 'Home' ? excerpt.start : event.key === 'End' ? excerpt.end : clamp(frame + (event.key === 'ArrowRight' ? 1 : -1), excerpt.start, excerpt.end)); } }}>
        <span className="comparison-fine-ticks" aria-hidden="true"/>
      </div>
      <div className="comparison-settings">
        <label className="comparison-speed"><span>{t('Clip speed')}</span><input type="range" min="0.1" max="2" step="0.05" value={clip.speed} disabled={!clip.index || !!clip.error} aria-label={t('Speed: {name}', { name: clip.name })} onChange={event => onSpeed(Number(event.target.value))}/><output>{clip.speed.toFixed(2)}×</output></label>
        <button className={clip.contact === frame ? 'contact-button is-contact' : 'contact-button'} disabled={!clip.index || !!clip.error}
          aria-pressed={clip.contact === frame} title={clip.contact === null ? t('Set contact') : t('Contact: frame {frame} · {time}', { frame: clip.contact + 1, time: formatTime(clip.index!.timestamps[clip.contact]!) })}
          onClick={onContact}><Crosshair size={15}/>{t('Set contact')}</button>
      </div>
      <div className="comparison-pane-footer"><span>{t('Local clip')}</span><div>
        <button aria-label={t('Move {name} left', { name: clip.name })} disabled={position === 0} onClick={() => onMove(-1)}><ArrowLeft size={14}/></button>
        <button aria-label={t('Move {name} right', { name: clip.name })} disabled={position === count - 1} onClick={() => onMove(1)}><ArrowRight size={14}/></button>
      </div></div>
    </div>
    <div className="comparison-resize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={t('Resize {name}', { name: clip.name })} aria-valuemin={280} aria-valuemax={1000} aria-valuenow={Math.round(clip.width)}
      onPointerDown={event => { capture(event); resize.current = { x: event.clientX, width: event.currentTarget.parentElement!.getBoundingClientRect().width }; }}
      onPointerMove={event => { if (resize.current && event.currentTarget.hasPointerCapture(event.pointerId)) onResize(clamp(resize.current.width + event.clientX - resize.current.x, 280, 1000)); }}
      onPointerUp={() => { resize.current = null; }} onPointerCancel={() => { resize.current = null; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onResize(clamp(event.currentTarget.parentElement!.getBoundingClientRect().width + (event.key === 'ArrowRight' ? 20 : -20), 280, 1000)); } }}/>
  </article>;
}
