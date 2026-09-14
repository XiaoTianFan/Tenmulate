import { t } from '../i18n/locale';
import type { ReturnShotConfiguration, ReturnShotType } from '../content/types';
import { defaultReturnShot, RETURN_SHOT_PROFILES } from '../engine/session/returnShot';
import { SHOT_TYPE_LABELS } from '../domain/shotKinds';
import { RangeField } from './RangeField';
import { ContactTimingControl } from './ContactTimingControl';

export function QuickReturnControls({ shot, onChange }: { shot: ReturnShotConfiguration; onChange: (shot: ReturnShotConfiguration) => void }) {
  return <>
    <label className="select-field"><span>{t("Return shot")}</span><select aria-label={t("Your return shot")} value={shot.type} onChange={e => onChange({ ...defaultReturnShot(e.target.value as ReturnShotType), contactTiming: shot.contactTiming })}>{Object.keys(RETURN_SHOT_PROFILES).map(type => <option value={type} key={type}>{t(SHOT_TYPE_LABELS[type as ReturnShotType])}</option>)}</select></label>
    <label className="select-field"><span>{t("Return spin")}</span><select aria-label={t("Your return spin")} value={shot.spin} onChange={e => onChange({ ...defaultReturnShot(shot.type, e.target.value as ReturnShotConfiguration['spin']), paceKmh: shot.paceKmh, contactTiming: shot.contactTiming })}>{['topspin', 'flat', 'slice'].map(spin => <option value={spin} key={spin}>{t(spin)}</option>)}</select></label>
    <ContactTimingControl family={shot.type} value={shot.contactTiming} label={t("Player contact timing")} onChange={contactTiming => onChange({ ...shot, contactTiming })}/>
    <RangeField commitOnRelease label={t("Return speed")} min={20} max={160} step={1} unit={t("km/h")} value={shot.paceKmh ?? RETURN_SHOT_PROFILES[shot.type].pace} onChange={paceKmh => onChange({ ...shot, paceKmh })}/>
    <RangeField commitOnRelease label={t("Return spin rate")} min={0} max={6000} step={10} unit={t("rpm")} value={shot.spinRateRpm ?? 600} onChange={spinRateRpm => onChange({ ...shot, spinRateRpm })}/>
  </>;
}
