import { t } from '../i18n/locale';
import type { ContactTiming, ShotFamily } from '../content/types';
import { normalizeContactTiming, usesBounceContact } from '../engine/session/bounceContact';

export function ContactTimingControl({ family, value, label, onChange }: {
  family: ShotFamily; value?: ContactTiming; label: string; onChange: (timing: ContactTiming) => void;
}) {
  if (!usesBounceContact(family)) return null;
  const halfVolley = family === 'half-volley';
  return <label className="select-field"><span>{t("Contact timing")}</span>
    <select aria-label={t(label)} value={halfVolley ? 'rise' : normalizeContactTiming(value)} disabled={halfVolley}
      onChange={event => onChange(event.target.value as ContactTiming)}>
      <option value="rise">{t("On the rise")}</option>
      <option value="apex">{t("At the apex")}</option>
      <option value="descent">{t("Early descent")}</option>
    </select>
  </label>;
}
