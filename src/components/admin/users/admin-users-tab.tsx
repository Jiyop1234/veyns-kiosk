// @ts-nocheck
// Step A7: Users tab (Registered Customer Accounts list, search, Edit and Loyalty buttons) plus all customer-edit and Loyalty Manager state and handlers,
// moved unchanged from employee-dashboard.tsx. Only the imports, the props, the 'active' guard and the two dialog calls are new.
// The component stays mounted, so the search text and open dialogs behave exactly as before.
import React, { useState } from 'react';
import { Users, Search, Edit2, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { AdminEditCustomerDialog } from '@/components/admin/users/admin-edit-customer-dialog';
import { AdminLoyaltyManagerDialog } from '@/components/admin/users/admin-loyalty-manager-dialog';

export function AdminUsersTab({ active, customers, fetchCloudData }: { active: boolean; customers: any[]; fetchCloudData: () => void }) {
  const [customerSearch, setCustomerSearch] = useState('');
  
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

  // --- Derived customer search results ---
  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.identifier.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <>
    {/* Customer account search and management */}
    {active && (
      <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-lime-400" />
            <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Registered Customer Accounts</h3>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/70" />
            <input
              type="text"
              placeholder="Search customer nickname..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] pl-9 pr-4 py-2 text-xs text-white placeholder:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-emerald-100">
            <thead className="bg-[#071F19] text-emerald-300 uppercase text-[10px] tracking-wider border-b border-emerald-800/60">
              <tr>
                <th className="p-3">Customer Nickname</th>
                <th className="p-3">Gmail / Phone Identifier</th>
                <th className="p-3">Account Type</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-emerald-400/70">
                    No customer accounts match your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-[#071F19]/50 transition-colors">
                      <td className="p-3 font-bold text-white">{cust.name}</td>
                      <td className="p-3 text-lime-400 font-mono"><span>{cust.identifier}</span></td>
                      <td className="p-3">
                        <span className="inline-block bg-[#082d22] text-lime-400 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase">{cust.type || 'Regular'}</span>
                      </td>
                      <td className="p-3 text-right space-x-2">
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

