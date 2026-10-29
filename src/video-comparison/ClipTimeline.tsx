import { useEffect, useState } from 'react';
import { t } from '../i18n/locale';
import { ReviewTimeline } from './ReviewTimeline';
import { clipFrameRange } from './timeline';
import { makeFilmstrip } from './localVideo';
import type { ComparisonClip } from './types';
import type { TimelineWindow } from './timelineView';

export function ClipTimeline({ clip, frame, onFrame, onTrim }: { clip: ComparisonClip; frame: number; onFrame: (frame: number) => void; onTrim: (trim?: TimelineWindow) => void }) {
  const last = (clip.index?.timestamps.length ?? 1) - 1;
  const selection = clip.index ? clipFrameRange({ ...clip, index: clip.index }) : { start: 0, end: 0 };
  const [view, setView] = useState<TimelineWindow>({ start: 0, end: last });
  const cropKey = JSON.stringify(clip.crop);
  const [detail, setDetail] = useState<{ start: number; end: number; images: string[]; cropKey: string | undefined } | null>(null);
  useEffect(() => {
    if (!clip.index || (!clip.crop && view.end - view.start >= last - 1) || view.end <= view.start) { setDetail(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void makeFilmstrip(clip.url, clip.index!, controller.signal, Math.round(view.start), Math.round(view.end), clip.crop).then(images => {
        if (!controller.signal.aborted) setDetail({ ...view, images, cropKey });
      }).catch(() => {});
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [clip.url, clip.index, view.start, view.end, last, cropKey]);
  const images = detail?.start === view.start && detail.end === view.end && detail.cropKey === cropKey ? detail.images : null;
  return <>
    <ReviewTimeline min={0} max={last} value={frame} step={1} selection={selection} disabled={!clip.index || !!clip.error}
      label={t('Scrub {name}', { name: clip.name })} startLabel={t('Excerpt start: {name}', { name: clip.name })} endLabel={t('Excerpt end: {name}', { name: clip.name })}
      valueText={n => t('Frame {frame}', { frame: Math.round(n) + 1 })} contact={clip.contact ?? undefined} onChange={onFrame} onRange={onTrim} onView={setView}>
      <div className="comparison-thumbnails" style={images ? undefined : { width: `${last / (view.end - view.start || last || 1) * 100}%`, marginLeft: `${-view.start / (view.end - view.start || last || 1) * 100}%` }}>
        {(images ?? clip.thumbnails).map((image, i) => <img key={i} src={image} alt="" draggable={false}/>)}</div>
    </ReviewTimeline>
    <div className="clip-excerpt-controls"><span>{t('Excerpt: {start}–{end}', { start: selection.start + 1, end: selection.end + 1 })}</span><div>
      <button type="button" disabled={!clip.index || !!clip.error} onClick={() => onTrim({ start: frame, end: selection.end })} title={t('Set excerpt start at cursor')}>{t('In')}</button>
      <button type="button" disabled={!clip.index || !!clip.error} onClick={() => onTrim({ start: selection.start, end: frame })} title={t('Set excerpt end at cursor')}>{t('Out')}</button>
      <button type="button" disabled={!clip.trim} onClick={() => onTrim(undefined)}>{t('Reset excerpt')}</button>
    </div></div>
    {clip.contact !== null && (clip.contact < selection.start || clip.contact > selection.end) ? <p className="export-hint">{t('Contact is outside the excerpt.')}</p> : null}
  </>;
}
