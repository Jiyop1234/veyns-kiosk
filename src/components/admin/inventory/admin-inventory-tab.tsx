// VEYNS Admin, Inventory: the Inventory screen (Steps B12, B12b, 6C-3).
// Two layouts share the same panels:
// - fit (large screen, set by the dashboard): the page does not scroll. Heading and stat cards on top; below them
//   Ingredient Stock (with a short list of recent stock movements under it) | Recipe costing. Tables scroll inside their panels.
// - normal (smaller screens): the same panels stacked; the page scrolls.
// Data comes from useAdminInventoryData: read from the database, written through the gateway.

import { useMemo, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { inventoryStats } from './admin-inventory-calc';
import { useAdminInventoryData } from './admin-inventory-data';
import { AdminInventoryDialog } from './admin-inventory-dialog';
import type { InventoryDialogState } from './admin-inventory-dialog';
import { AdminInventoryLedger } from './admin-inventory-ledger';
import { AdminInventoryPantry } from './admin-inventory-pantry';
import { AdminInventoryRecipe } from './admin-inventory-recipe';
import { AdminInventoryStatCards } from './admin-inventory-stat-cards';

type Props = { active?: boolean; fit?: boolean };

export function AdminInventoryTab({ active = true, fit = false }: Props) {
  const { ingredients, dishes, ledger, loading, loadError, reload, restock, waste, saveIngredient, cook, saveRecipe, addDish } = useAdminInventoryData();
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [dialog, setDialog] = useState<InventoryDialogState | null>(null);

  const stats = useMemo(() => inventoryStats(ingredients, dishes), [ingredients, dishes]);
  const selectedId = dishes.some((d) => d.id === selectedDishId) ? selectedDishId : dishes[0]?.id ?? '';

  const pantry = (
    <AdminInventoryPantry
      ingredients={ingredients}
      fill={fit}
      onAdd={(id) => setDialog({ mode: 'restock', id })}
      onWaste={(id) => setDialog({ mode: 'waste', id })}
      onEdit={(id) => setDialog({ mode: 'edit', id })}
      onNew={() => setDialog({ mode: 'new' })}
    />
  );
  const ledgerPanel = <AdminInventoryLedger entries={ledger} fill={fit} />;
  const recipe = (
    <AdminInventoryRecipe dishes={dishes} selectedId={selectedId} onSelect={setSelectedDishId} ingredients={ingredients} fill={fit} onSave={saveRecipe} onCook={cook} onAddDish={addDish} />
  );

  return (
    <div className={!active ? 'hidden' : fit ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-4'}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="hidden md:block">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold leading-tight text-white">
            <Package className="h-6 w-6 text-lime-400" aria-hidden="true" />
            Inventory
          </h1>
          <p className="text-xs text-zinc-400">Ingredient stock and recipe costing by batch, like your Excel sheet.</p>
        </div>

        <div className="min-w-0 flex-1">
          {loading && <p className="mx-auto w-fit max-w-full rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs text-zinc-300">Loading the inventory...</p>}
          {loadError && <p className="mx-auto w-fit max-w-full rounded-xl bg-red-400/10 px-3 py-1.5 text-xs text-red-300">{loadError}</p>}
        </div>

        <button type="button" onClick={() => void reload()} aria-label="Refresh inventory" title="Refresh from the database" className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="shrink-0">
        <AdminInventoryStatCards stats={stats} />
      </div>

      {fit ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] grid-rows-[minmax(0,1fr)] gap-3">
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="min-h-0 flex-1">{pantry}</div>
            <div className="h-36 shrink-0">{ledgerPanel}</div>
          </div>
          <div className="min-h-0 min-w-0">{recipe}</div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="min-w-0">{pantry}</div>
            <div className="min-w-0">{recipe}</div>
          </div>
          {ledgerPanel}
        </>
      )}

      {dialog && (
        <AdminInventoryDialog
          key={dialog.mode === 'new' ? 'new' : `${dialog.mode}:${dialog.id}`}
          state={dialog}
          ingredients={ingredients}
          onClose={() => setDialog(null)}
          onRestock={restock}
          onWaste={waste}
          onSave={saveIngredient}
        />
      )}
    </div>
  );
}
