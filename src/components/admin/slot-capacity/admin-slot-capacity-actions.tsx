// Global Actions bar of the Slot Capacity screen: Edit time windows, Copy previous day, Holiday mode, Reset to default.
// Step B4b: new file. The buttons only report which action was chosen; the tab builds the plan, asks for confirmation and saves.
import { CalendarClock, Copy, Umbrella, RotateCcw } from 'lucide-react';

const ACTION_BUTTON = 'flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

export function AdminSlotCapacityActions({ dateKey, disabled, onEditWindows, onBulk }: any) {
  const items = [
    { id: 'windows', icon: CalendarClock, title: 'Edit time windows', text: 'Update operating hours', run: onEditWindows },
    { id: 'copy', icon: Copy, title: 'Copy previous day', text: "Use last day's settings", run: () => onBulk('copy') },
    { id: 'holiday', icon: Umbrella, title: 'Holiday mode', text: 'Close all slots', run: () => onBulk('holiday') },
    { id: 'reset', icon: RotateCcw, title: 'Reset to default', text: 'Restore default capacity', run: () => onBulk('reset') },
  ];
  return (
    <div className="shrink-0 rounded-3xl bg-white/[0.03] p-3">
      <p className="mb-2 px-1 text-xs font-semibold text-white/50">Global actions for {dateKey}</p>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {items.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} type="button" disabled={disabled && a.id !== 'windows'} onClick={a.run} className={ACTION_BUTTON}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime-400/15 text-lime-400"><Icon className="size-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">{a.title}</span>
                <span className="block truncate text-[11px] text-white/50">{a.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
