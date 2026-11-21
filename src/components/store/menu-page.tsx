// @ts-nocheck
// MenuPage — the menu screen: search, category tabs, item cards, the customization modal and the upsell popup.
// Moved out of ordering-counter.tsx (Step 4). Look and behavior are unchanged.
// It loads the menu itself (Supabase only, kept live by Realtime) and talks to the cart through useCart().
// OrderingCounter only passes the account/loyalty/checkout hooks listed in the props below.
// Step 13: new layout. Heading, a pill category bar with a sliding neon highlight (category-tabs.tsx) next to the search,
// and a 4-column grid whose cards are revealed with a mask wipe (menu-page.css). Cart, customization and upsell logic are unchanged.
// Step 13A: Accessories tab always shown; the highlight stretches (front edge first); Extras is a normal category (no separate page);
// an empty category (Apparel, Accessories) shows a shining "Coming Soon" instead of a blank gap.
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, Minus, Plus, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CATEGORIES, formatPeso } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import { CategoryTabs } from '@/components/store/category-tabs';
import './menu-page.css';

// SECTION 2: Shared menu-image component with a branded fallback when no image is available.
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

export function MenuPage({
  resetKey,
  isGuest,
  loyaltyStatus,
  onOpenRegister,
  onOpenLoyalty,
  onOpenExtras,
  onReviewOrder
}: {
  resetKey?: number;
  isGuest: boolean;
  loyaltyStatus?: any;
  onOpenRegister?: () => void;
  onOpenLoyalty: () => void;
  onOpenExtras?: () => void;
  onReviewOrder: () => void;
}) {
  const { add, lines, setLineQty, remove } = useCart();
  const [category, setCategory] = useState('All items');
  const [search, setSearch] = useState('');
  const [currentMenuGrid, setCurrentMenuGrid] = useState<any[]>([]);
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);

  // Item customization and upsell state
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  // Dynamic Option Selections State for Customers
  const [selectedOptions, setSelectedOptions] = useState<{ [groupId: string]: string[] }>({});
  const [validationError, setValidationError] = useState('');
  const [showUpsell, setShowUpsell] = useState(false);
  const [addedItemName, setAddedItemName] = useState('');

  // Step 13: the card reveal replays whenever the category changes, and starts once the menu has scrolled into view.
  const [revealTick, setRevealTick] = useState(0);
  const [seen, setSeen] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const handleSelectCategory = (key: string) => {
    if (key === category) return;
    setCategory(key);
    setRevealTick((t) => t + 1);
  };


  // Initial menu load, live updates from Supabase Realtime, and storage-triggered refresh.
  useEffect(() => {
    loadMenuFromCloud();

    const menuChannel = supabase
      .channel('public_menu_items_counter_' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        loadMenuFromCloud();
      });
    menuChannel.subscribe();

    const handleStorageChange = () => {
      loadMenuFromCloud();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      supabase.removeChannel(menuChannel);
    };
  }, []);

  // "Reset menu" (logo click in the header) returns the menu to its starting state.
  useEffect(() => {
    if (resetKey !== undefined) {
      setCategory('All items');
      setSearch('');
      setSelected(null);
      setShowUpsell(false);
    }
  }, [resetKey]);


  // SECTION 7: Load the menu from Supabase and sort it. The database is the only source of the menu and its prices.
  // If it can't be reached, keep whatever is already on screen (never swap in an old copy with old prices);
  // when there is nothing on screen yet, a "Try again" message is shown instead.
  const loadMenuFromCloud = async () => {
    try {
      const { data: cloudMenu, error } = await supabase.from('menu_items').select('*');
      if (error || !cloudMenu) throw error || new Error('empty menu response');
      const mergedMenu = cloudMenu.map((m: any) => ({
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
        optionGroups: m.option_groups || []
      }));
      mergedMenu.sort((a, b) => {
        if (a.category === 'Apparel' && b.category !== 'Apparel') return 1;
        if (a.category !== 'Apparel' && b.category === 'Apparel') return -1;
        if (a.bestSeller && !b.bestSeller) return -1;
        if (!a.bestSeller && b.bestSeller) return 1;
        return (a.sortOrder || 100) - (b.sortOrder || 100);
      });
      setCurrentMenuGrid(mergedMenu);
      setMenuLoadFailed(false);
    } catch (e) {
      console.error('Error fetching cloud menu:', e);
      setMenuLoadFailed(true);
    }
  };
  const showMenuError = menuLoadFailed && currentMenuGrid.length === 0;

  // SECTION 16: Filter visible menu items by availability, category, and search text.
  const filtered = currentMenuGrid.filter((item) => {
    if (item.isAvailable === false) return false;
    // Step 13A: 'Extras' is a normal category now and shows the extra items; every other view still hides them.
    if (category === 'Extras') { if (!item.isExtra) return false; }
    else if (item.isExtra) return false;
    const matchCategory = category === 'All items' || category === 'Extras' || item.category === category;
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Items offered in "A little something extra?": extras + regular items flagged "offer in popup" (e.g. Fries)
  const popupItems = currentMenuGrid
    .filter((i) => i.isAvailable !== false && (i.isExtra || i.offerInPopup))
    .sort((a, b) => (a.sortOrder || 100) - (b.sortOrder || 100));

  // Step 13: the category bar (labels follow the new design). Step 13A: 'Extras' is a normal category that shows the extra items
  // (no separate page), and 'Accessories' is always in the bar, after Apparel. A category with no items shows "Coming Soon".
  const CATEGORY_LABELS: { [key: string]: string } = { 'All items': 'All Items', 'Rice Bowls': 'Rice Meals', 'Noodle Bowls': 'Noodles' };
  const tabs: any[] = [];
  CATEGORIES.forEach((cat: string) => {
    if (cat === 'Apparel') tabs.push({ key: 'Extras', label: 'Extras' });
    tabs.push({ key: cat, label: CATEGORY_LABELS[cat] || cat });
  });
  if (!CATEGORIES.includes('Accessories')) tabs.push({ key: 'Accessories', label: 'Accessories' });

  // Step 13A: how many items the chosen category has at all (ignoring the search), to tell "Coming Soon" from "no search match".
  const categoryItemCount = currentMenuGrid.filter(
    (i) => i.isAvailable !== false && (category === 'Extras' ? !!i.isExtra : !i.isExtra && i.category === category)
  ).length;
  const comingSoon = currentMenuGrid.length > 0 && category !== 'All items' && categoryItemCount === 0;
  const noMatches = !comingSoon && currentMenuGrid.length > 0 && filtered.length === 0;

  // SECTION 17: Menu customization logic, conditional option groups, pricing, and cart insertion.
  const handleOpenModal = (item) => {
    setSelected(item);
    setQty(1);
    setValidationError('');

    const initialSelections: { [groupId: string]: string[] } = {};
    if (item.optionGroups && Array.isArray(item.optionGroups)) {
      item.optionGroups.forEach((group: any) => {
        // Pre-select default option if specified, or first option if single-select required
        const defaultOpt = (group.options || []).find((o: any) => o.is_default || o.isDefault);
        if (defaultOpt) {
          initialSelections[group.id] = [defaultOpt.id];
        } else if (group.type === 'single' && group.required && group.options && group.options.length > 0) {
          initialSelections[group.id] = [group.options[0].id];
        } else {
          initialSelections[group.id] = [];
        }
      });
    }
    setSelectedOptions(initialSelections);
  };

  const getEffectiveItemPrice = (item) => {
    const base = item.price || 0;
    const discountPct = item.discountPercent || 0;
    if (discountPct > 0) {
      return base * (1 - discountPct / 100);
    }
    return base;
  };

  // Dynamic Customization Calculation & Dependency Rules Engine
  const calculateCustomizationTotal = () => {
    if (!selected || !selected.optionGroups) return 0;
    let totalAddons = 0;

    selected.optionGroups.forEach((group: any) => {
      // Conditional Visibility Check: group is visible ONLY if no parent required OR parent is currently selected
      if (group.parentOptionIds && group.parentOptionIds.length > 0) {
        const isTriggered = group.parentOptionIds.some((parentId: string) =>
          Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
        );
        if (!isTriggered) return; // Skip hidden group
      }

      const groupSelections = selectedOptions[group.id] || [];
      (group.options || []).forEach((opt: any) => {
        if (groupSelections.includes(opt.id)) {
          totalAddons += Number(opt.price || 0);
        }
      });
    });

    return totalAddons;
  };

  const calculateUnitPrice = () => {
    if (!selected) return 0;
    return getEffectiveItemPrice(selected) + calculateCustomizationTotal();
  };

  const buildCustomizationPayload = () => {
    if (!selected || !selected.optionGroups) return { snapshots: [], summary: '', extraCharge: 0 };
    const snapshots: any[] = [];
    const summaryParts: string[] = [];
    let extraCharge = 0;

    selected.optionGroups.forEach((group: any) => {
      // Evaluate visibility
      if (group.parentOptionIds && group.parentOptionIds.length > 0) {
        const isTriggered = group.parentOptionIds.some((parentId: string) =>
          Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
        );
        if (!isTriggered) return;
      }

      const groupSelections = selectedOptions[group.id] || [];
      const selectedOpts = (group.options || []).filter((opt: any) => groupSelections.includes(opt.id));

      if (selectedOpts.length > 0) {
        selectedOpts.forEach((opt: any) => {
          const optPrice = Number(opt.price || 0);
          extraCharge += optPrice;
          snapshots.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            additionalPrice: optPrice
          });
          summaryParts.push(optPrice > 0 ? `${opt.name} (+₱${optPrice})` : opt.name);
        });
      }
    });

    return {
      snapshots,
      summary: summaryParts.join(', '),
      extraCharge
    };
  };

  const handleAddCustomToCart = () => {
    if (!selected) return;
    setValidationError('');

    // Validate visible option groups against requirement & selection limits
    if (selected.optionGroups && selected.optionGroups.length > 0) {
      for (const group of selected.optionGroups) {
        if (group.parentOptionIds && group.parentOptionIds.length > 0) {
          const isTriggered = group.parentOptionIds.some((parentId: string) =>
            Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
          );
          if (!isTriggered) continue; // Skip hidden group validation
        }

        const selections = selectedOptions[group.id] || [];
        // never demand more picks than the group allows (a bad min > max setting must not block the order)
        const maxAllowed = group.type === 'single' ? 1 : (group.maxSelections || Infinity);
        const minReq = Math.min(group.required ? Math.max(1, group.minSelections || 0) : (group.minSelections || 0), maxAllowed);
        
        if (selections.length < minReq) {
          setValidationError(`Please make a selection for required group: "${group.name}".`);
          return;
        }

        if (group.maxSelections && selections.length > group.maxSelections) {
          setValidationError(`You can choose at most ${group.maxSelections} options for "${group.name}".`);
          return;
        }
      }
    }

    const { snapshots, summary, extraCharge } = buildCustomizationPayload();

    // Add to cart with full immutable customization snapshots and extra charges
    add(selected, qty, snapshots, extraCharge, summary);

    setAddedItemName(`${qty} × ${selected.name}${summary ? ` (${summary})` : ''}`);
    setSelected(null);
    // Step 13A: no "A little something extra?" popup after adding an extra itself.
    setShowUpsell(popupItems.length > 0 && !selected.isExtra);
  };

  // SECTION 18: Upsell quantity helpers and cart quantity updates.
  const getUpsellQty = (itemId) => {
    const line = Array.isArray(lines) ? lines.find((l: any) => l.item.id === itemId) : null;
    return line ? line.qty : 0;
  };

  const handleUpsellChange = (upsellItem, newQty) => {
    if (newQty <= 0) {
      remove(upsellItem.id);
    } else {
      const currentQty = getUpsellQty(upsellItem.id);
      if (currentQty === 0) {
        add(upsellItem, newQty);
      } else {
        setLineQty(upsellItem.id, newQty);
      }
    }
  };

  return (
    <>
      {/* Step 13: heading, revealed with a mask wipe when the menu scrolls into view. */}
      <div ref={headRef} data-inview={seen ? 'true' : 'false'} className="mb-8 text-center sm:mb-10">
        <h2
          className="veyns-reveal-x font-display text-3xl font-medium uppercase tracking-tight text-white sm:text-5xl"
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.dataset.done = '1'; }}
        >
          Exceptional flavors
        </h2>
        <p
          className="veyns-reveal-x mt-3 text-sm text-emerald-100/70"
          style={{ animationDelay: '150ms' }}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.dataset.done = '1'; }}
        >
          Rice and noodle bowls made fresh for every order.
        </p>
      </div>

      {/* SECTION 23: Menu search and category navigation (the account / loyalty buttons that used to sit here are now the Loyalty Card section on the landing page). */}
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CategoryTabs
          tabs={tabs}
          active={category}
          onSelect={handleSelectCategory}
        />

        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300/70" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-emerald-900/50 bg-[#071F19] py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
        </div>
      </div>

      {/* SECTION 24: Menu item cards and add-to-cart entry points. */}
      <div data-inview={seen ? 'true' : 'false'} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item, index) => {
          const effectivePrice = getEffectiveItemPrice(item);
          const hasDiscount = (item.discountPercent || 0) > 0;

          return (
            <div
              key={`${revealTick}-${item.id}`}
              onClick={() => handleOpenModal(item)}
              style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
              onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.dataset.done = '1'; }}
              className="veyns-reveal group cursor-pointer rounded-2xl border border-emerald-800/40 bg-[#051813] p-3 transition-all duration-200 hover:border-lime-400/60 hover:shadow-xl flex flex-col justify-between sm:p-4"
            >
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#071F19] mb-3 flex items-center justify-center sm:mb-4">
                  <Photo id={item.id} dbImage={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  
                  {item.bestSeller && (
                    <span className="absolute top-2 right-2 rounded-full bg-lime-400 text-black px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1 sm:top-2.5 sm:right-2.5 sm:px-3 sm:py-1 sm:text-[10px]">
                      <Star className="h-3 w-3 fill-black" /> BEST SELLER
                    </span>
                  )}

                  {hasDiscount && (
                    <span className="absolute top-2 left-2 rounded-full bg-amber-400 text-black px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-md sm:top-2.5 sm:left-2.5 sm:px-2.5 sm:py-1 sm:text-[10px]">
                      {item.discountPercent}% OFF
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                  <h3 className="font-display font-bold leading-tight text-white text-sm sm:text-base">{item.name}</h3>
                  <div className="whitespace-nowrap sm:text-right">
                    {hasDiscount ? (
                      <div className="flex flex-col sm:items-end">
                        <span className="font-bold text-lime-400 text-sm sm:text-base">{formatPeso(effectivePrice)}</span>
                        <span className="text-xs text-emerald-400/60 line-through">{formatPeso(item.price)}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-lime-400 text-sm sm:text-base">{formatPeso(item.price)}</span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-emerald-300/80 line-clamp-2 sm:text-xs">{item.description}</p>
              </div>

              <div className="mt-3 flex items-center justify-end border-t border-emerald-900/60 pt-3 sm:mt-4">
                <Button size="sm" className="rounded-full bg-lime-400 text-black font-bold hover:bg-lime-300 px-5">
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 13A: empty category (Apparel, Accessories): shining "Coming Soon", so the page never shows a blank gap. */}
      {comingSoon && (
        <div data-inview={seen ? 'true' : 'false'}>
          <div
            key={`soon-${revealTick}`}
            onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.dataset.done = '1'; }}
            className="veyns-reveal flex min-h-[40vh] items-center justify-center px-4 text-center"
          >
            <p className="veyns-coming-soon font-display text-4xl font-bold uppercase tracking-tight sm:text-6xl">Coming Soon</p>
          </div>
        </div>
      )}
      {showMenuError && (
        <div className="py-16 text-center">
          <p className="text-sm text-emerald-300/80">The menu could not be loaded. Please check your connection and try again.</p>
          <Button onClick={() => loadMenuFromCloud()} className="mt-4 rounded-full bg-lime-400 px-6 font-bold text-black hover:bg-lime-300">Try again</Button>
        </div>
      )}
      {noMatches && <p className="py-16 text-center text-sm text-emerald-300/70">No items match your search.</p>}

      {/* SECTION 27: Dynamic menu customization modal with option validation and price preview. */}
      {/* DYNAMIC MENU ITEM CUSTOMIZATION MODAL */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-md w-full bg-[#04140f] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <div className="text-left space-y-2">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-display text-2xl font-extrabold text-white">{selected.name}</DialogTitle>
                {selected.bestSeller && (
                  <span className="rounded-full bg-lime-400 text-black px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 fill-black" /> BEST SELLER
                  </span>
                )}
              </div>
              <DialogDescription className="text-xs text-emerald-200/95 leading-relaxed">{selected.description}</DialogDescription>
            </div>

            <div className="my-4 flex justify-center">
              <div className="relative aspect-square w-48 h-48 overflow-hidden rounded-2xl bg-[#061e17] border border-emerald-800/40 flex items-center justify-center">
                <Photo id={selected.id} dbImage={selected.image} alt={selected.name} className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Dynamic Option Groups Rendering */}
            {selected.optionGroups && selected.optionGroups.length > 0 && (
              <div className="space-y-4 my-2 border-t border-emerald-900/60 pt-3">
                {selected.optionGroups.map((group: any) => {
                  // Evaluate conditional dependency trigger rules
                  if (group.parentOptionIds && group.parentOptionIds.length > 0) {
                    const isTriggered = group.parentOptionIds.some((parentId: string) =>
                      Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
                    );
                    if (!isTriggered) return null; // Conditionally hide dependent group
                  }

                  const currentSelections = selectedOptions[group.id] || [];

                  return (
                    <div key={group.id} className="space-y-2 bg-[#061c16] border border-emerald-800/60 rounded-2xl p-3.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-lime-400 uppercase tracking-wider flex items-center gap-1">
                          {group.name} {group.required && <span className="text-red-400">*</span>}
                        </h4>
                        <span className="text-[9px] text-emerald-300 font-semibold">
                          {group.type === 'single' ? 'Pick 1' : group.maxSelections ? `Up to ${group.maxSelections}` : 'Multi-select'}
                        </span>
                      </div>

                      {group.description && (
                        <p className="text-[10px] text-emerald-300/80 mb-1">{group.description}</p>
                      )}

                      <div className="space-y-1.5">
                        {(group.options || []).map((opt: any) => {
                          const isSelected = currentSelections.includes(opt.id);
                          const addPrice = Number(opt.price || 0);

                          return (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={() => {
                                if (group.type === 'single') {
                                  setSelectedOptions((prev) => ({ ...prev, [group.id]: [opt.id] }));
                                } else {
                                  const existing = selectedOptions[group.id] || [];
                                  if (isSelected) {
                                    setSelectedOptions((prev) => ({
                                      ...prev,
                                      [group.id]: existing.filter((id) => id !== opt.id)
                                    }));
                                  } else {
                                    if (group.maxSelections && existing.length >= group.maxSelections) {
                                      alert(`Maximum ${group.maxSelections} options allowed for ${group.name}.`);
                                      return;
                                    }
                                    setSelectedOptions((prev) => ({
                                      ...prev,
                                      [group.id]: [...existing, opt.id]
                                    }));
                                  }
                                }
                              }}
                              className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#082d22] border-lime-400 text-lime-400 shadow-md'
                                  : 'bg-[#041913] border-emerald-800/60 text-emerald-200 hover:border-emerald-600'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-${group.type === 'single' ? 'full' : 'md'} border flex items-center justify-center ${isSelected ? 'border-lime-400 bg-lime-400 text-black' : 'border-emerald-700 bg-black/40'}`}>
                                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span>{opt.name}</span>
                              </div>
                              <span className="font-extrabold text-[11px] text-lime-400">
                                {addPrice > 0 ? `+${formatPeso(addPrice)}` : '₱0'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {validationError && (
              <p className="text-[11px] text-red-400 font-bold text-center bg-red-950/60 border border-red-800 rounded-xl p-2 my-2">
                ⚠️ {validationError}
              </p>
            )}

            <div className="flex items-center justify-between mt-4 border-t border-emerald-900/60 pt-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Total Price</span>
                <span className="text-xl font-extrabold text-white">
                  {formatPeso(calculateUnitPrice() * qty)}
                </span>
              </div>

              <div className="flex items-center gap-4 bg-[#07241c] border border-emerald-800/60 rounded-xl px-3 py-1.5">
                <button
                  onClick={() => {
                    if (qty <= 1) setSelected(null);
                    else setQty(qty - 1);
                  }}
                  className="text-emerald-300 hover:text-white cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-white w-4 text-center">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="text-emerald-300 hover:text-white cursor-pointer">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={handleAddCustomToCart}
                className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold px-5 py-2.5 text-xs rounded-xl transition-all shadow-lg cursor-pointer"
              >
                Add · {formatPeso(calculateUnitPrice() * qty)}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* SECTION 28: Post-add-to-cart upsell suggestions. */}
      <Dialog open={showUpsell} onOpenChange={setShowUpsell}>
        <DialogContent className="max-w-lg w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-5 rounded-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <div className="space-y-0.5 text-left border-b border-emerald-900/60 pb-3">
            <div className="flex items-center gap-1.5 text-lime-400 font-semibold text-[11px]">
              <Check className="h-3.5 w-3.5" />
              <span>{addedItemName} added</span>
            </div>
            <DialogTitle className="font-display text-xl font-extrabold text-white">
              A little something extra?
            </DialogTitle>
            <DialogDescription className="text-[11px] text-emerald-300/80">
              Add fries, extra rice, egg, katsu or sauce.
            </DialogDescription>
          </div>

          <div className="grid grid-cols-2 gap-2.5 my-4">
            {popupItems.map((item) => {
              const currentQty = getUpsellQty(item.id);

              return (
                <div
                  key={item.id}
                  className={`relative bg-[#061d16] border rounded-xl p-2.5 flex flex-col items-center justify-between text-center transition-all ${
                    currentQty > 0 ? 'border-lime-400/80 shadow-lg' : 'border-emerald-800/50 hover:border-lime-400/50'
                  }`}
                >
                  {currentQty > 0 && (
                    <span className="absolute top-2 right-2 bg-lime-400 text-black font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-md z-10">
                      {currentQty}x
                    </span>
                  )}

                  <div className="h-20 w-20 rounded-lg bg-[#08291f] overflow-hidden mb-2 flex items-center justify-center shrink-0">
                    <Photo id={item.id} dbImage={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-0.5 mb-2 w-full">
                    <h4 className="text-[11px] font-bold text-white line-clamp-1 leading-tight">{item.name}</h4>
                    <p className="text-[11px] font-extrabold text-lime-400">{formatPeso(item.price)}</p>
                  </div>

                  {currentQty === 0 ? (
                    <Button
                      onClick={() => handleUpsellChange(item, 1)}
                      size="sm"
                      className="w-full h-8 bg-[#082a20] hover:bg-lime-400 hover:text-black text-white border border-emerald-700/60 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  ) : (
                    <div className="w-full h-8 bg-[#041913] text-white border border-emerald-600/80 rounded-xl font-bold text-xs flex items-center justify-between px-2 shadow-inner">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpsellChange(item, currentQty - 1);
                        }}
                        className="p-1 text-emerald-300 hover:text-white hover:bg-emerald-800/40 rounded-md transition-colors cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-white font-extrabold text-xs">{currentQty}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpsellChange(item, currentQty + 1);
                        }}
                        className="p-1 text-emerald-300 hover:text-white hover:bg-emerald-800/40 rounded-md transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-2 border-t border-emerald-900/60">
            <Button
              onClick={() => { setShowUpsell(false); onReviewOrder(); }}
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              Review my order <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => setShowUpsell(false)}
              className="w-full text-center text-xs font-bold text-lime-400 hover:underline transition-colors py-1 cursor-pointer"
            >
              Continue browsing
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
