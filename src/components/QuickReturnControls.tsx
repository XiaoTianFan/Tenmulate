import type { ReturnShotConfiguration, ReturnShotType } from '../content/types';
import { defaultReturnShot, RETURN_SHOT_PROFILES } from '../engine/session/returnShot';
import { SHOT_TYPE_LABELS } from '../domain/shotKinds';
import { RangeField } from './RangeField';
import { ContactTimingControl } from './ContactTimingControl';

export function QuickReturnControls({ shot, onChange }: { shot: ReturnShotConfiguration; onChange: (shot: ReturnShotConfiguration) => void }) {
  return <>
    <label className="select-field"><span>Return shot</span><select aria-label="Your return shot" value={shot.type} onChange={e => onChange({ ...defaultReturnShot(e.target.value as ReturnShotType), contactTiming: shot.contactTiming })}>{Object.keys(RETURN_SHOT_PROFILES).map(type => <option value={type} key={type}>{SHOT_TYPE_LABELS[type as ReturnShotType]}</option>)}</select></label>
    <label className="select-field"><span>Return spin</span><select aria-label="Your return spin" value={shot.spin} onChange={e => onChange({ ...defaultReturnShot(shot.type, e.target.value as ReturnShotConfiguration['spin']), paceKmh: shot.paceKmh, contactTiming: shot.contactTiming })}>{['topspin', 'flat', 'slice'].map(spin => <option value={spin} key={spin}>{spin[0]!.toUpperCase() + spin.slice(1)}</option>)}</select></label>
    <ContactTimingControl family={shot.type} value={shot.contactTiming} label="Player contact timing" onChange={contactTiming => onChange({ ...shot, contactTiming })}/>
    <RangeField commitOnRelease label="Return speed" min={20} max={160} step={1} unit="km/h" value={shot.paceKmh ?? RETURN_SHOT_PROFILES[shot.type].pace} onChange={paceKmh => onChange({ ...shot, paceKmh })}/>
    <RangeField commitOnRelease label="Return spin rate" min={0} max={6000} step={10} unit="rpm" value={shot.spinRateRpm ?? 600} onChange={spinRateRpm => onChange({ ...shot, spinRateRpm })}/>
  </>;
}
