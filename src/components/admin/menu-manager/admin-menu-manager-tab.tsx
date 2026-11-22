// @ts-nocheck
// Step A6: Menu Manager tab (item list, Hide/Show, Delete) and all Add / Edit item state and handlers,
// moved unchanged from employee-dashboard.tsx. Only the imports, the props, the 'active' guard and the dialog call are new.
// The component stays mounted (like the Slot Capacity tab), so the form state survives tab switches exactly as before.
// Step B7: new look (stat cards, search / filters / sort, Bulk Select, item cards, Category Mix) and the Add / Edit form is now a side panel
// (admin-menu-item-panel.tsx) instead of a pop-up. The state and handlers below are the original ones; the changes are listed in the B7 record.
// Step P5-B: photos are shrunk in the browser (max 1000 px, WebP) before upload and refused if still over 1 MB; an upload that fails now stops the save
// with a message; the old picture file is deleted from the menu-images bucket when it is replaced or when its item is deleted (only if no other item uses it).
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { menuImages } from '@/lib/menu-images';
import { supabase } from '@/lib/supabase';
import { AdminMenuItemPanel } from '@/components/admin/menu-manager/admin-menu-item-panel';
import { AdminMenuStatCards } from '@/components/admin/menu-manager/admin-menu-stat-cards';
import { AdminMenuCard } from '@/components/admin/menu-manager/admin-menu-card';
import { AdminMenuCategoryMix } from '@/components/admin/menu-manager/admin-menu-category-mix';
import { buildMenuSales } from '@/components/admin/menu-manager/admin-menu-sales';

// --- Step P5-B: photo rules and helpers (outside the component, so they hold no screen state) ---
const MENU_BUCKET = 'menu-images';
const PHOTO_MAX_SIDE = 1000; // longest side in pixels after shrinking
const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024; // a chosen photo larger than this is refused before it is opened
const PHOTO_MAX_OUTPUT_BYTES = 1024 * 1024; // a photo still larger than this after shrinking is refused
const PHOTO_QUALITIES = [0.8, 0.65, 0.5]; // tried in this order until the photo fits

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Shrinks a chosen photo to at most 1000 px on its long side and saves it as WebP (JPEG if this browser cannot write WebP).
async function shrinkMenuPhoto(file: File): Promise<{ blob: Blob; ext: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG, PNG or WebP).');
  if (file.size > PHOTO_MAX_INPUT_BYTES) throw new Error('This photo is larger than 25 MB. Please choose a smaller one.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This photo could not be read. Please use a JPG, PNG or WebP file.'));
      el.src = objectUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('This photo could not be read. Please use a JPG, PNG or WebP file.');
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare the photo.');
    ctx.drawImage(img, 0, 0, width, height);

    let type = 'image/webp';
    let blob = await canvasToBlob(canvas, type, PHOTO_QUALITIES[0]);
    if (!blob || blob.type !== 'image/webp') {
      // This browser cannot write WebP: use JPEG, with a white background behind any see-through area.
      type = 'image/jpeg';
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, type, PHOTO_QUALITIES[0]);
    }
    for (let i = 1; blob && blob.size > PHOTO_MAX_OUTPUT_BYTES && i < PHOTO_QUALITIES.length; i++) {
      blob = await canvasToBlob(canvas, type, PHOTO_QUALITIES[i]);
    }
    if (!blob) throw new Error('The photo could not be shrunk.');
    if (blob.size > PHOTO_MAX_OUTPUT_BYTES) throw new Error('This photo is still larger than 1 MB after shrinking. Please choose a simpler photo.');
    return { blob, ext: type === 'image/webp' ? 'webp' : 'jpg' };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Gives the file name inside the menu-images bucket for one of OUR picture links.
// Anything else (the bundled /assets/ pictures, other sites, odd names) gives '', so it is never deleted.
function menuBucketPathFromUrl(url: any): string {
  if (typeof url !== 'string') return '';
  const marker = `/storage/v1/object/public/${MENU_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return '';
  const raw = url.slice(at + marker.length).split('?')[0].split('#')[0];
  let path = '';
  try { path = decodeURIComponent(raw); } catch { return ''; }
  return /^[A-Za-z0-9_.-]+$/.test(path) && !path.startsWith('.') ? path : '';
}

// Removes a picture file from the bucket, but only if it is one of ours and no menu item still points at it.
// It never throws: a failed clean-up must not block saving or deleting an item.
async function removeMenuPhotoIfUnused(url: any) {
  try {
    const path = menuBucketPathFromUrl(url);
    if (!path) return;
    const { data: stillUsed, error: checkError } = await supabase.from('menu_items').select('id').like('image_url', `%/${MENU_BUCKET}/${path}%`).limit(1);
    if (checkError || (stillUsed && stillUsed.length > 0)) return;
    const { error: removeError } = await supabase.storage.from(MENU_BUCKET).remove([path]);
    if (removeError) console.warn('Could not remove the old menu photo:', removeError.message);
  } catch (e) {
    console.warn('Could not remove the old menu photo:', e);
  }
}

export function AdminMenuManagerTab({ active, menuItems, orders, fit = false, fetchCloudData }: { active: boolean; menuItems: any[]; orders?: any[]; fit?: boolean; fetchCloudData: () => void }) {
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
  // Step B7: the Available switch of the form (saved with the item), and the search / filter / sort / Bulk Select of the list
  const [itemAvailable, setItemAvailable] = useState(true);
  const [menuSearch, setMenuSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('custom');
  const [selecting, setSelecting] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  
  // Dynamic Option Groups State for Menu Manager
  const [itemOptionGroups, setItemOptionGroups] = useState<any[]>([]);
  const [previewSelections, setPreviewSelections] = useState<{ [groupId: string]: string[] }>({});
  const savingRef = useRef(false); // Step P5-B: ignores a second Save click while the first save (and its photo upload) is still running

  // --- Upload a menu photo to Supabase Storage (shrunk first, see shrinkMenuPhoto) ---
  const uploadImageToSupabase = async (file: File): Promise<{ url?: string; error?: string }> => {
    try {
      const { blob, ext } = await shrinkMenuPhoto(file);
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`;
      // Every upload gets a new file name, so the browser may keep the picture for a year (less repeat downloads).
      const { error: uploadError } = await supabase.storage.from(MENU_BUCKET).upload(fileName, blob, { contentType: blob.type, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(MENU_BUCKET).getPublicUrl(fileName);
      return { url: data.publicUrl };
    } catch (error: any) {
      console.error('Storage upload error:', error);
      return { error: error?.message || 'The photo could not be uploaded.' };
    }
  };

  // --- Create or update a menu item and its dynamic option groups ---
  const saveNewOrEditedItem = async () => {
    if (!itemName || !itemPrice) return;

    const oldImageUrl = editingItem ? editingItem.image : '';
    let imageUrl = oldImageUrl;
    let newImageUrl = '';
    if (itemImageFile) {
      const uploaded = await uploadImageToSupabase(itemImageFile);
      if (!uploaded.url) {
        // Step P5-B: before, a failed upload was ignored and the item was saved with its old picture. Now nothing is saved and the form stays open.
        alert('The photo was not uploaded, so nothing was saved: ' + (uploaded.error || 'unknown error'));
        return;
      }
      imageUrl = uploaded.url;
      newImageUrl = uploaded.url;
    }

    const itemId = editingItem ? editingItem.id : itemName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newItemData = {
      id: itemId,
      name: itemName.trim(),
      category: itemIsExtra ? 'Extras' : itemCategory,
      description: itemDescription.trim(),
      price: parseFloat(itemPrice),
      discount_percent: itemDiscount !== '' ? parseFloat(itemDiscount) : 0,
      is_available: itemAvailable,
      best_seller: itemBestSeller,
      sort_order: editingItem ? (editingItem.sortOrder || 100) : 100,
      image_url: imageUrl,
      option_groups: itemOptionGroups,
      is_extra: itemIsExtra,
      offer_in_popup: itemIsExtra ? true : itemOfferInPopup
    };

    let saved = false;
    try {
      const { error: saveError } = await supabase.from('menu_items').upsert(newItemData, { onConflict: 'id' });
      if (saveError) throw saveError;
      saved = true;
    } catch (err) {
      alert('Error saving to database: ' + (err?.message || 'unknown error'));
    }

    // Step P5-B: tidy the bucket. A new photo that was not saved is removed again; after a good save the replaced old photo is removed.
    // Both only happen when no menu item points at the file, and a failed clean-up never blocks the save.
    if (newImageUrl) {
      if (!saved) await removeMenuPhotoIfUnused(newImageUrl);
      else if (oldImageUrl && oldImageUrl !== newImageUrl) await removeMenuPhotoIfUnused(oldImageUrl);
    }
    if (saved) alert('Saved and synced!');

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
    setItemAvailable(true);
    setImagePreviewUrl('');
    setItemOptionGroups([]);
    setPreviewSelections({});
    fetchCloudData();
  };

  // Step P5-B: the form calls this one. It ignores a second click while a save is still running (a double click used to upload the photo twice).
  const handleSaveNewOrEditedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveNewOrEditedItem();
    } finally {
      savingRef.current = false;
    }
  };

  // --- Open the Add / Edit form (main item or extra) ---
  const openAddItem = (asExtra: boolean) => {
    setItemName(''); setItemCategory(asExtra ? 'Extras' : 'Rice Bowls'); setItemDescription('');
    setItemPrice(''); setItemDiscount(''); setItemBestSeller(false); setItemImageFile(null);
    setImagePreviewUrl(''); setItemOptionGroups([]); setPreviewSelections({});
    setItemIsExtra(asExtra); setItemOfferInPopup(false); setItemAvailable(true);
    setEditingItem(null); setIsAddingNewItem(true);
  };
  const openEditItem = (item: any, displayImage: string) => {
    setEditingItem(item); setItemName(item.name); setItemCategory(item.category || 'Rice Bowls');
    setItemDescription(item.description || ''); setItemPrice(item.price.toString());
    setItemDiscount((item.discountPercent || 0).toString()); setItemBestSeller(item.bestSeller || false);
    setItemImageFile(null); setImagePreviewUrl(displayImage || '');
    setItemOptionGroups(item.optionGroups || []); setPreviewSelections({});
    setItemIsExtra(!!item.isExtra); setItemOfferInPopup(!!item.offerInPopup); setItemAvailable(item.isAvailable !== false);
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
    const photoUrl = menuItems.find((m: any) => String(m.id) === String(id))?.image; // Step P5-B: remember its picture, to remove the file afterwards
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    fetchCloudData();
    await removeMenuPhotoIfUnused(photoUrl);
  };

  // --- Step B7: hide or show several items at once (Bulk Select). It writes the same column the Hide / Show button writes. ---
  const handleBulkAvailability = async (ids: string[], show: boolean) => {
    if (ids.length === 0) return;
    if (!confirm(`${show ? 'Show' : 'Hide'} ${ids.length} menu item${ids.length === 1 ? '' : 's'} ${show ? 'on' : 'from'} the customer menu?`)) return;
    const { error } = await supabase.from('menu_items').update({ is_available: show }).in('id', ids);
    if (error) { alert('Could not update the menu: ' + error.message); return; }
    setBulkIds([]);
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
  // --- Step B7: sales numbers, and the list after the tab, search, filters and sort ---
  const sales = useMemo(() => buildMenuSales(orders || [], menuItems), [orders, menuItems]);
  const sectionItems = menuItems.filter((i: any) => (menuSection === 'extras' ? i.isExtra : !i.isExtra));
  const mainCount = menuItems.filter((i: any) => !i.isExtra).length;
  const extrasCount = menuItems.length - mainCount;
  const categoryOptions = Array.from(new Set(sectionItems.map((i: any) => i.category).filter(Boolean))) as string[];
  const soldOf = (i: any) => sales.monthQty[String(i.id)] || 0;
  const q = menuSearch.trim().toLowerCase();
  const visibleItems = sectionItems
    .filter((i: any) => {
      if (catFilter !== 'all' && i.category !== catFilter) return false;
      if (statusFilter === 'available' && i.isAvailable === false) return false;
      if (statusFilter === 'hidden' && i.isAvailable !== false) return false;
      if (statusFilter === 'discount' && !(Number(i.discountPercent || 0) > 0)) return false;
      if (statusFilter === 'best' && !i.bestSeller) return false;
      if (statusFilter === 'custom' && !(Array.isArray(i.optionGroups) && i.optionGroups.length > 0)) return false;
      return !q || String(i.name || '').toLowerCase().includes(q) || String(i.description || '').toLowerCase().includes(q);
    })
    .sort((a: any, b: any) => {
      const eff = (m: any) => Number(m.price || 0) * (1 - Number(m.discountPercent || 0) / 100);
      if (sortBy === 'name') return String(a.name).localeCompare(String(b.name));
      if (sortBy === 'price-low') return eff(a) - eff(b);
      if (sortBy === 'price-high') return eff(b) - eff(a);
      if (sortBy === 'sold') return soldOf(b) - soldOf(a) || String(a.name).localeCompare(String(b.name));
      if (sortBy === 'discount') return Number(b.discountPercent || 0) - Number(a.discountPercent || 0);
      return Number(a.sortOrder || 100) - Number(b.sortOrder || 100) || String(a.name).localeCompare(String(b.name));
    });
  const toggleSelect = (id: string) => setBulkIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const pickSection = (section: 'main' | 'extras') => { setMenuSection(section); setCatFilter('all'); setBulkIds([]); };
  const selectCls = 'rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-zinc-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 [&>option]:bg-[#141817]';

  const panel = (
    <AdminMenuItemPanel
      fit={fit}
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
      itemAvailable={itemAvailable}
      setItemAvailable={setItemAvailable}
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
  );

  return (
    <>
    {/* Menu Manager screen: heading, stat cards, tabs with search / filters, item cards, Category Mix, and the Add / Edit panel */}
    {active && (
      <div className={fit ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-4'}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white">Database Menu Manager <span className="text-lime-400">(Live Sync)</span></h2>
            <p className="text-xs text-zinc-400">Manage your menu items, categories and pricing.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-zinc-300 md:flex"><span className="h-2 w-2 rounded-full bg-lime-400" /> Live sync on</span>
            <button type="button" onClick={() => openAddItem(menuSection === 'extras')} className="flex cursor-pointer items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-xs font-extrabold text-black shadow-lg hover:bg-lime-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Plus className="h-4 w-4" /> {menuSection === 'extras' ? 'Add New Extra' : 'Add New Menu Item'}
            </button>
          </div>
        </div>

        <AdminMenuStatCards menuItems={menuItems} sales={sales} />

        <div className={fit ? 'flex min-h-0 flex-1 gap-3' : 'space-y-4'}>
          {!fit && isAddingNewItem && panel}
          <div className={fit ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-3' : 'space-y-4'}>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button type="button" onClick={() => pickSection('main')} className={`cursor-pointer rounded-full px-4 py-2 text-xs font-extrabold ${menuSection === 'main' ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`}>Main Menu ({mainCount})</button>
              <button type="button" onClick={() => pickSection('extras')} className={`cursor-pointer rounded-full px-4 py-2 text-xs font-extrabold ${menuSection === 'extras' ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`}>Extras ({extrasCount})</button>
              <div className="relative ml-auto w-56 min-w-[10rem]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Search menu items…" className="w-full rounded-xl bg-white/[0.06] py-2 pl-8 pr-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" />
              </div>
              <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filter by category" className={selectCls}>
                <option value="all">All categories</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter items" className={selectCls}>
                <option value="all">All items</option>
                <option value="available">Available</option>
                <option value="hidden">Hidden</option>
                <option value="discount">On discount</option>
                <option value="best">Best sellers</option>
                <option value="custom">Customizable</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort items" className={selectCls}>
                <option value="custom">Sort: Custom order</option>
                <option value="name">Sort: Name A to Z</option>
                <option value="price-low">Sort: Price, low to high</option>
                <option value="price-high">Sort: Price, high to low</option>
                <option value="sold">Sort: Sold this month</option>
                <option value="discount">Sort: Biggest discount</option>
              </select>
              <button type="button" onClick={() => { setSelecting((v) => !v); setBulkIds([]); }} aria-pressed={selecting} className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${selecting ? 'bg-lime-400 text-black' : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'}`}>Bulk Select</button>
            </div>

            {selecting && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-lime-400/10 px-3 py-2 text-xs">
                <span className="font-bold text-lime-300">{bulkIds.length} selected</span>
                <button type="button" onClick={() => setBulkIds(visibleItems.map((i: any) => i.id))} className="cursor-pointer rounded-lg bg-white/[0.08] px-2.5 py-1 font-bold text-zinc-200 hover:bg-white/[0.16]">Select all shown ({visibleItems.length})</button>
                <button type="button" disabled={bulkIds.length === 0} onClick={() => handleBulkAvailability(bulkIds, false)} className="cursor-pointer rounded-lg bg-red-500/15 px-2.5 py-1 font-bold text-red-300 hover:bg-red-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-40">Hide selected</button>
                <button type="button" disabled={bulkIds.length === 0} onClick={() => handleBulkAvailability(bulkIds, true)} className="cursor-pointer rounded-lg bg-lime-400/15 px-2.5 py-1 font-bold text-lime-300 hover:bg-lime-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40">Show selected</button>
                <button type="button" onClick={() => { setSelecting(false); setBulkIds([]); }} className="ml-auto cursor-pointer rounded-lg bg-white/[0.08] px-2.5 py-1 font-bold text-zinc-200 hover:bg-white/[0.16]">Done</button>
              </div>
            )}

            <div className={fit ? 'min-h-0 flex-1 overflow-y-auto pr-1' : ''}>
              {visibleItems.length === 0 ? (
                <p className="py-10 text-center text-xs font-semibold text-zinc-400">{sectionItems.length === 0 ? 'No items in this section yet.' : 'No menu items match this search or filter.'}</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
                  {visibleItems.map((item: any) => {
                    const displayImage = item.image || menuImages[item.id];
                    return (
                      <AdminMenuCard
                        key={item.id}
                        item={item}
                        displayImage={displayImage}
                        sold={soldOf(item)}
                        selecting={selecting}
                        selected={bulkIds.includes(item.id)}
                        editing={isAddingNewItem && !!editingItem && editingItem.id === item.id}
                        onToggleSelect={toggleSelect}
                        onEdit={openEditItem}
                        onToggleAvailability={handleToggleAvailability}
                        onDelete={handleDeleteMenuItem}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <AdminMenuCategoryMix menuItems={menuItems} />
          </div>
          {fit && isAddingNewItem && panel}
        </div>
      </div>
    )}
    </>
  );
}
