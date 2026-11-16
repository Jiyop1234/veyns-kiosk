// @ts-nocheck
import React from 'react';
import { formatPeso } from '@/lib/menu-data';
import { payableAmount } from '@/components/admin/admin-order-status';

// Step A8c: summary cards and their sales metrics moved unchanged from employee-dashboard.tsx.
export function AdminSalesSummaryCards({ orders }: any) {
  // --- Derived sales metrics ---

  // Recognised sales: ONLY completed orders, using the amount actually payable (PWD orders = discounted final amount).
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalGrossSales = completedOrders.reduce((acc, o) => acc + payableAmount(o), 0);
  const totalOrdersCount = orders.length;
  const averageOrderValue = completedOrders.length > 0 ? totalGrossSales / completedOrders.length : 0;
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
        <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Gross Sales (Completed only)</span>
        <p className="text-3xl font-extrabold text-lime-400 font-display">{formatPeso(totalGrossSales)}</p>
      </div>
      <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
        <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Orders Placed</span>
        <p className="text-3xl font-extrabold text-white font-display">{totalOrdersCount} Orders</p>
        <p className="text-[10px] text-emerald-300/80 font-semibold">{completedOrders.length} completed • {pendingCount} pending</p>
      </div>
      <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
        <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Average Completed Order Value</span>
        <p className="text-3xl font-extrabold text-amber-400 font-display">{formatPeso(averageOrderValue)}</p>
      </div>
    </div>
  );
}
