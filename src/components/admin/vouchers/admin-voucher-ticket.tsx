// @ts-nocheck
// VEYNS Admin Vouchers: one voucher as a ticket (Step B6). Display only: every button calls a handler the tab passes in.
// Colors follow the kind: lime = food, sky = delivery, amber = scheduled, grey = disabled or expired.
import React from 'react';
import { Check, Copy, Edit2, Layers, Power, Trash2, BarChart2, Ticket } from 'lucide-react';
import { formatPeso } from '@/lib/menu-data';
import { getPromoEndMs, isCampaignPromo, formatManila } from '@/lib/promo-campaigns';

const TONES: Record<string, { bg: string; text: string; soft: string; track: string; bar: string }> = {
  food: { bg: 'bg-lime-400', text: 'text-black', soft: 'text-black/70', track: 'bg-black/15', bar: 'bg-black/70' },
  delivery: { bg: 'bg-sky-300', text: 'text-black', soft: 'text-black/70', track: 'bg-black/15', bar: 'bg-black/70' },
  scheduled: { bg: 'bg-amber-400', text: 'text-black', soft: 'text-black/70', track: 'bg-black/15', bar: 'bg-black/70' },
  muted: { bg: 'bg-zinc-700', text: 'text-zinc-100', soft: 'text-zinc-300', track: 'bg-black/25', bar: 'bg-zinc-300' }
};

export function AdminVoucherTicket({ p, status, countdownText, isExpiringSoon, redemptionOpen, copied, onEdit, onDuplicate, onRedemptions, onToggle, onDelete, onCopy }: any) {
  const isDelivery = p.target_type === 'delivery';
  const limitReached = !!p.usageLimit && Number(p.usageCount || 0) >= Number(p.usageLimit);
  const tone = TONES[status === 'disabled' || status === 'expired' ? 'muted' : status === 'scheduled' ? 'scheduled' : isDelivery ? 'delivery' : 'food'];
  const used = Number(p.usageCount || 0);
  const pct = p.usageLimit ? Math.min(100, Math.round((used / Number(p.usageLimit)) * 100)) : 0;
  const endMs = getPromoEndMs(p);
  const perAccount = p.perPersonLimit === null || p.perPersonLimit === undefined ? 'Multiple uses' : p.perPersonLimit === 1 ? 'One-time per account' : `${p.perPersonLimit} per account`;
  const chip = 'rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white';
  const action = 'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-zinc-100 hover:bg-white/10 cursor-pointer';

  return (
    <div className={`relative flex min-h-[158px] overflow-hidden rounded-2xl ${tone.bg} ${tone.text} ${isExpiringSoon ? 'ring-2 ring-red-500' : ''}`}>
      {/* left: what the voucher gives */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={chip}>{limitReached ? 'Limit reached' : status}</span>
          <span className={chip}>{isDelivery ? 'Delivery' : 'Food'}</span>
          {p.visibility === 'hidden' && <span className={chip}>Hidden</span>}
        </div>
        <div className="min-w-0">
          <p className="font-display text-3xl font-extrabold leading-none">{p.type === 'peso' ? `${formatPeso(p.discountValue)} OFF` : `${p.discountValue}% OFF`}</p>
          <p className="mt-1 text-sm font-extrabold uppercase">{isDelivery ? 'Delivery fee' : 'Food subtotal'}</p>
        </div>
        <div className={`min-w-0 text-[11px] font-semibold ${tone.soft}`}>
          <p className="flex items-center gap-1.5 truncate"><Ticket className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{p.name ? `Campaign: ${p.name}` : p.description || 'Voucher'}</span></p>
          <p className="truncate">{perAccount}{p.minPurchase > 0 ? ` • Min ${formatPeso(p.minPurchase)}` : ''}</p>
        </div>
      </div>

      {/* middle: code, usage and time left (dashed edge with the two ticket notches) */}
      <div className="relative flex w-[200px] shrink-0 flex-col justify-between gap-2 border-l-2 border-dashed border-black/30 p-4">
        <span className="absolute -left-[9px] -top-2 h-4 w-4 rounded-full bg-[#020b08]" />
        <span className="absolute -bottom-2 -left-[9px] h-4 w-4 rounded-full bg-[#020b08]" />
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 break-all font-mono text-base font-extrabold tracking-wide">{p.code}</span>
          <button type="button" onClick={() => onCopy(p.code)} title="Copy code" aria-label={`Copy code ${p.code}`} className="shrink-0 rounded-md p-1 hover:bg-black/10 cursor-pointer">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="space-y-1">
          {p.usageLimit ? <div className={`h-2 w-full rounded-full ${tone.track}`}><div className={`h-2 rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} /></div> : null}
          <p className="flex items-center justify-between text-[11px] font-extrabold uppercase">
            <span>{p.usageLimit ? `${pct}% used` : 'No limit'}</span>
            <span>{p.usageLimit ? `${used} / ${p.usageLimit}` : `${used} used`}</span>
          </p>
        </div>
        <p className={`text-[11px] font-bold ${isExpiringSoon ? 'text-red-700' : tone.soft}`} title={isCampaignPromo(p) ? `${formatManila(p.startDate)} → ${endMs ? formatManila(endMs) : 'no end date'}` : undefined}>
          {countdownText}
        </p>
      </div>

      {/* right: actions */}
      <div className="flex w-[118px] shrink-0 flex-col justify-center gap-0.5 bg-black/80 p-2">
        <button type="button" onClick={() => onEdit(p)} className={action}><Edit2 className="h-3.5 w-3.5 shrink-0" />Edit</button>
        <button type="button" onClick={() => onRedemptions(p.code)} className={action}><BarChart2 className="h-3.5 w-3.5 shrink-0" />{redemptionOpen ? 'Hide' : 'Redemptions'}</button>
        <button type="button" onClick={() => onToggle(p)} className={action}><Power className="h-3.5 w-3.5 shrink-0" />{p.isEnabled === false ? 'Enable' : 'Disable'}</button>
        <button type="button" onClick={() => onDuplicate(p)} className={action}><Layers className="h-3.5 w-3.5 shrink-0" />Duplicate</button>
        <button type="button" onClick={() => onDelete(p.code)} className={`${action} text-red-300`}><Trash2 className="h-3.5 w-3.5 shrink-0" />Delete</button>
      </div>
    </div>
  );
}
