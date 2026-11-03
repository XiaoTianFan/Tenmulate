import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ComparisonClip } from '../types';
import { loadVideoTools } from '../loadVideoTools';
import { AnalysisQueue } from './queue';
import type { ClipMotion, MotionSeries } from './types';
import type { AnalysisProgress, AnalysisRequest } from './analyze';
export type JobStatus = AnalysisProgress & { key: string; error?: boolean };
export type AnalysisControls = { run: (clip: ComparisonClip, request: AnalysisRequest) => void; cancel: (clipId: string) => void; statuses: Record<string, JobStatus>; paused: boolean };
export function useAnalysis(clips: ComparisonClip[], paused: boolean, commit: (id: string, edit: (motion: ClipMotion) => ClipMotion) => void): AnalysisControls {
  const [queue] = useState(() => new AnalysisQueue()), [statuses, setStatuses] = useState<Record<string, JobStatus>>({});
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => { const update = () => setHidden(document.hidden); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, []);
  paused = paused || hidden;
  const latest = useRef({ clips, commit }), tokens = useRef(new Map<string, object>());
  useLayoutEffect(() => { latest.current = { clips, commit }; queue.setPaused(paused); }, [clips, commit, paused, queue]);
  useEffect(() => () => { tokens.current.clear(); queue.dispose(); }, [queue]);
  useEffect(() => {
    for (const id of tokens.current.keys()) if (!clips.some(c => c.id === id)) { tokens.current.delete(id); queue.cancelClip(id); setStatuses(current => { const next = { ...current }; delete next[id]; return next; }); }
  }, [clips, queue]);
  const cancel = (id: string) => { tokens.current.delete(id); queue.cancelClip(id); setStatuses(current => { const next = { ...current }; delete next[id]; return next; }); };
  const run = (clip: ComparisonClip, request: AnalysisRequest) => {
    cancel(clip.id); const token = {}; tokens.current.set(clip.id, token);
    const key = request.kind === 'pose' ? 'pose' : request.track.id;
    const publish = (value: AnalysisProgress) => { if (tokens.current.get(clip.id) === token) setStatuses(current => ({ ...current, [clip.id]: { ...value, key } })); };
    publish({ progress: 0, message: 'Queued for analysis…' });
    void queue.enqueue(`${clip.id}/${key}`, async (signal, ready) => {
      const { analyze } = await loadVideoTools(() => import('./analyze'), signal);
      return analyze(clip, request, signal, ready, publish);
    }).then((result: MotionSeries) => {
      if (tokens.current.get(clip.id) !== token || !latest.current.clips.some(c => c.id === clip.id)) return;
      latest.current.commit(clip.id, motion => request.kind === 'pose' ? { ...motion, pose: { ...motion.pose, result } }
        : { ...motion, tracks: motion.tracks.map(track => track.id === request.track.id && track.revision === request.track.revision ? { ...track, result } : track) });
      tokens.current.delete(clip.id); setStatuses(current => { const next = { ...current }; delete next[clip.id]; return next; });
    }).catch(error => {
      if (tokens.current.get(clip.id) !== token) return;
      tokens.current.delete(clip.id);
      setStatuses(current => ({ ...current, [clip.id]: { key, progress: 0, message: error instanceof Error ? error.message : 'Motion analysis failed. Try a shorter excerpt or another video.', error: true } }));
    });
  };
  return { run, cancel, statuses, paused };
}
