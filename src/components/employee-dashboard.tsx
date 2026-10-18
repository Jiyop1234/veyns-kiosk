// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, Tag, DollarSign, ShoppingBag, BarChart2, Users, KeyRound, Eye, EyeOff, Award, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MENU_GRID, formatPeso, getActivePromoCodes } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { supabase } from '@/lib/supabase';

function Photo({ id, alt, className }: { id: string; alt: string; className: string }) {
  const src = menuImages[id];
  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#0d2e26] font-display text-sm font-bold text-[#d4af37]`}>
        VEYNS
      </div>
    );
  }
  return <img src={src} alt={alt} width={512} height={512} className={className} />;
}

export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<'sales' | 'menu' | 'promos' | 'customers'>('sales');

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDiscount, setEditDiscount] = useState('');

  const [promos, setPromos] = useState<any[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');

  const [orders, setOrders] = useState<any[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [resetTargetUser, setResetTargetUser] = useState<any>(null);
  const [newTempPassword, setNewTempPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});

  const [stampTargetUser, setStampTargetUser] = useState<any>(null);
  const [customerStampsDetailed, setCustomerStampsDetailed] = useState<{ status: 'valid' | 'invalid' | 'to_clear' | 'empty'; date: string; penaltyReason?: string }[]>([]);
  const [selectedInfractionPreset, setSelectedInfractionPreset] = useState('');

  const infractionPresets = [
    {
      label: "Active Account",
      sixthReward: "25% OFF",
      ninthReward: "50% OFF",
      twelfthReward: "FREE",
      desc: "Active Account: Normal standing."
    },
    {
      label: "Penalties Waived",
      sixthReward: "25% OFF",
      ninthReward: "50% OFF",
      twelfthReward: "FREE",
      desc: "Penalties Waived: All penalties cleared and notices removed."
    },
    {
      label: "No Violation till card clears",
      sixthReward: "25% OFF",
      ninthReward: "50% OFF",
      twelfthReward: "FREE",
      desc: "No Violation till card clears: Card successfully cleared without violations; reset back to start."
    },
    {
      label: "1st offense False Stamping (At/Near Milestones)",
      sixthReward: "Invalidated",
      ninthReward: "25% OFF",
      twelfthReward: "50% OFF",
      desc: "1st offense False Stamping (At/Near Milestones): 6th stamp reward invalidated; 9th reward drops to 25%; 12th reward drops to 50%."
    },
    {
      label: "1st offense Early False Stamping (Early Stage Padding)",
      sixthReward: "Invalidated",
      ninthReward: "25% OFF",
      twelfthReward: "50% OFF",
      desc: "1st offense Early False Stamping (Early Stage Padding): 6th stamp reward invalidated; 9th reward drops to 25%; 12th reward drops to 50%."
    },
    {
      label: "1st offense False Claims:",
      sixthReward: "Invalidated",
      ninthReward: "25% OFF",
      twelfthReward: "50% OFF",
      desc: "1st offense False Claims: 6th stamp reward invalidated; 9th reward drops to 25%; 12th reward drops to 50%."
    },
    {
      label: "2nd offense False Stamping (At/Near Milestones)",
      sixthReward: "Invalidated",
      ninthReward: "Invalidated",
      twelfthReward: "25% OFF",
      desc: "2nd offense False Stamping (At/Near Milestones): 6th and 9th rewards invalidated; 12th reward downgraded to 25% OFF."
    },
    {
      label: "2nd offense Early False Stamping (Early Stage Padding)",
      sixthReward: "Invalidated",
      ninthReward: "Invalidated",
      twelfthReward: "25% OFF",
      desc: "2nd offense Early False Stamping (Early Stage Padding): 6th and 9th rewards invalidated; 12th reward downgraded to 25% OFF."
    },
    {
      label: "2nd offense False Claims:",
      sixthReward: "Invalidated",
      ninthReward: "Invalidated",
      twelfthReward: "25% OFF",
      desc: "2nd offense False Claims: 6th and 9th rewards invalidated; 12th reward downgraded to 25% OFF."
    },
    {
      label: "Multiple Offense : Severe or repeated false stamps",
      sixthReward: "Invalidated",
      ninthReward: "Invalidated",
      twelfthReward: "Cancelled (No Promos Left)",
      desc: "Multiple Offense : Severe or repeated false stamps. All remaining loyalty rewards cancelled."
    }
  ];

  useEffect(() => {
    try {
      const saved = localStorage.getItem('veyns_manageable_menu');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMenuItems(parsed);
        } else {
          setMenuItems(MENU_GRID);
        }
      } else {
        setMenuItems(MENU_GRID);
      }
    } catch (e) {
      setMenuItems(MENU_GRID);
    }

    setPromos(getActivePromoCodes());

    // Fetch live orders and customer profiles directly from Supabase
    fetchCloudData();

    // Listen for live incoming orders in real-time
    const orderChannel = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchCloudData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, []);

  const fetchCloudData = async () => {
    try {
      // 1. Fetch live orders from Supabase
      const { data: cloudOrders, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (cloudOrders) {
        const formattedOrders = cloudOrders.map((o: any) => ({
          name: o.customer_name,
          email: o.email || '',
          phone: o.phone || '',
          fulfillment: o.fulfillment || 'delivery',
          items: o.items || [],
          total: o.total || 0,
          orderNumber: o.order_number,
          date: new Date(o.created_at).toLocaleString(),
          promoCode: o.promo_code
        }));
        setOrders(formattedOrders);
      }

      // 2. Fetch registered customer profiles from Supabase cloud table
      const { data: cloudProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('*');

      if (cloudProfiles && cloudProfiles.length > 0) {
        const formattedProfiles = cloudProfiles.map((p: any) => ({
          name: p.name || 'Valued Regular',
          identifier: p.identifier,
          type: p.role || 'regular',
        }));
        setCustomers(formattedProfiles);
      } else {
        setCustomers([
          { name: 'Admin Regular', identifier: 'admin', type: 'regular', phone: '09123456789' },
          { name: 'Geoff Perez', identifier: 'geoff@gmail.com', type: 'regular', phone: '09987654321' }
        ]);
      }
    } catch (e) {
      console.error('Error fetching cloud data:', e);
    }
  };

  const saveActivePromoCodes = (codes: any[]) => {
    try {
      localStorage.setItem('veyns_promo_codes', JSON.stringify(codes));
    } catch (e) {}
  };

  const handleSaveItemEdit = () => {
    if (!editingItem) return;
    const updated = menuItems.map((it) => {
      if (it.id === editingItem.id) {
        return {
          ...it,
          price: editPrice !== '' ? parseFloat(editPrice) : it.price,
          discountPercent: editDiscount !== '' ? parseFloat(editDiscount) : (it.discountPercent || 0),
        };
      }
      return it;
    });
    setMenuItems(updated);
    try {
      localStorage.setItem('veyns_manageable_menu', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    setEditingItem(null);
  };

  const handleToggleAvailability = (id: string) => {
    const updated = menuItems.map((it) => {
      if (it.id === id) {
        return { ...it, isAvailable: it.isAvailable === false ? true : false };
      }
      return it;
    });
    setMenuItems(updated);
    try {
      localStorage.setItem('veyns_manageable_menu', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  const handleAddPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoDiscount) return;
    const newEntry = {
      code: newPromoCode.trim().toUpperCase(),
      discountPercent: parseFloat(newPromoDiscount),
    };
    const updated = [...promos, newEntry];
    setPromos(updated);
    saveActivePromoCodes(updated);
    setNewPromoCode('');
    setNewPromoDiscount('');
  };

  const handleDeletePromo = (code: string) => {
    const updated = promos.filter((p) => p.code !== code);
    setPromos(updated);
    saveActivePromoCodes(updated);
  };

  const handleClearSalesLog = async () => {
    if (!confirm('Are you sure you want to clear all sales logs from Supabase?')) return;
    try {
      await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setOrders([]);
      localStorage.removeItem('veyns_order_history');
    } catch (e) {
      setOrders([]);
    }
  };

  const hashPassword = async (password: string) => {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleResetPasswordSubmit = async () => {
    if (!resetTargetUser || !newTempPassword) return;
    const identifierKey = resetTargetUser.identifier.toLowerCase().trim();
    const hashedNewPass = await hashPassword(newTempPassword);
    
    try {
      await supabase.from('profiles').update({ password_hash: hashedNewPass }).eq('identifier', identifierKey);
      localStorage.setItem(`veyns_pwd_plain_${identifierKey}`, newTempPassword);
      localStorage.setItem(`veyns_pwd_hash_${identifierKey}`, hashedNewPass);
      alert(`Password successfully reset for ${resetTargetUser.name}! New password: "${newTempPassword}"`);
    } catch (e) {}

    setResetTargetUser(null);
    setNewTempPassword('');
    fetchCloudData();
  };

  const handleDeleteCustomer = async (identifier: string) => {
    if (!confirm('Are you sure you want to delete this customer account?')) return;
    try {
      const identifierKey = identifier.toLowerCase().trim();
      // Delete record directly from Supabase table
      await supabase.from('profiles').delete().eq('identifier', identifierKey);

      const updated = customers.filter((c) => c.identifier.toLowerCase().trim() !== identifierKey);
      setCustomers(updated);
      localStorage.removeItem(`veyns_pwd_plain_${identifierKey}`);
      localStorage.removeItem(`veyns_pwd_hash_${identifierKey}`);
      localStorage.removeItem(`veyns_stamps_${identifierKey}`);
      localStorage.removeItem(`veyns_detailed_stamps_${identifierKey}`);
      localStorage.removeItem(`veyns_fair_play_penalty_${identifierKey}`);
    } catch (e) {}
  };

  const openStampManager = (cust: any) => {
    setStampTargetUser(cust);
    try {
      const identifierKey = cust.identifier.toLowerCase().trim();
      const detailedSaved = localStorage.getItem(`veyns_detailed_stamps_${identifierKey}`);
      const penaltySaved = localStorage.getItem(`veyns_fair_play_penalty_${identifierKey}`);

      if (penaltySaved) {
        try {
          const parsedPenalty = JSON.parse(penaltySaved);
          if (parsedPenalty && parsedPenalty.appliedPenalties && parsedPenalty.appliedPenalties.length > 0) {
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
        const parsed = JSON.parse(detailedSaved);
        const normalized = Array.from({ length: 12 }).map((_, idx) => {
          return parsed[idx] || { status: 'empty', date: '' };
        });
        setCustomerStampsDetailed(normalized);
      } else {
        const userStamps = localStorage.getItem(`veyns_stamps_${identifierKey}`);
        const parsedStamps: string[] = userStamps ? JSON.parse(userStamps) : [];
        const fullSlots = Array.from({ length: 12 }).map((_, idx) => {
          if (parsedStamps[idx]) {
            return { status: 'valid' as const, date: parsedStamps[idx] };
          }
          return { status: 'empty' as const, date: '' };
        });
        setCustomerStampsDetailed(fullSlots);
      }
    } catch (e) {
      setCustomerStampsDetailed(Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' })));
      setSelectedInfractionPreset('Active Account');
    }
  };

  const handleSaveStamps = () => {
    if (!stampTargetUser) return;
    try {
      const identifierKey = stampTargetUser.identifier.toLowerCase().trim();
      
      const isCleared = 
        !selectedInfractionPreset || 
        selectedInfractionPreset.trim() === '' || 
        selectedInfractionPreset === 'Active Account' || 
        selectedInfractionPreset === 'Penalties Waived';

      let slotsToSave = customerStampsDetailed;

      if (selectedInfractionPreset === 'No Violation till card clears') {
        slotsToSave = Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' }));
      }

      const matchedPreset = !isCleared && selectedInfractionPreset !== 'No Violation till card clears' 
        ? infractionPresets.find(p => p.label === selectedInfractionPreset || p.desc === selectedInfractionPreset) 
        : null;
      
      let penaltyStatus = null;
      if (matchedPreset && selectedInfractionPreset !== 'No Violation till card clears' && selectedInfractionPreset !== 'Penalties Waived' && selectedInfractionPreset !== 'Active Account') {
        penaltyStatus = {
          sixthReward: matchedPreset.sixthReward,
          ninthReward: matchedPreset.ninthReward,
          twelfthReward: matchedPreset.twelfthReward,
          appliedPenalties: [matchedPreset.desc]
        };
      }

      if (isCleared || selectedInfractionPreset === 'No Violation till card clears') {
        slotsToSave = slotsToSave.map(s => {
          if (s.status === 'invalid' || s.status === 'to_clear') {
            return { status: 'empty' as const, date: '' };
          }
          return s;
        });
      }

      localStorage.setItem(`veyns_detailed_stamps_${identifierKey}`, JSON.stringify(slotsToSave));

      if (penaltyStatus && !isCleared) {
        localStorage.setItem(`veyns_fair_play_penalty_${identifierKey}`, JSON.stringify(penaltyStatus));
      } else {
        localStorage.removeItem(`veyns_fair_play_penalty_${identifierKey}`);
      }

      const validStamps = slotsToSave.filter(s => s.status === 'valid').map(s => s.date);
      localStorage.setItem(`veyns_stamps_${identifierKey}`, JSON.stringify(validStamps));
      if (identifierKey === 'admin') {
        localStorage.setItem(`veyns_loyalty_stamps`, JSON.stringify(validStamps));
      }

      window.dispatchEvent(new Event('storage'));
      alert(`Stamp card & penalties successfully updated and synced for ${stampTargetUser.name}!`);
    } catch (e) {}
    setStampTargetUser(null);
  };

  const togglePasswordVisibility = (identifier: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [identifier]: !prev[identifier] }));
  };

  const handleExitStore = () => {
    if (onBackToStore) {
      onBackToStore();
    } else {
      try {
        localStorage.setItem('veyns_active_view', 'store');
      } catch (e) {}
      window.location.reload();
    }
  };

  const totalGrossSales = orders.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrdersCount = orders.length;
  const averageOrderValue = totalOrdersCount > 0 ? totalGrossSales / totalOrdersCount : 0;

  const getCustomerStampCount = (customerName: string, customerIdentifier?: string) => {
    try {
      const identifierKey = (customerIdentifier || customerName || 'default').toLowerCase().trim();
      const detailedSaved = localStorage.getItem(`veyns_detailed_stamps_${identifierKey}`);
      if (detailedSaved) {
        const parsed = JSON.parse(detailedSaved);
        if (Array.isArray(parsed)) {
          return parsed.filter((s: any) => s && s.status === 'valid').length;
        }
      }
      const userStamps = localStorage.getItem(`veyns_stamps_${identifierKey}`);
      if (userStamps) {
        const parsedStamps = JSON.parse(userStamps);
        if (Array.isArray(parsedStamps)) return parsedStamps.length;
      }
    } catch (e) {}

    const customerOrders = orders.filter((o) => (o.name || '').toLowerCase() === (customerName || '').toLowerCase());
    const uniqueDays = new Set(
      customerOrders.map((o) => {
        try {
          return new Date(o.date).toISOString().split('T')[0];
        } catch (e) {
          return o.date ? o.date.split(',')[0] : '';
        }
      })
    );
    return Math.min(12, uniqueDays.size);
  };

  return (
    <div className="min-h-screen bg-[#020b08] text-white p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-900/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lime-400 font-extrabold text-xs uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-lime-400 animate-pulse"></span> Employee & Admin Portal
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
              Employee Control & Sales Dashboard
            </h1>
            <p className="text-xs text-emerald-300/80">
              Live menu pricing, discounts, customer accounts, password recovery, and sales analytics.
            </p>
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
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'sales'
                ? 'bg-lime-400 text-black shadow-lg'
                : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'
            }`}
          >
            <BarChart2 className="h-4 w-4" /> Sales Analytics ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'customers'
                ? 'bg-lime-400 text-black shadow-lg'
                : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'
            }`}
          >
            <Users className="h-4 w-4" /> Customer Accounts & Passwords ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'menu'
                ? 'bg-lime-400 text-black shadow-lg'
                : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'
            }`}
          >
            <Tag className="h-4 w-4" /> Menu Pricing ({menuItems.length})
          </button>
          <button
            onClick={() => setActiveTab('promos')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'promos'
                ? 'bg-lime-400 text-black shadow-lg'
                : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'
            }`}
          >
            <DollarSign className="h-4 w-4" /> Promo Codes ({promos.length})
          </button>
        </div>

        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Gross Sales</span>
                <p className="text-3xl font-extrabold text-lime-400 font-display">{formatPeso(totalGrossSales)}</p>
                <p className="text-[11px] text-emerald-300/70">Calculated from completed orders</p>
              </div>

              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Orders Placed</span>
                <p className="text-3xl font-extrabold text-white font-display">{totalOrdersCount} Orders</p>
                <p className="text-[11px] text-emerald-300/70">Successful customer checkouts</p>
              </div>

              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Average Order Value</span>
                <p className="text-3xl font-extrabold text-amber-400 font-display">{formatPeso(averageOrderValue)}</p>
                <p className="text-[11px] text-emerald-300/70">Revenue per transaction</p>
              </div>
            </div>

            <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-lime-400" />
                  <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">
                    Completed Order Transactions Log
                  </h3>
                </div>
                {orders.length > 0 && (
                  <Button
                    onClick={handleClearSalesLog}
                    size="sm"
                    className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
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
                        <th className="p-3">Fulfillment</th>
                        <th className="p-3">Items Summary</th>
                        <th className="p-3">Loyalty Stamps (12 Total)</th>
                        <th className="p-3">Promo</th>
                        <th className="p-3 text-right">Total (₱)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-950">
                      {orders.map((order, idx) => {
                        const stampCount = getCustomerStampCount(order.name, order.email || order.phone || order.name);
                        return (
                          <tr key={idx} className="hover:bg-[#071F19]/50 transition-colors">
                            <td className="p-3 font-extrabold text-lime-400">{order.orderNumber}</td>
                            <td className="p-3">
                              <p className="font-bold text-white">{order.name}</p>
                              <p className="text-[10px] text-emerald-300">{order.phone || order.email || 'No contact provided'}</p>
                            </td>
                            <td className="p-3">
                              <span className="inline-block bg-[#082d22] text-lime-400 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase">
                                {order.fulfillment}
                              </span>
                            </td>
                            <td className="p-3 space-y-0.5 max-w-xs">
                              {order.items.map((it: any, i: number) => (
                                <div key={i} className="text-emerald-200">
                                  {it.qty}x {it.item.name}
                                </div>
                              ))}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 12 }).map((_, sIdx) => {
                                    const isEarned = sIdx < stampCount;
                                    return (
                                      <span
                                        key={sIdx}
                                        title={`Stamp #${sIdx + 1} ${isEarned ? '(Earned)' : '(Pending)'}`}
                                        className={`text-sm ${isEarned ? 'text-lime-400 font-extrabold' : 'text-emerald-700 opacity-60'}`}
                                      >
                                        {isEarned ? '●' : '○'}
                                      </span>
                                    );
                                  })}
                                </div>
                                <span className="text-[10px] font-extrabold text-lime-400">
                                  {stampCount} out of 12 stamps
                                </span>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-amber-400">{order.promoCode || '—'}</td>
                            <td className="p-3 text-right font-extrabold text-lime-400 text-sm">{formatPeso(order.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-lime-400" />
                <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">
                  Registered Customer Accounts, Passwords & Management
                </h3>
              </div>
            </div>

            <p className="text-xs text-emerald-300/80">
              View customer nicknames, Gmail/phone identifiers, passwords, reset passwords, manage stamps, or delete accounts.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-emerald-100">
                <thead className="bg-[#071F19] text-emerald-300 uppercase text-[10px] tracking-wider border-b border-emerald-800/60">
                  <tr>
                    <th className="p-3">Customer Nickname</th>
                    <th className="p-3">Gmail / Phone Identifier</th>
                    <th className="p-3">Password</th>
                    <th className="p-3">Account Type</th>
                    <th className="p-3 text-right">Actions (Stamps, Reset & Delete)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-950">
                  {customers.map((cust, idx) => {
                    const identifierKey = cust.identifier.toLowerCase().trim();
                    const plainPassword = localStorage.getItem(`veyns_pwd_plain_${identifierKey}`) || (identifierKey === 'admin' ? 'admin' : 'Not recorded');
                    const isVisible = visiblePasswords[cust.identifier];

                    return (
                      <tr key={idx} className="hover:bg-[#071F19]/50 transition-colors">
                        <td className="p-3 font-bold text-white">{cust.name}</td>
                        <td className="p-3 text-lime-400 font-mono">{cust.identifier}</td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-2">
                            <span>{isVisible ? plainPassword : '••••••••'}</span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(cust.identifier)}
                              className="text-emerald-400 hover:text-white cursor-pointer p-1"
                              title={isVisible ? 'Hide Password' : 'Show Password'}
                            >
                              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-block bg-[#082d22] text-lime-400 border border-emerald-700/60 px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase">
                            {cust.type || 'Regular'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button
                            onClick={() => openStampManager(cust)}
                            size="sm"
                            className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Award className="h-3.5 w-3.5" /> Manage Stamps
                          </Button>

                          <Button
                            onClick={() => {
                              setResetTargetUser(cust);
                              setNewTempPassword('Veyns' + Math.floor(1000 + Math.random() * 9000));
                            }}
                            size="sm"
                            className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Reset Password
                          </Button>

                          <Button
                            onClick={() => handleDeleteCustomer(cust.identifier)}
                            size="sm"
                            className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
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

        {activeTab === 'menu' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide border-b border-emerald-900/60 pb-3">
              Manage Menu Prices & Discounts
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => {
                const discountPct = item.discountPercent || 0;
                const effectivePrice = discountPct > 0 ? item.price * (1 - discountPct / 100) : item.price;
                const isAvailable = item.isAvailable !== false;

                return (
                  <div
                    key={item.id}
                    className={`bg-[#061d16] border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                      isAvailable ? 'border-emerald-800/80' : 'border-red-900/60 opacity-60'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 rounded-xl bg-[#08291f] overflow-hidden shrink-0 border border-emerald-800/50 flex items-center justify-center">
                            <Photo id={item.id} alt={item.name} className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <h4 className="font-display font-bold text-white text-sm">{item.name}</h4>
                            <span className="text-[10px] text-emerald-400/80 uppercase font-semibold">{item.category}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            isAvailable ? 'bg-lime-400/20 text-lime-400 border border-lime-400/40' : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
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
                      <Button
                        onClick={() => handleToggleAvailability(item.id)}
                        size="sm"
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer ${
                          isAvailable
                            ? 'bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/60'
                            : 'bg-emerald-950 hover:bg-emerald-900 text-lime-400 border border-emerald-800'
                        }`}
                      >
                        {isAvailable ? 'Hide Item' : 'Show Item'}
                      </Button>

                      <Button
                        onClick={() => {
                          setEditingItem(item);
                          setEditPrice(item.price.toString());
                          setEditDiscount((item.discountPercent || 0).toString());
                        }}
                        size="sm"
                        className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-bold text-xs px-4 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit Price & Discount
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'promos' && (
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide border-b border-emerald-900/60 pb-3">
              Promo Codes Manager
            </h3>

            <form onSubmit={handleAddPromo} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Promo Code Name</label>
                <input
                  type="text"
                  placeholder="e.g. VEYNS15"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value)}
                  className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white uppercase placeholder:normal-case placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Percentage (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 15"
                  value={newPromoDiscount}
                  onChange={(e) => setNewPromoDiscount(e.target.value)}
                  className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Promo Code
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Active Promo Codes ({promos.length})</h4>
              {promos.length === 0 ? (
                <p className="text-xs text-emerald-400/60 py-6 text-center">No active promo codes.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {promos.map((p, idx) => (
                    <div key={idx} className="bg-[#061d16] border border-emerald-800/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-extrabold text-lime-400 text-sm">{p.code}</span>
                        <p className="text-[11px] text-emerald-300">{p.discountPercent}% Discount</p>
                      </div>
                      <button
                        onClick={() => handleDeletePromo(p.code)}
                        className="text-red-400 hover:text-red-300 p-1.5 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          {editingItem && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-xl font-extrabold text-white">
                  Edit Price & Discount: {editingItem.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Update the base price or apply a percentage discount.
                </DialogDescription>
              </div>

              <div className="space-y-4 my-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-lime-400 uppercase tracking-wider block">Base Price (₱)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-lime-400 uppercase tracking-wider block">Discount (% OFF)</label>
                    <input
                      type="number"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-lime-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveItemEdit}
                  className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg"
                >
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        <Dialog open={!!resetTargetUser} onOpenChange={(open) => !open && setResetTargetUser(null)}>
          {resetTargetUser && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-xl font-extrabold text-white">
                  Reset Password for {resetTargetUser.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Identifier: <span className="font-mono text-lime-400">{resetTargetUser.identifier}</span>
                </DialogDescription>
              </div>

              <div className="space-y-3 my-4 text-xs">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Set New Temporary Password</label>
                <input
                  type="text"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-lime-400"
                  placeholder="Enter new password"
                />
                <p className="text-[11px] text-emerald-400/70">
                  ℹ️ This will update the secure password and let the customer log in immediately.
                </p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button
                  onClick={() => setResetTargetUser(null)}
                  className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResetPasswordSubmit}
                  className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg"
                >
                  Confirm Reset Password
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        <Dialog open={!!stampTargetUser} onOpenChange={(open) => !open && setStampTargetUser(null)}>
          {stampTargetUser && (
            <DialogContent className="max-w-xl w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-xl font-extrabold text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-lime-400" /> Fair Play Stamp Manager: {stampTargetUser.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Click slot status to toggle: <span className="text-lime-400 font-bold">Valid</span> ➔ <span className="text-amber-400 font-bold">To Be Cleared (Orange)</span> ➔ <span className="text-red-400 font-bold">Invalid</span>.
                </DialogDescription>
              </div>

              <div className="my-4 space-y-4 text-xs">
                <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block text-[11px]">
                    📋 Select Status / Infraction Rule:
                  </label>
                  <select
                    value={selectedInfractionPreset}
                    onChange={(e) => setSelectedInfractionPreset(e.target.value)}
                    className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-3 text-xs text-white font-medium focus:outline-none focus:border-lime-400"
                  >
                    {infractionPresets.map((preset, pIdx) => (
                      <option key={pIdx} value={preset.label}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-emerald-400/70">
                    ℹ️ "Active Account", "Penalties Waived", and "No Violation till card clears" completely clear all penalties and notices from the customer view.
                  </p>
                </div>

                <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 text-center space-y-1">
                  <p className="text-xs text-emerald-300">Active Valid Stamps:</p>
                  <p className="text-3xl font-black text-lime-400 font-display">
                    {customerStampsDetailed.filter(s => s.status === 'valid').length} / 12 Stamps
                  </p>
                  <p className="text-[10px] text-amber-400 font-semibold">
                    {customerStampsDetailed.filter(s => s.status === 'to_clear' || s.status === 'invalid').length} slot(s) pending clearance.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const stampEntry = customerStampsDetailed[idx];
                    const status = stampEntry ? stampEntry.status : 'empty';
                    const isSixth = idx === 5;
                    const isNinth = idx === 8;
                    const isTwelfth = idx === 11;

                    return (
                      <div
                        key={idx}
                        className={`relative aspect-square rounded-xl border flex flex-col items-center justify-between p-1.5 text-center transition-all ${
                          status === 'valid'
                            ? 'bg-[#082d22] border-lime-400 text-lime-400 shadow-md'
                            : status === 'to_clear'
                            ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md animate-pulse'
                            : status === 'invalid'
                            ? 'bg-red-950/90 border-red-500 text-red-300 shadow-md'
                            : 'bg-[#041913] border-emerald-800/60 text-emerald-600'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full px-1">
                          <span className="text-[9px] font-mono opacity-80">#{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...customerStampsDetailed];
                              const todayStr = new Date().toISOString().split('T')[0];

                              while (updated.length <= idx) {
                                updated.push({ status: 'empty', date: '' });
                              }

                              if (status === 'empty' || status === 'invalid') {
                                updated[idx] = { status: 'valid', date: todayStr };
                              } else if (status === 'valid') {
                                updated[idx] = { status: 'to_clear', date: todayStr, penaltyReason: 'To Be Cleared' };
                              } else if (status === 'to_clear') {
                                updated[idx] = { status: 'empty', date: '', penaltyReason: undefined };
                              } else {
                                updated[idx] = { status: 'empty', date: '', penaltyReason: undefined };
                              }

                              setCustomerStampsDetailed(updated);
                            }}
                            className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-black/50 hover:bg-black text-white cursor-pointer"
                          >
                            {status === 'empty' ? 'Add' : status === 'valid' ? 'Mark Cleared' : status === 'to_clear' ? 'Make Empty' : 'Clear'}
                          </button>
                        </div>

                        <div className="flex flex-col items-center justify-center my-auto">
                          {status === 'valid' && <CheckCircle2 className="size-5 text-lime-400 mb-0.5" />}
                          {status === 'to_clear' && <Clock className="size-5 text-amber-400 mb-0.5" />}
                          {status === 'invalid' && <XCircle className="size-5 text-red-400 mb-0.5" />}
                          {status === 'empty' && <span className="text-[10px] text-emerald-600 font-mono">Slot #{idx + 1}</span>}
                        </div>

                        {isSixth && (
                          <span className="absolute -top-2 -right-1 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full z-10">
                            25% OFF
                          </span>
                        )}
                        {isNinth && (
                          <span className="absolute -top-2 -right-1 bg-amber-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full z-10">
                            50% OFF
                          </span>
                        )}
                        {isTwelfth && (
                          <span className="absolute -top-2 -right-1 bg-lime-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full z-10">
                            FREE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-[#04140f] border border-emerald-900/80 rounded-xl p-3 space-y-1.5 text-[11px] text-emerald-300">
                  <p className="font-bold text-lime-400 uppercase tracking-wider">🚨 Slot Rules:</p>
                  <ul className="list-disc list-inside space-y-1 text-emerald-200">
                    <li><strong className="text-amber-400">Orange Clock:</strong> Slot is marked "To Be Cleared".</li>
                    <li>Selecting <strong>"Active Account"</strong>, <strong>"Penalties Waived"</strong>, or <strong>"No Violation till card clears"</strong> clears all penalties and notice banners from the customer view.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button
                  onClick={() => setStampTargetUser(null)}
                  className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveStamps}
                  className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg"
                >
                  Save & Sync Account Views
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}

export default EmployeeDashboard;