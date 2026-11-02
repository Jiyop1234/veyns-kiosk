// @ts-nocheck
// Save as: src/components/extras-page.tsx
// Customer "Extras" page: lists ONLY items marked is_extra in the database (live-synced).
// Regular menu items that are merely offered in the popup (e.g. Fries) are not shown here.
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPeso } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';

function Photo({ id, dbImage, alt, className }: { id: string; dbImage?: string; alt: string; className: string }) {
  const src = dbImage || menuImages[id];
  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#0d2e26] font-display text-sm font-bold text-[#d4af37]`}>
        VEYNS
      </div>
    );
  }
  return <img src={src} alt={alt} width={512} height={512} className={className} />;
}

export function ExtrasPage({ onBack, onReviewOrder }: { onBack: () => void; onReviewOrder: () => void }) {
  const { add, lines, setLineQty, remove, count, total } = useCart();
  const [extras, setExtras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadExtras = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_extra', true)
      .order('sort_order', { ascending: true });
    if (error) {
      setLoadError('Could not load extras. Please try again.');
      setLoading(false);
      return;
    }
    setExtras(
      (data || [])
        .filter((m: any) => m.is_available !== false)
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          description: m.description,
          price: Number(m.price),
          discountPercent: Number(m.discount_percent || 0),
          image: m.image_url,
          optionGroups: m.option_groups || [],
        }))
    );
    setLoadError('');
    setLoading(false);
  };

  useEffect(() => {
    loadExtras();
    const channel = supabase
      .channel('extras_page_' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => loadExtras())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const qtyOf = (id: string) => {
    const line = Array.isArray(lines) ? lines.find((l: any) => l.item.id === id) : null;
    return line ? line.qty : 0;
  };

  const changeQty = (item: any, next: number) => {
    if (next <= 0) remove(item.id);
    else if (qtyOf(item.id) === 0) add(item, next);
    else setLineQty(item.id, next);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#071F19] text-white">
      <div className="sticky top-0 z-10 border-b border-emerald-900/60 bg-[#03120d]">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-full border border-emerald-700/80 bg-[#061d16] px-4 py-2 text-xs font-semibold text-white hover:border-lime-400 cursor-pointer"
          >
            <ArrowLeft className="size-4 text-lime-400" /> Back to menu
          </button>
          <div className="relative flex items-center gap-1.5 rounded-full border border-emerald-700/80 bg-[#061d16] px-4 py-2 text-xs text-white">
            <ShoppingBag className="size-4 text-lime-400" />
            <span>{count} in order</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-4 pb-32 pt-8 sm:px-8">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-lime-400">Little add-ons</p>
        <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">EXTRAS</h1>
        <p className="mt-1 text-xs text-emerald-300/80">Sauces, rice, egg and katsu to go with your meal.</p>

        {loading ? (
          <p className="py-16 text-center text-xs text-emerald-300">Loading extras…</p>
        ) : loadError ? (
          <p className="py-16 text-center text-xs text-red-400">{loadError}</p>
        ) : extras.length === 0 ? (
          <p className="py-16 text-center text-xs text-emerald-300/80">No extras are available right now.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {extras.map((item) => {
              const q = qtyOf(item.id);
              const hasDiscount = item.discountPercent > 0;
              const effective = hasDiscount ? item.price * (1 - item.discountPercent / 100) : item.price;
              return (
                <div
                  key={item.id}
                  className={`relative flex flex-col justify-between rounded-2xl border bg-[#051813] p-3 text-center transition-all ${
                    q > 0 ? 'border-lime-400/80 shadow-lg' : 'border-emerald-800/50 hover:border-lime-400/50'
                  }`}
                >
                  {q > 0 && (
                    <span className="absolute right-2 top-2 z-10 rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-extrabold text-black shadow-md">
                      {q}x
                    </span>
                  )}
                  {hasDiscount && (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-black">
                      {item.discountPercent}% OFF
                    </span>
                  )}
                  <div className="mx-auto mb-2 aspect-square w-full max-w-[140px] overflow-hidden rounded-xl bg-[#08291f]">
                    <Photo id={item.id} dbImage={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="mb-3 space-y-1">
                    <h3 className="text-xs font-bold leading-tight text-white">{item.name}</h3>
                    {item.description ? (
                      <p className="line-clamp-2 text-[10px] text-emerald-300/70">{item.description}</p>
                    ) : null}
                    <p className="text-sm font-extrabold text-lime-400">
                      {formatPeso(effective)}
                      {hasDiscount && (
                        <span className="ml-1.5 text-[10px] font-normal text-emerald-400/60 line-through">{formatPeso(item.price)}</span>
                      )}
                    </p>
                  </div>

                  {q === 0 ? (
                    <Button
                      onClick={() => changeQty(item, 1)}
                      size="sm"
                      className="flex h-8 w-full items-center justify-center gap-1 rounded-xl border border-emerald-700/60 bg-[#082a20] text-xs font-semibold text-white transition-all hover:bg-lime-400 hover:text-black cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  ) : (
                    <div className="flex h-8 w-full items-center justify-between rounded-xl border border-emerald-600/80 bg-[#041913] px-2 text-xs font-bold text-white shadow-inner">
                      <button type="button" onClick={() => changeQty(item, q - 1)} className="rounded-md p-1 text-emerald-300 hover:bg-emerald-800/40 hover:text-white cursor-pointer">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs font-extrabold">{q}</span>
                      <button type="button" onClick={() => changeQty(item, q + 1)} className="rounded-md p-1 text-emerald-300 hover:bg-emerald-800/40 hover:text-white cursor-pointer">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-emerald-900/60 bg-[#03120d]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <div className="text-xs text-emerald-200">
              <span className="font-bold text-white">{count} item{count === 1 ? '' : 's'}</span> · {formatPeso(total)}
            </div>
            <Button
              onClick={onReviewOrder}
              className="flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-xs font-extrabold text-black hover:bg-lime-500 cursor-pointer"
            >
              Review my order <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
