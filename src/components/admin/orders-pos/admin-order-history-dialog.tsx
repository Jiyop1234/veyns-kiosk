// @ts-nocheck
// Step 6A-3: read-only history of one order (who changed what, and when), read from the database table order_audit_log.
// Staff can read that table (rule "Staff read order audit log"); nobody can change it from the browser.
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { STATUS_LABEL } from '@/components/admin/admin-order-status';

const EVENT_LABEL: Record<string, string> = { status_change: 'Status changed' };
const niceEvent = (e: string) => EVENT_LABEL[e] || String(e || 'event').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const niceValue = (v: any) => (v === null || v === undefined || v === '' ? '-' : STATUS_LABEL[v] || String(v));
const when = (iso: any) => (iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '');
const short = (v: any) => {
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 120 ? `${s.slice(0, 117)}...` : s;
};

// Turns the details column into a few readable lines. The full order copy ("snapshot") is never shown here.
function detailLines(d: any): string[] {
  if (!d || typeof d !== 'object') return [];
  const handled = ['note', 'reason', 'slots_released', 'previous_completed_at', 'snapshot'];
  const out: string[] = [];
  if (d.note) out.push(`Note: ${short(d.note)}`);
  if (d.reason) out.push(`Reason: ${short(d.reason)}`);
  if (Number(d.slots_released) > 0) out.push(`Slots released: ${d.slots_released}`);
  if (d.previous_completed_at) out.push(`Was completed on ${when(d.previous_completed_at)}`);
  Object.entries(d).forEach(([k, v]) => {
    if (handled.includes(k) || v === null || v === undefined || v === '') return;
    out.push(`${k.replace(/_/g, ' ')}: ${short(v)}`);
  });
  return out.slice(0, 8);
}

export function AdminOrderHistoryDialog({ order, onClose }: any) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order?.id) { setRows(null); setError(''); return undefined; }
    let alive = true;
    setRows(null);
    setError('');
    (async () => {
      const { data, error: err } = await supabase
        .from('order_audit_log')
        .select('id,created_at,event,from_value,to_value,actor_name,details')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (!alive) return;
      if (err) { setError(err.message || 'Could not load the history.'); setRows([]); return; }
      setRows(data || []);
    })();
    return () => { alive = false; };
  }, [order?.id]);

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto border border-emerald-800/60 bg-[#051813] text-emerald-100">
        <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-wide text-white">
          History of order {order?.orderNumber}
        </DialogTitle>
        <DialogDescription className="text-xs text-emerald-300/80">
          Read-only record kept by the database. It cannot be edited or deleted from this screen.
        </DialogDescription>

        <ol className="mt-2 space-y-2">
          {order?.createdAt && (
            <li className="rounded-xl border border-emerald-800/60 bg-[#071F19] p-3 text-xs">
              <p className="font-extrabold text-lime-400">Order placed</p>
              <p className="text-[10px] text-emerald-300">{when(order.createdAt)}</p>
            </li>
          )}
          {rows === null && <li className="p-3 text-xs text-emerald-300">Loading history...</li>}
          {error && <li role="alert" className="rounded-xl border border-red-800 bg-red-950/70 p-3 text-xs font-bold text-red-300">Could not load the history: {error}</li>}
          {rows && !error && rows.length === 0 && <li className="p-3 text-xs text-emerald-300/80">No changes recorded for this order yet.</li>}
          {(rows || []).map((r) => (
            <li key={r.id} className="rounded-xl border border-emerald-800/60 bg-[#071F19] p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <p className="font-extrabold text-lime-400">{niceEvent(r.event)}</p>
                <p className="shrink-0 text-[10px] text-emerald-300">{when(r.created_at)}</p>
              </div>
              {(r.from_value || r.to_value) && (
                <p className="mt-1 font-bold text-white">{niceValue(r.from_value)} → {niceValue(r.to_value)}</p>
              )}
              {r.actor_name && <p className="text-[10px] text-sky-300">By {r.actor_name}</p>}
              {detailLines(r.details).map((line, i) => (
                <p key={i} className="text-[10px] text-emerald-200">{line}</p>
              ))}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
