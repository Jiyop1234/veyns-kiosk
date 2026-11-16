// @ts-nocheck
// Placeholder for a section that exists in the navigation but is not built yet (Ledger, Delivery Fees).
import React from 'react';

export function AdminComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-[#061c16] p-8 text-center sm:p-12">
      <h2 className="font-display text-xl font-extrabold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-emerald-200/80">{text}</p>
    </div>
  );
}
