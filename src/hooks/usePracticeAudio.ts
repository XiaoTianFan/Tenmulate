import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { SessionLaunch } from '../app/types';
import type { CompiledSession } from '../engine/session/compileSession';
import type { SessionPlayer } from './useSessionPlayer';
import { practiceAudio, type AudioLevels } from '../engine/audio/AudioCueEngine';
import { AudioCueCursor, cueSpatialMix, spatialSessionCues } from '../engine/audio/spatialCues';
import { sampleCameraTimeline } from '../engine/session/cameraTimeline';
import { motionEvent, sampleOpponentTimeline } from '../engine/session/opponentTimeline';
import { overheadPracticeCamera } from '../engine/session/practiceReturn';

/** Observes the existing clock. Never advances or schedules ahead of the simulation. */
export function usePracticeAudio(session: CompiledSession, launch: SessionLaunch, player: SessionPlayer, levels: AudioLevels, enabled: boolean) {
  const cursor = useRef(new AudioCueCursor());
  const countdown = useRef<number | null>(null);
  const cues = useMemo(() => spatialSessionCues(session), [session]);
  const motion = useMemo(() => session.repetitions.map(motionEvent), [session]);
  const state = useRef({ player, levels, enabled });
  const status = useSyncExternalStore(practiceAudio.subscribe, practiceAudio.getSnapshot, () => 'idle' as const);
  useLayoutEffect(() => { state.current = { player, levels, enabled }; }, [player, levels, enabled]);
  useLayoutEffect(() => {
    cursor.current.reset(); countdown.current = null; practiceAudio.resetTimeline();
    return () => practiceAudio.setPlayback('idle');
  }, [session]);
  useLayoutEffect(() => {
    practiceAudio.configure(launch.environment, launch.surface, levels, enabled);
  }, [launch.environment, launch.surface, levels, enabled]);
  useLayoutEffect(() => {
    practiceAudio.setPlayback(document.hidden ? 'paused' : player.status);
    if (player.status === 'countdown' && player.countdown !== countdown.current) {
      countdown.current = player.countdown;
      if (!document.hidden && enabled) practiceAudio.play('countdown', levels.countdown);
    }
  }, [session, player.status, player.countdown, levels.countdown, enabled]);
  useEffect(() => {
    let frame = 0;
    const seed = [...session.settings.seed].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619), 2166136261);
    const tick = () => {
      const { player, levels, enabled } = state.current;
      const current = player.clock.current;
      const running = !document.hidden && player.status !== 'paused' && player.status !== 'completed';
      const crossed = cursor.current.advance(cues, current, running);
      if (enabled && crossed.length) {
        const opponent = session.opponentIdle ? { ...session.opponentIdle, y: 0 } : sampleOpponentTimeline(motion, current)?.root;
        let camera = session.mode === 'drill' ? sampleCameraTimeline(session.cameraTimeline, current, opponent, window.innerWidth / window.innerHeight) : launch.camera;
        if (session.mode === 'quick-practice' && session.settings.followPracticeBall) {
          const repetition = session.repetitions.reduce((active, value) => current >= value.startTime ? value : active, session.repetitions[0]);
          if (repetition) camera = overheadPracticeCamera(launch.camera, repetition.trajectory, current - repetition.startTime,
            repetition.rallyReturn?.contactTime ?? repetition.reachability.contact?.time ?? repetition.trajectory.samples.at(-1)!.time);
        }
        for (const cue of crossed) practiceAudio.playCue(cue, levels[cue.kind], seed, cueSpatialMix(cue.position, camera), current);
      }
      practiceAudio.tick();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [cues, session, motion, launch.camera]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        practiceAudio.setPlayback('paused');
        if (state.current.player.status !== 'completed') state.current.player.pause();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  const play = useCallback(() => { practiceAudio.unlock(); player.play(); }, [player.play]);
  const pause = useCallback(() => { practiceAudio.setPlayback('paused'); player.pause(); }, [player.pause]);
  const restart = useCallback(() => {
    practiceAudio.unlock(); practiceAudio.resetTimeline(); cursor.current.reset(); countdown.current = null;
    player.restart();
  }, [player.restart]);
  const previous = useCallback(() => { practiceAudio.setPlayback('paused'); player.previous(); }, [player.previous]);
  const next = useCallback(() => { practiceAudio.setPlayback('paused'); player.next(); }, [player.next]);
  return { status, player: { ...player, play, pause, restart, previous, next } };
}
