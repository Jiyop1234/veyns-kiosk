// @ts-nocheck
// Admin navigation chrome (Part B, Steps B1a3 and B1a4):
// - tablet and desktop (768 px and up): a floating rounded pill at the left, vertically centered.
//   Collapsed (default): icons only. Expanded: icons, labels, counts and "Exit to Store".
//   The white round button on its edge switches between the two.
// - phones (under 768 px): a fixed top bar with a menu button, and a slide-in drawer.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Menu as MenuIcon, X } from 'lucide-react';
import { ADMIN_NAV_ITEMS } from '@/components/admin/admin-nav-items';

// The list of navigation buttons, shared by the pill and the drawer.
// showLabels false = square icon buttons (collapsed pill); true = full-width rows with label and count.
// Step B1a4: the neon highlight is one bar behind the buttons. When the active section changes it first
// stretches from the old row to the new row, then its tail follows and it settles on the new row.
function NavButtons({ activeTab, onSelect, counts, showLabels }) {
  const btnRefs = useRef({});
  const lastRect = useRef(null);
  const lastTab = useRef(null);
  const lastLabels = useRef(null);
  const [bar, setBar] = useState({ top: 0, height: 0, ms: 0 });

  useLayoutEffect(() => {
    const el = btnRefs.current[activeTab];
    if (!el) return undefined;
    const next = { top: el.offsetTop, height: el.offsetHeight };
    const prev = lastRect.current;
    const tabChanged = lastTab.current !== activeTab;
    const labelsChanged = lastLabels.current !== showLabels;
    lastRect.current = next;
    lastTab.current = activeTab;
    lastLabels.current = showLabels;
    // First paint, or the pill was expanded / collapsed: jump to the row without animation.
    if (!prev || !tabChanged || labelsChanged) {
      setBar({ top: next.top, height: next.height, ms: 0 });
      return undefined;
    }
    // Phase 1: stretch over both rows. Phase 2: shrink to the new row.
    const top = Math.min(prev.top, next.top);
    const bottom = Math.max(prev.top + prev.height, next.top + next.height);
    setBar({ top, height: bottom - top, ms: 140 });
    const timer = setTimeout(() => setBar({ top: next.top, height: next.height, ms: 200 }), 140);
    return () => clearTimeout(timer);
  }, [activeTab, showLabels]);

  return (
    <nav aria-label="Admin sections" className="relative flex flex-col gap-1">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 z-0 rounded-xl bg-lime-400 shadow-lg"
        style={{ top: bar.top, height: bar.height, opacity: bar.height ? 1 : 0, transition: bar.ms ? `top ${bar.ms}ms ease-out, height ${bar.ms}ms ease-out` : 'none' }}
      />
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const count = item.countKey ? counts?.[item.countKey] : undefined;
        return (
          <button
            key={item.id}
            ref={(el) => { btnRefs.current[item.id] = el; }}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
            className={`relative z-10 flex cursor-pointer items-center rounded-xl text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${showLabels ? 'w-full gap-3 px-3 py-2.5' : 'mx-auto h-10 w-10 justify-center'} ${isActive ? 'text-black' : 'text-emerald-100/80 hover:bg-emerald-900/40 hover:text-white'}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {showLabels && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
            {showLabels && count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${isActive ? 'bg-black/15 text-black' : 'bg-emerald-900/60 text-emerald-200'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({ activeTab, onSelect, counts, title, expanded, onToggleExpanded, mobileOpen, onOpenMobile, onCloseMobile, onExit }) {
  // Escape closes the phone drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onCloseMobile(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Phone top bar (fixed: the page itself must not scroll it away) */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 bg-[#020b08]/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMobile}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-[#061c16] text-lime-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">{title}</h1>
      </div>

      {/* Tablet and desktop: floating pill, collapsed or expanded */}
      <aside
        className={`fixed left-8 top-[13vh] bottom-[13vh] z-30 hidden flex-col rounded-3xl bg-[#141817] shadow-2xl shadow-black/50 transition-[width] duration-200 md:flex ${expanded ? 'w-56' : 'w-14'}`}
      >
        <button
          type="button"
          aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="absolute -right-3 top-6 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
        >
          {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-14">
          <NavButtons activeTab={activeTab} onSelect={onSelect} counts={counts} showLabels={expanded} />
        </div>
        <div className="px-2 pb-3">
          <button
            type="button"
            title="Exit to Store"
            aria-label="Exit to Store"
            onClick={onExit}
            className={`flex cursor-pointer items-center bg-[#082d22] font-extrabold text-lime-400 transition-colors hover:bg-lime-400 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${expanded ? 'w-full justify-center gap-2 rounded-xl px-3 py-2 text-xs' : 'mx-auto h-9 w-9 justify-center rounded-lg'}`}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            {expanded && <span>Exit to Store</span>}
          </button>
        </div>
      </aside>

      {/* Phone drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="absolute inset-0 h-full w-full cursor-default bg-black/70" />
          <div className="absolute inset-y-3 left-3 flex w-72 max-w-[85%] flex-col rounded-3xl bg-[#141817] shadow-2xl shadow-black/50">
            <div className="flex h-14 items-center justify-end px-3">
              <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-emerald-200 hover:bg-emerald-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavButtons activeTab={activeTab} onSelect={onSelect} counts={counts} showLabels />
            </div>
            <div className="p-3">
              <button type="button" onClick={onExit} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#082d22] px-4 py-2.5 text-sm font-extrabold text-lime-400 hover:bg-lime-400 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                <ArrowLeft className="h-4 w-4" /> Exit to Store
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
