// @ts-nocheck
// OVERVIEW page (Part B). Step B1a: placeholder that already receives the live data,
// so Step B1b only changes the files in overview/ and the dashboard line stays the same.
import React from 'react';

export function AdminOverviewTab({ active, orders, menuItems }: { active: boolean; orders: any[]; menuItems: any[] }) {
  if (!active) return null;
  return (
    <div className="rounded-2xl bg-[#061c16] p-8 text-center sm:p-12">
      <h2 className="font-display text-xl font-extrabold text-white">The overview is being built</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-emerald-200/80">
        Revenue, orders, sales chart, top sellers and order status will appear here. Live data is connected: {orders.length} orders and {menuItems.length} menu items loaded.
      </p>
    </div>
  );
}
