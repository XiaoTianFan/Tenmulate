import { t } from '../i18n/locale';
import type { OpponentHand } from '../content/types';

export function PlayerHandControls({ hand, onChange }: { hand: OpponentHand; onChange: (hand: OpponentHand) => void }) {
  return <fieldset className="player-hand-controls">
    <legend>{t("Player handedness")}</legend>
    <div>{(['right', 'left'] as const).map(value => <label key={value}>
      <input type="radio" name="drill-player-hand" value={value} checked={hand === value} onChange={() => onChange(value)}/>
      <span>{value === 'right' ? t("Right-handed") : t("Left-handed")}</span>
    </label>)}</div>
  </fieldset>;
}
