// @ts-nocheck
// VEYNS Admin: the Edit Order screen on Orders & POS (Step B2c).
// It replaces the old Edit Order pop-up: the same fields, estimate, promo choices and Save button, shown in place of the order
// form like "Edit Transaction" in the Ledger. State, handlers and edit helpers stay in admin-order-log-tab.tsx and are passed in.
import React from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPeso } from '@/lib/menu-data';
import { DeliveryPinMap } from '@/components/admin/admin-delivery-pin-map';
import { itemQty, lineItemName, itemUnit } from '@/components/admin/admin-order-items';
import { orderDeliveryOption } from '@/components/admin/admin-order-status';
import { todayManila } from '@/components/admin/admin-slot-times';

export function AdminOrderEditPanel({
  editOrder,
  setEditOrder,
  editQty,
  setEditQty,
  editMethod,
  setEditMethod,
  editPhone,
  setEditPhone,
  editLocation,
  setEditLocation,
  editLandmark,
  setEditLandmark,
  editFee,
  editDate,
  setEditDate,
  editSlot,
  setEditSlot,
  editName,
  setEditName,
  editPin,
  setEditPin,
  editPinFee,
  editAddrTouched,
  editNote,
  setEditNote,
  editDiscType,
  setEditDiscType,
  editDiscValue,
  setEditDiscValue,
  editDiscLabel,
  setEditDiscLabel,
  editAvailPromos,
  editAvailLoading,
  editAvailError,
  editAddPromos,
  timeSlotsList,
  busyOrderId,
  handleSaveEdit,
  toggleEditPromo,
  editEstSubtotal,
  editFeeNow,
  editOldPromoScaled,
  editNewFoodPromo,
  editNewDeliveryPromo,
  editFoodPromoNow,
  editDeliveryPromoNow,
  editDiscountPreview,
  editBowlsNow,
  editSlotInfo,
  fit
}: any) {
  if (!editOrder) return null;
  // On a no-scroll screen the three columns scroll inside themselves; otherwise they stack and the page scrolls.
  const col = fit ? 'min-h-0 space-y-4 overflow-y-auto pr-1' : 'space-y-4';
  return (
    <div className={`rounded-2xl bg-white/[0.04] p-4 ${fit ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
      <div className="flex shrink-0 items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold text-white">Edit Order {editOrder.orderNumber}</h2>
          <p className="text-xs text-zinc-400">
            {editOrder.name}. Change the details and save. Changes show instantly in the customer's My Order History. The database recalculates the total, checks slot capacity and logs every edit.
          </p>
        </div>
        <button type="button" onClick={() => setEditOrder(null)} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"><X className="h-3.5 w-3.5" /> Cancel</button>
      </div>

      <div className={fit ? 'grid min-h-0 flex-1 grid-cols-3 gap-4 text-xs' : 'grid grid-cols-1 gap-4 text-xs'}>
        <div className={col}>
          {/* Items */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block">Items &amp; Quantity</label>
            {(editOrder.items || []).map((it: any, i: number) => {
              const qty = Number(editQty[i]) || 0;
              return (
                <div key={i} className={`flex items-center justify-between gap-2 rounded-xl p-2.5 ${qty === 0 ? 'bg-red-500/10 opacity-70' : 'bg-white/[0.06]'}`}>
                  <div className="min-w-0">
                    <p className={`font-bold text-white truncate ${qty === 0 ? 'line-through' : ''}`}>{lineItemName(it)}</p>
                    {it.customizationsSummary && <p className="text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</p>}
                    <p className="text-[10px] text-zinc-400">{formatPeso(itemUnit(it))} each{qty === 0 ? ' • will be removed' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => setEditQty((p) => ({ ...p, [i]: Math.max(0, (Number(p[i]) || 0) - 1) }))}
                      className="h-7 w-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-lime-400 font-extrabold cursor-pointer">−</button>
                    <input type="number" min={0} max={50} value={qty}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(50, Math.floor(Number(e.target.value) || 0)));
                        setEditQty((p) => ({ ...p, [i]: n }));
                      }}
                      className="w-12 bg-black/30 rounded-lg py-1 text-center text-xs font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
                    <button type="button" onClick={() => setEditQty((p) => ({ ...p, [i]: Math.min(50, (Number(p[i]) || 0) + 1) }))}
                      className="h-7 w-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-lime-400 font-extrabold cursor-pointer">+</button>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-zinc-500">Set a quantity to 0 to remove a line. Each line keeps its original price and add-ons.</p>
            {editMethod !== 'on-site' && editSlot && (() => {
              const si = editSlotInfo(editDate, editSlot);
              return si.over ? (
                <p className="text-[10px] font-bold text-red-400">
                  {si.closed ? '⛔ This time slot is closed by the administrator. ' : '⛔ Not enough bowls in this time slot. '}
                  This order can hold at most {si.left} bowl{si.left === 1 ? '' : 's'} here ({editBowlsNow()} entered).
                </p>
              ) : null;
            })()}
          </div>

          {/* Fulfillment */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block">Fulfillment</label>
            {editMethod === 'on-site' ? (
              <p className="rounded-xl bg-white/[0.06] p-2.5 text-zinc-300">On-site (counter) order. Only quantities can be edited.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {([['pickup', 'Pickup'], ['delivery', 'Delivery']] as const).map(([key, label]) => {
                    const active = key === 'pickup' ? editMethod === 'pickup' : (editMethod === 'our' || editMethod === 'maxim');
                    return (
                      <button key={key} type="button"
                        onClick={() => setEditMethod(key === 'pickup' ? 'pickup' : (editMethod === 'maxim' ? 'maxim' : 'our'))}
                        className={`p-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${active ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                {(editMethod === 'our' || editMethod === 'maxim') && (
                  <div className="grid grid-cols-2 gap-2">
                    {([['our', 'Our Delivery'], ['maxim', 'Maxim Courier']] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setEditMethod(key)}
                        className={`p-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${editMethod === key ? 'bg-lime-400/15 text-lime-300 ring-1 ring-lime-400/60' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Delivery details */}
          {(editMethod === 'our' || editMethod === 'maxim') && (
            <div className="space-y-2 rounded-xl bg-white/[0.06] p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1">Contact Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1">Contact Number</label>
                  <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
                </div>
              </div>
              {editMethod === 'our' && (
                <>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1">Delivery Pin (click the map)</label>
                    <DeliveryPinMap value={editPin} onChange={setEditPin} />
                    <p className="text-[10px] text-zinc-300 mt-1">
                      {editPin
                        ? `Pinned: ${editPin.lat.toFixed(5)}, ${editPin.lng.toFixed(5)}${editPinFee ? ` • ${editPinFee.km} km from store • delivery fee ${formatPeso(editPinFee.fee)}` : ' • calculating the fee…'}`
                        : (editOrder.fulfillment === 'delivery' && orderDeliveryOption(editOrder) === 'our'
                            ? `No new pin: the saved delivery fee (${formatPeso(Number(editOrder.deliveryFee) || 0)}) is kept. Drop a pin to recalculate it.`
                            : 'Drop the pin on the customer location so the delivery fee can be calculated.')}
                    </p>
                    <p className="text-[10px] text-zinc-500">Under 1 km free • 1–2 km ₱40 • beyond 2 km ₱40 + ₱5 per extra km. Calculated by the database.</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1">Delivery Address</label>
                    <input type="text" value={editLocation} onChange={(e) => { editAddrTouched.current = true; setEditLocation(e.target.value); }}
                      className="w-full bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
                  </div>
                </>
              )}
              <div>
                <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1">Nearest Landmark</label>
                <input type="text" value={editLandmark} onChange={(e) => setEditLandmark(e.target.value)}
                  className="w-full bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
              </div>
              {editMethod === 'maxim' && (
                <p className="text-[10px] text-zinc-300">Maxim Courier: no map pin or address is needed. The delivery fee is paid directly to the rider, so this order's delivery fee becomes ₱0.00.</p>
              )}
            </div>
          )}


        </div>
        <div className={col}>
          {/* Schedule */}
          {editMethod !== 'on-site' && (
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block">Date &amp; Time Schedule</label>
              <p className="text-[10px] text-zinc-500">Current: {editOrder.slotDate ? `${editOrder.slotDate} (${editOrder.slotTime})` : 'unknown'}. Past and fully booked slots cannot be chosen. Changing the time marks the order Rescheduled.</p>
              <input type="date" min={todayManila()} value={editDate} onChange={(e) => e.target.value && setEditDate(e.target.value)}
                className="w-full bg-black/30 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
              <div className="grid grid-cols-2 gap-2">
                {timeSlotsList.map((slot) => {
                  const a = editSlotInfo(editDate, slot);
                  const selected = editSlot === slot;
                  return (
                    <button key={slot} type="button" disabled={a.disabled}
                      onClick={() => setEditSlot(slot)}
                      className={`p-2 rounded-lg text-[11px] font-bold flex flex-col items-center transition-all ${
                        a.disabled ? 'bg-red-500/10 text-red-400 opacity-60 cursor-not-allowed'
                        : selected ? 'bg-lime-400 text-black'
                        : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] cursor-pointer'}`}>
                      <span>{slot}</span>
                        <span className="text-[9px] font-semibold mt-0.5">{a.same
                        ? (a.closed ? `🔒 Current slot • closed (max ${a.left})` : `Current slot • up to ${a.left} bowls`)
                        : a.ended ? '⏰ Past'
                        : a.closed ? '⛔ Closed by admin'
                        : a.full ? `⛔ Only ${a.left} left`
                        : `🟢 ${a.left} bowls left`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block mb-1">Reason / Note (optional, saved in the audit log)</label>
            <input type="text" value={editNote} maxLength={200} onChange={(e) => setEditNote(e.target.value)}
              placeholder="e.g. Customer misclicked Maxim, wants our delivery"
              className="w-full bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
          </div>

          {/* Estimate */}
          <div className="rounded-xl bg-white/[0.06] p-3 space-y-1">
            <div className="flex justify-between text-zinc-300">
              <span>Estimated food subtotal ({editBowlsNow()} item{editBowlsNow() === 1 ? '' : 's'})</span>
              <span className="font-bold text-white">{formatPeso((editOrder.items || []).reduce((s: number, it: any, i: number) => s + itemUnit(it) * (Number(editQty[i]) || 0), 0))}</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Estimated delivery fee</span>
              <span className="font-bold text-white">{editMethod === 'our' ? formatPeso(editPinFee ? editPinFee.fee : (Number(editFee) || 0)) : formatPeso(0)}</span>
            </div>
            {(editNewFoodPromo() + editNewDeliveryPromo()) > 0 && (
              <div className="flex justify-between text-lime-300">
                <span>Added promo / voucher ({editAddPromos.join(', ')})</span>
                <span className="font-bold">−{formatPeso(Math.min(editEstSubtotal() - editOldPromoScaled(), editNewFoodPromo()) + Math.min(editFeeNow(), editNewDeliveryPromo()))}</span>
              </div>
            )}
            {editDiscountPreview() > 0 && (
              <div className="flex justify-between text-amber-300">
                <span>Customer discount{editDiscType === 'percent' ? ` (${Number(editDiscValue)}%)` : ''}</span>
                <span className="font-bold">−{formatPeso(editDiscountPreview())}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-300 border-t border-white/[0.06] pt-1">
              <span>Estimated total</span>
              <span className="font-bold text-lime-400">{formatPeso(Math.max(0, editEstSubtotal() - editFoodPromoNow() - editDiscountPreview() + editFeeNow() - editDeliveryPromoNow()))}</span>
            </div>
            <p className="text-[10px] text-zinc-500">Preview only. Promos and the PWD discount are recalculated by the database when you save, and the final total is shown afterwards.</p>
          </div>

        </div>
        <div className={col}>
          {/* Customer discount (applied to the food subtotal after promo codes; never to the delivery fee) */}
          <div className="rounded-xl bg-white/[0.06] p-3 space-y-2">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block">Customer Discount</label>
            <div className="grid grid-cols-2 gap-2">
              <select value={editDiscType} onChange={(e) => setEditDiscType(e.target.value as any)}
                className="bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                <option value="none">No discount</option>
                <option value="percent">Percentage (%)</option>
                <option value="amount">Fixed amount (₱)</option>
              </select>
              <input type="number" min="0" step="0.01" disabled={editDiscType === 'none'} value={editDiscType === 'none' ? '' : editDiscValue}
                onChange={(e) => setEditDiscValue(e.target.value)}
                placeholder={editDiscType === 'percent' ? 'e.g. 10' : editDiscType === 'amount' ? 'e.g. 30' : '—'}
                className="bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-40" />
            </div>
            <input type="text" maxLength={80} disabled={editDiscType === 'none'} value={editDiscType === 'none' ? '' : editDiscLabel}
              onChange={(e) => setEditDiscLabel(e.target.value)} placeholder="Reason (optional), e.g. Forgot to apply loyalty discount"
              className="w-full bg-black/30 rounded-lg p-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 disabled:opacity-40" />
            <p className="text-[10px] text-zinc-500">Choose "No discount" to remove an existing discount. It is added to the order, never changes the bowl quantity, and is logged.</p>

            {/* Promos & vouchers the customer may have forgotten to add (only ones this customer can really use right now) */}
            <div className="border-t border-white/[0.06] pt-2 space-y-2">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest block">Available Promos &amp; Vouchers</label>
              {editOrder.promoCode ? (
                <p className="text-[10px] text-zinc-300">Already on this order: <strong className="text-white">{editOrder.promoCode}</strong></p>
              ) : (
                <p className="text-[10px] text-zinc-500">No promo or voucher is on this order yet.</p>
              )}
              {editAvailLoading ? (
                <p className="text-[10px] text-zinc-300">Checking which promos and vouchers this customer can use…</p>
              ) : editAvailError ? (
                <p className="text-[10px] text-red-400">{editAvailError}</p>
              ) : editAvailPromos.length === 0 ? (
                <p className="text-[10px] text-zinc-500">No other promo or voucher is available for this customer right now.</p>
              ) : (
                <div className="space-y-1.5">
                  {editAvailPromos.map((p: any) => {
                    const picked = editAddPromos.includes(p.code);
                    const needsMore = Number(p.minPurchase || 0) > editEstSubtotal();
                    const off = p.type === 'percentage' ? `${Number(p.discountValue)}% off` : `${formatPeso(Number(p.discountValue))} off`;
                    const where = p.targetType === 'delivery' ? 'delivery fee' : 'food';
                    return (
                      <div key={p.code} className={`flex items-center justify-between gap-2 rounded-lg p-2 ${picked ? 'bg-lime-400/15 ring-1 ring-lime-400/60' : 'bg-black/30'}`}>
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs truncate">
                            {p.code}{p.name ? ` · ${p.name}` : ''}
                            {p.personal && <span className="ml-1.5 text-[9px] font-bold uppercase text-lime-300">Customer's voucher</span>}
                          </p>
                          <p className="text-[10px] text-zinc-300">
                            {off} on {where}
                            {Number(p.minPurchase || 0) > 0 ? ` · min. ${formatPeso(Number(p.minPurchase))}` : ''}
                            {p.oneTimePerAccount ? ' · one-time per account' : ''}
                            {p.remaining !== null && p.remaining !== undefined ? ` · ${p.remaining} left` : ''}
                          </p>
                          {needsMore && !picked && <p className="text-[10px] text-amber-300">Order is below this promo's minimum purchase.</p>}
                        </div>
                        <button type="button" disabled={needsMore && !picked} onClick={() => toggleEditPromo(p.code)}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${picked ? 'bg-lime-400 text-black' : 'bg-white/[0.08] text-zinc-100 hover:bg-white/[0.16]'}`}>
                          {picked ? 'Added ✓' : 'Add'}
                        </button>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-zinc-500">A promo or voucher added here counts as used by this customer (limits and one-time rules apply) and is logged.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-3">
        <Button disabled={busyOrderId === editOrder.id || (editMethod !== 'on-site' && !!editSlot && editSlotInfo(editDate, editSlot).over)} onClick={handleSaveEdit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-sm font-extrabold text-black shadow-lg hover:bg-lime-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">
          <Save className="h-4 w-4" /> {busyOrderId === editOrder.id ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
