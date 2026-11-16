// @ts-nocheck
// Step A7: Edit customer account dialog (nickname, sign-in email, password-reset email), moved unchanged from employee-dashboard.tsx.
// The JSX is the original; the values and handlers it used from the dashboard now arrive as props with the same names.
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function AdminEditCustomerDialog({
  editingCustomer, setEditingCustomer, handleSaveCustomerEdits, editCustName,
  setEditCustName, editCustValue, setEditCustValue, custBusy,
  handleChangeCustomerEmail, handleSendCustomerReset
}: any) {
  // EDIT CUSTOMER ACCOUNT MODAL
  return (
    <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
      {editingCustomer && (
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
          <div className="space-y-1 border-b border-emerald-900/60 pb-3">
            <DialogTitle className="font-display text-lg font-extrabold text-white">
              Edit Account: {editingCustomer.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-300">
              Update the display nickname, change the sign-in email, or send a password-reset email. The customer always verifies through their own inbox.
            </DialogDescription>
          </div>
          <form onSubmit={handleSaveCustomerEdits} className="space-y-4 my-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-lime-400 uppercase tracking-wider block">Customer Nickname</label>
              <input
                type="text"
                required
                value={editCustName}
                onChange={(e) => setEditCustName(e.target.value)}
                className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400"
              />
            </div>
            <div className="space-y-2 border-t border-emerald-900/60 pt-3">
              <label className="font-bold text-lime-400 uppercase tracking-wider block">Sign-in email</label>
              <input
                type="email"
                value={editCustValue}
                onChange={(e) => setEditCustValue(e.target.value)}
                className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-lime-400"
              />
              <div className="flex gap-2">
                <Button type="button" disabled={custBusy} onClick={handleChangeCustomerEmail} className="flex-1 bg-sky-950 hover:bg-sky-400 hover:text-black text-sky-300 border border-sky-700 font-extrabold py-2 rounded-xl text-[11px] cursor-pointer disabled:opacity-40">
                  {custBusy ? 'Working…' : 'Save new email'}
                </Button>
                <Button type="button" disabled={custBusy} onClick={handleSendCustomerReset} className="flex-1 bg-amber-950/40 hover:bg-amber-400 hover:text-black text-amber-300 border border-amber-700/60 font-extrabold py-2 rounded-xl text-[11px] cursor-pointer disabled:opacity-40">
                  Send password reset
                </Button>
              </div>
              <p className="text-[10px] text-emerald-400/80">A verification link goes to the customer's Gmail. Staff never see or set passwords. Changing an email is for administrators only.</p>
            </div>
            <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
              <Button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
