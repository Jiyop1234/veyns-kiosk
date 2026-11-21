// VEYNS Admin, Ledger: the 4 summary cards with a small trend line (Step B10a).

import { ArrowDown, ArrowUp, Coins, Wallet, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatPeso } from './admin-ledger-format';

type Series = number[];

type Props = {
  income: number;
  expense: number;
  net: number;
  balance: number;
  previous: { income: number; expense: number; net: number } | null;
  compareLabel: string | null;
  spark: { income: Series; expense: Series; net: Series; balance: Series };
};

function Sparkline({ id, values, color }: { id: string; values: Series; color: string }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-28 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Trend({ current, previous, compareLabel, upIsGood }: { current: number; previous: number | null; compareLabel: string | null; upIsGood: boolean }) {
  if (!compareLabel) return <span className="text-xs text-zinc-500">All time</span>;
  if (previous === null || previous <= 0) return <span className="text-xs text-zinc-500">No data for {compareLabel}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="text-xs text-zinc-400">Same as {compareLabel}</span>;
  const up = pct > 0;
  const good = up === upIsGood;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
      {up ? '+' : ''}
      {pct}% vs {compareLabel}
    </span>
  );
}

function Card({ icon, iconClass, label, value, trend, spark }: { icon: ReactNode; iconClass: string; label: string; value: string; trend: ReactNode; spark: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm text-zinc-300">{label}</p>
          <p className="truncate text-2xl font-bold text-white">{value}</p>
          {trend}
        </div>
      </div>
      {spark}
    </div>
  );
}

export function AdminLedgerSummaryCards({ income, expense, net, balance, previous, compareLabel, spark }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        icon={<ArrowUp className="h-6 w-6" aria-hidden="true" />}
        iconClass="bg-emerald-500/15 text-emerald-400"
        label="Total Income"
        value={formatPeso(income)}
        trend={<Trend current={income} previous={previous ? previous.income : null} compareLabel={compareLabel} upIsGood />}
        spark={<Sparkline id="ledger-spark-income" values={spark.income} color="#34d399" />}
      />
      <Card
        icon={<ArrowDown className="h-6 w-6" aria-hidden="true" />}
        iconClass="bg-red-500/15 text-red-400"
        label="Total Expenses"
        value={formatPeso(expense)}
        trend={<Trend current={expense} previous={previous ? previous.expense : null} compareLabel={compareLabel} upIsGood={false} />}
        spark={<Sparkline id="ledger-spark-expense" values={spark.expense} color="#f87171" />}
      />
      <Card
        icon={<Wallet className="h-6 w-6" aria-hidden="true" />}
        iconClass="bg-lime-400/15 text-lime-300"
        label="Net Profit"
        value={formatPeso(net)}
        trend={<Trend current={net} previous={previous ? previous.net : null} compareLabel={compareLabel} upIsGood />}
        spark={<Sparkline id="ledger-spark-net" values={spark.net} color="#a3e635" />}
      />
      <Card
        icon={<Coins className="h-6 w-6" aria-hidden="true" />}
        iconClass="bg-violet-500/15 text-violet-300"
        label="Cash Balance"
        value={formatPeso(balance)}
        trend={
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            All income minus all expenses
          </span>
        }
        spark={<Sparkline id="ledger-spark-balance" values={spark.balance} color="#a78bfa" />}
      />
    </div>
  );
}
