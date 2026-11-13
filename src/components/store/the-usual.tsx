// @ts-nocheck
// TheUsual (Step 10) — the playful "The usual?" section of the landing page.
//
// When it shows (all must be true):
//   1. the customer is signed in (never for guests);
//   2. they have placed at least 3 orders that are not cancelled;
//   3. at least one menu item appears in 2 or more of those orders.
// The usual is the item that appears in the MOST separate orders. Quantity does not matter
// (2 bowls in one order counts as 1). A tie goes to the item in the most recent order.
//
// Order again adds that item to the cart with the quantity and options of the last order that contained it.
// Every option is re-checked against the CURRENT menu (fresh read from Supabase at click time), and the price
// is recalculated from the current menu, never from the old order. Anything that no longer exists is skipped
// and the customer is told.
//
// Data: it reuses `orderHistory` (already loaded by profile-page.tsx, newest first, protected by the
// "Customers read own orders" policy). It only reads `menu_items`, which is public. No database change.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { formatPeso } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import { isGuestUser } from '@/components/store/profile-page';

const MIN_ORDERS = 3; // orders needed before the section can appear
const MIN_REPEATS = 2; // orders the top item must appear in

// Same mapping MenuPage uses, so the cart receives the same item shape.
const mapMenuRow = (m: any) => ({
  id: m.id,
  name: m.name,
  category: m.category,
  description: m.description,
  price: Number(m.price),
  discountPercent: Number(m.discount_percent || 0),
  isAvailable: m.is_available,
  bestSeller: m.best_seller,
  isExtra: !!m.is_extra,
  offerInPopup: !!m.offer_in_popup,
  sortOrder: Number(m.sort_order || 100),
  isCustomizable: m.is_customizable,
  hasBrothEggOption: m.has_broth_egg_option,
  image: m.image_url,
  optionGroups: m.option_groups || [],
});

// Saved order lines carry menuItemId; older lines may only have item.id or id.
const lineItemId = (line: any) => line?.menuItemId ?? line?.item?.id ?? line?.id ?? null;
const lineQty = (line: any) => Math.min(50, Math.max(1, Number(line?.qty ?? line?.quantity ?? 1) || 1));

// Rank the items by how many separate orders they appear in. Needs the history newest first.
function findCandidates(orderHistory: any[]) {
  const valid = (orderHistory || []).filter((o) => String(o?.status || '').toLowerCase() !== 'cancelled');
  if (valid.length < MIN_ORDERS) return [];

  const stats = new Map<string, any>();
  valid.forEach((order, idx) => {
    const seenInThisOrder = new Set<string>();
    (order.items || []).forEach((line: any) => {
      const rawId = lineItemId(line);
      if (rawId === null || rawId === undefined) return;
      const id = String(rawId);
      let s = stats.get(id);
      if (!s) {
        // First time we meet the item = its most recent order (the list is newest first).
        s = { id, count: 0, lastIdx: idx, lines: [], name: line.name || line.item?.name || '' };
        stats.set(id, s);
      }
      if (!seenInThisOrder.has(id)) {
        seenInThisOrder.add(id);
        s.count += 1; // one count per order, whatever the quantity
      }
      if (idx === s.lastIdx) s.lines.push(line); // the lines of the most recent order only
    });
  });

  return [...stats.values()]
    .filter((s) => s.count >= MIN_REPEATS)
    .sort((a, b) => b.count - a.count || a.lastIdx - b.lastIdx);
}

// Re-check one saved line against the current menu item. Returns the cart payload, or why it cannot be added.
function rebuildLine(menuItem: any, line: any) {
  const saved = Array.isArray(line?.customizations) ? line.customizations : [];
  const groups = Array.isArray(menuItem.optionGroups) ? menuItem.optionGroups : [];
  const selected: { [groupId: string]: string[] } = {};
  const skipped: string[] = [];

  saved.forEach((c: any) => {
    const group = groups.find((g: any) => g.id === c.groupId);
    const option = group && (group.options || []).find((o: any) => o.id === c.optionId && o.active !== false);
    if (!group || group.isActive === false || !option) {
      skipped.push(c.optionName || c.optionId || 'an option');
      return;
    }
    (selected[group.id] = selected[group.id] || []).push(option.id);
  });

  const snapshots: any[] = [];
  const summaryParts: string[] = [];
  let extraCharge = 0;

  for (const group of groups) {
    if (group.isActive === false) continue;
    // A conditional group counts only when one of its parent options is selected.
    if (group.parentOptionIds && group.parentOptionIds.length > 0) {
      const triggered = group.parentOptionIds.some((parentId: string) =>
        Object.values(selected).some((list: any) => list.includes(parentId))
      );
      if (!triggered) continue;
    }

    let picks = selected[group.id] || [];
    const maxAllowed = group.type === 'single' ? 1 : (group.maxSelections || Infinity);
    const minReq = Math.min(
      group.required ? Math.max(1, group.minSelections || 0) : (group.minSelections || 0),
      maxAllowed
    );
    // A required choice that no longer matches: the customer must choose it again on the menu.
    if (picks.length < minReq) return { ok: false, reason: `"${group.name}" needs a new choice` };
    if (picks.length > maxAllowed) picks = picks.slice(0, maxAllowed);

    (group.options || [])
      .filter((o: any) => picks.includes(o.id))
      .forEach((o: any) => {
        const price = Number(o.price || 0);
        extraCharge += price;
        snapshots.push({ groupId: group.id, groupName: group.name, optionId: o.id, optionName: o.name, additionalPrice: price });
        summaryParts.push(price > 0 ? `${o.name} (+₱${price})` : o.name);
      });
  }

  return { ok: true, snapshots, summary: summaryParts.join(', '), extraCharge, skipped, qty: lineQty(line) };
}

export function TheUsual({
  orderHistory,
  currentUser,
  onReviewOrder,
}: {
  orderHistory: any[];
  currentUser?: any;
  onReviewOrder?: () => void;
}) {
  const { add } = useCart();
  const isGuest = isGuestUser(currentUser);
  const [menuById, setMenuById] = useState<{ [id: string]: any } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string; added?: boolean } | null>(null);

  // Load the menu once (public read) so we know the usual still exists and is available.
  useEffect(() => {
    if (isGuest) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('menu_items').select('*');
        if (error || !data || cancelled) return;
        const map: { [id: string]: any } = {};
        data.forEach((m: any) => { map[String(m.id)] = mapMenuRow(m); });
        setMenuById(map);
      } catch (e) {
        console.error('The usual: menu load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [isGuest]);

  // The usual = best-ranked item that is still on the menu, available, and not an add-on extra.
  const usual = useMemo(() => {
    if (isGuest || !menuById) return null;
    const candidates = findCandidates(orderHistory);
    const pick = candidates.find((c) => {
      const m = menuById[c.id];
      return m && m.isAvailable !== false && !m.isExtra;
    });
    return pick ? { ...pick, menuItem: menuById[pick.id] } : null;
  }, [orderHistory, menuById, isGuest]);

  // A different usual (or a new order) clears the old message.
  useEffect(() => { setNote(null); }, [usual?.id, usual?.count]);

  if (!usual) return null;

  const { menuItem } = usual;
  const photo = menuItem.image || menuImages[menuItem.id];

  const handleOrderAgain = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      // Fresh read at click time: price, availability and options may have changed since the page loaded.
      const { data, error } = await supabase.from('menu_items').select('*').eq('id', usual.id).maybeSingle();
      if (error || !data) {
        setNote({ tone: 'error', text: 'We could not check the menu just now. Please try again in a moment.' });
        return;
      }
      const fresh = mapMenuRow(data);
      if (fresh.isAvailable === false) {
        setNote({ tone: 'error', text: `${fresh.name} is not available right now.` });
        return;
      }

      let addedLines = 0;
      const problems: string[] = [];
      const skippedOptions: string[] = [];
      usual.lines.forEach((line: any) => {
        const res: any = rebuildLine(fresh, line);
        if (!res.ok) { problems.push(res.reason); return; }
        add(fresh, res.qty, res.snapshots, res.extraCharge, res.summary);
        addedLines += 1;
        skippedOptions.push(...res.skipped);
      });

      if (addedLines === 0) {
        setNote({ tone: 'warn', text: `${fresh.name} has changed since your last order (${problems.join('; ')}). Please pick it from the menu below.` });
      } else if (skippedOptions.length > 0 || problems.length > 0) {
        const parts = [];
        if (skippedOptions.length > 0) parts.push(`no longer available: ${[...new Set(skippedOptions)].join(', ')}`);
        if (problems.length > 0) parts.push(`not added: ${problems.join('; ')}`);
        setNote({ tone: 'warn', added: true, text: `Added to your cart, but some things changed (${parts.join(' | ')}).` });
      } else {
        setNote({ tone: 'ok', added: true, text: 'Added to your cart. Same as last time!' });
      }
    } catch (e) {
      console.error('The usual: order again failed', e);
      setNote({ tone: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const noteColor =
    note?.tone === 'ok' ? 'text-lime-300' : note?.tone === 'warn' ? 'text-amber-300' : 'text-red-300';

  return (
    <section
      id="the-usual"
      className="veyns-fullscreen flex flex-col items-center justify-center px-4 py-10 text-center sm:px-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-lime-400">Your go-to</p>
      <h2 className="mt-2 font-display text-4xl font-extrabold text-[#F5F5F0] sm:text-6xl">The usual?</h2>
      <p className="mt-3 max-w-md text-sm text-emerald-200/80">
        You have ordered {menuItem.name} in {usual.count} of your orders. We are not judging, we are just ready.
      </p>

      <div className="mt-8 flex w-full max-w-3xl flex-col items-center gap-6 sm:flex-row sm:justify-center">
        {/* Cards: one per line of the last order that had this item (scrolls sideways if there are several). */}
        <div className="flex w-full max-w-full gap-4 overflow-x-auto pb-2 sm:w-auto sm:max-w-[26rem]">
          {usual.lines.map((line: any, i: number) => (
            <div
              key={i}
              className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-emerald-800/70 bg-[#0d2e26] text-left"
            >
              {photo ? (
                <img src={photo} alt={menuItem.name} width={512} height={512} className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-[#071F19] font-display text-sm font-bold text-[#d4af37]">
                  VEYNS
                </div>
              )}
              <div className="space-y-1 p-4">
                <p className="font-display text-base font-bold text-[#F5F5F0]">
                  {lineQty(line)} × {menuItem.name}
                </p>
                {line.customizationsSummary ? (
                  <p className="font-mono text-[11px] text-lime-300">↳ {line.customizationsSummary}</p>
                ) : null}
                <p className="text-[11px] text-emerald-300/80">From {formatPeso(menuItem.price)}, at today's menu price</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleOrderAgain}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-lime-400 px-7 py-3 text-sm font-extrabold uppercase tracking-wide text-black shadow-lg transition hover:bg-lime-300 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {busy ? 'Adding...' : 'Order again'}
          </button>
          {note?.added && onReviewOrder ? (
            <button
              type="button"
              onClick={onReviewOrder}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-300 underline underline-offset-4 hover:text-lime-200"
            >
              <Check className="h-3.5 w-3.5" /> Review my order
            </button>
          ) : null}
        </div>
      </div>

      {note ? (
        <p role="status" className={`mt-5 max-w-md text-xs ${noteColor}`}>
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
