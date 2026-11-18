// VEYNS Admin, Inventory: the Inventory screen (Step B12).
// Two layouts share the same panels:
// - fit (large screen, set by the dashboard): the page does not scroll. Heading, stat cards and Bowls Left Right Now on top; then
//   Pantry | Recipe Editor; then Auto Shopping List | Stock Ledger. Tables scroll inside their panels.
// - normal (smaller screens): the same panels stacked; the page scrolls.
// Data comes from useAdminInventoryData (sample data for now).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, RefreshCw, ShoppingCart } from 'lucide-react';
import { byIdMap, inventoryStats, shoppingCsv, shoppingList } from './admin-inventory-calc';
import { useAdminInventoryData } from './admin-inventory-data';
import { AdminInventoryBowls } from './admin-inventory-bowls';
import { AdminInventoryDialog } from './admin-inventory-dialog';
import type { InventoryDialogMode } from './admin-inventory-dialog';
import { AdminInventoryLedger } from './admin-inventory-ledger';
import { AdminInventoryPantry } from './admin-inventory-pantry';
import { AdminInventoryRecipe } from './admin-inventory-recipe';
import { AdminInventoryShopping } from './admin-inventory-shopping';
import { AdminInventoryStatCards } from './admin-inventory-stat-cards';

type Props = { active?: boolean; fit?: boolean };

export function AdminInventoryTab({ active = true, fit = false }: Props) {
  const { ingredients, dishes, ledger, restock, waste, updateIngredient, cook, updateRecipe, resetSample } = useAdminInventoryData();
  const [selectedDishId, setSelectedDishId] = useState<string>(dishes[0]?.id ?? '');
  const [rush, setRush] = useState(false);
  const [dialog, setDialog] = useState<{ mode: InventoryDialogMode; id: string | null } | null>(null);
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set());
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  const shoppingRef = useRef<HTMLElement>(null);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const stats = useMemo(() => inventoryStats(ingredients, dishes), [ingredients, dishes]);
  const shopping = useMemo(() => shoppingList(ingredients), [ingredients]);
  const selected = dishes.find((d) => d.id === selectedDishId) ?? dishes[0];

  const toggleChecked = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const restockChecked = () => {
    shopping.filter((it) => !unchecked.has(it.ingredient.id)).forEach((it) => restock(it.ingredient.id, it.qty));
  };

  const exportShopping = () => {
    const chosen = shopping.filter((it) => !unchecked.has(it.ingredient.id));
    const blob = new Blob([shoppingCsv(chosen)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veyns-shopping-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // The Shopping List button brings the panel into view and lights it for a moment (on the fit layout it is already on screen).
  const showShopping = () => {
    shoppingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1400);
  };

  const handleReset = () => {
    resetSample();
    setUnchecked(new Set());
    setRush(false);
  };

  const sampleIds = useMemo(() => byIdMap(ingredients), [ingredients]);
  const dialogOpen = dialog !== null && ingredients.length > 0 && (dialog.id === null || sampleIds.has(dialog.id));

  return (
    <div className={!active ? 'hidden' : fit ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4'}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="hidden md:block">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight text-white">
            <Package className="h-6 w-6 text-lime-400" aria-hidden="true" />
            Inventory
          </h1>
          <p className="text-xs text-zinc-400">Track ingredients, manage recipes, and know how many bowls you can cook right now.</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mx-auto w-fit max-w-full rounded-xl bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
            Sample data: this screen is not connected to the database yet. What you add or change here is not saved, and a reload brings the sample back.
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={showShopping} className="flex items-center gap-1.5 rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-extrabold text-amber-300 hover:bg-amber-400/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Shopping List ({shopping.length})
          </button>
          <button type="button" onClick={() => setDialog({ mode: 'restock', id: null })} className="rounded-xl bg-lime-400 px-3 py-2 text-xs font-extrabold text-black hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
            + Restock Items
          </button>
          <button type="button" onClick={handleReset} aria-label="Reset sample data" title="Reset sample data" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="shrink-0">
        <AdminInventoryStatCards stats={stats} />
      </div>

      <AdminInventoryBowls dishes={dishes} ingredients={ingredients} selectedId={selected ? selected.id : ''} onSelect={setSelectedDishId} rush={rush} onToggleRush={() => setRush((r) => !r)} onCook={cook} />

      <div className={fit ? 'grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-3' : 'grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'}>
        <div className="min-h-0 min-w-0">
          <AdminInventoryPantry ingredients={ingredients} fill={fit} onAdd={(id) => setDialog({ mode: 'restock', id })} onWaste={(id) => setDialog({ mode: 'waste', id })} onEdit={(id) => setDialog({ mode: 'edit', id })} />
        </div>
        <div className="min-h-0 min-w-0">
          {selected && (
            <AdminInventoryRecipe key={`${selected.id}:${selected.recipe.map((r) => r.qty).join('-')}`} dish={selected} ingredients={ingredients} fill={fit} onSave={updateRecipe} />
          )}
        </div>
      </div>

      <div className={fit ? 'grid h-44 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3' : 'grid gap-4 lg:grid-cols-2'}>
        <div className="min-h-0 min-w-0">
          <AdminInventoryShopping items={shopping} unchecked={unchecked} onToggle={toggleChecked} onRestock={restockChecked} onExport={exportShopping} flash={flash} sectionRef={shoppingRef} fill={fit} />
        </div>
        <div className="min-h-0 min-w-0">
          <AdminInventoryLedger entries={ledger} fill={fit} />
        </div>
      </div>

      {dialogOpen && dialog && (
        <AdminInventoryDialog
          key={`${dialog.mode}:${dialog.id ?? 'any'}`}
          mode={dialog.mode}
          ingredients={ingredients}
          ingredientId={dialog.id}
          onClose={() => setDialog(null)}
          onRestock={restock}
          onWaste={waste}
          onEdit={updateIngredient}
        />
      )}
    </div>
  );
}
