import { useSyncExternalStore } from 'react';
import { DEFAULT_AUDIO_LEVELS, type AudioLevels } from '../engine/audio/AudioCueEngine';

// Shared for this app visit, including setup -> playback -> setup transitions.
let settings = { levels: DEFAULT_AUDIO_LEVELS, enabled: true, crowdEnabled: true };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useAudioSettings() {
  const value = useSyncExternalStore(subscribe, () => settings);
  const update = (patch: Partial<typeof settings>) => { settings = { ...settings, ...patch }; listeners.forEach(listener => listener()); };
  return { audioLevels: value.levels, soundEnabled: value.enabled, crowdEnabled: value.crowdEnabled,
    setAudioLevels: (next: AudioLevels | ((current: AudioLevels) => AudioLevels)) => update({ levels: typeof next === 'function' ? next(settings.levels) : next }),
    setSoundEnabled: (next: boolean | ((current: boolean) => boolean)) => update({ enabled: typeof next === 'function' ? next(settings.enabled) : next }),
    setCrowdEnabled: (next: boolean) => update({ crowdEnabled: next }),
  };
}
