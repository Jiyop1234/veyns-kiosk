// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, Tag, DollarSign, ShoppingBag, BarChart2, Users, KeyRound, Eye, EyeOff, Award, CheckCircle2, AlertTriangle, XCircle, Clock, Upload, Star, Calendar, Search, Ticket, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MENU_GRID, formatPeso, getActivePromoCodes } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { supabase } from '@/lib/supabase';

// --- Menu image display helper: renders an image or the VEYNS fallback ---
function Photo({ src, alt, className }: { src?: string; alt: string; className: string }) {
  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#0d2e26] font-display text-sm font-bold text-[#d4af37]`}>
        VEYNS
      </div>
    );
  }
  return <img src={src} alt={alt} width={512} height={512} className={className} />;
}

// --- Main employee/admin dashboard component ---
export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<'sales' | 'menu' | 'promos' | 'customers' | 'slots'>('sales');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Rice Bowls');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDiscount, setItemDiscount] = useState('');
  const [itemBestSeller, setItemBestSeller] = useState(false);
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  
  // Dynamic Option Groups State for Menu Manager
  const [itemOptionGroups, setItemOptionGroups] = useState<any[]>([]);
  const [previewSelections, setPreviewSelections] = useState<{ [groupId: string]: string[] }>({});

  const [promos, setPromos] = useState<any[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'peso' | 'free'>('percentage');
  const [newPromoTargetType, setNewPromoTargetType] = useState<'subtotal' | 'delivery'>('subtotal');
  const newPromoEligibility = 'registered' as const;
  const [newVoucherVisibility, setNewVoucherVisibility] = useState<'public' | 'hidden'>('public');
  const [newVoucherExpiryVal, setNewVoucherExpiryVal] = useState('60');
  const [newVoucherExpiryUnit, setNewVoucherExpiryUnit] = useState<'minutes' | 'hours' | 'never'>('minutes');
  const [newVoucherUsageLimit, setNewVoucherUsageLimit] = useState('');

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [resetTargetUser, setResetTargetUser] = useState<any>(null);
  const [newTempPassword, setNewTempPassword] = useState('');
  
  // Customer Edit State
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustType, setEditCustType] = useState<'email' | 'phone'>('email');
  const [editCustValue, setEditCustValue] = useState('');

  const [slotCapacities, setSlotCapacities] = useState<any[]>([]);
  const [selectedSlotDate, setSelectedSlotDate] = useState(getManilaDateKey());
  const timeSlotsList = ['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'];

  const [stampTargetUser, setStampTargetUser] = useState<any>(null);
  const [customerStampsDetailed, setCustomerStampsDetailed] = useState<{ status: 'valid' | 'invalid' | 'to_clear' | 'empty'; date: string; penaltyReason?: string }[]>([]);
  const [selectedInfractionPreset, setSelectedInfractionPreset] = useState('Active Account');
  const infractionPresets = [
    { label:  "Active Account ", sixthReward:  "25% OFF ", ninthReward:  "50% OFF ", twelfthReward:  "FREE ", desc:  "Active Account: Normal standing. " },
    { label:  "Penalties Waived ", sixthReward:  "25% OFF ", ninthReward:  "50% OFF ", twelfthReward:  "FREE ", desc:  "Penalties Waived: All penalties cleared and notices removed. " },
    { label:  "No Violation till card clears ", sixthReward:  "25% OFF ", ninthReward:  "50% OFF ", twelfthReward:  "FREE ", desc:  "No Violation till card clears: Card successfully cleared without violations; reset back to start. " },
    { label:  "1st offense False Stamping (At/Near Milestones) ", sixthReward:  "Invalidated ", ninthReward:  "25% OFF ", twelfthReward:  "50% OFF ", desc:  "1st offense False Stamping (At/Near Milestones): 6th stamp reward invalidated; 9th reward drops to 25%; 12th reward drops to 50%. " },
    { label:  "1st offense Early False Stamping (Early Stage Padding) ", sixthReward:  "Invalidated ", ninthReward:  "25% OFF ", twelfthReward:  "50% OFF ", desc:  "1st offense Early False Stamping (Early Stage Padding): 6th stamp reward invalidated; 9th reward drops to 25%; 12th reward drops to 50%. " },
    { label:  "1st offense False Claims: ", sixthReward:  "Invalidated ", ninthReward:  "25% OFF ", twelfthReward:  "50% OFF ", desc:  "1st offense False Claims: 6th stamp reward invalidated; 9th reward drops to 25%; 12th reward drops to 50%. " },
    { label:  "2nd offense False Stamping (At/Near Milestones) ", sixthReward:  "Invalidated ", ninthReward:  "Invalidated ", twelfthReward:  "25% OFF ", desc:  "2nd offense False Stamping (At/Near Milestones): 6th and 9th rewards invalidated; 12th reward downgraded to 25% OFF. " },
    { label:  "2nd offense Early False Stamping (Early Stage Padding) ", sixthReward:  "Invalidated ", ninthReward:  "Invalidated ", twelfthReward:  "25% OFF ", desc:  "2nd offense Early False Stamping (Early Stage Padding): 6th and 9th rewards invalidated; 12th reward downgraded to 25% OFF. " },
    { label:  "2nd offense False Claims: ", sixthReward:  "Invalidated ", ninthReward:  "Invalidated ", twelfthReward:  "25% OFF ", desc:  "2nd offense False Claims: 6th and 9th rewards invalidated; 12th reward downgraded to 25% OFF. " },
    { label:  "Multiple Offense : Severe or repeated false stamps ", sixthReward:  "Invalidated ", ninthReward:  "Invalidated ", twelfthReward:  "Cancelled (No Promos Left) ", desc:  "Multiple Offense : Severe or repeated false stamps. All remaining loyalty rewards cancelled. " }
  ];

  // --- Initial cloud data load and Supabase Realtime subscriptions ---
  useEffect(() => {
    fetchCloudData();
    const orderChannel = supabase.channel('public:orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCloudData).subscribe();
    const menuChannel = supabase.channel('public:menu_items').on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchCloudData).subscribe();
    const slotsChannel = supabase.channel('public:slot_capacities').on('postgres_changes', { event: '*', schema: 'public', table: 'slot_capacities' }, fetchCloudData).subscribe();
    const promosChannel = supabase.channel('public:promos_dashboard').on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, fetchCloudData).subscribe();
    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(promosChannel);
    };
  }, []);

  // --- Load menu, orders, customer profiles, slot capacities, and promos from Supabase ---
  const fetchCloudData = async () => {
    try {
      const { data: cloudMenu } = await supabase.from('menu_items').select('*');
      if (cloudMenu && cloudMenu.length > 0) {
        const formattedMenu = cloudMenu.map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          description: m.description,
          price: Number(m.price),
          discountPercent: Number(m.discount_percent || 0),
          isAvailable: m.is_available,
          bestSeller: m.best_seller,
          sortOrder: Number(m.sort_order || 100),
          image: m.image_url,
          optionGroups: m.option_groups || []
        }));
        setMenuItems(formattedMenu);
        localStorage.setItem('veyns_manageable_menu', JSON.stringify(formattedMenu));
      } else {
        setMenuItems(MENU_GRID);
      }

      const { data: cloudOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (cloudOrders) {
        setOrders(cloudOrders.map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          accountNickname: o.account_nickname || 'Guest',
          slotDate: o.slot_date || '',
          slotTime: o.slot_time || '',
          bowlCount: Number(o.bowl_count || 0),
          name: o.customer_name,
          email: o.email || '',
          phone: o.phone || '',
          fulfillment: o.fulfillment || 'delivery',
          location: o.location || o.address || '',
          landmark: o.landmark || '',
          items: o.items || [],
          total: o.total || 0,
          date: new Date(o.created_at).toLocaleString(),
          promoCode: o.promo_code || '',
          orderType: o.order_type || 'today',
          scheduleInfo: o.schedule_info || 'Immediate / Today'
        })));
      }

      const { data: cloudProfiles } = await supabase.from('profiles').select('id,name,identifier,role,created_at,stamps_data,penalty_data,auth_user_id');
      if (cloudProfiles && cloudProfiles.length > 0) {
        const formattedProfiles = cloudProfiles.map((p: any) => {
          const identifierKey = (p.identifier || '').toLowerCase().trim();
          if (p.stamps_data) {
            localStorage.setItem(`veyns_detailed_stamps_${identifierKey}`, JSON.stringify(p.stamps_data));
            const validDates = p.stamps_data.filter((s: any) => s && s.status === 'valid').map((s: any) => s.date);
            localStorage.setItem(`veyns_stamps_${identifierKey}`, JSON.stringify(validDates));
          }
          if (p.penalty_data) {
            localStorage.setItem(`veyns_fair_play_penalty_${identifierKey}`, JSON.stringify(p.penalty_data));
          } else {
            localStorage.removeItem(`veyns_fair_play_penalty_${identifierKey}`);
          }
          return { id: p.id, name: p.name || 'Valued Regular', identifier: p.identifier, type: p.role || 'regular', stamps_data: p.stamps_data, penalty_data: p.penalty_data };
        });
        setCustomers(formattedProfiles);
      } else {
        setCustomers([
          { name: 'Admin Regular', identifier: 'admin', type: 'regular' },
          { name: 'Geoff Perez', identifier: 'geoff@gmail.com', type: 'regular' }
        ]);
      }

      const { data: cloudSlots } = await supabase.from('slot_capacities').select('*');
      if (cloudSlots) {
        setSlotCapacities(cloudSlots);
      }

      const { data: cloudPromos } = await supabase.from('promos').select('*');
      if (cloudPromos && cloudPromos.length > 0) {
        const formattedPromos = cloudPromos.map((p: any) => ({
          code: p.code,
          type: p.type,
          discountValue: Number(p.discount_value),
          target_type: p.target_type || 'subtotal',
          eligibility: p.eligibility || 'all',
          visibility: p.visibility,
          expiryDurationMs: Number(p.expiry_duration_ms),
          usageLimit: p.usage_limit ? Number(p.usage_limit) : null,
          usageCount: Number(p.usage_count || 0),
          createdAt: Number(p.created_at || Date.now()),
          expiryUnitText: Number(p.expiry_duration_ms) > 0 ? `${Number(p.expiry_duration_ms) / (60 * 1000)} minutes` : 'Never expires'
        }));
        setPromos(formattedPromos);
      } else {
        setPromos(getActivePromoCodes());
      }
    } catch (e) {
      console.error('Error fetching cloud data:', e);
      setMenuItems(MENU_GRID);
      setPromos(getActivePromoCodes());
    }
  };

  // --- Save configured capacity and booking status for a date/time slot ---
  const handleUpdateSlotCapacity = async (dateKey: string, slotTime: string, maxSlots: number, isManuallyFullyBooked: boolean) => {
    try {
      const existing = slotCapacities.find(s => s.date_key === dateKey && s.slot_time === slotTime);
      const bookedCount = existing ? existing.booked_count : 0;
      const bookedBowls = existing ? (existing.booked_bowls || 0) : 0;
      const payload = {
        date_key: dateKey,
        slot_time: slotTime,
        max_slots: maxSlots,
        booked_count: bookedCount,
        booked_bowls: bookedBowls,
        is_manually_fully_booked: isManuallyFullyBooked,
        is_fully_booked: isManuallyFullyBooked || bookedBowls >= maxSlots
      };
      const { error } = await supabase.from('slot_capacities').upsert(payload, { onConflict: 'date_key,slot_time' });
      if (error) throw error;
      alert(`Slot capacity updated successfully for ${slotTime} on ${dateKey}!`);
      fetchCloudData();
    } catch (e) {
      alert(e?.message || 'Error updating slot capacity.');
    }
  };

  const handleMoveOrder = async (orderId: string, targetDate: string, targetSlot: string) => {
    const { error } = await supabase.rpc('move_order_time_slot_admin', {
      p_order_id: orderId,
      p_target_date: targetDate,
      p_target_slot: targetSlot
    });
    if (error) {
      alert(error.message || 'Could not move this order.');
      return;
    }
    alert(`Order moved to ${targetSlot} on ${targetDate}.`);
    await fetchCloudData();
  };

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
      category: itemCategory,
      description: itemDescription.trim(),
      price: parseFloat(itemPrice),
      discount_percent: itemDiscount !== '' ? parseFloat(itemDiscount) : 0,
      is_available: editingItem ? editingItem.isAvailable : true,
      best_seller: itemBestSeller,
      sort_order: editingItem ? (editingItem.sortOrder || 100) : 100,
      image_url: imageUrl,
      option_groups: itemOptionGroups
    };

    try {
      await supabase.from('menu_items').upsert(newItemData, { onConflict: 'id' });
      alert('Menu item, photo & dynamic option groups successfully saved and synced!');
    } catch (err) {
      alert('Error saving menu item to database.');
    }

    setEditingItem(null);
    setIsAddingNewItem(false);
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemDiscount('');
    setItemBestSeller(false);
    setItemImageFile(null);
    setImagePreviewUrl('');
    setItemOptionGroups([]);
    setPreviewSelections({});
    fetchCloudData();
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
    try {
      await supabase.from('menu_items').delete().eq('id', id);
      fetchCloudData();
    } catch (e) {}
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

  const handleUpdateGroup = (groupId: string, field: string, value: any) => {
    setItemOptionGroups(prev => prev.map(g => g.id === groupId ? { ...g, [field]: value } : g));
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

  // --- Create a voucher/promo with scope, eligibility, visibility, expiry, and usage limit ---
  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || (newPromoType !== 'free' && !newPromoDiscount)) return;
    if (newPromoType === 'free' && newPromoTargetType !== 'delivery') { alert('Free delivery vouchers must use the Delivery Fee Only scope.'); return; }

    const expiryNum = parseFloat(newVoucherExpiryVal) || 60;
    let expiryMs = 0;
    let expiryUnitText = 'Never expires';
    if (newVoucherExpiryUnit === 'minutes') {
      expiryMs = expiryNum * 60 * 1000;
      expiryUnitText = `${expiryNum} minutes`;
    } else if (newVoucherExpiryUnit === 'hours') {
      expiryMs = expiryNum * 60 * 60 * 1000;
      expiryUnitText = `${expiryNum} hours`;
    } else {
      expiryMs = 0; 
      expiryUnitText = 'Never expires';
    }

    const usageLimitNum = newVoucherUsageLimit ? parseInt(newVoucherUsageLimit) : null;
    const cleanCode = newPromoCode.trim().toUpperCase();

    const newVoucherPayload = {
      code: cleanCode,
      type: newPromoType,
      discount_value: newPromoType === 'free' ? 0 : parseFloat(newPromoDiscount),
      target_type: newPromoTargetType, // FEATURE B: Scope
      eligibility: newPromoEligibility, // FEATURE C: Guest vs Registered
      visibility: newVoucherVisibility,
      expiry_duration_ms: expiryMs,
      usage_limit: usageLimitNum,
      usage_count: 0,
      created_at: Date.now()
    };

    try {
      const { error } = await supabase.from('promos').upsert([newVoucherPayload], { onConflict: 'code' });
      if (error) {
        alert("Failed to save promo to database: " + error.message);
        return;
      }
      alert(`Voucher / Promo "${cleanCode}" successfully created and synced to cloud!`);
      setNewPromoCode('');
      setNewPromoDiscount('');
      setNewVoucherUsageLimit('');
      fetchCloudData();
    } catch (err) {
      alert("Database connection error while creating voucher.");
    }
  };

  // --- Delete a voucher/promo ---
  const handleDeletePromo = async (code: string) => {
    if (!confirm(`Are you sure you want to delete promo ${code}?`)) return;
    try {
      await supabase.from('promos').delete().eq('code', code);
      fetchCloudData();
    } catch (e) {
      alert('Error deleting promo from database.');
    }
  };

  // Auth password resets are handled by Supabase recovery flows, never by dashboard password creation.

  // Staff can update a nickname. Contact identifiers remain controlled by the customer's verified Auth account.
  const handleSaveCustomerEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const newName = editCustName.trim();
    if (!newName) { alert('Nickname cannot be blank.'); return; }
    const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', editingCustomer.id);
    if (error) { alert('Error updating customer profile: ' + error.message); return; }
    alert('Customer nickname updated.');
    setEditingCustomer(null);
    fetchCloudData();
  };

  // --- Load a customer's loyalty stamps and penalty state into the stamp editor ---
  const openStampManager = (cust: any) => {
    setStampTargetUser(cust);
    try {
      const identifierKey = cust.identifier.toLowerCase().trim();
      const detailedSaved = localStorage.getItem(`veyns_detailed_stamps_${identifierKey}`);
      const penaltySaved = localStorage.getItem(`veyns_fair_play_penalty_${identifierKey}`);
      if (penaltySaved) {
         try {
           const parsedPenalty = JSON.parse(penaltySaved);
           if (parsedPenalty?.appliedPenalties?.length > 0) {
             setSelectedInfractionPreset(parsedPenalty.appliedPenalties[0]);
           } else {
             setSelectedInfractionPreset('Active Account');
           }
         } catch (e) {
           setSelectedInfractionPreset('Active Account');
         }
       } else {
         setSelectedInfractionPreset('Active Account');
       }
       if (detailedSaved) {
         setCustomerStampsDetailed(JSON.parse(detailedSaved));
       } else if (cust.stamps_data && Array.isArray(cust.stamps_data)) {
         setCustomerStampsDetailed(cust.stamps_data);
       } else {
         const userStamps = localStorage.getItem(`veyns_stamps_${identifierKey}`);
         const parsedStamps: string[] = userStamps ? JSON.parse(userStamps) : [];
         setCustomerStampsDetailed(Array.from({ length: 12 }).map((_, idx) => (parsedStamps[idx] ? { status: 'valid', date: parsedStamps[idx] } : { status: 'empty', date: '' })));
       }
     } catch (e) {
       setCustomerStampsDetailed(Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' })));
       setSelectedInfractionPreset('Active Account');
     }
  };

  // --- Save loyalty stamp statuses and applicable penalty/reward settings ---
  const handleSaveStamps = async () => {
    if (!stampTargetUser) return;
    try {
      const identifierKey = stampTargetUser.identifier.toLowerCase().trim();
      const isCleanPreset = ['Active Account', 'Penalties Waived', 'No Violation till card clears'].includes(selectedInfractionPreset);
      let slotsToSave = selectedInfractionPreset === 'No Violation till card clears' 
         ? Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' })) 
         : customerStampsDetailed;
       const matchedPreset = !isCleanPreset ? infractionPresets.find(p => p.label === selectedInfractionPreset) : null;
       const penaltyStatus = matchedPreset ? { sixthReward: matchedPreset.sixthReward, ninthReward: matchedPreset.ninthReward, twelfthReward: matchedPreset.twelfthReward, appliedPenalties: [matchedPreset.label] } : null;
       if (isCleanPreset) {
         slotsToSave = slotsToSave.map(s => (s.status === 'invalid' || s.status === 'to_clear' ? { status: 'empty', date: '' } : s));
       }
       localStorage.setItem(`veyns_detailed_stamps_${identifierKey}`, JSON.stringify(slotsToSave));
       if (penaltyStatus) {
         localStorage.setItem(`veyns_fair_play_penalty_${identifierKey}`, JSON.stringify(penaltyStatus));
       } else {
         localStorage.removeItem(`veyns_fair_play_penalty_${identifierKey}`);
       }
       const validStamps = slotsToSave.filter(s => s.status === 'valid').map(s => s.date);
       localStorage.setItem(`veyns_stamps_${identifierKey}`, JSON.stringify(validStamps));
       await supabase.from('profiles').update({ stamps_data: slotsToSave, penalty_data: penaltyStatus }).eq('identifier', identifierKey);
       window.dispatchEvent(new Event('storage'));
       alert(`Stamp card & penalties successfully synced for ${stampTargetUser.name}!`);
       fetchCloudData();
     } catch (e) {}
     setStampTargetUser(null);
  };

  // --- Return from the dashboard to the customer-facing store ---
  const handleExitStore = () => {
    if (onBackToStore) {
      onBackToStore();
    } else {
      try { localStorage.setItem('veyns_active_view', 'store'); } catch (e) {}
      window.location.reload();
    }
  };

  // --- Derived customer search results and sales metrics ---
  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.identifier.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const totalGrossSales = orders.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrdersCount = orders.length;
  const averageOrderValue = totalOrdersCount > 0 ? totalGrossSales / totalOrdersCount : 0;

  // --- Derived option dependencies and live customization preview pricing ---
  // Gather all options across groups for conditional parent dependency selection
  const allAvailableOptions = itemOptionGroups.flatMap(g =>
    (g.options || []).map((o: any) => ({
      groupId: g.id,
      groupName: g.name || 'Unnamed Group',
      optId: o.id,
      optName: o.name || 'Unnamed Option'
    }))
  );

  // Compute preview price
  const basePreviewPrice = parseFloat(itemPrice) || 0;
  const previewAddonsTotal = itemOptionGroups.reduce((acc, group) => {
    const selectedOptIds = previewSelections[group.id] || [];
    const groupAddons = (group.options || [])
      .filter((o: any) => selectedOptIds.includes(o.id))
      .reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0);
    return acc + groupAddons;
  }, 0);

  // --- Dashboard page layout and tabbed sections ---
  return (
    <div className="min-h-screen bg-[#020b08] text-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/65 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lime-400 font-extrabold text-xs uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-lime-400 animate-pulse"></span> Employee & Admin Portal
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
              Employee Control & Sales Dashboard
            </h1>
          </div>
          <Button
            type="button"
            onClick={handleExitStore}
            className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer self-start sm:self-auto z-50"
          >
            <ArrowLeft className="h-4 w-4" /> Exit to Store
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-emerald-900/60 pb-3">
          <button onClick={() => setActiveTab('sales')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'sales' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <BarChart2 className="h-4 w-4" /> Sales Analytics ({orders.length})
          </button>
          <button onClick={() => setActiveTab('slots')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'slots' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Clock className="h-4 w-4" /> Slot Capacity & Fully Booked
          </button>
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'customers' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Users className="h-4 w-4" /> Customer Accounts ({customers.length})
          </button>
          <button onClick={() => setActiveTab('menu')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'menu' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Tag className="h-4 w-4" /> Menu Manager ({menuItems.length})
          </button>
          <button onClick={() => setActiveTab('promos')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'promos' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Ticket className="h-4 w-4" /> Vouchers & Promos ({promos.length})
          </button>
        </div>

                {/* Sales analytics and order transaction log */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Gross Sales</span>
                <p className="text-3xl font-extrabold text-lime-400 font-display">{formatPeso(totalGrossSales)}</p>
              </div>
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Orders Placed</span>
                <p className="text-3xl font-extrabold text-white font-display">{totalOrdersCount} Orders</p>
              </div>
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Average Order Value</span>
                <p className="text-3xl font-extrabold text-amber-400 font-display">{formatPeso(averageOrderValue)}</p>
              </div>
            </div>
            <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-lime-400" />
                  <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Completed Order Transactions Log</h3>
                </div>

              </div>
              {orders.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <ShoppingBag className="h-12 w-12 text-emerald-700 mx-auto opacity-50" />
                  <p className="text-sm text-emerald-300/70 font-semibold">No sales transactions recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-emerald-100">
                    <thead className="bg-[#071F19] text-emerald-300 uppercase text-[10px] tracking-wider border-b border-emerald-800/60">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">Customer & Contact</th>
                        <th className="p-3">Fulfillment & Schedule</th>
                        <th className="p-3">Delivery Address & Landmark</th>
                        <th className="p-3">Items Summary</th>
                        <th className="p-3">Promo</th>
                        <th className="p-3">Total (₱)</th>
                        <th className="p-3 text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-950">
                      {orders.map((order, idx) => (
                        <tr key={idx} className="hover:bg-[#071F19]/50 transition-colors">
                          <td className="p-3 font-extrabold text-lime-400">{order.orderNumber}</td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase bg-emerald-900/60 text-lime-300 px-1.5 py-0.5 rounded font-extrabold">Account:</span>
                                <span className="font-bold text-white">{order.accountNickname}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase bg-[#07241c] text-emerald-300 px-1.5 py-0.5 rounded font-extrabold">Delivery:</span>
                                <span className="text-emerald-200">{order.name} ({order.phone || 'No phone'})</span>
                              </div>
                              <p className="text-[10px] text-emerald-400 pl-1">{order.email || 'No email provided'}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <span className="inline-block bg-[#082d22] text-lime-400 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase">
                                {order.fulfillment}
                              </span>
                              <p className="text-[10px] font-bold text-amber-300">
                                {order.orderType === 'reservation' ? '📅 Reservation' : '⚡ Order Today'}
                              </p>
                              <p className="text-[10px] text-emerald-300 font-medium">{order.scheduleInfo}</p>
                            </div>
                          </td>
                          <td className="p-3 text-emerald-200">
                            <p className="font-semibold text-white max-w-[200px] truncate">{order.location || 'No address specified'}</p>
                            <p className="text-[10px] text-emerald-400">Landmark: {order.landmark || 'None'}</p>
                          </td>
                          <td className="p-3 space-y-0.5 max-w-xs">
                            {order.items.map((it: any, i: number) => (
                              <div key={i} className="text-emerald-200">
                                {it.qty}x {it.item?.name || it.name}
                                {it.customizationsSummary && <span className="block text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</span>}
                              </div>
                            ))}
                          </td>
                          <td className="p-3 font-semibold text-amber-400">{order.promoCode || '—'}</td>
                          <td className="p-3 font-extrabold text-lime-400 text-sm">{formatPeso(order.total)}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => setSelectedInvoice(order)}
                              className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                            >
                              See Invoice
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

                {/* Scheduling slot capacity controls */}
        {activeTab === 'slots' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Manage Time Slot Capacities & Fully Booked Status</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-300">Select Date:</span>
                <input
                  type="date"
                  value={selectedSlotDate}
                  onChange={(e) => setSelectedSlotDate(e.target.value)}
                  className="bg-[#041913] border border-emerald-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-lime-400"
                />
              </div>
            </div>
            <p className="text-xs text-emerald-300">
              Configure the maximum number of bowls for each time window. Capacity updates live after every order and resets with each Manila calendar date.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeSlotsList.map((slotTime) => {
                const existing = slotCapacities.find(s => s.date_key === selectedSlotDate && s.slot_time === slotTime);
                const maxSlots = existing ? existing.max_slots : 20;
                const bookedCount = existing ? existing.booked_count : 0;
                const bookedBowls = existing ? (existing.booked_bowls || 0) : 0;
                const isFullyBooked = existing ? (existing.is_manually_fully_booked ?? existing.is_fully_booked) : false;
                const slotOrders = orders.filter(order => order.slotDate === selectedSlotDate && order.slotTime === slotTime);
                return (
                  <SlotCapacityCard
                    key={slotTime}
                    slotTime={slotTime}
                    dateKey={selectedSlotDate}
                    initialMax={maxSlots}
                    bookedCount={bookedCount}
                    bookedBowls={bookedBowls}
                    orders={slotOrders}
                    timeSlotsList={timeSlotsList}
                    initialFullyBooked={isFullyBooked}
                    onSave={handleUpdateSlotCapacity}
                    onMoveOrder={handleMoveOrder}
                  />
                );
              })}
            </div>
          </div>
        )}

                {/* Customer account search and management */}
        {activeTab === 'customers' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Registered Customer Accounts</h3>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/70" />
                <input
                  type="text"
                  placeholder="Search customer nickname..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-xl border border-emerald-800/80 bg-[#041913] pl-9 pr-4 py-2 text-xs text-white placeholder:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-lime-400"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-emerald-100">
                <thead className="bg-[#071F19] text-emerald-300 uppercase text-[10px] tracking-wider border-b border-emerald-800/60">
                  <tr>
                    <th className="p-3">Customer Nickname</th>
                    <th className="p-3">Gmail / Phone Identifier</th>
                    <th className="p-3">Account Type</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-950">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-emerald-400/70">
                        No customer accounts match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-[#071F19]/50 transition-colors">
                          <td className="p-3 font-bold text-white">{cust.name}</td>
                          <td className="p-3 text-lime-400 font-mono"><span>{cust.identifier}</span></td>
                          <td className="p-3">
                            <span className="inline-block bg-[#082d22] text-lime-400 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase">{cust.type || 'Regular'}</span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <Button 
                              onClick={() => {
                                setEditingCustomer(cust);
                                setEditCustName(cust.name || '');
                                const isPhone = cust.identifier.startsWith('+') || /^\d+$/.test(cust.identifier.replace(/\s+/g, ''));
                                setEditCustType(isPhone ? 'phone' : 'email');
                                setEditCustValue(cust.identifier || '');
                              }} 
                              size="sm" 
                              className="bg-[#062c21] hover:bg-emerald-800 text-lime-300 border border-emerald-700 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                            <Button onClick={() => openStampManager(cust)} size="sm" className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer">
                              <Award className="h-3.5 w-3.5 mr-1" /> Stamps
                            </Button>

                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

                {/* Menu item list and menu management actions */}
        {activeTab === 'menu' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Database Menu Manager (Live Sync)</h3>
              <Button onClick={() => { setItemName(''); setItemCategory('Rice Bowls'); setItemDescription(''); setItemPrice(''); setItemDiscount(''); setItemBestSeller(false); setItemImageFile(null); setImagePreviewUrl(''); setItemOptionGroups([]); setPreviewSelections({}); setEditingItem(null); setIsAddingNewItem(true); }} className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer flex items-center gap-2 shadow-lg">
                <Plus className="h-4 w-4" /> Add New Menu Item
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => {
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
                            <Photo src={displayImage} alt={item.name} className="h-full w-full object-cover" />
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
                      <Button onClick={() => { setEditingItem(item); setItemName(item.name); setItemCategory(item.category || 'Rice Bowls'); setItemDescription(item.description || ''); setItemPrice(item.price.toString()); setItemDiscount((item.discountPercent || 0).toString()); setItemBestSeller(item.bestSeller || false); setImagePreviewUrl(displayImage || ''); setItemOptionGroups(item.optionGroups || []); setPreviewSelections({}); setIsAddingNewItem(true); }} size="sm" className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1">
                        <Edit2 className="h-3.5 w-3.5" /> Edit Item
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VOUCHERS & PROMOS MANAGER TAB */}
        {activeTab === 'promos' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center gap-2 border-b border-emerald-900/60 pb-3">
              <Ticket className="h-5 w-5 text-lime-400" />
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Create Vouchers & Promo Codes Manager</h3>
            </div>
            <form onSubmit={handleAddPromo} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Voucher Code Name</label>
                <input type="text" placeholder="e.g. GEOGWAPO" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} required className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white uppercase placeholder:normal-case focus:outline-none focus:border-lime-400 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Type & Value</label>
                <div className="flex gap-1.5">
                  <select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value as any)} className="bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-lime-300 font-bold focus:outline-none">
                    <option value="peso">₱ OFF</option>
                    <option value="percentage">% OFF</option>
                    {newPromoTargetType === 'delivery' && <option value="free">FREE</option>}
                  </select>
                  {newPromoType === 'free' ? <div className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-emerald-300">Waives the delivery fee</div> : <input type="number" min="0" placeholder={newPromoType === 'peso' ? "e.g. 50" : "e.g. 10"} value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(e.target.value)} required className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Scope (Feature B)</label>
                <select value={newPromoTargetType} onChange={(e) => { const value = e.target.value as 'subtotal' | 'delivery'; setNewPromoTargetType(value); if (value !== 'delivery' && newPromoType === 'free') setNewPromoType('percentage'); }} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="subtotal">Food Subtotal Only</option>
                  <option value="delivery">Delivery Fee Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Customer Eligibility (Feature C)</label>
                <div className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold">Registered Customers Only</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Visibility in Checkout</label>
                <select value={newVoucherVisibility} onChange={(e) => setNewVoucherVisibility(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="public">Public (Visible in Vouchers List)</option>
                  <option value="hidden">Hidden (Via Events/Posts Only)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Expiry Time Type</label>
                <div className="flex gap-1.5">
                  {newVoucherExpiryUnit !== 'never' && (
                    <input type="number" value={newVoucherExpiryVal} onChange={(e) => setNewVoucherExpiryVal(e.target.value)} required className="w-20 bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                  )}
                  <select value={newVoucherExpiryUnit} onChange={(e) => setNewVoucherExpiryUnit(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-emerald-300 font-bold focus:outline-none">
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="never">Never Expires</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Input Usage Limit (Optional)</label>
                <input type="number" placeholder="e.g. 15 (Max inputs)" value={newVoucherUsageLimit} onChange={(e) => setNewVoucherUsageLimit(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg cursor-pointer">
                  <Plus className="h-4 w-4 mr-1" /> Create Voucher
                </Button>
              </div>
            </form>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Active Vouchers & Promos ({promos.length})</h4>
              {promos.length === 0 ? (
                <p className="text-xs text-emerald-400/60 py-6 text-center">No active vouchers or promo codes available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {promos.map((p, idx) => (
                    <div key={idx} className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-4 flex items-center justify-between text-xs shadow-md">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-lime-400 text-sm tracking-wide">{p.code}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${p.visibility === 'hidden' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'}`}>
                            {p.visibility || 'public'}
                          </span>
                        </div>
                        <p className="text-emerald-200 font-bold">
                          {p.type === 'free' ? 'FREE DELIVERY' : p.type === 'peso' ? formatPeso(p.discountValue) + ' OFF' : `${p.discountValue}% OFF`}
                        </p>
                        <p className="text-[10px] text-amber-300">⏱️ Expiry: {p.expiryUnitText || 'Never'}</p>
                        <p className="text-[10px] text-emerald-300">🔢 Usage: {p.usageCount || 0} / {p.usageLimit ? `${p.usageLimit} limit` : 'Unlimited'}</p>
                        <p className="text-[10px] text-lime-300"> Scope: {p.target_type === 'delivery' ? 'Delivery Fee' : 'Food Subtotal'}</p>
                        <p className="text-[10px] text-blue-300"> Eligibility: {p.eligibility === 'registered' ? 'Registered Only' : 'All Customers'}</p>
                      </div>
                      <button onClick={() => handleDeletePromo(p.code)} className="text-red-400 hover:text-red-300 p-2 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* See Invoice Modal */}
        <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
          {selectedInvoice && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
              <div id="printable-invoice" className="space-y-4">
                <div className="text-center border-b border-emerald-900/60 pb-3 space-y-1">
                  <DialogTitle className="font-display text-xl font-extrabold text-lime-400 uppercase">
                    VEYNS. Official Invoice
                  </DialogTitle>
                  <p className="text-xs text-emerald-300">Reference: <strong>{selectedInvoice.orderNumber}</strong></p>
                  <p className="text-[10px] text-emerald-400">{selectedInvoice.date}</p>
                </div>
                <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Customer & Contact Info:</p>
                  <p className="font-bold text-white text-sm">Account: {selectedInvoice.accountNickname}</p>
                  <p className="font-bold text-emerald-200">Delivery Name: {selectedInvoice.name}</p>
                  <p className="text-emerald-200">Phone: <strong>{selectedInvoice.phone || 'N/A'}</strong></p>
                  <p className="text-emerald-200">Email: <strong>{selectedInvoice.email || 'N/A'}</strong></p>
                </div>
                <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Fulfillment & Delivery:</p>
                  <p className="text-white uppercase font-bold">Method: {selectedInvoice.fulfillment}</p>
                  <p className="text-emerald-200">Address: <strong>{selectedInvoice.location || 'N/A'}</strong></p>
                  <p className="text-emerald-200">Landmark: <strong>{selectedInvoice.landmark || 'N/A'}</strong></p>
                </div>
                <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Order Schedule & Type:</p>
                  <p className="text-amber-300 uppercase font-bold">
                    {selectedInvoice.orderType === 'reservation' ? '📅 Reservation' : '⚡ Order Today'}
                  </p>
                  <p className="text-white font-medium">{selectedInvoice.scheduleInfo || 'Immediate / Today'}</p>
                </div>
                <div className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3 text-xs space-y-2">
                  <p className="font-bold text-lime-400 uppercase text-[10px] tracking-wider">Order Summary:</p>
                  <div className="space-y-1 border-b border-emerald-900/60 pb-2">
                    {selectedInvoice.items?.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-white">
                        <div>
                          <span>{it.qty}x {it.item?.name || it.name}</span>
                          {it.customizationsSummary && (
                            <p className="text-[10px] text-lime-300 font-mono pl-2">↳ {it.customizationsSummary}</p>
                          )}
                        </div>
                        <span className="font-bold text-lime-400">{formatPeso((it.item?.price || it.price || 0) * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                  {selectedInvoice.promoCode && (
                    <div className="flex justify-between text-amber-400 text-xs font-semibold">
                      <span>Promo Applied ({selectedInvoice.promoCode}):</span>
                      <span>Applied</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-white pt-1">
                    <span>Total Amount Due:</span>
                    <span className="text-lime-400 text-base">{formatPeso(selectedInvoice.total)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
                <Button
                  onClick={() => {
                    const printContent = document.getElementById('printable-invoice')?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContent) {
                      document.body.innerHTML = printContent;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload();
                    }
                  }}
                  className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs shadow-lg cursor-pointer"
                >
                  Print Invoice
                </Button>
                <Button
                  onClick={() => setSelectedInvoice(null)}
                  className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* EDIT CUSTOMER ACCOUNT MODAL */}
        <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
          {editingCustomer && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">
                  Edit Account: {editingCustomer.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Update the display nickname. Verified sign-in details are changed by the customer.
                </DialogDescription>
              </div>
              <form onSubmit={handleSaveCustomerEdits} className="space-y-4 my-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Customer Nickname</label>
                  <input
                    type="text"
                    required
                    value={editCustName}
                    onChange={(e) => setEditCustName(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400"
                  />
                </div>
                <div className="space-y-1"><span className="font-bold text-lime-400 uppercase tracking-wider block">Verified sign-in</span><p className="rounded-xl border border-emerald-800 p-3 font-mono text-emerald-200">{editingCustomer.identifier}</p><p className="text-[10px] text-emerald-400/80">Customers change their email or phone in account settings and verify it through Supabase Auth.</p></div>
                <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                  <Button
                    type="button"
                    onClick={() => setEditingCustomer(null)}
                    className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </DialogContent>
          )}
        </Dialog>

        {/* ADD / EDIT MENU ITEM MODAL WITH ENHANCED OPTION GROUP BUILDER */}
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
                  <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400">
                    <option value="Rice Bowls">Rice Bowls</option>
                    <option value="Noodle Bowls">Noodle Bowls</option>
                    <option value="Sides">Sides</option>
                    <option value="Apparel">Apparel</option>
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
              <div className="space-y-1.5">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Description</label>
                <textarea rows={2} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} placeholder="Crispy pork sisig served over warm garlic rice..." className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white focus:outline-none focus:border-lime-400" />
              </div>
              <div className="space-y-2">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Menu Item Photo Upload</label>
                <div className="flex items-center gap-3 bg-[#041913] border border-emerald-800/80 rounded-xl p-3">
                  <div className="h-12 w-12 rounded-lg bg-[#08291f] overflow-hidden shrink-0 border border-emerald-800/50 flex items-center justify-center">
                    <Photo src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
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
                    No custom option groups configured for this item yet. Click "+ Add Option Group" to add add-ons (e.g. Add Egg, Ramen Style, Egg Preparation).
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
                        {/* Optional Group Description */}
                        <div>
                          <input
                            type="text"
                            placeholder="Optional Group Description (e.g. Choose egg preparation method)"
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
                        {/* Conditional Visibility Trigger Rule */}
                        <div className="bg-[#061d16] border border-emerald-800/60 rounded-xl p-2.5 space-y-1">
                          <label className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                            Conditional Visibility Rule (Trigger Option)
                          </label>
                          <p className="text-[9px] text-emerald-300">
                            Only show this group if the customer selects a specific parent option (e.g. show "Egg Prep" only if "Add Egg" is selected).
                          </p>
                          <select
                            value={(group.parentOptionIds && group.parentOptionIds[0]) || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateGroup(group.id, 'parentOptionIds', val ? [val] : []);
                            }}
                            className="w-full bg-[#04140f] border border-emerald-800 rounded-lg p-1.5 text-xs text-lime-300 font-bold focus:outline-none"
                          >
                            <option value="">Always Visible (No Parent Dependency)</option>
                            {allAvailableOptions
                              .filter(o => o.groupId !== group.id)
                              .map(o => (
                                <option key={o.optId} value={o.optId}>
                                  Show when [{o.groupName}] → "{o.optName}" is selected
                                </option>
                              ))}
                          </select>
                        </div>
                        {/* Options List Inside Group */}
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
              {/* LIVE CUSTOMIZATION PREVIEW BOX */}
              {itemOptionGroups.length > 0 && (
                <div className="bg-[#041913] border border-lime-400/40 rounded-2xl p-4 space-y-3">
                  <span className="font-bold text-lime-400 text-xs uppercase tracking-wider block">
                    👁️ Customer Customization Interactive Preview
                  </span>
                  <div className="space-y-3 bg-[#061d16] rounded-xl p-3 border border-emerald-800/80">
                    {itemOptionGroups.map((group) => {
                      // Conditional check
                      if (group.parentOptionIds && group.parentOptionIds.length > 0) {
                        const isTriggered = group.parentOptionIds.some(parentId => 
                          Object.values(previewSelections).some(selList => selList.includes(parentId))
                        );
                        if (!isTriggered) return null;
                      }
                      const currentSelected = previewSelections[group.id] || [];
                      return (
                        <div key={group.id} className="space-y-1.5">
                          <label className="text-xs font-bold text-white block">
                            {group.name} {group.required && <span className="text-red-400">*</span>}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {(group.options || []).map((opt: any) => {
                              const isSelected = currentSelected.includes(opt.id);
                              return (
                                <button
                                  type="button"
                                  key={opt.id}
                                  onClick={() => {
                                    if (group.type === 'single') {
                                      setPreviewSelections(prev => ({ ...prev, [group.id]: [opt.id] }));
                                    } else {
                                      const existing = prev[group.id] || [];
                                      const next = isSelected ? existing.filter(id => id !== opt.id) : [...existing, opt.id];
                                      setPreviewSelections(prev => ({ ...prev, [group.id]: next }));
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${isSelected ? 'bg-lime-400 text-black border-lime-400' : 'bg-[#04140f] text-emerald-200 border-emerald-800 hover:border-lime-400/50'}`}
                                >
                                  {opt.name || 'Option'} {opt.price > 0 ? `(+₱${opt.price})` : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-emerald-900/60 flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-bold">Simulated Item Total:</span>
                      <span className="text-lime-400 font-extrabold text-sm">{formatPeso(basePreviewPrice + previewAddonsTotal)}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
                <Button type="button" onClick={() => setIsAddingNewItem(false)} className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-3 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button type="submit" className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-lg">Save to Database</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

                {/* Loyalty stamp and penalty management modal */}
        <Dialog open={!!stampTargetUser} onOpenChange={(open) => !open && setStampTargetUser(null)}>
          {stampTargetUser && (
            <DialogContent className="max-w-xl w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-xl font-extrabold text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-lime-400" /> Fair Play Stamp Manager: {stampTargetUser.name}
                </DialogTitle>
              </div>
              <div className="my-4 space-y-4 text-xs">
                <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block text-[11px]">📋 Select Status / Infraction Rule:</label>
                  <select value={selectedInfractionPreset} onChange={(e) => setSelectedInfractionPreset(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-3 text-xs text-white font-medium focus:outline-none focus:border-lime-400">
                    {infractionPresets.map((preset, pIdx) => <option key={pIdx} value={preset.label}>{preset.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const stampEntry = customerStampsDetailed[idx];
                    const status = stampEntry ? stampEntry.status : 'empty';
                    return (
                      <div key={idx} className={`relative aspect-square rounded-xl border flex flex-col items-center justify-between p-1.5 text-center transition-all ${status === 'valid' ? 'bg-[#082d22] border-lime-400 text-lime-400 shadow-md' : status === 'to_clear' ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md' : status === 'invalid' ? 'bg-red-950/90 border-red-500 text-red-300 shadow-md' : 'bg-[#041913] border-emerald-800/60 text-emerald-600'}`}>
                        <span className="text-[9px] font-mono opacity-80">#{idx + 1}</span>
                        <select value={status} onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...customerStampsDetailed];
                          const todayStr = new Date().toISOString().split('T')[0];
                          while (updated.length <= idx) updated.push({ status: 'empty', date: '' });
                          updated[idx] = val === 'valid' ? { status: 'valid', date: todayStr } : val === 'to_clear' ? { status: 'to_clear', date: todayStr, penaltyReason: 'To Be Cleared' } : val === 'invalid' ? { status: 'invalid', date: todayStr, penaltyReason: 'Invalidated' } : { status: 'empty', date: '' };
                          setCustomerStampsDetailed(updated);
                        }} className="w-full bg-black/80 border border-emerald-800 text-[10px] text-lime-300 rounded px-1 py-0.5 focus:outline-none cursor-pointer text-center font-bold">
                          <option value="empty">EMPTY</option>
                          <option value="valid">ADD</option>
                          <option value="to_clear">TO CLEAR</option>
                          <option value="invalid">INVALID</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setStampTargetUser(null)} className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button onClick={handleSaveStamps} className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg">Save & Sync Account Views</Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}

// --- Reusable editor card for an individual date/time slot's capacity ---
function SlotCapacityCard({ slotTime, dateKey, initialMax, bookedCount, bookedBowls, orders, timeSlotsList, initialFullyBooked, onSave, onMoveOrder }: any) {
  const [maxSlots, setMaxSlots] = useState(initialMax);
  const [isFullyBooked, setIsFullyBooked] = useState(initialFullyBooked);

  useEffect(() => {
    setMaxSlots(initialMax);
    setIsFullyBooked(initialFullyBooked);
  }, [initialMax, initialFullyBooked]);

  return (
    <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
        <span className="font-extrabold text-lime-400 text-sm flex items-center gap-1.5">
          <Clock className="size-4" /> {slotTime}
        </span>
        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${(isFullyBooked || bookedBowls >= maxSlots) ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'}`}>
          {(isFullyBooked || bookedBowls >= maxSlots) ? 'Fully Booked' : `${Math.max(0, maxSlots - bookedBowls)} Bowls Left`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-emerald-300 block mb-1">Bowl Capacity:</label>
          <input
            type="number"
            value={maxSlots}
            onChange={(e) => setMaxSlots(parseInt(e.target.value) || 0)}
            className="w-full bg-[#04140f] border border-emerald-800 rounded-lg p-2 text-white font-bold text-xs focus:outline-none focus:border-lime-400"
          />
        </div>
        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 p-2 rounded-lg bg-[#04140f] border border-emerald-800 cursor-pointer h-9">
            <input
              type="checkbox"
              checked={isFullyBooked}
              onChange={(e) => setIsFullyBooked(e.target.checked)}
              className="rounded border-emerald-700 text-red-500 focus:ring-red-400 bg-black/40 h-4 w-4"
            />
            <span className="font-bold text-red-400 text-[11px]">Mark Fully Booked</span>
          </label>
        </div>
      </div>
      <div className="flex justify-between items-center pt-1 text-[11px] text-emerald-300">
        <span>Booked Bowls: <strong>{bookedBowls}</strong> <span className="text-emerald-500">({bookedCount} orders)</span></span>
        <Button
          size="sm"
          onClick={() => onSave(dateKey, slotTime, maxSlots, isFullyBooked)}
          className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
        >
          Save Slot
        </Button>
      </div>
      <div className="border-t border-emerald-900/60 pt-2 space-y-2">
        <p className="text-[10px] uppercase font-extrabold tracking-wide text-emerald-300">Orders in this window ({orders.length})</p>
        {orders.length ? orders.map((order: any) => (
          <SlotOrderRow key={order.id} order={order} slotTime={slotTime} dateKey={dateKey} timeSlotsList={timeSlotsList} onMoveOrder={onMoveOrder} />
        )) : <p className="text-[11px] text-emerald-500">No orders assigned to this time window.</p>}
      </div>
    </div>
  );
}

function SlotOrderRow({ order, slotTime, dateKey, timeSlotsList, onMoveOrder }: any) {
  const destinations = timeSlotsList.filter((time: string) => time !== slotTime);
  const [targetSlot, setTargetSlot] = useState(destinations[0] || '');
  const itemSummary = (order.items || []).map((line: any) =>
    `${line.item?.name || line.name || 'Item'} × ${line.qty ?? line.quantity ?? 1}`
  ).join(', ');

  useEffect(() => {
    setTargetSlot(destinations[0] || '');
  }, [slotTime, dateKey]);

  return (
    <div className="rounded-lg border border-emerald-900 bg-[#041913] p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-extrabold text-lime-300">{order.orderNumber} · {order.name || order.accountNickname}</p>
          <p className="text-[10px] text-emerald-300">{[order.email, order.phone].filter(Boolean).join(' · ') || 'No contact recorded'}</p>
        </div>
        <span className="text-[10px] font-bold text-cyan-300">{order.bowlCount} bowls</span>
      </div>
      <p className="text-[10px] text-white/90 break-words">{itemSummary || 'Order details unavailable'}</p>
      <div className="flex gap-2">
        <select
          value={targetSlot}
          onChange={(event) => setTargetSlot(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-emerald-800 bg-[#061d16] px-2 py-1.5 text-[10px] text-white"
        >
          {destinations.map((time: string) => <option key={time} value={time}>{time}</option>)}
        </select>
        <Button
          size="sm"
          disabled={!targetSlot}
          onClick={() => onMoveOrder(order.id, dateKey, targetSlot)}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold text-[10px] px-2 py-1.5 rounded-md"
        >
          Move here
        </Button>
      </div>
    </div>
  );
}

const getManilaDateKey = (date: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

// --- Default export for the employee dashboard ---
export default EmployeeDashboard;