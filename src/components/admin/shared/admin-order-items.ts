// @ts-nocheck
// Admin order helpers: read an order line (quantity, name, unit price) from new and old order shapes.
// Step A3: moved unchanged from employee-dashboard.tsx (via the A2 helpers file); only "export" was added.
// ---- order display helpers (work for normalised items AND old raw items) ----
export const itemQty = (it: any) => Number(it?.qty ?? it?.quantity ?? 1);
export const lineItemName = (it: any) => it?.name || it?.item?.name || 'Item';
export const itemUnit = (it: any) => Number(it?.unitPrice ?? it?.price ?? it?.item?.price ?? 0);
