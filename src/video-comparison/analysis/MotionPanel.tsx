import { useMemo, useState } from 'react';
import { t } from '../../i18n/locale';
import { clipFrameRange } from '../timeline';
import type { ComparisonClip } from '../types';
import { MotionPlotCard } from './MotionPlots';
import type { Selection } from './MotionSelection';
import type { AnalysisControls } from './useAnalysis';
import { estimatedRanges, trackingBounds } from './trajectory';
import { JOINTS, type ClipMotion, type MotionTrack } from './types';

export function MotionPanel({ clip, frame, view, linked, analysis, onEdit, onSelect, onFrame, onPause }: {
  clip: ComparisonClip; frame: number; view: { start: number; end: number }; linked: boolean; analysis: AnalysisControls;
  onEdit: (edit: (motion: ClipMotion) => ClipMotion) => void; onSelect: (selection: Selection) => void; onFrame: (frame: number) => void; onPause: () => void;
}) {
  const [open, setOpen] = useState(false), [plotsOpen, setPlotsOpen] = useState(true), motion = clip.motion;
  const status = analysis.statuses[clip.id], busy = status && !status.error;
  const range = clip.index ? clipFrameRange({ ...clip, index: clip.index }) : { start: 0, end: 0 };
  const estimates = useMemo(() => Object.fromEntries((motion?.tracks ?? []).map(track => [track.id, estimatedRanges(track.result)])), [motion?.tracks]);
  const editTrack = (id: string, edit: (track: MotionTrack) => MotionTrack) => onEdit(m => ({ ...m, tracks: m.tracks.map(track => track.id === id ? edit(track) : track) }));
  const invalidatePose = (edit: (m: ClipMotion) => ClipMotion) => { analysis.cancel(clip.id); onEdit(edit); };
  return <div className="motion-panel"><section>
    <button type="button" className="motion-disclosure" aria-label={t('Motion analysis')} aria-expanded={open} disabled={!clip.index || !!clip.error} onClick={() => { setOpen(!open); if (!motion) onEdit(m => m); }}>{t('Motion analysis')}<span>{open ? '−' : '+'}</span></button>
    {open && motion && clip.index ? <div className="motion-panel-body">
      <p className="motion-help">{t('Choose the same target on a start and end frame. Tracking stays between these anchors. Add corrections where the path needs guidance.')}</p>
      <button type="button" disabled={motion.tracks.length >= 6 || range.end <= range.start} onClick={() => onSelect({ type: 'track', role: 'start' })}>{t('Add point or region track')}</button>
      {motion.tracks.map(track => {
        const bounds = trackingBounds(track.anchors), valid = bounds && bounds.start >= range.start && bounds.end <= range.end;
        const inferred = estimates[track.id].reduce((total, r) => total + r.end - r.start + 1, 0);
        return <div key={track.id} className="motion-track">
        <div className="motion-track-title"><input type="checkbox" aria-label={t('Show track')} checked={track.visible} onChange={e => editTrack(track.id, value => ({ ...value, visible: e.target.checked }))}/>
          <input aria-label={t('Track name')} maxLength={48} value={track.name} onChange={e => editTrack(track.id, value => ({ ...value, name: e.target.value }))}/>
          <input type="color" aria-label={t('Track color')} value={track.color} onChange={e => editTrack(track.id, value => ({ ...value, color: e.target.value }))}/>
          <button type="button" aria-label={t('Remove track')} onClick={() => { analysis.cancel(clip.id); onEdit(m => ({ ...m, tracks: m.tracks.filter(v => v.id !== track.id), plots: m.plots.filter(p => p.target !== `track:${track.id}`) })); }}>×</button></div>
        <div className="motion-endpoints">{(['start', 'end'] as const).map(role => {
          const anchor = track.anchors.find(a => a.role === role);
          return <button type="button" key={role} disabled={range.end <= range.start || (role === 'end' && !track.anchors.some(a => a.role === 'start' && a.frame >= range.start && a.frame < range.end))} onClick={() => onSelect({ type: 'track', id: track.id, role })}>
            {t(role === 'start' ? 'Start position' : 'End position')}: {anchor ? t('Frame {frame}', { frame: anchor.frame + 1 }) : t('Choose frame')}
          </button>;
        })}</div>
        <div className="motion-actions"><button type="button" disabled={!valid} onClick={() => onSelect({ type: 'track', id: track.id, role: 'correction' })}>{t('Set correction here')}</button>
          <button type="button" disabled={!!busy || !valid} onClick={() => { onPause(); analysis.run(clip, { kind: 'track', track }); }}>{t('Track between anchors')}</button></div>
        {!valid ? <p className="motion-help">{t('Choose start and end positions on different frames inside the excerpt.')}</p> : null}
        <div className="motion-anchors">{track.anchors.map(anchor => <div key={anchor.frame}>
          <button type="button" onClick={() => onFrame(anchor.frame)}>{t('Frame {frame}', { frame: anchor.frame + 1 })}</button>
          {anchor.role === 'correction' ? <button type="button" aria-label={t('Remove anchor at frame {frame}', { frame: anchor.frame + 1 })} onClick={() => { analysis.cancel(clip.id); editTrack(track.id, value => ({ ...value, anchors: value.anchors.filter(a => a.frame !== anchor.frame), revision: value.revision + 1, result: undefined })); }}>×</button> : null}
        </div>)}</div>
        {track.result?.continuous ? <div className="motion-coverage"><span>{t('{observed} supported · {estimated} estimated frames', { observed: track.result.end - track.result.start + 1 - inferred, estimated: inferred })}</span>
          {inferred ? <button type="button" onClick={() => { const gaps = estimates[track.id], next = gaps.find(gap => Math.round((gap.start + gap.end) / 2) > frame) ?? gaps[0]; onFrame(Math.round((next.start + next.end) / 2)); }}>{t('Review estimates')}</button> : null}</div> : null}
      </div>; })}
      {motion.tracks.length ? <p className="motion-help">{t('Turns are detected automatically from the tracked motion. Lighter sections are estimates; use correction points if the target is lost. All processing stays on this device.')}</p> : null}
      <fieldset className="motion-pose"><legend>{t('Body pose')}</legend>
        <label>{t('Analysis quality')}<select value={motion.pose.quality} onChange={e => invalidatePose(m => ({ ...m, pose: { ...m.pose, quality: e.target.value as 'draft' | 'full', result: undefined } }))}>
          <option value="draft">{t('Draft · 15 samples/s')}</option><option value="full">{t('Every source frame')}</option></select></label>
        <div className="motion-actions">
          <button type="button" disabled={!!busy} onClick={() => { onPause(); analysis.run(clip, { kind: 'pose' }); }}>{t('Analyze pose')}</button>
          {motion.pose.result ? <button type="button" onClick={() => invalidatePose(m => ({ ...m, pose: { ...m.pose, result: undefined } }))}>{t('Clear pose')}</button> : null}</div>
        <p className="motion-help">{t('Analyzes one player across the full frame. Joint angles are stabilized; brief missing limbs are estimated (dashed). Raw plots retain the detections. Use every source frame for fast movement.')}</p>
      </fieldset>
      {status ? <div className="motion-status" role={status.error ? 'alert' : 'status'}>
        <span>{t(analysis.paused && !status.error ? 'Analysis paused during playback or export.' : status.message)}</span>
        {!status.error ? <progress max={1} value={status.progress}/> : null}<button type="button" onClick={() => analysis.cancel(clip.id)}>{t(status.error ? 'Dismiss' : 'Cancel analysis')}</button>
      </div> : null}
      <fieldset><legend>{t('Preview overlays')}</legend><div className="motion-checks">
        {(['tracks', 'skeleton', 'angles'] as const).map((key, i) => <label key={key}><input type="checkbox" checked={motion.view[key]} onChange={e => onEdit(m => ({ ...m, view: { ...m.view, [key]: e.target.checked } }))}/>{t(['Trajectories', 'Skeleton', 'Joint angles'][i])}</label>)}
      </div><label>{t('Trail length')}<select aria-label={t('Trail length')} value={motion.trail} onChange={e => onEdit(m => ({ ...m, trail: Number(e.target.value) }))}>
        <option value={.25}>{'0.25 s'}</option><option value={.5}>{'0.5 s'}</option><option value={1}>{'1 s'}</option><option value={0}>{t('Full trajectory')}</option></select></label>
        {motion.view.angles ? <div className="motion-checks">{Object.entries(JOINTS).map(([id, joint]) => <label key={id}><input type="checkbox" checked={motion.joints.includes(id)} onChange={e => onEdit(m => ({ ...m, joints: e.target.checked ? [...m.joints, id] : m.joints.filter(v => v !== id) }))}/>{t(joint.name)}</label>)}</div> : null}
      </fieldset>
    </div> : null}
  </section>
  {motion && clip.index && (motion.tracks.length > 0 || motion.pose.result || busy || motion.plots.length > 0) ? <section className="motion-plots-section">
    <button type="button" className="motion-disclosure" aria-label={t('Motion plots')} aria-expanded={plotsOpen} onClick={() => setPlotsOpen(!plotsOpen)}>{t('Motion plots')}<span>{plotsOpen ? '−' : '+'}</span></button>
    {plotsOpen ? <div className="motion-panel-body">
      <p className="motion-help">{t('Positions use original pixels; vertical position increases upward from the image bottom. Rates use source seconds. ≈ and lighter trails mark estimates. Angles are 2D projections.')}</p>
      <button type="button" disabled={motion.plots.length >= 4} onClick={() => { const id = crypto.randomUUID(); onEdit(m => ({ ...m, plots: [...m.plots, { id, target: m.tracks[0] ? `track:${m.tracks[0].id}` : 'joint:rightElbow', metric: m.tracks[0] ? 'speed' : 'angle', smoothing: .1 }] })); }}>{t('Add plot')}</button>
      {motion.plots.map(plot => <MotionPlotCard key={plot.id} clip={clip} plot={plot} frame={frame} view={view} linked={linked} onFrame={onFrame}
        onChange={value => onEdit(m => ({ ...m, plots: m.plots.map(p => p.id === plot.id ? value : p) }))} onRemove={() => onEdit(m => ({ ...m, plots: m.plots.filter(p => p.id !== plot.id) }))}/>)}
    </div> : null}
  </section> : null}</div>;
}
