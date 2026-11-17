// @ts-nocheck
// Confirm dialog for the Global Actions (Copy previous day, Holiday mode, Reset to default) on the Slot Capacity screen.
// Step B4b: new file. It lists exactly what will change and what is left alone, then, after Apply, what was saved and what failed.
// Nothing is saved from here: the tab runs the plan (one admin_set_slot_capacity call per window) and passes the result back.
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const TITLES = {
  holiday: (p: any) => `Holiday mode for ${p.dateKey}`,
  copy: (p: any) => `Copy ${p.sourceDateKey} to ${p.dateKey}`,
  reset: (p: any) => `Reset ${p.dateKey} to default`,
};
const DESCRIPTIONS = {
  holiday: 'Closes every window below so customers cannot book it. Bowls already reserved stay reserved.',
  copy: 'Copies the max bowls and the closed switch of each window from the previous day. Existing reservations are not moved.',
  reset: 'Sets every window below to 10 bowls and open. Bowls already reserved stay reserved.',
};
const describe = (s: any) => `${s.maxBowls} ${s.maxBowls === 1 ? 'bowl' : 'bowls'}, ${s.isFullyBooked ? 'closed' : 'open'}`;

export function AdminSlotCapacityBulkDialog({ plan, busy, result, onConfirm, onClose }: any) {
  const changes = plan ? plan.items.filter((i: any) => i.to) : [];
  const skipped = plan ? plan.items.filter((i: any) => !i.to) : [];

  return (
    <Dialog open={!!plan} onOpenChange={(open) => !open && onClose()}>
      {plan && (
        <DialogContent className="w-full max-w-lg rounded-3xl border-0 bg-[#07130f] p-6 text-white shadow-2xl">
          <div className="space-y-1 pb-2">
            <DialogTitle className="font-display text-lg font-extrabold text-white">{TITLES[plan.kind](plan)}</DialogTitle>
            <DialogDescription className="text-xs text-white/60">{DESCRIPTIONS[plan.kind]}</DialogDescription>
          </div>

          {!result ? (
            <>
              <div className="my-3 max-h-[45vh] space-y-3 overflow-y-auto text-xs">
                {changes.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="font-bold text-lime-400">Will change ({changes.length})</p>
                    {changes.map((i: any) => (
                      <div key={i.slotTime} className="rounded-xl bg-white/[0.06] px-3 py-2">
                        <p className="font-bold text-white">{i.slotTime}</p>
                        <p className="text-white/60">{describe(i.from)} <span className="text-lime-300">to</span> {describe(i.to)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white/[0.06] px-3 py-3 text-white/70">Nothing to change: every window is already set this way or cannot be changed.</p>
                )}
                {skipped.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-bold text-white/60">Left as it is ({skipped.length})</p>
                    {skipped.map((i: any) => (
                      <div key={i.slotTime} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                        <span className="font-semibold text-white/80">{i.slotTime}</span>
                        <span className="text-right text-white/50">{i.note}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-white/40">Each window is saved on its own. If one fails, the others still save and the failure is listed.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={busy} onClick={onClose} className="flex-1 cursor-pointer rounded-xl bg-white/[0.06] py-2.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40">Cancel</button>
                <button
                  type="button"
                  disabled={busy || changes.length === 0}
                  onClick={onConfirm}
                  className="flex-1 cursor-pointer rounded-xl bg-lime-400 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? 'Saving...' : `Apply to ${changes.length} ${changes.length === 1 ? 'window' : 'windows'}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="my-3 max-h-[45vh] space-y-3 overflow-y-auto text-xs">
                <p className={`rounded-xl border p-2.5 font-bold ${result.failed.length === 0 ? 'border-lime-500/40 bg-lime-950/60 text-lime-300' : 'border-red-700 bg-red-950/70 text-red-300'}`}>
                  {result.done.length} saved{result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}.
                </p>
                {result.done.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-bold text-lime-400">Saved</p>
                    {result.done.map((d: any) => <p key={d.slotTime} className="text-white/80">{d.slotTime}</p>)}
                  </div>
                )}
                {result.failed.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-bold text-red-300">Failed</p>
                    {result.failed.map((f: any) => (
                      <div key={f.slotTime} className="rounded-xl bg-red-500/10 px-3 py-2">
                        <p className="font-bold text-white">{f.slotTime}</p>
                        <p className="text-red-300">{f.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} className="w-full cursor-pointer rounded-xl bg-lime-400 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">Close</button>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
