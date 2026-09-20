import { useSyncExternalStore } from 'react';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { practiceAudio } from '../engine/audio/AudioCueEngine';
import { t } from '../i18n/locale';

export function AudioSettings() {
  const { audioLevels, setAudioLevels, soundEnabled, setSoundEnabled, crowdEnabled, setCrowdEnabled } = useAudioSettings();
  const status = useSyncExternalStore(practiceAudio.subscribe, practiceAudio.getSnapshot);
  const channels = [
    ['countdown', t('Countdown'), t('Countdown volume')],
    ['contact', t('Ball contact'), t('Contact volume')],
    ['bounce', t('Ball bounce'), t('Bounce volume')],
    ['footwork', t('Footwork'), t('Footwork cue volume')],
    ['ambience', t('Ambience'), t('Ambience volume')],
    ['crowd', t('Crowd'), t('Crowd volume')],
  ] as const;
  return <details className="editor-section" open><summary>{t('Sound')}</summary>

    {channels.map(([key, label, aria]) => <label className="compact-range" key={key}><span>{label}</span>
      <input aria-label={aria} type="range" min="0" max="1" step="0.1" value={audioLevels[key]} disabled={key === 'crowd' && !crowdEnabled}
        onChange={event => { practiceAudio.unlock(); setAudioLevels(current => ({ ...current, [key]: Number(event.target.value) })); }} />
      <output>{Math.round(audioLevels[key] * 100)}%</output></label>)}
    <label className="compact-check"><input type="checkbox" checked={crowdEnabled} onChange={event => { practiceAudio.unlock(); setCrowdEnabled(event.target.checked); }} /><span>{t('Crowd sound')}</span></label>
    <button type="button" className="secondary-button sound-master-button" onClick={() => {
      if (!soundEnabled || status === 'locked' || status === 'idle') { setSoundEnabled(true); practiceAudio.unlock(); }
      else setSoundEnabled(false);
    }}>{!soundEnabled ? t('Unmute all sound') : status === 'locked' || status === 'idle' ? t('Tap to enable sound') : t('Mute all sound')}</button>
    {status === 'fallback' ? <p role="status">{t('Some sounds unavailable · available sounds remain active')} <button type="button" onClick={() => practiceAudio.retry()}>{t('Retry sound')}</button></p> : null}
    {status === 'unavailable' ? <p role="status">{t('Audio is unavailable in this browser')}</p> : null}
  </details>;
}
