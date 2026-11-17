// @ts-nocheck
// Step A7: Users tab (Registered Customer Accounts list, search, Edit and Loyalty buttons) plus all customer-edit and Loyalty Manager state and handlers,
// moved unchanged from employee-dashboard.tsx. Only the imports, the props, the 'active' guard and the two dialog calls are new.
// The component stays mounted, so the search text and open dialogs behave exactly as before.
// Step B3: new Users layout (search + filters, stat cards, table with Loyalty Status / Total Orders / Total Spent / Status, pages, no page scroll on a large screen). The handlers and the two dialog calls are unchanged.
import React, { useState, useMemo } from 'react';
import { Users, Search, Edit2, Award, Crown, Gem, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { AdminEditCustomerDialog } from '@/components/admin/users/admin-edit-customer-dialog';
import { AdminLoyaltyManagerDialog } from '@/components/admin/users/admin-loyalty-manager-dialog';

const USERS_PAGE_SIZE = 10;

// Same rule as private.loyalty_block_pos in the database: which milestone block a stamp total falls in.
function loyaltyBlockOf(cum: number, start: boolean): number {
  if (start && (cum === 5 || cum === 15 || cum === 30)) return cum === 5 ? 2 : cum === 15 ? 3 : 4;
  return cum <= 5 ? 1 : cum <= 15 ? 2 : cum <= 30 ? 3 : cum <= 35 ? 4 : 5;
}

// Loyalty status for the list. Staff accounts and rows without loyalty data return null (shown as a dash).
function loyaltyOf(c: any) {
  if ((c.type || 'regular') !== 'regular' || c.current_stamp_count === undefined) return null;
  if (c.tier === 'DIAMOND') return { key: 'DIAMOND', label: 'Diamond', pct: 100, textCls: 'text-fuchsia-300', barCls: 'bg-fuchsia-400' };
  if (c.tier === 'PLATINUM') return { key: 'PLATINUM', label: 'Platinum', pct: 100, textCls: 'text-slate-100', barCls: 'bg-slate-300' };
  const cum = Math.max(0, Number(c.current_stamp_count) || 0);
  const block = loyaltyBlockOf(cum, !!c.block_start);
  return { key: 'B' + block, label: `Block ${block} • ${cum}/35 stamps`, pct: Math.min(100, (cum / 35) * 100), textCls: 'text-lime-300', barCls: 'bg-lime-400' };
}

const peso = (n: number) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function UsersStatCard({ icon, iconCls, label, value }: { icon: React.ReactNode; iconCls: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#051813] p-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconCls}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-emerald-300">{label}</p>
        <p className="font-display text-xl font-extrabold leading-tight text-white">{value}</p>
      </div>
    </div>
  );
}

export function AdminUsersTab({ active, customers, fetchCloudData, orders = [], fit = false }: { active: boolean; customers: any[]; fetchCloudData: () => void; orders?: any[]; fit?: boolean }) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [page, setPage] = useState(1);
  
  // Customer Edit State
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustType, setEditCustType] = useState<'email' | 'phone'>('email');
  const [editCustValue, setEditCustValue] = useState('');
  const [custBusy, setCustBusy] = useState(false);

  // --- Phase 4: Loyalty Manager state (replaces old Fair Play penalty system) ---
  const [loyaltyTargetUser, setLoyaltyTargetUser] = useState<any>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<any>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<any[]>([]);
  const [loyaltyStampDelta, setLoyaltyStampDelta] = useState(0);
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState<string>('B1');
  const [loyaltyTierReason, setLoyaltyTierReason] = useState('');
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [pendingStamp, setPendingStamp] = useState<string>(''); // e.g. 'AD7' (add up to circle 7) or 'RM7' (remove circle 7) — applied only when Apply is pressed

  // Staff can update a nickname. Contact identifiers remain controlled by the customer's verified Auth account.
  const handleSaveCustomerEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const newName = editCustName.trim();
    if (!newName) { alert('Nickname cannot be blank.'); return; }
    const { data: updated, error } = await supabase.from('profiles').update({ name: newName }).eq('id', editingCustomer.id).select('id');
    if (error || !updated || updated.length === 0) { alert('Update failed: ' + (error?.message || 'no row was changed (permission problem).')); return; }
    alert('Customer nickname updated.');
    setEditingCustomer(null);
    fetchCloudData();
  };

  // --- Staff-only account actions (server endpoint verifies the caller and uses the service key) ---
  const callCustomerAdmin = async (payload: any) => {
    setCustBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { alert('Your session expired. Please sign in again.'); return null; }
      const res = await fetch('/api/admin-create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profileId: editingCustomer?.id, ...payload }),
      });
      const body = await res.json().catch(() => null);
      if (!body) { alert(res.status === 404 ? 'The account service (/api/admin-create-customer) is not deployed.' : 'Unexpected response from the account service.'); return null; }
      if (!res.ok || !body.ok) { alert(body.error || 'Request failed.'); return null; }
      return body;
    } catch (e) { alert('Network error. Please try again.'); return null; }
    finally { setCustBusy(false); }
  };

  const handleChangeCustomerEmail = async () => {
    const email = editCustValue.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { alert('Enter a valid email address.'); return; }
    if (email === String(editingCustomer?.identifier || '').toLowerCase()) { alert('That is already the current email.'); return; }
    if (!confirm(`Change this customer's email to ${email}?\n\nThey will receive a link at the new address to set their password and verify it. They cannot log in until they do.`)) return;
    const body = await callCustomerAdmin({ action: 'update_email', email });
    if (!body) return;
    alert(body.activationEmailSent ? `Email updated. A verification / password-setup link was sent to ${email}.` : `Email updated, but the link could not be sent: ${body.activationError || 'unknown error'}. Use "Send password reset" to try again.`);
    setEditingCustomer(null);
    fetchCloudData();
  };

  const handleSendCustomerReset = async () => {
    if (!confirm('Send a password-reset email to this customer?')) return;
    const body = await callCustomerAdmin({ action: 'send_reset' });
    if (!body) return;
    alert('Password-reset email sent. The customer chooses their own new password from the link.');
  };

  // --- Phase 4: open the Loyalty Manager, load live status + audit history ---
  const openLoyaltyManager = async (cust: any) => {
    setLoyaltyTargetUser(cust);
    setLoyaltyStampDelta(0);
    setLoyaltyReason('');
    setPendingStamp('');
    setLoyaltyBusy(true);
    try {
      const { data: status } = await supabase.rpc('get_loyalty_status', { p_user_id: cust.auth_user_id });
      setLoyaltyStatus(status);
      setLoyaltyTier(status?.tier === 'DIAMOND' ? 'DIAMOND' : status?.tier === 'PLATINUM' ? 'PLATINUM' : 'B' + Math.min(status?.block || 1, 4));
      setLoyaltyTierReason('');
      const { data: hist } = await supabase.rpc('get_stamp_history', { p_user_id: cust.auth_user_id });
      setLoyaltyHistory(hist || []);
    } catch (e) { console.error('Loyalty load failed:', e); }
    setLoyaltyBusy(false);
  };
  const handleLoyaltyAdjustStamps = async () => {
    if (!loyaltyTargetUser) return;
    if (!loyaltyStampDelta) { alert('Enter a non-zero stamp amount (positive to add, negative to remove).'); return; }
    setLoyaltyBusy(true);
    const { data, error } = await supabase.rpc('admin_adjust_stamps', {
      p_user_id: loyaltyTargetUser.auth_user_id, p_delta: loyaltyStampDelta, p_reason: null
    });
    setLoyaltyBusy(false);
    if (error || !data?.success) { alert(error?.message || data?.message || 'Stamp adjustment failed.'); return; }
    alert(`Stamps adjusted by ${loyaltyStampDelta}. New total: ${data.new_cumulative}.`);
    setLoyaltyReason('');
    fetchCloudData();
    await openLoyaltyManager(loyaltyTargetUser);
  };

  const handleLoyaltySetTier = async () => {
    if (!loyaltyTargetUser) return;
    if (!loyaltyTierReason.trim()) { alert('A reason is required for every tier / block change.'); return; }
    setLoyaltyBusy(true);
    const { data, error } = await supabase.rpc('admin_set_loyalty_state', {
      p_user_id: loyaltyTargetUser.auth_user_id, p_action: loyaltyTier, p_reason: loyaltyTierReason.trim()
    });
    setLoyaltyBusy(false);
    if (error || !data?.success) { alert(error?.message || data?.message || 'Change failed.'); return; }
    alert(data.tier ? `${data.tier} applied. Stamps: ${data.cumulative}.` : `Moved to Milestone Block ${data.block} (no circles filled yet). Stamps: ${data.cumulative}.`);
    setLoyaltyTierReason('');
    fetchCloudData();
    await openLoyaltyManager(loyaltyTargetUser);
  };

  // --- Step B3: derived values for the list (search, filters, stats, pages) ---
  // Order count and spend per customer: completed orders linked to the customer's account (orders.user_id = profiles.auth_user_id).
  const orderStats = useMemo(() => {
    const m = new Map<string, { count: number; spent: number }>();
    (orders || []).forEach((o: any) => {
      if (!o.userId || o.status !== 'completed') return;
      const s = m.get(o.userId) || { count: 0, spent: 0 };
      s.count += 1;
      s.spent += Number(o.total) || 0;
      m.set(o.userId, s);
    });
    return m;
  }, [orders]);

  const stats = useMemo(() => {
    let spent = 0;
    customers.forEach((c: any) => { const s = orderStats.get(c.auth_user_id); if (s) spent += s.spent; });
    return {
      total: customers.length,
      regular: customers.filter((c: any) => (c.type || 'regular') === 'regular').length,
      vip: customers.filter((c: any) => c.tier === 'PLATINUM' || c.tier === 'DIAMOND').length,
      spent,
    };
  }, [customers, orderStats]);

  const searchText = customerSearch.trim().toLowerCase();
  const filteredCustomers = customers.filter((c: any) => {
    if (searchText && !((c.name || '').toLowerCase().includes(searchText) || (c.identifier || '').toLowerCase().includes(searchText))) return false;
    if (typeFilter !== 'all' && (c.type || 'regular') !== typeFilter) return false;
    if (tierFilter !== 'all') { const l = loyaltyOf(c); if (!l || l.key !== tierFilter) return false; }
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filteredCustomers.length / USERS_PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const pageRows = filteredCustomers.slice((curPage - 1) * USERS_PAGE_SIZE, curPage * USERS_PAGE_SIZE);
  const firstShown = filteredCustomers.length === 0 ? 0 : (curPage - 1) * USERS_PAGE_SIZE + 1;
  const lastShown = (curPage - 1) * USERS_PAGE_SIZE + pageRows.length;
  const pageButtons: (number | string)[] = (() => {
    const nums = Array.from(new Set([1, pageCount, curPage - 1, curPage, curPage + 1])).filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
    const out: (number | string)[] = [];
    nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) out.push('gap' + n); out.push(n); });
    return out;
  })();

  const selectCls = 'h-10 rounded-xl border border-emerald-900/70 bg-[#041913] px-3 text-xs font-bold text-emerald-100 focus:outline-none focus:ring-2 focus:ring-lime-400 cursor-pointer';

  return (
    <>
    {/* Users screen (Step B3): search + filters, stat cards, customer table with pages */}
    {active && (
      <div className={fit ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'}>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300/70" />
            <input
              type="text"
              placeholder="Search by nickname or Gmail address..."
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setPage(1); }}
              className="h-10 w-full rounded-xl border border-emerald-900/70 bg-[#041913] pl-9 pr-4 text-xs text-white placeholder:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <select aria-label="Account type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className={selectCls}>
            <option value="all">All account types</option>
            <option value="regular">Regular</option>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
          <select aria-label="Loyalty tier" value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setPage(1); }} className={selectCls}>
            <option value="all">All loyalty tiers</option>
            <option value="B1">Block 1</option>
            <option value="B2">Block 2</option>
            <option value="B3">Block 3</option>
            <option value="B4">Block 4</option>
            <option value="PLATINUM">Platinum</option>
            <option value="DIAMOND">Diamond</option>
          </select>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <UsersStatCard icon={<Users className="h-5 w-5" />} iconCls="bg-lime-400/15 text-lime-300" label="Total accounts" value={stats.total.toLocaleString('en-PH')} />
          <UsersStatCard icon={<Award className="h-5 w-5" />} iconCls="bg-emerald-400/15 text-emerald-300" label="Regular members" value={stats.regular.toLocaleString('en-PH')} />
          <UsersStatCard icon={<Crown className="h-5 w-5" />} iconCls="bg-amber-400/15 text-amber-300" label="VIP members (Platinum / Diamond)" value={stats.vip.toLocaleString('en-PH')} />
          <UsersStatCard icon={<Coins className="h-5 w-5" />} iconCls="bg-sky-400/15 text-sky-300" label="Total lifetime spend (completed orders)" value={peso(stats.spent)} />
        </div>

        <div className={`rounded-2xl bg-[#051813] ${fit ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
          <div className={fit ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto'}>
            <table className="w-full min-w-[960px] text-left text-xs text-emerald-100">
              <thead className="sticky top-0 z-10 bg-[#071F19] text-[10px] uppercase tracking-wider text-emerald-300">
                <tr>
                  <th className="p-3">Customer Nickname</th>
                  <th className="p-3">Gmail / Phone Identifier</th>
                  <th className="p-3">Account Type</th>
                  <th className="p-3">Loyalty Status</th>
                  <th className="p-3 text-right">Total Orders</th>
                  <th className="p-3 text-right">Total Spent</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-emerald-400/70">
                      No customer accounts match your search.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((cust: any) => {
                    const type = (cust.type || 'regular').toLowerCase();
                    const typeCls = type === 'admin' ? 'bg-red-500/15 text-red-300' : type === 'employee' ? 'bg-sky-400/15 text-sky-300' : 'bg-lime-400/10 text-lime-300';
                    const loy = loyaltyOf(cust);
                    const os = orderStats.get(cust.auth_user_id) || { count: 0, spent: 0 };
                    const st = cust.status === undefined ? null : String(cust.status).toUpperCase();
                    return (
                      <tr key={cust.id || cust.identifier} className="transition-colors hover:bg-[#071F19]/50">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900/70 text-[11px] font-extrabold uppercase text-lime-300">{(cust.name || '?').trim().charAt(0) || '?'}</span>
                            <span className="font-bold text-white">{cust.name}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-lime-400"><span>{cust.identifier}</span></td>
                        <td className="p-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${typeCls}`}>{cust.type || 'Regular'}</span>
                        </td>
                        <td className="p-3">
                          {loy ? (
                            <div className="w-36">
                              <div className={`flex items-center gap-1 text-[11px] font-bold ${loy.textCls}`}>
                                {loy.key === 'PLATINUM' && <Crown className="h-3.5 w-3.5" />}
                                {loy.key === 'DIAMOND' && <Gem className="h-3.5 w-3.5" />}
                                <span>{loy.label}</span>
                              </div>
                              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-emerald-950">
                                <div className={`h-full rounded-full ${loy.barCls}`} style={{ width: `${loy.pct}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-emerald-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-white">{type === 'regular' ? os.count : <span className="text-emerald-500">—</span>}</td>
                        <td className="p-3 text-right font-bold text-white">{type === 'regular' ? peso(os.spent) : <span className="text-emerald-500">—</span>}</td>
                        <td className="p-3">
                          {st ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold capitalize text-emerald-100">
                              <span className={`h-1.5 w-1.5 rounded-full ${st === 'ACTIVE' ? 'bg-lime-400' : 'bg-amber-400'}`} />
                              {st.toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-emerald-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2 whitespace-nowrap">
                          <Button 
                            onClick={() => {
                              setEditingCustomer(cust);
                              setEditCustName(cust.name || '');
                              const isPhone = cust.identifier.startsWith('+') || /^\d+$/.test(cust.identifier.replace(/\s+/g, ''));
                              setEditCustType(isPhone ? 'phone' : 'email');
                              setEditCustValue(cust.identifier || '');
                            }} 
                            size="sm" 
                            className="bg-[#062c21] hover:bg-emerald-800 text-lime-300 border border-emerald-700 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button onClick={() => openLoyaltyManager(cust)} size="sm" className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer">
                            <Award className="h-3.5 w-3.5 mr-1" /> Loyalty
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-emerald-950 px-4 py-2.5 text-[11px] text-emerald-300">
            <span>Showing {firstShown}–{lastShown} of {filteredCustomers.length.toLocaleString('en-PH')} users</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} aria-label="Previous page" className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#071F19] text-emerald-200 hover:bg-emerald-900 disabled:opacity-30 cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageButtons.map((p) => typeof p === 'number' ? (
                <button key={p} type="button" onClick={() => setPage(p)} className={`h-7 min-w-7 rounded-lg px-2 text-[11px] font-extrabold cursor-pointer ${p === curPage ? 'bg-lime-400 text-black' : 'bg-[#071F19] text-emerald-200 hover:bg-emerald-900'}`}>{p}</button>
              ) : (
                <span key={p} className="px-1 text-emerald-500">…</span>
              ))}
              <button type="button" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)} aria-label="Next page" className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#071F19] text-emerald-200 hover:bg-emerald-900 disabled:opacity-30 cursor-pointer">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Edit customer account dialog lives in admin-edit-customer-dialog.tsx */}
    <AdminEditCustomerDialog
      editingCustomer={editingCustomer}
      setEditingCustomer={setEditingCustomer}
      handleSaveCustomerEdits={handleSaveCustomerEdits}
      editCustName={editCustName}
      setEditCustName={setEditCustName}
      editCustValue={editCustValue}
      setEditCustValue={setEditCustValue}
      custBusy={custBusy}
      handleChangeCustomerEmail={handleChangeCustomerEmail}
      handleSendCustomerReset={handleSendCustomerReset}
    />

    {/* Loyalty Manager dialog lives in admin-loyalty-manager-dialog.tsx */}
    <AdminLoyaltyManagerDialog
      loyaltyTargetUser={loyaltyTargetUser}
      setLoyaltyTargetUser={setLoyaltyTargetUser}
      loyaltyBusy={loyaltyBusy}
      setLoyaltyBusy={setLoyaltyBusy}
      loyaltyStatus={loyaltyStatus}
      pendingStamp={pendingStamp}
      setPendingStamp={setPendingStamp}
      fetchCloudData={fetchCloudData}
      openLoyaltyManager={openLoyaltyManager}
      loyaltyTierReason={loyaltyTierReason}
      setLoyaltyTierReason={setLoyaltyTierReason}
      loyaltyTier={loyaltyTier}
      setLoyaltyTier={setLoyaltyTier}
      handleLoyaltySetTier={handleLoyaltySetTier}
      loyaltyHistory={loyaltyHistory}
    />
    </>
  );
}

