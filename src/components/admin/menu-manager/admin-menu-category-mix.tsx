// VEYNS Admin: the Category Mix strip of the Menu Manager (Step B7). Share of menu items per category (not of sales).
import React from 'react';

const BAR_COLORS = ['bg-lime-400', 'bg-amber-400', 'bg-sky-400', 'bg-fuchsia-400', 'bg-rose-400', 'bg-teal-400'];

export function AdminMenuCategoryMix({ menuItems }: any) {
  const items: any[] = menuItems || [];
  const counts: Record<string, number> = {};
  items.forEach((m) => { const c = m.category || 'Other'; counts[c] = (counts[c] || 0) + 1; });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = items.length;
  return (
    <div className="shrink-0 rounded-2xl bg-white/[0.04] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="font-display text-sm font-extrabold text-white">Category mix <span className="text-[10px] font-semibold text-zinc-400">(share of menu items)</span></p>
        {total > 0 && (
          <div className="flex h-2 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
            {rows.map(([name, n], i) => <div key={name} className={BAR_COLORS[i % BAR_COLORS.length]} style={{ width: `${(n / total) * 100}%` }} />)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {rows.map(([name, n], i) => (
            <span key={name} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
              <span className={`h-2 w-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} />
              {name} {total ? Math.round((n / total) * 100) : 0}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
