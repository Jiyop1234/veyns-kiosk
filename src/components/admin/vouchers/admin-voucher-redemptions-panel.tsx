// @ts-nocheck
// VEYNS Admin Vouchers: the redemption history of one voucher (Step B6).
// Same rows as the old list under the voucher cards; the tab loads them with the same query (promo_redemptions, newest 100).
import React from 'react';
import { BarChart2, X } from 'lucide-react';
import { formatManila } from '@/lib/promo-campaigns';

export function AdminVoucherRedemptionsPanel({ redemptionView, customers, onClose, className = '' }: any) {
  return (
    <div className={`flex min-h-0 flex-col gap-2 rounded-2xl bg-white/[0.04] p-4 ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-white"><BarChart2 className="h-4 w-4 text-lime-400" /> {redemptionView ? `Redemptions: ${redemptionView.code}` : 'Redemptions'}</h2>
        {redemptionView && <button type="button" onClick={onClose} aria-label="Close redemptions" className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>}
      </div>
      <div className="min-h-[72px] flex-1 space-y-1 overflow-y-auto pr-1">
        {!redemptionView ? (
          <p className="py-4 text-center text-[11px] text-zinc-500">Press Redemptions on a voucher to see who used it.</p>
        ) : redemptionView.loading ? (
          <p className="py-4 text-center text-[11px] text-zinc-400">Loading…</p>
        ) : redemptionView.rows.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-zinc-400">No redemptions recorded for this voucher yet.</p>
        ) : (
          redemptionView.rows.map((r: any) => {
            const cust = customers.find((c: any) => c.auth_user_id && c.auth_user_id === r.user_id);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px]">
                <span className="font-bold text-white">{r.order_number || 'Order'}</span>
                <span className="text-zinc-300">{cust ? cust.name : r.user_id ? 'Registered customer' : 'Walk-in'}</span>
                <span className="text-amber-300">{formatManila(Date.parse(r.redeemed_at))}</span>
                <span className={`rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase ${r.status === 'redeemed' ? 'bg-lime-400/20 text-lime-300' : 'bg-zinc-600/40 text-zinc-300'}`}>{r.status === 'redeemed' ? 'redeemed' : 'voided (order cancelled)'}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
