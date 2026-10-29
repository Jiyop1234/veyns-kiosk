// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, Tag, DollarSign, ShoppingBag, BarChart2, Users, KeyRound, Eye, EyeOff, Award, CheckCircle2, AlertTriangle, XCircle, Clock, Upload, Star, Calendar, Search, Ticket, Layers, ChevronUp, ChevronDown, ArrowRightLeft } from 'lucide-react';
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
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'peso'>('percentage');
  const [newPromoTargetType, setNewPromoTargetType] = useState<'subtotal' | 'delivery'>('subtotal');
  const [newPromoEligibility, setNewPromoEligibility] = useState<'all' | 'registered'>('all');
  const [newVoucherVisibility, setNewVoucherVisibility] = useState<'public' | 'hidden'>('public');
  const [newVoucherExpiryVal, setNewVoucherExpiryVal] = useState('60');
  const [newVoucherExpiryUnit, setNewVoucherExpiryUnit] = useState<'minutes' | 'hours' | 'never'>('minutes');
  const [newVoucherUsageLimit, setNewVoucherUsageLimit] = useState('');

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Customer Edit State
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustType, setEditCustType] = useState<'email' | 'phone'>('email');
  const [editCustValue, setEditCustValue] = useState('');

  const [slotCapacities, setSlotCapacities] = useState<any[]>([]);
  const [selectedSlotDate, setSelectedSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const timeSlotsList = ['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'];

  // Slot Owner Inspector Modal State
  const [inspectingSlot, setInspectingSlot] = useState<{ slotTime: string; dateKey: string } | null>(null);
  const [slotReservationsList, setSlotReservationsList] = useState<any[]>([]);
  const [transferringReservation, setTransferringReservation] = useState<any>(null);
  const [transferTargetSlot, setTransferTargetSlot] = useState(timeSlotsList[0]);

  // --- Phase 4: Loyalty Manager state (replaces old Fair Play penalty system) ---
  const [loyaltyTargetUser, setLoyaltyTargetUser] = useState<any>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<any>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<any[]>([]);
  const [loyaltyStampDelta, setLoyaltyStampDelta] = useState(0);
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState<string>('B1');
  const [loyaltyTierReason, setLoyaltyTierReason] = useState('');
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);

  // --- Initial cloud data load and Supabase Realtime subscriptions ---
  useEffect(() => {
    fetchCloudData();
    const orderChannel = supabase.channel('public:orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCloudData).subscribe();
    const menuChannel = supabase.channel('public:menu_items').on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchCloudData).subscribe();
    const slotsChannel = supabase.channel('public:slot_capacities').on('postgres_changes', { event: '*', schema: 'public', table: 'slot_capacities' }, fetchCloudData).subscribe();
    const promosChannel = supabase.channel('public:promos_dashboard').on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, fetchCloudData).subscribe();
    const timer = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(promosChannel);
      clearInterval(timer);
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
          return { id: p.id, name: p.name || 'Valued Regular', identifier: p.identifier, type: p.role || 'regular', auth_user_id: p.auth_user_id, created_at: p.created_at };
        });
        setCustomers(formattedProfiles);
      } else {
        setCustomers([]);
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

  // --- Save configured capacity (max bowls & max slots) and booking status for a date/time slot ---
  const handleUpdateSlotCapacity = async (dateKey: string, slotTime: string, maxBowls: number, maxSlots: number, isFullyBooked: boolean) => {
    try {
      const existing = slotCapacities ? Object.values(slotCapacities).find((s: any) => s.date_key === dateKey && s.slot_time === slotTime) : null;
      const bookedBowls = existing ? existing.booked_bowls : 0;
      const bookedCount = existing ? existing.booked_count : 0;
      const payload = {
        date_key: dateKey,
        slot_time: slotTime,
        max_bowls: maxBowls,
        booked_bowls: bookedBowls,
        max_slots: maxSlots,
        booked_count: bookedCount,
        is_fully_booked: isFullyBooked || (bookedBowls >= maxBowls)
      };
      await supabase.from('slot_capacities').upsert(payload, { onConflict: 'date_key,slot_time' });
      alert(`Slot capacity updated successfully for ${slotTime} on ${dateKey}!`);
      fetchCloudData();
    } catch (e) {
      alert('Error updating slot capacity.');
    }
  };

  // --- Load Slot Reservations & Owners ---
  const handleInspectSlot = async (slotTime: string, dateKey: string) => {
    setInspectingSlot({ slotTime, dateKey });
    try {
      const { data, error } = await supabase
        .from('slot_reservations')
        .select('*, orders(*)')
        .eq('slot_time', slotTime)
        .eq('date_key', dateKey);
      
      if (data) {
        setSlotReservationsList(data);
      } else {
        setSlotReservationsList([]);
      }
    } catch (e) {
      setSlotReservationsList([]);
    }
  };

  // --- Execute Admin Slot Transfer ---
  const handleExecuteTransfer = async (reservationId: string, newDateKey: string, newSlotTime: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_transfer_slot', {
        p_reservation_id: reservationId,
        p_new_date_key: newDateKey,
        p_new_slot_time: newSlotTime
      });
      if (error) throw error;
      alert('Slot successfully transferred!');
      setTransferringReservation(null);
      if (inspectingSlot) {
        handleInspectSlot(inspectingSlot.slotTime, inspectingSlot.dateKey);
      }
      fetchCloudData();
    } catch (e: any) {
      alert(e?.message || 'Failed to transfer slot.');
    }
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
    if (!newPromoCode || !newPromoDiscount) return;

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
      discount_value: parseFloat(newPromoDiscount),
      target_type: newPromoTargetType, // Scope: subtotal or delivery
      eligibility: 'registered',       // Strictly enforced: registered customers only
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

  // --- Phase 4: open the Loyalty Manager, load live status + audit history ---
  const openLoyaltyManager = async (cust: any) => {
    setLoyaltyTargetUser(cust);
    setLoyaltyStampDelta(0);
    setLoyaltyReason('');
    setLoyaltyBusy(true);
    try {
      const { data: status } = await supabase.rpc('get_loyalty_status', { p_user_id: cust.auth_user_id });
      setLoyaltyStatus(status);
      setLoyaltyTier(status?.tier === 'DIAMOND' ? 'DIAMOND' : status?.tier === 'PLATINUM' ? 'PLATINUM' : 'B' + (status?.block || 1));
      setLoyaltyTierReason('');
      const { data: hist } = await supabase.rpc('get_stamp_history', { p_user_id: cust.auth_user_id });
      setLoyaltyHistory(hist || []);
    } catch (e) { console.error('Loyalty load failed:', e); }
    setLoyaltyBusy(false);
  };
  const handleLoyaltyAdjustStamps = async () => {
    if (!loyaltyTargetUser) return;
    if (!loyaltyStampDelta) { alert('Enter a non-zero stamp amount (positive to add, negative to remove).'); return; }
    if (!loyaltyReason.trim()) { alert('A reason is required for every stamp change.'); return; }
    setLoyaltyBusy(true);
    const { data, error } = await supabase.rpc('admin_adjust_stamps', {
      p_user_id: loyaltyTargetUser.auth_user_id, p_delta: loyaltyStampDelta, p_reason: loyaltyReason.trim()
    });
    setLoyaltyBusy(false);
    if (error || !data?.success) { alert(error?.message || data?.message || 'Stamp adjustment failed.'); return; }
    alert(`Stamps adjusted by ${loyaltyStampDelta}. New total: ${data.new_cumulative}.`);
    setLoyaltyReason('');
    fetchCloudData();
    await openLoyaltyManager(loyaltyTargetUser);
  };

  const handleLoyaltySetTier = async () => {
    if (!loyaltyTargetUser) return;
    if (!loyaltyTierReason.trim()) { alert('A reason is required for every tier / block change.'); return; }
    setLoyaltyBusy(true);
    const { data, error } = await supabase.rpc('admin_set_loyalty_state', {
      p_user_id: loyaltyTargetUser.auth_user_id, p_action: loyaltyTier, p_reason: loyaltyTierReason.trim()
    });
    setLoyaltyBusy(false);
    if (error || !data?.success) { alert(error?.message || data?.message || 'Change failed.'); return; }
    alert(data.tier ? `${data.tier} applied. Stamps: ${data.cumulative}.` : `Moved to Milestone Block ${data.block} (position 1 of the block). Stamps: ${data.cumulative}.`);
    setLoyaltyTierReason('');
    fetchCloudData();
    await openLoyaltyManager(loyaltyTargetUser);
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
                {orders.length > 0 && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!confirm('Are you sure you want to clear all sales logs? Customer order histories will remain untouched.')) return;
                      try {
                        const { error } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                        if (error) throw error;
                        setOrders([]);
                        alert('Sales transaction logs successfully cleared for admin.');
                      } catch (err: any) {
                        alert('Failed to clear sales logs: ' + (err?.message || 'Permission denied'));
                      }
                    }}
                    className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-extrabold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    Clear Sales Log
                  </Button>
                )}
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

        {/* Scheduling slot capacity & bowl inventory controls */}
        {activeTab === 'slots' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Manage Bowl Capacity & Time Slot Bookings</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-300">Select Date:</span>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedSlotDate}
                  onChange={(e) => setSelectedSlotDate(e.target.value)}
                  className="bg-[#041913] border border-emerald-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-lime-400"
                />
              </div>
            </div>
            <p className="text-xs text-emerald-300">
              Configure maximum bowl limits per time window, inspect slot owners, or transfer reservations between time slots.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeSlotsList.map((slotTime) => {
                const existing = slotCapacities ? Object.values(slotCapacities).find((s: any) => s.date_key === selectedSlotDate && s.slot_time === slotTime) : null;
                const maxBowls = existing ? existing.max_bowls : 20;
                const bookedBowls = existing ? existing.booked_bowls : 0;
                const maxSlots = existing ? existing.max_slots : 10;
                const isFullyBooked = existing ? existing.is_fully_booked : false;
                return (
                  <SlotCapacityCard
                    key={slotTime}
                    slotTime={slotTime}
                    dateKey={selectedSlotDate}
                    initialMaxBowls={maxBowls}
                    bookedBowls={bookedBowls}
                    initialMaxSlots={maxSlots}
                    initialFullyBooked={isFullyBooked}
                    onSave={handleUpdateSlotCapacity}
                    onInspect={() => handleInspectSlot(slotTime, selectedSlotDate)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Slot Owner Inspector Modal */}
        <Dialog open={!!inspectingSlot} onOpenChange={(open) => !open && setInspectingSlot(null)}>
          {inspectingSlot && (
            <DialogContent className="max-w-2xl w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                <div className="space-y-0.5">
                  <DialogTitle className="font-display text-lg font-extrabold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-lime-400" /> Slot Owners: {inspectingSlot.slotTime} ({inspectingSlot.dateKey})
                  </DialogTitle>
                  <DialogDescription className="text-xs text-emerald-300">
                    Inspect who reserved this slot and view what exact items/bowls they ordered.
                  </DialogDescription>
                </div>
              </div>
              <div className="my-4 space-y-3">
                {slotReservationsList.length === 0 ? (
                  <p className="text-xs text-emerald-400/70 text-center py-6">No reservations found for this time slot.</p>
                ) : (
                  slotReservationsList.map((res) => (
                    <div key={res.id} className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                        <div>
                          <span className="font-extrabold text-white text-sm">{res.customer_name}</span>
                          <span className="text-[10px] text-emerald-300 block">{res.customer_phone || 'No phone'}</span>
                        </div>
                        <div className="text-right">
                          <span className="bg-lime-400 text-black px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">
                            {res.bowls_reserved} Bowls Reserved
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold">Ordered Items & Customizations:</span>
                        {res.orders?.items?.map((it: any, i: number) => (
                          <div key={i} className="text-emerald-200 text-[11px] pl-2 border-l-2 border-lime-400/40">
                            <span>{it.qty}x {it.item?.name || it.name}</span>
                            {it.customizationsSummary && <span className="block text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end pt-2 border-t border-emerald-900/40">
                        <Button
                          size="sm"
                          onClick={() => setTransferringReservation(res)}
                          className="bg-[#082a20] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5"
                        >
                          <ArrowRightLeft className="size-3.5" /> Transfer Schedule
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Transfer Schedule Modal */}
        <Dialog open={!!transferringReservation} onOpenChange={(open) => !open && setTransferringReservation(null)}>
          {transferringReservation && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">
                  Transfer Reservation for {transferringReservation.customer_name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Select a new time slot to move this customer's {transferringReservation.bowls_reserved} bowls into.
                </DialogDescription>
              </div>
              <div className="my-4 space-y-3 text-xs">
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Target Time Slot</label>
                  <select
                    value={transferTargetSlot}
                    onChange={(e) => setTransferTargetSlot(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                  >
                    {timeSlotsList.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setTransferringReservation(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button onClick={() => handleExecuteTransfer(transferringReservation.id, inspectingSlot?.dateKey || selectedSlotDate, transferTargetSlot)} className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg">Confirm Transfer</Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

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
                            <Button onClick={() => openLoyaltyManager(cust)} size="sm" className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer">
                              <Award className="h-3.5 w-3.5 mr-1" /> Loyalty
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
                  </select>
                  <input type="number" placeholder={newPromoType === 'peso' ? "e.g. 50" : "e.g. 10"} value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(e.target.value)} required className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Scope (Feature B)</label>
                <select value={newPromoTargetType} onChange={(e) => setNewPromoTargetType(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="subtotal">Food Subtotal Only</option>
                  <option value="delivery">Delivery Fee Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Customer Eligibility</label>
                <select value="registered" disabled className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none opacity-80 cursor-not-allowed">
                  <option value="registered">Registered Customers Only</option>
                </select>
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
                  {promos
                    .filter((p) => {
                      // Auto-filter expired vouchers
                      if (p.expiryDurationMs && p.expiryDurationMs > 0 && p.createdAt) {
                        const expiresAt = p.createdAt + p.expiryDurationMs;
                        return nowTimestamp < expiresAt;
                      }
                      return true;
                    })
                    .map((p, idx) => {
                      // Calculate live countdown
                      let countdownText = 'Never expires';
                      let isExpiringSoon = false;
                      if (p.expiryDurationMs && p.expiryDurationMs > 0 && p.createdAt) {
                        const expiresAt = p.createdAt + p.expiryDurationMs;
                        const diff = expiresAt - nowTimestamp;
                        if (diff <= 0) {
                          countdownText = 'EXPIRED';
                        } else {
                          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                          countdownText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                          isExpiringSoon = diff < 5 * 60 * 1000; // Less than 5 minutes
                        }
                      }
                      return (
                        <div key={idx} className={`bg-[#061d16] border rounded-xl p-4 flex items-center justify-between text-xs shadow-md ${
                          isExpiringSoon ? 'border-amber-500/60' : 'border-emerald-800/80'
                        }`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-lime-400 text-sm tracking-wide">{p.code}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                p.visibility === 'hidden' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'
                              }`}>
                                {p.visibility || 'public'}
                              </span>
                            </div>
                            <p className="text-emerald-200 font-bold">
                              {p.type === 'peso' ? formatPeso(p.discountValue) + ' OFF' : `${p.discountValue}% OFF`}
                            </p>
                            <p className={`text-[10px] font-mono ${isExpiringSoon ? 'text-amber-400 font-bold' : 'text-amber-300'}`}>
                              {countdownText}
                            </p>
                            <p className="text-[10px] text-emerald-300">🔢 Usage: {p.usageCount || 0} / {p.usageLimit ? `${p.usageLimit} limit` : 'Unlimited'}</p>
                            <p className="text-[10px] text-lime-300">Scope: {p.target_type === 'delivery' ? 'Delivery Fee' : 'Food Subtotal'}</p>
                            <p className="text-[10px] text-blue-300">Eligibility: {p.eligibility === 'registered' ? 'Registered Only' : 'All Customers'}</p>
                          </div>
                          <button onClick={() => handleDeletePromo(p.code)} className="text-red-400 hover:text-red-300 p-2 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
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

        {/* ADD / EDIT MENU ITEM MODAL */}
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

        {/* Loyalty Manager modal (replaces Fair Play stamp/penalty system) */}
        <Dialog open={!!loyaltyTargetUser} onOpenChange={(open) => !open && setLoyaltyTargetUser(null)}>
        {loyaltyTargetUser && (
        <DialogContent className="max-w-xl w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-1 border-b border-emerald-900/60 pb-3">
        <DialogTitle className="font-display text-xl font-extrabold text-white flex items-center gap-2">
        <Award className="h-5 w-5 text-lime-400" /> Loyalty Manager: {loyaltyTargetUser.name}
        </DialogTitle>
        <p className="text-[10px] text-emerald-300 font-mono">{loyaltyTargetUser.identifier}</p>
        </div>
        {loyaltyBusy && !loyaltyStatus ? (
        <p className="text-xs text-emerald-300 text-center py-8">Loading loyalty data…</p>
        ) : !loyaltyStatus ? (
        <p className="text-xs text-red-300 text-center py-8">No loyalty record (unlinked account?).</p>
        ) : (() => {
          const tier = loyaltyStatus.tier || null;
          const block = loyaltyStatus.block || 1;
          const sizes = [4, 10, 15, 20, 10];
          const size = sizes[block - 1] || 10;
          const pos = loyaltyStatus.position_in_block || 0;
          const cum = loyaltyStatus.cumulative_stamps || 0;
          const platExp = loyaltyStatus.platinum_expires_at ? new Date(loyaltyStatus.platinum_expires_at) : null;
          const weekly = loyaltyStatus.weekly;
          const badgeText = tier === 'DIAMOND' ? 'DIAMOND' : tier === 'PLATINUM' ? 'PLATINUM' : `BLOCK ${block}`;
          const badgeSkin = tier === 'DIAMOND' ? 'bg-sky-400/20 text-sky-300 border-sky-400/50' : tier === 'PLATINUM' ? 'bg-slate-200/20 text-slate-100 border-slate-300/50' : 'bg-lime-400/20 text-lime-400 border-lime-400/40';
          const onCircleChange = async (val: string) => {
            if (!val) return;
            if (!loyaltyReason.trim()) { alert('Enter a reason first (required for every stamp change).'); await openLoyaltyManager(loyaltyTargetUser); return; }
            const k = parseInt(val.slice(1));
            let res: any;
            if (val[0] === 'A') {
              const delta = k - pos; if (!delta) { await openLoyaltyManager(loyaltyTargetUser); return; }
              setLoyaltyBusy(true);
              res = await supabase.rpc('admin_adjust_stamps', { p_user_id: loyaltyTargetUser.auth_user_id, p_delta: delta, p_reason: loyaltyReason.trim() });
            } else {
              setLoyaltyBusy(true);
              res = await supabase.rpc('admin_remove_stamp_to', { p_user_id: loyaltyTargetUser.auth_user_id, p_new_cum: k - 1, p_reason: loyaltyReason.trim() });
            }
            setLoyaltyBusy(false);
            const d = res.data;
            if (res.error || !d?.success) { alert(res.error?.message || d?.message || 'Stamp change failed.'); }
            else { if (d.voided_vouchers && d.voided_vouchers.length) alert(`Removed. Voided unused voucher(s): ${d.voided_vouchers.join(', ')}`); setLoyaltyReason(''); fetchCloudData(); }
            await openLoyaltyManager(loyaltyTargetUser);
          };
          return (
          <div className="my-4 space-y-4 text-xs">
            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">Current Status</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeSkin}`}>{badgeText}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-200">
                <p>Milestone Block: <strong className="text-white">{block} of 5</strong></p>
                <p>Position in block: <strong className="text-white">{pos} / {size}</strong></p>
                <p>Cumulative stamps: <strong className="text-lime-400">{cum}</strong></p>
                <p>Member since: <strong className="text-white">{loyaltyTargetUser.created_at ? new Date(loyaltyTargetUser.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '—'}</strong></p>
              </div>
              {platExp && <p className="text-[10px] text-slate-300">Platinum VIP until <strong>{platExp.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</strong></p>}
              {weekly && <p className="text-[10px] text-slate-300">This week: <strong>{weekly.qualifying_orders}/3</strong> orders • <strong>{weekly.claims_remaining}/2</strong> claims • free meal {weekly.free_meal_unlocked ? 'unlocked ✓' : '—'}</p>}
            </div>

            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Add / Remove Stamps (per circle)</span>
              <input type="text" value={loyaltyReason} onChange={(e) => setLoyaltyReason(e.target.value)} placeholder="Reason for stamp add/remove (required)" className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
              <div className="flex flex-wrap justify-center gap-2.5">
                {Array.from({ length: size }).map((_, idx) => {
                  const k = idx + 1;
                  const filled = k <= pos;
                  const isWelcome = k === 1;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className={`size-10 rounded-full flex items-center justify-center border-2 ${filled ? 'bg-lime-400 border-lime-300 text-black shadow-md' : 'bg-transparent border-white/70 text-lime-300'}`}>
                        {filled ? <Star className="size-4 fill-black" /> : <span className="text-[10px] font-bold">{k}</span>}
                      </div>
                      {isWelcome ? (
                        <span className="text-[8px] font-black uppercase tracking-wider text-lime-400/80 px-1 py-0.5 rounded bg-black/30 border border-lime-400/30">🔒 Welcome</span>
                      ) : (
                        <select value="" onChange={(e) => onCircleChange(e.target.value)} disabled={loyaltyBusy}
                          className="bg-[#04140f] border border-emerald-800 rounded-lg px-1 py-0.5 text-[9px] text-emerald-200 font-bold focus:outline-none focus:border-lime-400 cursor-pointer disabled:opacity-40">
                          {filled
                            ? (<><option value="">✓ Stamped</option><option value={'RM' + k}>− Remove to {k - 1}</option></>)
                            : (<><option value="">○ Empty</option><option value={'AD' + k}>＋ Add to {k}</option></>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-emerald-400/80">Circle 1 = welcome stamp, <strong>locked</strong>. Empty circle → <em>Add</em> extends the count (crossing a milestone credits its reward). Filled circle → <em>Remove</em> lowers the count and claws back the discount <strong>only if it was unused</strong>; if the reward/voucher was already spent, the removal is refused and the stamp stays valid.</p>
            </div>

            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Set Tier / Milestone Block</span>
              <input type="text" value={loyaltyTierReason} onChange={(e) => setLoyaltyTierReason(e.target.value)} placeholder="Reason for tier / block change (required)" className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
              <div className="flex gap-2">
                <select value={loyaltyTier} onChange={(e) => setLoyaltyTier(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-lime-300 font-bold focus:outline-none focus:border-lime-400">
                  <option value="CLEAR">Clear VIP (keep stamps)</option>
                  <option value="B1">Milestone Block 1 (teleport to stamp 1)</option>
                  <option value="B2">Milestone Block 2 (teleport to stamp 5)</option>
                  <option value="B3">Milestone Block 3 (teleport to stamp 15)</option>
                  <option value="B4">Milestone Block 4 (teleport to stamp 30)</option>
                  <option value="B5">Milestone Block 5 (teleport to stamp 50)</option>
                  <option value="PLATINUM">Platinum (14-day VIP)</option>
                  <option value="DIAMOND">Diamond (invitation)</option>
                </select>
                <Button onClick={handleLoyaltySetTier} disabled={loyaltyBusy} className="bg-sky-400 hover:bg-sky-300 text-black font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">Apply</Button>
              </div>
              <p className="text-[9px] text-emerald-400/80">Has its <strong>own</strong> reason field (separate from stamp add/remove). A <em>Block</em> choice <strong>teleports</strong> the customer to that block's <strong>first</strong> stamp and clears any VIP — it does <strong>not</strong> fill the block and issues no rewards. To give them the whole block, use <em>Add / Remove Stamps</em> above. <em>Platinum/Diamond</em> change the tier without touching the stamp count.</p>
            </div>

            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Stamp History (audit)</span>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[10px] text-emerald-200">
                  <thead className="sticky top-0 bg-[#061d16] text-emerald-300 uppercase">
                    <tr className="border-b border-emerald-800"><th className="p-1">Date</th><th className="p-1">Type</th><th className="p-1">Blk</th><th className="p-1">Total</th><th className="p-1">Reason</th></tr>
                  </thead>
                  <tbody>
                    {loyaltyHistory.length === 0 ? (<tr><td colSpan={5} className="text-center p-2 text-emerald-400/60">No stamps recorded.</td></tr>) : (
                      loyaltyHistory.map((h) => (
                        <tr key={h.id} className="border-b border-emerald-900/40">
                          <td className="p-1">{new Date(h.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</td>
                          <td className="p-1 font-bold text-lime-300">{h.stamp_type}</td>
                          <td className="p-1">B{h.block_number}#{h.stamps_in_block}</td>
                          <td className="p-1">{h.cumulative_stamps}</td>
                          <td className="p-1 text-emerald-300/80 italic">{h.reason || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          );
        })()}
        <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
        <Button onClick={() => setLoyaltyTargetUser(null)} className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Close</Button>
        </div>
        </DialogContent>
        )}
        </Dialog>
      </div>
    </div>
  );
}

// --- Reusable editor card for an individual date/time slot's bowl capacity & bookings ---
function SlotCapacityCard({ slotTime, dateKey, initialMaxBowls, bookedBowls, initialMaxSlots, initialFullyBooked, onSave, onInspect }: any) {
  // Use initialMaxBowls if provided, otherwise default to 10 (configurable, not hardcoded)
  const [maxBowls, setMaxBowls] = useState(initialMaxBowls || 10);
  const [maxSlots, setMaxSlots] = useState(initialMaxSlots || 10);
  const [isFullyBooked, setIsFullyBooked] = useState(initialFullyBooked || false);

  useEffect(() => {
    setMaxBowls(initialMaxBowls || 10);
    setMaxSlots(initialMaxSlots || 10);
    setIsFullyBooked(initialFullyBooked || false);
  }, [initialMaxBowls, initialMaxSlots, initialFullyBooked]);

  const currentBookedBowls = Number(bookedBowls || 0);
  // Calculate remaining bowls dynamically based on the configurable maxBowls
  const remainingBowls = Math.max(0, maxBowls - currentBookedBowls);

  return (
    <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
        <span className="font-extrabold text-lime-400 text-sm flex items-center gap-1.5">
          <Clock className="size-4" /> {slotTime}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${isFullyBooked || remainingBowls === 0 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'}`}>
            {isFullyBooked || remainingBowls === 0 ? 'Fully Booked' : `${remainingBowls} Bowls Left`}
          </span>
          <Button
            size="sm"
            onClick={onInspect}
            className="bg-[#082a20] hover:bg-lime-400 hover:text-black text-lime-300 border border-emerald-700 text-[10px] px-2 py-0.5 rounded-lg font-bold cursor-pointer"
          >
            Inspect Owners
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-emerald-300 block mb-1">Max Bowls Cap (Configurable):</label>
          <input
            type="number"
            min="1"
            value={maxBowls}
            onChange={(e) => setMaxBowls(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-[#04140f] border border-emerald-800 rounded-lg p-2 text-lime-400 font-bold text-xs focus:outline-none focus:border-lime-400"
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
        <span>Reserved Bowls: <strong>{currentBookedBowls} / {maxBowls}</strong></span>
        <Button
          size="sm"
          onClick={() => onSave(dateKey, slotTime, maxBowls, maxSlots, isFullyBooked)}
          className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
        >
          Save Slot
        </Button>
      </div>
    </div>
  );
}

// --- Default export for the employee dashboard ---
export default EmployeeDashboard;