// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Edit2, Plus, Trash2, Tag, DollarSign, ShoppingBag, BarChart2, Users, KeyRound, Eye, EyeOff, Award, CheckCircle2, AlertTriangle, XCircle, Clock, Upload, Star, Calendar, Search, Ticket, Layers, ChevronUp, ChevronDown, ArrowRightLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MENU_GRID, formatPeso, getActivePromoCodes } from '@/lib/menu-data';
import { getPromoStatus, getPromoEndMs, isCampaignPromo, formatCountdown, manilaLocalToIso, toManilaLocalInput, formatManila, STATUS_STYLES } from '@/lib/promo-campaigns';
import { menuImages } from '@/lib/menu-images';
import { supabase } from '@/lib/supabase';
import { requestStaffGeocode } from '@/lib/order-geocode';
import { AdminOrderProcessing } from '@/components/admin-order-processing';
import { AdminFeedbackManager } from '@/components/admin-feedback-manager';
import { DeliveryPinMap } from '@/components/delivery-pin-map';
import { useTimeSlots } from '@/lib/time-slots';
import { MessageSquare } from 'lucide-react';

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
// ---- order display helpers (work for normalised items AND old raw items) ----
const itemQty = (it: any) => Number(it?.qty ?? it?.quantity ?? 1);
const lineItemName = (it: any) => it?.name || it?.item?.name || 'Item';
const itemUnit = (it: any) => Number(it?.unitPrice ?? it?.price ?? it?.item?.price ?? 0);

// ---- schedule-transfer helpers (Asia/Manila, real timestamps) ----
const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const slotEndsAt = (dateKey: string, slot: string): number | null => {
  const m = (slot || '').match(/^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*-\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return null;
  const mins = (h: string, mi: string, ap: string) => ((parseInt(h, 10) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + parseInt(mi, 10);
  const s = mins(m[1], m[2], m[3]);
  let e = mins(m[4], m[5], m[6]);
  if (e <= s) e += 1440;
  const [y, mo, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, 0, e, 0) - 8 * 3600 * 1000; // Manila = UTC+8
};
const slotHasEnded = (dateKey: string, slot: string) => {
  const end = slotEndsAt(dateKey, slot);
  return end === null ? true : end <= Date.now();
};

// ---- order status + PWD helpers ----
const ORDER_STATUSES = ['pending', 'completed', 'cancelled', 'rescheduled'] as const;
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rescheduled: 'Rescheduled' };
const STATUS_SKIN: Record<string, string> = {
  pending: 'bg-amber-400/15 text-amber-300 border-amber-400/50',
  completed: 'bg-lime-400/15 text-lime-300 border-lime-400/50',
  cancelled: 'bg-red-950 text-red-400 border-red-800',
  rescheduled: 'bg-sky-400/15 text-sky-300 border-sky-400/50'
};
// Amount actually payable/collected: PWD orders use the discounted final amount.
const payableAmount = (o: any) => (o?.pwdApplied ? Number(o.pwdFinal || 0) : Number(o?.total || 0));

// ---- edit-order helpers ----
// Our Delivery vs Maxim: use the saved delivery_option; older orders fall back to the schedule text.
const orderDeliveryOption = (o: any): 'our' | 'maxim' | null => {
  if ((o?.fulfillment || '') !== 'delivery') return null;
  if (o?.deliveryOption === 'our' || o?.deliveryOption === 'maxim') return o.deliveryOption;
  return /maxim/i.test(o?.scheduleInfo || '') ? 'maxim' : 'our';
};
// "09:00" -> "9:00 AM" (format required by the database slot parser)
const to12h = (hhmm: string) => {
  const [h, m] = (hhmm || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
// "9:00 AM - 10:00 AM" -> { start: "09:00", end: "10:00" }
const slotTo24 = (slot: string): { start: string; end: string } | null => {
  const m = (slot || '').match(/^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*-\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/);
  if (!m) return null;
  const conv = (h: string, mi: string, ap: string) => `${String((parseInt(h, 10) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${mi}`;
  return { start: conv(m[1], m[2], m[3]), end: conv(m[4], m[5], m[6]) };
};

export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<'sales' | 'menu' | 'promos' | 'customers' | 'slots' | 'process' | 'feedback'>('sales');
  const [menuItems, setMenuItems] = useState<any[]>([]);
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
  // Task 6: Total Usage Limit (limited / unlimited) and Usage Per Account (one-time / multiple)
  const [newVoucherUsageMode, setNewVoucherUsageMode] = useState<'unlimited' | 'limited'>('unlimited');
  const [newVoucherPerAccount, setNewVoucherPerAccount] = useState<'one_time' | 'multiple'>('one_time');
  const [redemptionView, setRedemptionView] = useState<{ code: string; rows: any[]; loading: boolean } | null>(null);
  // Campaign scheduling fields (all optional; times are entered as Asia/Manila time)
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [newCampaignMinPurchase, setNewCampaignMinPurchase] = useState('');
  const [newCampaignStart, setNewCampaignStart] = useState('');
  const [newCampaignEnd, setNewCampaignEnd] = useState('');
  const [editingPromoCode, setEditingPromoCode] = useState<string | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // --- Order status / PWD / reschedule state ---
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [pwdConfirmOrder, setPwdConfirmOrder] = useState<any>(null);
  const [pwdIdChecked, setPwdIdChecked] = useState(false);
  const [rescheduleOrder, setRescheduleOrder] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('');

  // --- Edit order state (quantities, fulfillment, delivery details, schedule) ---
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editQty, setEditQty] = useState<Record<number, number>>({});
  const [editMethod, setEditMethod] = useState<'pickup' | 'our' | 'maxim' | 'on-site'>('pickup');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editFee, setEditFee] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editSlot, setEditSlot] = useState('');
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState<{ lat: number; lng: number } | null>(null);
  const [editPinFee, setEditPinFee] = useState<{ km: number; fee: number } | null>(null);
  const editAddrTouched = useRef(false);
  const geoTriedRef = useRef<Set<string>>(new Set()); // orders whose map address was already requested this session

  // --- Time window manager (Slot Capacity tab) ---
  const [slotEdits, setSlotEdits] = useState<Record<string, { start: string; end: string }>>({});
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('10:00');
  const [slotMgmtBusy, setSlotMgmtBusy] = useState(false);
  const [slotMsg, setSlotMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Our Delivery pin -> the database calculates distance + fee (same rule as customer checkout)
  useEffect(() => {
    if (!editPin) { setEditPinFee(null); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('admin_preview_delivery_fee', { p_lat: editPin.lat, p_lng: editPin.lng });
      if (!alive) return;
      if (error || !data) { setEditPinFee(null); return; }
      setEditPinFee({ km: Number(data.distanceKm), fee: Number(data.fee) });
    })();
    return () => { alive = false; };
  }, [editPin]);

  // The pin never fills the typed address. The readable map address is generated by the server and kept staff-only.
  const [editNote, setEditNote] = useState('');
  // Customer discount inside Edit Order (the database recalculates the totals when saved)
  const [editDiscType, setEditDiscType] = useState<'none' | 'percent' | 'amount'>('none');
  const [editDiscValue, setEditDiscValue] = useState('');
  const [editDiscLabel, setEditDiscLabel] = useState('');
  // Promos / vouchers staff can still add to this order (the customer may have forgotten them)
  const [editAvailPromos, setEditAvailPromos] = useState<any[]>([]);
  const [editAvailLoading, setEditAvailLoading] = useState(false);
  const [editAvailError, setEditAvailError] = useState('');
  const [editAddPromos, setEditAddPromos] = useState<string[]>([]);
  const editPromoReq = useRef(0);
  // Delete Order confirmation
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Customer Edit State
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustType, setEditCustType] = useState<'email' | 'phone'>('email');
  const [editCustValue, setEditCustValue] = useState('');
  const [custBusy, setCustBusy] = useState(false);

  const [slotCapacities, setSlotCapacities] = useState<any[]>([]);
  const [selectedSlotDate, setSelectedSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const timeSlotsList = useTimeSlots(); // editable in Slot Capacity; shared live with customer checkout

  // Slot Owner Inspector Modal State
  const [inspectingSlot, setInspectingSlot] = useState<{ slotTime: string; dateKey: string } | null>(null);
  const [slotReservationsList, setSlotReservationsList] = useState<any[]>([]);
  const [transferringReservation, setTransferringReservation] = useState<any>(null);
  const [transferTargetSlot, setTransferTargetSlot] = useState(timeSlotsList[0]);
  const [transferTargetDate, setTransferTargetDate] = useState<string>(todayManila());

  // --- Phase 4: Loyalty Manager state (replaces old Fair Play penalty system) ---
  const [loyaltyTargetUser, setLoyaltyTargetUser] = useState<any>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<any>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<any[]>([]);
  const [loyaltyStampDelta, setLoyaltyStampDelta] = useState(0);
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState<string>('B1');
  const [loyaltyTierReason, setLoyaltyTierReason] = useState('');
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [pendingStamp, setPendingStamp] = useState<string>(''); // e.g. 'AD7' (add up to circle 7) or 'RM7' (remove circle 7) — applied only when Apply is pressed

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
      if (cloudMenu) {
        const formattedMenu = cloudMenu.map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          description: m.description,
          price: Number(m.price),
          discountPercent: Number(m.discount_percent || 0),
          isAvailable: m.is_available,
          bestSeller: m.best_seller,
          isExtra: !!m.is_extra,
          offerInPopup: !!m.offer_in_popup,
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
      // staff-only pin + generated map address (RLS returns rows to staff only)
      const { data: geoRows } = await supabase.from('order_delivery_private').select('order_id,delivery_lat,delivery_lng,map_address,map_address_status');
      const geoById: Record<string, any> = {};
      (geoRows || []).forEach((g: any) => { geoById[g.order_id] = g; });
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
          items: Array.isArray(o.items) ? o.items : [],
          subtotal: Number(o.subtotal ?? 0),
          promoDiscount: Number(o.promo_discount || 0),
          deliveryDiscount: Number(o.delivery_discount || 0),
          deliveryFee: Number(o.delivery_fee || 0),
          total: Number(o.total || 0),
          date: new Date(o.created_at).toLocaleString(),
          promoCode: o.promo_code || '',
          orderType: o.order_type || 'today',
          scheduleInfo: o.schedule_info || 'Immediate / Today',
          status: (o.status || 'pending').toLowerCase(),
          statusUpdatedAt: o.status_updated_at || null,
          completedAt: o.completed_at || null,
          slotDate: o.slot_date || '',
          slotTime: o.slot_time || '',
          rescheduledToDate: o.rescheduled_to_date || '',
          rescheduledToTime: o.rescheduled_to_time || '',
          deliveryOption: o.delivery_option || '',
          lastEditedAt: o.last_edited_at || null,
          editCount: Number(o.edit_count || 0),
          pwdApplied: !!o.pwd_applied,
          pwdOriginal: Number(o.pwd_original_amount || 0),
          pwdPercent: Number(o.pwd_discount_percent || 0),
          pwdDiscount: Number(o.pwd_discount_amount || 0),
          pwdFinal: Number(o.pwd_final_amount || 0),
          pwdAppliedByName: o.pwd_applied_by_name || '',
          pwdAppliedAt: o.pwd_applied_at || null,
          manualDiscountType: o.manual_discount_type || '',
          manualDiscountValue: o.manual_discount_value === null || o.manual_discount_value === undefined ? null : Number(o.manual_discount_value),
          manualDiscount: Number(o.manual_discount_amount || 0),
          manualDiscountLabel: o.manual_discount_label || '',
          pinLat: geoById[o.id] ? Number(geoById[o.id].delivery_lat) : null,
          pinLng: geoById[o.id] ? Number(geoById[o.id].delivery_lng) : null,
          mapAddress: geoById[o.id]?.map_address || '',
          mapAddressStatus: geoById[o.id]?.map_address_status || ''
        })));
        // generate the map address of any pin that does not have one yet (3 at a time, once per page load)
        const pendingGeo = (geoRows || []).filter((g: any) => g.map_address_status === 'pending' && !geoTriedRef.current.has(g.order_id)).slice(0, 3).map((g: any) => g.order_id);
        if (pendingGeo.length > 0) {
          pendingGeo.forEach((id: string) => geoTriedRef.current.add(id));
          requestStaffGeocode(pendingGeo).then((ok) => { if (ok) fetchCloudData(); });
        }
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
          perPersonLimit: p.per_person_limit === null || p.per_person_limit === undefined ? null : Number(p.per_person_limit),
          createdAt: Number(p.created_at || Date.now()),
          name: p.name || '',
          description: p.description || '',
          startDate: p.start_date ? Date.parse(p.start_date) : null,
          expiresAt: p.expires_at ? Date.parse(p.expires_at) : null,
          minPurchase: Number(p.min_purchase || 0),
          isEnabled: p.is_enabled !== false,
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
    // The database owns booked_bowls / booked_count (derived from real reservations). The browser only sends the
    // cap and the manual "closed" flag, through a staff-only RPC, so a stale screen can never overwrite live counts.
    const { data, error } = await supabase.rpc('admin_set_slot_capacity', {
      p_date_key: dateKey, p_slot_time: slotTime, p_max_bowls: maxBowls, p_max_slots: maxSlots, p_closed: isFullyBooked
    });
    if (error || data?.success === false) {
      alert(error?.message || data?.message || 'Error updating slot capacity.');
      fetchCloudData();
      return;
    }
    alert(`Slot capacity updated successfully for ${slotTime} on ${dateKey}!`);
    fetchCloudData();
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
  const openTransfer = (res: any) => {
    const base = inspectingSlot?.dateKey || selectedSlotDate || todayManila();
    const date = base < todayManila() ? todayManila() : base;
    setTransferTargetDate(date);
    const firstOpen = timeSlotsList.find((s) => !slotHasEnded(date, s) && !(date === res.date_key && s === res.slot_time));
    setTransferTargetSlot(firstOpen || timeSlotsList[0]);
    setTransferringReservation(res);
  };

  const handleExecuteTransfer = async (reservationId: string, newDateKey: string, newSlotTime: string) => {
    if (slotHasEnded(newDateKey, newSlotTime)) {
      alert('That time slot has already passed. Choose a future date or a later time slot.');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('admin_transfer_slot', {
        p_reservation_id: reservationId,
        p_new_date_key: newDateKey,
        p_new_slot_time: newSlotTime
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.message || 'Transfer failed.');
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

  // --- Create or edit a voucher / dated promotional campaign ---
  const resetPromoForm = () => {
    setNewPromoCode('');
    setNewPromoDiscount('');
    setNewVoucherUsageLimit('');
    setNewVoucherUsageMode('unlimited');
    setNewVoucherPerAccount('one_time');
    setNewCampaignName('');
    setNewCampaignDesc('');
    setNewCampaignMinPurchase('');
    setNewCampaignStart('');
    setNewCampaignEnd('');
    setEditingPromoCode(null);
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode || !newPromoDiscount) return;

    const discountNum = parseFloat(newPromoDiscount);
    if (!(discountNum > 0)) { alert('Discount value must be greater than zero.'); return; }
    if (newPromoType === 'percentage' && discountNum > 100) { alert('A percentage discount cannot exceed 100%.'); return; }

    // Campaign window: entered as Asia/Manila time, stored as UTC timestamps
    const startIso = manilaLocalToIso(newCampaignStart);
    const endIso = manilaLocalToIso(newCampaignEnd);
    if (newCampaignStart && !startIso) { alert('The start date/time is not valid.'); return; }
    if (newCampaignEnd && !endIso) { alert('The expiration date/time is not valid.'); return; }
    if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) { alert('The expiration must be later than the start.'); return; }
    if (!editingPromoCode && endIso && Date.parse(endIso) <= Date.now()) { alert('The expiration date/time is already in the past.'); return; }
    const minPurchaseNum = newCampaignMinPurchase ? parseFloat(newCampaignMinPurchase) : 0;
    if (!(minPurchaseNum >= 0)) { alert('Minimum purchase must be zero or more.'); return; }

    // Legacy "expires N minutes after creation" only applies to plain vouchers.
    // A campaign (name, start, end, or an edit) uses its real dates instead.
    // Editing a PLAIN voucher (no name/dates) only changes its settings: its original expiry is kept as is.
    const editedPromo = editingPromoCode ? promos.find((x: any) => x.code === editingPromoCode) : null;
    const keepLegacyExpiry = Boolean(editedPromo && !isCampaignPromo(editedPromo) && !startIso && !endIso && !newCampaignName.trim());
    const isCampaign = Boolean((editingPromoCode && !keepLegacyExpiry) || startIso || endIso || newCampaignName.trim());
    const expiryNum = parseFloat(newVoucherExpiryVal) || 60;
    let expiryMs = 0;
    if (!isCampaign) {
      if (newVoucherExpiryUnit === 'minutes') expiryMs = expiryNum * 60 * 1000;
      else if (newVoucherExpiryUnit === 'hours') expiryMs = expiryNum * 60 * 60 * 1000;
    }

    // Total usage: UNLIMITED saves no cap (NULL). LIMITED needs a positive whole number.
    let usageLimitNum: number | null = null;
    if (newVoucherUsageMode === 'limited') {
      const raw = newVoucherUsageLimit.trim();
      if (!/^[0-9]+$/.test(raw) || parseInt(raw, 10) < 1) { alert('Maximum redemptions must be a positive whole number (1 or more).'); return; }
      usageLimitNum = parseInt(raw, 10);
      if (editingPromoCode) {
        const existing = promos.find((x: any) => x.code === editingPromoCode);
        const done = Number(existing?.usageCount || 0);
        if (usageLimitNum < done) { alert(`This voucher already has ${done} successful redemptions. The maximum cannot be lower than ${done}.`); return; }
      }
    }
    // Usage per account: ONE-TIME = 1 redemption per account, MULTIPLE = no per-account cap (NULL)
    const perPersonLimitValue: number | null = newVoucherPerAccount === 'one_time' ? 1 : null;
    const cleanCode = newPromoCode.trim().toUpperCase();

    const fields: any = {
      type: newPromoType,
      discount_value: discountNum,
      target_type: newPromoTargetType, // Scope: subtotal (food) or delivery
      eligibility: 'registered',       // Strictly enforced: registered customers only
      visibility: newVoucherVisibility,
      usage_limit: usageLimitNum,
      per_person_limit: perPersonLimitValue,
      name: newCampaignName.trim() || null,
      description: newCampaignDesc.trim() || null,
      min_purchase: minPurchaseNum,
      expires_at: endIso,
      updated_at: new Date().toISOString(),
    };
    if (!keepLegacyExpiry) fields.expiry_duration_ms = expiryMs;
    if (startIso) fields.start_date = startIso; // otherwise the database default (now) applies

    try {
      if (editingPromoCode) {
        // Edit: never touches usage_count / created_at, and completed orders keep their saved discounts.
        const { error } = await supabase.from('promos').update(fields).eq('code', editingPromoCode);
        if (error) { alert('Failed to update promo: ' + error.message); return; }
        alert(`Campaign "${editingPromoCode}" updated.`);
      } else {
        if (promos.some((p: any) => String(p.code).toUpperCase() === cleanCode)) {
          alert(`A promo with the code "${cleanCode}" already exists. Use Edit on that promo instead.`);
          return;
        }
        const { error } = await supabase.from('promos').insert([{ ...fields, code: cleanCode, usage_count: 0, created_at: Date.now() }]);
        if (error) { alert('Failed to save promo to database: ' + error.message); return; }
        alert(`Voucher / Promo "${cleanCode}" successfully created and synced to cloud!`);
      }
      resetPromoForm();
      fetchCloudData();
    } catch (err) {
      alert('Database connection error while saving voucher.');
    }
  };

  const handleEditPromo = (p: any) => {
    setEditingPromoCode(p.code);
    setNewPromoCode(p.code);
    setNewPromoType(p.type === 'peso' ? 'peso' : 'percentage');
    setNewPromoDiscount(String(p.discountValue));
    setNewPromoTargetType(p.target_type === 'delivery' ? 'delivery' : 'subtotal');
    setNewVoucherVisibility(p.visibility === 'hidden' ? 'hidden' : 'public');
    setNewVoucherUsageLimit(p.usageLimit ? String(p.usageLimit) : '');
    setNewVoucherUsageMode(p.usageLimit ? 'limited' : 'unlimited');
    setNewVoucherPerAccount(p.perPersonLimit === null || p.perPersonLimit === undefined ? 'multiple' : 'one_time');
    setNewCampaignName(p.name || '');
    setNewCampaignDesc(p.description || '');
    setNewCampaignMinPurchase(p.minPurchase > 0 ? String(p.minPurchase) : '');
    setNewCampaignStart(toManilaLocalInput(p.startDate));
    setNewCampaignEnd(toManilaLocalInput(p.expiresAt));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Redemption history for one voucher (staff can read promo_redemptions through RLS)
  const handleViewRedemptions = async (code: string) => {
    if (redemptionView?.code === code) { setRedemptionView(null); return; }
    setRedemptionView({ code, rows: [], loading: true });
    const { data, error } = await supabase
      .from('promo_redemptions')
      .select('id, order_number, user_id, status, redeemed_at, voided_at')
      .eq('promo_code', code)
      .order('redeemed_at', { ascending: false })
      .limit(100);
    if (error) { alert('Could not load redemptions: ' + error.message); setRedemptionView(null); return; }
    setRedemptionView({ code, rows: data || [], loading: false });
  };

  const handleTogglePromoEnabled = async (p: any) => {
    const next = p.isEnabled === false; // currently disabled -> enable
    const { error } = await supabase.from('promos').update({ is_enabled: next, updated_at: new Date().toISOString() }).eq('code', p.code);
    if (error) { alert('Failed to update promo: ' + error.message); return; }
    fetchCloudData();
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
    const { data: updated, error } = await supabase.from('profiles').update({ name: newName }).eq('id', editingCustomer.id).select('id');
    if (error || !updated || updated.length === 0) { alert('Update failed: ' + (error?.message || 'no row was changed (permission problem).')); return; }
    alert('Customer nickname updated.');
    setEditingCustomer(null);
    fetchCloudData();
  };

  // --- Staff-only account actions (server endpoint verifies the caller and uses the service key) ---
  const callCustomerAdmin = async (payload: any) => {
    setCustBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { alert('Your session expired. Please sign in again.'); return null; }
      const res = await fetch('/api/admin-create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profileId: editingCustomer?.id, ...payload }),
      });
      const body = await res.json().catch(() => null);
      if (!body) { alert(res.status === 404 ? 'The account service (/api/admin-create-customer) is not deployed.' : 'Unexpected response from the account service.'); return null; }
      if (!res.ok || !body.ok) { alert(body.error || 'Request failed.'); return null; }
      return body;
    } catch (e) { alert('Network error. Please try again.'); return null; }
    finally { setCustBusy(false); }
  };

  const handleChangeCustomerEmail = async () => {
    const email = editCustValue.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { alert('Enter a valid email address.'); return; }
    if (email === String(editingCustomer?.identifier || '').toLowerCase()) { alert('That is already the current email.'); return; }
    if (!confirm(`Change this customer's email to ${email}?\n\nThey will receive a link at the new address to set their password and verify it. They cannot log in until they do.`)) return;
    const body = await callCustomerAdmin({ action: 'update_email', email });
    if (!body) return;
    alert(body.activationEmailSent ? `Email updated. A verification / password-setup link was sent to ${email}.` : `Email updated, but the link could not be sent: ${body.activationError || 'unknown error'}. Use "Send password reset" to try again.`);
    setEditingCustomer(null);
    fetchCloudData();
  };

  const handleSendCustomerReset = async () => {
    if (!confirm('Send a password-reset email to this customer?')) return;
    const body = await callCustomerAdmin({ action: 'send_reset' });
    if (!body) return;
    alert('Password-reset email sent. The customer chooses their own new password from the link.');
  };

  // --- Phase 4: open the Loyalty Manager, load live status + audit history ---
  const openLoyaltyManager = async (cust: any) => {
    setLoyaltyTargetUser(cust);
    setLoyaltyStampDelta(0);
    setLoyaltyReason('');
    setPendingStamp('');
    setLoyaltyBusy(true);
    try {
      const { data: status } = await supabase.rpc('get_loyalty_status', { p_user_id: cust.auth_user_id });
      setLoyaltyStatus(status);
      setLoyaltyTier(status?.tier === 'DIAMOND' ? 'DIAMOND' : status?.tier === 'PLATINUM' ? 'PLATINUM' : 'B' + Math.min(status?.block || 1, 4));
      setLoyaltyTierReason('');
      const { data: hist } = await supabase.rpc('get_stamp_history', { p_user_id: cust.auth_user_id });
      setLoyaltyHistory(hist || []);
    } catch (e) { console.error('Loyalty load failed:', e); }
    setLoyaltyBusy(false);
  };
  const handleLoyaltyAdjustStamps = async () => {
    if (!loyaltyTargetUser) return;
    if (!loyaltyStampDelta) { alert('Enter a non-zero stamp amount (positive to add, negative to remove).'); return; }
    setLoyaltyBusy(true);
    const { data, error } = await supabase.rpc('admin_adjust_stamps', {
      p_user_id: loyaltyTargetUser.auth_user_id, p_delta: loyaltyStampDelta, p_reason: null
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
    alert(data.tier ? `${data.tier} applied. Stamps: ${data.cumulative}.` : `Moved to Milestone Block ${data.block} (no circles filled yet). Stamps: ${data.cumulative}.`);
    setLoyaltyTierReason('');
    fetchCloudData();
    await openLoyaltyManager(loyaltyTargetUser);
  };

  // keep an open invoice in sync with refreshed order data (so PWD / status show immediately)
  useEffect(() => {
    setSelectedInvoice((prev: any) => (prev ? (orders.find((o) => o.id === prev.id) || prev) : prev));
  }, [orders]);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setStatusMsg({ kind, text });
    setTimeout(() => setStatusMsg((cur) => (cur && cur.text === text ? null : cur)), 6000);
  };

  // --- Change an order status (all validation happens in the database RPC) ---
  const handleStatusChange = async (order: any, next: string) => {
    if (next === 'rescheduled') { openReschedule(order); return; }
    if (next === order.status) return;
    if (next === 'completed' && !confirm(`Mark ${order.orderNumber} as COMPLETED?\n\nThe customer received the order. ${formatPeso(payableAmount(order))} will be counted in Gross Sales.`)) return;
    if (next === 'cancelled' && !confirm(`CANCEL ${order.orderNumber}?\n\nIt will be excluded from sales and its reserved slot will be released. This cannot be undone.`)) return;
    setBusyOrderId(order.id);
    const { data, error } = await supabase.rpc('admin_set_order_status', { p_order_id: order.id, p_status: next, p_note: null });
    setBusyOrderId(null);
    if (error || data?.success === false) { flash('err', error?.message || data?.message || 'Status change failed.'); return; }
    flash('ok', `${order.orderNumber} is now ${STATUS_LABEL[next]}.`);
    fetchCloudData();
  };

  // --- Manual PWD discount (employee has physically inspected the ID) ---
  const openPwdConfirm = (order: any) => { setPwdIdChecked(false); setPwdConfirmOrder(order); };
  const handleApplyPwd = async () => {
    if (!pwdConfirmOrder || !pwdIdChecked) return;
    const order = pwdConfirmOrder;
    setBusyOrderId(order.id);
    const { data, error } = await supabase.rpc('admin_apply_pwd_discount', { p_order_id: order.id });
    setBusyOrderId(null);
    setPwdConfirmOrder(null);
    if (error || data?.success === false) { flash('err', error?.message || data?.message || 'Could not apply the PWD discount.'); return; }
    flash('ok', data?.already_applied
      ? `${order.orderNumber} already has the PWD discount — nothing was deducted again.`
      : `PWD 20% applied to ${order.orderNumber}: −${formatPeso(data.discount)}, final ${formatPeso(data.final)}.`);
    fetchCloudData();
  };
  const handleRemovePwd = async (order: any) => {
    if (!confirm(`Remove the PWD discount from ${order.orderNumber}? (Administrators only; the removal is logged.)`)) return;
    setBusyOrderId(order.id);
    const { data, error } = await supabase.rpc('admin_remove_pwd_discount', { p_order_id: order.id });
    setBusyOrderId(null);
    if (error || data?.success === false) { flash('err', error?.message || data?.message || 'Could not remove the PWD discount.'); return; }
    flash('ok', `PWD discount removed from ${order.orderNumber}.`);
    fetchCloudData();
  };

  // --- Reschedule (moves the existing reservation; old slot released, new slot reserved atomically) ---
  const openReschedule = (order: any) => {
    const today = todayManila();
    const base = order.slotDate && order.slotDate >= today ? order.slotDate : today;
    setRescheduleDate(base);
    const first = timeSlotsList.find((s) => !slotHasEnded(base, s) && !(base === order.slotDate && s === order.slotTime));
    setRescheduleSlot(first || '');
    setRescheduleOrder(order);
  };
  const slotAvailability = (dateKey: string, slot: string, order: any) => {
    const cap: any = Object.values(slotCapacities || {}).find((s: any) => s.date_key === dateKey && s.slot_time === slot);
    const max = cap ? Number(cap.max_bowls) : 10;
    const booked = cap ? Number(cap.booked_bowls) : 0;
    const need = Number((order?.items || []).reduce((s: number, it: any) => s + itemQty(it), 0)) || 1;
    const same = dateKey === order?.slotDate && slot === order?.slotTime;
    const ended = slotHasEnded(dateKey, slot);
    const closed = !!cap && (cap.is_manually_fully_booked || cap.is_fully_booked);
    const full = closed || booked + need > max;
    return { ended, full, same, left: Math.max(0, max - booked), disabled: ended || full || same };
  };
  const handleConfirmReschedule = async () => {
    if (!rescheduleOrder || !rescheduleDate || !rescheduleSlot) return;
    setBusyOrderId(rescheduleOrder.id);
    const { data, error } = await supabase.rpc('admin_reschedule_order', {
      p_order_id: rescheduleOrder.id, p_new_date_key: rescheduleDate, p_new_slot_time: rescheduleSlot
    });
    setBusyOrderId(null);
    if (error || data?.success === false) { flash('err', error?.message || data?.message || 'Reschedule failed.'); return; }
    flash('ok', `${rescheduleOrder.orderNumber} moved to ${rescheduleDate} (${rescheduleSlot}).`);
    setRescheduleOrder(null);
    fetchCloudData();
  };

  // --- Delete an order (staff only; the database RPC re-checks the role, frees the reserved slot and keeps an audit snapshot) ---
  const openDeleteOrder = (order: any) => { setDeleteAck(false); setDeleteReason(''); setDeleteTarget(order); };
  const handleDeleteOrder = async () => {
    if (!deleteTarget || !deleteAck) return;
    const order = deleteTarget;
    setBusyOrderId(order.id);
    const { data, error } = await supabase.rpc('admin_delete_order', { p_order_id: order.id, p_reason: deleteReason.trim() || null });
    setBusyOrderId(null);
    if (error || data?.success === false) { flash('err', error?.message || data?.message || 'Could not delete the order.'); return; }
    flash('ok', `${order.orderNumber} was deleted${data?.slots_released ? ' and its reserved slot was released' : ''}.`);
    setDeleteTarget(null);
    setSelectedInvoice((prev: any) => (prev && prev.id === order.id ? null : prev));
    fetchCloudData();
  };

  // --- Edit an order: quantities, fulfillment method, delivery details and time schedule ---
  // The browser only collects the changes; the database RPC (admin_edit_order) recalculates the
  // subtotal, discounts and total, checks slot capacity and writes the audit log.
  const openEditOrder = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const q: Record<number, number> = {};
    items.forEach((it: any, i: number) => { q[i] = itemQty(it); });
    setEditQty(q);
    const opt = orderDeliveryOption(order);
    setEditMethod(order.fulfillment === 'on-site' ? 'on-site' : order.fulfillment === 'pickup' ? 'pickup' : (opt || 'our'));
    setEditPhone(order.phone || '');
    setEditLocation(order.fulfillment === 'delivery' ? (order.location || '') : '');
    setEditLandmark(order.fulfillment === 'delivery' && order.landmark && order.landmark !== 'N/A' ? order.landmark : '');
    setEditFee(order.fulfillment === 'delivery' && opt === 'our' ? String(order.deliveryFee ?? 0) : '');
    setEditDate(order.slotDate || todayManila());
    setEditSlot(order.slotTime || '');
    setEditName(order.name || '');
    setEditPin(null);
    setEditPinFee(null);
    editAddrTouched.current = order.fulfillment === 'delivery' && !!order.location;
    setEditNote('');
    setEditDiscType(order.manualDiscountType === 'percent' || order.manualDiscountType === 'amount' ? order.manualDiscountType : 'none');
    setEditDiscValue(order.manualDiscountValue ? String(order.manualDiscountValue) : '');
    setEditDiscLabel(order.manualDiscountLabel || '');
    setEditAddPromos([]);
    setEditAvailPromos([]);
    setEditAvailError('');
    loadEditAvailablePromos(order.id);
    setEditOrder(order);
  };
  // The database decides which promos / vouchers this customer can really use on this order right now.
  const loadEditAvailablePromos = async (orderId: string) => {
    const req = ++editPromoReq.current;
    setEditAvailLoading(true);
    const { data, error } = await supabase.rpc('admin_available_promos_for_order', { p_order_id: orderId });
    if (req !== editPromoReq.current) return; // another order was opened meanwhile
    setEditAvailLoading(false);
    if (error) {
      setEditAvailPromos([]);
      setEditAvailError(error.message || 'Could not load the available promos and vouchers.');
      return;
    }
    setEditAvailError('');
    setEditAvailPromos(Array.isArray(data) ? data : []);
  };
  const toggleEditPromo = (code: string) => {
    setEditAddPromos((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  };
  const editEstSubtotal = () => (editOrder?.items || []).reduce((s: number, it: any, i: number) => s + itemUnit(it) * (Number(editQty[i]) || 0), 0);
  const editFeeNow = () => (editMethod === 'our' ? (editPinFee ? Number(editPinFee.fee) || 0 : Number(editFee) || 0) : 0);
  // Preview only: the discount applies to the food subtotal AFTER promo codes, never to the delivery fee.
  // Promos already on the order (scaled to the new quantities) + the ones staff picked in this edit.
  const editOldPromoScaled = () => {
    const sub = editEstSubtotal();
    const oldSub = Number(editOrder?.subtotal || 0);
    return oldSub > 0 ? Math.min(sub, Number(editOrder?.promoDiscount || 0) * sub / oldSub) : 0;
  };
  const editPromoAmount = (p: any, base: number) =>
    p.type === 'percentage' ? base * Number(p.discountValue || 0) / 100 : Number(p.discountValue || 0);
  const editNewFoodPromo = () => editAddPromos.reduce((s: number, code: string) => {
    const p = editAvailPromos.find((x: any) => x.code === code);
    return p && p.targetType !== 'delivery' ? s + editPromoAmount(p, editEstSubtotal()) : s;
  }, 0);
  const editNewDeliveryPromo = () => editAddPromos.reduce((s: number, code: string) => {
    const p = editAvailPromos.find((x: any) => x.code === code);
    return p && p.targetType === 'delivery' ? s + editPromoAmount(p, editFeeNow()) : s;
  }, 0);
  const editFoodPromoNow = () => Math.min(editEstSubtotal(), editOldPromoScaled() + editNewFoodPromo());
  const editDeliveryPromoNow = () => Math.min(editFeeNow(), Number(editOrder?.deliveryDiscount || 0) + editNewDeliveryPromo());
  const editDiscountPreview = () => {
    const v = Number(editDiscValue);
    if (editDiscType === 'none' || !(v > 0)) return 0;
    const base = Math.max(0, editEstSubtotal() - editFoodPromoNow());
    return editDiscType === 'percent' ? Math.round(base * Math.min(v, 100)) / 100 : Math.min(base, v);
  };
  const editBowlsNow = () => Object.values(editQty).reduce((s: number, n: any) => s + (Number(n) || 0), 0);
  const editBowlsBefore = () => (editOrder?.items || []).reduce((s: number, it: any) => s + itemQty(it), 0);
  const editEffectiveSlot = () => editSlot;
  const editSlotInfo = (dateKey: string, slot: string) => {
    const cap: any = Object.values(slotCapacities || {}).find((s: any) => s.date_key === dateKey && s.slot_time === slot);
    const max = cap ? Number(cap.max_bowls) : 10;
    const booked = cap ? Number(cap.booked_bowls) : 0;
    const same = !!editOrder && dateKey === editOrder.slotDate && slot === editOrder.slotTime;
    const mine = same ? editBowlsBefore() : 0; // this order's own bowls are already counted in its current slot
    const manuallyClosed = !!cap && !!cap.is_manually_fully_booked;
    const room = Math.max(0, max - Math.max(0, booked - mine)); // most bowls this order could hold in this slot
    // A closed slot accepts no extra bowls: the order may keep or reduce what it already has, nothing more.
    const maxForOrder = manuallyClosed ? mine : room;
    const over = editBowlsNow() > maxForOrder;
    const ended = !same && slotHasEnded(dateKey, slot);
    return {
      same, ended, closed: manuallyClosed, over,
      full: over, left: maxForOrder,
      // the current slot stays selectable so a smaller quantity can still be saved
      disabled: ended || (!same && over)
    };
  };
  const handleSaveEdit = async () => {
    if (!editOrder) return;
    const onSite = editMethod === 'on-site';
    const lines = (editOrder.items || [])
      .map((_: any, i: number) => ({ index: i, quantity: Number(editQty[i]) || 0 }))
      .filter((l: any) => l.quantity > 0);
    if (lines.length === 0) { flash('err', 'An order must keep at least one item. Cancel the order instead.'); return; }
    const changes: any = { items: lines, note: editNote.trim() || null };
    if (onSite) {
      changes.fulfillment = 'on-site';
    } else {
      const slot = editEffectiveSlot();
      if (!slot || !editDate) { flash('err', 'Choose a date and a time slot.'); return; }
      const slotCheck = editSlotInfo(editDate, slot);
      if (slotCheck.over) {
        flash('err', slotCheck.closed
          ? `That time slot is closed by the administrator, so this order can hold at most ${slotCheck.left} bowl(s) there. Reduce the quantity or choose another time slot.`
          : `Only ${slotCheck.left} bowl(s) are available for this order in that time slot. Reduce the quantity or choose another time slot.`);
        return;
      }
      changes.dateKey = editDate;
      changes.slotTime = slot;
      if (editMethod === 'pickup') {
        changes.fulfillment = 'pickup';
      } else {
        const wasOur = editOrder.fulfillment === 'delivery' && orderDeliveryOption(editOrder) === 'our';
        if (!editName.trim()) { flash('err', 'Contact name is required.'); return; }
        if (!editPhone.trim() || !editLandmark.trim()) {
          flash('err', 'Delivery needs a contact number and a nearest landmark.'); return;
        }
        changes.fulfillment = 'delivery';
        changes.deliveryOption = editMethod;
        changes.customerName = editName.trim();
        changes.phone = editPhone.trim();
        changes.landmark = editLandmark.trim();
        if (editMethod === 'our') {
          if (!editLocation.trim()) { flash('err', 'Delivery address is required.'); return; }
          if (!editPin && !wasOur) { flash('err', 'Drop the delivery pin on the map so the delivery fee can be calculated.'); return; }
          changes.location = editLocation.trim();
          if (editPin) { changes.deliveryLat = editPin.lat; changes.deliveryLng = editPin.lng; }
        }
      }
    }
    if (editDiscType !== 'none') {
      const dv = Number(editDiscValue);
      if (!(dv > 0)) { flash('err', 'Enter a customer discount greater than zero, or choose "No discount".'); return; }
      if (editDiscType === 'percent' && dv > 100) { flash('err', 'A percentage discount cannot be more than 100%.'); return; }
    }
    changes.manualDiscount = editDiscType === 'none'
      ? { type: 'none' }
      : { type: editDiscType, value: Number(editDiscValue), label: editDiscLabel.trim() || null };
    if (editAddPromos.length > 0) {
      const sub = editEstSubtotal();
      for (const code of editAddPromos) {
        const p = editAvailPromos.find((x: any) => x.code === code);
        if (p && Number(p.minPurchase || 0) > sub) {
          flash('err', `${code} needs a minimum purchase of ${formatPeso(Number(p.minPurchase))}. Remove it or increase the order.`);
          return;
        }
      }
      changes.addPromoCodes = editAddPromos;
    }
    setBusyOrderId(editOrder.id);
    const { data, error } = await supabase.rpc('admin_edit_order', { p_order_id: editOrder.id, p_changes: changes });
    setBusyOrderId(null);
    if (error || data?.success === false) { flash('err', error?.message || data?.message || 'Could not update the order.'); return; }
    if (editPin && editMethod === 'our') {
      // record the exact pin (staff-only) and regenerate its map address
      const { error: pinErr } = await supabase.rpc('admin_set_order_pin', { p_order_id: editOrder.id, p_lat: editPin.lat, p_lng: editPin.lng });
      if (pinErr) { flash('err', `${editOrder.orderNumber} was updated, but the pin could not be recorded: ${pinErr.message}`); setEditOrder(null); fetchCloudData(); return; }
      requestStaffGeocode([editOrder.id]).then(() => fetchCloudData());
    }
    if (data?.unchanged) { flash('ok', `${editOrder.orderNumber}: nothing was changed.`); setEditOrder(null); return; }
    flash('ok', `${editOrder.orderNumber} updated. New total ${formatPeso(Number(data?.total || 0))}${editOrder.pwdApplied ? ' (PWD discount recalculated)' : ''}.`);
    setEditOrder(null);
    fetchCloudData();
  };

  // --- Time windows (Slot Capacity tab): edit / add / remove; customers and dashboards update live ---
  const slotFlash = (kind: 'ok' | 'err', text: string) => {
    setSlotMsg({ kind, text });
    setTimeout(() => setSlotMsg((cur) => (cur && cur.text === text ? null : cur)), 7000);
  };
  const slotEditValue = (label: string) => slotEdits[label] || slotTo24(label) || { start: '09:00', end: '10:00' };
  const handleRenameSlot = async (oldLabel: string) => {
    const v = slotEditValue(oldLabel);
    if (!v.start || !v.end || v.start >= v.end) { slotFlash('err', 'The end time must be after the start time.'); return; }
    const next = `${to12h(v.start)} - ${to12h(v.end)}`;
    if (next === oldLabel) { slotFlash('ok', 'No change: that is already the current time.'); return; }
    setSlotMgmtBusy(true);
    const { data, error } = await supabase.rpc('admin_rename_time_slot', { p_old_label: oldLabel, p_new_label: next });
    setSlotMgmtBusy(false);
    if (error || data?.success === false) { slotFlash('err', error?.message || data?.message || 'Could not change the time slot.'); return; }
    setSlotEdits((p) => { const n = { ...p }; delete n[oldLabel]; return n; });
    slotFlash('ok', `Time slot changed to ${next}. Today's and upcoming bookings moved with it.`);
    fetchCloudData();
  };
  const handleAddSlot = async () => {
    if (!newSlotStart || !newSlotEnd || newSlotStart >= newSlotEnd) { slotFlash('err', 'The end time must be after the start time.'); return; }
    const label = `${to12h(newSlotStart)} - ${to12h(newSlotEnd)}`;
    setSlotMgmtBusy(true);
    const { data, error } = await supabase.rpc('admin_add_time_slot', { p_label: label });
    setSlotMgmtBusy(false);
    if (error || data?.success === false) { slotFlash('err', error?.message || data?.message || 'Could not add the time slot.'); return; }
    slotFlash('ok', `Added ${label}.`);
  };
  const handleDeleteSlot = async (label: string) => {
    if (!window.confirm(`Remove the ${label} time slot? Customers will no longer be able to book it.`)) return;
    setSlotMgmtBusy(true);
    const { data, error } = await supabase.rpc('admin_delete_time_slot', { p_label: label });
    setSlotMgmtBusy(false);
    if (error || data?.success === false) { slotFlash('err', error?.message || data?.message || 'Could not remove the time slot.'); return; }
    slotFlash('ok', `Removed ${label}.`);
    fetchCloudData();
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

  // Recognised sales: ONLY completed orders, using the amount actually payable (PWD orders = discounted final amount).
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const totalGrossSales = completedOrders.reduce((acc, o) => acc + payableAmount(o), 0);
  const totalOrdersCount = orders.length;
  const averageOrderValue = completedOrders.length > 0 ? totalGrossSales / completedOrders.length : 0;
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

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
          <button onClick={() => setActiveTab('process')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'process' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <UserPlus className="h-4 w-4" /> Process Customer Order
          </button>
          <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'feedback' ? 'bg-lime-400 text-black shadow-lg' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60 hover:border-lime-400/50'}`}>
            <MessageSquare className="h-4 w-4" /> Feedback
          </button>
        </div>

        {/* Sales analytics and order transaction log */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Gross Sales (Completed only)</span>
                <p className="text-3xl font-extrabold text-lime-400 font-display">{formatPeso(totalGrossSales)}</p>
              </div>
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Total Orders Placed</span>
                <p className="text-3xl font-extrabold text-white font-display">{totalOrdersCount} Orders</p>
                <p className="text-[10px] text-emerald-300/80 font-semibold">{completedOrders.length} completed • {pendingCount} pending</p>
              </div>
              <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-2 shadow-xl">
                <span className="text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block">Average Completed Order Value</span>
                <p className="text-3xl font-extrabold text-amber-400 font-display">{formatPeso(averageOrderValue)}</p>
              </div>
            </div>
            <div className="bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-lime-400" />
                  <h3 className="font-display text-lg font-extrabold text-white uppercase tracking-wide">Order Transactions Log</h3>
                </div>
                {orders.length > 0 && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!confirm('Are you sure you want to clear all sales logs? Customer order histories will remain untouched.')) return;
                      try {
                        const { error } = await supabase.rpc('admin_clear_sales_log');
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
              {statusMsg && (
                <div className={`rounded-xl border p-3 text-xs font-bold ${statusMsg.kind === 'ok' ? 'bg-lime-950/60 border-lime-500/40 text-lime-300' : 'bg-red-950/70 border-red-700 text-red-300'}`}>
                  {statusMsg.text}
                </div>
              )}
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
                        <th className="p-3">Discount</th>
                        <th className="p-3">Total (₱)</th>
                        <th className="p-3">Order Status</th>
                        <th className="p-3 text-right">Actions</th>
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
                            {order.pinLat != null && (
                              <p className="text-[10px] text-sky-300 max-w-[200px] truncate" title={order.mapAddress || ''}>
                                📍 Map address (auto, staff only): {order.mapAddress || (order.mapAddressStatus === 'failed' ? 'could not be generated' : 'locating…')}
                              </p>
                            )}
                          </td>
                          <td className="p-3 space-y-0.5 max-w-xs">
                            {order.items.map((it: any, i: number) => (
                              <div key={i} className="text-emerald-200">
                                {itemQty(it)}x {lineItemName(it)}
                                {it.customizationsSummary && <span className="block text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</span>}
                              </div>
                            ))}
                          </td>
                          <td className="p-3 font-semibold text-amber-400">
                            {order.promoCode ? (
                              <div className="space-y-0.5">
                                <span>{order.promoCode}</span>
                                {(order.promoDiscount > 0 || order.deliveryDiscount > 0) && (
                                  <span className="block text-[10px] text-amber-300/80 font-medium">
                                    {order.promoDiscount > 0 && `Food −${formatPeso(order.promoDiscount)}`}
                                    {order.promoDiscount > 0 && order.deliveryDiscount > 0 && ' • '}
                                    {order.deliveryDiscount > 0 && `Delivery −${formatPeso(order.deliveryDiscount)}`}
                                  </span>
                                )}
                              </div>
                            ) : (order.manualDiscount > 0 ? null : 'NA')}
                            {order.manualDiscount > 0 && (
                              <span className="block text-[10px] text-lime-300 font-medium">Customer discount −{formatPeso(order.manualDiscount)}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {order.pwdApplied ? (
                              <span className="inline-block bg-sky-400/15 text-sky-300 border border-sky-400/50 px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase">PWD 20%</span>
                            ) : <span className="text-emerald-300/70 font-semibold">NA</span>}
                          </td>
                          <td className="p-3">
                            {order.pwdApplied ? (
                              <div className="space-y-0.5">
                                <span className="block text-[10px] text-emerald-400 line-through">{formatPeso(order.pwdOriginal)}</span>
                                <span className="block font-extrabold text-lime-400 text-sm">{formatPeso(order.pwdFinal)}</span>
                              </div>
                            ) : <span className="font-extrabold text-lime-400 text-sm">{formatPeso(order.total)}</span>}
                          </td>
                          <td className="p-3">
                            <div className="space-y-1 min-w-[130px]">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full border font-extrabold text-[10px] uppercase ${STATUS_SKIN[order.status] || STATUS_SKIN.pending}`}>
                                {STATUS_LABEL[order.status] || order.status}
                              </span>
                              <select
                                value={order.status}
                                disabled={busyOrderId === order.id || order.status === 'cancelled'}
                                onChange={(e) => handleStatusChange(order, e.target.value)}
                                className="block w-full bg-[#04140f] border border-emerald-800 rounded-lg px-2 py-1 text-[11px] text-lime-300 font-bold focus:outline-none focus:border-lime-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                              </select>
                              {busyOrderId === order.id && <span className="block text-[10px] text-amber-300 animate-pulse">Saving…</span>}
                              {order.status === 'rescheduled' && order.rescheduledToDate && (
                                <span className="block text-[10px] text-sky-300">→ {order.rescheduledToDate} ({order.rescheduledToTime})</span>
                              )}
                              {order.status === 'completed' && order.completedAt && (
                                <span className="block text-[10px] text-emerald-400">{new Date(order.completedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                              )}
                              {order.lastEditedAt && (
                                <span className="block text-[10px] text-amber-300">✎ Edited {new Date(order.lastEditedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right space-y-1.5">
                            <Button
                              size="sm"
                              onClick={() => setSelectedInvoice(order)}
                              className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                            >
                              See Invoice
                            </Button>
                            {(order.status === 'pending' || order.status === 'rescheduled') && (
                              <Button
                                size="sm"
                                disabled={busyOrderId === order.id}
                                onClick={() => openEditOrder(order)}
                                className="block ml-auto bg-amber-950 hover:bg-amber-400 hover:text-black text-amber-300 border border-amber-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                              >
                                Edit Order
                              </Button>
                            )}
                            <Button
                              size="sm"
                              disabled={busyOrderId === order.id}
                              onClick={() => openDeleteOrder(order)}
                              className="block ml-auto bg-red-950 hover:bg-red-500 hover:text-black text-red-300 border border-red-800 font-extrabold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                            >
                              Delete Order
                            </Button>
                            {!order.pwdApplied && (order.status === 'pending' || order.status === 'rescheduled') && (
                              <Button
                                size="sm"
                                disabled={busyOrderId === order.id}
                                onClick={() => openPwdConfirm(order)}
                                className="block ml-auto bg-sky-950 hover:bg-sky-400 hover:text-black text-sky-300 border border-sky-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                              >
                                Apply PWD (20%)
                              </Button>
                            )}
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

        {/* Admin order processing: place an order on behalf of an existing or new customer */}
        {activeTab === 'process' && (
          <AdminOrderProcessing onOrdersChanged={fetchCloudData} onViewSales={() => setActiveTab('sales')} />
        )}

        {/* Customer feedback management */}
        {activeTab === 'feedback' && <AdminFeedbackManager />}

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
            {/* Time windows: edits apply to today and all upcoming dates and show instantly for customers */}
            <div className="rounded-2xl border border-emerald-800/80 bg-[#041913] p-4 space-y-3">
              <div>
                <p className="text-xs font-extrabold text-lime-400 uppercase tracking-wider">Edit time windows</p>
                <p className="text-[11px] text-emerald-300 mt-0.5">
                  Change a window (for example 12:00 PM - 1:00 PM to 9:00 AM - 10:00 AM). Today's and upcoming bookings move with it and customers see the new time instantly. Past dates keep their original time.
                </p>
              </div>
              {slotMsg && (
                <div className={`rounded-xl border p-2.5 text-[11px] font-bold ${slotMsg.kind === 'ok' ? 'bg-lime-950/60 border-lime-500/40 text-lime-300' : 'bg-red-950/70 border-red-700 text-red-300'}`}>
                  {slotMsg.text}
                </div>
              )}
              <div className="space-y-2">
                {timeSlotsList.map((label) => {
                  const v = slotEditValue(label);
                  return (
                    <div key={label} className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-white w-40 shrink-0">{label}</span>
                      <input type="time" value={v.start}
                        onChange={(e) => setSlotEdits((p) => ({ ...p, [label]: { ...slotEditValue(label), start: e.target.value } }))}
                        className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                      <span className="text-emerald-400 text-xs">to</span>
                      <input type="time" value={v.end}
                        onChange={(e) => setSlotEdits((p) => ({ ...p, [label]: { ...slotEditValue(label), end: e.target.value } }))}
                        className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                      <Button disabled={slotMgmtBusy} onClick={() => handleRenameSlot(label)}
                        className="bg-lime-400 text-black font-extrabold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40">Save time</Button>
                      <Button disabled={slotMgmtBusy} onClick={() => handleDeleteSlot(label)}
                        className="bg-red-950 text-red-300 border border-red-800 font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40">Remove</Button>
                    </div>
                  );
                })}
                {timeSlotsList.length === 0 && <p className="text-[11px] text-emerald-400/80">No time windows yet. Add one below.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-900/60">
                <span className="text-[11px] font-bold text-lime-400 w-40 shrink-0">Add a new window</span>
                <input type="time" value={newSlotStart} onChange={(e) => setNewSlotStart(e.target.value)}
                  className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                <span className="text-emerald-400 text-xs">to</span>
                <input type="time" value={newSlotEnd} onChange={(e) => setNewSlotEnd(e.target.value)}
                  className="bg-[#03120d] border border-emerald-800 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-lime-400" />
                <Button disabled={slotMgmtBusy} onClick={handleAddSlot}
                  className="bg-emerald-300 text-black font-extrabold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40">Add window</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeSlotsList.map((slotTime) => {
                const existing = slotCapacities ? Object.values(slotCapacities).find((s: any) => s.date_key === selectedSlotDate && s.slot_time === slotTime) : null;
                const maxBowls = existing ? existing.max_bowls : 10;
                const bookedBowls = existing ? existing.booked_bowls : 0;
                const maxSlots = existing ? existing.max_slots : 10;
                const isFullyBooked = existing ? !!existing.is_manually_fully_booked : false;
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
                            <span>{itemQty(it)}x {lineItemName(it)}</span>
                            {it.customizationsSummary && <span className="block text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end pt-2 border-t border-emerald-900/40">
                        <Button
                          size="sm"
                          onClick={() => openTransfer(res)}
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
                  Move this customer's {transferringReservation.bowls_reserved} bowls to another date and time. Past time slots cannot be selected.
                </DialogDescription>
              </div>
              <div className="my-4 space-y-3 text-xs">
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Target Date</label>
                  <input
                    type="date"
                    min={todayManila()}
                    value={transferTargetDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      if (!d) return;
                      setTransferTargetDate(d);
                      if (slotHasEnded(d, transferTargetSlot)) {
                        const next = timeSlotsList.find((s) => !slotHasEnded(d, s));
                        if (next) setTransferTargetSlot(next);
                      }
                    }}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                  />
                </div>
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Target Time Slot</label>
                  <select
                    value={transferTargetSlot}
                    onChange={(e) => setTransferTargetSlot(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400"
                  >
                    {timeSlotsList.map((slot) => {
                      const ended = slotHasEnded(transferTargetDate, slot);
                      const same = transferTargetDate === transferringReservation.date_key && slot === transferringReservation.slot_time;
                      return (
                        <option key={slot} value={slot} disabled={ended || same}>
                          {slot}{ended ? ' (already passed)' : same ? ' (current slot)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setTransferringReservation(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button
                  disabled={slotHasEnded(transferTargetDate, transferTargetSlot)}
                  onClick={() => handleExecuteTransfer(transferringReservation.id, transferTargetDate, transferTargetSlot)}
                  className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >Confirm Transfer</Button>
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
                <input type="text" placeholder="e.g. GEOGWAPO" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value)} required disabled={!!editingPromoCode} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white uppercase placeholder:normal-case focus:outline-none focus:border-lime-400 font-bold" />
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
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Usage Per Account</label>
                <select value={newVoucherPerAccount} onChange={(e) => setNewVoucherPerAccount(e.target.value as any)} className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2.5 text-xs text-lime-300 font-bold focus:outline-none">
                  <option value="one_time">One-Time Use Per Account</option>
                  <option value="multiple">Multiple Uses Per Account</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Total Usage Limit</label>
                <div className="flex gap-1.5">
                  <select value={newVoucherUsageMode} onChange={(e) => setNewVoucherUsageMode(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl px-2 py-2 text-xs text-lime-300 font-bold focus:outline-none">
                    <option value="unlimited">Unlimited</option>
                    <option value="limited">Limited</option>
                  </select>
                  {newVoucherUsageMode === 'limited' && (
                    <input type="number" min="1" step="1" placeholder="Max redemptions" value={newVoucherUsageLimit} onChange={(e) => setNewVoucherUsageLimit(e.target.value)} required className="w-32 bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 border-t border-emerald-900/60 pt-3">
                <span className="text-[10px] font-extrabold text-sky-300 uppercase tracking-wider">Promotional Campaign (optional) • all times are Asia/Manila</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Promotion Name</label>
                <input type="text" placeholder="e.g. 11.11 Sale" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
              </div>
              <div className="space-y-1 sm:col-span-1 lg:col-span-2">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Description</label>
                <input type="text" placeholder="Optional description" value={newCampaignDesc} onChange={(e) => setNewCampaignDesc(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-lime-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Start Date & Time</label>
                <input type="datetime-local" value={newCampaignStart} onChange={(e) => setNewCampaignStart(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400 [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Expiration Date & Time</label>
                <input type="datetime-local" value={newCampaignEnd} onChange={(e) => setNewCampaignEnd(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400 [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-lime-400 uppercase tracking-wider block">Minimum Purchase (₱, optional)</label>
                <input type="number" min="0" placeholder="e.g. 300" value={newCampaignMinPurchase} onChange={(e) => setNewCampaignMinPurchase(e.target.value)} className="w-full bg-[#04140f] border border-emerald-800/80 rounded-xl p-2 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
              </div>
              <p className="sm:col-span-2 lg:col-span-3 text-[10px] text-emerald-400/70">
                If a name, start or expiration is set, the "Expiry Time Type" above is ignored and the campaign runs on these dates. Leave the start empty to begin immediately; leave the expiration empty for no end date.
              </p>
              <div className="flex items-end gap-2">
                <Button type="submit" className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg cursor-pointer">
                  <Plus className="h-4 w-4 mr-1" /> {editingPromoCode ? 'Save Changes' : 'Create Voucher / Campaign'}
                </Button>
                {editingPromoCode && (
                  <Button type="button" onClick={resetPromoForm} className="bg-[#082d22] hover:bg-[#0a3a2c] text-emerald-200 border border-emerald-700 font-bold py-2.5 rounded-xl text-xs cursor-pointer">
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Active Vouchers & Promos ({promos.length})</h4>
              {promos.length === 0 ? (
                <p className="text-xs text-emerald-400/60 py-6 text-center">No active vouchers or promo codes available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {promos
                    // Plain expired vouchers are hidden as before; expired CAMPAIGNS stay visible for the record.
                    .filter((p) => !(getPromoStatus(p, nowTimestamp) === 'expired' && !isCampaignPromo(p)))
                    .map((p) => {
                      const status = getPromoStatus(p, nowTimestamp);
                      const endMs = getPromoEndMs(p);
                      let countdownText = 'Never expires';
                      let isExpiringSoon = false;
                      if (status === 'scheduled') {
                        countdownText = `Starts in ${formatCountdown(Number(p.startDate) - nowTimestamp)}`;
                      } else if (status === 'expired') {
                        countdownText = 'EXPIRED';
                      } else if (status === 'disabled') {
                        countdownText = 'DISABLED';
                      } else if (endMs) {
                        const diff = endMs - nowTimestamp;
                        countdownText = `Ends in ${formatCountdown(diff)}`;
                        isExpiringSoon = diff < 5 * 60 * 1000; // Less than 5 minutes
                      }
                      return (
                        <div key={p.code} className={`bg-[#061d16] border rounded-xl p-4 flex items-start justify-between gap-2 text-xs shadow-md ${
                          isExpiringSoon ? 'border-amber-500/60' : 'border-emerald-800/80'
                        } ${status === 'expired' || status === 'disabled' ? 'opacity-75' : ''}`}>
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-lime-400 text-sm tracking-wide break-all">{p.code}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${STATUS_STYLES[status]}`}>{status}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                p.visibility === 'hidden' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-lime-400/20 text-lime-400 border border-lime-400/40'
                              }`}>
                                {p.visibility || 'public'}
                              </span>
                            </div>
                            {p.name && <p className="text-white font-extrabold text-[11px]">{p.name}</p>}
                            {p.description && <p className="text-[10px] text-emerald-300/80">{p.description}</p>}
                            <p className="text-emerald-200 font-bold">
                              {p.type === 'peso' ? formatPeso(p.discountValue) + ' OFF' : `${p.discountValue}% OFF`}
                              {' '}{p.target_type === 'delivery' ? 'DELIVERY' : 'FOOD'}
                            </p>
                            <p className={`text-[10px] font-mono ${isExpiringSoon ? 'text-amber-400 font-bold' : 'text-amber-300'}`}>
                              {countdownText}
                            </p>
                            {isCampaignPromo(p) && (
                              <p className="text-[10px] text-sky-300">🗓 {formatManila(p.startDate)} → {endMs ? formatManila(endMs) : 'no end date'}</p>
                            )}
                            {p.minPurchase > 0 && <p className="text-[10px] text-emerald-300">Min. purchase: {formatPeso(p.minPurchase)}</p>}
                            <div className="text-[10px] text-emerald-300 space-y-0.5 pt-0.5">
                              <p>Usage Per Account: <strong className="text-white">{p.perPersonLimit === null || p.perPersonLimit === undefined ? 'Multiple Uses' : p.perPersonLimit === 1 ? 'One-Time' : `${p.perPersonLimit} per account`}</strong></p>
                              <p>Total Usage: <strong className="text-white">{p.usageLimit ? 'Limited' : 'UNLIMITED'}</strong></p>
                              {p.usageLimit ? <p>Maximum Redemptions: <strong className="text-white">{p.usageLimit}</strong></p> : null}
                              <p>Successful Redemptions: <strong className="text-white">{p.usageCount || 0}</strong></p>
                              {p.usageLimit ? <p>Remaining Redemptions: <strong className="text-white">{Math.max(0, p.usageLimit - (p.usageCount || 0))}</strong></p> : null}
                              <p>Expiration: <strong className="text-white">{getPromoEndMs(p) ? formatManila(getPromoEndMs(p)) : 'Never expires'}</strong></p>
                              <p>Status: <strong className={p.usageLimit && (p.usageCount || 0) >= p.usageLimit ? 'text-red-400' : 'text-lime-300'}>{p.usageLimit && (p.usageCount || 0) >= p.usageLimit ? 'USAGE LIMIT REACHED / UNAVAILABLE' : status.toUpperCase()}</strong></p>
                            </div>
                            <p className="text-[10px] text-blue-300">Eligibility: {p.eligibility === 'registered' ? 'Registered Only' : 'All Customers'}</p>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button onClick={() => handleEditPromo(p)} className="text-lime-300 hover:text-lime-200 px-2 py-1 rounded-lg bg-[#082d22] border border-emerald-700 cursor-pointer text-[10px] font-bold">
                              Edit
                            </button>
                            <button onClick={() => handleViewRedemptions(p.code)} className="text-sky-300 hover:text-sky-200 px-2 py-1 rounded-lg bg-sky-950/30 border border-sky-800/60 cursor-pointer text-[10px] font-bold">
                              {redemptionView?.code === p.code ? 'Hide Redemptions' : 'Redemptions'}
                            </button>
                            <button onClick={() => handleTogglePromoEnabled(p)} className="text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg bg-amber-950/30 border border-amber-800/60 cursor-pointer text-[10px] font-bold">
                              {p.isEnabled === false ? 'Enable' : 'Disable'}
                            </button>
                            <button onClick={() => handleDeletePromo(p.code)} className="text-red-400 hover:text-red-300 p-2 rounded-lg bg-red-950/40 border border-red-900/60 cursor-pointer self-center">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
              {redemptionView && (
                <div className="bg-[#061d16] border border-sky-800/60 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wider">Redemption history: {redemptionView.code}</h5>
                    <button onClick={() => setRedemptionView(null)} className="text-[10px] font-bold text-emerald-300 hover:text-white cursor-pointer">Close</button>
                  </div>
                  {redemptionView.loading ? (
                    <p className="text-[11px] text-emerald-300/70">Loading…</p>
                  ) : redemptionView.rows.length === 0 ? (
                    <p className="text-[11px] text-emerald-300/70">No redemptions recorded for this voucher yet.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {redemptionView.rows.map((r: any) => {
                        const cust = customers.find((c: any) => c.auth_user_id && c.auth_user_id === r.user_id);
                        return (
                          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-[#04140f] border border-emerald-900/60 rounded-lg px-3 py-1.5">
                            <span className="font-bold text-white">{r.order_number || 'Order'}</span>
                            <span className="text-emerald-200">{cust ? cust.name : r.user_id ? 'Registered customer' : 'Walk-in'}</span>
                            <span className="text-amber-300">{formatManila(Date.parse(r.redeemed_at))}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${r.status === 'redeemed' ? 'bg-lime-400/20 text-lime-400 border border-lime-400/40' : 'bg-slate-700/40 text-slate-300 border border-slate-500/50'}`}>{r.status === 'redeemed' ? 'redeemed' : 'voided (order cancelled)'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PWD confirmation */}
        <Dialog open={!!pwdConfirmOrder} onOpenChange={(open) => !open && setPwdConfirmOrder(null)}>
          {pwdConfirmOrder && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">Apply PWD Discount (20%)</DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">Order {pwdConfirmOrder.orderNumber}. Ask the customer to show their physical PWD ID and inspect it first. No copy of the ID is stored.</DialogDescription>
              </div>
              <div className="my-3 space-y-2 text-xs">
                <div className="flex justify-between text-emerald-200"><span>Order total</span><span className="font-bold text-white">{formatPeso(pwdConfirmOrder.total)}</span></div>
                <div className="flex justify-between text-sky-300"><span>PWD discount (20%)</span><span className="font-bold">−{formatPeso(Math.round(pwdConfirmOrder.total * 20) / 100)}</span></div>
                <div className="flex justify-between border-t border-emerald-900/60 pt-2 text-sm font-extrabold"><span>Final amount</span><span className="text-lime-400">{formatPeso(pwdConfirmOrder.total - Math.round(pwdConfirmOrder.total * 20) / 100)}</span></div>
                <label className="flex items-start gap-2 rounded-xl border border-emerald-800 bg-[#041913] p-3 cursor-pointer">
                  <input type="checkbox" checked={pwdIdChecked} onChange={(e) => setPwdIdChecked(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span className="text-emerald-100 font-semibold">I personally inspected the customer's valid PWD ID.</span>
                </label>
                <p className="text-[10px] text-emerald-400/80">Preview only — the database computes and saves the real amount, and a second click can never deduct another 20%.</p>
              </div>
              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setPwdConfirmOrder(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button disabled={!pwdIdChecked || busyOrderId === pwdConfirmOrder.id} onClick={handleApplyPwd}
                  className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  {busyOrderId === pwdConfirmOrder.id ? 'Applying…' : 'Confirm & Apply'}
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Reschedule modal */}
        <Dialog open={!!rescheduleOrder} onOpenChange={(open) => !open && setRescheduleOrder(null)}>
          {rescheduleOrder && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">Reschedule {rescheduleOrder.orderNumber}</DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  Current slot: {rescheduleOrder.slotDate ? `${rescheduleOrder.slotDate} (${rescheduleOrder.slotTime})` : 'unknown'}. Past and fully booked slots cannot be chosen.
                </DialogDescription>
              </div>
              <div className="my-3 space-y-3 text-xs">
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">New Date</label>
                  <input type="date" min={todayManila()} value={rescheduleDate}
                    onChange={(e) => {
                      const d = e.target.value; if (!d) return;
                      setRescheduleDate(d);
                      const next = timeSlotsList.find((s) => !slotAvailability(d, s, rescheduleOrder).disabled);
                      setRescheduleSlot(next || '');
                    }}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">New Time Slot</label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlotsList.map((slot) => {
                      const a = slotAvailability(rescheduleDate, slot, rescheduleOrder);
                      return (
                        <button key={slot} type="button" disabled={a.disabled} onClick={() => setRescheduleSlot(slot)}
                          className={`p-2 rounded-lg border text-[11px] font-bold flex flex-col items-center transition-all ${
                            a.disabled ? 'bg-red-950/50 border-red-900 text-red-400 opacity-60 cursor-not-allowed'
                            : rescheduleSlot === slot ? 'bg-lime-400 text-black border-lime-400 shadow-md'
                            : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-lime-400/50 cursor-pointer'}`}>
                          <span>{slot}</span>
                          <span className="text-[9px] font-semibold mt-0.5">{a.same ? 'Current slot' : a.ended ? '⏰ Past' : a.full ? '⛔ Fully Booked' : `🟢 ${a.left} bowls left`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setRescheduleOrder(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button disabled={!rescheduleSlot || busyOrderId === rescheduleOrder.id} onClick={handleConfirmReschedule}
                  className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  {busyOrderId === rescheduleOrder.id ? 'Moving…' : 'Confirm Reschedule'}
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Edit Order modal */}
        <Dialog open={!!editOrder} onOpenChange={(open) => !open && setEditOrder(null)}>
          {editOrder && (
            <DialogContent className="max-w-lg w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
              <div className="space-y-1 border-b border-emerald-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-white">Edit {editOrder.orderNumber}</DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  {editOrder.name}. Changes show instantly in the customer's My Order History. The database recalculates the total, checks slot capacity and logs every edit.
                </DialogDescription>
              </div>

              <div className="my-3 space-y-4 text-xs">
                {/* Items */}
                <div className="space-y-1.5">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Items &amp; Quantity</label>
                  {(editOrder.items || []).map((it: any, i: number) => {
                    const qty = Number(editQty[i]) || 0;
                    return (
                      <div key={i} className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${qty === 0 ? 'border-red-900 bg-red-950/30 opacity-70' : 'border-emerald-800 bg-[#041913]'}`}>
                        <div className="min-w-0">
                          <p className={`font-bold text-white truncate ${qty === 0 ? 'line-through' : ''}`}>{lineItemName(it)}</p>
                          {it.customizationsSummary && <p className="text-[10px] text-lime-300 font-mono">↳ {it.customizationsSummary}</p>}
                          <p className="text-[10px] text-emerald-400">{formatPeso(itemUnit(it))} each{qty === 0 ? ' • will be removed' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" onClick={() => setEditQty((p) => ({ ...p, [i]: Math.max(0, (Number(p[i]) || 0) - 1) }))}
                            className="h-7 w-7 rounded-lg bg-[#082d22] border border-emerald-700 text-lime-400 font-extrabold cursor-pointer">−</button>
                          <input type="number" min={0} max={50} value={qty}
                            onChange={(e) => {
                              const n = Math.max(0, Math.min(50, Math.floor(Number(e.target.value) || 0)));
                              setEditQty((p) => ({ ...p, [i]: n }));
                            }}
                            className="w-12 bg-[#04140f] border border-emerald-800 rounded-lg py-1 text-center text-xs font-bold text-white focus:outline-none focus:border-lime-400" />
                          <button type="button" onClick={() => setEditQty((p) => ({ ...p, [i]: Math.min(50, (Number(p[i]) || 0) + 1) }))}
                            className="h-7 w-7 rounded-lg bg-[#082d22] border border-emerald-700 text-lime-400 font-extrabold cursor-pointer">+</button>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-emerald-400/80">Set a quantity to 0 to remove a line. Each line keeps its original price and add-ons.</p>
                  {editMethod !== 'on-site' && editSlot && (() => {
                    const si = editSlotInfo(editDate, editSlot);
                    return si.over ? (
                      <p className="text-[10px] font-bold text-red-400">
                        {si.closed ? '⛔ This time slot is closed by the administrator. ' : '⛔ Not enough bowls in this time slot. '}
                        This order can hold at most {si.left} bowl{si.left === 1 ? '' : 's'} here ({editBowlsNow()} entered).
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* Fulfillment */}
                <div className="space-y-1.5">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Fulfillment</label>
                  {editMethod === 'on-site' ? (
                    <p className="rounded-xl border border-emerald-800 bg-[#041913] p-2.5 text-emerald-200">On-site (counter) order. Only quantities can be edited.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {([['pickup', 'Pickup'], ['delivery', 'Delivery']] as const).map(([key, label]) => {
                          const active = key === 'pickup' ? editMethod === 'pickup' : (editMethod === 'our' || editMethod === 'maxim');
                          return (
                            <button key={key} type="button"
                              onClick={() => setEditMethod(key === 'pickup' ? 'pickup' : (editMethod === 'maxim' ? 'maxim' : 'our'))}
                              className={`p-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${active ? 'bg-lime-400 text-black border-lime-400 shadow-md' : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-lime-400/50'}`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {(editMethod === 'our' || editMethod === 'maxim') && (
                        <div className="grid grid-cols-2 gap-2">
                          {([['our', 'Our Delivery'], ['maxim', 'Maxim Courier']] as const).map(([key, label]) => (
                            <button key={key} type="button" onClick={() => setEditMethod(key)}
                              className={`p-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${editMethod === key ? 'bg-emerald-300 text-black border-emerald-300 shadow-md' : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-emerald-300/50'}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Delivery details */}
                {(editMethod === 'our' || editMethod === 'maxim') && (
                  <div className="space-y-2 rounded-xl border border-emerald-800 bg-[#041913] p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Contact Name</label>
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
                      </div>
                      <div>
                        <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Contact Number</label>
                        <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
                      </div>
                    </div>
                    {editMethod === 'our' && (
                      <>
                        <div>
                          <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Delivery Pin (click the map)</label>
                          <DeliveryPinMap value={editPin} onChange={setEditPin} />
                          <p className="text-[10px] text-emerald-300 mt-1">
                            {editPin
                              ? `Pinned: ${editPin.lat.toFixed(5)}, ${editPin.lng.toFixed(5)}${editPinFee ? ` • ${editPinFee.km} km from store • delivery fee ${formatPeso(editPinFee.fee)}` : ' • calculating the fee…'}`
                              : (editOrder.fulfillment === 'delivery' && orderDeliveryOption(editOrder) === 'our'
                                  ? `No new pin: the saved delivery fee (${formatPeso(Number(editOrder.deliveryFee) || 0)}) is kept. Drop a pin to recalculate it.`
                                  : 'Drop the pin on the customer location so the delivery fee can be calculated.')}
                          </p>
                          <p className="text-[10px] text-emerald-400/80">Under 1 km free • 1–2 km ₱40 • beyond 2 km ₱40 + ₱5 per extra km. Calculated by the database.</p>
                        </div>
                        <div>
                          <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Delivery Address</label>
                          <input type="text" value={editLocation} onChange={(e) => { editAddrTouched.current = true; setEditLocation(e.target.value); }}
                            className="w-full bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Nearest Landmark</label>
                      <input type="text" value={editLandmark} onChange={(e) => setEditLandmark(e.target.value)}
                        className="w-full bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
                    </div>
                    {editMethod === 'maxim' && (
                      <p className="text-[10px] text-emerald-300">Maxim Courier: no map pin or address is needed. The delivery fee is paid directly to the rider, so this order's delivery fee becomes ₱0.00.</p>
                    )}
                  </div>
                )}

                {/* Schedule */}
                {editMethod !== 'on-site' && (
                  <div className="space-y-2">
                    <label className="font-bold text-lime-400 uppercase tracking-wider block">Date &amp; Time Schedule</label>
                    <p className="text-[10px] text-emerald-400/80">Current: {editOrder.slotDate ? `${editOrder.slotDate} (${editOrder.slotTime})` : 'unknown'}. Past and fully booked slots cannot be chosen. Changing the time marks the order Rescheduled.</p>
                    <input type="date" min={todayManila()} value={editDate} onChange={(e) => e.target.value && setEditDate(e.target.value)}
                      className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-lime-400" />
                    <div className="grid grid-cols-2 gap-2">
                      {timeSlotsList.map((slot) => {
                        const a = editSlotInfo(editDate, slot);
                        const selected = editSlot === slot;
                        return (
                          <button key={slot} type="button" disabled={a.disabled}
                            onClick={() => setEditSlot(slot)}
                            className={`p-2 rounded-lg border text-[11px] font-bold flex flex-col items-center transition-all ${
                              a.disabled ? 'bg-red-950/50 border-red-900 text-red-400 opacity-60 cursor-not-allowed'
                              : selected ? 'bg-lime-400 text-black border-lime-400 shadow-md'
                              : 'bg-[#041913] text-emerald-300 border-emerald-800/60 hover:border-lime-400/50 cursor-pointer'}`}>
                            <span>{slot}</span>
                              <span className="text-[9px] font-semibold mt-0.5">{a.same
                              ? (a.closed ? `🔒 Current slot • closed (max ${a.left})` : `Current slot • up to ${a.left} bowls`)
                              : a.ended ? '⏰ Past'
                              : a.closed ? '⛔ Closed by admin'
                              : a.full ? `⛔ Only ${a.left} left`
                              : `🟢 ${a.left} bowls left`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Customer discount (applied to the food subtotal after promo codes; never to the delivery fee) */}
                <div className="rounded-xl border border-emerald-800 bg-[#041913] p-3 space-y-2">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Customer Discount</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editDiscType} onChange={(e) => setEditDiscType(e.target.value as any)}
                      className="bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400">
                      <option value="none">No discount</option>
                      <option value="percent">Percentage (%)</option>
                      <option value="amount">Fixed amount (₱)</option>
                    </select>
                    <input type="number" min="0" step="0.01" disabled={editDiscType === 'none'} value={editDiscType === 'none' ? '' : editDiscValue}
                      onChange={(e) => setEditDiscValue(e.target.value)}
                      placeholder={editDiscType === 'percent' ? 'e.g. 10' : editDiscType === 'amount' ? 'e.g. 30' : '—'}
                      className="bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400 disabled:opacity-40" />
                  </div>
                  <input type="text" maxLength={80} disabled={editDiscType === 'none'} value={editDiscType === 'none' ? '' : editDiscLabel}
                    onChange={(e) => setEditDiscLabel(e.target.value)} placeholder="Reason (optional), e.g. Forgot to apply loyalty discount"
                    className="w-full bg-[#03120d] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400 disabled:opacity-40" />
                  <p className="text-[10px] text-emerald-400/80">Choose "No discount" to remove an existing discount. It is added to the order, never changes the bowl quantity, and is logged.</p>

                  {/* Promos & vouchers the customer may have forgotten to add (only ones this customer can really use right now) */}
                  <div className="border-t border-emerald-900/60 pt-2 space-y-2">
                    <label className="font-bold text-lime-400 uppercase tracking-wider block">Available Promos &amp; Vouchers</label>
                    {editOrder.promoCode ? (
                      <p className="text-[10px] text-emerald-300">Already on this order: <strong className="text-white">{editOrder.promoCode}</strong></p>
                    ) : (
                      <p className="text-[10px] text-emerald-400/80">No promo or voucher is on this order yet.</p>
                    )}
                    {editAvailLoading ? (
                      <p className="text-[10px] text-emerald-300">Checking which promos and vouchers this customer can use…</p>
                    ) : editAvailError ? (
                      <p className="text-[10px] text-red-400">{editAvailError}</p>
                    ) : editAvailPromos.length === 0 ? (
                      <p className="text-[10px] text-emerald-400/80">No other promo or voucher is available for this customer right now.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {editAvailPromos.map((p: any) => {
                          const picked = editAddPromos.includes(p.code);
                          const needsMore = Number(p.minPurchase || 0) > editEstSubtotal();
                          const off = p.type === 'percentage' ? `${Number(p.discountValue)}% off` : `${formatPeso(Number(p.discountValue))} off`;
                          const where = p.targetType === 'delivery' ? 'delivery fee' : 'food';
                          return (
                            <div key={p.code} className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${picked ? 'border-lime-400 bg-lime-400/10' : 'border-emerald-800 bg-[#03120d]'}`}>
                              <div className="min-w-0">
                                <p className="font-bold text-white text-xs truncate">
                                  {p.code}{p.name ? ` · ${p.name}` : ''}
                                  {p.personal && <span className="ml-1.5 text-[9px] font-bold uppercase text-lime-300">Customer's voucher</span>}
                                </p>
                                <p className="text-[10px] text-emerald-300">
                                  {off} on {where}
                                  {Number(p.minPurchase || 0) > 0 ? ` · min. ${formatPeso(Number(p.minPurchase))}` : ''}
                                  {p.oneTimePerAccount ? ' · one-time per account' : ''}
                                  {p.remaining !== null && p.remaining !== undefined ? ` · ${p.remaining} left` : ''}
                                </p>
                                {needsMore && !picked && <p className="text-[10px] text-amber-300">Order is below this promo's minimum purchase.</p>}
                              </div>
                              <button type="button" disabled={needsMore && !picked} onClick={() => toggleEditPromo(p.code)}
                                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${picked ? 'bg-lime-400 text-black' : 'bg-emerald-950 border border-emerald-700 text-emerald-100 hover:border-lime-400'}`}>
                                {picked ? 'Added ✓' : 'Add'}
                              </button>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-emerald-400/80">A promo or voucher added here counts as used by this customer (limits and one-time rules apply) and is logged.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="font-bold text-lime-400 uppercase tracking-wider block mb-1">Reason / Note (optional, saved in the audit log)</label>
                  <input type="text" value={editNote} maxLength={200} onChange={(e) => setEditNote(e.target.value)}
                    placeholder="e.g. Customer misclicked Maxim, wants our delivery"
                    className="w-full bg-[#041913] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
                </div>

                {/* Estimate */}
                <div className="rounded-xl border border-emerald-800 bg-[#041913] p-3 space-y-1">
                  <div className="flex justify-between text-emerald-200">
                    <span>Estimated food subtotal ({editBowlsNow()} item{editBowlsNow() === 1 ? '' : 's'})</span>
                    <span className="font-bold text-white">{formatPeso((editOrder.items || []).reduce((s: number, it: any, i: number) => s + itemUnit(it) * (Number(editQty[i]) || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between text-emerald-200">
                    <span>Estimated delivery fee</span>
                    <span className="font-bold text-white">{editMethod === 'our' ? formatPeso(editPinFee ? editPinFee.fee : (Number(editFee) || 0)) : formatPeso(0)}</span>
                  </div>
                  {(editNewFoodPromo() + editNewDeliveryPromo()) > 0 && (
                    <div className="flex justify-between text-lime-300">
                      <span>Added promo / voucher ({editAddPromos.join(', ')})</span>
                      <span className="font-bold">−{formatPeso(Math.min(editEstSubtotal() - editOldPromoScaled(), editNewFoodPromo()) + Math.min(editFeeNow(), editNewDeliveryPromo()))}</span>
                    </div>
                  )}
                  {editDiscountPreview() > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>Customer discount{editDiscType === 'percent' ? ` (${Number(editDiscValue)}%)` : ''}</span>
                      <span className="font-bold">−{formatPeso(editDiscountPreview())}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-200 border-t border-emerald-900/60 pt-1">
                    <span>Estimated total</span>
                    <span className="font-bold text-lime-400">{formatPeso(Math.max(0, editEstSubtotal() - editFoodPromoNow() - editDiscountPreview() + editFeeNow() - editDeliveryPromoNow()))}</span>
                  </div>
                  <p className="text-[10px] text-emerald-400/80">Preview only. Promos and the PWD discount are recalculated by the database when you save, and the final total is shown afterwards.</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <Button onClick={() => setEditOrder(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button disabled={busyOrderId === editOrder.id || (editMethod !== 'on-site' && !!editSlot && editSlotInfo(editDate, editSlot).over)} onClick={handleSaveEdit}
                  className="flex-1 bg-lime-400 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  {busyOrderId === editOrder.id ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* Delete Order confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          {deleteTarget && (
            <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-red-900/80 shadow-2xl p-6 rounded-3xl">
              <div className="space-y-1 border-b border-red-900/60 pb-3">
                <DialogTitle className="font-display text-lg font-extrabold text-red-400">Delete order {deleteTarget.orderNumber}?</DialogTitle>
                <DialogDescription className="text-xs text-emerald-300">
                  {deleteTarget.name || 'Customer'} • {formatPeso(payableAmount(deleteTarget))} • {STATUS_LABEL[deleteTarget.status] || deleteTarget.status}
                </DialogDescription>
              </div>
              <div className="my-4 space-y-3 text-xs">
                <p className="text-emerald-200">
                  This permanently removes the order from the active orders and from Sales Analytics, and gives its reserved bowls back to the time slot.
                  The customer's account is not touched, and a snapshot of the order is kept in the audit log.
                  {deleteTarget.status === 'completed' && <strong className="text-amber-300"> This order is COMPLETED, so Gross Sales will go down by {formatPeso(payableAmount(deleteTarget))}.</strong>}
                </p>
                <input type="text" maxLength={200} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Reason (optional, saved in the audit log)"
                  className="w-full bg-[#041913] border border-emerald-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={deleteAck} onChange={(e) => setDeleteAck(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span className="text-red-300 font-bold">I understand that deleting {deleteTarget.orderNumber} cannot be undone.</span>
                </label>
              </div>
              <div className="flex gap-2 pt-2 border-t border-red-900/60">
                <Button onClick={() => setDeleteTarget(null)} className="flex-1 bg-emerald-950 text-emerald-200 font-bold py-2.5 rounded-xl text-xs cursor-pointer">Cancel</Button>
                <Button disabled={!deleteAck || busyOrderId === deleteTarget.id} onClick={handleDeleteOrder}
                  className="flex-1 bg-red-500 text-black font-extrabold py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  {busyOrderId === deleteTarget.id ? 'Deleting…' : 'Delete Order'}
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

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
                    {(selectedInvoice.items || []).length === 0 && (
                      <p className="text-emerald-400 text-[11px]">No item details were saved for this order.</p>
                    )}
                    {(selectedInvoice.items || []).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-white">
                        <div>
                          <span>{itemQty(it)}x {lineItemName(it)}</span>
                          <span className="text-emerald-400 text-[10px]"> @ {formatPeso(itemUnit(it))}</span>
                          {it.customizationsSummary && (
                            <p className="text-[10px] text-lime-300 font-mono pl-2">↳ {it.customizationsSummary}</p>
                          )}
                        </div>
                        <span className="font-bold text-lime-400">{formatPeso(itemUnit(it) * itemQty(it))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-emerald-200">
                      <span>Food Subtotal:</span>
                      <span>{formatPeso(selectedInvoice.subtotal || (selectedInvoice.items || []).reduce((s: number, it: any) => s + itemUnit(it) * itemQty(it), 0))}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>Promo: {selectedInvoice.promoCode || 'NA'}</span>
                      <span>{selectedInvoice.promoDiscount > 0 ? `−${formatPeso(selectedInvoice.promoDiscount)} (food)` : selectedInvoice.promoCode ? '' : 'NA'}</span>
                    </div>
                    {selectedInvoice.manualDiscount > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Customer Discount{selectedInvoice.manualDiscountType === 'percent' && selectedInvoice.manualDiscountValue ? ` (${selectedInvoice.manualDiscountValue}%)` : ''}{selectedInvoice.manualDiscountLabel ? ` — ${selectedInvoice.manualDiscountLabel}` : ''}:</span>
                        <span>−{formatPeso(selectedInvoice.manualDiscount)}</span>
                      </div>
                    )}
                    {selectedInvoice.deliveryFee > 0 && (
                      <div className="flex justify-between text-emerald-200">
                        <span>Delivery Fee:</span>
                        <span>{formatPeso(selectedInvoice.deliveryFee)}</span>
                      </div>
                    )}
                    {selectedInvoice.deliveryDiscount > 0 && (
                      <div className="flex justify-between text-amber-400 font-semibold">
                        <span>Delivery Discount:</span>
                        <span>−{formatPeso(selectedInvoice.deliveryDiscount)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-white pt-1">
                    <span>{selectedInvoice.pwdApplied ? 'Original Order Total:' : 'Total Amount Due:'}</span>
                    <span className={selectedInvoice.pwdApplied ? 'text-emerald-200 text-base' : 'text-lime-400 text-base'}>{formatPeso(selectedInvoice.pwdApplied ? selectedInvoice.pwdOriginal : selectedInvoice.total)}</span>
                  </div>
                  {selectedInvoice.pwdApplied && (
                    <div className="space-y-1 text-xs rounded-lg border border-sky-400/50 bg-sky-400/10 p-2.5">
                      <div className="flex justify-between text-sky-300 font-extrabold">
                        <span>♿ PWD Discount ({selectedInvoice.pwdPercent}%):</span>
                        <span>−{formatPeso(selectedInvoice.pwdDiscount)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-extrabold text-white">
                        <span>Final Amount:</span>
                        <span className="text-lime-400 text-base">{formatPeso(selectedInvoice.pwdFinal)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-emerald-200 pt-1">
                    <span>Order Status:</span>
                    <span className={`px-2 py-0.5 rounded-full border font-extrabold uppercase text-[10px] ${STATUS_SKIN[selectedInvoice.status] || STATUS_SKIN.pending}`}>{STATUS_LABEL[selectedInvoice.status] || selectedInvoice.status}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-200">
                    <span>Discount Type:</span>
                    <span className="font-bold text-white">{selectedInvoice.pwdApplied ? 'PWD' : 'NA'}</span>
                  </div>
                  {selectedInvoice.pwdApplied && (
                    <p className="text-[10px] text-sky-300/80">ID manually checked by {selectedInvoice.pwdAppliedByName || 'staff'}{selectedInvoice.pwdAppliedAt ? ` on ${new Date(selectedInvoice.pwdAppliedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}` : ''}</p>
                  )}
                </div>
              </div>
              {selectedInvoice.fulfillment === 'delivery' && (
                <div data-admin-only="true" className="mt-3 bg-[#04140f] border border-sky-700/60 rounded-xl p-3 text-xs space-y-1.5 print:hidden">
                  <p className="font-bold text-sky-300 uppercase text-[10px] tracking-wider">🔒 Delivery verification (staff only: not on the printed invoice, never shown to customers)</p>
                  <p className="text-emerald-200">Customer-entered delivery address: <strong>{selectedInvoice.location || 'N/A'}</strong></p>
                  <p className="text-emerald-200">Customer-entered nearest landmark: <strong>{selectedInvoice.landmark || 'N/A'}</strong></p>
                  {selectedInvoice.pinLat != null ? (
                    <>
                      <p className="text-emerald-200">
                        Pinned map location: <strong>{selectedInvoice.pinLat.toFixed(6)}, {selectedInvoice.pinLng.toFixed(6)}</strong>{' '}
                        <a href={`https://www.openstreetmap.org/?mlat=${selectedInvoice.pinLat}&mlon=${selectedInvoice.pinLng}#map=18/${selectedInvoice.pinLat}/${selectedInvoice.pinLng}`}
                          target="_blank" rel="noopener noreferrer" className="text-lime-400 underline font-bold">View pin on map</a>
                      </p>
                      <p className="text-emerald-200">
                        Map address (auto-generated from the pin): <strong>{selectedInvoice.mapAddress || (selectedInvoice.mapAddressStatus === 'failed' ? 'Could not be generated.' : 'Being generated…')}</strong>
                        {selectedInvoice.mapAddressStatus !== 'ok' && (
                          <button type="button" className="ml-2 text-lime-400 underline font-bold cursor-pointer"
                            onClick={() => requestStaffGeocode([selectedInvoice.id], true).then(() => fetchCloudData())}>
                            {selectedInvoice.mapAddressStatus === 'failed' ? 'Try again' : 'Refresh'}
                          </button>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-emerald-400">
                      {orderDeliveryOption(selectedInvoice) === 'maxim'
                        ? 'Maxim delivery: no map pin is required.'
                        : 'No map pin recorded (placed before the pin became required, or added by staff without one).'}
                    </p>
                  )}
                </div>
              )}
              {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'rescheduled') && (
                <div className="flex gap-2 pt-3 border-t border-emerald-900/60">
                  {!selectedInvoice.pwdApplied && (
                    <Button onClick={() => openPwdConfirm(selectedInvoice)} disabled={busyOrderId === selectedInvoice.id}
                      className="flex-1 bg-sky-950 hover:bg-sky-400 hover:text-black text-sky-300 border border-sky-700 font-extrabold py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">
                      Apply PWD Discount (20%)
                    </Button>
                  )}
                  {selectedInvoice.pwdApplied && (
                    <Button onClick={() => handleRemovePwd(selectedInvoice)} disabled={busyOrderId === selectedInvoice.id}
                      className="flex-1 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">
                      Remove PWD (admin)
                    </Button>
                  )}
                </div>
              )}
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
                  Update the display nickname, change the sign-in email, or send a password-reset email. The customer always verifies through their own inbox.
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
                <div className="space-y-2 border-t border-emerald-900/60 pt-3">
                  <label className="font-bold text-lime-400 uppercase tracking-wider block">Sign-in email</label>
                  <input
                    type="email"
                    value={editCustValue}
                    onChange={(e) => setEditCustValue(e.target.value)}
                    className="w-full bg-[#041913] border border-emerald-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-lime-400"
                  />
                  <div className="flex gap-2">
                    <Button type="button" disabled={custBusy} onClick={handleChangeCustomerEmail} className="flex-1 bg-sky-950 hover:bg-sky-400 hover:text-black text-sky-300 border border-sky-700 font-extrabold py-2 rounded-xl text-[11px] cursor-pointer disabled:opacity-40">
                      {custBusy ? 'Working…' : 'Save new email'}
                    </Button>
                    <Button type="button" disabled={custBusy} onClick={handleSendCustomerReset} className="flex-1 bg-amber-950/40 hover:bg-amber-400 hover:text-black text-amber-300 border border-amber-700/60 font-extrabold py-2 rounded-xl text-[11px] cursor-pointer disabled:opacity-40">
                      Send password reset
                    </Button>
                  </div>
                  <p className="text-[10px] text-emerald-400/80">A verification link goes to the customer's Gmail. Staff never see or set passwords. Changing an email is for administrators only.</p>
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
          const sizes = [5, 10, 15, 5]; // Block 1..4 (Block 5 = Platinum zone, no circles)
          const size = sizes[block - 1] || 0;
          const pos = loyaltyStatus.position_in_block || 0;
          const cum = loyaltyStatus.cumulative_stamps || 0;
          const platExp = loyaltyStatus.platinum_expires_at ? new Date(loyaltyStatus.platinum_expires_at) : null;
          const weekly = loyaltyStatus.weekly;
          const badgeText = tier === 'DIAMOND' ? 'DIAMOND' : tier === 'PLATINUM' ? 'PLATINUM' : `BLOCK ${block}`;
          const badgeSkin = tier === 'DIAMOND' ? 'bg-sky-400/20 text-sky-300 border-sky-400/50' : tier === 'PLATINUM' ? 'bg-slate-200/20 text-slate-100 border-slate-300/50' : 'bg-lime-400/20 text-lime-400 border-lime-400/40';
          const inVip = tier === 'PLATINUM' || tier === 'DIAMOND';
          const base = cum - pos; // stamps that belong to the blocks before this one
          const circleLabels: Record<number, Record<number, string>> = {
            1: { 1: 'WELCOME', 5: '10% OFF' },
            2: { 5: '10% OFF', 10: '25% OFF' },
            3: { 5: '10% OFF', 10: '25% OFF', 15: '50% OFF' },
            4: { 5: 'FREE MEAL' }
          };
          const pendingMode = pendingStamp.slice(0, 2);
          const pendingK = parseInt(pendingStamp.slice(2));
          const applyPending = async () => {
            if (!pendingStamp || isNaN(pendingK)) return;
            setLoyaltyBusy(true);
            let res: any;
            if (pendingMode === 'AD') {
              const delta = pendingK - pos;
              if (delta <= 0) { setLoyaltyBusy(false); setPendingStamp(''); return; }
              res = await supabase.rpc('admin_adjust_stamps', { p_user_id: loyaltyTargetUser.auth_user_id, p_delta: delta, p_reason: null });
            } else {
              res = await supabase.rpc('admin_remove_stamp_to', { p_user_id: loyaltyTargetUser.auth_user_id, p_new_cum: base + pendingK - 1, p_reason: null });
            }
            setLoyaltyBusy(false);
            const d = res.data;
            if (res.error || !d?.success) { alert(res.error?.message || d?.message || 'Stamp change failed.'); }
            else { if (d.voided_vouchers && d.voided_vouchers.length) alert(`Removed. Voided unused voucher(s): ${d.voided_vouchers.join(', ')}`); fetchCloudData(); }
            setPendingStamp('');
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
                <p>Milestone Block: <strong className="text-white">{inVip ? '—' : `${block} of 4`}</strong></p>
                <p>Position in block: <strong className="text-white">{inVip ? 'Stamps paused' : `${pos} / ${size}`}</strong></p>
                <p>Cumulative stamps: <strong className="text-lime-400">{cum} / 35</strong></p>
                <p>Member since: <strong className="text-white">{loyaltyTargetUser.created_at ? new Date(loyaltyTargetUser.created_at).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '—'}</strong></p>
              </div>
              {platExp && <p className="text-[10px] text-slate-300">Platinum 2-week trial until <strong>{platExp.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</strong></p>}
              {weekly && <p className="text-[10px] text-slate-300">This week: <strong>{weekly.qualifying_orders}/3</strong> orders • <strong>{weekly.claims_remaining}/2</strong> 10% vouchers left • free meal {weekly.free_meal_state === 'claimed' ? 'claimed ✓' : weekly.free_meal_state === 'unlocked' ? 'unlocked (not yet claimed)' : 'locked'}</p>}
            </div>

            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Add / Remove Stamps (per circle)</span>
              {inVip ? (
                <p className="text-[11px] text-slate-300 text-center py-3">Stamps are paused while the customer is <strong>{tier}</strong>. Use <em>Set Tier / Milestone Block</em> below to move them back to a block.</p>
              ) : (
              <>
              <p className="text-[10px] text-emerald-300 text-center font-bold uppercase tracking-wider">Block {block} • {size} stamps</p>
              <div className="grid grid-cols-5 gap-x-3 gap-y-3 justify-items-center">
                {Array.from({ length: size }).map((_, idx) => {
                  const k = idx + 1;
                  const filled = k <= pos;
                  const isWelcome = block === 1 && k === 1;
                  const label = (circleLabels[block] || {})[k];
                  const isPending = pendingStamp && pendingK === k;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 w-full">
                      <div className={`size-10 rounded-full flex items-center justify-center border-2 ${filled ? 'bg-lime-400 border-lime-300 text-black shadow-md' : 'bg-transparent border-white/70 text-lime-300'} ${isPending ? 'ring-2 ring-sky-400' : ''}`}>
                        {filled ? <Star className="size-4 fill-black" /> : <span className="text-[10px] font-bold">{k}</span>}
                      </div>
                      <span className={`text-[8px] font-black uppercase tracking-wider min-h-[10px] ${label ? 'text-lime-400' : 'text-transparent'}`}>{label || '-'}</span>
                      {isWelcome ? (
                        <span className="text-[8px] font-black uppercase tracking-wider text-lime-400/80 px-1 py-0.5 rounded bg-black/30 border border-lime-400/30">🔒 Locked</span>
                      ) : (
                        <select value={isPending ? pendingStamp : ''} onChange={(e) => setPendingStamp(e.target.value)} disabled={loyaltyBusy}
                          className="w-full max-w-[92px] bg-[#04140f] border border-emerald-800 rounded-lg px-1 py-0.5 text-[9px] text-emerald-200 font-bold focus:outline-none focus:border-lime-400 cursor-pointer disabled:opacity-40">
                          {filled
                            ? (<><option value="">✓ Stamped</option><option value={'RM' + k}>− Remove to {k - 1}</option></>)
                            : (<><option value="">○ Empty</option><option value={'AD' + k}>＋ Add to {k}</option></>)}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              {pendingStamp && !isNaN(pendingK) && (
                <div className="flex items-center justify-between gap-2 bg-black/30 border border-sky-400/50 rounded-xl p-2.5">
                  <span className="text-[10px] text-sky-200 font-bold">
                    {pendingMode === 'AD' ? `Add ${pendingK - pos} stamp(s) → fill up to circle ${pendingK}` : `Remove ${pos - (pendingK - 1)} stamp(s) → back to circle ${pendingK - 1}`}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <Button onClick={() => setPendingStamp('')} disabled={loyaltyBusy} className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer">Cancel</Button>
                    <Button onClick={applyPending} disabled={loyaltyBusy} className="bg-sky-400 hover:bg-sky-300 text-black font-extrabold px-4 py-1.5 rounded-lg text-[10px] cursor-pointer disabled:opacity-40">Apply</Button>
                  </div>
                </div>
              )}
              <p className="text-[9px] text-emerald-400/80">Pick <em>Add</em> or <em>Remove</em> from a circle's dropdown, then press <strong>Apply</strong>. Circle 1 of Block 1 is the welcome stamp and is <strong>locked</strong>. Crossing a milestone credits its reward (the FREE MEAL voucher is issued automatically). Removing claws a reward back <strong>only if it was unused</strong>; if it was already spent, the removal is refused and the stamp stays valid.</p>
              </>
              )}
            </div>

            <div className="bg-[#061d16] border border-emerald-800/80 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-lime-400">Set Tier / Milestone Block</span>
              <input type="text" value={loyaltyTierReason} onChange={(e) => setLoyaltyTierReason(e.target.value)} placeholder="Reason for tier / block change (required)" className="w-full bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-lime-400" />
              <div className="flex gap-2">
                <select value={loyaltyTier} onChange={(e) => setLoyaltyTier(e.target.value as any)} className="flex-1 bg-[#04140f] border border-emerald-800 rounded-xl p-2 text-xs text-lime-300 font-bold focus:outline-none focus:border-lime-400">
                  <option value="CLEAR">Clear VIP (keep stamps)</option>
                  <option value="B1">Milestone Block 1 (welcome stamp only)</option>
                  <option value="B2">Milestone Block 2 (starts empty)</option>
                  <option value="B3">Milestone Block 3 (starts empty)</option>
                  <option value="B4">Milestone Block 4 (starts empty)</option>
                  <option value="PLATINUM">Platinum (2-week trial)</option>
                  <option value="DIAMOND">Diamond (invitation only)</option>
                </select>
                <Button onClick={handleLoyaltySetTier} disabled={loyaltyBusy} className="bg-sky-400 hover:bg-sky-300 text-black font-extrabold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40">Apply</Button>
              </div>
              <p className="text-[9px] text-emerald-400/80">Has its <strong>own</strong> reason field (separate from stamp add/remove). A <em>Block</em> choice <strong>teleports</strong> the customer to the <strong>start</strong> of that block (all circles empty; only Block 1 keeps its welcome stamp) and clears any VIP — it does <strong>not</strong> fill the block and issues no rewards. To give them the whole block, use <em>Add / Remove Stamps</em> above. <em>Platinum</em> starts a fresh 2-week trial (when it ends the customer returns to Block 2); <em>Diamond</em> is invitation only. Both leave the stamp count untouched.</p>
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
            {remainingBowls === 0 ? 'Fully Booked' : isFullyBooked ? `Closed • ${remainingBowls} unused` : `${remainingBowls} Bowls Left`}
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