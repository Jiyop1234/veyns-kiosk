// @ts-nocheck
// SECTION 1: Imports for React, UI components, menu data, cart state, and Supabase.
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Camera, Check, CreditCard, Facebook, Instagram, MapPin, Minus, Plus, Search, ShoppingBag, Star, Trash2, Truck, User, History, Award, AlertTriangle, XCircle, Clock, Navigation, Calendar, UserPlus, Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MENU_GRID, UPSELL_ITEMS, CATEGORIES, formatPeso, getActivePromoCodes } from '@/lib/menu-data';
import { menuImages } from '@/lib/menu-images';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';

// SECTION 2: Shared menu-image component with a branded fallback when no image is available.
function Photo({ id, dbImage, alt, className }: { id: string; dbImage?: string; alt: string; className: string }) {
  const src = dbImage || menuImages[id];
  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#0d2e26] font-display text-sm font-bold text-[#d4af37]`}>
        VEYNS
      </div>
    );
  }
  return <img src={src} alt={alt} width={512} height={512} className={className} />;
}

// SECTION 3: Main ordering experience, including menu browsing, checkout, order history, and loyalty UI.
export function OrderingCounter({ showMyOrders, setShowMyOrders, orderHistory, setOrderHistory, resetKey, currentUser, onOrderPlacedSuccess, onOpenRegister }: any) {
  // SECTION 4: Cart access and local state for menu browsing, promotions, loyalty, and slot availability.
  const { add, lines, setLineQty, remove, clear, total } = useCart();
  const [category, setCategory] = useState('All items');
  const [search, setSearch] = useState('');

  const [currentMenuGrid, setCurrentMenuGrid] = useState<any[]>([]);
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);

  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [fairPlayPenalty, setFairPlayPenalty] = useState<any>(null);

  // Slot capacities & Fully Booked states
  const [slotCapacities, setSlotCapacities] = useState<Record<string, any>>({});

  // SECTION 5: Customer type and ordering-time eligibility checks.
  const isGuest = !currentUser || currentUser.role === 'guest' || (currentUser.name && currentUser.name.toLowerCase().includes('guest')) || (currentUser.identifier && currentUser.identifier.toLowerCase().includes('guest'));

  // Helper to check if "Order Today" is allowed in Philippine Time (Asia/Manila)
  // Closed from 12:00 AM (00:00) until 12:00 PM (12:00)
  const isOrderTodayAllowed = () => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat([], options);
      const hourInPhilippines = parseInt(formatter.format(new Date()), 10);
      return !(hourInPhilippines >= 0 && hourInPhilippines < 12);
    } catch (e) {
      const currentHour = new Date().getHours();
      return !(currentHour >= 0 && currentHour < 12);
    }
  };

  const orderTodayOpen = isOrderTodayAllowed();

  // SECTION 6: Load scheduling capacity, promotions, loyalty information, and menu configuration.
  // Real-time voucher expiry ticker & auto-purge task
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNowTimestamp(current);

      setAppliedPromos((prev) =>
        prev.filter((p) => {
          if (!p.expiryDurationMs || p.expiryDurationMs <= 0) return true;
          const expiresAt = p.createdAt + p.expiryDurationMs;
          return current < expiresAt;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadPromosFromCloud = async () => {
    try {
      const { data: cloudPromos, error } = await supabase.from('promos').select('*');
      if (cloudPromos && cloudPromos.length > 0) {
        const formatted = cloudPromos.map((p: any) => ({
          code: p.code,
          type: p.type,
          discountValue: Number(p.discount_value),
          targetType: p.target_type || p.scope || 'subtotal',
          visibility: p.visibility,
          expiryDurationMs: Number(p.expiry_duration_ms),
          usageLimit: p.usage_limit ? Number(p.usage_limit) : null,
          usageCount: Number(p.usage_count || 0),
          createdAt: Number(p.created_at || Date.now())
        }));
        setAvailablePromos(formatted);
      } else {
        setAvailablePromos(getActivePromoCodes());
      }
    } catch (e) {
      setAvailablePromos(getActivePromoCodes());
    }
  };

  const loadUserStampsAndPenalties = async () => {
    if (!currentUser || isGuest || !currentUser.authUserId) { setStamps([]); setFairPlayPenalty(null); return; }
    const { data: profile, error } = await supabase.from('profiles')
      .select('stamps_data,penalty_data').eq('auth_user_id', currentUser.authUserId).single();
    if (error || !profile) { setStamps(Array.from({ length: 12 }, () => ({ status: 'empty', date: '' }))); setFairPlayPenalty(null); return; }
    setStamps(Array.from({ length: 12 }).map((_, idx) => profile.stamps_data?.[idx] || { status: 'empty', date: '' }));
    setFairPlayPenalty(profile.penalty_data || null);
  };

  // SECTION 7: Merge Supabase menu records with the existing local menu data and sort the result.
  const loadMenuFromCloud = async () => {
    let mergedMenu = [...MENU_GRID];

    // Load slot capacities from Supabase
  const loadSlotCapacities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('slot_capacities')
        .select('*');

      if (error) {
        console.error('Error fetching slot capacities:', error);
        return;
      }

      if (data && data.length > 0) {
        const capacitiesMap: Record<string, any> = {};
        data.forEach((slot: any) => {
          const key = `${slot.date_key}_${slot.slot_time}`;
          capacitiesMap[key] = slot;
        });
        setSlotCapacities(capacitiesMap);
      }
    } catch (err) {
      console.error('Failed to load slot capacities:', err);
    }
  }, []);

    try {
      const { data: cloudMenu, error } = await supabase.from('menu_items').select('*');
      if (cloudMenu && cloudMenu.length > 0) {
        const formatted = cloudMenu.map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          description: m.description,
          price: Number(m.price),
          discountPercent: Number(m.discount_percent || 0),
          isAvailable: m.is_available,
          bestSeller: m.best_seller,
          sortOrder: Number(m.sort_order || 100),
          isCustomizable: m.is_customizable,
          hasBrothEggOption: m.has_broth_egg_option,
          image: m.image_url,
          optionGroups: m.option_groups || []
        }));
        
        const cloudIds = new Set(formatted.map(item => item.id));
        const localOnly = MENU_GRID.filter(item => !cloudIds.has(item.id));
        mergedMenu = [...formatted, ...localOnly];
      }
    } catch (e) {
      console.error('Error fetching cloud menu:', e);
    }

    mergedMenu.sort((a, b) => {
      if (a.category === 'Apparel' && b.category !== 'Apparel') return 1;
      if (a.category !== 'Apparel' && b.category === 'Apparel') return -1;
      
      if (a.bestSeller && !b.bestSeller) return -1;
      if (!a.bestSeller && b.bestSeller) return 1;

      return (a.sortOrder || 100) - (b.sortOrder || 100);
    });

    setCurrentMenuGrid(mergedMenu);
  };

  // SECTION 8: Initial data loading, Supabase Realtime subscriptions, storage updates, and cleanup.
  useEffect(() => {
    if (typeof loadMenuFromCloud === 'function') loadMenuFromCloud();
    if (typeof loadUserStampsAndPenalties === 'function') loadUserStampsAndPenalties();
    if (typeof loadSlotCapacities === 'function') loadSlotCapacities();
    if (typeof loadPromosFromCloud === 'function') loadPromosFromCloud();

    const menuChannel = supabase
      .channel('public:menu_items_counter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        loadMenuFromCloud();
      })
      .subscribe();

    const slotsChannel = supabase
      .channel('public:slot_capacities_counter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_capacities' }, () => {
        if (typeof loadSlotCapacities === 'function') loadSlotCapacities();
      })
      .subscribe();

    const promosChannel = supabase
      .channel('public:promos_counter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, () => {
        loadPromosFromCloud();
      })
      .subscribe();

    const handleStorageChange = () => {
      loadMenuFromCloud();
      loadUserStampsAndPenalties();
      loadSlotCapacities();
      loadPromosFromCloud();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      supabase.removeChannel(slotsChannel);
    };
  }, []);

  // SECTION 9: State for item customization, upsells, checkout, customer details, and order scheduling.
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  
  // Dynamic Option Selections State for Customers
  const [selectedOptions, setSelectedOptions] = useState<{ [groupId: string]: string[] }>({});
  const [validationError, setValidationError] = useState('');

  const [showUpsell, setShowUpsell] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [internalShowMyOrders, setInternalShowMyOrders] = useState(false);
  const [addedItemName, setAddedItemName] = useState('');

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromos, setAppliedPromos] = useState<any[]>([]); // Stacking multiple vouchers
  const [promoError, setPromoError] = useState('');
  const [claimedVouchersState, setClaimedVouchersState] = useState<{ [code: string]: number }>({});

  const isOrdersOpen = showMyOrders !== undefined ? showMyOrders : internalShowMyOrders;
  const setIsOrdersOpen = setShowMyOrders || setInternalShowMyOrders;

  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('delivery');
  const [deliveryOption, setDeliveryOption] = useState<'our' | 'maxim'>('our');

  // Order Type & Scheduling States
  const [orderType, setOrderType] = useState<'today' | 'reservation'>(orderTodayOpen ? 'today' : 'reservation');
  const [todayTimeSlot, setTodayTimeSlot] = useState('12:00 PM - 1:00 PM');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('12:00 PM - 1:00 PM');

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Pre-fill the account's verified contact, while leaving the checkout inputs editable.
  const lastPrefilledIdentifierRef = useRef<string | null>(null);
  useEffect(() => {
    if (isGuest) {
      lastPrefilledIdentifierRef.current = null;
      return;
    }
    const identifier = String(currentUser?.identifier || '').trim();
    if (!identifier || lastPrefilledIdentifierRef.current === identifier) return;
    lastPrefilledIdentifierRef.current = identifier;
    if (identifier.includes('@')) {
      setCustomerEmail(identifier);
      setCustomerPhone('');
    } else {
      setCustomerPhone(identifier);
      setCustomerEmail('');
    }
  }, [currentUser?.identifier, isGuest]);
  const [customerLocation, setCustomerLocation] = useState('');
  const [nearestLandmark, setNearestLandmark] = useState('');

  // Distance & Delivery Fee states
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number>(0);
  const [isPinning, setIsPinning] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocodeTimeoutRef = useRef<any>(null);

  // SECTION 10: Delivery map references, store coordinates, distance calculation, and delivery-fee calculation.
  // TRUE STORE COORDINATES (Center Origin = 0.0 km)
  const STORE_LAT = 10.359511;
  const STORE_LNG = 123.952739;

  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const computeFeeFromKm = (km: number) => {
    if (km < 1.0) return 0; // Under 1km is free
    if (km <= 2.0) return 40; // 1km through 2km = ₱40 fixed
    const succeedingKm = km - 2.0;
    return 40 + Math.ceil(succeedingKm) * 5; // ₱40 base + ₱5 per succeeding km
  };

  useEffect(() => {
    if (showCheckout && fulfillment === 'delivery' && isPinning) {
      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = initMap;
        document.body.appendChild(script);
      } else {
        setTimeout(initMap, 100);
      }
    }
  }, [showCheckout, fulfillment, isPinning]);

  // SECTION 11: Initialize the delivery map and allow customers to choose a delivery location.
  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const customIcon = L.divIcon({
      className: 'custom-map-marker',
      html: '<div style="background-color: #a3e635; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #000; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const map = L.map(mapRef.current).setView([STORE_LAT, STORE_LNG], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const customerInitialLat = STORE_LAT;
    const customerInitialLng = STORE_LNG;

    const marker = L.marker([customerInitialLat, customerInitialLng], { draggable: true, icon: customIcon }).addTo(map);
    marker.bindPopup('<b>Store Location / Drag to your delivery pin!</b>').openPopup();
    markerInstanceRef.current = marker;

    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      await processSelectedCoordinates(pos.lat, pos.lng);
    });

    map.on('click', async (e: any) => {
      marker.setLatLng(e.latlng);
      await processSelectedCoordinates(e.latlng.lat, e.latlng.lng);
    });

    processSelectedCoordinates(customerInitialLat, customerInitialLng);
  };

  // SECTION 12: Process selected coordinates, calculate delivery costs, and look up a readable address.
  const processSelectedCoordinates = async (lat: number, lng: number) => {
    setDeliveryCoordinates({ lat, lng });
    const dist = calculateDistanceKm(STORE_LAT, STORE_LNG, lat, lng);
    const roundedDist = Number(dist.toFixed(3));
    setDeliveryDistanceKm(roundedDist);

    const fee = computeFeeFromKm(dist);
    setCalculatedDeliveryFee(fee);

    setCustomerLocation(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);

    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);

    geocodeTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
          headers: {
            'User-Agent': 'VeynsKioskDeliveryApp/1.0'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            setCustomerLocation(data.display_name);
          }
        }
      } catch (e) {
        // Fallback remains Lat/Lng
      }
    }, 600);
  };

  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsPinning(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (mapInstanceRef.current && markerInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16);
          markerInstanceRef.current.setLatLng([lat, lng]);
        }
        await processSelectedCoordinates(lat, lng);
      },
      () => {
        alert('Unable to retrieve your location. Please drop a pin on the map.');
      }
    );
  };

  // SECTION 13: Customer order-history state and per-customer storage key.
  const [internalOrderHistory, setInternalOrderHistory] = useState<any[]>([]);
  const historyList = orderHistory !== undefined ? orderHistory : internalOrderHistory;
  const setHistoryList = setOrderHistory || setInternalOrderHistory;

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState(null);

  const userIdentifier = isGuest ? 'guest_session_user' : (currentUser.email || currentUser.name || 'admin').toLowerCase().trim();
  const userHistoryStorageKey = `veyns_user_orders_${userIdentifier}`;

  // SECTION 14: Retrieve and normalize order history from Supabase and local/session storage.
  const refreshOrderHistoryFromStorage = async () => {
    try {
      if (!isGuest) {
        const { data: cloudOrders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', currentUser.authUserId)
          .order('created_at', { ascending: false });

        if (cloudOrders && cloudOrders.length > 0) {
          const formattedCloudOrders = cloudOrders.map((o: any) => ({
            name: o.customer_name,
            accountNickname: o.account_nickname || 'Guest',
            email: o.email || '',
            phone: o.phone || '',
            fulfillment: o.fulfillment || 'delivery',
            location: o.location || o.address || '',
            landmark: o.landmark || '',
            items: o.items || [],
            total: o.total || 0,
            orderNumber: o.order_number,
            date: new Date(o.created_at).toLocaleString(),
            promoCode: o.promo_code,
            orderType: o.order_type || 'today',
            scheduleInfo: o.schedule_info || 'Immediate / Today'
          }));
          setHistoryList(formattedCloudOrders);
          return;
        }
      }

      if (isGuest) {
        const saved = sessionStorage.getItem(userHistoryStorageKey);
        setHistoryList(saved ? JSON.parse(saved) : []);
      } else {
        const saved = localStorage.getItem(userHistoryStorageKey);
        if (saved) {
          setHistoryList(JSON.parse(saved));
        } else {
          const legacy = localStorage.getItem('veyns_order_history');
          if (legacy && userIdentifier.includes('admin')) {
            const parsedLegacy = JSON.parse(legacy);
            setHistoryList(parsedLegacy);
            localStorage.setItem(userHistoryStorageKey, JSON.stringify(parsedLegacy));
          } else {
            setHistoryList([]);
          }
        }
      }
    } catch (e) {
      setHistoryList([]);
    }
  };

  useEffect(() => {
    refreshOrderHistoryFromStorage();
  }, [currentUser]);

  useEffect(() => {
    if (showMyOrders !== undefined) {
      setInternalShowMyOrders(showMyOrders);
      if (showMyOrders) {
        refreshOrderHistoryFromStorage();
      }
    }
  }, [showMyOrders]);

  useEffect(() => {
    if (resetKey !== undefined) {
      setCategory('All items');
      setSearch('');
      setSelected(null);
      setShowUpsell(false);
      setShowCheckout(false);
      setAppliedPromos([]);
      setPromoInput('');
    }
  }, [resetKey]);

  // SECTION 15: Create orders only through the server-validated Supabase RPC.
  const saveOrderToHistory = async (newOrder: any) => {
    // Calculate total quantity of bowls ordered across all cart lines
    const totalBowlsCount = lines.reduce((sum, line) => sum + (line.qty || 1), 0);
    const targetDateKey = newOrder.orderType === 'reservation' ? reservationDate : new Date().toISOString().split('T')[0];
    const targetSlotTime = newOrder.orderType === 'reservation' ? reservationTime : todayTimeSlot;

    const payload = {
      name: newOrder.name,
      email: newOrder.email,
      phone: newOrder.phone,
      fulfillment: newOrder.fulfillment,
      location: newOrder.location,
      landmark: newOrder.landmark,
      orderType: newOrder.orderType,
      scheduleInfo: newOrder.scheduleInfo,
      dateKey: targetDateKey,
      slotTime: targetSlotTime,
      deliveryLat: deliveryCoordinates?.lat ?? null,
      deliveryLng: deliveryCoordinates?.lng ?? null,
      deliveryFee: newOrder.deliveryFee,
      promoCodesList: isGuest ? [] : newOrder.promoCodesList,
      items: lines.map((line: any) => ({
        menuItemId: line.item.id,
        quantity: line.qty,
        options: (line.customizations || []).map((option: any) => ({ groupId: option.groupId, optionId: option.optionId })),
        customizationsSummary: line.customizationsSummary || '',
      })),
    };

    // 1. Insert order and get order id
    const { data: orderDataRes, error: orderErr } = await supabase.from('orders').insert({
      user_id: isGuest ? null : currentUser?.authUserId,
      account_nickname: isGuest ? 'Guest' : (currentUser?.name || 'User'),
      customer_name: payload.name,
      email: payload.email,
      phone: payload.phone,
      fulfillment: payload.fulfillment,
      location: payload.location,
      landmark: payload.landmark,
      order_type: payload.orderType,
      schedule_info: payload.scheduleInfo,
      delivery_fee: payload.deliveryFee,
      promo_code: newOrder.promoCode,
      total: newOrder.total,
      items: payload.items
    }).select().single();

    if (orderErr || !orderDataRes) throw new Error(orderErr?.message || 'Order could not be saved.');

    // 2. Securely reserve slot and deduct total bowls
    const { data: slotRes, error: slotErr } = await supabase.rpc('reserve_slot_capacity_v2', {
      p_date_key: targetDateKey,
      p_slot_time: targetSlotTime,
      p_bowls_requested: totalBowlsCount,
      p_order_id: orderDataRes.id,
      p_user_id: isGuest ? null : currentUser?.authUserId,
      p_customer_name: payload.name,
      p_customer_phone: payload.phone
    });

    if (slotErr || (slotRes && slotRes.success === false)) {
      // Rollback order if slot is fully booked
      await supabase.from('orders').delete().eq('id', orderDataRes.id);
      throw new Error(slotRes?.message || slotErr?.message || 'Time slot is fully booked.');
    }

    const savedOrder = { ...newOrder, orderNumber: orderDataRes.order_number, items: orderDataRes.items, subtotal: Number(orderDataRes.subtotal || newOrder.subtotal), promoDiscount: Number(orderDataRes.promo_discount || newOrder.promoDiscount), deliveryDiscount: Number(orderDataRes.delivery_discount || 0), deliveryFee: Number(orderDataRes.delivery_fee || newOrder.deliveryFee), total: Number(orderDataRes.total || newOrder.total) };
    
    const prior = isGuest ? sessionStorage.getItem(userHistoryStorageKey) : localStorage.getItem(userHistoryStorageKey);
    let previous: any[] = [];
    try { previous = prior ? JSON.parse(prior) : []; } catch { previous = []; }
    const updated = [savedOrder, ...previous];
    setHistoryList(updated);
    try {
      if (isGuest) sessionStorage.setItem(userHistoryStorageKey, JSON.stringify(updated));
      else localStorage.setItem(userHistoryStorageKey, JSON.stringify(updated));
    } catch (e) { console.error('Unable to cache order history:', e); }
    return savedOrder;
  };

  // SECTION 16: Filter visible menu items by availability, category, and search text.
  const filtered = currentMenuGrid.filter((item) => {
    if (item.isAvailable === false) return false;
    const matchCategory = category === 'All items' || item.category === category;
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // SECTION 17: Menu customization logic, conditional option groups, pricing, and cart insertion.
  const handleOpenModal = (item) => {
    setSelected(item);
    setQty(1);
    setValidationError('');

    const initialSelections: { [groupId: string]: string[] } = {};
    if (item.optionGroups && Array.isArray(item.optionGroups)) {
      item.optionGroups.forEach((group: any) => {
        // Pre-select default option if specified, or first option if single-select required
        const defaultOpt = (group.options || []).find((o: any) => o.is_default || o.isDefault);
        if (defaultOpt) {
          initialSelections[group.id] = [defaultOpt.id];
        } else if (group.type === 'single' && group.required && group.options && group.options.length > 0) {
          initialSelections[group.id] = [group.options[0].id];
        } else {
          initialSelections[group.id] = [];
        }
      });
    }
    setSelectedOptions(initialSelections);
  };

  const getEffectiveItemPrice = (item) => {
    const base = item.price || 0;
    const discountPct = item.discountPercent || 0;
    if (discountPct > 0) {
      return base * (1 - discountPct / 100);
    }
    return base;
  };

  // Dynamic Customization Calculation & Dependency Rules Engine
  const calculateCustomizationTotal = () => {
    if (!selected || !selected.optionGroups) return 0;
    let totalAddons = 0;

    selected.optionGroups.forEach((group: any) => {
      // Conditional Visibility Check: group is visible ONLY if no parent required OR parent is currently selected
      if (group.parentOptionIds && group.parentOptionIds.length > 0) {
        const isTriggered = group.parentOptionIds.some((parentId: string) =>
          Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
        );
        if (!isTriggered) return; // Skip hidden group
      }

      const groupSelections = selectedOptions[group.id] || [];
      (group.options || []).forEach((opt: any) => {
        if (groupSelections.includes(opt.id)) {
          totalAddons += Number(opt.price || 0);
        }
      });
    });

    return totalAddons;
  };

  const calculateUnitPrice = () => {
    if (!selected) return 0;
    return getEffectiveItemPrice(selected) + calculateCustomizationTotal();
  };

  const buildCustomizationPayload = () => {
    if (!selected || !selected.optionGroups) return { snapshots: [], summary: '', extraCharge: 0 };
    const snapshots: any[] = [];
    const summaryParts: string[] = [];
    let extraCharge = 0;

    selected.optionGroups.forEach((group: any) => {
      // Evaluate visibility
      if (group.parentOptionIds && group.parentOptionIds.length > 0) {
        const isTriggered = group.parentOptionIds.some((parentId: string) =>
          Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
        );
        if (!isTriggered) return;
      }

      const groupSelections = selectedOptions[group.id] || [];
      const selectedOpts = (group.options || []).filter((opt: any) => groupSelections.includes(opt.id));

      if (selectedOpts.length > 0) {
        selectedOpts.forEach((opt: any) => {
          const optPrice = Number(opt.price || 0);
          extraCharge += optPrice;
          snapshots.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            additionalPrice: optPrice
          });
          summaryParts.push(optPrice > 0 ? `${opt.name} (+₱${optPrice})` : opt.name);
        });
      }
    });

    return {
      snapshots,
      summary: summaryParts.join(', '),
      extraCharge
    };
  };

  const handleAddCustomToCart = () => {
    if (!selected) return;
    setValidationError('');

    // Validate visible option groups against requirement & selection limits
    if (selected.optionGroups && selected.optionGroups.length > 0) {
      for (const group of selected.optionGroups) {
        if (group.parentOptionIds && group.parentOptionIds.length > 0) {
          const isTriggered = group.parentOptionIds.some((parentId: string) =>
            Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
          );
          if (!isTriggered) continue; // Skip hidden group validation
        }

        const selections = selectedOptions[group.id] || [];
        const minReq = group.required ? Math.max(1, group.minSelections || 0) : (group.minSelections || 0);
        
        if (selections.length < minReq) {
          setValidationError(`Please make a selection for required group: "${group.name}".`);
          return;
        }

        if (group.maxSelections && selections.length > group.maxSelections) {
          setValidationError(`You can choose at most ${group.maxSelections} options for "${group.name}".`);
          return;
        }
      }
    }

    const { snapshots, summary, extraCharge } = buildCustomizationPayload();

    // Add to cart with full immutable customization snapshots and extra charges
    add(selected, qty, snapshots, extraCharge, summary);

    setAddedItemName(`${qty} × ${selected.name}${summary ? ` (${summary})` : ''}`);
    setSelected(null);
    setShowUpsell(true);
  };

  // SECTION 18: Upsell quantity helpers and cart quantity updates.
  const getUpsellQty = (itemId) => {
    const line = Array.isArray(lines) ? lines.find((l: any) => l.item.id === itemId) : null;
    return line ? line.qty : 0;
  };

  const handleUpsellChange = (upsellItem, newQty) => {
    if (newQty <= 0) {
      remove(upsellItem.id);
    } else {
      const currentQty = getUpsellQty(upsellItem.id);
      if (currentQty === 0) {
        add(upsellItem, newQty);
      } else {
        setLineQty(upsellItem.id, newQty);
      }
    }
  };

  // SECTION 19: Client-side voucher usage tracking and promotion-code interactions.
  // Helper for per-user promo limits tracking
  const getUserVoucherUsageMap = () => {
    try {
      const userKey = currentUser ? (currentUser.identifier || 'guest').toLowerCase().trim() : 'guest';
      const saved = localStorage.getItem(`veyns_user_voucher_uses_${userKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  };

  const handleApplyPromoCodeString = (codeToApply: string) => {
    if (isGuest) {
      setPromoError('Promos and vouchers are exclusively available for registered regular customers.');
      return;
    }

    setPromoError('');
    const promos = availablePromos;
    const cleanCode = codeToApply.trim().toUpperCase();
    const found = Array.isArray(promos) ? promos.find((p: any) => p.code.toUpperCase() === cleanCode) : null;

    if (!found) {
      setPromoError('Invalid promo code.');
      return;
    }

    if (appliedPromos.some((p) => p.code.toUpperCase() === cleanCode)) {
      setPromoError('This voucher is already applied.');
      return;
    }

    if (found.expiryDurationMs && found.expiryDurationMs > 0 && found.createdAt) {
      const expiresAt = found.createdAt + found.expiryDurationMs;
      if (Date.now() > expiresAt) {
        setPromoError('This voucher code has expired.');
        return;
      }
    }

    if (found.usageLimit && (found.usageCount || 0) >= found.usageLimit) {
      setPromoError(`This voucher has reached its maximum global usage limit.`);
      return;
    }

    setAppliedPromos((prev) => [...prev, found]);
    setPromoInput('');
  };

  const handleApplyPromo = () => {
    handleApplyPromoCodeString(promoInput);
  };

  const handleRemoveAppliedPromo = (codeToRemove: string) => {
    setAppliedPromos((prev) => prev.filter((p) => p.code !== codeToRemove));
  };

  const handleClaimVoucher = (promo: any) => {
    if (isGuest) {
      alert('Promos and vouchers are exclusively available for registered regular customers. Please log in or create an account!');
      return;
    }

    if (promo.usageLimit && (promo.usageCount || 0) >= promo.usageLimit) {
      alert('This voucher has already reached its maximum usage limit.');
      return;
    }

    if (promo.expiryDurationMs && promo.expiryDurationMs > 0 && promo.createdAt) {
      const expiresAt = promo.createdAt + promo.expiryDurationMs;
      if (Date.now() > expiresAt) {
        alert('This voucher has expired.');
        return;
      }
    }

    handleApplyPromoCodeString(promo.code);
  };

  // SECTION 20: Calculate separate food vs delivery promotion discounts and order totals.
  const rawDeliveryFee = fulfillment === 'delivery' ? calculatedDeliveryFee : 0;

  const calculatePromoDiscounts = () => {
    let foodDiscountRaw = 0;
    let deliveryDiscountRaw = 0;

    appliedPromos.forEach((p) => {
      const isDeliveryTarget = p.targetType === 'delivery' || p.target_type === 'delivery' || p.scope === 'delivery';

      if (isDeliveryTarget) {
        if (p.type === 'percentage') {
          deliveryDiscountRaw += (rawDeliveryFee * p.discountValue) / 100;
        } else {
          deliveryDiscountRaw += p.discountValue;
        }
      } else {
        if (p.type === 'percentage') {
          foodDiscountRaw += (total * p.discountValue) / 100;
        } else {
          foodDiscountRaw += p.discountValue;
        }
      }
    });

    const foodDiscountAmount = Math.min(total, foodDiscountRaw);
    const deliveryDiscountAmount = Math.min(rawDeliveryFee, deliveryDiscountRaw);

    return { foodDiscountAmount, deliveryDiscountAmount };
  };

  const { foodDiscountAmount, deliveryDiscountAmount } = calculatePromoDiscounts();
  const finalDeliveryFee = Math.max(0, rawDeliveryFee - deliveryDiscountAmount);
  const finalCartTotal = Math.max(0, (total - foodDiscountAmount) + finalDeliveryFee);

  // SECTION 21: Confirm only after the database accepts and prices the order.
  const handleReviewOrder = () => {
    setShowUpsell(false);
    setOrderPlaced(false);
    setShowCheckout(true);
  };

  const handleConfirmOrder = async () => {
    if (orderType === 'today' && !isOrderTodayAllowed()) {
      alert('Store is closed until 12 noon. Select a reservation time instead.'); return;
    }
    if (fulfillment === 'delivery' && !deliveryCoordinates) {
      alert('Choose a delivery location on the map before placing the order.'); return;
    }
    const scheduleInfoText = orderType === 'today'
      ? fulfillment === 'delivery' && deliveryOption === 'our' ? 'Today (' + todayTimeSlot + ') - Personal Delivery' : 'Today - Maxim Delivery (Anytime)'
      : 'Reservation on ' + (reservationDate || 'Upcoming Date') + ' (' + reservationTime + ')';
    const promoCodesList = isGuest ? [] : appliedPromos.map(p => p.code);
    const orderData = {
      orderNumber: 'Pending', accountNickname: isGuest ? 'Guest User' : (currentUser?.name || 'User'),
      name: customerName || (currentUser ? currentUser.name : 'Valued Customer'),
      email: fulfillment === 'delivery' ? customerEmail : '', phone: fulfillment === 'delivery' ? customerPhone : '',
      location: fulfillment === 'delivery' ? customerLocation : 'Pick Up at Store',
      landmark: fulfillment === 'delivery' ? nearestLandmark : 'N/A', fulfillment, deliveryOption,
      orderType, scheduleInfo: scheduleInfoText, deliveryDistanceKm, deliveryFee: rawDeliveryFee,
      paymentOption: 'Cash on Pickup / Delivery', items: [...lines], subtotal: total,
      promoCode: promoCodesList.length ? promoCodesList.join(', ') : null,
      promoCodesList, promoDiscount: foodDiscountAmount + deliveryDiscountAmount, total: finalCartTotal, date: new Date().toLocaleString(),
    };
    try {
      const savedOrder = await saveOrderToHistory(orderData);
      setPlacedOrderDetails(savedOrder);
      setOrderPlaced(true);
      if (onOrderPlacedSuccess) await onOrderPlacedSuccess();
    } catch (error: any) {
      console.error('Order submission failed:', error);
      alert(error?.message || 'Unable to place this order. Please try again.');
    }
  };

  const handleCloseConfirmation = () => {
    clear();
    setOrderPlaced(false);
    setShowCheckout(false);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerLocation('');
    setNearestLandmark('');
    setAppliedPromos([]);
    setPromoInput('');
    setDeliveryDistanceKm(null);
    setDeliveryCoordinates(null);
    setCalculatedDeliveryFee(0);
    setIsPinning(false);
  };

  // SECTION 22: Derived values used by the rendered menu, loyalty, and checkout interface.
  const validStampsCount = stamps.filter(s => s.status === 'valid').length;
  const publicVouchersList = availablePromos.filter(p => p.visibility !== 'hidden');

  const isStoreClosedForToday = orderType === 'today' && !orderTodayOpen;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* SECTION 23: Menu search, customer account actions, and category navigation. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-300/70" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-emerald-800/60 bg-[#071F19] pl-10 pr-4 py-2 text-sm text-white placeholder:text-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
        </div>

        <div className="flex items-center gap-3">
          {isGuest ? (
            <Button
              onClick={() => {
                if (onOpenRegister) onOpenRegister();
              }}
              className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-extrabold text-xs px-4 py-2.5 rounded-full transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" /> Create an Account
            </Button>
          ) : (
            <Button
              onClick={() => {
                loadUserStampsAndPenalties();
                setShowLoyaltyModal(true);
              }}
              className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-extrabold text-xs px-4 py-2.5 rounded-full transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Award className="h-4 w-4" /> Loyalty Card ({validStampsCount}/12)
            </Button>
          )}

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  category === cat ? 'bg-lime-400 text-black' : 'bg-[#071F19] text-emerald-200 hover:bg-[#0a2c24]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 24: Menu item cards and add-to-cart entry points. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const effectivePrice = getEffectiveItemPrice(item);
          const hasDiscount = (item.discountPercent || 0) > 0;

          return (
            <div
              key={item.id}
              onClick={() => handleOpenModal(item)}
              className="group cursor-pointer rounded-2xl border border-emerald-800/40 bg-[#051813] p-4 transition-all duration-200 hover:border-lime-400/60 hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#071F19] mb-4 flex items-center justify-center">
                  <Photo id={item.id} dbImage={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  
                  {item.bestSeller && (
                    <span className="absolute top-2.5 right-2.5 rounded-full bg-lime-400 text-black px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
                      <Star className="h-3 w-3 fill-black" /> BEST SELLER
                    </span>
                  )}

                  {hasDiscount && (
                    <span className="absolute top-2.5 left-2.5 rounded-full bg-amber-400 text-black px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                      {item.discountPercent}% OFF
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold text-white text-lg">{item.name}</h3>
                  <div className="text-right whitespace-nowrap">
                    {hasDiscount ? (
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-lime-400 text-base">{formatPeso(effectivePrice)}</span>
                        <span className="text-xs text-emerald-400/60 line-through">{formatPeso(item.price)}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-lime-400 text-base">{formatPeso(item.price)}</span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-emerald-300/80 line-clamp-2">{item.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-end border-t border-emerald-900/60 pt-3">
                <Button size="sm" className="rounded-full bg-lime-400 text-black font-bold hover:bg-lime-300 px-5">
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 25: Loyalty stamp card and fair-play status modal. */}
      <Dialog open={showLoyaltyModal} onOpenChange={setShowLoyaltyModal}>
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
          <div className="space-y-1 text-left border-b border-emerald-900/60 pb-3">
            <DialogTitle className="font-display text-xl font-extrabold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-lime-400" /> VEYNS. Loyalty Stamp Card
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-300/80">
              Rule: 1 order per day = 1 stamp. "To Be Cleared" slots must be stamped first before progressing.
            </DialogDescription>
          </div>

          <div className="my-4 space-y-4">
            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 text-center space-y-2">
              <p className="text-xs text-emerald-300">Active Valid Stamps:</p>
              <p className="text-3xl font-black text-lime-400 font-display">{validStampsCount} / 12 Stamps</p>
              
              {fairPlayPenalty && fairPlayPenalty.appliedPenalties && fairPlayPenalty.appliedPenalties.length > 0 ? (
                <div className="bg-red-950/80 border border-red-500/80 rounded-xl p-3 text-left space-y-1.5 mt-2">
                  <p className="text-[10px] font-extrabold text-red-400 uppercase flex items-center gap-1">
                    <AlertTriangle className="size-3.5" /> Fair Play Infraction Notice:
                  </p>
                  <p className="text-[10px] text-red-200 font-medium">
                    Offense Recorded: <strong>{fairPlayPenalty.appliedPenalties.join(', ')}</strong>
                  </p>
                  <div className="text-[10px] text-amber-300 pt-1 border-t border-red-900/60 space-y-0.5">
                    <p>• 6th Stamp Reward: <strong>{fairPlayPenalty.sixthReward}</strong></p>
                    <p>• 9th Stamp Reward: <strong>{fairPlayPenalty.ninthReward}</strong></p>
                    <p>• 12th Stamp Reward: <strong>{fairPlayPenalty.twelfthReward}</strong></p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: 12 }).map((_, idx) => {
                const stampEntry = stamps[idx];
                const status = stampEntry ? stampEntry.status : 'empty';
                const isSixth = idx === 5;
                const isNinth = idx === 8;
                const isTwelfth = idx === 11;

                let sixthText = '25% OFF';
                let ninthText = '50% OFF';
                let twelfthText = 'FREE';

                if (fairPlayPenalty && fairPlayPenalty.appliedPenalties && fairPlayPenalty.appliedPenalties.length > 0) {
                  if (fairPlayPenalty.sixthReward) sixthText = fairPlayPenalty.sixthReward;
                  if (fairPlayPenalty.ninthReward) ninthText = fairPlayPenalty.ninthReward;
                  if (fairPlayPenalty.twelfthReward) twelfthText = fairPlayPenalty.twelfthReward;
                }

                return (
                  <div
                    key={idx}
                    className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center text-xs font-extrabold transition-all p-1 text-center ${
                      status === 'valid'
                        ? 'bg-[#082d22] border-lime-400 text-lime-400 shadow-md'
                        : status === 'to_clear'
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-md animate-pulse'
                        : status === 'invalid'
                        ? 'bg-red-950/80 border-red-500 text-red-400 shadow-md'
                        : 'bg-[#041913] border-emerald-800/60 text-emerald-600'
                    }`}
                  >
                    {status === 'valid' && <Check className="size-5 text-lime-400 mb-0.5" />}
                    {status === 'to_clear' && <Clock className="size-5 text-amber-400 mb-0.5" />}
                    {status === 'invalid' && <XCircle className="size-5 text-red-400 mb-0.5" />}
                    {status === 'empty' && <span className="text-xs font-mono">#{idx + 1}</span>}

                    {fairPlayPenalty && fairPlayPenalty.appliedPenalties && fairPlayPenalty.appliedPenalties.length > 0 ? (
                      <>
                        {isSixth && (
                          <span className={`absolute -top-2 -right-1 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow ${sixthText.includes('Invalid') || sixthText.includes('CANCELLED') ? 'bg-red-500 text-white' : 'bg-amber-500'}`}>
                            {sixthText}
                          </span>
                        )}
                        {isNinth && (
                          <span className={`absolute -top-2 -right-1 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow ${ninthText.includes('Invalid') || ninthText.includes('CANCELLED') ? 'bg-red-500 text-white' : 'bg-amber-400'}`}>
                            {ninthText}
                          </span>
                        )}
                        {isTwelfth && (
                          <span className={`absolute -top-2 -right-1 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow ${twelfthText.includes('Cancelled') || twelfthText.includes('Invalid') ? 'bg-red-500 text-white' : twelfthText === '25% OFF' ? 'bg-amber-400' : 'bg-lime-400'}`}>
                            {twelfthText}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {isSixth && (
                          <span className="absolute -top-2 -right-1 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                            25% OFF
                          </span>
                        )}
                        {isNinth && (
                          <span className="absolute -top-2 -right-1 bg-amber-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                            50% OFF
                          </span>
                        )}
                        {isTwelfth && (
                          <span className="absolute -top-2 -right-1 bg-lime-400 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">
                            FREE
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            onClick={() => setShowLoyaltyModal(false)}
            className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg"
          >
            Close Loyalty Card
          </Button>
        </DialogContent>
      </Dialog>

      {/* SECTION 26: Customer order-history modal. */}
      <Dialog open={isOrdersOpen} onOpenChange={(open) => {
        setIsOrdersOpen(open);
        if (setShowMyOrders) setShowMyOrders(open);
        if (open) refreshOrderHistoryFromStorage();
      }}>
        <DialogContent className="max-w-lg w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-lime-400" />
              <DialogTitle className="font-display text-xl font-extrabold text-white uppercase tracking-wide">
                My Order History
              </DialogTitle>
            </div>
          </div>

          <div className="my-4 space-y-3">
            {historyList.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <ShoppingBag className="h-10 w-10 text-emerald-600 mx-auto opacity-60" />
                <p className="text-xs text-emerald-400/70">No orders placed yet.</p>
              </div>
            ) : (
              historyList.map((order, idx) => (
                <div key={idx} className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2">
                    <span className="font-extrabold text-lime-400 text-sm">{order.orderNumber}</span>
                    <span className="text-[10px] text-emerald-300">{order.date}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-emerald-200">
                    <div>
                      <span className="text-[10px] text-emerald-400/70 uppercase block font-bold">Customer & Contact</span>
                      <p className="font-bold text-white">{order.name}</p>
                      <p className="text-[10px] text-emerald-300">{order.phone || order.email || 'No contact provided'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400/70 uppercase block font-bold">Fulfillment & Schedule</span>
                      <span className="inline-block bg-[#07241c] text-lime-400 border border-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-0.5">
                        {order.fulfillment} • {order.orderType === 'reservation' ? 'Reservation' : 'Today'}
                      </span>
                      {order.scheduleInfo && (
                        <p className="text-[10px] text-emerald-300 mt-1 font-medium">{order.scheduleInfo}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-1 border-t border-emerald-900/40">
                    <span className="text-[10px] text-emerald-400/70 uppercase block font-bold mb-1">Item Summary</span>
                    <div className="space-y-1">
                      {order.items.map((it: any, i: number) => (
                        <div key={i} className="flex flex-col text-white text-[11px]">
                          <div className="flex justify-between">
                            <span>{it.qty}x {it.item?.name || it.name}</span>
                            <span className="font-bold text-lime-400">{formatPeso((it.unitPrice ?? it.item?.price ?? it.price ?? 0) * it.qty)}</span>
                          </div>
                          {it.customizationsSummary && (
                            <p className="text-[10px] text-lime-300 font-mono pl-2">↳ {it.customizationsSummary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.promoCode && (
                    <div className="flex justify-between text-amber-400 pt-1 border-t border-emerald-900/40 text-[11px]">
                      <span>Promo ({order.promoCode}):</span>
                      <span>Applied</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-emerald-900/60 text-sm font-extrabold">
                    <span className="text-white">Total:</span>
                    <span className="text-lime-400 text-base">{formatPeso(order.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button
            onClick={() => {
              setIsOrdersOpen(false);
              if (setShowMyOrders) setShowMyOrders(false);
            }}
            className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* SECTION 27: Dynamic menu customization modal with option validation and price preview. */}
      {/* DYNAMIC MENU ITEM CUSTOMIZATION MODAL */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-md w-full bg-[#04140f] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <div className="text-left space-y-2">
              <div className="flex items-center gap-2">
                <DialogTitle className="font-display text-2xl font-extrabold text-white">{selected.name}</DialogTitle>
                {selected.bestSeller && (
                  <span className="rounded-full bg-lime-400 text-black px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 fill-black" /> BEST SELLER
                  </span>
                )}
              </div>
              <DialogDescription className="text-xs text-emerald-200/95 leading-relaxed">{selected.description}</DialogDescription>
            </div>

            <div className="my-4 flex justify-center">
              <div className="relative aspect-square w-48 h-48 overflow-hidden rounded-2xl bg-[#061e17] border border-emerald-800/40 flex items-center justify-center">
                <Photo id={selected.id} dbImage={selected.image} alt={selected.name} className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Dynamic Option Groups Rendering */}
            {selected.optionGroups && selected.optionGroups.length > 0 && (
              <div className="space-y-4 my-2 border-t border-emerald-900/60 pt-3">
                {selected.optionGroups.map((group: any) => {
                  // Evaluate conditional dependency trigger rules
                  if (group.parentOptionIds && group.parentOptionIds.length > 0) {
                    const isTriggered = group.parentOptionIds.some((parentId: string) =>
                      Object.values(selectedOptions).some((selectedList) => selectedList.includes(parentId))
                    );
                    if (!isTriggered) return null; // Conditionally hide dependent group
                  }

                  const currentSelections = selectedOptions[group.id] || [];

                  return (
                    <div key={group.id} className="space-y-2 bg-[#061c16] border border-emerald-800/60 rounded-2xl p-3.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-lime-400 uppercase tracking-wider flex items-center gap-1">
                          {group.name} {group.required && <span className="text-red-400">*</span>}
                        </h4>
                        <span className="text-[9px] text-emerald-300 font-semibold">
                          {group.type === 'single' ? 'Pick 1' : group.maxSelections ? `Up to ${group.maxSelections}` : 'Multi-select'}
                        </span>
                      </div>

                      {group.description && (
                        <p className="text-[10px] text-emerald-300/80 mb-1">{group.description}</p>
                      )}

                      <div className="space-y-1.5">
                        {(group.options || []).map((opt: any) => {
                          const isSelected = currentSelections.includes(opt.id);
                          const addPrice = Number(opt.price || 0);

                          return (
                            <button
                              type="button"
                              key={opt.id}
                              onClick={() => {
                                if (group.type === 'single') {
                                  setSelectedOptions((prev) => ({ ...prev, [group.id]: [opt.id] }));
                                } else {
                                  const existing = selectedOptions[group.id] || [];
                                  if (isSelected) {
                                    setSelectedOptions((prev) => ({
                                      ...prev,
                                      [group.id]: existing.filter((id) => id !== opt.id)
                                    }));
                                  } else {
                                    if (group.maxSelections && existing.length >= group.maxSelections) {
                                      alert(`Maximum ${group.maxSelections} options allowed for ${group.name}.`);
                                      return;
                                    }
                                    setSelectedOptions((prev) => ({
                                      ...prev,
                                      [group.id]: [...existing, opt.id]
                                    }));
                                  }
                                }
                              }}
                              className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#082d22] border-lime-400 text-lime-400 shadow-md'
                                  : 'bg-[#041913] border-emerald-800/60 text-emerald-200 hover:border-emerald-600'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-${group.type === 'single' ? 'full' : 'md'} border flex items-center justify-center ${isSelected ? 'border-lime-400 bg-lime-400 text-black' : 'border-emerald-700 bg-black/40'}`}>
                                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span>{opt.name}</span>
                              </div>
                              <span className="font-extrabold text-[11px] text-lime-400">
                                {addPrice > 0 ? `+${formatPeso(addPrice)}` : '₱0'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {validationError && (
              <p className="text-[11px] text-red-400 font-bold text-center bg-red-950/60 border border-red-800 rounded-xl p-2 my-2">
                ⚠️ {validationError}
              </p>
            )}

            <div className="flex items-center justify-between mt-4 border-t border-emerald-900/60 pt-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Total Price</span>
                <span className="text-xl font-extrabold text-white">
                  {formatPeso(calculateUnitPrice() * qty)}
                </span>
              </div>

              <div className="flex items-center gap-4 bg-[#07241c] border border-emerald-800/60 rounded-xl px-3 py-1.5">
                <button
                  onClick={() => {
                    if (qty <= 1) setSelected(null);
                    else setQty(qty - 1);
                  }}
                  className="text-emerald-300 hover:text-white cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-white w-4 text-center">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="text-emerald-300 hover:text-white cursor-pointer">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={handleAddCustomToCart}
                className="bg-lime-400 hover:bg-lime-500 text-black font-extrabold px-5 py-2.5 text-xs rounded-xl transition-all shadow-lg cursor-pointer"
              >
                Add · {formatPeso(calculateUnitPrice() * qty)}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* SECTION 28: Post-add-to-cart upsell suggestions. */}
      <Dialog open={showUpsell} onOpenChange={setShowUpsell}>
        <DialogContent className="max-w-lg w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-5 rounded-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <div className="space-y-0.5 text-left border-b border-emerald-900/60 pb-3">
            <div className="flex items-center gap-1.5 text-lime-400 font-semibold text-[11px]">
              <Check className="h-3.5 w-3.5" />
              <span>{addedItemName} added</span>
            </div>
            <DialogTitle className="font-display text-xl font-extrabold text-white">
              A little something extra?
            </DialogTitle>
            <DialogDescription className="text-[11px] text-emerald-300/80">
              Add fries, extra rice, egg, katsu or sauce.
            </DialogDescription>
          </div>

          <div className="grid grid-cols-2 gap-2.5 my-4">
            {UPSELL_ITEMS.map((item) => {
              const currentQty = getUpsellQty(item.id);

              return (
                <div
                  key={item.id}
                  className={`relative bg-[#061d16] border rounded-xl p-2.5 flex flex-col items-center justify-between text-center transition-all ${
                    currentQty > 0 ? 'border-lime-400/80 shadow-lg' : 'border-emerald-800/50 hover:border-lime-400/50'
                  }`}
                >
                  {currentQty > 0 && (
                    <span className="absolute top-2 right-2 bg-lime-400 text-black font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-md z-10">
                      {currentQty}x
                    </span>
                  )}

                  <div className="h-20 w-20 rounded-lg bg-[#08291f] overflow-hidden mb-2 flex items-center justify-center shrink-0">
                    <Photo id={item.id} dbImage={item.image} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-0.5 mb-2 w-full">
                    <h4 className="text-[11px] font-bold text-white line-clamp-1 leading-tight">{item.name}</h4>
                    <p className="text-[11px] font-extrabold text-lime-400">{formatPeso(item.price)}</p>
                  </div>

                  {currentQty === 0 ? (
                    <Button
                      onClick={() => handleUpsellChange(item, 1)}
                      size="sm"
                      className="w-full h-8 bg-[#082a20] hover:bg-lime-400 hover:text-black text-white border border-emerald-700/60 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  ) : (
                    <div className="w-full h-8 bg-[#041913] text-white border border-emerald-600/80 rounded-xl font-bold text-xs flex items-center justify-between px-2 shadow-inner">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpsellChange(item, currentQty - 1);
                        }}
                        className="p-1 text-emerald-300 hover:text-white hover:bg-emerald-800/40 rounded-md transition-colors cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-white font-extrabold text-xs">{currentQty}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpsellChange(item, currentQty + 1);
                        }}
                        className="p-1 text-emerald-300 hover:text-white hover:bg-emerald-800/40 rounded-md transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-2 border-t border-emerald-900/60">
            <Button
              onClick={handleReviewOrder}
              className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              Review my order <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => setShowUpsell(false)}
              className="w-full text-center text-xs font-bold text-lime-400 hover:underline transition-colors py-1 cursor-pointer"
            >
              Continue browsing
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SECTION 29: Checkout flow, delivery/pickup details, scheduling, promotions, and order confirmation. */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md sm:max-w-lg w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-4 sm:p-6 rounded-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          {orderPlaced && placedOrderDetails ? (
            <div className="py-4 text-center space-y-4">
              <div className="mx-auto h-14 w-14 bg-lime-400/20 text-lime-400 rounded-full flex items-center justify-center border border-lime-400/50 shadow-lg">
                <Check className="h-7 w-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-display text-base font-extrabold uppercase tracking-wide">
                  <span className="text-lime-400">THANK YOU FOR YOUR ORDER </span>
                  <span className="text-[#ffb3c6]">OUR BELOVED CUSTOMER.</span>
                </h3>
                <DialogTitle className="font-display text-sm font-semibold text-emerald-200/95 tracking-wide uppercase">
                  Order Invoice
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Reference: <span className="font-extrabold text-lime-400 text-sm">{placedOrderDetails.orderNumber}</span>
                </DialogDescription>
              </div>

              <div className="bg-[#061d16] border border-lime-400/60 rounded-2xl p-4 text-center space-y-3 shadow-xl">
                <div className="flex items-center justify-center gap-2 text-lime-400 font-extrabold text-xs uppercase tracking-wider">
                  <Camera className="h-4 w-4" /> Please Screenshot This Invoice!
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed max-w-sm mx-auto">
                  Take a screenshot and send it to our social pages to finalize your updates:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href="https://www.instagram.com/veyns.ubec?psln=MTZjbjBmOGR0bmJldg%3D%3D&utm_source=qr"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 bg-[#082a20] hover:bg-lime-400 hover:text-black text-lime-400 border border-lime-400/50 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-md"
                  >
                    <Instagram className="h-4 w-4 shrink-0" /> Instagram
                  </a>
                  <a
                    href="https://www.facebook.com/veyns.ubec/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 bg-[#082a20] hover:bg-lime-400 hover:text-black text-lime-400 border border-lime-400/50 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-md"
                  >
                    <Facebook className="h-4 w-4 shrink-0" /> Facebook
                  </a>
                </div>
              </div>

              <div className="bg-[#041913] border border-emerald-800/80 rounded-xl p-3.5 text-xs space-y-3 text-emerald-200 text-left">
                <div className="border-b border-emerald-900/60 pb-2">
                  <p className="font-bold text-lime-400 text-[11px] uppercase tracking-wider mb-1.5">Ordered Items:</p>
                  <div className="space-y-1">
                    {placedOrderDetails.items.map((itemLine, idx) => (
                      <div key={idx} className="flex flex-col text-white text-[11px]">
                        <div className="flex justify-between">
                          <span>{itemLine.qty}x {itemLine.item?.name || itemLine.name}</span>
                          <span className="font-bold text-lime-400">{formatPeso((itemLine.unitPrice ?? itemLine.item?.price ?? itemLine.price ?? 0) * itemLine.qty)}</span>
                        </div>
                        {itemLine.customizationsSummary && (
                          <p className="text-[10px] text-lime-300 font-mono pl-2">↳ {itemLine.customizationsSummary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between">
                    <span>Account Nickname:</span>
                    <span className="font-bold text-white">{placedOrderDetails.accountNickname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fulfillment:</span>
                    <span className="font-bold text-white uppercase">{placedOrderDetails.fulfillment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Order Schedule:</span>
                    <span className="font-bold text-lime-400">{placedOrderDetails.scheduleInfo}</span>
                  </div>
                  {placedOrderDetails.fulfillment === 'delivery' && (
                    <>
                      <div className="flex justify-between">
                        <span>Courier:</span>
                        <span className="font-bold text-white uppercase">{placedOrderDetails.deliveryOption === 'our' ? 'Our Delivery' : 'Maxim Courier'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Distance:</span>
                        <span className="font-bold text-lime-400">{placedOrderDetails.deliveryDistanceKm} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Address:</span>
                        <span className="font-bold text-white text-right max-w-[180px] truncate">{placedOrderDetails.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nearest Landmark:</span>
                        <span className="font-bold text-white">{placedOrderDetails.landmark}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="font-bold text-lime-400 uppercase">Cash on Pickup / Delivery</span>
                  </div>
                </div>

                <div className="border-t border-emerald-900/60 pt-2 space-y-1">
                  <div className="flex justify-between text-emerald-200">
                    <span>Food Subtotal:</span>
                    <span className="font-bold text-white">{formatPeso(placedOrderDetails.subtotal)}</span>
                  </div>
                  {placedOrderDetails.promoDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Promo Discount ({placedOrderDetails.promoCode}):</span>
                      <span>-{formatPeso(placedOrderDetails.promoDiscount)}</span>
                    </div>
                  )}
                  {placedOrderDetails.fulfillment === 'delivery' && (
                    <div className="flex justify-between text-emerald-200">
                      <span>Delivery Fee ({placedOrderDetails.deliveryDistanceKm} km):</span>
                      <span className="font-bold text-white">{formatPeso(placedOrderDetails.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-white pt-1">
                    <span>Total Amount Due:</span>
                    <span className="text-lime-400 text-base">{formatPeso(placedOrderDetails.total)}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCloseConfirmation}
                className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg mt-2 cursor-pointer"
              >
                Back to Menu
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-left border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-2xl font-extrabold text-white flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-lime-400" /> Order Summary
                </DialogTitle>
                <DialogDescription className="text-xs text-emerald-300/80">
                  Review your items and complete checkout
                </DialogDescription>
              </div>

              <div className="my-3 space-y-2 max-h-36 overflow-y-auto pr-1">
                {lines.length === 0 ? (
                  <p className="text-xs text-emerald-400/60 text-center py-6">Your cart is currently empty.</p>
                ) : (
                  lines.map((line) => {
                    const lineKey = line.lineId || line.id || line.item.id;

                    return (
                      <div key={lineKey} className="flex items-center justify-between p-2.5 rounded-xl bg-[#061d16] border border-emerald-800/50 text-xs">
                        <div className="space-y-0.5 flex-1 pr-2">
                          <h4 className="font-bold text-white">{line.item.name}</h4>
                          {line.customizationsSummary && (
                            <p className="text-[10px] text-lime-300 font-mono">↳ {line.customizationsSummary}</p>
                          )}
                          <p className="text-[11px] text-lime-400 font-extrabold">
                            {formatPeso((line.unitPrice ?? line.item.price) * line.qty)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-[#041913] border border-emerald-800/60 rounded-lg px-2 py-1">
                            <button
                              onClick={() => {
                                if (line.qty <= 1) {
                                  remove(lineKey);
                                  if (lines.length <= 1) setShowCheckout(false);
                                } else {
                                  setLineQty(lineKey, line.qty - 1);
                                }
                              }}
                              className="text-emerald-300 hover:text-white cursor-pointer"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="font-bold text-white w-4 text-center">{line.qty}</span>
                            <button onClick={() => setLineQty(lineKey, line.qty + 1)} className="text-emerald-300 hover:text-white cursor-pointer">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button onClick={() => remove(lineKey)} className="text-red-400 hover:text-red-300 p-1 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!isGuest && <div className="space-y-2 pt-2 border-t border-emerald-900/60">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Have a Promo Code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. VEYNS2026"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    className="flex-1 bg-[#041913] border border-emerald-800/80 rounded-xl px-3 py-2 text-xs text-white uppercase placeholder:normal-case placeholder:text-emerald-600 focus:outline-none focus:border-lime-400"
                  />
                  <Button
                    type="button"
                    onClick={handleApplyPromo}
                    className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-extrabold text-xs px-4 rounded-xl transition-all cursor-pointer"
                  >
                    Apply
                  </Button>
                </div>
                {promoError && <p className="text-[10px] text-red-400 font-semibold">{promoError}</p>}
                
                {appliedPromos.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-lime-400 font-semibold">🎉 Applied Vouchers (Stacked):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {appliedPromos.map((p) => (
                        <span key={p.code} className="inline-flex items-center gap-1 bg-[#082a20] border border-lime-400/50 text-lime-300 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                          {p.code} ({p.targetType === 'delivery' ? 'Delivery Fee' : 'Food Subtotal'} - {p.type === 'peso' ? `₱${p.discountValue}` : `${p.discountValue}%`})
                          <button type="button" onClick={() => handleRemoveAppliedPromo(p.code)} className="text-lime-400 hover:text-red-400 ml-0.5 cursor-pointer">
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {publicVouchersList.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                      <Ticket className="size-3 text-lime-400" /> Available Public Vouchers (Click Claim to Stack):
                    </span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {publicVouchersList.map((promo, pIdx) => {
                        const isAlreadyApplied = appliedPromos.some(p => p.code.toUpperCase() === promo.code.toUpperCase());

                        return (
                          <div key={pIdx} className="bg-[#061d16] border border-emerald-800/70 rounded-xl p-2.5 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-lime-400 text-xs">{promo.code}</span>
                              <p className="text-[10px] text-emerald-200">
                                {promo.targetType === 'delivery' ? 'Delivery Discount: ' : 'Food Discount: '}
                                {promo.type === 'peso' ? formatPeso(promo.discountValue) + ' OFF' : `${promo.discountValue}% OFF`}
                              </p>
                              {isAlreadyApplied && (
                                <p className="text-[9px] text-amber-300">✓ Stacked and applied.</p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleClaimVoucher(promo)}
                              className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-extrabold text-[10px] px-3 py-1 rounded-lg cursor-pointer"
                            >
                              {isAlreadyApplied ? 'Applied ✓' : 'Claim & Stack'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>}

              {/* ORDER TYPE SELECTION (Order Today vs Reservation) */}
              <div className="space-y-2 border-t border-emerald-900/60 pt-3">
                <h4 className="text-[11px] font-bold text-lime-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-lime-400" /> Order Schedule Type
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!orderTodayOpen}
                    onClick={() => {
                      if (!orderTodayOpen) {
                        alert('⚠️ Store is closed! Will be back later at 12 NOON. Please select "Reservation" instead.');
                        return;
                      }
                      setOrderType('today');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !orderTodayOpen
                        ? 'bg-red-950/40 border-red-900/60 text-red-400/60 opacity-50 cursor-not-allowed'
                        : orderType === 'today'
                        ? 'bg-[#082d22] border-lime-400 text-lime-400'
                        : 'bg-[#061c16] border-emerald-800/60 text-emerald-200'
                    }`}
                  >
                    <Clock className="h-4 w-4" /> Order Today {!orderTodayOpen && '(Closed < 12PM)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('reservation')}
                    className={`p-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      orderType === 'reservation'
                        ? 'bg-[#082d22] border-lime-400 text-lime-400'
                        : 'bg-[#061c16] border-emerald-800/60 text-emerald-200'
                    }`}
                  >
                    <Calendar className="h-4 w-4" /> Reservation (Open)
                  </button>
                </div>

                {orderType === 'today' ? (
                  <div className="bg-[#061c16] border border-emerald-800/60 rounded-xl p-3 space-y-2 text-xs">
                    <p className="text-[11px] text-emerald-200 font-medium">
                      {fulfillment === 'delivery' && deliveryOption === 'our'
                        ? 'Select your preferred personal delivery time slot (live slots checked):'
                        : fulfillment === 'delivery' && deliveryOption === 'maxim'
                        ? 'Maxim Courier selected: You can have your order delivered anytime today.'
                        : 'Pick up today at your convenience.'}
                    </p>

                    {fulfillment === 'delivery' && deliveryOption === 'our' && (
                      <div className="grid grid-cols-2 gap-2">
                        {['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'].map((slot) => {
                          const slotArray = Array.isArray(slotCapacities) ? slotCapacities : (slotCapacities ? Object.values(slotCapacities) : []);
                          const slotInfo = slotArray.find((s: any) => s.slot_time === slot && (s.date_key === 'today' || s.date_key === selectedSlotDate));
                          const isFullyBooked = slotInfo?.is_fully_booked || (slotInfo && slotInfo.booked_count >= slotInfo.max_slots);
                          const slotsLeft = slotInfo ? Math.max(0, slotInfo.max_slots - slotInfo.booked_count) : null;

                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={isFullyBooked}
                              onClick={() => setTodayTimeSlot(slot)}
                              className={`p-2 rounded-lg border text-[11px] font-bold transition-all flex flex-col items-center justify-between ${
                                isFullyBooked
                                  ? 'bg-red-950/60 border-red-800 text-red-400 opacity-60 cursor-not-allowed'
                                  : todayTimeSlot === slot
                                  ? 'bg-lime-400 text-black border-lime-400 shadow-md'
                                  : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-lime-400/50'
                              }`}
                            >
                              <span>{slot}</span>
                              <span className="text-[9px] font-semibold mt-0.5">
                                {isFullyBooked ? '⛔ Fully Booked' : slotsLeft !== null ? `🟢 ${slotsLeft} slots left` : 'Available'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#061c16] border border-emerald-800/60 rounded-xl p-3 space-y-2.5 text-xs">
                    <p className="text-[11px] text-lime-400 font-bold">Select Reservation Date & Time:</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-emerald-300 block mb-1">Reservation Date *</label>
                        <input
                          type="date"
                          value={reservationDate}
                          onChange={(e) => setReservationDate(e.target.value)}
                          className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-lime-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-emerald-300 block mb-1">Time Slot *</label>
                        <select
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                          className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-lime-400"
                        >
                          {['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'].map((slot) => {
                            const slotArray = Array.isArray(slotCapacities) ? slotCapacities : (slotCapacities ? Object.values(slotCapacities) : []);
                            const slotInfo = slotArray.find((s: any) => s.slot_time === slot && s.date_key === reservationDate);
                            const isFullyBooked = slotInfo?.is_fully_booked || (slotInfo && slotInfo.booked_count >= slotInfo.max_slots);
                            const slotsLeft = slotInfo ? Math.max(0, slotInfo.max_slots - slotInfo.booked_count) : null;
                            const labelText = `${slot} ${isFullyBooked ? '(Fully Booked)' : slotsLeft !== null ? `(${slotsLeft} slots left)` : ''}`;

                            return (
                              <option key={slot} value={slot} disabled={isFullyBooked}>
                                {labelText}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-emerald-900/60 pt-3">
                <h4 className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-lime-400" /> Fulfillment Method (All To-Go)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFulfillment('delivery')}
                    className={`p-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      fulfillment === 'delivery'
                        ? 'bg-[#082d22] border-lime-400 text-lime-400'
                        : 'bg-[#061c16] border-emerald-800/60 text-emerald-200'
                    }`}
                  >
                    <Truck className="h-4 w-4" /> Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillment('pickup')}
                    className={`p-2.5 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      fulfillment === 'pickup'
                        ? 'bg-[#082d22] border-lime-400 text-lime-400'
                        : 'bg-[#061c16] border-emerald-800/60 text-emerald-200'
                    }`}
                  >
                    <MapPin className="h-4 w-4" /> Pick Up
                  </button>
                </div>
              </div>

              {fulfillment === 'delivery' ? (
                <div className="space-y-3 bg-[#061d16] border border-emerald-800/60 rounded-2xl p-3.5 my-2 text-xs w-full max-w-full">
                  <h5 className="font-bold text-lime-400 flex items-center gap-1.5 border-b border-emerald-900/60 pb-2">
                    <User className="h-3.5 w-3.5" /> Customer Details & Exact Location Pin
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400"
                    />
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400"
                  />

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-lime-400 uppercase tracking-wider text-[10px]">
                        Pin Delivery Location (Map) *
                      </label>
                      <button
                        type="button"
                        onClick={handleUseCurrentGPS}
                        className="text-[10px] font-extrabold bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="size-3" /> Use My GPS
                      </button>
                    </div>

                    {!isPinning ? (
                      <Button
                        type="button"
                        onClick={() => setIsPinning(true)}
                        className="w-full bg-[#04261d] hover:bg-[#063829] text-lime-400 border border-emerald-700 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow"
                      >
                        <MapPin className="size-4 text-lime-400" /> Open Map to Drop Pin
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div ref={mapRef} className="w-full h-48 rounded-xl border border-emerald-800 overflow-hidden bg-black/50" />
                        <p className="text-[10px] text-emerald-300 italic text-center">
                          💡 Click 'Use My GPS' or drag the marker on the map to your exact spot.
                        </p>
                      </div>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    placeholder="Delivery Address (Auto-filled from Pin) *"
                    value={customerLocation}
                    onChange={(e) => setCustomerLocation(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400 resize-none font-mono text-[11px]"
                  />

                  <input
                    type="text"
                    placeholder="Nearest Landmark / Unit No. *"
                    value={nearestLandmark}
                    onChange={(e) => setNearestLandmark(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400"
                  />

                  {deliveryDistanceKm !== null && (
                    <div className="bg-[#03120d] border border-lime-400/60 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-white">
                        <span>Calculated Distance:</span>
                        <span className="text-lime-400">{deliveryDistanceKm} km from Store</span>
                      </div>
                      <div className="flex justify-between font-bold text-white">
                        <span>Delivery Fee Rule:</span>
                        <span className="text-lime-400">
                          {deliveryDistanceKm < 1 ? 'Free (<1km)' : deliveryDistanceKm <= 2 ? '₱40 Fixed (1-2km)' : `₱40 base + ₱5/km succeeding`}
                        </span>
                      </div>
                      <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-emerald-900/60 text-white">
                        <span>Delivery Fee Total:</span>
                        <span className="text-lime-400">{formatPeso(calculatedDeliveryFee)}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-emerald-900/60">
                    <label className="font-bold text-lime-400 uppercase tracking-wider text-[10px] block">
                      Choose Delivery Courier:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryOption('our')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                          deliveryOption === 'our'
                            ? 'bg-[#082d22] border-lime-400 text-lime-400'
                            : 'bg-[#041913] border-emerald-800/60 text-emerald-200'
                        }`}
                      >
                        <span>Our Delivery</span>
                        <span className="text-[10px] opacity-80 font-normal">Calculated by distance & fixed slots</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryOption('maxim')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                          deliveryOption === 'maxim'
                            ? 'bg-[#082d22] border-lime-400 text-lime-400'
                            : 'bg-[#041913] border-emerald-800/60 text-emerald-200'
                        }`}
                      >
                        <span>Maxim Courier</span>
                        <span className="text-[10px] opacity-80 font-normal">Deliver anytime</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-[#061d16] border border-emerald-800/60 rounded-2xl p-3.5 my-3 text-xs w-full overflow-hidden">
                  <div className="space-y-1.5">
                    <h5 className="font-bold text-lime-400 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Pick Up Details
                    </h5>
                    <input
                      type="text"
                      placeholder="Name of Person Picking Up *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <div className="space-y-1 pt-1">
                    <h5 className="font-bold text-lime-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Pick Up Location
                    </h5>
                    <p className="text-xs font-semibold text-white">
                      Consuelo Village, Basak, Mandaue City, Cebu 6014
                    </p>
                  </div>

                  <div className="w-full h-44 rounded-xl overflow-hidden border border-emerald-800/80 mt-2 bg-[#020b08]">
                    <iframe
                      title="Store Pickup Location"
                      className="w-full h-full border-0"
                      loading="lazy"
                      src="https://maps.google.com/maps?q=10.359511%2C%20123.952739&t=&z=16&ie=UTF8&iwloc=&output=embed"
                    />
                  </div>
                </div>
              )}

              <div className="bg-[#061d16] border border-lime-400/40 rounded-xl p-3 text-xs text-emerald-200 my-2 space-y-1">
                <p className="font-bold text-lime-400 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Payment Term:
                </p>
                <p className="text-white font-semibold">
                  All payments will be collected <span className="text-lime-400 underline">upon delivery or upon pick up</span> for security and safety to both parties.
                </p>
              </div>

              <div className="space-y-2 border-t border-emerald-900/60 pt-3">
                <div className="flex items-center justify-between text-xs text-emerald-200">
                  <span>Food Subtotal</span>
                  <span className="font-bold text-white">{formatPeso(total)}</span>
                </div>

                {foodDiscountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-amber-400 font-semibold">
                    <span>Food Promo Discount ({appliedPromos.filter(p => p.targetType !== 'delivery' && p.target_type !== 'delivery' && p.scope !== 'delivery').map(p => p.code).join(', ')})</span>
                    <span>-{formatPeso(foodDiscountAmount)}</span>
                  </div>
                )}

                {fulfillment === 'delivery' && (
                  <>
                    <div className="flex items-center justify-between text-xs text-emerald-200">
                      <span>Delivery Fee {deliveryDistanceKm !== null ? `(${deliveryDistanceKm} km)` : ''}</span>
                      <span className="font-bold text-white">{formatPeso(rawDeliveryFee)}</span>
                    </div>

                    {deliveryDiscountAmount > 0 && (
                      <div className="flex items-center justify-between text-xs text-lime-400 font-semibold">
                        <span>Delivery Promo Discount ({appliedPromos.filter(p => p.targetType === 'delivery' || p.target_type === 'delivery' || p.scope === 'delivery').map(p => p.code).join(', ')})</span>
                        <span>-{formatPeso(deliveryDiscountAmount)}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between text-sm border-t border-emerald-900/40 pt-2">
                  <span className="font-extrabold text-white">Total Amount Due</span>
                  <span className="font-extrabold text-lime-400 text-xl">{formatPeso(finalCartTotal)}</span>
                </div>

                <Button
                  disabled={
                    lines.length === 0 ||
                    (fulfillment === 'delivery' && (!customerName || !customerEmail || !customerPhone || !customerLocation || !nearestLandmark)) ||
                    (fulfillment === 'pickup' && !customerName) ||
                    (orderType === 'reservation' && !reservationDate) ||
                    isStoreClosedForToday
                  }
                  onClick={handleConfirmOrder}
                  className={`w-full font-extrabold py-3 rounded-xl text-sm transition-all shadow-lg cursor-pointer ${
                    isStoreClosedForToday
                      ? 'bg-red-950 text-red-300 border border-red-800 opacity-90 cursor-not-allowed hover:bg-red-950'
                      : 'bg-lime-400 hover:bg-lime-500 text-black'
                  }`}
                >
                  {isStoreClosedForToday ? 'Store is Closed — Will Be Back Later at 12 NOON' : 'Confirm & Place Order'}
                </Button>

                {isStoreClosedForToday && (
                  <p className="text-center text-[11px] text-amber-300 font-medium pt-1">
                    💡 <em>Though the store is closed, you can still apply a reservation for tomorrow!</em> Just switch your Order Schedule Type to <strong>Reservation</strong> above.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// SECTION 30: Default export for the OrderingCounter component.
export default OrderingCounter;