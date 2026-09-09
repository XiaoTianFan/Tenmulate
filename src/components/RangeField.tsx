import { useEffect, useRef, useState } from 'react';

export function RangeField({ label, value, min, max, step, unit, onChange, commitOnRelease = false }: Readonly<{
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (value: number) => void;
  commitOnRelease?: boolean;
}>) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false), pending = useRef(value);
  useEffect(() => { if (!editing.current) { setDraft(value); pending.current = value; } }, [value]);
  const commit = () => {
    if (!editing.current) return;
    editing.current = false; if (pending.current !== value) onChange(pending.current);
  };
  const displayed = commitOnRelease ? draft : value;
  return <label className="range-field">
    <span>{label}</span>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={displayed}
      onPointerDown={commitOnRelease ? event => { editing.current = true; event.currentTarget.setPointerCapture(event.pointerId); } : undefined}
      onPointerUp={commitOnRelease ? commit : undefined}
      onPointerCancel={commitOnRelease ? () => { editing.current = false; pending.current = value; setDraft(value); } : undefined}
      onKeyDown={commitOnRelease ? event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) editing.current = true; } : undefined}
      onKeyUp={commitOnRelease ? commit : undefined} onBlur={commitOnRelease ? commit : undefined}
      onChange={event => {
        const next = Number(event.target.value); pending.current = next; setDraft(next);
        if (!commitOnRelease || !editing.current) onChange(next);
      }} />
    <output>{displayed.toFixed(step < 1 ? 2 : 0)}</output><small>{unit}</small>
  </label>;
}
