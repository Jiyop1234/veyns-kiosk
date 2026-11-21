// @ts-nocheck
// VEYNS Admin Vouchers: the create / edit form in a dialog (Step B6).
// Same fields, same rules and the same submit handler as the old form on the Vouchers page; only the look and the place changed.
// The state and handlers stay in the tab and arrive as props with the same names.
import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const inputCls = 'w-full bg-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white font-bold placeholder:text-zinc-500 placeholder:font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-60';
const selectCls = 'w-full bg-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [color-scheme:dark]';
const labelCls = 'text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1';

export function AdminVoucherFormDialog({
  open, onClose, handleAddPromo, editingPromoCode, resetPromoForm,
  newPromoCode, setNewPromoCode, newPromoDiscount, setNewPromoDiscount, newPromoType, setNewPromoType,
  newPromoTargetType, setNewPromoTargetType, newVoucherVisibility, setNewVoucherVisibility,
  newVoucherExpiryVal, setNewVoucherExpiryVal, newVoucherExpiryUnit, setNewVoucherExpiryUnit,
  newVoucherUsageMode, setNewVoucherUsageMode, newVoucherUsageLimit, setNewVoucherUsageLimit,
  newVoucherPerAccount, setNewVoucherPerAccount, newCampaignName, setNewCampaignName,
  newCampaignDesc, setNewCampaignDesc, newCampaignStart, setNewCampaignStart, newCampaignEnd, setNewCampaignEnd,
  newCampaignMinPurchase, setNewCampaignMinPurchase
}: any) {
  // Step B6 note: a dialog replaces the old always-open form card.
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-3xl w-full bg-[#141817] text-white shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="font-display text-lg font-extrabold text-white">{editingPromoCode ? `Edit ${editingPromoCode}` : 'New voucher'}</DialogTitle>
        <DialogDescription className="text-xs text-zinc-300">Create vouchers and promo codes, optionally as a dated campaign.</DialogDescription>
        <form onSubmit={handleAddPromo} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Voucher Code Name</label>
            <input type="text" placeholder="e.g. GEOGWAPO" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} required disabled={!!editingPromoCode} className={inputCls + ' uppercase placeholder:normal-case'} />
          </div>
          <div>
            <label className={labelCls}>Discount Type & Value</label>
            <div className="flex gap-1.5">
              <select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value as any)} className={selectCls + ' w-auto'}>
                <option value="peso">₱ OFF</option>
                <option value="percentage">% OFF</option>
              </select>
              <input type="number" placeholder={newPromoType === 'peso' ? "e.g. 50" : "e.g. 10"} value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(e.target.value)} required className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Discount Scope (Feature B)</label>
            <select value={newPromoTargetType} onChange={(e) => setNewPromoTargetType(e.target.value as any)} className={selectCls}>
              <option value="subtotal">Food Subtotal Only</option>
              <option value="delivery">Delivery Fee Only</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Customer Eligibility</label>
            <select value="registered" disabled className={selectCls + ' opacity-70 cursor-not-allowed'}>
              <option value="registered">Registered Customers Only</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Visibility in Checkout</label>
            <select value={newVoucherVisibility} onChange={(e) => setNewVoucherVisibility(e.target.value as any)} className={selectCls}>
              <option value="public">Public (Visible in Vouchers List)</option>
              <option value="hidden">Hidden (Via Events/Posts Only)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Expiry Time Type</label>
            <div className="flex gap-1.5">
              {newVoucherExpiryUnit !== 'never' && (
                <input type="number" value={newVoucherExpiryVal} onChange={(e) => setNewVoucherExpiryVal(e.target.value)} required className={inputCls + ' w-20'} />
              )}
              <select value={newVoucherExpiryUnit} onChange={(e) => setNewVoucherExpiryUnit(e.target.value as any)} className={selectCls + ' flex-1'}>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="never">Never Expires</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Usage Per Account</label>
            <select value={newVoucherPerAccount} onChange={(e) => setNewVoucherPerAccount(e.target.value as any)} className={selectCls}>
              <option value="one_time">One-Time Use Per Account</option>
              <option value="multiple">Multiple Uses Per Account</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Total Usage Limit</label>
            <div className="flex gap-1.5">
              <select value={newVoucherUsageMode} onChange={(e) => setNewVoucherUsageMode(e.target.value as any)} className={selectCls + ' flex-1'}>
                <option value="unlimited">Unlimited</option>
                <option value="limited">Limited</option>
              </select>
              {newVoucherUsageMode === 'limited' && (
                <input type="number" min="1" step="1" placeholder="Max redemptions" value={newVoucherUsageLimit} onChange={(e) => setNewVoucherUsageLimit(e.target.value)} required className={inputCls + ' w-32'} />
              )}
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 pt-2">
            <span className="text-[10px] font-extrabold text-sky-300 uppercase tracking-wider">Promotional Campaign (optional) • all times are Asia/Manila</span>
          </div>
          <div>
            <label className={labelCls}>Promotion Name</label>
            <input type="text" placeholder="e.g. 11.11 Sale" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-1 lg:col-span-2">
            <label className={labelCls}>Description</label>
            <input type="text" placeholder="Optional description" value={newCampaignDesc} onChange={(e) => setNewCampaignDesc(e.target.value)} className={inputCls + ' font-normal'} />
          </div>
          <div>
            <label className={labelCls}>Start Date & Time</label>
            <input type="datetime-local" value={newCampaignStart} onChange={(e) => setNewCampaignStart(e.target.value)} className={inputCls + ' [color-scheme:dark]'} />
          </div>
          <div>
            <label className={labelCls}>Expiration Date & Time</label>
            <input type="datetime-local" value={newCampaignEnd} onChange={(e) => setNewCampaignEnd(e.target.value)} className={inputCls + ' [color-scheme:dark]'} />
          </div>
          <div>
            <label className={labelCls}>Minimum Purchase (₱, optional)</label>
            <input type="number" min="0" placeholder="e.g. 300" value={newCampaignMinPurchase} onChange={(e) => setNewCampaignMinPurchase(e.target.value)} className={inputCls} />
          </div>
          <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-zinc-400">
            If a name, start or expiration is set, the "Expiry Time Type" above is ignored and the campaign runs on these dates. Leave the start empty to begin immediately; leave the expiration empty for no end date.
          </p>
          <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
            <Button type="submit" className="bg-lime-400 hover:bg-lime-300 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer">
              <Plus className="h-4 w-4 mr-1" /> {editingPromoCode ? 'Save Changes' : 'Create Voucher / Campaign'}
            </Button>
            <Button type="button" onClick={() => { resetPromoForm(); onClose(); }} className="bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
