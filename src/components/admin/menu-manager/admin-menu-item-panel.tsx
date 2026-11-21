// @ts-nocheck
// VEYNS Admin: the Add / Edit menu item panel of the Menu Manager (Step B7).
// It replaces the pop-up (admin-menu-item-dialog.tsx): the same fields, the same photo upload and the same option-group builder,
// shown at the right of the screen like "Edit Transaction" in the Ledger. All values and handlers stay in admin-menu-manager-tab.tsx
// and arrive as props with the same names the dialog used; the only new ones are itemAvailable / setItemAvailable and fit.
import React, { useState } from 'react';
import { Trash2, Layers, ChevronUp, ChevronDown, X, Upload } from 'lucide-react';
import { AdminMenuImage } from '@/components/admin/menu-manager/admin-menu-image';

const inp = 'w-full rounded-xl bg-black/30 px-3 py-2 text-xs font-semibold text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';
const smallInp = 'w-full rounded-lg bg-black/30 px-2 py-1.5 text-xs font-semibold text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';
const lbl = 'mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-400';
const iconBtn = 'rounded-md bg-white/[0.08] p-1 text-zinc-300 hover:text-lime-400 disabled:opacity-30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400';

function Toggle({ checked, onChange, label, hint }: any) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/[0.06] px-3 py-2">
      <span className="min-w-0">
        <span className="block text-xs font-bold text-white">{label}</span>
        {hint && <span className="block text-[10px] text-zinc-400">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-white/[0.2] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-lime-400 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-lime-400" />
    </label>
  );
}

export function AdminMenuItemPanel({
  isAddingNewItem, setIsAddingNewItem, editingItem, handleSaveNewOrEditedItem,
  itemName, setItemName, itemCategory, setItemCategory,
  itemIsExtra, itemPrice, setItemPrice, itemDiscount,
  setItemDiscount, itemBestSeller, setItemBestSeller, itemOfferInPopup,
  setItemOfferInPopup, itemDescription, setItemDescription, imagePreviewUrl,
  setImagePreviewUrl, setItemImageFile, itemOptionGroups, handleAddOptionGroup,
  handleUpdateGroup, handleReorderGroup, handleDeleteGroup, handleAddOptionToGroup,
  handleUpdateOptionInGroup, handleReorderOptionInGroup, handleDeleteOptionFromGroup,
  itemAvailable, setItemAvailable, fit
}: any) {
  const [showGroups, setShowGroups] = useState(false);
  if (!isAddingNewItem) return null;
  const effective = (parseFloat(itemPrice) || 0) * (1 - (parseFloat(itemDiscount) || 0) / 100);
  return (
    <aside className={`flex flex-col rounded-2xl bg-white/[0.04] p-4 ${fit ? 'min-h-0 w-[380px] shrink-0' : ''}`} aria-label={editingItem ? 'Edit menu item' : 'Add new menu item'}>
      <div className="flex shrink-0 items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-extrabold text-white">{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
          <p className="truncate text-[11px] text-zinc-400">{editingItem ? editingItem.name : 'Upload a photo, set the price, description and options.'}</p>
        </div>
        <button type="button" aria-label="Close" onClick={() => setIsAddingNewItem(false)} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/[0.08] text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"><X className="h-4 w-4" /></button>
      </div>

      <form onSubmit={handleSaveNewOrEditedItem} className="flex min-h-0 flex-1 flex-col">
        <div className={`space-y-3 text-xs ${fit ? 'min-h-0 flex-1 overflow-y-auto pr-1' : ''}`}>
          {/* Photo */}
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#0d2e26]">
              <AdminMenuImage src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
            <label className="flex h-20 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.06] text-[11px] font-bold text-zinc-200 hover:bg-white/[0.12] focus-within:ring-2 focus-within:ring-lime-400">
              <Upload className="h-4 w-4 text-lime-400" /> Change photo
              <input type="file" accept="image/*" className="sr-only"
                onChange={(e) => { if (e.target.files && e.target.files[0]) { setItemImageFile(e.target.files[0]); setImagePreviewUrl(URL.createObjectURL(e.target.files[0])); } }} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Item name *</label>
              <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Pork Sisig" className={inp} />
            </div>
            <div>
              <label className={lbl}>Category *</label>
              <select disabled={itemIsExtra} value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={inp + ' [&>option]:bg-[#141817]'}>
                <option value="Rice Bowls">Rice Bowls</option>
                <option value="Noodle Bowls">Noodle Bowls</option>
                <option value="Sides">Sides</option>
                <option value="Apparel">Apparel</option>
                {itemIsExtra && <option value="Extras">Extras</option>}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Description</label>
            <textarea rows={2} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="Crispy pork sisig served over warm garlic rice..." className={inp + ' font-normal'} />
          </div>

          <div className="space-y-1.5">
            <Toggle checked={!!itemBestSeller} onChange={setItemBestSeller} label="Mark as Best Seller" hint="Shows a badge and puts the item first on the menu" />
            <Toggle checked={!!itemAvailable} onChange={setItemAvailable} label="Available" hint="Off = hidden from customers (the same as Hide)" />
            {!itemIsExtra ? (
              <Toggle checked={!!itemOfferInPopup} onChange={setItemOfferInPopup} label={'Also offer in "A little something extra?"'} hint="Stays on the main menu, not listed on the Extras page" />
            ) : (
              <p className="rounded-xl bg-white/[0.06] px-3 py-2 text-[10px] text-zinc-300">This is an Extra: it appears in the "A little something extra?" popup and on the Extras page, not on the main menu.</p>
            )}
          </div>

          {/* Pricing */}
          <div className="rounded-xl bg-white/[0.06] p-3">
            <p className="mb-2 font-display text-sm font-extrabold text-white">Pricing</p>
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <div>
                <label className={lbl}>Base price (₱) *</label>
                <input type="number" required value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="109" className={smallInp} />
              </div>
              <div>
                <label className={lbl}>Discount (% off)</label>
                <input type="number" value={itemDiscount} onChange={(e) => setItemDiscount(e.target.value)} placeholder="0" className={smallInp} />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Effective price</span>
              <span className="font-display text-lg font-extrabold text-lime-400">₱{effective.toFixed(2)}</span>
            </div>
          </div>

          {/* Customizations: the option-group builder */}
          <div className="rounded-xl bg-white/[0.06] p-3">
            <button type="button" onClick={() => setShowGroups((v) => !v)} aria-expanded={showGroups} className="flex w-full cursor-pointer items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 rounded-lg">
              <span className="flex items-center gap-1.5 font-display text-sm font-extrabold text-white"><Layers className="size-4 text-lime-400" /> Customizations ({itemOptionGroups.length} group{itemOptionGroups.length === 1 ? '' : 's'})</span>
              {showGroups ? <ChevronUp className="size-4 text-zinc-300" /> : <ChevronDown className="size-4 text-zinc-300" />}
            </button>
            {showGroups && (
              <div className="mt-3 space-y-3">
                <p className="text-[10px] text-zinc-400">Add-ons, prices, selection limits and the order of the groups.</p>
                {itemOptionGroups.length === 0 ? (
                  <p className="rounded-lg bg-black/30 p-3 text-center text-[11px] text-zinc-400">No option groups yet. Click "+ Add Option Group".</p>
                ) : (
                  itemOptionGroups.map((group, gIdx) => (
                    <div key={group.id} className="space-y-2 rounded-xl bg-black/30 p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-lime-400">#{gIdx + 1}</span>
                        <input type="text" placeholder="Group name (e.g. Add Egg)" value={group.name} onChange={(e) => handleUpdateGroup(group.id, 'name', e.target.value)} className={smallInp + ' flex-1'} />
                        <button type="button" aria-label="Move group up" onClick={() => handleReorderGroup(gIdx, 'up')} disabled={gIdx === 0} className={iconBtn}><ChevronUp className="size-3.5" /></button>
                        <button type="button" aria-label="Move group down" onClick={() => handleReorderGroup(gIdx, 'down')} disabled={gIdx === itemOptionGroups.length - 1} className={iconBtn}><ChevronDown className="size-3.5" /></button>
                        <button type="button" aria-label="Delete group" onClick={() => handleDeleteGroup(group.id)} className={iconBtn + ' text-red-300 hover:!text-red-200'}><Trash2 className="size-3.5" /></button>
                      </div>
                      <input type="text" placeholder="Optional group description" value={group.description || ''} onChange={(e) => handleUpdateGroup(group.id, 'description', e.target.value)} className={smallInp + ' font-normal'} />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={lbl}>Selection type</label>
                          <select value={group.type} onChange={(e) => handleUpdateGroup(group.id, 'type', e.target.value)} className={smallInp + ' [&>option]:bg-[#141817]'}>
                            <option value="single">Single-select</option>
                            <option value="multi">Multi-select</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Requirement</label>
                          <select value={group.required ? 'true' : 'false'} onChange={(e) => handleUpdateGroup(group.id, 'required', e.target.value === 'true')} className={smallInp + ' [&>option]:bg-[#141817]'}>
                            <option value="true">Required</option>
                            <option value="false">Optional</option>
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Min selections</label>
                          <input type="number" value={group.minSelections ?? 0} onChange={(e) => handleUpdateGroup(group.id, 'minSelections', parseInt(e.target.value) || 0)} className={smallInp} />
                        </div>
                        <div>
                          <label className={lbl}>Max selections</label>
                          <input type="number" value={group.maxSelections ?? 1} onChange={(e) => handleUpdateGroup(group.id, 'maxSelections', parseInt(e.target.value) || 1)} className={smallInp} />
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Options & extra price (₱)</span>
                          <button type="button" onClick={() => handleAddOptionToGroup(group.id)} className="cursor-pointer text-[10px] font-bold text-lime-400 underline hover:text-lime-300">+ Add option</button>
                        </div>
                        {group.options.map((opt: any, oIdx: number) => (
                          <div key={opt.id} className="flex items-center gap-1.5">
                            <input type="text" placeholder="Option name" value={opt.name} onChange={(e) => handleUpdateOptionInGroup(group.id, opt.id, 'name', e.target.value)} className={smallInp + ' flex-1'} />
                            <span className="text-[10px] text-zinc-400">+₱</span>
                            <input type="number" placeholder="0" value={opt.price} onChange={(e) => handleUpdateOptionInGroup(group.id, opt.id, 'price', parseFloat(e.target.value) || 0)} className={smallInp + ' w-16 text-lime-300'} />
                            <button type="button" aria-label="Move option up" onClick={() => handleReorderOptionInGroup(group.id, oIdx, 'up')} disabled={oIdx === 0} className={iconBtn}><ChevronUp className="size-3" /></button>
                            <button type="button" aria-label="Move option down" onClick={() => handleReorderOptionInGroup(group.id, oIdx, 'down')} disabled={oIdx === group.options.length - 1} className={iconBtn}><ChevronDown className="size-3" /></button>
                            <button type="button" aria-label="Delete option" onClick={() => handleDeleteOptionFromGroup(group.id, opt.id)} className={iconBtn + ' text-red-300 hover:!text-red-200'}><Trash2 className="size-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                <button type="button" onClick={handleAddOptionGroup} className="w-full cursor-pointer rounded-lg bg-lime-400/15 py-2 text-[11px] font-extrabold text-lime-300 hover:bg-lime-400 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">+ Add Option Group</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 pt-3">
          <button type="button" onClick={() => setIsAddingNewItem(false)} className="flex-1 cursor-pointer rounded-xl bg-white/[0.08] py-2.5 text-xs font-bold text-zinc-200 hover:bg-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400">Cancel</button>
          <button type="submit" className="flex-1 cursor-pointer rounded-xl bg-lime-400 py-2.5 text-xs font-extrabold text-black shadow-lg hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">{editingItem ? 'Save Changes' : 'Save to Database'}</button>
        </div>
      </form>
    </aside>
  );
}
