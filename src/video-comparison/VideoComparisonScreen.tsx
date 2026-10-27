import { useEffect, useRef, useState } from 'react';
import { Crosshair, Film, Link2, Pause, Play, Plus, ShieldCheck, SkipBack, SkipForward, X } from 'lucide-react';
import { AppHeader, type AppRoute } from '../components/AppHeader';
import { t } from '../i18n/locale';
import { ComparisonPane } from './ComparisonPane';
import { indexVideo, makeFilmstrip } from './localVideo';
import { clamp, comparisonRange, comparisonTime, formatTime, frameAt, mediaTime, stepComparison, type AlignedClip } from './timeline';
import type { ComparisonClip } from './types';
import { useComparisonPlayback } from './useComparisonPlayback';
import './comparison.css';

export function VideoComparisonScreen({ active, onRoute }: { active: boolean; onRoute: (route: AppRoute) => void }) {
  const [clips, setClips] = useState<ComparisonClip[]>([]);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [linked, setLinked] = useState(false);
  const [notice, setNotice] = useState(''), [dropping, setDropping] = useState(false);
  const input = useRef<HTMLInputElement>(null), row = useRef<HTMLDivElement>(null);
  const [videos] = useState(() => new Map<string, HTMLVideoElement>());
  const [resources] = useState(() => new Map<string, { url: string; controller: AbortController }>());
  const pause = () => setPlaying(false);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  useEffect(() => () => {
    for (const video of videos.values()) { video.pause(); video.removeAttribute('src'); video.load(); }
    videos.clear();
    for (const item of resources.values()) { item.controller.abort(); URL.revokeObjectURL(item.url); }
    resources.clear();
  }, [resources, videos]);
  const aligned: AlignedClip[] = clips.flatMap(clip => clip.index && !clip.error && clip.contact !== null
    ? [{ index: clip.index, contact: clip.contact, speed: clip.speed }] : []);
  const allAligned = clips.length > 0 && aligned.length === clips.length;
  const range = comparisonRange(aligned);
  const buffering = useComparisonPlayback({ clips, videos, time, linked, playing, active, onTime: setTime, onPause: pause, onError: setNotice });
  const frameFor = (clip: ComparisonClip) => linked && clip.index && clip.contact !== null
    ? frameAt(clip.index, mediaTime({ index: clip.index, contact: clip.contact, speed: clip.speed }, time)) : clip.frame;
  const unlink = () => {
    pause(); setClips(current => current.map(clip => ({ ...clip, frame: frameFor(clip) }))); setLinked(false);
  };
  const update = (id: string, patch: Partial<ComparisonClip>) => setClips(current => current.map(clip => clip.id === id ? { ...clip, ...patch } : clip));
  const seek = (next: number) => { pause(); setTime(clamp(next, range.start, range.end)); };
  const selectFrame = (clip: ComparisonClip, frame: number) => {
    pause();
    if (linked && clip.index && clip.contact !== null) setTime(comparisonTime({ index: clip.index, contact: clip.contact, speed: clip.speed }, frame));
    else update(clip.id, { frame });
  };
  const contact = (clip: ComparisonClip) => {
    pause();
    const next = clips.map(item => item.id === clip.id ? { ...item, contact: frameFor(item), frame: frameFor(item) } : item);
    setClips(next);
    if (next.every(item => item.index && !item.error && item.contact !== null)) { setLinked(true); setTime(0); }
  };
  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const available = Math.max(0, 5 - Math.max(resources.size, clips.length));
    if (!available) { setNotice('You can compare up to five clips. Remove a clip to add another.'); return; }
    unlink(); setNotice('');
    if (files.length > available) setNotice('You can compare up to five clips. Remove a clip to add another.');
    const columns = Math.min(3, clips.length + files.length);
    const width = clamp(((row.current?.clientWidth ?? window.innerWidth - 48) - 16 * columns) / columns, 280, 580);
    for (const file of files.slice(0, available)) {
      const id = crypto.randomUUID(), url = URL.createObjectURL(file), controller = new AbortController();
      resources.set(id, { url, controller });
      setClips(current => [...current, { id, url, name: file.name, contact: null, frame: 0, speed: 1, width, thumbnails: [] }]);
      void indexVideo(file, controller.signal).then(async index => {
        if (controller.signal.aborted) return;
        update(id, { index });
        try {
          const thumbnails = await makeFilmstrip(url, index, controller.signal);
          if (!controller.signal.aborted) update(id, { thumbnails });
        } catch { /* Playback remains usable when thumbnail extraction is unavailable. */ }
      }).catch(error => {
        if (!controller.signal.aborted) update(id, { error: error instanceof Error ? error.message : 'Cannot read this video. Try an MP4, MOV or WebM file.' });
      });
    }
  };
  const remove = (id: string) => {
    pause();
    const resource = resources.get(id); resource?.controller.abort();
    const video = videos.get(id); video?.pause(); video?.removeAttribute('src'); video?.load(); videos.delete(id);
    if (resource) URL.revokeObjectURL(resource.url); resources.delete(id);
    const next = clips.filter(clip => clip.id !== id); setClips(next);
    if (!next.length) { setLinked(false); setTime(0); }
    else if (linked) {
      const bounds = comparisonRange(next.flatMap(c => c.index && c.contact !== null && !c.error ? [{ index: c.index, contact: c.contact, speed: c.speed }] : []));
      setTime(clamp(time, bounds.start, bounds.end));
    }
  };
  const move = (id: string, target: number) => setClips(current => {
    const from = current.findIndex(clip => clip.id === id);
    if (from < 0 || target < 0 || target >= current.length || from === target) return current;
    const next = [...current]; next.splice(target, 0, next.splice(from, 1)[0]!); return next;
  });
  const drag = (id: string, x: number, y: number) => {
    const target = document.elementsFromPoint(x, y).find(element => element.classList.contains('comparison-pane')) as HTMLElement | undefined;
    const from = clips.findIndex(c => c.id === id), to = clips.findIndex(c => c.id === target?.dataset.clipId);
    if (target && to !== from && to >= 0) {
      const box = target.getBoundingClientRect();
      if (to > from ? x > box.left + box.width / 2 : x < box.left + box.width / 2) move(id, to);
    }
    if (row.current) { const box = row.current.getBoundingClientRect(); if (x > box.right - 48) row.current.scrollLeft += 18; else if (x < box.left + 48) row.current.scrollLeft -= 18; }
  };
  return <main className="app-shell comparison-shell" hidden={!active}>
    <AppHeader route="comparison" onRoute={onRoute}/>
    <section className={`comparison-workspace${dropping ? ' is-dropping' : ''}`} aria-label={t('Video Comparison')}
      onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDropping(true); } }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false); }}
      onDrop={event => { event.preventDefault(); setDropping(false); addFiles(Array.from(event.dataTransfer.files)); }}>
      <div className="comparison-intro"><div><span className="comparison-eyebrow">{t('MOTION STUDY')}</span><h1>{t('Video Comparison')}</h1>
        <p>{t('Find the contact. Align the moment. Compare the motion.')}</p></div>
        <div className="comparison-import"><button className="primary-button inline" disabled={clips.length >= 5} onClick={() => input.current?.click()}><Plus size={18}/>{t('Add videos')}<span>{clips.length}/5</span></button>
          <small><ShieldCheck size={13}/>{t('On your device. Never uploaded.')}</small></div>
        <input ref={input} type="file" hidden accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" multiple aria-label={t('Choose local videos')}
          onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }}/>
      </div>
      {notice ? <div className="comparison-notice" role="alert"><span>{t(notice)}</span><button aria-label={t('Dismiss')} onClick={() => setNotice('')}><X size={16}/></button></div> : null}
      {clips.length ? <>
        <div className="comparison-instructions"><span><Crosshair size={15}/>{linked ? t('Contacts aligned. Drag any lane to review together.') : t('Scrub each clip, then set its contact frame.')}</span>
          <span>{t('Drag headers to reorder · drag edges to resize')}</span></div>
        <div className="comparison-panes" ref={row}>
          {clips.map((clip, position) => {
            const frame = frameFor(clip);
            const sourceTime = clip.index && clip.contact !== null ? mediaTime({ index: clip.index, contact: clip.contact, speed: clip.speed }, time) : 0;
            const held = linked && !!clip.index && (sourceTime < clip.index.timestamps[0]! - 1e-7 || sourceTime > clip.index.timestamps[clip.index.timestamps.length - 1]! + 1e-7);
            return <ComparisonPane key={clip.id} clip={clip} frame={frame} position={position} count={clips.length} held={held}
              onFrame={frame => selectFrame(clip, frame)} onContact={() => contact(clip)} onRemove={() => remove(clip.id)}
              onSpeed={speed => { pause(); update(clip.id, { speed }); if (linked) setTime(0); }}
              onResize={width => update(clip.id, { width })} onMove={direction => move(clip.id, position + direction)} onDrag={drag} onDragEnd={() => {}}
              onVideo={(id, video) => { if (video) videos.set(id, video); else videos.delete(id); }}
              onReady={() => update(clip.id, {})} onError={() => { pause(); setLinked(false); update(clip.id, { error: 'Your browser cannot play this video codec. Try H.264 MP4 or VP9 WebM.' }); }}/>
          })}
        </div>
      </> : <div className="comparison-empty">
        <div className="comparison-empty-icon"><Film size={34} strokeWidth={1.3}/><Crosshair size={24} strokeWidth={1.5}/></div>
        <h2>{t('Every swing, side by side.')}</h2><p>{t('Drop up to five videos here, or choose clips from your device. Portrait and landscape videos keep their full frame.')}</p>
        <button className="secondary-button" onClick={() => input.current?.click()}><Plus size={17}/>{t('Choose videos')}</button>
        <div className="comparison-steps"><span><b>01</b>{t('Add your clips')}</span><span><b>02</b>{t('Mark each contact')}</span><span><b>03</b>{t('Review in sync')}</span></div>
        <small>{t('MP4, MOV and WebM · playback depends on your browser’s codecs')}</small>
      </div>}
    </section>
    <footer className="comparison-transport">
      <div className="comparison-transport-top"><div className="comparison-transport-buttons">
        <button aria-label={t('Previous synced frame')} disabled={!linked} onClick={() => seek(stepComparison(aligned, time, -1))}><SkipBack size={18}/></button>
        <button className="comparison-play" aria-label={t(playing ? 'Pause comparison' : 'Play comparison')} disabled={!linked || range.end <= range.start} onClick={() => { if (!playing && time >= range.end) setTime(range.start); setPlaying(!playing); }}>{playing ? <Pause size={21}/> : <Play size={21}/>}</button>
        <button aria-label={t('Next synced frame')} disabled={!linked} onClick={() => seek(stepComparison(aligned, time, 1))}><SkipForward size={18}/></button>
        <button className="comparison-jump" disabled={!allAligned} onClick={() => { pause(); setLinked(true); setTime(0); }}><Crosshair size={17}/>{t('Contact frame')}</button>
      </div><output className="comparison-clock">{formatTime(time, true)}<small>{t('from contact')}</small></output>
      <label className="comparison-link"><Link2 size={16}/><input type="checkbox" checked={linked} disabled={!allAligned} onChange={event => { if (event.target.checked) { pause(); setLinked(true); setTime(0); } else unlink(); }}/>{t('Link timelines')}</label></div>
      <div className="comparison-shared-lane"><span>{formatTime(range.start, true)}</span><div>
        <input type="range" aria-label={t('Shared comparison timeline')} min={range.start} max={range.end || 0.001} step="0.001" value={time} disabled={!linked} onChange={event => seek(Number(event.target.value))}/>
        {range.end > range.start ? <span className="comparison-zero" style={{ left: `${-range.start / (range.end - range.start) * 100}%` }} aria-hidden="true"/> : null}
      </div><span>{formatTime(range.end, true)}</span></div>
      <p role="status">{buffering ? t('Waiting for video frames…') : linked ? t('All clips follow contact time. Shorter clips hold at their edges. Sound is muted.') : allAligned ? t('Timelines unlinked. Adjust each clip independently, then link to compare.') : t('Set a contact frame in every clip to unlock synchronized playback.')}</p>
    </footer>
  </main>;
}
