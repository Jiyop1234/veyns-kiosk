// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Edit2, Plus, Minus, Trash2, Tag, DollarSign, ShoppingBag, 
  BarChart2, Users, Award, CheckCircle2, AlertTriangle, XCircle, Clock, 
  Search, Ticket, Layers, ChevronUp, ChevronDown, RefreshCw, UserCheck, UserX, ShieldAlert
} from 'lucide-react';
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
  
  // Menu Manager State
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
  const [itemOptionGroups, setItemOptionGroups] = useState<any[]>([]);
  const [previewSelections, setPreviewSelections] = useState<{ [groupId: string]: string[] }>({});

  // Promo Manager State
  const [promos, setPromos] = useState<any[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoType, setNewPromoType] = useState<'percentage' | 'peso'>('percentage');
  const [newPromoTargetType, setNewPromoTargetType] = useState<'subtotal' | 'delivery'>('subtotal');
  const [newPromoEligibility, setNewPromoEligibility] = useState<'all' | 'registered'>('all');
  const [newVoucherVisibility, setNewVoucherVisibility] = useState<'public' | 'hidden'>('public');
  const [newVoucherExpiryVal, setNewVoucherExpiryVal] = useState('60');
  const [newVoucherExpiryUnit, setNewVoucherExpiryUnit] = useState<'minutes' | 'hours' | 'never'>('minutes');
  const [newVoucherUsageLimit, setNewVoucherUsageLimit] = useState('');

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Customer Management State
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCustName, setEditCustName] = useState('');

  // Slot Capacities State
  const [slotCapacities, setSlotCapacities] = useState<any[]>([]);
  const [selectedSlotDate, setSelectedSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const timeSlotsList = ['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'];

  // --- Initial cloud data load and Supabase Realtime subscriptions ---
  useEffect(() => {
    fetchCloudData();
    const orderChannel = supabase.channel('public:orders_dash').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchCloudData).subscribe();
    const menuChannel = supabase.channel('public:menu_items_dash').on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchCloudData).subscribe();
    const slotsChannel = supabase.channel('public:slot_capacities_dash').on('postgres_changes', { event: '*', schema: 'public', table: 'slot_capacities' }, fetchCloudData).subscribe();
    const promosChannel = supabase.channel('public:promos_dash').on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, fetchCloudData).subscribe();
    const profilesChannel = supabase.channel('public:profiles_dash').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchCloudData).subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(promosChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  const fetchCloudData = async () => {
    try {
      // Menu Items
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
      } else {
        setMenuItems(MENU_GRID);
      }

      // Orders
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

      // Profiles / Customers
      const { data: cloudProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (cloudProfiles) {
        setCustomers(cloudProfiles);
      }

      // Slot Capacities
      const { data: cloudSlots } = await supabase.from('slot_capacities').select('*');
      if (cloudSlots) {
        setSlotCapacities(cloudSlots);
      }

      // Promos
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
    }
  };

  // Staff Loyalty Management Operations
  const handleAdjustStamps = async (profileId: string, currentStamps: number, delta: number) => {
    const newCount = Math.max(1, (currentStamps || 1) + delta);
    const { error } = await supabase
      .from('profiles')
      .update({ current_stamp_count: newCount })
      .eq('id', profileId);

    if (error) {
      alert('Failed to update stamps: ' + error.message);
    } else {
      fetchCloudData();
    }
  };

  const handleUpdateTier = async (profileId: string, tier: 'PLATINUM' | 'DIAMOND' | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ tier })
      .eq('id', profileId);

    if (error) {
      alert('Failed to update tier: ' + error.message);
    } else {
      fetchCloudData();
    }
  };

  const handleToggleAccountStatus = async (profileId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const { error } = await supabase
      .from('profiles')
      .update({ status: nextStatus })
      .eq('id', profileId);

    if (error) {
      alert('Failed to update status: ' + error.message);
    } else {
      fetchCloudData();
    }
  };

  // Slot Capacities Operations
  const handleUpdateSlotCapacity = async (dateKey: string, slotTime: string, maxSlots: number, isFullyBooked: boolean) => {
    try {
      const existing = slotCapacities.find(s => s.date_key === dateKey && s.slot_time === slotTime);
      const bookedCount = existing ? existing.booked_count : 0;
      const bookedBowls = existing ? existing.booked_bowls : 0;

      const payload = {
        date_key: dateKey,
        slot_time: slotTime,
        max_slots: maxSlots,
        booked_count: bookedCount,
        booked_bowls: bookedBowls,
        is_manually_fully_booked: isFullyBooked,
        is_fully_booked: isFullyBooked
      };
      await supabase.from('slot_capacities').upsert(payload, { onConflict: 'date_key,slot_time' });
      alert(`Slot capacity updated for ${slotTime} on ${dateKey}!`);
      fetchCloudData();
    } catch (e) {
      alert('Error updating slot capacity.');
    }
  };

  // Image Upload Handler
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

  // Save Menu Item
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
      alert('Menu item successfully saved!');
    } catch (err) {
      alert('Error saving menu item to database.');
    }

    setIsAddingNewItem(false);
    setEditingItem(null);
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

  const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from('menu_items').update({ is_available: !currentStatus }).eq('id', id);
      fetchCloudData();
    } catch (e) {}
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await supabase.from('menu_items').delete().eq('id', id);
      fetchCloudData();
    } catch (e) {}
  };

  // Option Group Builder Handlers
  const handleAddOptionGroup = () => {
    setItemOptionGroups(prev => [
      ...prev,
      {
        id: `group_${Date.now()}`,
        name: '',
        description: '',
        type: 'single',
        required: true,
        minSelections: 0,
        maxSelections: 1,
        parentOptionIds: [],
        options: [{ id: `opt_${Date.now()}_1`, name: '', price: 0 }]
      }
    ]);
  };

  const handleUpdateGroup = (groupId: string, field: string, value: any) => {
    setItemOptionGroups(prev => prev.map(g => g.id === groupId ? { ...g, [field]: value } : g));
  };

  const handleDeleteGroup = (groupId: string) => {
    setItemOptionGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleAddOptionToGroup = (groupId: string) => {
    setItemOptionGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          options: [...g.options, { id: `opt_${Date.now()}_${Math.random()}`, name: '', price: 0 }]
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

  // Promos Handlers
  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoDiscount) return;

    const expiryNum = parseFloat(newVoucherExpiryVal) || 60;
    let expiryMs = 0;
    if (newVoucherExpiryUnit === 'minutes') expiryMs = expiryNum * 60 * 1000;
    else if (newVoucherExpiryUnit === 'hours') expiryMs = expiryNum * 60 * 60 * 1000;

    const cleanCode = newPromoCode.trim().toUpperCase();

    const newVoucherPayload = {
      code: cleanCode,
      type: newPromoType,
      discount_value: parseFloat(newPromoDiscount),
      target_type: newPromoTargetType,
      eligibility: newPromoEligibility,
      visibility: newVoucherVisibility,
      expiry_duration_ms: expiryMs,
      usage_limit: newVoucherUsageLimit ? parseInt(newVoucherUsageLimit) : null,
      usage_count: 0,
      created_at: Date.now()
    };

    try {
      const { error } = await supabase.from('promos').upsert([newVoucherPayload], { onConflict: 'code' });
      if (error) {
        alert("Failed to save promo: " + error.message);
        return;
      }
      alert(`Voucher "${cleanCode}" created!`);
      setNewPromoCode('');
      setNewPromoDiscount('');
      setNewVoucherUsageLimit('');
      fetchCloudData();
    } catch (err) {
      alert("Database error while creating voucher.");
    }
  };

  const handleDeletePromo = async (code: string) => {
    if (!confirm(`Are you sure you want to delete promo ${code}?`)) return;
    try {
      await supabase.from('promos').delete().eq('code', code);
      fetchCloudData();
    } catch (e) {
      alert('Error deleting promo.');
    }
  };

  const handleSaveCustomerEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const newName = editCustName.trim();
    if (!newName) { alert('Nickname cannot be blank.'); return; }
    const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', editingCustomer.id);
    if (error) { alert('Error updating customer: ' + error.message); return; }
    setEditingCustomer(null);
    fetchCloudData();
  };

  const handleExitStore = () => {
    if (onBackToStore) {
      onBackToStore();
    } else {
      window.location.reload();
    }
  };

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.identifier || '').toLowerCase().includes(customerSearch.toLowerCase())
  );

  const totalGrossSales = orders.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrdersCount = orders.length;
  const averageOrderValue = totalOrdersCount > 0 ? totalGrossSales / totalOrdersCount : 0;

  return (
    <div className="min-h-screen bg-[#020b08] text-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
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
            className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <ArrowLeft className="h-4 w-4" /> Exit to Store
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-emerald-900/60 pb-3">
          <button onClick={() => setActiveTab('sales')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'sales' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <BarChart2 className="h-4 w-4" /> Sales Analytics ({orders.length})
          </button>
          <button onClick={() => setActiveTab('customers')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'customers' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Users className="h-4 w-4" /> Loyalty & Cards ({customers.length})
          </button>
          <button onClick={() => setActiveTab('slots')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'slots' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Clock className="h-4 w-4" /> Slot Capacities
          </button>
          <button onClick={() => setActiveTab('menu')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'menu' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Tag className="h-4 w-4" /> Menu Manager ({menuItems.length})
          </button>
          <button onClick={() => setActiveTab('promos')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'promos' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <Ticket className="h-4 w-4" /> Vouchers & Promos ({promos.length})
          </button>
        </div>

        {/* TAB 1: SALES ANALYTICS */}
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
                  <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Completed Orders Log</h3>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <ShoppingBag className="h-12 w-12 text-emerald-700 mx-auto opacity-50" />
                  <p className="text-sm text-emerald-300/70 font-semibold">No transactions recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-emerald-100">
                    <thead className="bg-[#071F19] text-emerald-300 uppercase text-[10px] tracking-wider border-b border-emerald-800/60">
                      <tr>
                        <th className="p-3">Order #</th>
                        <th className="p-3">Customer & Contact</th>
                        <th className="p-3">Fulfillment</th>
                        <th className="p-3">Address & Landmark</th>
                        <th className="p-3">Items Summary</th>
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
                              <span className="font-bold text-white block">{order.name}</span>
                              <span className="text-[10px] text-emerald-400">{order.phone || order.email || 'No contact'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="inline-block bg-[#082d22] text-lime-400 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase">
                              {order.fulfillment} • {order.orderType}
                            </span>
                          </td>
                          <td className="p-3 text-emerald-200">
                            <p className="font-semibold text-white max-w-[200px] truncate">{order.location || 'N/A'}</p>
                            <p className="text-[10px] text-emerald-400">{order.landmark}</p>
                          </td>
                          <td className="p-3 space-y-0.5 max-w-xs">
                            {(order.items || []).map((it: any, i: number) => (
                              <div key={i} className="text-emerald-200 text-[11px]">
                                {it.qty}x {it.item?.name || it.name}
                              </div>
                            ))}
                          </td>
                          <td className="p-3 font-extrabold text-lime-400 text-sm">{formatPeso(order.total)}</td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => setSelectedInvoice(order)}
                              className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl cursor-pointer"
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

        {/* TAB 2: LOYALTY CARD & CUSTOMER MANAGER */}
        {activeTab === 'customers' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Customer Cards & VIP Tiers</h3>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/70" />
                <input
                  type="text"
                  placeholder="Search customer name or handle..."
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
                    <th className="p-3">Customer Profile</th>
                    <th className="p-3">Current Stamps</th>
                    <th className="p-3">VIP Tier</th>
                    <th className="p-3">Card Status</th>
                    <th className="p-3 text-right">Staff Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-950">
                  {filteredCustomers.map((cust) => {
                    const stamps = cust.current_stamp_count || 1;
                    const isSuspended = cust.status === 'SUSPENDED';

                    return (
                      <tr key={cust.id} className="hover:bg-[#071F19]/50 transition-colors">
                        <td className="p-3">
                          <span className="font-bold text-white block">{cust.name || 'Unnamed Profile'}</span>
                          <span className="text-[10px] font-mono text-emerald-400">{cust.identifier}</span>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-lime-400 text-sm">{stamps}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleAdjustStamps(cust.id, stamps, -1)}
                                className="p-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded border border-emerald-700 cursor-pointer"
                                title="Remove 1 Stamp"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleAdjustStamps(cust.id, stamps, 1)}
                                className="p-1 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded cursor-pointer"
                                title="Add 1 Stamp"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <select
                            value={cust.tier || ''}
                            onChange={(e) => handleUpdateTier(cust.id, (e.target.value as any) || null)}
                            className="bg-[#041913] border border-emerald-800 rounded-lg p-1.5 text-xs text-lime-400 font-bold focus:outline-none focus:border-lime-400"
                          >
                            <option value="">No Tier (Standard Card)</option>
                            <option value="PLATINUM">PLATINUM</option>
                            <option value="DIAMOND">DIAMOND</option>
                          </select>
                        </td>

                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isSuspended ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}>
                            {cust.status || 'ACTIVE'}
                          </span>
                        </td>

                        <td className="p-3 text-right space-x-2">
                          <Button 
                            onClick={() => {
                              setEditingCustomer(cust);
                              setEditCustName(cust.name || '');
                            }} 
                            size="sm" 
                            className="bg-[#062c21] hover:bg-emerald-800 text-lime-300 border border-emerald-700 font-bold text-xs px-3 py-1 rounded-xl cursor-pointer"
                          >
                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleToggleAccountStatus(cust.id, cust.status)}
                            className={`text-[10px] font-extrabold px-3 py-1 rounded-xl cursor-pointer ${
                              isSuspended 
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-black' 
                                : 'bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700'
                            }`}
                          >
                            {isSuspended ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
                            {isSuspended ? 'Unfreeze' : 'Suspend'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SLOT CAPACITIES */}
        {activeTab === 'slots' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Manage Slot Capacities & Fully Booked Status</h3>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeSlotsList.map((slotTime) => {
                const existing = slotCapacities.find(s => s.date_key === selectedSlotDate && s.slot_time === slotTime);
                const maxSlots = existing ? existing.max_slots : 20;
                const bookedCount = existing ? existing.booked_count : 0;
                const isFullyBooked = existing ? (existing.is_manually_fully_booked || existing.is_fully_booked) : false;

                return (
                  <SlotCapacityCard
                    key={slotTime}
                    slotTime={slotTime}
                    dateKey={selectedSlotDate}
                    initialMax={maxSlots}
                    bookedCount={bookedCount}
                    initialFullyBooked={isFullyBooked}
                    onSave={handleUpdateSlotCapacity}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: MENU MANAGER */}
        {activeTab === 'menu' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Database Menu Manager</h3>
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

        {/* TAB 5: VOUCHERS & PROMOS MANAGER */}
        {activeTab === 'promos' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center gap-2 border-b border-emerald-900/60 pb-3">
              <Ticket className="h-5 w-5 text-lime-400" />
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Vouchers & Promo Codes Manager</h3>
            </div>

            <form onSubmit={handleAddPromo} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Code Name</label>
                <input type="text" placeholder="e.g. VEYNS2026" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} required className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white uppercase font-bold focus:outline-none focus:border-lime-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Type & Discount Value</label>
                <div className="flex gap-1.5">
                  <select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value as any)} className="bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-lime-300 font-bold focus:outline-none">
                    <option value="peso">₱ OFF</option>
                    <option value="percentage">% OFF</option>
                  </select>
                  <input type="number" placeholder="Value" value={newPromoDiscount} onChange={(e) => setNewPromoDiscount(e.target.value)} required className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Target Scope</label>
                <select value={newPromoTargetType} onChange={(e) => setNewPromoTargetType(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="subtotal">Food Subtotal</option>
                  <option value="delivery">Delivery Fee</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Customer Eligibility</label>
                <select value={newPromoEligibility} onChange={(e) => setNewPromoEligibility(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="all">All Customers</option>
                  <option value="registered">Registered Accounts Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Visibility</label>
                <select value={newVoucherVisibility} onChange={(e) => setNewVoucherVisibility(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="public">Public (In Voucher List)</option>
                  <option value="hidden">Hidden (Code Required)</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg cursor-pointer">
                  <Plus className="h-4 w-4 mr-1" /> Create Voucher
                </Button>
              </div>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {promos.map((p, idx) => (
                <div key={idx} className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-4 flex items-center justify-between text-xs shadow-md">
                  <div className="space-y-1">
                    <span className="font-extrabold text-lime-400 text-sm tracking-wide block">{p.code}</span>
                    <p className="text-emerald-200 font-bold">
                      {p.type === 'peso' ? formatPeso(p.discountValue) + ' OFF' : `${p.discountValue}% OFF`}
                    </p>
                    <p className="text-[10px] text-emerald-300">Target: {p.target_type}</p>
                  </div>
                  <button onClick={() => handleDeletePromo(p.code)} className="text-red-400 hover:text-red-300 p-2 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Customer Profile Dialog */}
        <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
          {editingCustomer && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">
                  Edit Account: {editingCustomer.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Update customer nickname display
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
                    Save
                  </Button>
                </div>
              </form>
            </DialogContent>
          )}
        </Dialog>

        {/* Add/Edit Menu Item Modal */}
        <Dialog open={isAddingNewItem} onOpenChange={(open) => !open && setIsAddingNewItem(false)}>
          <DialogContent className="max-w-3xl w-full bg-[#03120d] text-white border border-emerald-900/85 shadow-2xl p-6 rounded-3xl max-h-[95vh] overflow-y-auto">
            <div className="space-y-1 border-b border-emerald-900/60 pb-3">
              <DialogTitle className="font-display text-xl font-extrabold text-white">
                {editingItem ? `Edit Item: ${editingItem.name}` : 'Add Menu Item'}
              </DialogTitle>
            </div>
            <form onSubmit={handleSaveNewOrEditedItem} className="space-y-5 my-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Item Name</label>
                  <input type="text" required value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Sinugba Liempo Bowl" className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400" />
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
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Description</label>
                <textarea rows={2} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white focus:outline-none focus:border-lime-400" />
              </div>

              <div className="space-y-2">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Image File Upload</label>
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files && e.target.files[0]) { setItemImageFile(e.target.files[0]); setImagePreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs text-emerald-300 cursor-pointer" />
              </div>

              <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
                <Button type="button" onClick={() => setIsAddingNewItem(false)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-3 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button type="submit" className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-lg">Save Item</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Slot Capacity Editor Card Component
function SlotCapacityCard({ slotTime, dateKey, initialMax, bookedCount, initialFullyBooked, onSave }: any) {
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
        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${isFullyBooked ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'}`}>
          {isFullyBooked ? 'Fully Booked' : `${Math.max(0, maxSlots - bookedCount)} Slots Left`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-emerald-300 block mb-1">Max Bowl Capacity:</label>
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
        <span>Orders Booked: <strong>{bookedCount}</strong></span>
        <Button
          size="sm"
          onClick={() => onSave(dateKey, slotTime, maxSlots, isFullyBooked)}
          className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
        >
          Save Slot
        </Button>
      </div>
    </div>
  );
}

export default EmployeeDashboard;