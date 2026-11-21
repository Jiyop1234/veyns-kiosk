// VEYNS Admin: one menu item card of the Menu Manager (Step B7). It only shows the item and calls the handlers it is given.
import React from 'react';
import { Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { formatPeso } from '@/lib/menu-data';
import { AdminMenuImage } from '@/components/admin/menu-manager/admin-menu-image';

export function AdminMenuCard({ item, displayImage, sold, selecting, selected, editing, onToggleSelect, onEdit, onToggleAvailability, onDelete }: any) {
  const discountPct = Number(item.discountPercent || 0);
  const effective = discountPct > 0 ? item.price * (1 - discountPct / 100) : item.price;
  const isAvailable = item.isAvailable !== false;
  const groups = Array.isArray(item.optionGroups) ? item.optionGroups.length : 0;
  return (
    <div className={`relative flex gap-3 rounded-2xl bg-white/[0.04] p-3 ${isAvailable ? '' : 'opacity-60'} ${selected ? 'ring-2 ring-lime-400' : editing ? 'ring-2 ring-lime-400/50' : ''}`}>
      {selecting && (
        <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect(item.id)} aria-label={`Select ${item.name}`}
          className="absolute left-2 top-2 z-10 h-4 w-4 cursor-pointer accent-lime-400" />
      )}
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#0d2e26]">
        <AdminMenuImage src={displayImage} alt={item.name} className="h-full w-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate font-display text-sm font-extrabold text-white" title={item.name}>{item.name}</h4>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{item.category}{item.isExtra ? ' • Extra' : ''}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${isAvailable ? 'bg-lime-400/15 text-lime-300' : 'bg-red-500/15 text-red-300'}`}>{isAvailable ? 'Available' : 'Hidden'}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {item.bestSeller && <span className="rounded bg-lime-400 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-black">Best seller</span>}
          {discountPct > 0 && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-300">{discountPct}% off</span>}
          {groups > 0 && <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-zinc-300">{groups} option group{groups === 1 ? '' : 's'}</span>}
        </div>
        <p className="line-clamp-2 text-[11px] text-zinc-400">{item.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-extrabold leading-none text-lime-400">{formatPeso(effective)}</span>
            {discountPct > 0 && <span className="text-[10px] text-zinc-500 line-through">{formatPeso(item.price)}</span>}
          </div>
          <span className="text-[10px] font-semibold text-zinc-400">{sold} sold this month</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onEdit(item, displayImage)} className="flex cursor-pointer items-center gap-1 rounded-lg bg-lime-400/15 px-3 py-1.5 text-[11px] font-bold text-lime-300 hover:bg-lime-400 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"><Pencil className="h-3 w-3" /> Edit</button>
          <button type="button" onClick={() => onToggleAvailability(item.id, isAvailable)} className="flex cursor-pointer items-center gap-1 rounded-lg bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
            {isAvailable ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
          </button>
          <button type="button" title="Delete item" aria-label={`Delete ${item.name}`} onClick={() => onDelete(item.id)} className="ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-white/[0.08] text-red-300 hover:bg-red-500 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
