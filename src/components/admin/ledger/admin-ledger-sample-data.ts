// VEYNS Admin, Ledger: SAMPLE entries so the screen can be seen and tried (Step B10a).
// This is not real business data. It is replaced by the database in a later step.

import { DAY_MS, manilaStartOfDay } from './admin-ledger-format';
import type { LedgerEntry } from './admin-ledger-types';

// Small fixed generator so the sample looks the same on every load.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const BOWLS = ['Chicken Rice Bowl Sale', 'Pork Rice Bowl Sale', 'Beef Rice Bowl Sale'];
const EXPENSES: { description: string; category: string; min: number; max: number }[] = [
  { description: 'Chicken Ingredients (5kg)', category: 'Ingredients', min: 600, max: 1400 },
  { description: 'Packaging Supplies', category: 'Packaging', min: 250, max: 700 },
  { description: 'Electricity Bill', category: 'Utilities', min: 900, max: 1800 },
  { description: 'Social Media Ads', category: 'Marketing', min: 200, max: 600 },
];

export function createSampleLedgerEntries(now: number): LedgerEntry[] {
  const rand = seeded(2026);
  const today = manilaStartOfDay(now);
  const entries: LedgerEntry[] = [];
  let order = 1000;
  let counter = 0;

  for (let back = 44; back >= 0; back -= 1) {
    const dayStart = today - back * DAY_MS;
    const sales = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < sales; i += 1) {
      const minutes = (9 + Math.floor(rand() * 11)) * 60 + Math.floor(rand() * 60);
      order += 1;
      entries.push({
        id: `sample-${counter++}`,
        kind: 'income',
        occurredAt: dayStart + minutes * 60000,
        description: BOWLS[Math.floor(rand() * BOWLS.length)],
        category: 'Food Sales',
        amountCentavos: (300 + Math.floor(rand() * 60) * 10) * 100,
        notes: `Order #${order}`,
      });
    }
    if (rand() < 0.5) {
      order += 1;
      entries.push({
        id: `sample-${counter++}`,
        kind: 'income',
        occurredAt: dayStart + (11 * 60 + Math.floor(rand() * 400)) * 60000,
        description: 'Delivery Fee',
        category: 'Delivery',
        amountCentavos: (60 + Math.floor(rand() * 13) * 10) * 100,
        notes: `Order #${order}`,
      });
    }
    if (rand() < 0.35) {
      const pick = EXPENSES[Math.floor(rand() * EXPENSES.length)];
      entries.push({
        id: `sample-${counter++}`,
        kind: 'expense',
        occurredAt: dayStart + (8 * 60 + Math.floor(rand() * 600)) * 60000,
        description: pick.description,
        category: pick.category,
        amountCentavos: (pick.min + Math.floor(rand() * ((pick.max - pick.min) / 10)) * 10) * 100,
        notes: '',
      });
    }
  }
  return entries.filter((e) => e.occurredAt <= now).sort((a, b) => b.occurredAt - a.occurredAt);
}
