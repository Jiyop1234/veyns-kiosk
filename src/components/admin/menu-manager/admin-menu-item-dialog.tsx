// @ts-nocheck
// Step A6: Add / Edit menu item dialog (item form, photo upload, dynamic option groups builder), moved unchanged from employee-dashboard.tsx.
// The JSX is the original; the values and handlers it used from the dashboard now arrive as props with the same names.
import React from 'react';
import { Trash2, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AdminMenuImage } from '@/components/admin/menu-manager/admin-menu-image';

export function AdminMenuItemDialog({
  isAddingNewItem, setIsAddingNewItem, editingItem, handleSaveNewOrEditedItem,
  itemName, setItemName, itemCategory, setItemCategory,
  itemIsExtra, itemPrice, setItemPrice, itemDiscount,
  setItemDiscount, itemBestSeller, setItemBestSeller, itemOfferInPopup,
  setItemOfferInPopup, itemDescription, setItemDescription, imagePreviewUrl,
  setImagePreviewUrl, setItemImageFile, itemOptionGroups, handleAddOptionGroup,
  handleUpdateGroup, handleReorderGroup, handleDeleteGroup, handleAddOptionToGroup,
  handleUpdateOptionInGroup, handleReorderOptionInGroup, handleDeleteOptionFromGroup
}: any) {
  // ADD / EDIT MENU ITEM MODAL
  return (
    <Dialog open={isAddingNewItem} onOpenChange={(open) => !open && setIsAddingNewItem(false)}>
      <DialogContent className="max-w-3xl w-full bg-[#03120d] text-white border border-emerald-900/85 shadow-2xl p-6 rounded-3xl max-h-[95vh] overflow-y-auto">
        <div className="space-y-1 border-b border-emerald-900/60 pb-3">
          <DialogTitle className="font-display text-xl font-extrabold text-white">
            {editingItem ? `Edit Menu Item: ${editingItem.name}` : 'Add New Menu Item'}
          </DialogTitle>
          <DialogDescription className="text-xs text-emerald-300">Upload photo, configure pricing, description, and dynamic option groups.</DialogDescription>
        </div>
        <form onSubmit={handleSaveNewOrEditedItem} className="space-y-5 my-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-lime-400 uppercase tracking-wider block">Item Name</label>
              <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Pork Sisig Rice Bowl" className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400" />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-lime-400 uppercase tracking-wider block">Category</label>
              <select disabled={itemIsExtra} value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400">
                <option value="Rice Bowls">Rice Bowls</option>
                <option value="Noodle Bowls">Noodle Bowls</option>
                <option value="Sides">Sides</option>
                <option value="Apparel">Apparel</option>
                {itemIsExtra && <option value="Extras">Extras</option>}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-lime-400 uppercase tracking-wider block">Base Price (₱)</label>
              <input type="number" required value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="109" className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400" />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-amber-400 uppercase tracking-wider block">Discount (% OFF)</label>
              <input type="number" value={itemDiscount} onChange={(e) => setItemDiscount(e.target.value)} placeholder="0" className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-800/80 bg-[#041913] cursor-pointer hover:border-lime-400/60 transition-colors">
              <input type="checkbox" checked={itemBestSeller} onChange={(e) => setItemBestSeller(e.target.checked)} className="rounded border-emerald-700 text-lime-400 focus:ring-lime-400 bg-black/40 h-4 w-4" />
              <div>
                <span className="font-bold text-lime-400 uppercase tracking-wider text-xs block">Mark as Best Seller</span>
                <span className="text-[10px] text-emerald-300">Pins item with a badge and prioritizes it at the top of the menu</span>
              </div>
            </label>
          </div>
          {!itemIsExtra ? (
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-emerald-800/80 bg-[#041913] cursor-pointer hover:border-lime-400/60 transition-colors">
              <input type="checkbox" checked={itemOfferInPopup} onChange={(e) => setItemOfferInPopup(e.target.checked)} className="rounded border-emerald-700 text-lime-400 focus:ring-lime-400 bg-black/40 h-4 w-4" />
              <div>
                <span className="font-bold text-lime-400 uppercase tracking-wider text-xs block">Also offer in "A little something extra?"</span>
                <span className="text-[10px] text-emerald-300">Stays on the main menu and is NOT listed on the Extras page</span>
              </div>
            </label>
          ) : (
            <p className="text-[10px] text-emerald-300 bg-[#041913] border border-emerald-800/80 rounded-xl p-3">This is an Extra: it appears in the "A little something extra?" popup and on the Extras page, not on the main menu.</p>
          )}
          <div className="space-y-1.5">
            <label className="font-bold text-lime-400 uppercase tracking-wider block">Description</label>
            <textarea rows={2} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="Crispy pork sisig served over warm garlic rice..." className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white focus:outline-none focus:border-lime-400" />
          </div>
          <div className="space-y-2">
            <label className="font-bold text-lime-400 uppercase tracking-wider block">Menu Item Photo Upload</label>
            <div className="flex items-center gap-3 bg-[#041913] border border-emerald-800/80 rounded-xl p-3">
              <div className="h-12 w-12 rounded-lg bg-[#08291f] overflow-hidden shrink-0 border border-emerald-800/50 flex items-center justify-center">
                <AdminMenuImage src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 overflow-hidden">
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) { setItemImageFile(e.target.files[0]); setImagePreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-[10px] text-emerald-300 w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-extrabold file:bg-[#082d22] file:text-lime-400 hover:file:bg-lime-400 hover:file:text-black cursor-pointer" />
              </div>
            </div>
          </div>
          {/* ENHANCED DYNAMIC OPTION GROUPS BUILDER SECTION */}
          <div className="space-y-3 pt-3 border-t border-emerald-900/60">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display font-bold text-white text-sm flex items-center gap-1.5">
                  <Layers className="size-4 text-lime-400" /> Dynamic Option Groups, Add-ons & Dependencies
                </h4>
                <p className="text-[10px] text-emerald-300">Configure customizable add-ons, pricing, selection limits, conditional visibility triggers, and group reordering.</p>
              </div>
              <Button type="button" onClick={handleAddOptionGroup} size="sm" className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl cursor-pointer">
                + Add Option Group
              </Button>
            </div>
            {itemOptionGroups.length === 0 ? (
              <div className="bg-[#041913] border border-emerald-800/60 rounded-xl p-4 text-center text-emerald-400/70 text-[11px]">
                No custom option groups configured for this item yet. Click "+ Add Option Group" to add add-ons.
              </div>
            ) : (
              <div className="space-y-4">
                {itemOptionGroups.map((group, gIdx) => (
                  <div key={group.id} className="bg-[#041913] border border-emerald-800/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-900/60 pb-2.5">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lime-400 font-mono font-bold text-xs">#{gIdx + 1}</span>
                        <input
                          type="text"
                          placeholder="Group Name (e.g. Add Egg, Egg Preparation)"
                          value={group.name}
                          onChange={(e) => handleUpdateGroup(group.id, 'name', e.target.value)}
                          className="flex-1 bg-[#061d16] border border-emerald-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => handleReorderGroup(gIdx, 'up')} disabled={gIdx === 0} className="p-1 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 hover:text-lime-400 disabled:opacity-30 cursor-pointer">
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => handleReorderGroup(gIdx, 'down')} disabled={gIdx === itemOptionGroups.length - 1} className="p-1 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 hover:text-lime-400 disabled:opacity-30 cursor-pointer">
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteGroup(group.id)} className="text-red-400 hover:text-red-300 p-1.5 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer ml-1">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Optional Group Description"
                        value={group.description || ''}
                        onChange={(e) => handleUpdateGroup(group.id, 'description', e.target.value)}
                        className="w-full bg-[#061d16] border border-emerald-800/60 rounded-lg px-2.5 py-1 text-[11px] text-emerald-200 focus:outline-none focus:border-lime-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] text-emerald-300 block mb-1 uppercase font-bold">Selection Type</label>
                        <select
                          value={group.type}
                          onChange={(e) => handleUpdateGroup(group.id, 'type', e.target.value)}
                          className="w-full bg-[#061d16] border border-emerald-800 rounded-lg p-1.5 text-xs text-lime-300 font-bold focus:outline-none"
                        >
                          <option value="single">Single-Select (Radio)</option>
                          <option value="multi">Multi-Select (Checkbox)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-emerald-300 block mb-1 uppercase font-bold">Requirement</label>
                        <select
                          value={group.required ? 'true' : 'false'}
                          onChange={(e) => handleUpdateGroup(group.id, 'required', e.target.value === 'true')}
                          className="w-full bg-[#061d16] border border-emerald-800 rounded-lg p-1.5 text-xs text-lime-300 font-bold focus:outline-none"
                        >
                          <option value="true">Required Selection</option>
                          <option value="false">Optional</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-emerald-300 block mb-1 uppercase font-bold">Min Selections</label>
                        <input
                          type="number"
                          value={group.minSelections ?? 0}
                          onChange={(e) => handleUpdateGroup(group.id, 'minSelections', parseInt(e.target.value) || 0)}
                          className="w-full bg-[#061d16] border border-emerald-800 rounded-lg p-1.5 text-xs text-white font-bold focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-emerald-300 block mb-1 uppercase font-bold">Max Selections</label>
                        <input
                          type="number"
                          value={group.maxSelections ?? 1}
                          onChange={(e) => handleUpdateGroup(group.id, 'maxSelections', parseInt(e.target.value) || 1)}
                          className="w-full bg-[#061d16] border border-emerald-800 rounded-lg p-1.5 text-xs text-white font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-emerald-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-lime-400 uppercase tracking-wider">Options & Additional Prices (₱)</span>
                        <button type="button" onClick={() => handleAddOptionToGroup(group.id)} className="text-[10px] text-emerald-300 hover:text-lime-400 underline cursor-pointer">
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {group.options.map((opt: any, oIdx: number) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Option name (e.g. Hard-Boiled Egg)"
                              value={opt.name}
                              onChange={(e) => handleUpdateOptionInGroup(group.id, opt.id, 'name', e.target.value)}
                              className="flex-1 bg-[#061d16] border border-emerald-800 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-lime-400"
                            />
                            <div className="flex items-center gap-1 w-28">
                              <span className="text-[10px] text-emerald-400">+₱</span>
                              <input
                                type="number"
                                placeholder="0"
                                value={opt.price}
                                onChange={(e) => handleUpdateOptionInGroup(group.id, opt.id, 'price', parseFloat(e.target.value) || 0)}
                                className="w-full bg-[#061d16] border border-emerald-800 rounded-lg px-2 py-1 text-xs text-lime-300 font-bold focus:outline-none"
                              />
                            </div>
                            <button type="button" onClick={() => handleReorderOptionInGroup(group.id, oIdx, 'up')} disabled={oIdx === 0} className="p-1 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 hover:text-lime-400 disabled:opacity-30 cursor-pointer">
                              <ChevronUp className="size-3" />
                            </button>
                            <button type="button" onClick={() => handleReorderOptionInGroup(group.id, oIdx, 'down')} disabled={oIdx === group.options.length - 1} className="p-1 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 hover:text-lime-400 disabled:opacity-30 cursor-pointer">
                              <ChevronDown className="size-3" />
                            </button>
                            <button type="button" onClick={() => handleDeleteOptionFromGroup(group.id, opt.id)} className="text-red-400 hover:text-red-300 p-1 cursor-pointer">
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
            <Button type="button" onClick={() => setIsAddingNewItem(false)} className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-3 rounded-xl text-xs cursor-pointer">Cancel</Button>
            <Button type="submit" className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-lg">Save to Database</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
