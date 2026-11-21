// @ts-nocheck
// Admin Vouchers & Promos tab: create/edit vouchers and dated campaigns, list them with live countdowns, redemption history, enable/disable, delete.
// Step A5: moved unchanged from employee-dashboard.tsx (Step A5B: renamed from AdminPromosTab to match the VOUCHERS nav label). New: this wrapper, its props, the `active` flag, and the 1-second clock (see below).
// Step B6: new screen in the style of your reference (stat cards, search and filters, ticket cards, 30-day chart, redemptions panel, form in a dialog).
// The create / edit / enable / disable / delete / redemptions code below is the old code. Only these things changed: the form closes after a save, Edit opens the dialog instead of scrolling the page, and Duplicate and Copy code were added.
// The tab body shows only when `active` is true, but this component stays mounted, so the form and open redemption list are kept when you switch tabs.
import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { getPromoStatus, getPromoEndMs, isCampaignPromo, formatCountdown, manilaLocalToIso, toManilaLocalInput } from '@/lib/promo-campaigns';
import { supabase } from '@/lib/supabase';
import { AdminVoucherTicket } from '@/components/admin/vouchers/admin-voucher-ticket';
import { AdminVoucherStatCards } from '@/components/admin/vouchers/admin-voucher-stat-cards';
import { AdminVoucherPerformance } from '@/components/admin/vouchers/admin-voucher-performance';
import { AdminVoucherRedemptionsPanel } from '@/components/admin/vouchers/admin-voucher-redemptions-panel';
import { AdminVoucherFormDialog } from '@/components/admin/vouchers/admin-voucher-form-dialog';
import { voucherStatusKey, discountTotals, totalRedemptions, topPromo, dailyDiscounts, type VoucherStatusKey } from '@/components/admin/vouchers/admin-voucher-math';

export function AdminVouchersTab({ active, promos, customers, orders, fit = false, fetchCloudData }: { active: boolean; promos: any[]; customers: any[]; orders: any[]; fit?: boolean; fetchCloudData: () => void }) {
  // 1-second clock for the campaign countdowns. It used to live in the data hook and re-rendered the whole dashboard every second;
  // now it ticks only while this tab is open, and starts from the current time each time the tab is opened.
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNowTimestamp(Date.now());
    const timer = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'peso'>('percentage');
  const [newPromoTargetType, setNewPromoTargetType] = useState<'subtotal' | 'delivery'>('subtotal');
  const [newPromoEligibility, setNewPromoEligibility] = useState<'all' | 'registered'>('all');
  const [newVoucherVisibility, setNewVoucherVisibility] = useState<'public' | 'hidden'>('public');
  const [newVoucherExpiryVal, setNewVoucherExpiryVal] = useState('60');
  const [newVoucherExpiryUnit, setNewVoucherExpiryUnit] = useState<'minutes' | 'hours' | 'never'>('minutes');
  const [newVoucherUsageLimit, setNewVoucherUsageLimit] = useState('');
  // Task 6: Total Usage Limit (limited / unlimited) and Usage Per Account (one-time / multiple)
  const [newVoucherUsageMode, setNewVoucherUsageMode] = useState<'unlimited' | 'limited'>('unlimited');
  const [newVoucherPerAccount, setNewVoucherPerAccount] = useState<'one_time' | 'multiple'>('one_time');
  const [redemptionView, setRedemptionView] = useState<{ code: string; rows: any[]; loading: boolean } | null>(null);
  // Campaign scheduling fields (all optional; times are entered as Asia/Manila time)
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [newCampaignMinPurchase, setNewCampaignMinPurchase] = useState('');
  const [newCampaignStart, setNewCampaignStart] = useState('');
  const [newCampaignEnd, setNewCampaignEnd] = useState('');
  const [editingPromoCode, setEditingPromoCode] = useState<string | null>(null);

  // Step B6: screen state (display only). The form is a dialog now; the list has a search, filters and a sort.
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | VoucherStatusKey>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'food' | 'delivery'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'used' | 'ending'>('newest');
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // --- Create or edit a voucher / dated promotional campaign ---
  const resetPromoForm = () => {
    setNewPromoCode('');
    setNewPromoDiscount('');
    setNewVoucherUsageLimit('');
    setNewVoucherUsageMode('unlimited');
    setNewVoucherPerAccount('one_time');
    setNewCampaignName('');
    setNewCampaignDesc('');
    setNewCampaignMinPurchase('');
    setNewCampaignStart('');
    setNewCampaignEnd('');
    setEditingPromoCode(null);
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoDiscount) return;

    const discountNum = parseFloat(newPromoDiscount);
    if (!(discountNum > 0)) { alert('Discount value must be greater than zero.'); return; }
    if (newPromoType === 'percentage' && discountNum > 100) { alert('A percentage discount cannot exceed 100%.'); return; }

    // Campaign window: entered as Asia/Manila time, stored as UTC timestamps
    const startIso = manilaLocalToIso(newCampaignStart);
    const endIso = manilaLocalToIso(newCampaignEnd);
    if (newCampaignStart && !startIso) { alert('The start date/time is not valid.'); return; }
    if (newCampaignEnd && !endIso) { alert('The expiration date/time is not valid.'); return; }
    if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) { alert('The expiration must be later than the start.'); return; }
    if (!editingPromoCode && endIso && Date.parse(endIso) <= Date.now()) { alert('The expiration date/time is already in the past.'); return; }
    const minPurchaseNum = newCampaignMinPurchase ? parseFloat(newCampaignMinPurchase) : 0;
    if (!(minPurchaseNum >= 0)) { alert('Minimum purchase must be zero or more.'); return; }

    // Legacy "expires N minutes after creation" only applies to plain vouchers.
    // A campaign (name, start, end, or an edit) uses its real dates instead.
    // Editing a PLAIN voucher (no name/dates) only changes its settings: its original expiry is kept as is.
    const editedPromo = editingPromoCode ? promos.find((x: any) => x.code === editingPromoCode) : null;
    const keepLegacyExpiry = Boolean(editedPromo && !isCampaignPromo(editedPromo) && !startIso && !endIso && !newCampaignName.trim());
    const isCampaign = Boolean((editingPromoCode && !keepLegacyExpiry) || startIso || endIso || newCampaignName.trim());
    const expiryNum = parseFloat(newVoucherExpiryVal) || 60;
    let expiryMs = 0;
    if (!isCampaign) {
      if (newVoucherExpiryUnit === 'minutes') expiryMs = expiryNum * 60 * 1000;
      else if (newVoucherExpiryUnit === 'hours') expiryMs = expiryNum * 60 * 60 * 1000;
    }

    // Total usage: UNLIMITED saves no cap (NULL). LIMITED needs a positive whole number.
    let usageLimitNum: number | null = null;
    if (newVoucherUsageMode === 'limited') {
      const raw = newVoucherUsageLimit.trim();
      if (!/^[0-9]+$/.test(raw) || parseInt(raw, 10) < 1) { alert('Maximum redemptions must be a positive whole number (1 or more).'); return; }
      usageLimitNum = parseInt(raw, 10);
      if (editingPromoCode) {
        const existing = promos.find((x: any) => x.code === editingPromoCode);
        const done = Number(existing?.usageCount || 0);
        if (usageLimitNum < done) { alert(`This voucher already has ${done} successful redemptions. The maximum cannot be lower than ${done}.`); return; }
      }
    }
    // Usage per account: ONE-TIME = 1 redemption per account, MULTIPLE = no per-account cap (NULL)
    const perPersonLimitValue: number | null = newVoucherPerAccount === 'one_time' ? 1 : null;
    const cleanCode = newPromoCode.trim().toUpperCase();

    const fields: any = {
      type: newPromoType,
      discount_value: discountNum,
      target_type: newPromoTargetType, // Scope: subtotal (food) or delivery
      eligibility: 'registered',       // Strictly enforced: registered customers only
      visibility: newVoucherVisibility,
      usage_limit: usageLimitNum,
      per_person_limit: perPersonLimitValue,
      name: newCampaignName.trim() || null,
      description: newCampaignDesc.trim() || null,
      min_purchase: minPurchaseNum,
      expires_at: endIso,
      updated_at: new Date().toISOString(),
    };
    if (!keepLegacyExpiry) fields.expiry_duration_ms = expiryMs;
    if (startIso) fields.start_date = startIso; // otherwise the database default (now) applies

    try {
      if (editingPromoCode) {
        // Edit: never touches usage_count / created_at, and completed orders keep their saved discounts.
        const { error } = await supabase.from('promos').update(fields).eq('code', editingPromoCode);
        if (error) { alert('Failed to update promo: ' + error.message); return; }
        alert(`Campaign "${editingPromoCode}" updated.`);
      } else {
        if (promos.some((p: any) => String(p.code).toUpperCase() === cleanCode)) {
          alert(`A promo with the code "${cleanCode}" already exists. Use Edit on that promo instead.`);
          return;
        }
        const { error } = await supabase.from('promos').insert([{ ...fields, code: cleanCode, usage_count: 0, created_at: Date.now() }]);
        if (error) { alert('Failed to save promo to database: ' + error.message); return; }
        alert(`Voucher / Promo "${cleanCode}" successfully created and synced to cloud!`);
      }
      resetPromoForm();
      setFormOpen(false);
      fetchCloudData();
    } catch (err) {
      alert('Database connection error while saving voucher.');
    }
  };

  const handleEditPromo = (p: any) => {
    setEditingPromoCode(p.code);
    setNewPromoCode(p.code);
    setNewPromoType(p.type === 'peso' ? 'peso' : 'percentage');
    setNewPromoDiscount(String(p.discountValue));
    setNewPromoTargetType(p.target_type === 'delivery' ? 'delivery' : 'subtotal');
    setNewVoucherVisibility(p.visibility === 'hidden' ? 'hidden' : 'public');
    setNewVoucherUsageLimit(p.usageLimit ? String(p.usageLimit) : '');
    setNewVoucherUsageMode(p.usageLimit ? 'limited' : 'unlimited');
    setNewVoucherPerAccount(p.perPersonLimit === null || p.perPersonLimit === undefined ? 'multiple' : 'one_time');
    setNewCampaignName(p.name || '');
    setNewCampaignDesc(p.description || '');
    setNewCampaignMinPurchase(p.minPurchase > 0 ? String(p.minPurchase) : '');
    setNewCampaignStart(toManilaLocalInput(p.startDate));
    setNewCampaignEnd(toManilaLocalInput(p.expiresAt));
    setFormOpen(true);
  };

  // Step B6: "New voucher" opens an empty form.
  const openNewVoucher = () => {
    resetPromoForm();
    setFormOpen(true);
  };

  // Step B6: "Duplicate" fills the form with this voucher's settings and an empty code. Nothing is saved until you press Create.
  const handleDuplicatePromo = (p: any) => {
    resetPromoForm();
    setNewPromoType(p.type === 'peso' ? 'peso' : 'percentage');
    setNewPromoDiscount(String(p.discountValue));
    setNewPromoTargetType(p.target_type === 'delivery' ? 'delivery' : 'subtotal');
    setNewVoucherVisibility(p.visibility === 'hidden' ? 'hidden' : 'public');
    setNewVoucherUsageLimit(p.usageLimit ? String(p.usageLimit) : '');
    setNewVoucherUsageMode(p.usageLimit ? 'limited' : 'unlimited');
    setNewVoucherPerAccount(p.perPersonLimit === null || p.perPersonLimit === undefined ? 'multiple' : 'one_time');
    setNewCampaignName(p.name || '');
    setNewCampaignDesc(p.description || '');
    setNewCampaignMinPurchase(p.minPurchase > 0 ? String(p.minPurchase) : '');
    setNewCampaignStart(toManilaLocalInput(p.startDate));
    setNewCampaignEnd(toManilaLocalInput(p.expiresAt));
    const ms = Number(p.expiryDurationMs || 0);
    if (ms > 0 && ms % 3600000 === 0) { setNewVoucherExpiryUnit('hours'); setNewVoucherExpiryVal(String(ms / 3600000)); }
    else if (ms > 0) { setNewVoucherExpiryUnit('minutes'); setNewVoucherExpiryVal(String(Math.round(ms / 60000))); }
    else { setNewVoucherExpiryUnit('never'); }
    setFormOpen(true);
  };

  // Step B6: copy a voucher code to the clipboard (nothing is changed in the database).
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((cur) => (cur === code ? null : cur)), 1500);
    } catch (e) { /* clipboard blocked: nothing to do */ }
  };

  // Redemption history for one voucher (staff can read promo_redemptions through RLS)
  const handleViewRedemptions = async (code: string) => {
    if (redemptionView?.code === code) { setRedemptionView(null); return; }
    setRedemptionView({ code, rows: [], loading: true });
    const { data, error } = await supabase
      .from('promo_redemptions')
      .select('id, order_number, user_id, status, redeemed_at, voided_at')
      .eq('promo_code', code)
      .order('redeemed_at', { ascending: false })
      .limit(100);
    if (error) { alert('Could not load redemptions: ' + error.message); setRedemptionView(null); return; }
    setRedemptionView({ code, rows: data || [], loading: false });
  };

  const handleTogglePromoEnabled = async (p: any) => {
    const next = p.isEnabled === false; // currently disabled -> enable
    const { error } = await supabase.from('promos').update({ is_enabled: next, updated_at: new Date().toISOString() }).eq('code', p.code);
    if (error) { alert('Failed to update promo: ' + error.message); return; }
    fetchCloudData();
  };

  // --- Delete a voucher/promo ---
  const handleDeletePromo = async (code: string) => {
    if (!confirm(`Are you sure you want to delete promo ${code}?`)) return;
    try {
      await supabase.from('promos').delete().eq('code', code);
      fetchCloudData();
    } catch (e) {
      alert('Error deleting promo from database.');
    }
  };

  // --- Step B6: what the screen shows (display values only) ---
  // Plain expired vouchers are hidden as before; expired CAMPAIGNS stay visible for the record.
  const rows = promos
    .filter((p) => !(getPromoStatus(p, nowTimestamp) === 'expired' && !isCampaignPromo(p)))
    .map((p) => {
      const status = getPromoStatus(p, nowTimestamp);
      const endMs = getPromoEndMs(p);
      let countdownText = 'Never expires';
      let isExpiringSoon = false;
      if (status === 'scheduled') {
        countdownText = `Starts in ${formatCountdown(Number(p.startDate) - nowTimestamp)}`;
      } else if (status === 'expired') {
        countdownText = 'EXPIRED';
      } else if (status === 'disabled') {
        countdownText = 'DISABLED';
      } else if (endMs) {
        const diff = endMs - nowTimestamp;
        countdownText = `Ends in ${formatCountdown(diff)}`;
        isExpiringSoon = diff < 5 * 60 * 1000; // Less than 5 minutes
      }
      return { p, status, key: voucherStatusKey(status), endMs, countdownText, isExpiringSoon };
    });
  const counts = { all: rows.length, active: 0, scheduled: 0, disabled: 0, expired: 0 };
  rows.forEach((r) => { counts[r.key] += 1; });
  const query = search.trim().toLowerCase();
  const shown = rows
    .filter((r) => statusFilter === 'all' || r.key === statusFilter)
    .filter((r) => scopeFilter === 'all' || (r.p.target_type === 'delivery' ? 'delivery' : 'food') === scopeFilter)
    .filter((r) => !query || String(r.p.code).toLowerCase().includes(query) || String(r.p.name || '').toLowerCase().includes(query))
    .sort((a, b) => sortBy === 'used' ? Number(b.p.usageCount || 0) - Number(a.p.usageCount || 0)
      : sortBy === 'ending' ? (a.endMs ?? Infinity) - (b.endMs ?? Infinity)
      : Number(b.p.createdAt || 0) - Number(a.p.createdAt || 0));
  const discounts = discountTotals(orders);
  const series = dailyDiscounts(orders, 30, nowTimestamp);

  const chip = (on: boolean) => `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer ${on ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`;
  const STATUS_CHIPS: { id: 'all' | VoucherStatusKey; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'disabled', label: 'Disabled' }, { id: 'expired', label: 'Expired' }
  ];

  return (
    <>
      {active && (
        <div className={fit ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'}>
          <AdminVoucherStatCards activeCount={counts.active} redemptions={totalRedemptions(promos)} discounts={discounts} top={topPromo(promos)} />

          {/* search, status chips, scope chips, sort, New voucher */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code or campaign…" className="w-full rounded-xl bg-white/[0.06] py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_CHIPS.map((c) => (
                <button key={c.id} type="button" onClick={() => setStatusFilter(c.id)} className={chip(statusFilter === c.id)}>
                  {c.label}<span className={`rounded-full px-1.5 text-[10px] ${statusFilter === c.id ? 'bg-black/15' : 'bg-white/10 text-zinc-300'}`}>{counts[c.id]}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'food', 'delivery'] as const).map((s) => (
                <button key={s} type="button" onClick={() => setScopeFilter(s)} className={chip(scopeFilter === s)}>{s === 'all' ? 'All types' : s === 'food' ? 'Food' : 'Delivery'}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
              Sort
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]">
                <option value="newest">Newest</option>
                <option value="used">Most used</option>
                <option value="ending">Ending soon</option>
              </select>
            </label>
            <button type="button" onClick={openNewVoucher} className="ml-auto flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300 cursor-pointer"><Plus className="h-4 w-4" /> New voucher</button>
          </div>

          {/* tickets (scroll inside on a large screen) */}
          <div className={fit ? 'min-h-0 flex-1 overflow-y-auto pr-1' : ''}>
            {promos.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-400">No active vouchers or promo codes available.</p>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-400">No vouchers match your search and filters.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {shown.map(({ p, status, countdownText, isExpiringSoon }) => (
                  <AdminVoucherTicket
                    key={p.code}
                    p={p}
                    status={status}
                    countdownText={countdownText}
                    isExpiringSoon={isExpiringSoon}
                    redemptionOpen={redemptionView?.code === p.code}
                    copied={copiedCode === p.code}
                    onEdit={handleEditPromo}
                    onDuplicate={handleDuplicatePromo}
                    onRedemptions={handleViewRedemptions}
                    onToggle={handleTogglePromoEnabled}
                    onDelete={handleDeletePromo}
                    onCopy={handleCopyCode}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 30-day chart and the redemption history of the voucher you picked */}
          <div className={`grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-2 ${fit ? 'h-[200px]' : ''}`}>
            <AdminVoucherPerformance series={series} className={fit ? 'h-full' : 'h-52'} />
            <AdminVoucherRedemptionsPanel redemptionView={redemptionView} customers={customers} onClose={() => setRedemptionView(null)} className={fit ? 'h-full' : 'max-h-64'} />
          </div>
        </div>
      )}

      <AdminVoucherFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        handleAddPromo={handleAddPromo}
        editingPromoCode={editingPromoCode}
        resetPromoForm={resetPromoForm}
        newPromoCode={newPromoCode} setNewPromoCode={setNewPromoCode}
        newPromoDiscount={newPromoDiscount} setNewPromoDiscount={setNewPromoDiscount}
        newPromoType={newPromoType} setNewPromoType={setNewPromoType}
        newPromoTargetType={newPromoTargetType} setNewPromoTargetType={setNewPromoTargetType}
        newVoucherVisibility={newVoucherVisibility} setNewVoucherVisibility={setNewVoucherVisibility}
        newVoucherExpiryVal={newVoucherExpiryVal} setNewVoucherExpiryVal={setNewVoucherExpiryVal}
        newVoucherExpiryUnit={newVoucherExpiryUnit} setNewVoucherExpiryUnit={setNewVoucherExpiryUnit}
        newVoucherUsageMode={newVoucherUsageMode} setNewVoucherUsageMode={setNewVoucherUsageMode}
        newVoucherUsageLimit={newVoucherUsageLimit} setNewVoucherUsageLimit={setNewVoucherUsageLimit}
        newVoucherPerAccount={newVoucherPerAccount} setNewVoucherPerAccount={setNewVoucherPerAccount}
        newCampaignName={newCampaignName} setNewCampaignName={setNewCampaignName}
        newCampaignDesc={newCampaignDesc} setNewCampaignDesc={setNewCampaignDesc}
        newCampaignStart={newCampaignStart} setNewCampaignStart={setNewCampaignStart}
        newCampaignEnd={newCampaignEnd} setNewCampaignEnd={setNewCampaignEnd}
        newCampaignMinPurchase={newCampaignMinPurchase} setNewCampaignMinPurchase={setNewCampaignMinPurchase}
      />
    </>
  );
}
