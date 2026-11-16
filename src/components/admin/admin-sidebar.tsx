// @ts-nocheck
// Admin navigation chrome (Part B, Step B1a):
// - phones (under 768 px): a fixed top bar with a menu button, and a slide-in drawer
// - tablets (768 to 1023 px): a narrow rail with icons only
// - desktop (1024 px and up): a full sidebar with icons, labels and counts
import React, { useEffect } from 'react';
import { ArrowLeft, Menu as MenuIcon, X } from 'lucide-react';
import { ADMIN_NAV_ITEMS } from '@/components/admin/admin-nav-items';

// The list of navigation buttons, shared by the rail / sidebar and the drawer.
// labelClass hides the text on the tablet rail ('hidden lg:inline') and shows it in the drawer ('').
function NavButtons({ activeTab, onSelect, counts, labelClass, railCentered }) {
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const count = item.countKey ? counts?.[item.countKey] : undefined;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${railCentered ? 'justify-center lg:justify-start' : ''} ${isActive ? 'bg-lime-400 text-black shadow-lg' : 'text-emerald-100/80 hover:bg-emerald-900/40 hover:text-white'}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={`min-w-0 flex-1 truncate text-left ${labelClass}`}>{item.label}</span>
            {count !== undefined && (
              <span className={`${labelClass} rounded-full px-2 py-0.5 text-[11px] font-extrabold ${isActive ? 'bg-black/15 text-black' : 'bg-emerald-900/60 text-emerald-200'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({ activeTab, onSelect, counts, title, mobileOpen, onOpenMobile, onCloseMobile, onExit }) {
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
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-emerald-900/65 bg-[#020b08]/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMobile}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-emerald-800/70 bg-[#061c16] text-lime-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">{title}</h1>
      </div>

      {/* Tablet rail and desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-emerald-900/65 bg-[#04140f] md:flex lg:w-60">
        <div className="flex h-16 items-center justify-center gap-2 border-b border-emerald-900/50 px-3 lg:justify-start lg:px-5">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-lime-400" />
          <span className="hidden font-display text-sm font-extrabold text-lime-400 lg:inline">Employee & Admin Portal</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 lg:p-3">
          <NavButtons activeTab={activeTab} onSelect={onSelect} counts={counts} labelClass="hidden lg:inline" railCentered />
        </div>
      </aside>

      {/* Phone drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="absolute inset-0 h-full w-full cursor-default bg-black/70" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-emerald-900/65 bg-[#04140f]">
            <div className="flex h-14 items-center justify-between border-b border-emerald-900/50 px-4">
              <span className="flex items-center gap-2 font-display text-sm font-extrabold text-lime-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-lime-400" /> Employee & Admin Portal
              </span>
              <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-emerald-200 hover:bg-emerald-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavButtons activeTab={activeTab} onSelect={onSelect} counts={counts} labelClass="" railCentered={false} />
            </div>
            <div className="border-t border-emerald-900/50 p-3">
              <button type="button" onClick={onExit} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-700/80 bg-[#082d22] px-4 py-2.5 text-sm font-extrabold text-lime-400 hover:bg-lime-400 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
                <ArrowLeft className="h-4 w-4" /> Exit to Store
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
