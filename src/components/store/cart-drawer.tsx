// @ts-nocheck
// CartDrawer (Step B8): the panel that slides in from the right when the cart icon in the header is pressed.
// It only shows and edits the cart (same CartProvider as checkout). Checkout opens the existing checkout dialog; nothing about ordering changes.
import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatPeso } from '@/lib/menu-data';

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400';

export function CartDrawer({ open, onClose, onCheckout, onBrowseMenu }: { open: boolean; onClose: () => void; onCheckout: () => void; onBrowseMenu: () => void }) {
  const { lines, setLineQty, remove, clear, count, total } = useCart();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  // Slide in, lock the page behind it, move focus into the panel and give it back when closed.
  useEffect(() => {
    if (!open) { setEntered(false); return; }
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open]);

  // Escape closes; Tab stays inside the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0] as HTMLElement;
      const last = f[f.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleClear = () => {
    if (window.confirm('Remove everything from your cart?')) clear();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onClose} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={`absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#03120d] shadow-2xl transition-transform duration-300 ease-out sm:border-l sm:border-white/10 ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">Your cart</h2>
            <p className="text-xs text-emerald-100/60">{count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Nothing here yet'}</p>
          </div>
          <div className="flex items-center gap-1">
            {lines.length > 0 && (
              <button type="button" onClick={handleClear} className={`rounded-full px-3 py-2 text-xs font-semibold text-emerald-100/70 transition-colors hover:text-red-300 cursor-pointer ${FOCUS}`}>Clear</button>
            )}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close cart" className={`flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-[#0d2e26] hover:text-lime-400 cursor-pointer ${FOCUS}`}>
              <X className="size-5" />
            </button>
          </div>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-16 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-[#0d2e26] text-lime-400"><ShoppingCart className="size-9" /></div>
            <h3 className="font-display text-xl font-extrabold text-white">Your cart is empty</h3>
            <p className="max-w-[16rem] text-sm text-emerald-100/60">Pick something good from the menu and it will show up here.</p>
            <button type="button" onClick={onBrowseMenu} className={`mt-2 rounded-full bg-lime-400 px-6 py-3 text-sm font-extrabold text-black transition-colors hover:bg-lime-300 cursor-pointer ${FOCUS}`}>Browse the menu</button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto px-5 pb-4 sm:px-6">
              {lines.map((line) => {
                const lineKey = line.lineId || line.id || line.item.id;
                const unit = line.unitPrice ?? line.item.price;
                return (
                  <li key={lineKey} className="flex gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
                    {line.item.image && (
                      <img src={line.item.image} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-white">{line.item.name}</h3>
                        <button type="button" onClick={() => remove(lineKey)} aria-label={`Remove ${line.item.name}`} className={`-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-emerald-100/50 transition-colors hover:bg-red-950/50 hover:text-red-300 cursor-pointer ${FOCUS}`}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      {line.customizationsSummary && <p className="mt-0.5 text-[11px] leading-snug text-lime-300/90">{line.customizationsSummary}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
                          <button
                            type="button"
                            onClick={() => (line.qty <= 1 ? remove(lineKey) : setLineQty(lineKey, line.qty - 1))}
                            aria-label={line.qty <= 1 ? `Remove ${line.item.name}` : 'Decrease quantity'}
                            className={`flex size-7 items-center justify-center rounded-full text-emerald-100 transition-colors hover:bg-[#0d2e26] hover:text-lime-400 cursor-pointer ${FOCUS}`}
                          ><Minus className="size-3.5" /></button>
                          <span className="w-6 text-center text-sm font-bold tabular-nums text-white" aria-live="polite">{line.qty}</span>
                          <button
                            type="button"
                            onClick={() => setLineQty(lineKey, line.qty + 1)}
                            aria-label="Increase quantity"
                            className={`flex size-7 items-center justify-center rounded-full text-emerald-100 transition-colors hover:bg-[#0d2e26] hover:text-lime-400 cursor-pointer ${FOCUS}`}
                          ><Plus className="size-3.5" /></button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-lime-400">{formatPeso(unit * line.qty)}</p>
                          {line.qty > 1 && <p className="text-[10px] text-emerald-100/50">{formatPeso(unit)} each</p>}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="space-y-3 border-t border-white/10 bg-[#03120d] px-5 py-4 sm:px-6">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-emerald-100/80">Subtotal</span>
                <span className="font-display text-2xl font-extrabold text-white">{formatPeso(total)}</span>
              </div>
              <p className="text-[11px] text-emerald-100/50">Delivery fee and promo codes are added at checkout.</p>
              <button type="button" onClick={onCheckout} className={`w-full rounded-full bg-lime-400 py-3.5 text-sm font-extrabold text-black transition-colors hover:bg-lime-300 cursor-pointer ${FOCUS}`}>Checkout</button>
              <button type="button" onClick={onClose} className={`w-full rounded-full py-2 text-xs font-semibold text-emerald-100/70 transition-colors hover:text-lime-400 cursor-pointer ${FOCUS}`}>Continue shopping</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
