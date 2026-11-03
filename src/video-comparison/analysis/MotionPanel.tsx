import { useMemo, useState } from 'react';
import { t } from '../../i18n/locale';
import { clipFrameRange } from '../timeline';
import type { ComparisonClip } from '../types';
import { MotionPlotCard } from './MotionPlots';
import type { Selection } from './MotionSelection';
import type { AnalysisControls } from './useAnalysis';
import { trackCoverage } from './series';
import { JOINTS, type ClipMotion, type MotionTrack } from './types';

export function MotionPanel({ clip, frame, view, linked, analysis, onEdit, onSelect, onFrame, onPause }: {
  clip: ComparisonClip; frame: number; view: { start: number; end: number }; linked: boolean; analysis: AnalysisControls;
  onEdit: (edit: (motion: ClipMotion) => ClipMotion) => void; onSelect: (selection: Selection) => void; onFrame: (frame: number) => void; onPause: () => void;
}) {
  const [open, setOpen] = useState(false), motion = clip.motion;
  const status = analysis.statuses[clip.id], busy = status && !status.error;
  const range = clip.index ? clipFrameRange({ ...clip, index: clip.index }) : { start: 0, end: 0 };
  const coverage = useMemo(() => Object.fromEntries((motion?.tracks ?? []).map(track => [track.id, trackCoverage(track.result, range)])), [motion?.tracks, range.start, range.end]);
  const editTrack = (id: string, edit: (track: MotionTrack) => MotionTrack) => onEdit(m => ({ ...m, tracks: m.tracks.map(track => track.id === id ? edit(track) : track) }));
  const invalidatePose = (edit: (m: ClipMotion) => ClipMotion) => { analysis.cancel(clip.id); onEdit(edit); };
  return <section className="motion-panel">
    <button type="button" className="motion-disclosure" aria-expanded={open} disabled={!clip.index || !!clip.error} onClick={() => { setOpen(!open); if (!motion) onEdit(m => m); }}>{t('Motion analysis')}<span>{open ? '−' : '+'}</span></button>
    {open && motion && clip.index ? <div className="motion-panel-body">
      <p className="motion-help">{t('Analyze the selected excerpt on this device. Keep the target visible; correct lost tracks with another anchor.')}</p>
      <button type="button" disabled={motion.tracks.length >= 6} onClick={() => onSelect({ type: 'track' })}>{t('Add point or region track')}</button>
      {motion.tracks.map(track => <div key={track.id} className="motion-track">
        <div className="motion-track-title"><input type="checkbox" aria-label={t('Show track')} checked={track.visible} onChange={e => editTrack(track.id, value => ({ ...value, visible: e.target.checked }))}/>
          <input aria-label={t('Track name')} maxLength={48} value={track.name} onChange={e => editTrack(track.id, value => ({ ...value, name: e.target.value }))}/>
          <input type="color" aria-label={t('Track color')} value={track.color} onChange={e => editTrack(track.id, value => ({ ...value, color: e.target.value }))}/>
          <button type="button" aria-label={t('Remove track')} onClick={() => { analysis.cancel(clip.id); onEdit(m => ({ ...m, tracks: m.tracks.filter(v => v.id !== track.id), plots: m.plots.filter(p => p.target !== `track:${track.id}`) })); }}>×</button></div>
        <div className="motion-actions"><button type="button" onClick={() => onSelect({ type: 'track', id: track.id })}>{t('Set correction here')}</button>
          <button type="button" disabled={!!busy || !track.anchors.some(a => a.frame >= range.start && a.frame <= range.end)} onClick={() => { onPause(); analysis.run(clip, { kind: 'track', track }); }}>{t('Track excerpt')}</button></div>
        <div className="motion-anchors">{track.anchors.map(anchor => <span key={anchor.frame}><button type="button" onClick={() => onFrame(anchor.frame)}>{t('Frame {frame}', { frame: anchor.frame + 1 })}</button>
          <button type="button" aria-label={t('Remove anchor at frame {frame}', { frame: anchor.frame + 1 })} onClick={() => { analysis.cancel(clip.id); editTrack(track.id, value => ({ ...value, anchors: value.anchors.filter(a => a.frame !== anchor.frame), revision: value.revision + 1, result: undefined })); }}>×</button></span>)}</div>
        {track.result ? <div className="motion-coverage"><span>{t('{found}/{total} frames tracked', { found: coverage[track.id].found, total: range.end - range.start + 1 })}</span>
          {coverage[track.id].gaps.length ? <button type="button" onClick={() => { const gaps = coverage[track.id].gaps, next = gaps.find(gap => gap.end > frame); onFrame(next ? Math.max(frame + 1, next.start) : gaps[0].start); }}>{t('Next gap')}</button> : null}</div> : null}
      </div>)}
      <fieldset className="motion-pose"><legend>{t('Body pose')}</legend>
        <label>{t('Analysis quality')}<select value={motion.pose.quality} onChange={e => invalidatePose(m => ({ ...m, pose: { ...m.pose, quality: e.target.value as 'draft' | 'full', result: undefined } }))}>
          <option value="draft">{t('Draft · 15 samples/s')}</option><option value="full">{t('Every source frame')}</option></select></label>
        <div className="motion-actions"><button type="button" onClick={() => onSelect({ type: 'region' })}>{t(motion.pose.region ? 'Change player region' : 'Select player region')}</button>
          {motion.pose.region ? <button type="button" onClick={() => invalidatePose(m => ({ ...m, pose: { ...m.pose, region: undefined, result: undefined } }))}>{t('Use whole frame')}</button> : null}
          <button type="button" disabled={!!busy} onClick={() => { onPause(); analysis.run(clip, { kind: 'pose' }); }}>{t('Analyze pose')}</button>
          {motion.pose.result ? <button type="button" onClick={() => invalidatePose(m => ({ ...m, pose: { ...m.pose, result: undefined } }))}>{t('Clear pose')}</button> : null}</div>
        <p className="motion-help">{t('One player, 17 body landmarks. The pose model downloads on first use. Track the racket head separately.')}</p>
      </fieldset>
      {status ? <div className="motion-status" role={status.error ? 'alert' : 'status'}>
        <span>{t(analysis.paused && !status.error ? 'Analysis paused during playback or export.' : status.message)}</span>
        {!status.error ? <progress max={1} value={status.progress}/> : null}<button type="button" onClick={() => analysis.cancel(clip.id)}>{t(status.error ? 'Dismiss' : 'Cancel analysis')}</button>
      </div> : null}
      <fieldset><legend>{t('Preview overlays')}</legend><div className="motion-checks">
        {(['tracks', 'skeleton', 'angles'] as const).map((key, i) => <label key={key}><input type="checkbox" checked={motion.view[key]} onChange={e => onEdit(m => ({ ...m, view: { ...m.view, [key]: e.target.checked } }))}/>{t(['Trajectories', 'Skeleton', 'Joint angles'][i])}</label>)}
      </div><label>{t('Trail length')}<select value={motion.trail} onChange={e => onEdit(m => ({ ...m, trail: Number(e.target.value) }))}>
        <option value={.25}>{'0.25 s'}</option><option value={.5}>{'0.5 s'}</option><option value={1}>{'1 s'}</option><option value={0}>{t('Full trajectory')}</option></select></label>
        {motion.view.angles ? <div className="motion-checks">{Object.entries(JOINTS).map(([id, joint]) => <label key={id}><input type="checkbox" checked={motion.joints.includes(id)} onChange={e => onEdit(m => ({ ...m, joints: e.target.checked ? [...m.joints, id] : m.joints.filter(v => v !== id) }))}/>{t(joint.name)}</label>)}</div> : null}
      </fieldset>
      <p className="motion-help">{t('Measurements use original pixels and source seconds. Angles are 2D projections. Camera motion and tracking errors affect derivatives. ≈ marks interpolated samples.')}</p>
      <button type="button" disabled={motion.plots.length >= 4} onClick={() => onEdit(m => ({ ...m, plots: [...m.plots, { id: crypto.randomUUID(), target: m.tracks[0] ? `track:${m.tracks[0].id}` : 'joint:rightElbow', metric: m.tracks[0] ? 'speed' : 'angle', smoothing: .1 }] }))}>{t('Add plot')}</button>
      {motion.plots.map(plot => <MotionPlotCard key={plot.id} clip={clip} plot={plot} frame={frame} view={view} linked={linked} onFrame={onFrame}
        onChange={value => onEdit(m => ({ ...m, plots: m.plots.map(p => p.id === plot.id ? value : p) }))} onRemove={() => onEdit(m => ({ ...m, plots: m.plots.filter(p => p.id !== plot.id) }))}/>)}
    </div> : null}
  </section>;
}
