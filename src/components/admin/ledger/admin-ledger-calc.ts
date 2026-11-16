// VEYNS Admin, Ledger: totals, daily series and category breakdown (Step B10a).
// Pure functions: no state, no network. Amounts are centavos.

import { DAY_MS } from './admin-ledger-format';
import type { LedgerEntry, LedgerKind } from './admin-ledger-types';

export function totalsFor(entries: LedgerEntry[]) {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.kind === 'income') income += e.amountCentavos;
    else expense += e.amountCentavos;
  }
  return { income, expense, net: income - expense };
}

export type LedgerDailySeries = {
  starts: number[];
  income: number[];
  expense: number[];
  net: number[];
  balance: number[]; // running total (all income minus all expenses) at the end of each day
};

// `firstDayStart` must be 00:00 Philippine time of the first day.
export function dailySeries(entries: LedgerEntry[], firstDayStart: number, days: number): LedgerDailySeries {
  const starts: number[] = [];
  const income: number[] = [];
  const expense: number[] = [];
  const net: number[] = [];
  const balance: number[] = [];

  let running = 0;
  for (const e of entries) {
    if (e.occurredAt < firstDayStart) running += e.kind === 'income' ? e.amountCentavos : -e.amountCentavos;
  }

  for (let i = 0; i < days; i += 1) {
    const start = firstDayStart + i * DAY_MS;
    const end = start + DAY_MS;
    let dayIncome = 0;
    let dayExpense = 0;
    for (const e of entries) {
      if (e.occurredAt >= start && e.occurredAt < end) {
        if (e.kind === 'income') dayIncome += e.amountCentavos;
        else dayExpense += e.amountCentavos;
      }
    }
    running += dayIncome - dayExpense;
    starts.push(start);
    income.push(dayIncome);
    expense.push(dayExpense);
    net.push(dayIncome - dayExpense);
    balance.push(running);
  }
  return { starts, income, expense, net, balance };
}

export type LedgerCategoryShare = { category: string; centavos: number; percent: number };

export function categoryBreakdown(entries: LedgerEntry[], kind: LedgerKind): LedgerCategoryShare[] {
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    if (e.kind !== kind) continue;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCentavos);
    total += e.amountCentavos;
  }
  return Array.from(byCategory.entries())
    .map(([category, centavos]) => ({
      category,
      centavos,
      percent: total > 0 ? Math.round((centavos / total) * 100) : 0,
    }))
    .sort((a, b) => b.centavos - a.centavos);
}
