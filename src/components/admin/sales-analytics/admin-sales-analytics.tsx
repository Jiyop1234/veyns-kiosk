// @ts-nocheck
// Sales Analytics (Step B9): the page above the order log. Command bar, KPI deck, Revenue Pulse, fulfillment mix, menu, customers, promos and the Boss briefing.
// Everything is worked out from the live `orders`, `customers` and `promos` (see admin-sales-math.ts). The filters here change the analytics only; the Order Transactions Log under it still lists every order.
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ShoppingBag, RotateCcw } from 'lucide-react';
import { AdminSalesCommandBar } from '@/components/admin/sales-analytics/admin-sales-command-bar';
import { AdminSalesKpiDeck } from '@/components/admin/sales-analytics/admin-sales-kpi-deck';
import { RevenuePulse, Donut, peso } from '@/components/admin/sales-analytics/admin-sales-charts';
import { Card, AdminSalesMenu, AdminSalesCustomers, AdminSalesPromos, AdminSalesBriefing } from '@/components/admin/sales-analytics/admin-sales-sections';
import {
  resolveRange, previousRange, applyFilters, summarize, buildBuckets, seriesFor, topItems, fulfillmentMix, orderTypeSplit,
  customerStats, promoStats, buildBriefing, ordersToCsv, fulfillmentKey, manilaKey,
} from '@/components/admin/sales-analytics/admin-sales-math';

class Guard extends React.Component<any, any> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: any) { console.error('Sales Analytics error:', e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border border-red-800 bg-red-950/60 p-6 text-center text-sm text-red-200">
        Something went wrong while drawing the analytics.
        <button type="button" onClick={() => this.setState({ failed: false })} className="ml-3 rounded-full bg-red-900 px-3 py-1 text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }
}

const SECTIONS = [{ id: 'sales-overview', label: 'Overview' }, { id: 'sales-menu', label: 'Menu' }, { id: 'sales-customers', label: 'Customers' }, { id: 'sales-promos', label: 'Promos' }, { id: 'sales-log', label: 'Transactions' }];
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400';
const labelOf = (k: string) => (k === 'delivery' ? 'Delivery' : k === 'pickup' ? 'Pickup' : k.charAt(0).toUpperCase() + k.slice(1));

export function AdminSalesAnalytics({ orders, customers, promos, onRefresh, onOpenTab }: any) {
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compare, setCompare] = useState(true);
  const [fulfillment, setFulfillment] = useState('all');
  const [status, setStatus] = useState('all');
  const [metric, setMetric] = useState('revenue');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activeSection, setActiveSection] = useState('sales-overview');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const range = useMemo(() => resolveRange(preset, customFrom, customTo, orders, now), [preset, customFrom, customTo, orders, now]);
  const prevRange = useMemo(() => previousRange(range, preset), [range, preset]);
  const showPrev = compare && !!prevRange;

  const view = useMemo(() => {
    const filters = { fulfillment, status };
    const cur = applyFilters(orders, { range, ...filters });
    const prev = prevRange ? applyFilters(orders, { range: prevRange, ...filters }) : null;
    const buckets = buildBuckets(range);
    const prevBuckets = prevRange ? buildBuckets(prevRange) : null;
    const summary = summarize(cur);
    const prevSummary = showPrev && prev ? summarize(prev) : null;
    const series = seriesFor(cur, buckets, metric);
    const kpiSeries = seriesFor(cur, buckets, 'revenue');
    const prevSeries = showPrev && prev && prevBuckets && prevBuckets.length === buckets.length ? seriesFor(prev, prevBuckets, metric) : null;
    const items = topItems(cur, buckets);
    const promoS = promoStats(cur, promos);
    return {
      cur, summary, prevSummary, series, kpiSeries, prevSeries, items, promoS,
      mix: fulfillmentMix(cur), split: orderTypeSplit(cur), custS: customerStats(cur, orders, customers),
      briefing: buildBriefing({ cur: summary, prev: prevSummary, items, series: kpiSeries, orders: cur, promoS, nowMs: now }),
    };
  }, [orders, customers, promos, range, prevRange, showPrev, fulfillment, status, metric, now]);

  const fulfillmentOptions = useMemo(() => {
    const keys = Array.from(new Set(orders.map(fulfillmentKey)));
    return [{ id: 'all', label: 'All' }, ...keys.map((k: string) => ({ id: k, label: labelOf(k) }))];
  }, [orders]);

  // Scroll-spy for the section chips.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); });
    }, { rootMargin: '-30% 0px -60% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [view.cur.length === 0]);

  const goSection = (id: string) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh?.(); } finally { if (alive.current) { setNow(Date.now()); setRefreshing(false); } }
  };

  const handleExport = () => {
    const blob = new Blob([ordersToCsv(view.cur)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veyns-sales-${manilaKey(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const resetFilters = () => { setPreset('all'); setFulfillment('all'); setStatus('all'); };
  const s = view.summary;
  const rangeText = preset === 'all' ? 'All time' : `${manilaKey(range.fromMs)} to ${manilaKey(range.toMs)}`;

  return (
    <div className="space-y-4">
      <div className="space-y-3 border-b border-white/5 bg-[#020b08]/95 py-3 backdrop-blur md:sticky md:top-0 md:z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <AdminSalesCommandBar
          preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo}
          compare={compare} setCompare={setCompare} canCompare={!!prevRange} fulfillment={fulfillment} setFulfillment={setFulfillment} fulfillmentOptions={fulfillmentOptions}
          status={status} setStatus={setStatus} onExport={handleExport} onRefresh={handleRefresh} refreshing={refreshing} exportCount={view.cur.length}
        />
        <nav aria-label="Sections" className="flex flex-wrap gap-1.5">
          {SECTIONS.map((sec) => (
            <button key={sec.id} type="button" onClick={() => goSection(sec.id)} aria-current={activeSection === sec.id ? 'true' : undefined} className={`rounded-full px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer ${FOCUS} ${activeSection === sec.id ? 'bg-white/15 text-white' : 'text-emerald-100/60 hover:text-white'}`}>{sec.label}</button>
          ))}
        </nav>
      </div>

      <Guard>
        <p className="text-[11px] text-emerald-100/50">{rangeText}{showPrev ? ' · compared with the period before it' : ''} · {view.cur.length} {view.cur.length === 1 ? 'order' : 'orders'} in view</p>

        {orders.length === 0 || view.cur.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
            <ShoppingBag className="mx-auto mb-2 size-10 text-emerald-700" />
            <p className="text-sm font-bold text-emerald-100">{orders.length === 0 ? 'No sales recorded yet.' : 'No orders match these filters.'}</p>
            {orders.length > 0 && <button type="button" onClick={resetFilters} className={`mt-3 inline-flex items-center gap-1.5 rounded-full bg-lime-400 px-4 py-2 text-xs font-extrabold text-black hover:bg-lime-300 cursor-pointer ${FOCUS}`}><RotateCcw className="size-3.5" /> Show all time</button>}
          </div>
        ) : (
          <>
            <div id="sales-overview" className="scroll-mt-44 space-y-4">
              <AdminSalesKpiDeck cur={s} prev={view.prevSummary} series={view.kpiSeries} />
              <div className="grid gap-4 xl:grid-cols-3">
                <Card title="Revenue pulse" className="xl:col-span-2"><RevenuePulse series={view.series} prevSeries={view.prevSeries} metric={metric} onMetric={setMetric} /></Card>
                <div className="space-y-4">
                  <Card title="Fulfillment mix" hint="Net sales by how it was served"><Donut parts={view.mix} empty="No completed sales in this view." /></Card>
                  <Card title="Order today vs reservation">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <p className="rounded-xl bg-white/[0.04] p-3 text-emerald-100/70">Order today<b className="mt-0.5 block text-lg tabular-nums text-white">{view.split.today}</b><span className="tabular-nums">{peso(view.split.todayValue)}</span></p>
                      <p className="rounded-xl bg-white/[0.04] p-3 text-emerald-100/70">Reservation<b className="mt-0.5 block text-lg tabular-nums text-white">{view.split.reservation}</b><span className="tabular-nums">{peso(view.split.reservationValue)}</span></p>
                    </div>
                    <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-emerald-100/70">Delivery fees <b className="tabular-nums text-white">{peso(s.deliveryFees)}</b> · Food <b className="tabular-nums text-white">{peso(Math.max(s.net - s.deliveryFees, 0))}</b></p>
                  </Card>
                </div>
              </div>
            </div>
            <div id="sales-menu" className="scroll-mt-44"><AdminSalesMenu items={view.items} /></div>
            <div id="sales-customers" className="scroll-mt-44"><AdminSalesCustomers stats={view.custS} totalNet={s.net} /></div>
            <div id="sales-promos" className="scroll-mt-44"><AdminSalesPromos stats={view.promoS} onOpenVouchers={() => onOpenTab?.('promos')} /></div>
            <AdminSalesBriefing cards={view.briefing} />
          </>
        )}
      </Guard>
      <div id="sales-log" className="scroll-mt-44" />
    </div>
  );
}
