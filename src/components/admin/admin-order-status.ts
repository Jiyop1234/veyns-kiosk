// @ts-nocheck
// Admin order helpers: order statuses, their labels and colors, the amount payable (PWD aware) and the delivery option.
// Step A3: moved unchanged from employee-dashboard.tsx (via the A2 helpers file); only "export" was added.
// ---- order status + PWD helpers ----
export const ORDER_STATUSES = ['pending', 'completed', 'cancelled', 'rescheduled'] as const;
export const STATUS_LABEL: Record<string, string> = { pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rescheduled: 'Rescheduled' };
export const STATUS_SKIN: Record<string, string> = {
  pending: 'bg-amber-400/15 text-amber-300 border-amber-400/50',
  completed: 'bg-lime-400/15 text-lime-300 border-lime-400/50',
  cancelled: 'bg-red-950 text-red-400 border-red-800',
  rescheduled: 'bg-sky-400/15 text-sky-300 border-sky-400/50'
};
// Amount actually payable/collected: PWD orders use the discounted final amount.
export const payableAmount = (o: any) => (o?.pwdApplied ? Number(o.pwdFinal || 0) : Number(o?.total || 0));
// ---- edit-order helpers ----
// Our Delivery vs Maxim: use the saved delivery_option; older orders fall back to the schedule text.
export const orderDeliveryOption = (o: any): 'our' | 'maxim' | null => {
  if ((o?.fulfillment || '') !== 'delivery') return null;
  if (o?.deliveryOption === 'our' || o?.deliveryOption === 'maxim') return o.deliveryOption;
  return /maxim/i.test(o?.scheduleInfo || '') ? 'maxim' : 'our';
};
