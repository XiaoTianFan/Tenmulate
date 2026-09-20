import { previewFlightCues, PreviewAudioCursor, type PreviewAudioFrame } from '../engine/audio/previewCues';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { EnvironmentConfiguration } from '../domain/environment';
import type { SurfaceId } from '../domain/court';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import { cueSpatialMix } from '../engine/audio/spatialCues';
import { useAudioSettings } from './useAudioSettings';

/** Observe the rendered flights, including newly compiled continuous-preview batches. */
export function usePreviewAudio(environment: EnvironmentConfiguration, surface: SurfaceId, running = true, resetKey?: unknown) {
  const { audioLevels, soundEnabled, crowdEnabled } = useAudioSettings();
  const levels = useMemo(() => ({ ...audioLevels, crowd: crowdEnabled ? audioLevels.crowd : 0 }), [audioLevels, crowdEnabled]);
  const cursor = useRef(new PreviewAudioCursor());
  useLayoutEffect(() => { cursor.current.reset(); practiceAudio.resetTimeline(); }, [resetKey]);
  useLayoutEffect(() => { practiceAudio.configure(environment, surface, levels, soundEnabled); }, [environment, surface, levels, soundEnabled]);
  useLayoutEffect(() => {
    const sync = () => practiceAudio.setPlayback(running && !document.hidden ? 'playing' : 'paused');
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); practiceAudio.setPlayback('idle'); };
  }, [running]);
  useEffect(() => {
    const unlock = (event: Event) => { if (event.type === 'keydown' && event.target instanceof Element && event.target.closest('button, input, select, textarea')) return; if (soundEnabled && ['idle', 'locked'].includes(practiceAudio.getSnapshot())) practiceAudio.unlock(); };
    document.addEventListener('click', unlock); document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('click', unlock); document.removeEventListener('keydown', unlock); };
  }, [soundEnabled]);
  return useCallback<PreviewAudioFrame>((time, flights, camera) => {
    const cues = previewFlightCues(time, flights);
    for (const cue of cursor.current.advance(cues, time, running && !document.hidden)) {
      if (soundEnabled) practiceAudio.playCue(cue, levels[cue.kind], 0, cueSpatialMix(cue.position, camera), time);
    }
    practiceAudio.tick();
  }, [running, soundEnabled, levels]);
}
