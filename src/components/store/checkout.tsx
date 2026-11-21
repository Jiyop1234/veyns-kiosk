// @ts-nocheck
// Checkout — the whole checkout dialog and everything behind it (Step 5).
// Moved out of ordering-counter.tsx. Look and behavior are unchanged.
// Owns: delivery/pickup, scheduling and slot capacity, the delivery map and fee, promo/voucher codes and discounts,
// the milestone auto-discount, placing the order through the Supabase RPC, and the confirmation screen.
// OrderingCounter keeps the data this file only receives as props: the promo list, loyalty stamps, the clock tick, and the open flag.
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowRight, Camera, Check, CreditCard, Facebook, Instagram, MapPin, Minus, Plus, Search, ShoppingBag, Star, Trash2, Truck, User, History, Award, AlertTriangle, XCircle, Clock, Navigation, Calendar, UserPlus, Ticket, X, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/menu-data';
import { getPromoStatus, getPromoEndMs } from '@/lib/promo-campaigns';
import { useCart } from '@/lib/cart';
import { getOrderHistoryStorageKey, isGuestUser } from '@/components/store/profile-page';
import { supabase } from '@/lib/supabase';
import { requestCustomerGeocode } from '@/lib/order-geocode';
import { useTimeSlots, slotHasEnded, slotOrderBlock, isStoreOpenNow, todayKeyManila, useMinuteTick, STORE_OPEN_LABEL } from '@/lib/time-slots';

export function Checkout({
  open,
  onOpenChange,
  resetKey,
  currentUser,
  setOrderHistory,
  onOrderPlacedSuccess,
  onOpenRegister,
  nowTimestamp,
  availablePromos,
  loadPromosFromCloud,
  stamps,
  loyaltyStatus
}: any) {
  const { add, lines, setLineQty, remove, clear, total } = useCart();
  const isGuest = isGuestUser(currentUser);
  // Voucher codes this account has already successfully redeemed (the database re-checks this at checkout)
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>([]);

  // Slot capacities & Fully Booked states
  const [slotCapacities, setSlotCapacities] = useState<Record<string, any>>({});
  // Must match the default max bowls used by your place_order database function.
  const DEFAULT_MAX_BOWLS = 10;
  const SLOT_FULL_MSG = 'Sorry! This time slot is already fully booked. Please select another available schedule.';
  const cartBowlsNeeded = lines.reduce((s: number, l: any) => s + (Number(l.qty) || 0), 0);
  const getSlotStatus = (dateKey: string, slot: string) => {
    const info: any = Object.values(slotCapacities || {}).find((x: any) => x.slot_time === slot && x.date_key === dateKey);
    const max = Number(info?.max_bowls) || DEFAULT_MAX_BOWLS;
    const booked = Number(info?.booked_bowls) || 0;
    const left = Math.max(0, max - booked);
    const closed = !!(info?.is_fully_booked || info?.is_manually_fully_booked);
    const full = closed || left <= 0;
    // not full, but fewer bowls left than this cart needs: the database would reject it, so do not offer it
    const short = !full && cartBowlsNeeded > 0 && left < cartBowlsNeeded;
    return { left, full, short };
  };

  // "Order Today" rules (Asia/Manila): the store opens at 12 noon, and orders for a time slot close
  // 1 hour before it starts, so Order Today only works while at least one slot can still be booked.
  const nowTick = useMinuteTick();
  const timeSlots = useTimeSlots(); // edited by staff (live)
  const storeOpenNow = isStoreOpenNow(nowTick);
  const todayKeyNow = todayKeyManila(nowTick);
  const slotIsBookable = (dateKey: string, slot: string) =>
    slotOrderBlock(dateKey, slot, nowTick) === null && !getSlotStatus(dateKey, slot).full && !getSlotStatus(dateKey, slot).short;
  const todayHasBookableSlot = timeSlots.some((slot) => slotOrderBlock(todayKeyNow, slot, nowTick) === null);
  const orderTodayOpen = storeOpenNow && todayHasBookableSlot;

  // This account's successful redemptions (RLS only returns the signed-in customer's own rows)
  const loadMyRedemptions = async () => {
    try {
      if (!currentUser || isGuest || !currentUser.authUserId) { setRedeemedCodes([]); return; }
      const { data } = await supabase
        .from('promo_redemptions')
        .select('promo_code')
        .eq('user_id', currentUser.authUserId)
        .eq('status', 'redeemed');
      setRedeemedCodes(Array.from(new Set((data || []).map((r: any) => String(r.promo_code).toUpperCase()))));
    } catch (e) { /* the database still enforces the rule at checkout */ }
  };

    // Load slot capacities from Supabase
  const loadSlotCapacities = async () => {
    try {
      const { data, error } = await supabase
        .from('slot_capacities')
        .select('*');

      if (error) {
        console.error('Error fetching slot capacities:', error);
        return;
      }

      if (data) {
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
  };

  // Slot capacities: initial load, live updates from Supabase Realtime, and storage-triggered refresh.
  useEffect(() => {
    loadSlotCapacities();

    const slotsChannel = supabase
      .channel('public_slot_capacities_counter_' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slot_capacities' }, () => {
        loadSlotCapacities();
      });
    slotsChannel.subscribe();

    const handleStorageChange = () => {
      loadSlotCapacities();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      supabase.removeChannel(slotsChannel);
    };
  }, []);

  // Expired vouchers are removed from the order every second (same clock as the voucher countdowns).
  useEffect(() => {
    setAppliedPromos((prev) =>
      prev.filter((p) => {
        const endMs = getPromoEndMs(p);
        return endMs === null || nowTimestamp < endMs;
      })
    );
  }, [nowTimestamp]);

  // Opening the checkout always starts from the order form, never from an old confirmation screen.
  useLayoutEffect(() => {
    if (open) setOrderPlaced(false);
  }, [open]);

    // --- Phase 3b: card flip state + milestone auto-apply preview ---
  const [milestonePreview, setMilestonePreview] = useState<any>(null);
  const loadMilestonePreview = async () => {
    if (!currentUser || isGuest || !currentUser.authUserId) { setMilestonePreview(null); return; }
    try {
      const { data } = await supabase.rpc('preview_milestone_reward', { p_user_id: currentUser.authUserId });
      setMilestonePreview(data?.applies ? data : null);
    } catch (e) { console.error('Milestone preview failed:', e); setMilestonePreview(null); }
  };
  useEffect(() => {
    const cartCount = lines.reduce((sum: number, l: any) => sum + (l.qty || 0), 0);
    if (cartCount > 0) { void loadMilestonePreview(); }
    else { setMilestonePreview(null); setAppliedPromos((prev) => prev.filter((p) => !p.code.startsWith('MILESTONE-'))); }
  }, [lines, currentUser]);
  useEffect(() => {
    if (!milestonePreview?.applies) return;
    setAppliedPromos((prev) => {
      if (prev.some((p) => p.code === milestonePreview.code_label)) return prev;
      return [...prev, {
        code: milestonePreview.code_label,
        type: milestonePreview.discount_type === 'peso' ? 'peso' : 'percentage',
        discountValue: Number(milestonePreview.discount_value),
        targetType: 'subtotal',
        createdAt: Date.now(),
        expiryDurationMs: 0,
        virtualMilestone: true
      }];
    });
  });



  const [promoInput, setPromoInput] = useState('');
  const [appliedPromos, setAppliedPromos] = useState<any[]>([]); // Stacking multiple vouchers
  const [promoError, setPromoError] = useState('');
  const [claimedVouchersState, setClaimedVouchersState] = useState<{ [code: string]: number }>({});

  // If the cart shrinks below a voucher's minimum purchase, remove it so checkout never submits a promo the server will reject.
  useEffect(() => {
    const belowMin = appliedPromos.filter((p) => Number(p.minPurchase || 0) > 0 && total < Number(p.minPurchase));
    if (belowMin.length > 0) {
      setAppliedPromos((prev) => prev.filter((p) => !belowMin.some((b) => b.code === p.code)));
      setPromoError(`Removed ${belowMin.map((b) => b.code).join(', ')}: the order is below its minimum purchase.`);
    }
  }, [total, appliedPromos]);


  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('delivery');
  const [deliveryOption, setDeliveryOption] = useState<'our' | 'maxim'>('our');

  // Order Type & Scheduling States
  const [orderType, setOrderType] = useState<'today' | 'reservation'>(orderTodayOpen ? 'today' : 'reservation');
  const [todayTimeSlot, setTodayTimeSlot] = useState('12:00 PM - 1:00 PM');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('12:00 PM - 1:00 PM');

  // Time slots are edited by staff (live). Keep the current choice valid when they change.
  useEffect(() => {
    if (timeSlots.length === 0) return;
    setTodayTimeSlot((p) => (timeSlots.includes(p) ? p : timeSlots[0]));
    setReservationTime((p) => (timeSlots.includes(p) ? p : timeSlots[0]));
  }, [timeSlots]);

  // Keep the chosen slots valid: skip slots that already ended, are inside the 1-hour order cutoff, or are full.
  useEffect(() => {
    if (orderType !== 'today') return;
    if (slotIsBookable(todayKeyNow, todayTimeSlot)) return;
    const next = timeSlots.find((s) => slotIsBookable(todayKeyNow, s));
    setTodayTimeSlot(next || '');
  }, [orderType, todayTimeSlot, timeSlots, slotCapacities, nowTick]);

  useEffect(() => {
    if (!reservationDate) return;
    if (slotIsBookable(reservationDate, reservationTime)) return;
    const next = timeSlots.find((s) => slotIsBookable(reservationDate, s));
    setReservationTime(next || '');
  }, [reservationDate, reservationTime, slotCapacities, timeSlots, nowTick]);

  // If the store closes / the last slot of the day is gone while "Order Today" is selected, switch to Reservation.
  useEffect(() => {
    if (!orderTodayOpen && orderType === 'today') setOrderType('reservation');
  }, [orderTodayOpen, orderType]);

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
    if (open && fulfillment === 'delivery' && isPinning) {
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
  }, [open, fulfillment, isPinning]);

  // Tear down the map whenever its container leaves the page, so it can be rebuilt cleanly next time.
  useEffect(() => {
    if (!(open && fulfillment === 'delivery' && isPinning) && mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch (e) {}
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    }
  }, [open, fulfillment, isPinning]);

  // SECTION 11: Initialize the delivery map and allow customers to choose a delivery location.
  const initMap = () => {
    if (!mapRef.current) return;
    // If an old map exists but its container was removed from the page (e.g. switched to Pick Up and back), discard it and rebuild.
    if (mapInstanceRef.current) {
      if (mapInstanceRef.current.getContainer && mapInstanceRef.current.getContainer() === mapRef.current) return;
      try { mapInstanceRef.current.remove(); } catch (e) {}
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    }
    const L = window.L;
    if (!L) return;

    const customIcon = L.divIcon({
      className: 'custom-map-marker',
      html: '<div style="background-color: #a3e635; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #000; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const startLat = deliveryCoordinates ? deliveryCoordinates.lat : STORE_LAT;
    const startLng = deliveryCoordinates ? deliveryCoordinates.lng : STORE_LNG;
    const map = L.map(mapRef.current).setView([startLat, startLng], deliveryCoordinates ? 16 : 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const customerInitialLat = startLat;
    const customerInitialLng = startLng;

    const marker = L.marker([customerInitialLat, customerInitialLng], { draggable: true, icon: customIcon }).addTo(map);
    marker.bindPopup('<b>Tap the map or drag me to drop your delivery pin</b>').openPopup();
    markerInstanceRef.current = marker;

    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      await processSelectedCoordinates(pos.lat, pos.lng);
    });

    map.on('click', async (e: any) => {
      marker.setLatLng(e.latlng);
      await processSelectedCoordinates(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 150);
  };

  // SECTION 12: Process selected coordinates and calculate delivery costs.
  // The pin NEVER fills the customer's address: customers type their own address and landmark.
  // The readable map address is generated on the server and is visible to staff only.
  const processSelectedCoordinates = async (lat: number, lng: number) => {
    setDeliveryCoordinates({ lat, lng });
    const dist = calculateDistanceKm(STORE_LAT, STORE_LNG, lat, lng);
    const roundedDist = Number(dist.toFixed(3));
    setDeliveryDistanceKm(roundedDist);

    const fee = computeFeeFromKm(dist);
    setCalculatedDeliveryFee(fee);

    if (geocodeTimeoutRef.current) clearTimeout(geocodeTimeoutRef.current);
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
        alert('Unable to retrieve your location. Please type your address or drop a pin on the map.');
      }
    );
  };

  // SECTION 13: Order-history writes (the list itself is owned by StorePage).
  const setHistoryList = setOrderHistory;


  const [orderPlaced, setOrderPlaced] = useState(false);
  // Refresh this account's redeemed vouchers when the account changes and after every order
  useEffect(() => { void loadMyRedemptions(); }, [currentUser?.authUserId, isGuest, orderPlaced]);
  const [placedOrderDetails, setPlacedOrderDetails] = useState(null);

  const userHistoryStorageKey = getOrderHistoryStorageKey(currentUser);

  useEffect(() => {
    if (resetKey !== undefined) {
      setAppliedPromos([]);
      setPromoInput('');
    }
  }, [resetKey]);

  // SECTION 15: Create orders only through the server-validated Supabase RPC.
  const orderIdempotencyKeyRef = useRef<string>((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
  const placingOrderRef = useRef(false);

  // Checkout validation: required fields turn red after the customer taps "Confirm & Place Order".
  const [showErrors, setShowErrors] = useState(false);
  const getMissingFields = () => {
    const m: string[] = [];
    if (!String(customerName || '').trim()) m.push('customerName');
    if (fulfillment === 'delivery') {
      if (!String(customerEmail || '').trim()) m.push('customerEmail');
      if (!String(customerPhone || '').trim()) m.push('customerPhone');
      if (deliveryOption === 'our' && !deliveryCoordinates) m.push('deliveryPin');
      if (!String(customerLocation || '').trim()) m.push('customerLocation');
      if (!String(nearestLandmark || '').trim()) m.push('nearestLandmark');
    }
    if (orderType === 'reservation' && !reservationDate) m.push('reservationDate');
    // a slot that is full / closed / too small for this cart must never be submitted
    if (orderType === 'reservation' && reservationDate && !slotIsBookable(reservationDate, reservationTime)) m.push('reservationTime');
    if (orderType === 'today' && !(fulfillment === 'delivery' && deliveryOption === 'maxim') && !slotIsBookable(todayKeyNow, todayTimeSlot)) m.push('todayTimeSlot');
    return m;
  };
  const errCls = (key: string, normal = 'border-emerald-800/80') =>
    showErrors && getMissingFields().includes(key) ? 'border-red-500 ring-2 ring-red-500/50' : normal;
  const saveOrderToHistory = async (newOrder: any) => {
    // Calculate total quantity of bowls ordered across all cart lines
    const totalBowlsCount = lines.reduce((sum, line) => sum + (line.qty || 1), 0);
    const targetDateKey = newOrder.orderType === 'reservation' ? reservationDate : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
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

    // Atomic server-side placement: order is numbered, priced, promo-validated and its slot reserved
    // in ONE database transaction. If anything fails nothing is saved (no orphan orders).
    // The idempotency key makes double-clicks / network retries return the same order.
    const { data: orderDataRes, error: orderErr } = await supabase.rpc('place_order', {
      p_order: {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        fulfillment: payload.fulfillment,
        location: payload.location,
        landmark: payload.landmark,
        orderType: payload.orderType,
        scheduleInfo: payload.scheduleInfo,
        deliveryFee: payload.deliveryFee,
        deliveryOption: newOrder.deliveryOption,
        deliveryLat: payload.deliveryLat,
        deliveryLng: payload.deliveryLng,
        promoCodesList: payload.promoCodesList,
        items: payload.items,
        dateKey: targetDateKey,
        slotTime: targetSlotTime,
        accountNickname: isGuest ? 'Guest' : (currentUser?.name || 'User'),
        idempotencyKey: orderIdempotencyKeyRef.current
      }
    });

    if (orderErr || !orderDataRes) throw new Error(orderErr?.message || 'Order could not be saved.');
    const placedKey = orderIdempotencyKeyRef.current; // the key of THIS order (a new one is issued below)
    orderIdempotencyKeyRef.current = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);

    // The server generates the ADMIN-ONLY map address from the saved pin. Customers never receive it.
    if (newOrder.fulfillment === 'delivery' && newOrder.deliveryOption === 'our' && orderDataRes.id) {
      void requestCustomerGeocode(String(orderDataRes.id), placedKey);
    }

    const savedOrder = { ...newOrder, orderNumber: orderDataRes.order_number, items: orderDataRes.items, subtotal: Number(orderDataRes.subtotal || newOrder.subtotal), promoDiscount: Number(orderDataRes.promo_discount || 0), promoCode: orderDataRes.promo_code || null, promoCodesList: orderDataRes.promo_code ? String(orderDataRes.promo_code).split(',').map((c: string) => c.trim()) : [], deliveryDiscount: Number(orderDataRes.delivery_discount || 0), deliveryFee: Number(orderDataRes.delivery_fee || newOrder.deliveryFee), total: Number(orderDataRes.total || newOrder.total), deliveryFeePending: !!orderDataRes.delivery_fee_pending };
    
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

    const promoStatus = getPromoStatus(found, Date.now());
    if (promoStatus === 'disabled') {
      setPromoError('This promo is not currently available.');
      return;
    }
    if (promoStatus === 'scheduled') {
      setPromoError('This promo has not started yet.');
      return;
    }
    if (promoStatus === 'expired') {
      setPromoError('Sorry! This voucher has expired.');
      return;
    }
    // One-time voucher already redeemed by this account (the database checks this again at checkout)
    if (found.perPersonLimit === 1 && redeemedCodes.includes(String(found.code).toUpperCase())) {
      setPromoError('You have already used this voucher. Each account is only allowed to redeem it once.');
      return;
    }
    if (found.minPurchase > 0 && total < found.minPurchase) {
      setPromoError(`This promo needs a minimum order of ${formatPeso(found.minPurchase)}.`);
      return;
    }

    if (found.usageLimit && (found.usageCount || 0) >= found.usageLimit) {
      setPromoError('Sorry! This voucher has reached its maximum redemption limit.');
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

    if (promo.perPersonLimit === 1 && redeemedCodes.includes(String(promo.code).toUpperCase())) {
      alert('You have already used this voucher. Each account is only allowed to redeem it once.');
      return;
    }

    if (promo.usageLimit && (promo.usageCount || 0) >= promo.usageLimit) {
      alert('Sorry! This voucher has reached its maximum redemption limit.');
      return;
    }

    const claimEndMs = getPromoEndMs(promo);
    if (claimEndMs !== null && Date.now() >= claimEndMs) {
      alert('Sorry! This voucher has expired.');
      return;
    }

    handleApplyPromoCodeString(promo.code);
  };

  // SECTION 20: Calculate separate food vs delivery promotion discounts and order totals.
  const rawDeliveryFee = fulfillment === 'delivery' && deliveryOption === 'our' ? calculatedDeliveryFee : 0;
  // No pin dropped: the typed address is used and the store confirms the delivery fee afterwards.
  const deliveryFeePending = fulfillment === 'delivery' && deliveryOption === 'our' && !deliveryCoordinates;

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

  const handleConfirmOrder = async () => {
    if (placingOrderRef.current) return; // ignore double-clicks while an order is being saved
    const missing = getMissingFields();
    if (missing.includes('reservationTime') || missing.includes('todayTimeSlot')) {
      setShowErrors(true);
      alert(SLOT_FULL_MSG);
      void loadSlotCapacities();
      return;
    }
    if (missing.length > 0) {
      setShowErrors(true);
      setTimeout(() => {
        const el = document.querySelector('[data-field="' + missing[0] + '"]') as any;
        if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el?.focus && missing[0] !== 'deliveryPin') { try { el.focus({ preventScroll: true }); } catch {} }
      }, 50);
      return;
    }
    if (orderType === 'today' && !orderTodayOpen) {
      alert(storeOpenNow ? 'No more time slots are available today. Please select a reservation instead.' : 'Store is closed. We will be back at 12 NOON. Please select a reservation instead.'); return;
    }
    const scheduleInfoText = orderType === 'today'
      ? fulfillment === 'delivery'
        ? (deliveryOption === 'our' ? 'Today (' + todayTimeSlot + ') - Personal Delivery' : 'Today - Maxim Delivery (Anytime)')
        : 'Today - Pickup'
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
    placingOrderRef.current = true;
    try {
      const savedOrder = await saveOrderToHistory(orderData);
      setPlacedOrderDetails(savedOrder);
      setOrderPlaced(true);
      if (onOrderPlacedSuccess) await onOrderPlacedSuccess();
    } catch (error: any) {
      console.error('Order submission failed:', error);
      const msg = String(error?.message || '');
      if (/fully booked|closed by the administrator|valid date and time slot|no longer available/i.test(msg)) {
        alert(SLOT_FULL_MSG);
        void loadSlotCapacities();
      } else if (/Not enough capacity/i.test(msg)) {
        alert(msg + ' Please reduce your order or choose another schedule.');
        void loadSlotCapacities();
      } else {
        alert(msg || 'Unable to place this order. Please try again.');
        // A voucher rule can change while the customer is checking out (limit reached, already used, expired):
        // refresh so the voucher list and the applied vouchers match the database.
        if (/voucher|promo/i.test(msg)) { void loadPromosFromCloud(); void loadMyRedemptions(); }
      }
    } finally {
      placingOrderRef.current = false;
    }
  };

  const handleCloseConfirmation = () => {
    clear();
    setOrderPlaced(false);
    onOpenChange(false);
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
  const publicVouchersList = availablePromos.filter(p => p.visibility !== 'hidden' && getPromoStatus(p, nowTimestamp) === 'active');

  const isStoreClosedForToday = orderType === 'today' && !orderTodayOpen;

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {!placedOrderDetails.promoCode && (
                    <div className="flex justify-between text-emerald-200">
                      <span>Promo:</span>
                      <span className="font-bold text-white">NA</span>
                    </div>
                  )}
                  {placedOrderDetails.promoDiscount > 0 && (
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Promo Discount ({placedOrderDetails.promoCode}):</span>
                      <span>-{formatPeso(placedOrderDetails.promoDiscount)}</span>
                    </div>
                  )}
                  {placedOrderDetails.fulfillment === 'delivery' && (
                    <div className="flex justify-between text-emerald-200">
                      <span>Delivery Fee{placedOrderDetails.deliveryOption === 'our' ? ` (${placedOrderDetails.deliveryDistanceKm} km)` : ''}:</span>
                      <span className="font-bold text-white">{placedOrderDetails.deliveryOption === 'maxim' ? 'Paid to Maxim app' : placedOrderDetails.deliveryFeePending ? 'To be confirmed' : formatPeso(placedOrderDetails.deliveryFee)}</span>
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
                                  if (lines.length <= 1) onOpenChange(false);
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
                      const isUsedByMe = promo.perPersonLimit === 1 && redeemedCodes.includes(String(promo.code).toUpperCase());
                      const isLimitReached = Boolean(promo.usageLimit) && (promo.usageCount || 0) >= promo.usageLimit;

                      // Calculate real-time countdown using the existing nowTimestamp state
                      let timeRemainingText = 'Never expires';
                      let isExpired = false;
                      const promoEndMs = getPromoEndMs(promo);
                      if (promoEndMs !== null) {
                        const diff = promoEndMs - nowTimestamp;
                        if (diff <= 0) {
                          timeRemainingText = 'Expired';
                          isExpired = true;
                        } else {
                          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                          timeRemainingText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
                        }
                      }

                      return (
                        <div key={pIdx} className="bg-[#061d16] border border-emerald-800/70 rounded-xl p-2.5 flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="font-extrabold text-lime-400 text-xs">{promo.code}</span>
                            {promo.name && <span className="ml-1.5 text-[10px] font-bold text-white">{promo.name}</span>}
                            <p className="text-[10px] text-emerald-200">
                              {promo.targetType === 'delivery' ? 'Delivery Discount: ' : 'Food Discount: '}
                              {promo.type === 'peso' ? formatPeso(promo.discountValue) + ' OFF' : `${promo.discountValue}% OFF`}
                            </p>
                            {promo.minPurchase > 0 && (
                              <p className="text-[9px] text-emerald-300">Min. order {formatPeso(promo.minPurchase)}</p>
                            )}
                            <p className={`text-[9px] font-mono ${isExpired ? 'text-red-400 font-bold' : 'text-amber-300'}`}>
                              ⏳ {timeRemainingText}
                            </p>
                            {isAlreadyApplied && (
                              <p className="text-[9px] text-lime-300">✓ Stacked and applied.</p>
                            )}
                            {isUsedByMe && !isAlreadyApplied && (
                              <p className="text-[9px] text-amber-300">Already used on this account.</p>
                            )}
                            {isLimitReached && !isUsedByMe && (
                              <p className="text-[9px] text-red-400">Redemption limit reached.</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isExpired || isAlreadyApplied || isUsedByMe || isLimitReached}
                            onClick={() => handleClaimVoucher(promo)}
                            className={`bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-extrabold text-[10px] px-3 py-1 rounded-lg cursor-pointer ${
                              isExpired ? 'opacity-50 cursor-not-allowed bg-red-950/40 text-red-400 border-red-800 hover:bg-red-950/40 hover:text-red-400' : ''
                            }`}
                          >
                            {isExpired ? 'Expired' : isAlreadyApplied ? 'Applied ✓' : isUsedByMe ? 'Used' : isLimitReached ? 'Unavailable' : 'Claim & Stack'}
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
                        alert(storeOpenNow ? '⚠️ No more time slots are available today. Please select "Reservation" instead.' : '⚠️ Store is closed! We will be back at 12 NOON. Please select "Reservation" instead.');
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
                    <Clock className="h-4 w-4 shrink-0" />
                    {orderTodayOpen ? 'Order Today' : (
                      <span className="flex flex-col items-center leading-tight">
                        <span>{storeOpenNow ? 'No slots left today' : 'Order Today · CLOSED'}</span>
                        {!storeOpenNow && <span className="text-[9px] font-semibold">Be back at {STORE_OPEN_LABEL}</span>}
                      </span>
                    )}
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

                <p className="text-[10px] text-emerald-400/80">⏱ Orders for each time slot close 1 hour before it starts.</p>

                {orderType === 'today' ? (
                  <div className="bg-[#061c16] border border-emerald-800/60 rounded-xl p-3 space-y-2 text-xs">
                    <p className="text-[11px] text-emerald-200 font-medium">
                      {fulfillment === 'delivery' && deliveryOption === 'our'
                        ? 'Select your preferred personal delivery time slot (live slots checked):'
                        : fulfillment === 'delivery' && deliveryOption === 'maxim'
                        ? 'Maxim Courier selected: You can have your order delivered anytime today.'
                        : 'Pick up today at your convenience.'}
                    </p>

                    {(fulfillment === 'delivery' && deliveryOption === 'our') || fulfillment === 'pickup' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {timeSlots.map((slot) => {
                          const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
                          const { left: bowlsLeft, full: isFullyBooked, short: isShort } = getSlotStatus(todayKey, slot);
                          const slotBlock = slotOrderBlock(todayKey, slot, nowTick);
                          const isPastSlot = slotBlock !== null;
                          
                          const isDisabled = isFullyBooked || isShort || isPastSlot;
                          
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setTodayTimeSlot(slot)}
                              className={`p-2 rounded-lg border text-[11px] font-bold transition-all flex flex-col items-center justify-between ${
                                isDisabled
                                  ? 'bg-red-950/60 border-red-800 text-red-400 opacity-60 cursor-not-allowed'
                                  : todayTimeSlot === slot
                                  ? 'bg-lime-400 text-black border-lime-400 shadow-md'
                                  : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-lime-400/50'
                              }`}
                            >
                              <span>{slot}</span>
                              <span className="text-[9px] font-semibold mt-0.5">
                                {slotBlock === 'ended' ? '⏰ Past' : slotBlock === 'cutoff' ? '🔒 Orders closed (1 hr before)' : isFullyBooked ? '⛔ Fully Booked' : isShort ? `🟡 Only ${bowlsLeft} bowl${bowlsLeft === 1 ? '' : 's'} left (cart has ${cartBowlsNeeded})` : `🟢 Available (${bowlsLeft} bowls)`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="bg-[#061c16] border border-emerald-800/60 rounded-xl p-3 space-y-2.5 text-xs">
                    <p className="text-[11px] text-lime-400 font-bold">Select Reservation Date & Time:</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-emerald-300 block mb-1">Reservation Date *</label>
                        <div className="relative">
                          <div data-field="reservationDate" className={`flex items-center justify-between w-full bg-[#041913] border ${errCls('reservationDate')} rounded-lg p-2.5 text-xs`}>
                            <span className={reservationDate ? 'text-white font-semibold' : 'text-emerald-500'}>
                              {reservationDate ? new Date(reservationDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Tap to choose a date'}
                            </span>
                            <Calendar className="h-4 w-4 text-lime-400" />
                          </div>
                          <input
                            type="date"
                            min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })}
                            value={reservationDate}
                            onChange={(e) => setReservationDate(e.target.value)}
                            onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch {} }}
                            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer text-base [color-scheme:dark]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-emerald-300 block mb-1">Time Slot *</label>
                        <select
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                          className="w-full bg-[#041913] border border-emerald-800/80 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-lime-400"
                        >
                          {timeSlots.map((slot) => {
                            const { left: bowlsLeft, full: isFullyBooked, short: isShort } = reservationDate ? getSlotStatus(reservationDate, slot) : { left: DEFAULT_MAX_BOWLS, full: false, short: false };
                            const slotBlock = reservationDate ? slotOrderBlock(reservationDate, slot, nowTick) : null;
                            const isPastSlot = slotBlock !== null;
                            
                            const isDisabled = isFullyBooked || isShort || isPastSlot;
                            const labelText = `${slot} ${slotBlock === 'ended' ? '(Past)' : slotBlock === 'cutoff' ? '(Orders closed)' : isFullyBooked ? '(Fully Booked)' : isShort ? `(Only ${bowlsLeft} left - cart has ${cartBowlsNeeded})` : `(Available: ${bowlsLeft} bowls)`}`;
                            
                            return (
                              <option key={slot} value={slot} disabled={isDisabled}>
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
                      data-field="customerName" className={`w-full bg-[#041913] border ${errCls('customerName')} rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400`}
                    />
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      data-field="customerEmail" className={`w-full bg-[#041913] border ${errCls('customerEmail')} rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400`}
                    />
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    placeholder="Phone Number *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    data-field="customerPhone" className={`w-full bg-[#041913] border ${errCls('customerPhone')} rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400`}
                  />

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-lime-400 uppercase tracking-wider text-[10px]">
                        {deliveryOption === 'our' ? 'Pin on Map (Required)' : 'Pin on Map (Optional)'}
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
                        data-field="deliveryPin"
                        onClick={() => setIsPinning(true)}
                        className={`w-full bg-[#04261d] hover:bg-[#063829] text-lime-400 border ${errCls('deliveryPin', 'border-emerald-700')} font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow`}
                      >
                        <MapPin className="size-4 text-lime-400" /> {deliveryOption === 'our' ? 'Open Map to Drop Pin (Required)' : 'Open Map to Drop Pin (Optional)'}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div ref={mapRef} className="w-full h-48 rounded-xl border border-emerald-800 overflow-hidden bg-black/50" />
                        <p className="text-[10px] text-emerald-300 italic text-center">
                          💡 Tap the map or drag the marker to your exact delivery spot (or use 'Use My GPS', then adjust the marker). The pin sets your delivery fee. Type your address and landmark yourself below.
                        </p>
                      </div>
                    )}
                  </div>

                  {showErrors && getMissingFields().includes('deliveryPin') && (
                    <p className="text-[11px] font-bold text-red-400">Please pin your delivery location on the map. We need it to calculate your delivery fee.</p>
                  )}

                  <textarea
                    rows={2}
                    placeholder="Complete Delivery Address * (house no., street, barangay, city)"
                    value={customerLocation}
                    onChange={(e) => setCustomerLocation(e.target.value)}
                    data-field="customerLocation" className={`w-full bg-[#041913] border ${errCls('customerLocation')} rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400 resize-none font-mono text-[11px]`}
                  />
                  {showErrors && getMissingFields().includes('customerLocation') && (
                    <p className="text-[11px] font-bold text-red-400">Please type your complete delivery address.</p>
                  )}

                  <input
                    type="text"
                    placeholder="Nearest Landmark * (school, church, store...)"
                    value={nearestLandmark}
                    onChange={(e) => setNearestLandmark(e.target.value)}
                    data-field="nearestLandmark" className={`w-full bg-[#041913] border ${errCls('nearestLandmark')} rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400`}
                  />

                  {showErrors && getMissingFields().includes('nearestLandmark') && (
                    <p className="text-[11px] font-bold text-red-400">Please enter your nearest landmark.</p>
                  )}

                  {deliveryDistanceKm !== null && deliveryOption === 'our' && (
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

                  {deliveryOption === 'maxim' && (
                    <div className="bg-[#03120d] border border-amber-400/50 rounded-xl p-3 text-xs text-amber-200">
                      The delivery fee is set by the Maxim app and paid separately to the rider. The total here is food only.
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
                      data-field="customerName" className={`w-full bg-[#041913] border ${errCls('customerName')} rounded-lg p-2 text-white placeholder:text-emerald-500 focus:outline-none focus:border-lime-400`}
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
                      <span>Delivery Fee {deliveryOption === 'our' && deliveryDistanceKm !== null ? `(${deliveryDistanceKm} km)` : ''}</span>
                      <span className="font-bold text-white">{deliveryOption === 'maxim' ? 'Paid to Maxim app' : deliveryFeePending ? 'To be confirmed' : formatPeso(rawDeliveryFee)}</span>
                    </div>
                    {deliveryFeePending && (
                      <p className="text-[10px] text-amber-300">No map pin was dropped, so the store will confirm your delivery fee. It is not included in the total yet.</p>
                    )}

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
                  disabled={lines.length === 0 || isStoreClosedForToday}
                  onClick={handleConfirmOrder}
                  className={`w-full font-extrabold py-3 rounded-xl text-sm transition-all shadow-lg cursor-pointer ${
                    isStoreClosedForToday
                      ? 'bg-red-950 text-red-300 border border-red-800 opacity-90 cursor-not-allowed hover:bg-red-950'
                      : 'bg-lime-400 hover:bg-lime-500 text-black'
                  }`}
                >
                  {isStoreClosedForToday ? 'Store is Closed — Will Be Back Later at 12 NOON' : 'Confirm & Place Order'}
                </Button>

                {showErrors && getMissingFields().length > 0 && (
                  <p className="text-center text-[11px] text-red-400 font-semibold pt-1">
                    Please fill in the fields highlighted in red to continue.
                  </p>
                )}

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
  );
}
