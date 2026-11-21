// @ts-nocheck
// Step B9: the lower sections of Sales Analytics: Menu, Customers, Promos and the Boss Briefing. Display only; the numbers come from admin-sales-math.ts.
import React from 'react';
import { AlertTriangle, CheckCircle2, Info, TrendingDown, Crown, ArrowRight } from 'lucide-react';
import { Sparkline, Donut, peso, PALETTE } from '@/components/admin/sales-analytics/admin-sales-charts';

export const Card = ({ title, hint, right, children, className = '' }: any) => (
  <section className={`animate-fade-up rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${className}`}>
    {(title || right) && (
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-extrabold text-white">{title}</h3>
          {hint && <p className="text-[11px] text-emerald-100/55">{hint}</p>}
        </div>
        {right}
      </header>
    )}
    {children}
  </section>
);

const TH = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-emerald-300/80';
const Empty = ({ text }: any) => <p className="py-8 text-center text-xs text-emerald-100/50">{text}</p>;
const LINK = 'inline-flex items-center gap-1 text-xs font-bold text-lime-400 hover:text-lime-300 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400 rounded';

export function AdminSalesMenu({ items }: any) {
  const top = items[0];
  const rows = items.slice(0, 8);
  return (
    <Card title="Menu best-sellers" hint="Completed orders in this view">
      {top && top.units >= 5 && top.share >= 0.6 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200" role="note">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span><b>{top.name}</b> is {Math.round(top.share * 100)}% of the items sold. Sales depend heavily on one dish.</span>
        </div>
      )}
      {rows.length === 0 ? <Empty text="No completed orders with items in this view." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-emerald-50">
            <thead><tr className="border-b border-white/10"><th className={TH}>Item</th><th className={`${TH} text-right`}>Units</th><th className={`${TH} text-right`}>Revenue</th><th className={TH}>Share</th><th className={TH}>Trend</th><th className={`${TH} text-right`}>Avg price</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((it, i) => (
                <tr key={it.name} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5 font-bold text-white"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{it.name}{i === 0 && <Crown className="ml-1.5 inline size-3.5 text-amber-300" aria-label="Top seller" />}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{it.units}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-lime-300">{peso(it.revenue)}</td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${Math.round(it.share * 100)}%`, background: PALETTE[i % PALETTE.length] }} /></span><span className="tabular-nums text-emerald-100/70">{Math.round(it.share * 100)}%</span></div></td>
                  <td className="w-24 px-3 py-2.5"><Sparkline values={it.trend} color={PALETTE[i % PALETTE.length]} className="h-6 w-full" /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-100/70">{peso(it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length > rows.length && <p className="mt-2 text-[11px] text-emerald-100/50">Showing the top {rows.length} of {items.length} items.</p>}
    </Card>
  );
}

export function AdminSalesCustomers({ stats, totalNet }: any) {
  const parts = [
    { label: 'New customers', value: stats.fresh, color: '#a3e635' },
    { label: 'Returning customers', value: stats.returning, color: '#38bdf8' },
    { label: 'Walk-in / no account', value: stats.walkin, color: '#fbbf24' },
  ].filter((p) => p.value > 0);
  const registeredShare = totalNet > 0 ? (stats.fresh + stats.returning) / totalNet : 0;
  const tierEntries = Object.entries(stats.tiers);
  return (
    <Card title="Customers & loyalty" hint="Who the sales came from">
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">Revenue by customer type</p>
          <Donut parts={parts} empty="No completed sales in this view." centerValue={totalNet > 0 ? `${Math.round(registeredShare * 100)}%` : ''} centerLabel="registered" />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">Top spenders</p>
          {stats.top.length === 0 ? <Empty text="No registered customers bought in this view." /> : (
            <ol className="space-y-1.5">
              {stats.top.map((c, i) => (
                <li key={c.userId} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="w-4 font-bold text-emerald-100/50">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-white">{c.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.tier === 'Regular' ? 'bg-white/10 text-emerald-100/70' : 'bg-amber-400/15 text-amber-300'}`}>{c.tier}</span>
                  <span className="text-emerald-100/60">{c.orders} {c.orders === 1 ? 'order' : 'orders'}</span>
                  <span className="w-20 text-right font-bold tabular-nums text-lime-300">{peso(c.total)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">Loyalty tiers ({stats.registered} registered)</p>
          <div className="flex flex-wrap gap-1.5">
            {tierEntries.length === 0 ? <span className="text-xs text-emerald-100/50">No customers yet.</span> : tierEntries.map(([t, n]) => <span key={t} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-white">{t} <span className="text-lime-300">{n}</span></span>)}
          </div>
          {stats.registered > 0 && tierEntries.every(([t]) => t === 'Regular') && <p className="mt-2 text-[11px] text-emerald-100/55">Everyone is still Regular. A push for loyalty stamps could move the first customers up a tier.</p>}
        </div>
      </div>
    </Card>
  );
}

export function AdminSalesPromos({ stats, onOpenVouchers }: any) {
  return (
    <Card title="Promo results" hint="Orders that used a voucher code, excluding cancelled" right={<button type="button" onClick={onOpenVouchers} className={LINK}>Manage Vouchers <ArrowRight className="size-3.5" /></button>}>
      {stats.rows.length === 0 ? <Empty text="No voucher was used in this view." /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-emerald-50">
            <thead><tr className="border-b border-white/10"><th className={TH}>Code</th><th className={`${TH} text-right`}>Uses</th><th className={`${TH} text-right`}>Discount cost</th><th className={`${TH} text-right`}>Sales with code</th><th className={`${TH} text-right`}>Avg order with code</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {stats.rows.map((r) => (
                <tr key={r.code} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5"><span className="font-mono font-bold text-amber-300">{r.code}</span>{r.label && <span className="ml-2 text-[10px] text-emerald-100/55">{r.label}</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.uses}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-300">−{peso(r.cost)}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-lime-300">{peso(r.revenue)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.doneCount ? peso(r.aovWith) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-emerald-100/75">Average order <b className="text-white">without</b> a code: <b className="tabular-nums text-white">{stats.aovWithout ? peso(stats.aovWithout) : '–'}</b></p>
        <p className="rounded-xl bg-white/[0.04] px-3 py-2 text-emerald-100/75">Customer discounts (tracked apart): <b className="tabular-nums text-white">{stats.manualCount}</b> {stats.manualCount === 1 ? 'order' : 'orders'}, <b className="tabular-nums text-white">{peso(stats.manualTotal)}</b></p>
      </div>
    </Card>
  );
}

const TONES = {
  bad: { cls: 'border-red-400/30 bg-red-400/10', icon: TrendingDown, ic: 'text-red-300' },
  warn: { cls: 'border-amber-400/30 bg-amber-400/10', icon: AlertTriangle, ic: 'text-amber-300' },
  good: { cls: 'border-emerald-400/30 bg-emerald-400/10', icon: CheckCircle2, ic: 'text-emerald-300' },
  info: { cls: 'border-sky-400/30 bg-sky-400/10', icon: Info, ic: 'text-sky-300' },
};
export function AdminSalesBriefing({ cards }: any) {
  return (
    <Card title="Boss briefing" hint="Worked out from the numbers above; it changes when you change the filters">
      {cards.length === 0 && <p className="py-4 text-center text-xs text-emerald-100/55">Nothing needs your attention in this view.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const t = TONES[c.tone] || TONES.info; const Icon = t.icon;
          return (
            <article key={c.id} className={`rounded-2xl border p-3.5 ${t.cls}`}>
              <h4 className="flex items-center gap-2 text-sm font-extrabold text-white"><Icon className={`size-4 shrink-0 ${t.ic}`} />{c.title}</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-emerald-50/90">{c.finding}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-emerald-100/65"><b className="text-emerald-100">Suggested:</b> {c.action}</p>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
