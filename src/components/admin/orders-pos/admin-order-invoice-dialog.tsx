// @ts-nocheck
// Step A8a: See Invoice dialog (printable invoice, staff-only delivery verification, PWD buttons), moved unchanged from employee-dashboard.tsx.
// The JSX is the original; the values and handlers it used from the dashboard now arrive as props with the same names.
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/menu-data';
import { requestStaffGeocode } from '@/lib/order-geocode';
import { itemQty, lineItemName, itemUnit } from '@/components/admin/admin-order-items';
import { STATUS_LABEL, STATUS_SKIN, orderDeliveryOption } from '@/components/admin/admin-order-status';

export function AdminOrderInvoiceDialog({
  selectedInvoice, setSelectedInvoice, openPwdConfirm, handleRemovePwd,
  busyOrderId, fetchCloudData
}: any) {
  // See Invoice dialog
  return (
    <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
      {selectedInvoice && (
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <div id="printable-invoice" className="space-y-4">
            <div className="text-center border-b border-emerald-900/60 pb-3 space-y-1">
              <DialogTitle className="font-display text-xl font-extrabold text-lime-400 uppercase">
                VEYNS. Official Invoice
              </DialogTitle>
              <p className="text-xs text-emerald-300">Reference: <strong>{selectedInvoice.orderNumber}</strong></p>
              <p className="text-[10px] text-emerald-400">{selectedInvoice.date}</p>
            </div>
            <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1.5">
              <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Customer & Contact Info:</p>
              <p className="font-bold text-white text-sm">Account: {selectedInvoice.accountNickname}</p>
              <p className="font-bold text-emerald-200">Delivery Name: {selectedInvoice.name}</p>
              <p className="text-emerald-200">Phone: <strong>{selectedInvoice.phone || 'N/A'}</strong></p>
              <p className="text-emerald-200">Email: <strong>{selectedInvoice.email || 'N/A'}</strong></p>
            </div>
            <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1.5">
              <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Fulfillment & Delivery:</p>
              <p className="text-white uppercase font-bold">Method: {selectedInvoice.fulfillment}</p>
              <p className="text-emerald-200">Address: <strong>{selectedInvoice.location || 'N/A'}</strong></p>
              <p className="text-emerald-200">Landmark: <strong>{selectedInvoice.landmark || 'N/A'}</strong></p>
            </div>
            <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1.5">
              <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Order Schedule & Type:</p>
              <p className="text-amber-300 uppercase font-bold">
                {selectedInvoice.orderType === 'reservation' ? '📅 Reservation' : '⚡ Order Today'}
              </p>
              <p className="text-white font-medium">{selectedInvoice.scheduleInfo || 'Immediate / Today'}</p>
            </div>
            <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-2">
              <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Order Summary:</p>
              <div className="space-y-1 border-b border-emerald-900/60 pb-2">
                {(selectedInvoice.items || []).length === 0 && (
                  <p className="text-emerald-400 text-[11px]">No item details were saved for this order.</p>
                )}
                {(selectedInvoice.items || []).map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-white">
                    <div>
                      <span>{itemQty(it)}x {lineItemName(it)}</span>
                      <span className="text-emerald-400 text-[10px]"> @ {formatPeso(itemUnit(it))}</span>
                      {it.customizationsSummary && (
                        <p className="text-[10px] text-lime-300 font-mono pl-2">↳ {it.customizationsSummary}</p>
                      )}
                    </div>
                    <span className="font-bold text-lime-400">{formatPeso(itemUnit(it) * itemQty(it))}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-emerald-200">
                  <span>Food Subtotal:</span>
                  <span>{formatPeso(selectedInvoice.subtotal || (selectedInvoice.items || []).reduce((s: number, it: any) => s + itemUnit(it) * itemQty(it), 0))}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span>Promo: {selectedInvoice.promoCode || 'NA'}</span>
                  <span>{selectedInvoice.promoDiscount > 0 ? `−${formatPeso(selectedInvoice.promoDiscount)} (food)` : selectedInvoice.promoCode ? '' : 'NA'}</span>
                </div>
                {selectedInvoice.manualDiscount > 0 && (
                  <div className="flex justify-between text-amber-400 font-semibold">
                    <span>Customer Discount{selectedInvoice.manualDiscountType === 'percent' && selectedInvoice.manualDiscountValue ? ` (${selectedInvoice.manualDiscountValue}%)` : ''}{selectedInvoice.manualDiscountLabel ? ` — ${selectedInvoice.manualDiscountLabel}` : ''}:</span>
                    <span>−{formatPeso(selectedInvoice.manualDiscount)}</span>
                  </div>
                )}
                {selectedInvoice.deliveryFee > 0 && (
                  <div className="flex justify-between text-emerald-200">
                    <span>Delivery Fee:</span>
                    <span>{formatPeso(selectedInvoice.deliveryFee)}</span>
                  </div>
                )}
                {selectedInvoice.deliveryDiscount > 0 && (
                  <div className="flex justify-between text-amber-400 font-semibold">
                    <span>Delivery Discount:</span>
                    <span>−{formatPeso(selectedInvoice.deliveryDiscount)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-sm font-extrabold text-white pt-1">
                <span>{selectedInvoice.pwdApplied ? 'Original Order Total:' : 'Total Amount Due:'}</span>
                <span className={selectedInvoice.pwdApplied ? 'text-emerald-200 text-base' : 'text-lime-400 text-base'}>{formatPeso(selectedInvoice.pwdApplied ? selectedInvoice.pwdOriginal : selectedInvoice.total)}</span>
              </div>
              {selectedInvoice.pwdApplied && (
                <div className="space-y-1 text-xs rounded-lg border border-sky-400/50 bg-sky-400/10 p-2.5">
                  <div className="flex justify-between text-sky-300 font-extrabold">
                    <span>♿ PWD Discount ({selectedInvoice.pwdPercent}%):</span>
                    <span>−{formatPeso(selectedInvoice.pwdDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-white">
                    <span>Final Amount:</span>
                    <span className="text-lime-400 text-base">{formatPeso(selectedInvoice.pwdFinal)}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-xs text-emerald-200 pt-1">
                <span>Order Status:</span>
                <span className={`px-2 py-0.5 rounded-full border font-extrabold uppercase text-[10px] ${STATUS_SKIN[selectedInvoice.status] || STATUS_SKIN.pending}`}>{STATUS_LABEL[selectedInvoice.status] || selectedInvoice.status}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-200">
                <span>Discount Type:</span>
                <span className="font-bold text-white">{selectedInvoice.pwdApplied ? 'PWD' : 'NA'}</span>
              </div>
              {selectedInvoice.pwdApplied && (
                <p className="text-[10px] text-sky-300/80">ID manually checked by {selectedInvoice.pwdAppliedByName || 'staff'}{selectedInvoice.pwdAppliedAt ? ` on ${new Date(selectedInvoice.pwdAppliedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}` : ''}</p>
              )}
            </div>
          </div>
          {selectedInvoice.fulfillment === 'delivery' && (
            <div data-admin-only="true" className="mt-3 bg-[#04140f] border border-sky-700/60 rounded-xl p-3 text-xs space-y-1.5 print:hidden">
              <p className="font-bold text-sky-300 uppercase text-[10px] tracking-wider">🔒 Delivery verification (staff only: not on the printed invoice, never shown to customers)</p>
              <p className="text-emerald-200">Customer-entered delivery address: <strong>{selectedInvoice.location || 'N/A'}</strong></p>
              <p className="text-emerald-200">Customer-entered nearest landmark: <strong>{selectedInvoice.landmark || 'N/A'}</strong></p>
              {selectedInvoice.pinLat != null ? (
                <>
                  <p className="text-emerald-200">
                    Pinned map location: <strong>{selectedInvoice.pinLat.toFixed(6)}, {selectedInvoice.pinLng.toFixed(6)}</strong>{' '}
                    <a href={`https://www.openstreetmap.org/?mlat=${selectedInvoice.pinLat}&mlon=${selectedInvoice.pinLng}#map=18/${selectedInvoice.pinLat}/${selectedInvoice.pinLng}`}
                      target="_blank" rel="noopener noreferrer" className="text-lime-400 underline font-bold">View pin on map</a>
                  </p>
                  <p className="text-emerald-200">
                    Map address (auto-generated from the pin): <strong>{selectedInvoice.mapAddress || (selectedInvoice.mapAddressStatus === 'failed' ? 'Could not be generated.' : 'Being generated…')}</strong>
                    {selectedInvoice.mapAddressStatus !== 'ok' && (
                      <button type="button" className="ml-2 text-lime-400 underline font-bold cursor-pointer"
                        onClick={() => requestStaffGeocode([selectedInvoice.id], true).then(() => fetchCloudData())}>
                        {selectedInvoice.mapAddressStatus === 'failed' ? 'Try again' : 'Refresh'}
                      </button>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-emerald-400">
                  {orderDeliveryOption(selectedInvoice) === 'maxim'
                    ? 'Maxim delivery: no map pin is required.'
                    : 'No map pin recorded (placed before the pin became required, or added by staff without one).'}
                </p>
              )}
            </div>
          )}
          {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'rescheduled') && (
            <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
              {!selectedInvoice.pwdApplied && (
                <Button onClick={() => openPwdConfirm(selectedInvoice)} disabled={busyOrderId === selectedInvoice.id}
                  className="flex-1 bg-sky-950 hover:bg-sky-400 hover:text-black text-sky-300 border border-sky-700 font-extrabold py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">
                  Apply PWD Discount (20%)
                </Button>
              )}
              {selectedInvoice.pwdApplied && (
                <Button onClick={() => handleRemovePwd(selectedInvoice)} disabled={busyOrderId === selectedInvoice.id}
                  className="flex-1 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">
                  Remove PWD (admin)
                </Button>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
            <Button
              onClick={() => {
                const printContent = document.getElementById('printable-invoice')?.innerHTML;
                const originalContents = document.body.innerHTML;
                if (printContent) {
                  document.body.innerHTML = printContent;
                  window.print();
                  document.body.innerHTML = originalContents;
                  window.location.reload();
                }
              }}
              className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs shadow-lg cursor-pointer"
            >
              Print Invoice
            </Button>
            <Button
              onClick={() => setSelectedInvoice(null)}
              className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
