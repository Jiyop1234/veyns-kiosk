// @ts-nocheck
// Step A8a: Apply PWD Discount (20%) confirmation dialog, moved unchanged from employee-dashboard.tsx.
// The JSX is the original; the values and handlers it used from the dashboard now arrive as props with the same names.
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/menu-data';

export function AdminOrderPwdDialog({
  pwdConfirmOrder, setPwdConfirmOrder, pwdIdChecked, setPwdIdChecked,
  busyOrderId, handleApplyPwd
}: any) {
  // PWD confirmation dialog
  return (
    <Dialog open={!!pwdConfirmOrder} onOpenChange={(open) => !open && setPwdConfirmOrder(null)}>
      {pwdConfirmOrder && (
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
          <div className="space-y-1 border-b border-emerald-900/60 pb-3">
            <DialogTitle className="font-display text-lg font-extrabold text-white">Apply PWD Discount (20%)</DialogTitle>
            <DialogDescription className="text-xs text-emerald-300">Order {pwdConfirmOrder.orderNumber}. Ask the customer to show their physical PWD ID and inspect it first. No copy of the ID is stored.</DialogDescription>
          </div>
          <div className="my-3 space-y-2 text-xs">
            <div className="flex justify-between text-emerald-200"><span>Order total</span><span className="font-bold text-white">{formatPeso(pwdConfirmOrder.total)}</span></div>
            <div className="flex justify-between text-sky-300"><span>PWD discount (20%)</span><span className="font-bold">−{formatPeso(Math.round(pwdConfirmOrder.total * 20) / 100)}</span></div>
            <div className="flex justify-between border-t border-emerald-900/60 pt-2 text-sm font-extrabold"><span>Final amount</span><span className="text-lime-400">{formatPeso(pwdConfirmOrder.total - Math.round(pwdConfirmOrder.total * 20) / 100)}</span></div>
            <label className="flex items-start gap-2 rounded-xl border border-emerald-800 bg-[#041913] p-3 cursor-pointer">
              <input type="checkbox" checked={pwdIdChecked} onChange={(e) => setPwdIdChecked(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-emerald-100 font-semibold">I personally inspected the customer's valid PWD ID.</span>
            </label>
            <p className="text-[10px] text-emerald-400/80">Preview only — the database computes and saves the real amount, and a second click can never deduct another 20%.</p>
          </div>
          <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
            <Button onClick={() => setPwdConfirmOrder(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
            <Button disabled={!pwdIdChecked || busyOrderId === pwdConfirmOrder.id} onClick={handleApplyPwd}
              className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
              {busyOrderId === pwdConfirmOrder.id ? 'Applying…' : 'Confirm & Apply'}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
