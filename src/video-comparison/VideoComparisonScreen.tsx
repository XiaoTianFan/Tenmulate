import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Download, Link2, Pause, Play, Plus, SkipBack, SkipForward, X } from 'lucide-react';
import { AppHeader, type AppRoute } from '../components/AppHeader';
import { t } from '../i18n/locale';
import { ComparisonPane } from './ComparisonPane';
import { indexVideo, makeFilmstrip } from './localVideo';
import { clamp, comparisonRange, comparisonTime, formatTime, frameForTime, clipFrameRange, mediaTime, stepComparison, type AlignedClip } from './timeline';
import type { ComparisonClip } from './types';
import { useComparisonPlayback } from './useComparisonPlayback';
import { ComparisonExportLoader } from './ComparisonExportLoader';
import './comparison.css';
import './editing.css';
import './analysis/analysis.css';
import { PresentedFrames } from './analysis/presentation';
import { useAnalysis } from './analysis/useAnalysis';
import { newMotion, type ClipMotion } from './analysis/types';
import { drawCropped, normalizeCrop } from './crop';
import { newServeSetup } from './speed/types';

export function VideoComparisonScreen({ active, onRoute }: { active: boolean; onRoute: (route: AppRoute) => void }) {
  const [clips, setClips] = useState<ComparisonClip[]>([]);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [linked, setLinked] = useState(false);
  const [rate, setRate] = useState(1);
  const [notice, setNotice] = useState(''), [dropping, setDropping] = useState(false);
  const [exportClips, setExportClips] = useState<ComparisonClip[]>([]);
  const [exporting, setExporting] = useState(false), [exportPreviews, setExportPreviews] = useState<Record<string, string>>({});
  const [markingClip, setMarkingClip] = useState<string | null>(null);
  const markingChanged = useCallback((id: string, open: boolean) => setMarkingClip(current => open ? id : current === id ? null : current), []);
  const input = useRef<HTMLInputElement>(null), row = useRef<HTMLDivElement>(null);
  const [videos] = useState(() => new Map<string, HTMLVideoElement>());
  const [presentation] = useState(() => new PresentedFrames());
  const editMotion = (id: string, edit: (motion: ClipMotion) => ClipMotion) => setClips(current => current.map(clip => clip.id === id ? { ...clip, motion: edit(clip.motion ?? newMotion()) } : clip));
  const analysis = useAnalysis(clips, playing || exporting || !!markingClip || !active, editMotion);
  const [canvases] = useState(() => new Map<string, HTMLCanvasElement>());
  const [resources] = useState(() => new Map<string, { url: string; controller: AbortController }>());
  const pause = () => setPlaying(false);
  useEffect(() => { if (!active) { setPlaying(false); setExporting(false); setExportClips([]); setExportPreviews({}); } }, [active]);
  useEffect(() => () => {
    for (const video of videos.values()) { video.pause(); video.removeAttribute('src'); video.load(); }
    videos.clear();
    for (const item of resources.values()) { item.controller.abort(); URL.revokeObjectURL(item.url); }
    resources.clear();
  }, [resources, videos]);
  const aligned: AlignedClip[] = clips.flatMap(clip => clip.index && !clip.error && clip.contact !== null
    ? [{ ...clip, index: clip.index, contact: clip.contact }] : []);
  const allAligned = clips.length > 0 && aligned.length === clips.length;
  const range = comparisonRange(aligned);
  const buffering = useComparisonPlayback({ clips, videos, canvases, time, rate, linked, playing, active: active && !markingClip, onTime: setTime, onPause: pause, onError: setNotice,
    onPresented: (id, frame) => presentation.present(id, frame),
    onCompatibility: () => setNotice('Using compatibility playback. Contact alignment is preserved, but playback may be slower.') });
  const openExport = () => {
    pause();
    const previews: Record<string, string> = {};
    for (const clip of clips) {
      const video = videos.get(clip.id), playback = canvases.get(clip.id);
      const surface = playback && !playback.hidden ? playback : video;
      const width = surface === playback ? playback?.width : video?.videoWidth;
      const height = surface === playback ? playback?.height : video?.videoHeight;
      if (!surface || !width || !height) continue;
      const crop = normalizeCrop(clip.crop), snapshot = document.createElement('canvas');
      const scale = Math.min(1, 320 / Math.max(width * crop.width, height * crop.height));
      snapshot.width = Math.max(1, Math.round(width * crop.width * scale)); snapshot.height = Math.max(1, Math.round(height * crop.height * scale));
      const context = snapshot.getContext('2d');
      if (context) drawCropped(context, (x, y, w, h) => context.drawImage(surface, x, y, w, h), crop, { x: 0, y: 0, width: snapshot.width, height: snapshot.height });
      previews[clip.id] = snapshot.toDataURL('image/jpeg', 0.8);
    }
    setExportClips(clips); setExportPreviews(previews); setExporting(true);
  };
  const frameFor = (clip: ComparisonClip) => linked && clip.index && clip.contact !== null
    ? frameForTime({ ...clip, index: clip.index, contact: clip.contact }, time) : clip.frame;
  const unlink = () => {
    pause(); setClips(current => current.map(clip => ({ ...clip, frame: frameFor(clip) }))); setLinked(false);
  };
  const update = (id: string, patch: Partial<ComparisonClip>) => setClips(current => current.map(clip => clip.id === id ? { ...clip, ...patch } : clip));
  const seek = (next: number) => { pause(); setTime(clamp(next, range.start, range.end)); };
  const selectFrame = (clip: ComparisonClip, frame: number) => {
    pause();
    if (clip.index) { const bounds = clipFrameRange({ ...clip, index: clip.index }); frame = clamp(frame, bounds.start, bounds.end); }
    if (linked && clip.index && clip.contact !== null) setTime(comparisonTime({ index: clip.index, contact: clip.contact, speed: clip.speed }, frame));
    else update(clip.id, { frame });
  };
  const trim = (clip: ComparisonClip, trim?: { start: number; end: number }) => {
    if (!clip.index) return;
    pause();
    analysis.cancel(clip.id);
    const bounds = clipFrameRange({ index: clip.index, trim });
    const next = clips.map(item => item.id === clip.id ? { ...item, trim, frame: clamp(frameFor(item), bounds.start, bounds.end) } : item);
    setClips(next);
    const range = comparisonRange(next.flatMap(c => c.index && c.contact !== null && !c.error ? [{ ...c, index: c.index, contact: c.contact }] : []));
    setTime(clamp(time, range.start, range.end));
  };
  const contact = (clip: ComparisonClip) => {
    pause();
    const next = clips.map(item => item.id === clip.id ? { ...item, contact: frameFor(item), frame: frameFor(item) } : item);
    setClips(next);
    if (next.every(item => item.index && !item.error && item.contact !== null)) { setLinked(true); const bounds = comparisonRange(next.map(c => ({ ...c, index: c.index!, contact: c.contact! }))); setTime(clamp(0, bounds.start, bounds.end)); }
  };
  const addFiles = (files: File[]) => {
    if (!files.length) return;
    const available = Math.max(0, 9 - Math.max(resources.size, clips.length));
    if (!available) { setNotice('You can compare up to nine clips. Remove a clip to add another.'); return; }
    unlink(); setNotice('');
    if (files.length > available) setNotice('You can compare up to nine clips. Remove a clip to add another.');
    const columns = Math.min(3, clips.length + files.length);
    const width = clamp(((row.current?.clientWidth ?? window.innerWidth - 48) - 16 * columns) / columns, 280, 580);
    for (const file of files.slice(0, available)) {
      const id = crypto.randomUUID(), url = URL.createObjectURL(file), controller = new AbortController();
      resources.set(id, { url, controller });
      setClips(current => [...current, { id, url, file, name: file.name, contact: null, frame: 0, speed: 1, width, thumbnails: [] }]);
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
    pause(); analysis.cancel(id); presentation.remove(id);
    const resource = resources.get(id); resource?.controller.abort();
    const video = videos.get(id); video?.pause(); video?.removeAttribute('src'); video?.load(); videos.delete(id);
    if (resource) URL.revokeObjectURL(resource.url); resources.delete(id);
    const next = clips.filter(clip => clip.id !== id); setClips(next);
    if (!next.length) { setLinked(false); setTime(0); }
    else if (linked) {
      const bounds = comparisonRange(next.flatMap(c => c.index && c.contact !== null && !c.error ? [{ ...c, index: c.index, contact: c.contact }] : []));
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
      <input ref={input} type="file" hidden accept="video/*,.mp4,.mov,.m4v,.webm,.mkv" multiple aria-label={t('Choose local videos')}
        onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }}/>
      {notice ? <div className="comparison-notice" role="alert"><span>{t(notice)}</span><button aria-label={t('Dismiss')} onClick={() => setNotice('')}><X size={16}/></button></div> : null}
      <div className="comparison-lanes-viewport" ref={row}>
        <div className="comparison-panes">
          {clips.map((clip, position) => {
            const frame = frameFor(clip);
            const sourceTime = clip.index && clip.contact !== null ? mediaTime({ index: clip.index, contact: clip.contact, speed: clip.speed }, time) : 0;
            const held = linked && !!clip.index && (sourceTime < clip.index.timestamps[clipFrameRange({ ...clip, index: clip.index }).start]! - 1e-7 || sourceTime > clip.index.timestamps[clipFrameRange({ ...clip, index: clip.index }).end]! + 1e-7);
            return <ComparisonPane active={active && !exporting} onMarkingChange={markingChanged} onServe={(edit, contactFrame) => {
              setClips(current => current.map(c => c.id === clip.id ? { ...c, serve: edit(c.serve ?? newServeSetup()), ...(contactFrame === undefined ? {} : { contact: contactFrame, frame: contactFrame }) } : c));
              if (contactFrame !== undefined) {
                pause();
                if (clips.every(c => c.index && !c.error && (c.id === clip.id || c.contact !== null))) { setLinked(true); setTime(0); }
              }
            }} presentation={presentation} analysis={analysis} linked={linked} onMotion={edit => editMotion(clip.id, edit)} key={clip.id} clip={clip} frame={frame} position={position} count={clips.length} held={held}
              onFrame={frame => selectFrame(clip, frame)} onContact={() => contact(clip)} onRemove={() => remove(clip.id)}
              onPause={pause} onTrim={value => trim(clip, value)} onCrop={crop => { pause(); update(clip.id, { crop }); }}
              onMirror={() => update(clip.id, { mirrored: !clip.mirrored })}
              onSpeed={speed => { pause(); update(clip.id, { speed }); if (linked) { const bounds = comparisonRange(aligned.map(c => c.index === clip.index ? { ...c, speed } : c)); setTime(clamp(0, bounds.start, bounds.end)); } }}
              onResize={width => update(clip.id, { width })} onMove={direction => move(clip.id, position + direction)} onDrag={drag} onDragEnd={() => {}}
              onVideo={(id, video) => { if (video) videos.set(id, video); else videos.delete(id); }}
              onCanvas={(id, canvas) => { if (canvas) canvases.set(id, canvas); else canvases.delete(id); }}
              onReady={() => update(clip.id, {})} onError={() => { pause(); setLinked(false); update(clip.id, { error: 'Your browser cannot play this video codec. Try H.264 MP4 or VP9 WebM.' }); }}/>
          })}
          <button type="button" className={`comparison-add-slot${clips.length ? '' : ' is-empty'}`} disabled={clips.length >= 9}
            aria-label={t(clips.length >= 9 ? 'Video limit reached' : 'Choose videos')} onClick={() => input.current?.click()}>
            <Plus size={30} strokeWidth={1.5}/>
            <span>{t(clips.length >= 9 ? 'Remove a clip to add another.' : 'Drop videos or click to choose')}</span>
            <small>{t('{count}/9 videos', { count: clips.length })}</small>
          </button>
        </div>
      </div>
    </section>
    <footer className="comparison-transport">
      <div className="comparison-transport-top"><div className="comparison-transport-buttons">
        <button aria-label={t('Previous synced frame')} disabled={!linked} onClick={() => seek(stepComparison(aligned, time, -1))}><SkipBack size={18}/></button>
        <button className="comparison-play" aria-label={t(playing ? 'Pause comparison' : 'Play comparison')} disabled={!linked || range.end <= range.start} onClick={() => { if (!playing && time >= range.end) setTime(range.start); setPlaying(!playing); }}>{playing ? <Pause size={21}/> : <Play size={21}/>}</button>
        <button aria-label={t('Next synced frame')} disabled={!linked} onClick={() => seek(stepComparison(aligned, time, 1))}><SkipForward size={18}/></button>
        <button className="comparison-jump" disabled={!allAligned || range.start > 0 || range.end < 0} onClick={() => { pause(); setLinked(true); setTime(0); }}><Crosshair size={17}/>{t('Contact frame')}</button>
      </div><output className="comparison-clock">{formatTime(time, true)}<small>{t('from contact')}</small></output>
      <div className="comparison-transport-options">
        <label className="comparison-global-speed"><span>{t('Playback speed')}</span>
          <select value={rate} onChange={event => setRate(Number(event.target.value))} title={t('Multiplies each clip’s speed')}>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
        <label className="comparison-link"><Link2 size={16}/><input type="checkbox" checked={linked} disabled={!allAligned} onChange={event => { if (event.target.checked) { pause(); setLinked(true); setTime(clamp(0, range.start, range.end)); } else unlink(); }}/>{t('Link timelines')}</label>
        <button type="button" aria-haspopup="dialog" disabled={!clips.some(clip => clip.index && !clip.error)} onClick={openExport}><Download size={16}/>{t('Export')}</button>
      </div></div>
      <div className="comparison-shared-lane"><span>{formatTime(range.start, true)}</span><div>
        <input type="range" aria-label={t('Shared comparison timeline')} min={range.start} max={range.end} step="0.001" value={time} disabled={!linked || range.end <= range.start} onChange={event => seek(Number(event.target.value))}/>
        {range.end > range.start && range.start <= 0 && range.end >= 0 ? <span className="comparison-zero" style={{ left: `${-range.start / (range.end - range.start) * 100}%` }} aria-hidden="true"/> : null}
      </div><span>{formatTime(range.end, true)}</span></div>
      <p role="status">{buffering ? t('Preparing synchronized frames…') : linked ? t('All clips follow contact time. Shorter clips hold at their edges. Sound is muted.') : allAligned ? t('Timelines unlinked. Adjust each clip independently, then link to compare.') : t('Set a contact frame in every clip to unlock synchronized playback.')}</p>
    </footer>
    {exporting && active ? <ComparisonExportLoader pendingAnalysis={Object.values(analysis.statuses).some(status => !status.error)} clips={exportClips} rate={rate} previews={exportPreviews} onClose={() => { setExporting(false); setExportClips([]); setExportPreviews({}); }}/> : null}
  </main>;
}
