// VEYNS Admin, Ledger: Cash Flow Overview and Top Categories charts, drawn with plain SVG (Steps B10a and B10b).
// No chart library is needed for these two.
// Step B10b: on a large screen the cash flow chart takes the exact size of its panel (fill), and the donut has a compact form.

import { useLayoutEffect, useRef, useState } from 'react';
import { formatCompactPeso, formatPeso } from './admin-ledger-format';
import type { LedgerCategoryShare } from './admin-ledger-calc';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DONUT_COLORS = ['#34d399', '#38bdf8', '#a78bfa'];

function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= rawStep) return m * pow;
  }
  return 10 * pow;
}

function axisLabel(pesos: number): string {
  return pesos >= 1000 ? `₱${pesos / 1000}k` : `₱${pesos}`;
}

// Measures the box it is attached to, now and whenever it changes size. Only active when enabled.
function useBoxSize(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const measure = () => setSize({ width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, width: size.width, height: size.height };
}

type CashFlowProps = {
  income: number[]; // 7 values, Monday to Sunday, in centavos
  expense: number[];
  fill?: boolean; // true: draw at the exact size of the parent, which must be `relative` and have a size of its own
};

type CashFlowSvgProps = { income: number[]; expense: number[]; width: number; height: number; fluid: boolean };

function CashFlowSvg({ income, expense, width, height, fluid }: CashFlowSvgProps) {
  const left = 56;
  const right = 16;
  const top = 16;
  const bottom = 32;
  const plotW = Math.max(40, width - left - right);
  const plotH = Math.max(20, height - top - bottom);

  const maxPesos = Math.max(0, ...income, ...expense) / 100;
  const step = niceStep(maxPesos / 4);
  const yMax = step * 4;
  const x = (i: number) => left + (i / 6) * plotW;
  const y = (centavos: number) => top + plotH - (centavos / 100 / yMax) * plotH;
  const line = (values: number[]) => values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const totalIncome = income.reduce((a, b) => a + b, 0);
  const totalExpense = expense.reduce((a, b) => a + b, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={fluid ? width : undefined}
      height={fluid ? height : undefined}
      className={fluid ? 'block' : 'h-auto w-full'}
      role="img"
      aria-label={`Cash flow this week, Monday to Sunday. Income ${formatPeso(totalIncome)}, expenses ${formatPeso(totalExpense)}.`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const gy = top + plotH - (i / 4) * plotH;
        return (
          <g key={i}>
            <line x1={left} x2={width - right} y1={gy} y2={gy} stroke="#ffffff" strokeOpacity="0.07" />
            <text x={left - 8} y={gy + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
              {axisLabel(step * i)}
            </text>
          </g>
        );
      })}
      {DAY_LABELS.map((label, i) => (
        <text key={label} x={x(i)} y={height - 10} textAnchor="middle" fontSize="11" fill="#9ca3af">
          {label}
        </text>
      ))}
      <polyline points={line(expense)} fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={line(income)} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {expense.map((v, i) => (
        <circle key={`e${i}`} cx={x(i)} cy={y(v)} r="4" fill="#f87171" />
      ))}
      {income.map((v, i) => (
        <circle key={`i${i}`} cx={x(i)} cy={y(v)} r="4" fill="#34d399" />
      ))}
    </svg>
  );
}

export function AdminLedgerCashFlowChart({ income, expense, fill = false }: CashFlowProps) {
  const box = useBoxSize(fill);
  if (!fill) return <CashFlowSvg income={income} expense={expense} width={640} height={260} fluid={false} />;
  return (
    <div ref={box.ref} className="absolute inset-0">
      {box.width > 0 && box.height > 0 ? <CashFlowSvg income={income} expense={expense} width={box.width} height={box.height} fluid /> : null}
    </div>
  );
}

type DonutProps = { shares: LedgerCategoryShare[]; total: number; compact?: boolean };

export function AdminLedgerCategoryDonut({ shares, total, compact = false }: DonutProps) {
  if (total <= 0 || shares.length === 0) {
    return <p className={`${compact ? 'py-6' : 'py-10'} text-center text-sm text-zinc-500`}>No income in this period.</p>;
  }

  // Top 2 categories, everything else grouped as "Others".
  const top = shares.slice(0, 2);
  const restCentavos = shares.slice(2).reduce((sum, s) => sum + s.centavos, 0);
  const items = restCentavos > 0 ? [...top, { category: 'Others', centavos: restCentavos, percent: 0 }] : top;
  const shown = items.map((s) => ({ ...s, percent: Math.round((s.centavos / total) * 100) }));

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={compact ? 'flex items-center justify-center gap-4' : 'flex flex-wrap items-center justify-center gap-6'}>
      <svg viewBox="0 0 160 160" className={compact ? 'h-32 w-32 shrink-0' : 'h-40 w-40 shrink-0'} role="img" aria-label={`Income by category, total ${formatPeso(total)}`}>
        <g transform="rotate(-90 80 80)">
          {shown.map((s, i) => {
            const length = (s.centavos / total) * circumference;
            const circle = (
              <circle
                key={s.category}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                strokeWidth="18"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return circle;
          })}
        </g>
        <text x="80" y="78" textAnchor="middle" fontSize="18" fontWeight="700" fill="#ffffff">
          {formatCompactPeso(total)}
        </text>
        <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#9ca3af">
          Total
        </text>
      </svg>
      <ul className={compact ? 'min-w-0 flex-1 space-y-2.5 text-sm' : 'min-w-[10rem] space-y-3 text-sm'}>
        {shown.map((s, i) => (
          <li key={s.category} className="flex items-center justify-between gap-4 text-zinc-200">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden="true" />
              {s.category}
            </span>
            <span className="font-semibold text-white">{s.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
