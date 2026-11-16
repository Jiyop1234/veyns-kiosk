// @ts-nocheck
// Step A7: Loyalty Manager dialog (status, add/remove stamps per circle, set tier / block, stamp history), moved unchanged from employee-dashboard.tsx.
// The JSX is the original; the values and handlers it used from the dashboard now arrive as props with the same names.
import React from 'react';
import { Award, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

export function AdminLoyaltyManagerDialog({
  loyaltyTargetUser, setLoyaltyTargetUser, loyaltyBusy, setLoyaltyBusy,
  loyaltyStatus, pendingStamp, setPendingStamp, fetchCloudData,
  openLoyaltyManager, loyaltyTierReason, setLoyaltyTierReason, loyaltyTier,
  setLoyaltyTier, handleLoyaltySetTier, loyaltyHistory
}: any) {
  // Loyalty Manager modal (replaces Fair Play stamp/penalty system)
  return (
    <Dialog open={!!loyaltyTargetUser} onOpenChange={(open) => !open && setLoyaltyTargetUser(null)}>
    {loyaltyTargetUser && (
    <DialogContent className="max-w-xl w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
    <div className="space-y-1 border-b border-emerald-900/60 pb-3">
    <DialogTitle className="font-display text-xl font-extrabold text-white flex items-center gap-2">
    <Award className="h-5 w-5 text-lime-400" /> Loyalty Manager: {loyaltyTargetUser.name}
    </DialogTitle>
    <p className="text-[10px] text-emerald-300 font-mono">{loyaltyTargetUser.identifier}</p>
    </div>
    {loyaltyBusy && !loyaltyStatus ? (
    <p className="text-xs text-emerald-300 text-center py-8">Loading loyalty data…</p>
    ) : !loyaltyStatus ? (
    <p className="text-xs text-red-300 text-center py-8">No loyalty record (unlinked account?).</p>
    ) : (() => {
      const tier = loyaltyStatus.tier || null;
      const block = loyaltyStatus.block || 1;
      const sizes = [5, 10, 15, 5]; // Block 1..4 (Block 5 = Platinum zone, no circles)
      const size = sizes[block - 1] || 0;
      const pos = loyaltyStatus.position_in_block || 0;
      const cum = loyaltyStatus.cumulative_stamps || 0;
      const platExp = loyaltyStatus.platinum_expires_at ? new Date(loyaltyStatus.platinum_expires_at) : null;
      const weekly = loyaltyStatus.weekly;
      const badgeText = tier === 'DIAMOND' ? 'DIAMOND' : tier === 'PLATINUM' ? 'PLATINUM' : `BLOCK ${block}`;
      const badgeSkin = tier === 'DIAMOND' ? 'bg-sky-400/20 text-sky-300 border-sky-400/50' : tier === 'PLATINUM' ? 'bg-slate-200/20 text-slate-100 border-slate-300/50' : 'bg-lime-400/20 text-lime-400 border-lime-400/40';
      const inVip = tier === 'PLATINUM' || tier === 'DIAMOND';
      const base = cum - pos; // stamps that belong to the blocks before this one
      const circleLabels: Record<number, Record<number, string>> = {
        1: { 1: 'WELCOME', 5: '10% OFF' },
        2: { 5: '10% OFF', 10: '25% OFF' },
        3: { 5: '10% OFF', 10: '25% OFF', 15: '50% OFF' },
        4: { 5: 'FREE MEAL' }
      };
      const pendingMode = pendingStamp.slice(0, 2);
      const pendingK = parseInt(pendingStamp.slice(2));
      const applyPending = async () => {
        if (!pendingStamp || isNaN(pendingK)) return;
        setLoyaltyBusy(true);
        let res: any;
        if (pendingMode === 'AD') {
          const delta = pendingK - pos;
          if (delta <= 0) { setLoyaltyBusy(false); setPendingStamp(''); return; }
          res = await supabase.rpc('admin_adjust_stamps', { p_user_id: loyaltyTargetUser.auth_user_id, p_delta: delta, p_reason: null });
        } else {
          res = await supabase.rpc('admin_remove_stamp_to', { p_user_id: loyaltyTargetUser.auth_user_id, p_new_cum: base + pendingK - 1, p_reason: null });
        }
        setLoyaltyBusy(false);
        const d = res.data;
        if (res.error || !d?.success) { alert(res.error?.message || d?.message || 'Stamp change failed.'); }
        else { if (d.voided_vouchers && d.voided_vouchers.length) alert(`Removed. Voided unused voucher(s): ${d.voided_vouchers.join(', ')}`); fetchCloudData(); }
        setPendingStamp('');
        await openLoyaltyManager(loyaltyTargetUser);
      };
      return (
      <div className="my-4 space-y-4 text-xs">
        <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Current Status</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeSkin}`}>{badgeText}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-200">
            <p>Milestone Block: <strong className="text-white">{inVip ? '—' : `${block} of 4`}</strong></p>
            <p>Position in block: <strong className="text-white">{inVip ? 'Stamps paused' : `${pos} / ${size}`}</strong></p>
            <p>Cumulative stamps: <strong className="text-lime-400">{cum} / 35</strong></p>
            <p>Member since: <strong className="text-white">{loyaltyTargetUser.created_at ? new Date(loyaltyTargetUser.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '—'}</strong></p>
          </div>
          {platExp && <p className="text-[10px] text-slate-300">Platinum 2-week trial until <strong>{platExp.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</strong></p>}
          {weekly && <p className="text-[10px] text-slate-300">This week: <strong>{weekly.qualifying_orders}/3</strong> orders • <strong>{weekly.claims_remaining}/2</strong> 10% vouchers left • free meal {weekly.free_meal_state === 'claimed' ? 'claimed ✓' : weekly.free_meal_state === 'unlocked' ? 'unlocked (not yet claimed)' : 'locked'}</p>}
        </div>

        <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Add / Remove Stamps (per circle)</span>
          {inVip ? (
            <p className="text-[11px] text-slate-300 text-center py-3">Stamps are paused while the customer is <strong>{tier}</strong>. Use <em>Set Tier / Milestone Block</em> below to move them back to a block.</p>
          ) : (
          <>
          <p className="text-[10px] text-emerald-300 text-center font-bold uppercase tracking-wider">Block {block} • {size} stamps</p>
          <div className="grid grid-cols-5 gap-x-3 gap-y-3 justify-items-center">
            {Array.from({ length: size }).map((_, idx) => {
              const k = idx + 1;
              const filled = k <= pos;
              const isWelcome = block === 1 && k === 1;
              const label = (circleLabels[block] || {})[k];
              const isPending = pendingStamp && pendingK === k;
              return (
                <div key={idx} className="flex flex-col items-center gap-1 w-full">
                  <div className={`size-10 rounded-full flex items-center justify-center border-2 ${filled ? 'bg-lime-400 border-lime-300 text-black shadow-md' : 'bg-transparent border-white/70 text-lime-300'} ${isPending ? 'ring-2 ring-sky-400' : ''}`}>
                    {filled ? <Star className="size-4 fill-black" /> : <span className="text-[10px] font-bold">{k}</span>}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider min-h-[10px] ${label ? 'text-lime-400' : 'text-transparent'}`}>{label || '-'}</span>
                  {isWelcome ? (
                    <span className="text-[8px] font-black uppercase tracking-wider text-lime-400/80 px-1 py-0.5 rounded bg-black/30 border border-lime-400/30">🔒 Locked</span>
                  ) : (
                    <select value={isPending ? pendingStamp : ''} onChange={(e) => setPendingStamp(e.target.value)} disabled={loyaltyBusy}
                      className="w-full max-w-[92px] bg-[#04140f] border border-emerald-800 rounded-lg px-1 py-0.5 text-[9px] text-emerald-200 font-bold focus:outline-none focus:border-lime-400 cursor-pointer disabled:opacity-40">
                      {filled
                        ? (<><option value="">✓ Stamped</option><option value={'RM' + k}>− Remove to {k - 1}</option></>)
                        : (<><option value="">○ Empty</option><option value={'AD' + k}>＋ Add to {k}</option></>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
          {pendingStamp && !isNaN(pendingK) && (
            <div className="flex items-center justify-between gap-2 bg-black/30 border border-sky-400/50 rounded-xl p-2.5">
              <span className="text-[10px] text-sky-200 font-bold">
                {pendingMode === 'AD' ? `Add ${pendingK - pos} stamp(s) → fill up to circle ${pendingK}` : `Remove ${pos - (pendingK - 1)} stamp(s) → back to circle ${pendingK - 1}`}
              </span>
              <div className="flex gap-2 shrink-0">
                <Button onClick={() => setPendingStamp('')} disabled={loyaltyBusy} className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer">Cancel</Button>
                <Button onClick={applyPending} disabled={loyaltyBusy} className="bg-sky-400 hover:bg-sky-300 text-black font-extrabold px-4 py-1.5 rounded-lg text-[10px] cursor-pointer disabled:opacity-40">Apply</Button>
              </div>
            </div>
          )}
          <p className="text-[9px] text-emerald-400/80">Pick <em>Add</em> or <em>Remove</em> from a circle's dropdown, then press <strong>Apply</strong>. Circle 1 of Block 1 is the welcome stamp and is <strong>locked</strong>. Crossing a milestone credits its reward (the FREE MEAL voucher is issued automatically). Removing claws a reward back <strong>only if it was unused</strong>; if it was already spent, the removal is refused and the stamp stays valid.</p>
          </>
          )}
        </div>

        <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Set Tier / Milestone Block</span>
          <input type="text" value={loyaltyTierReason} onChange={(e) => setLoyaltyTierReason(e.target.value)} placeholder="Reason for tier / block change (required)" className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
          <div className="flex gap-2">
            <select value={loyaltyTier} onChange={(e) => setLoyaltyTier(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-lime-300 font-bold focus:outline-none focus:border-lime-400">
              <option value="CLEAR">Clear VIP (keep stamps)</option>
              <option value="B1">Milestone Block 1 (welcome stamp only)</option>
              <option value="B2">Milestone Block 2 (starts empty)</option>
              <option value="B3">Milestone Block 3 (starts empty)</option>
              <option value="B4">Milestone Block 4 (starts empty)</option>
              <option value="PLATINUM">Platinum (2-week trial)</option>
              <option value="DIAMOND">Diamond (invitation only)</option>
            </select>
            <Button onClick={handleLoyaltySetTier} disabled={loyaltyBusy} className="bg-sky-400 hover:bg-sky-300 text-black font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">Apply</Button>
          </div>
          <p className="text-[9px] text-emerald-400/80">Has its <strong>own</strong> reason field (separate from stamp add/remove). A <em>Block</em> choice <strong>teleports</strong> the customer to the <strong>start</strong> of that block (all circles empty; only Block 1 keeps its welcome stamp) and clears any VIP — it does <strong>not</strong> fill the block and issues no rewards. To give them the whole block, use <em>Add / Remove Stamps</em> above. <em>Platinum</em> starts a fresh 2-week trial (when it ends the customer returns to Block 2); <em>Diamond</em> is invitation only. Both leave the stamp count untouched.</p>
        </div>

        <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Stamp History (audit)</span>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-left text-[10px] text-emerald-200">
              <thead className="sticky top-0 bg-[#061d16] text-emerald-300 uppercase">
                <tr className="border-b border-emerald-800"><th className="p-1">Date</th><th className="p-1">Type</th><th className="p-1">Blk</th><th className="p-1">Total</th><th className="p-1">Reason</th></tr>
              </thead>
              <tbody>
                {loyaltyHistory.length === 0 ? (<tr><td colSpan={5} className="text-center p-2 text-emerald-400/60">No stamps recorded.</td></tr>) : (
                  loyaltyHistory.map((h) => (
                    <tr key={h.id} className="border-b border-emerald-900/40">
                      <td className="p-1">{new Date(h.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                      <td className="p-1 font-bold text-lime-300">{h.stamp_type}</td>
                      <td className="p-1">B{h.block_number}#{h.stamps_in_block}</td>
                      <td className="p-1">{h.cumulative_stamps}</td>
                      <td className="p-1 text-emerald-300/80 italic">{h.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      );
    })()}
    <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
    <Button onClick={() => setLoyaltyTargetUser(null)} className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Close</Button>
    </div>
    </DialogContent>
    )}
    </Dialog>
  );
}
