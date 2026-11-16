// @ts-nocheck
// Step A8a: Delete Order confirmation dialog, moved unchanged from employee-dashboard.tsx.
// The JSX is the original; the values and handlers it used from the dashboard now arrive as props with the same names.
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/menu-data';
import { STATUS_LABEL, payableAmount } from '@/components/admin/admin-order-status';

export function AdminOrderDeleteDialog({
  deleteTarget, setDeleteTarget, deleteReason, setDeleteReason,
  deleteAck, setDeleteAck, busyOrderId, handleDeleteOrder
}: any) {
  // Delete order confirmation dialog
  return (
    <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      {deleteTarget && (
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-red-900/80 shadow-2xl p-6 rounded-3xl">
          <div className="space-y-1 border-b border-red-900/60 pb-3">
            <DialogTitle className="font-display text-lg font-extrabold text-red-400">Delete order {deleteTarget.orderNumber}?</DialogTitle>
            <DialogDescription className="text-xs text-emerald-300">
              {deleteTarget.name || 'Customer'} • {formatPeso(payableAmount(deleteTarget))} • {STATUS_LABEL[deleteTarget.status] || deleteTarget.status}
            </DialogDescription>
          </div>
          <div className="my-4 space-y-3 text-xs">
            <p className="text-emerald-200">
              This permanently removes the order from the active orders and from Sales Analytics, and gives its reserved bowls back to the time slot.
              The customer's account is not touched, and a snapshot of the order is kept in the audit log.
              {deleteTarget.status === 'completed' && <strong className="text-amber-300"> This order is COMPLETED, so Gross Sales will go down by {formatPeso(payableAmount(deleteTarget))}.</strong>}
            </p>
            <input type="text" maxLength={200} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason (optional, saved in the audit log)"
              className="w-full bg-[#041913] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-red-300 font-bold">I understand that deleting {deleteTarget.orderNumber} cannot be undone.</span>
            </label>
          </div>
          <div className="flex gap-2 pt-2 border-t border-red-900/60">
            <Button onClick={() => setDeleteTarget(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
            <Button disabled={!deleteAck || busyOrderId === deleteTarget.id} onClick={handleDeleteOrder}
              className="flex-1 bg-red-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              {busyOrderId === deleteTarget.id ? 'Deleting…' : 'Delete Order'}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
