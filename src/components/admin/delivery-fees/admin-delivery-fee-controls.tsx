// @ts-nocheck
// Small form controls shared by the Delivery Fee screen: number box, slider row, segmented buttons, on/off switch.
// Step B11a: new file. They only report the value typed or chosen; the tab cleans it up with normalizeRule.
import { useState, useEffect } from 'react';

// A number box that lets you clear it and type a new number: the value is reported as soon as the text is a valid number.
export function FeeNumberBox({ value, onChange, min, max, step, prefix, suffix, label, width = 'w-24' }: any) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);
  return (
    <label className={`flex h-9 items-center gap-1 rounded-xl bg-white/[0.06] px-2.5 text-sm font-bold text-lime-400 focus-within:ring-1 focus-within:ring-lime-400/70 ${width}`}>
      {prefix ? <span className="text-white/50">{prefix}</span> : null}
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setText(String(value)); }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full min-w-0 bg-transparent text-right focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix ? <span className="text-white/50">{suffix}</span> : null}
    </label>
  );
}

// A label, a number box and a slider; shows the live value underneath when the draft differs from it.
export function FeeRuleSlider({ label, value, liveValue, min, max, step, prefix, suffix, onChange }: any) {
  const changed = liveValue !== undefined && Number(liveValue) !== Number(value);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">{label}</span>
        <FeeNumberBox value={value} onChange={onChange} min={min} max={max} step={step} prefix={prefix} suffix={suffix} label={label} />
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 h-1.5 w-full cursor-pointer accent-lime-400"
      />
      {changed ? <p className="text-[10px] text-white/40">Live rule: {prefix}{liveValue}{suffix ? ` ${suffix}` : ''}</p> : null}
    </div>
  );
}

export function FeeSegmented({ options, value, onChange, label }: any) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o: any) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${value === o.value ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-white/70 hover:bg-white/10'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FeeSwitch({ on, onToggle, label }: any) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${on ? 'bg-lime-400' : 'bg-white/15'}`}
    >
      <span className={`absolute left-0.5 top-0.5 size-5 rounded-full transition-transform ${on ? 'translate-x-5 bg-black' : 'bg-white'}`} />
    </button>
  );
}
