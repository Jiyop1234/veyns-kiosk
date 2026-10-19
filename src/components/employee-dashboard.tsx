// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, Tag, DollarSign, ShoppingBag, BarChart2, Users, KeyRound, Eye, EyeOff, Award, CheckCircle2, AlertTriangle, XCircle, Clock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MENU_GRID, formatPeso, getActivePromoCodes } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { supabase } from '@/lib/supabase';

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

export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<'sales' | 'menu' | 'promos' | 'customers'>('menu');

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);

  // Form states for adding/editing menu items
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Rice Bowls');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDiscount, setItemDiscount] = useState('');
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [promos, setPromos] = useState<any[]>([]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');

  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [resetTargetUser, setResetTargetUser] = useState<any>(null);
  const [newTempPassword, setNewTempPassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});

  const [editIdentifierUser, setEditIdentifierUser] = useState<any>(null);
  const [newIdentifierInput, setNewIdentifierInput] = useState('');

  const [stampTargetUser, setStampTargetUser] = useState<any>(null);
  const [customerStampsDetailed, setCustomerStampsDetailed] = useState<{ status: 'valid' | 'invalid' | 'to_clear' | 'empty'; date: string; penaltyReason?: string }[]>([]);
  const [selectedInfractionPreset, setSelectedInfractionPreset] = useState('Active Account');

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
    fetchCloudData();

    const orderChannel = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchCloudData();
      })
      .subscribe();

    const menuChannel = supabase
      .channel('public:menu_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchCloudData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(menuChannel);
    };
  }, []);

  const fetchCloudData = async () => {
    try {
      // 1. Fetch Menu Items from Supabase Database
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
          image: m.image_url
        }));
        setMenuItems(formattedMenu);
        localStorage.setItem('veyns_manageable_menu', JSON.stringify(formattedMenu));
      } else {
        // Seed database automatically if table is empty
        for (const item of MENU_GRID) {
          await supabase.from('menu_items').upsert({
            id: item.id,
            name: item.name,
            category: item.category,
            description: item.description,
            price: item.price,
            discount_percent: item.discountPercent || 0,
            is_available: item.isAvailable !== false,
            image_url: menuImages[item.id] || ''
          }, { onConflict: 'id' });
        }
        setMenuItems(MENU_GRID);
      }

      // 2. Fetch Orders
      const { data: cloudOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (cloudOrders) {
        setOrders(cloudOrders.map((o: any) => ({
          name: o.customer_name,
          email: o.email || '',
          phone: o.phone || '',
          fulfillment: o.fulfillment || 'delivery',
          items: o.items || [],
          total: o.total || 0,
          orderNumber: o.order_number,
          date: new Date(o.created_at).toLocaleString(),
          promoCode: o.promo_code
        })));
      }

      // 3. Fetch Profiles
      const { data: cloudProfiles } = await supabase.from('profiles').select('*');
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

          return {
            name: p.name || 'Valued Regular',
            identifier: p.identifier,
            type: p.role || 'regular',
            stamps_data: p.stamps_data,
            penalty_data: p.penalty_data
          };
        });
        setCustomers(formattedProfiles);
      } else {
        setCustomers([
          { name: 'Admin Regular', identifier: 'admin', type: 'regular' },
          { name: 'Geoff Perez', identifier: 'geoff@gmail.com', type: 'regular' }
        ]);
      }
    } catch (e) {
      console.error('Error fetching cloud data:', e);
      setMenuItems(MENU_GRID);
    }
    setPromos(getActivePromoCodes());
  };

  const uploadImageToSupabase = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('menu-images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

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
      image_url: imageUrl
    };

    try {
      const { error } = await supabase.from('menu_items').upsert(newItemData, { onConflict: 'id' });
      if (error) throw error;
      alert(`Menu item successfully saved to database!`);
    } catch (err) {
      console.error(err);
      alert('Error saving menu item to database.');
    }

    setEditingItem(null);
    setIsAddingNewItem(false);
    setItemName('');
    setItemDescription('');
    setItemPrice('');
    setItemDiscount('');
    setItemImageFile(null);
    setImagePreviewUrl('');
    fetchCloudData();
  };

  const handleToggleAvailability = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      await supabase.from('menu_items').update({ is_available: newStatus }).eq('id', id);
      fetchCloudData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item from the database?')) return;
    try {
      await supabase.from('menu_items').delete().eq('id', id);
      fetchCloudData();
    } catch (e) {
      console.error(e);
    }
  };

  const saveActivePromoCodes = (codes: any[]) => {
    try {
      localStorage.setItem('veyns_promo_codes', JSON.stringify(codes));
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

  const handleUpdateIdentifierSubmit = async () => {
    if (!editIdentifierUser || !newIdentifierInput) return;
    const oldIdentifierKey = editIdentifierUser.identifier.toLowerCase().trim();
    const newIdentifierKey = newIdentifierInput.toLowerCase().trim();

    try {
      await supabase
        .from('profiles')
        .update({ identifier: newIdentifierKey })
        .eq('identifier', oldIdentifierKey);

      const plainPass = localStorage.getItem(`veyns_pwd_plain_${oldIdentifierKey}`);
      const hashPass = localStorage.getItem(`veyns_pwd_hash_${oldIdentifierKey}`);
      const detailedStamps = localStorage.getItem(`veyns_detailed_stamps_${oldIdentifierKey}`);
      const userStamps = localStorage.getItem(`veyns_stamps_${oldIdentifierKey}`);
      const penalty = localStorage.getItem(`veyns_fair_play_penalty_${oldIdentifierKey}`);

      if (plainPass) localStorage.setItem(`veyns_pwd_plain_${newIdentifierKey}`, plainPass);
      if (hashPass) localStorage.setItem(`veyns_pwd_hash_${newIdentifierKey}`, hashPass);
      if (detailedStamps) localStorage.setItem(`veyns_detailed_stamps_${newIdentifierKey}`, detailedStamps);
      if (userStamps) localStorage.setItem(`veyns_stamps_${newIdentifierKey}`, userStamps);
      if (penalty) localStorage.setItem(`veyns_fair_play_penalty_${newIdentifierKey}`, penalty);

      localStorage.removeItem(`veyns_pwd_plain_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_pwd_hash_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_stamps_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_detailed_stamps_${oldIdentifierKey}`);
      localStorage.removeItem(`veyns_fair_play_penalty_${oldIdentifierKey}`);

      alert(`Login identifier successfully updated to "${newIdentifierInput}" for ${editIdentifierUser.name}!`);
    } catch (e) {
      console.error(e);
    }

    setEditIdentifierUser(null);
    setNewIdentifierInput('');
    fetchCloudData();
  };

  const handleDeleteCustomer = async (identifier: string) => {
    if (!confirm('Are you sure you want to delete this customer account?')) return;
    try {
      const identifierKey = identifier.toLowerCase().trim();
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
      } else if (cust.stamps_data && Array.isArray(cust.stamps_data)) {
        const normalized = Array.from({ length: 12 }).map((_, idx) => {
          return cust.stamps_data[idx] || { status: 'empty', date: '' };
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

  const handleSaveStamps = async () => {
    if (!stampTargetUser) return;
    try {
      const identifierKey = stampTargetUser.identifier.toLowerCase().trim();
      
      const isCleanPreset = 
        selectedInfractionPreset === 'Active Account' || 
        selectedInfractionPreset === 'Penalties Waived' || 
        selectedInfractionPreset === 'No Violation till card clears';

      let slotsToSave = customerStampsDetailed;

      if (selectedInfractionPreset === 'No Violation till card clears') {
        slotsToSave = Array.from({ length: 12 }).map(() => ({ status: 'empty', date: '' }));
      }

      const matchedPreset = !isCleanPreset 
        ? infractionPresets.find(p => p.label === selectedInfractionPreset || p.desc === selectedInfractionPreset) 
        : null;
      
      let penaltyStatus = null;
      if (matchedPreset && !isCleanPreset) {
        penaltyStatus = {
          sixthReward: matchedPreset.sixthReward,
          ninthReward: matchedPreset.ninthReward,
          twelfthReward: matchedPreset.twelfthReward,
          appliedPenalties: [matchedPreset.label]
        };
      }

      if (isCleanPreset) {
        slotsToSave = slotsToSave.map(s => {
          if (s.status === 'invalid' || s.status === 'to_clear') {
            return { status: 'empty' as const, date: '' };
          }
          return s;
        });
      }

      localStorage.setItem(`veyns_detailed_stamps_${identifierKey}`, JSON.stringify(slotsToSave));
      
      if (penaltyStatus) {
        localStorage.setItem(`veyns_fair_play_penalty_${identifierKey}`, JSON.stringify(penaltyStatus));
      } else {
        localStorage.removeItem(`veyns_fair_play_penalty_${identifierKey}`);
      }

      const validStamps = slotsToSave.filter(s => s.status === 'valid').map(s => s.date);
      localStorage.setItem(`veyns_stamps_${identifierKey}`, JSON.stringify(validStamps));

      try {
        await supabase
          .from('profiles')
          .update({
            stamps_data: slotsToSave,
            penalty_data: penaltyStatus
          })
          .eq('identifier', identifierKey);
      } catch (cloudErr) {
        console.warn('Cloud sync warning:', cloudErr);
      }

      window.dispatchEvent(new Event('storage'));
      alert(`Stamp card & penalties successfully synced for ${stampTargetUser.name}!`);
      fetchCloudData();
    } catch (e) {
      console.error(e);
    }
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
    } catch (e) {}
    return 0;
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
            <Users className="h-4 w-4" /> Customer Accounts ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'menu'
                ? 'bg-lime-400 text-black shadow-lg'
                : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'
            }`}
          >
            <Tag className="h-4 w-4" /> Menu Manager ({menuItems.length})
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
                        <th className="p-3">Loyalty Stamps</th>
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
                            <td className="p-3 font-extrabold text-lime-400">{stampCount} / 12</td>
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
                  Registered Customer Accounts & Passwords
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-emerald-100">
                <thead className="bg-[#071F19] text-emerald-300 uppercase text-[10px] tracking-wider border-b border-emerald-800/60">
                  <tr>
                    <th className="p-3">Customer Nickname</th>
                    <th className="p-3">Gmail / Phone Identifier</th>
                    <th className="p-3">Password</th>
                    <th className="p-3">Account Type</th>
                    <th className="p-3 text-right">Actions</th>
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
                        <td className="p-3 text-lime-400 font-mono">
                          <span>{cust.identifier}</span>
                        </td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-2">
                            <span>{isVisible ? plainPassword : '••••••••'}</span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(cust.identifier)}
                              className="text-emerald-400 hover:text-white cursor-pointer p-1"
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
                            className="bg-[#04261d] hover:bg-emerald-900 text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            <Award className="h-3.5 w-3.5 mr-1" /> Stamps
                          </Button>
                          <Button
                            onClick={() => {
                              setResetTargetUser(cust);
                              setNewTempPassword('Veyns' + Math.floor(1000 + Math.random() * 9000));
                            }}
                            size="sm"
                            className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Password
                          </Button>
                          <Button
                            onClick={() => handleDeleteCustomer(cust.identifier)}
                            size="sm"
                            className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
          <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">
                Database Menu Manager (Live Sync)
              </h3>
              <Button
                onClick={() => {
                  setItemName('');
                  setItemCategory('Rice Bowls');
                  setItemDescription('');
                  setItemPrice('');
                  setItemDiscount('');
                  setItemImageFile(null);
                  setImagePreviewUrl('');
                  setEditingItem(null);
                  setIsAddingNewItem(true);
                }}
                className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer flex items-center gap-2 shadow-lg"
              >
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
                            <h4 className="font-display font-bold text-white text-sm">{item.name}</h4>
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
                        <Button
                          onClick={() => handleToggleAvailability(item.id, isAvailable)}
                          size="sm"
                          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl cursor-pointer ${isAvailable ? 'bg-red-950/60 text-red-300 border border-red-800/60' : 'bg-emerald-950 text-lime-400 border border-emerald-800'}`}
                        >
                          {isAvailable ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          onClick={() => handleDeleteMenuItem(item.id)}
                          size="sm"
                          className="bg-red-950/40 hover:bg-red-900 text-red-400 border border-red-900/60 px-2.5 py-1.5 rounded-xl text-[11px] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Button
                        onClick={() => {
                          setEditingItem(item);
                          setItemName(item.name);
                          setItemCategory(item.category || 'Rice Bowls');
                          setItemDescription(item.description || '');
                          setItemPrice(item.price.toString());
                          setItemDiscount((item.discountPercent || 0).toString());
                          setImagePreviewUrl(displayImage || '');
                          setIsAddingNewItem(true);
                        }}
                        size="sm"
                        className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit Item
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
                  className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white uppercase placeholder:normal-case focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Discount Percentage (%)</label>
                <input
                  type="number"
                  placeholder="e.g. 15"
                  value={newPromoDiscount}
                  onChange={(e) => setNewPromoDiscount(e.target.value)}
                  className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-lime-400"
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

        {/* Modal for Adding or Editing Menu Item */}
        <Dialog open={isAddingNewItem} onOpenChange={(open) => !open && setIsAddingNewItem(false)}>
          <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/85 shadow-2xl p-6 rounded-3xl max-h-[95vh] overflow-y-auto">
            <div className="space-y-1 border-b border-emerald-900/60 pb-3">
              <DialogTitle className="font-display text-xl font-extrabold text-white">
                {editingItem ? `Edit Menu Item: ${editingItem.name}` : 'Add New Menu Item'}
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-300">
                Upload photo, update price, description, and sync directly to the database.
              </DialogDescription>
            </div>

            <form onSubmit={handleSaveNewOrEditedItem} className="space-y-4 my-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Item Name</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Pork Sisig Rice Bowl"
                  className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Category</label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400"
                >
                  <option value="Rice Bowls">Rice Bowls</option>
                  <option value="Meals & Specialties">Meals & Specialties</option>
                  <option value="Desserts & Sweets">Desserts & Sweets</option>
                  <option value="Apparel & Merch">Apparel & Merch</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Price (₱)</label>
                  <input
                    type="number"
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="109"
                    className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-amber-400 uppercase tracking-wider block">Discount (% OFF)</label>
                  <input
                    type="number"
                    value={itemDiscount}
                    onChange={(e) => setItemDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-lime-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Description</label>
                <textarea
                  rows={2}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Crispy pork sisig served over warm garlic rice..."
                  className="w-full bg-[#041913] border border-emerald-800/80 rounded-xl p-3 text-white focus:outline-none focus:border-lime-400"
                />
              </div>

              <div className="space-y-2">
                <label className="font-bold text-lime-400 uppercase tracking-wider block">Menu Item Photo Upload</label>
                <div className="flex items-center gap-3 bg-[#041913] border border-emerald-800/80 rounded-xl p-3">
                  <div className="h-12 w-12 rounded-lg bg-[#08291f] overflow-hidden shrink-0 border border-emerald-800/50 flex items-center justify-center">
                    <Photo src={imagePreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setItemImageFile(file);
                          setImagePreviewUrl(URL.createObjectURL(file));
                        }
                      }}
                      className="text-[10px] text-emerald-300 w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-extrabold file:bg-[#082d22] file:text-lime-400 hover:file:bg-lime-400 hover:file:text-black cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
                <Button
                  type="button"
                  onClick={() => setIsAddingNewItem(false)}
                  className="flex-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold py-3 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs cursor-pointer shadow-lg"
                >
                  Save to Database
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog for Stamp Manager */}
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
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const stampEntry = customerStampsDetailed[idx];
                    const status = stampEntry ? stampEntry.status : 'empty';

                    let selectValue = 'empty';
                    if (status === 'valid') selectValue = 'valid';
                    else if (status === 'to_clear') selectValue = 'to_clear';
                    else if (status === 'invalid') selectValue = 'invalid';

                    return (
                      <div
                        key={idx}
                        className={`relative aspect-square rounded-xl border flex flex-col items-center justify-between p-1.5 text-center transition-all ${
                          status === 'valid'
                            ? 'bg-[#082d22] border-lime-400 text-lime-400 shadow-md'
                            : status === 'to_clear'
                            ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md'
                            : status === 'invalid'
                            ? 'bg-red-950/90 border-red-500 text-red-300 shadow-md'
                            : 'bg-[#041913] border-emerald-800/60 text-emerald-600'
                        }`}
                      >
                        <span className="text-[9px] font-mono opacity-80">#{idx + 1}</span>
                        <select
                          value={selectValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...customerStampsDetailed];
                            const todayStr = new Date().toISOString().split('T')[0];

                            while (updated.length <= idx) {
                              updated.push({ status: 'empty', date: '' });
                            }

                            if (val === 'valid') {
                              updated[idx] = { status: 'valid', date: todayStr };
                            } else if (val === 'to_clear') {
                              updated[idx] = { status: 'to_clear', date: todayStr, penaltyReason: 'To Be Cleared' };
                            } else if (val === 'invalid') {
                              updated[idx] = { status: 'invalid', date: todayStr, penaltyReason: 'Invalidated' };
                            } else {
                              updated[idx] = { status: 'empty', date: '' };
                            }

                            setCustomerStampsDetailed(updated);
                          }}
                          className="w-full bg-black/80 border border-emerald-800 text-[10px] text-lime-300 rounded px-1 py-0.5 focus:outline-none cursor-pointer text-center font-bold"
                        >
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