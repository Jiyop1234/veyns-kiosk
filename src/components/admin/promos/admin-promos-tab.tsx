// @ts-nocheck
// Admin Vouchers & Promos tab: create/edit vouchers and dated campaigns, list them with live countdowns, redemption history, enable/disable, delete.
// Step A5: moved unchanged from employee-dashboard.tsx. New: this wrapper, its props, the `active` flag, and the 1-second clock (see below).
// The tab body shows only when `active` is true, but this component stays mounted, so the form and open redemption list are kept when you switch tabs.
import React, { useState, useEffect } from 'react';
import { Plus, Ticket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPeso } from '@/lib/menu-data';
import { getPromoStatus, getPromoEndMs, isCampaignPromo, formatCountdown, manilaLocalToIso, toManilaLocalInput, formatManila, STATUS_STYLES } from '@/lib/promo-campaigns';
import { supabase } from '@/lib/supabase';

export function AdminPromosTab({ active, promos, customers, fetchCloudData }: { active: boolean; promos: any[]; customers: any[]; fetchCloudData: () => void }) {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <>
        {active && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center gap-2 border-b border-emerald-900/60 pb-3">
              <Ticket className="h-5 w-5 text-lime-400" />
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Create Vouchers & Promo Codes Manager</h3>
            </div>
            <form onSubmit={handleAddPromo} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Voucher Code Name</label>
                <input type="text" placeholder="e.g. GEOGWAPO" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} required disabled={!!editingPromoCode} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white uppercase placeholder:normal-case focus:outline-none focus:border-lime-400 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Type & Value</label>
                <div className="flex gap-1.5">
                  <select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value as any)} className="bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-lime-300 font-bold focus:outline-none">
                    <option value="peso">₱ OFF</option>
                    <option value="percentage">% OFF</option>
                  </select>
                  <input type="number" placeholder={newPromoType === 'peso' ? "e.g. 50" : "e.g. 10"} value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(e.target.value)} required className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Scope (Feature B)</label>
                <select value={newPromoTargetType} onChange={(e) => setNewPromoTargetType(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="subtotal">Food Subtotal Only</option>
                  <option value="delivery">Delivery Fee Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Customer Eligibility</label>
                <select value="registered" disabled className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none opacity-80 cursor-not-allowed">
                  <option value="registered">Registered Customers Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Visibility in Checkout</label>
                <select value={newVoucherVisibility} onChange={(e) => setNewVoucherVisibility(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="public">Public (Visible in Vouchers List)</option>
                  <option value="hidden">Hidden (Via Events/Posts Only)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Expiry Time Type</label>
                <div className="flex gap-1.5">
                  {newVoucherExpiryUnit !== 'never' && (
                    <input type="number" value={newVoucherExpiryVal} onChange={(e) => setNewVoucherExpiryVal(e.target.value)} required className="w-20 bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                  )}
                  <select value={newVoucherExpiryUnit} onChange={(e) => setNewVoucherExpiryUnit(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-emerald-300 font-bold focus:outline-none">
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="never">Never Expires</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Usage Per Account</label>
                <select value={newVoucherPerAccount} onChange={(e) => setNewVoucherPerAccount(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="one_time">One-Time Use Per Account</option>
                  <option value="multiple">Multiple Uses Per Account</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Total Usage Limit</label>
                <div className="flex gap-1.5">
                  <select value={newVoucherUsageMode} onChange={(e) => setNewVoucherUsageMode(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-lime-300 font-bold focus:outline-none">
                    <option value="unlimited">Unlimited</option>
                    <option value="limited">Limited</option>
                  </select>
                  {newVoucherUsageMode === 'limited' && (
                    <input type="number" min="1" step="1" placeholder="Max redemptions" value={newVoucherUsageLimit} onChange={(e) => setNewVoucherUsageLimit(e.target.value)} required className="w-32 bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 border-t border-emerald-900/60 pt-3">
                <span className="text-[10px] font-extrabold text-sky-300 uppercase tracking-wider">Promotional Campaign (optional) • all times are Asia/Manila</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Promotion Name</label>
                <input type="text" placeholder="e.g. 11.11 Sale" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
              </div>
              <div className="space-y-1 sm:col-span-1 lg:col-span-2">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Description</label>
                <input type="text" placeholder="Optional description" value={newCampaignDesc} onChange={(e) => setNewCampaignDesc(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-lime-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Start Date & Time</label>
                <input type="datetime-local" value={newCampaignStart} onChange={(e) => setNewCampaignStart(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400 [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Expiration Date & Time</label>
                <input type="datetime-local" value={newCampaignEnd} onChange={(e) => setNewCampaignEnd(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400 [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Minimum Purchase (₱, optional)</label>
                <input type="number" min="0" placeholder="e.g. 300" value={newCampaignMinPurchase} onChange={(e) => setNewCampaignMinPurchase(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
              </div>
              <p className="sm:col-span-2 lg:col-span-3 text-[10px] text-emerald-400/70">
                If a name, start or expiration is set, the "Expiry Time Type" above is ignored and the campaign runs on these dates. Leave the start empty to begin immediately; leave the expiration empty for no end date.
              </p>
              <div className="flex items-end gap-2">
                <Button type="submit" className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg cursor-pointer">
                  <Plus className="h-4 w-4 mr-1" /> {editingPromoCode ? 'Save Changes' : 'Create Voucher / Campaign'}
                </Button>
                {editingPromoCode && (
                  <Button type="button" onClick={resetPromoForm} className="bg-[#082d22] hover:bg-[#0a3a2c] text-emerald-200 border border-emerald-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Active Vouchers & Promos ({promos.length})</h4>
              {promos.length === 0 ? (
                <p className="text-xs text-emerald-400/60 py-6 text-center">No active vouchers or promo codes available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {promos
                    // Plain expired vouchers are hidden as before; expired CAMPAIGNS stay visible for the record.
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
                      return (
                        <div key={p.code} className={`bg-[#061d16] border rounded-xl p-4 flex items-start justify-between gap-2 text-xs shadow-md ${
                          isExpiringSoon ? 'border-amber-500/60' : 'border-emerald-800/80'
                        } ${status === 'expired' || status === 'disabled' ? 'opacity-75' : ''}`}>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-lime-400 text-sm tracking-wide break-all">{p.code}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${STATUS_STYLES[status]}`}>{status}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                p.visibility === 'hidden' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'
                              }`}>
                                {p.visibility || 'public'}
                              </span>
                            </div>
                            {p.name && <p className="text-white font-extrabold text-[11px]">{p.name}</p>}
                            {p.description && <p className="text-[10px] text-emerald-300/80">{p.description}</p>}
                            <p className="text-emerald-200 font-bold">
                              {p.type === 'peso' ? formatPeso(p.discountValue) + ' OFF' : `${p.discountValue}% OFF`}
                              {' '}{p.target_type === 'delivery' ? 'DELIVERY' : 'FOOD'}
                            </p>
                            <p className={`text-[10px] font-mono ${isExpiringSoon ? 'text-amber-400 font-bold' : 'text-amber-300'}`}>
                              {countdownText}
                            </p>
                            {isCampaignPromo(p) && (
                              <p className="text-[10px] text-sky-300">🗓 {formatManila(p.startDate)} → {endMs ? formatManila(endMs) : 'no end date'}</p>
                            )}
                            {p.minPurchase > 0 && <p className="text-[10px] text-emerald-300">Min. purchase: {formatPeso(p.minPurchase)}</p>}
                            <div className="text-[10px] text-emerald-300 space-y-0.5 pt-0.5">
                              <p>Usage Per Account: <strong className="text-white">{p.perPersonLimit === null || p.perPersonLimit === undefined ? 'Multiple Uses' : p.perPersonLimit === 1 ? 'One-Time' : `${p.perPersonLimit} per account`}</strong></p>
                              <p>Total Usage: <strong className="text-white">{p.usageLimit ? 'Limited' : 'UNLIMITED'}</strong></p>
                              {p.usageLimit ? <p>Maximum Redemptions: <strong className="text-white">{p.usageLimit}</strong></p> : null}
                              <p>Successful Redemptions: <strong className="text-white">{p.usageCount || 0}</strong></p>
                              {p.usageLimit ? <p>Remaining Redemptions: <strong className="text-white">{Math.max(0, p.usageLimit - (p.usageCount || 0))}</strong></p> : null}
                              <p>Expiration: <strong className="text-white">{getPromoEndMs(p) ? formatManila(getPromoEndMs(p)) : 'Never expires'}</strong></p>
                              <p>Status: <strong className={p.usageLimit && (p.usageCount || 0) >= p.usageLimit ? 'text-red-400' : 'text-lime-300'}>{p.usageLimit && (p.usageCount || 0) >= p.usageLimit ? 'USAGE LIMIT REACHED / UNAVAILABLE' : status.toUpperCase()}</strong></p>
                            </div>
                            <p className="text-[10px] text-blue-300">Eligibility: {p.eligibility === 'registered' ? 'Registered Only' : 'All Customers'}</p>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button onClick={() => handleEditPromo(p)} className="text-lime-300 hover:text-lime-200 px-2 py-1 rounded-lg bg-[#082d22] border border-emerald-700 cursor-pointer text-[10px] font-bold">
                              Edit
                            </button>
                            <button onClick={() => handleViewRedemptions(p.code)} className="text-sky-300 hover:text-sky-200 px-2 py-1 rounded-lg bg-sky-950/30 border border-sky-800/60 cursor-pointer text-[10px] font-bold">
                              {redemptionView?.code === p.code ? 'Hide Redemptions' : 'Redemptions'}
                            </button>
                            <button onClick={() => handleTogglePromoEnabled(p)} className="text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg bg-amber-950/30 border border-amber-800/60 cursor-pointer text-[10px] font-bold">
                              {p.isEnabled === false ? 'Enable' : 'Disable'}
                            </button>
                            <button onClick={() => handleDeletePromo(p.code)} className="text-red-400 hover:text-red-300 p-2 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer self-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {redemptionView && (
                <div className="bg-[#061d16] border border-sky-800/60 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wider">Redemption history: {redemptionView.code}</h5>
                    <button onClick={() => setRedemptionView(null)} className="text-[10px] font-bold text-emerald-300 hover:text-white cursor-pointer">Close</button>
                  </div>
                  {redemptionView.loading ? (
                    <p className="text-[11px] text-emerald-300/70">Loading…</p>
                  ) : redemptionView.rows.length === 0 ? (
                    <p className="text-[11px] text-emerald-300/70">No redemptions recorded for this voucher yet.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {redemptionView.rows.map((r: any) => {
                        const cust = customers.find((c: any) => c.auth_user_id && c.auth_user_id === r.user_id);
                        return (
                          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-[#04140f] border border-emerald-900/60 rounded-lg px-3 py-1.5">
                            <span className="font-bold text-white">{r.order_number || 'Order'}</span>
                            <span className="text-emerald-200">{cust ? cust.name : r.user_id ? 'Registered customer' : 'Walk-in'}</span>
                            <span className="text-amber-300">{formatManila(Date.parse(r.redeemed_at))}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${r.status === 'redeemed' ? 'bg-lime-400/20 text-lime-400 border border-lime-400/40' : 'bg-slate-700/40 text-slate-300 border border-slate-500/50'}`}>{r.status === 'redeemed' ? 'redeemed' : 'voided (order cancelled)'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
    </>
  );
}
