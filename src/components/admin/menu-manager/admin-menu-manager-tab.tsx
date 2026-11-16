// @ts-nocheck
// Step A6: Menu Manager tab (item list, Hide/Show, Delete) and all Add / Edit item state and handlers,
// moved unchanged from employee-dashboard.tsx. Only the imports, the props, the 'active' guard and the dialog call are new.
// The component stays mounted (like the Slot Capacity tab), so the form state survives tab switches exactly as before.
import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPeso } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { supabase } from '@/lib/supabase';
import { AdminMenuImage } from '@/components/admin/menu-manager/admin-menu-image';
import { AdminMenuItemDialog } from '@/components/admin/menu-manager/admin-menu-item-dialog';

export function AdminMenuManagerTab({ active, menuItems, fetchCloudData }: { active: boolean; menuItems: any[]; fetchCloudData: () => void }) {
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Rice Bowls');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDiscount, setItemDiscount] = useState('');
  const [itemBestSeller, setItemBestSeller] = useState(false);
  const [itemIsExtra, setItemIsExtra] = useState(false);
  const [itemOfferInPopup, setItemOfferInPopup] = useState(false);
  const [menuSection, setMenuSection] = useState<'main' | 'extras'>('main');
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  
  // Dynamic Option Groups State for Menu Manager
  const [itemOptionGroups, setItemOptionGroups] = useState<any[]>([]);
  const [previewSelections, setPreviewSelections] = useState<{ [groupId: string]: string[] }>({});

  // --- Upload menu photos to Supabase Storage ---
  const uploadImageToSupabase = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error('Storage upload error:', error);
      return null;
    }
  };

  // --- Create or update a menu item and its dynamic option groups ---
  const handleSaveNewOrEditedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice) return;

    let imageUrl = editingItem ? editingItem.image : '';
    if (itemImageFile) {
      const uploadedUrl = await uploadImageToSupabase(itemImageFile);
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    const itemId = editingItem ? editingItem.id : itemName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newItemData = {
      id: itemId,
      name: itemName.trim(),
      category: itemIsExtra ? 'Extras' : itemCategory,
      description: itemDescription.trim(),
      price: parseFloat(itemPrice),
      discount_percent: itemDiscount !== '' ? parseFloat(itemDiscount) : 0,
      is_available: editingItem ? editingItem.isAvailable : true,
      best_seller: itemBestSeller,
      sort_order: editingItem ? (editingItem.sortOrder || 100) : 100,
      image_url: imageUrl,
      option_groups: itemOptionGroups,
      is_extra: itemIsExtra,
      offer_in_popup: itemIsExtra ? true : itemOfferInPopup
    };

    try {
      const { error: saveError } = await supabase.from('menu_items').upsert(newItemData, { onConflict: 'id' });
      if (saveError) throw saveError;
      alert('Saved and synced!');
    } catch (err) {
      alert('Error saving to database: ' + (err?.message || 'unknown error'));
    }

    setEditingItem(null);
    setIsAddingNewItem(false);
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemDiscount('');
    setItemBestSeller(false);
    setItemImageFile(null);
    setItemIsExtra(false);
    setItemOfferInPopup(false);
    setImagePreviewUrl('');
    setItemOptionGroups([]);
    setPreviewSelections({});
    fetchCloudData();
  };

  // --- Open the Add / Edit form (main item or extra) ---
  const openAddItem = (asExtra: boolean) => {
    setItemName(''); setItemCategory(asExtra ? 'Extras' : 'Rice Bowls'); setItemDescription('');
    setItemPrice(''); setItemDiscount(''); setItemBestSeller(false); setItemImageFile(null);
    setImagePreviewUrl(''); setItemOptionGroups([]); setPreviewSelections({});
    setItemIsExtra(asExtra); setItemOfferInPopup(false);
    setEditingItem(null); setIsAddingNewItem(true);
  };
  const openEditItem = (item: any, displayImage: string) => {
    setEditingItem(item); setItemName(item.name); setItemCategory(item.category || 'Rice Bowls');
    setItemDescription(item.description || ''); setItemPrice(item.price.toString());
    setItemDiscount((item.discountPercent || 0).toString()); setItemBestSeller(item.bestSeller || false);
    setItemImageFile(null); setImagePreviewUrl(displayImage || '');
    setItemOptionGroups(item.optionGroups || []); setPreviewSelections({});
    setItemIsExtra(!!item.isExtra); setItemOfferInPopup(!!item.offerInPopup);
    setIsAddingNewItem(true);
  };

  // --- Show or hide a menu item ---
  const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id);
      fetchCloudData();
    } catch (e) {}
  };

  // --- Delete a menu item after confirmation ---
  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item from the database?')) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    fetchCloudData();
  };

  // Option Group Builder Handlers for Menu Manager
  const handleAddOptionGroup = () => {
    setItemOptionGroups(prev => [
      ...prev,
      {
        id: `group_${Date.now()}`,
        name: '',
        description: '',
        type: 'single', // 'single' | 'multi'
        required: true,
        minSelections: 0,
        maxSelections: 1,
        isActive: true,
        parentOptionIds: [],
        options: [
          { id: `opt_${Date.now()}_1`, name: '', price: 0, active: true }
        ]
      }
    ]);
  };

  // Keep option-group limits consistent: single = exactly 1 choice max, and min can never exceed max.
  const normalizeGroupLimits = (g: any) => {
    let max = Number(g.maxSelections);
    if (!(max >= 1)) max = 1;
    if (g.type === 'single') max = 1;
    let min = Math.max(0, Number(g.minSelections) || 0);
    if (min > max) min = max;
    return { ...g, minSelections: min, maxSelections: max };
  };

  const handleUpdateGroup = (groupId: string, field: string, value: any) => {
    setItemOptionGroups(prev => prev.map(g => g.id === groupId ? normalizeGroupLimits({ ...g, [field]: value }) : g));
  };

  const handleDeleteGroup = (groupId: string) => {
    setItemOptionGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleReorderGroup = (index: number, direction: 'up' | 'down') => {
    setItemOptionGroups(prev => {
      const newGroups = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newGroups.length) return prev;
      const temp = newGroups[index];
      newGroups[index] = newGroups[targetIndex];
      newGroups[targetIndex] = temp;
      return newGroups;
    });
  };

  const handleAddOptionToGroup = (groupId: string) => {
    setItemOptionGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: [
            ...g.options,
            { id: `opt_${Date.now()}_${Math.random()}`, name: '', price: 0, active: true }
          ]
        };
      }
      return g;
    }));
  };

  const handleUpdateOptionInGroup = (groupId: string, optId: string, field: string, value: any) => {
    setItemOptionGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.map((o: any) => o.id === optId ? { ...o, [field]: value } : o)
        };
      }
      return g;
    }));
  };

  const handleDeleteOptionFromGroup = (groupId: string, optId: string) => {
    setItemOptionGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: g.options.filter((o: any) => o.id !== optId)
        };
      }
      return g;
    }));
  };

  const handleReorderOptionInGroup = (groupId: string, optIndex: number, direction: 'up' | 'down') => {
    setItemOptionGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newOptions = [...g.options];
        const targetIndex = direction === 'up' ? optIndex - 1 : optIndex + 1;
        if (targetIndex < 0 || targetIndex >= newOptions.length) return g;
        const temp = newOptions[optIndex];
        newOptions[optIndex] = newOptions[targetIndex];
        newOptions[targetIndex] = temp;
        return { ...g, options: newOptions };
      }
      return g;
    }));
  };
  // --- Derived option dependencies and live customization preview pricing ---
  const allAvailableOptions = itemOptionGroups.flatMap(g =>
    (g.options || []).map((o: any) => ({
      groupId: g.id,
      groupName: g.name || 'Unnamed Group',
      optId: o.id,
      optName: o.name || 'Unnamed Option'
    }))
  );

  const basePreviewPrice = parseFloat(itemPrice) || 0;
  const previewAddonsTotal = itemOptionGroups.reduce((acc, group) => {
    const selectedOptIds = previewSelections[group.id] || [];
    const groupAddons = (group.options || [])
      .filter((o: any) => selectedOptIds.includes(o.id))
      .reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
    return acc + groupAddons;
  }, 0);
  return (
    <>
    {/* Menu item list and menu management actions */}
    {active && (
      <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
          <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Database Menu Manager (Live Sync)</h3>
          <Button onClick={() => openAddItem(menuSection === 'extras')} className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer flex items-center gap-2 shadow-lg">
            <Plus className="h-4 w-4" /> {menuSection === 'extras' ? 'Add New Extra' : 'Add New Menu Item'}
          </Button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMenuSection('main')} className={`px-4 py-2 rounded-full text-xs font-extrabold cursor-pointer ${menuSection === 'main' ? 'bg-lime-400 text-black' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>Main Menu ({menuItems.filter((i) => !i.isExtra).length})</button>
          <button onClick={() => setMenuSection('extras')} className={`px-4 py-2 rounded-full text-xs font-extrabold cursor-pointer ${menuSection === 'extras' ? 'bg-lime-400 text-black' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>Extras ({menuItems.filter((i) => i.isExtra).length})</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menuItems.filter((i) => (menuSection === 'extras' ? i.isExtra : !i.isExtra)).map((item) => {
            const discountPct = item.discountPercent || 0;
            const effectivePrice = discountPct > 0 ? item.price * (1 - discountPct / 100) : item.price;
            const isAvailable = item.isAvailable !== false;
            const displayImage = item.image || menuImages[item.id];
            return (
              <div key={item.id} className={`bg-[#061d16] border rounded-2xl p-4 flex flex-col justify-between transition-all ${isAvailable ? 'border-emerald-800/80' : 'border-red-900/60 opacity-60'}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-xl bg-[#08291f] overflow-hidden shrink-0 border border-emerald-800/50 flex items-center justify-center">
                        <AdminMenuImage src={displayImage} alt={item.name} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-display font-bold text-white text-sm">{item.name}</h4>
                          {item.bestSeller && <span className="bg-lime-400 text-black px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase">BEST SELLER</span>}
                        </div>
                        <span className="text-[10px] text-emerald-400/80 uppercase font-semibold">{item.category}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${isAvailable ? 'bg-lime-400/20 text-lime-400 border border-lime-400/40' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                      {isAvailable ? 'Available' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300/80 line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between bg-[#04140f] border border-emerald-900/80 rounded-xl p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-emerald-400/70 uppercase block font-bold">Base Price</span>
                      <span className="font-bold text-white">{formatPeso(item.price)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 uppercase block font-bold">Discount</span>
                      <span className="font-bold text-amber-400">{discountPct}% OFF</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-lime-400 uppercase block font-bold">Effective</span>
                      <span className="font-extrabold text-lime-400">{formatPeso(effectivePrice)}</span>
                    </div>
                  </div>
                  {item.optionGroups && item.optionGroups.length > 0 && (
                    <div className="bg-[#04140f] border border-emerald-900/60 rounded-xl p-2 text-[10px] text-emerald-300">
                      <span className="font-bold text-lime-400 block mb-0.5">Customizations ({item.optionGroups.length} groups):</span>
                      <p className="truncate font-mono">{item.optionGroups.map((g: any) => g.name).join(', ')}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-emerald-900/60 pt-3 mt-4">
                  <div className="flex gap-1.5">
                    <Button onClick={() => handleToggleAvailability(item.id, isAvailable)} size="sm" className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl cursor-pointer ${isAvailable ? 'bg-red-950/60 text-red-300 border border-red-800/60' : 'bg-emerald-950 text-lime-400 border border-emerald-800'}`}>
                      {isAvailable ? 'Hide' : 'Show'}
                    </Button>
                    <Button onClick={() => handleDeleteMenuItem(item.id)} size="sm" className="bg-red-950/40 hover:bg-red-900 text-red-400 border border-red-900/60 px-2.5 py-1.5 rounded-xl text-[11px] cursor-pointer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button onClick={() => openEditItem(item, displayImage)} size="sm" className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1">
                    <Edit2 className="h-3.5 w-3.5" /> Edit Item
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Add / Edit menu item dialog lives in admin-menu-item-dialog.tsx; it is open only while isAddingNewItem is true */}
    <AdminMenuItemDialog
      isAddingNewItem={isAddingNewItem}
      setIsAddingNewItem={setIsAddingNewItem}
      editingItem={editingItem}
      handleSaveNewOrEditedItem={handleSaveNewOrEditedItem}
      itemName={itemName}
      setItemName={setItemName}
      itemCategory={itemCategory}
      setItemCategory={setItemCategory}
      itemIsExtra={itemIsExtra}
      itemPrice={itemPrice}
      setItemPrice={setItemPrice}
      itemDiscount={itemDiscount}
      setItemDiscount={setItemDiscount}
      itemBestSeller={itemBestSeller}
      setItemBestSeller={setItemBestSeller}
      itemOfferInPopup={itemOfferInPopup}
      setItemOfferInPopup={setItemOfferInPopup}
      itemDescription={itemDescription}
      setItemDescription={setItemDescription}
      imagePreviewUrl={imagePreviewUrl}
      setImagePreviewUrl={setImagePreviewUrl}
      setItemImageFile={setItemImageFile}
      itemOptionGroups={itemOptionGroups}
      handleAddOptionGroup={handleAddOptionGroup}
      handleUpdateGroup={handleUpdateGroup}
      handleReorderGroup={handleReorderGroup}
      handleDeleteGroup={handleDeleteGroup}
      handleAddOptionToGroup={handleAddOptionToGroup}
      handleUpdateOptionInGroup={handleUpdateOptionInGroup}
      handleReorderOptionInGroup={handleReorderOptionInGroup}
      handleDeleteOptionFromGroup={handleDeleteOptionFromGroup}
    />
    </>
  );
}
