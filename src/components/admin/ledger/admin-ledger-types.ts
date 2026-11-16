// VEYNS Admin, Ledger: shared types, category lists and constants (Step B10a).
// Amounts are whole centavos (integers) so money never goes through floating point sums.

export type LedgerKind = 'income' | 'expense';

export type LedgerPeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  occurredAt: number; // epoch milliseconds
  description: string;
  category: string;
  amountCentavos: number; // always positive; the kind decides the sign
  notes: string;
};

export type LedgerEntryInput = Omit<LedgerEntry, 'id'>;

export const LEDGER_INCOME_CATEGORIES: string[] = ['Food Sales', 'Delivery', 'Other Income'];

export const LEDGER_EXPENSE_CATEGORIES: string[] = [
  'Ingredients',
  'Packaging',
  'Utilities',
  'Rent',
  'Salaries',
  'Marketing',
  'Other Expense',
];

export const LEDGER_PERIODS: { id: LedgerPeriod; label: string; compareLabel: string | null }[] = [
  { id: 'today', label: 'Today', compareLabel: 'yesterday' },
  { id: 'week', label: 'This Week', compareLabel: 'last week' },
  { id: 'month', label: 'This Month', compareLabel: 'last month' },
  { id: 'year', label: 'This Year', compareLabel: 'last year' },
  { id: 'all', label: 'All Time', compareLabel: null },
];

export const LEDGER_PAGE_SIZE = 5;

// Colored pill for each category (Tailwind classes).
export const LEDGER_CATEGORY_CLASS: Record<string, string> = {
  'Food Sales': 'bg-emerald-500/20 text-emerald-300',
  Delivery: 'bg-sky-500/20 text-sky-300',
  'Other Income': 'bg-violet-500/20 text-violet-300',
  Ingredients: 'bg-amber-500/20 text-amber-300',
  Packaging: 'bg-purple-500/20 text-purple-300',
  Utilities: 'bg-cyan-500/20 text-cyan-300',
  Rent: 'bg-rose-500/20 text-rose-300',
  Salaries: 'bg-orange-500/20 text-orange-300',
  Marketing: 'bg-pink-500/20 text-pink-300',
  'Other Expense': 'bg-zinc-500/25 text-zinc-300',
};

export const LEDGER_FALLBACK_CATEGORY_CLASS = 'bg-zinc-500/25 text-zinc-300';
