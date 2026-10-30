// @ts-nocheck
// Admin Order Processing: staff places an order on behalf of an existing or newly created customer.
//
// Pricing, promo validation, delivery fee, order numbering and slot reservation are ALL decided by the
// database (RPCs admin_preview_order / admin_place_order -> same engine as customer checkout).
// This component only collects input and displays what the server returns.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, UserPlus, Users, Plus, Minus, Trash2, ShoppingBag, CheckCircle2, AlertTriangle, XCircle, MapPin, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/menu-data';
import { supabase } from '@/lib/supabase';

const TIME_SLOTS = ['12:00 PM - 1:00 PM', '4:00 PM - 5:00 PM', '7:00 PM - 8:00 PM', '10:00 PM - 11:00 PM'];
const STORE_LAT = 10.359511; // display/map centre only; the fee is computed by the database
const STORE_LNG = 123.952739;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const manilaMinutesNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
};
const slotEnded = (dateKey: string, slot: string) => {
  const today = todayManila();
  if (dateKey > today) return false;
  if (dateKey < today) return true;
  const m = /-\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])/.exec(slot);
  if (!m) return false;
  const endMin = ((parseInt(m[1], 10) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + parseInt(m[2], 10);
  return manilaMinutesNow() >= endMin;
};
const newKey = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const card = 'bg-[#051813] border border-emerald-800/60 rounded-2xl p-5 space-y-4 shadow-xl';
const inputCls = 'w-full bg-[#04140f] border border-emerald-800/80 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-emerald-700 focus:outline-none focus:border-lime-400';
const labelCls = 'text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-widest block mb-1';
const limeBtn = 'bg-lime-400 hover:bg-lime-500 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed';
const ghostBtn = 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-40';

const groupVisible = (group: any, selected: Record<string, string[]>) => {
  if (!group.parentOptionIds || group.parentOptionIds.length === 0) return true;
  return group.parentOptionIds.some((pid: string) => Object.values(selected).some((list: any) => list.includes(pid)));
};

export function AdminOrderProcessing({ onOrdersChanged, onViewSales }: { onOrdersChanged?: () => void; onViewSales?: () => void }) {
  // ---------------- customer ----------------
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);
  const [custSearching, setCustSearching] = useState(false);
  const [custError, setCustError] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const searchSeq = useRef(0);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<{ message: string; duplicate?: boolean } | null>(null);
  const [createNotice, setCreateNotice] = useState<{ sent: boolean; error?: string; email: string } | null>(null);
  const [resending, setResending] = useState(false);

  // ---------------- menu ----------------
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [category, setCategory] = useState('All items');
  const [productSearch, setProductSearch] = useState('');

  // ---------------- order lines ----------------
  const [lines, setLines] = useState<any[]>([]);
  const [customizing, setCustomizing] = useState<any>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [customQty, setCustomQty] = useState(1);
  const [optError, setOptError] = useState('');

  // ---------------- order details ----------------
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryOption, setDeliveryOption] = useState<'our' | 'maxim'>('our');
  const [orderType, setOrderType] = useState<'today' | 'reservation'>('today');
  const [dateKey, setDateKey] = useState(todayManila());
  const [slotTime, setSlotTime] = useState('');
  const [slotCaps, setSlotCaps] = useState<any[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [location, setLocation] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const locationTouched = useRef(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const geoSeq = useRef(0);

  // ---------------- promos ----------------
  const [allPromos, setAllPromos] = useState<any[]>([]);
  const [ownedCodes, setOwnedCodes] = useState<string[]>([]);
  const [milestone, setMilestone] = useState<any>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');

  const effectiveDate = orderType === 'today' ? todayManila() : dateKey;

  // ---------------- server preview + submit ----------------
  const [preview, setPreview] = useState<{ loading: boolean; data: any; error: string }>({ loading: false, data: null, error: '' });
  const previewSeq = useRef(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submittingRef = useRef(false);
  const keyRef = useRef<{ sig: string; key: string }>({ sig: '', key: '' });
  const [result, setResult] = useState<any>(null);

  // ======================================================================
  // Data loading
  // ======================================================================
  const loadMenu = async () => {
    setMenuLoading(true);
    setMenuError('');
    const { data, error } = await supabase.from('menu_items').select('*');
    if (error) { setMenuError('Could not load the menu: ' + error.message); setMenuLoading(false); return; }
    const formatted = (data || []).map((m: any) => ({
      id: m.id, name: m.name, category: m.category, description: m.description,
      price: Number(m.price || 0), discountPercent: Number(m.discount_percent || 0),
      isAvailable: m.is_available !== false, image: m.image_url, sortOrder: Number(m.sort_order || 100),
      optionGroups: Array.isArray(m.option_groups) ? m.option_groups : [],
    }));
    formatted.sort((a: any, b: any) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    setMenuItems(formatted);
    setMenuLoading(false);
  };
  useEffect(() => { loadMenu(); }, []);

  // customer search (debounced, stale-response safe, RLS limits this to staff)
  useEffect(() => {
    if (mode !== 'existing') return;
    const q = custQuery.trim().replace(/[%,()*\\]/g, ' ').trim();
    if (q.length < 2) { setCustResults([]); setCustError(''); setCustSearching(false); return; }
    const seq = ++searchSeq.current;
    setCustSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.from('profiles')
        .select('id,name,identifier,auth_user_id')
        .eq('role', 'regular').not('auth_user_id', 'is', null)
        .or(`name.ilike.%${q}%,identifier.ilike.%${q}%`)
        .order('name').limit(10);
      if (seq !== searchSeq.current) return;
      setCustSearching(false);
      if (error) { setCustError('Search failed: ' + error.message); setCustResults([]); return; }
      setCustError('');
      setCustResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery, mode]);

  // promos eligible for the selected customer
  useEffect(() => {
    setSelectedCodes([]); setCodeError(''); setAllPromos([]); setOwnedCodes([]); setMilestone(null);
    if (!customer) return;
    let alive = true;
    (async () => {
      const [promoRes, rewardRes, weeklyRes, milestoneRes] = await Promise.all([
        supabase.from('promos').select('*'),
        supabase.from('loyalty_rewards').select('promo_code').eq('user_id', customer.authUserId).eq('status', 'claimed'),
        supabase.from('platinum_weekly_claims').select('promo_code').eq('user_id', customer.authUserId),
        supabase.rpc('preview_milestone_reward', { p_user_id: customer.authUserId }),
      ]);
      if (!alive) return;
      setAllPromos(promoRes.data || []);
      setOwnedCodes([...(rewardRes.data || []), ...(weeklyRes.data || [])].map((r: any) => String(r.promo_code || '').toUpperCase()).filter(Boolean));
      setMilestone(milestoneRes.data && milestoneRes.data.applies ? milestoneRes.data : null);
    })();
    return () => { alive = false; };
  }, [customer?.authUserId]);

  const promoUsable = (p: any) => {
    const now = Date.now();
    if (p.start_date && new Date(p.start_date).getTime() > now) return false;
    if (Number(p.expiry_duration_ms) > 0 && now > Number(p.created_at) + Number(p.expiry_duration_ms)) return false;
    if (p.usage_limit != null && Number(p.usage_count || 0) >= Number(p.usage_limit)) return false;
    return true;
  };
  const eligiblePromos = useMemo(() => {
    const list = allPromos
      .filter((p: any) => promoUsable(p) && (p.visibility === 'public' || ownedCodes.includes(String(p.code).toUpperCase())))
      .map((p: any) => ({
        code: p.code, type: p.type, value: Number(p.discount_value), target: p.target_type || 'subtotal',
        personal: p.visibility !== 'public',
      }));
    if (milestone) list.push({ code: milestone.code_label, type: 'percentage', value: Number(milestone.discount_value), target: 'subtotal', personal: true, milestone: true });
    return list;
  }, [allPromos, ownedCodes, milestone]);

  // slot capacity for the chosen date
  const loadSlotCaps = async (dk: string) => {
    const { data } = await supabase.from('slot_capacities').select('*').eq('date_key', dk);
    setSlotCaps(data || []);
  };
  useEffect(() => { if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) loadSlotCaps(effectiveDate); }, [effectiveDate]);

  const slotInfo = (slot: string) => {
    const row = slotCaps.find((s: any) => s.slot_time === slot);
    const max = row ? Number(row.max_bowls) : 10;
    const booked = row ? Number(row.booked_bowls) : 0;
    return { remaining: Math.max(0, max - booked), closed: !!row?.is_manually_fully_booked };
  };

  // ======================================================================
  // Order lines
  // ======================================================================
  const categories = useMemo(() => ['All items', ...Array.from(new Set(menuItems.map((m: any) => m.category).filter(Boolean)))], [menuItems]);
  const visibleItems = menuItems.filter((m: any) => {
    if (!m.isAvailable) return false;
    if (category !== 'All items' && m.category !== category) return false;
    const q = productSearch.trim().toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
  });

  const lineKey = (itemId: string, opts: any[]) => itemId + '|' + opts.map((o) => o.groupId + ':' + o.optionId).sort().join(',');
  const estimateUnit = (item: any, opts: any[]) => r2(item.price * (1 - (item.discountPercent || 0) / 100) + opts.reduce((s, o) => s + Number(o.price || 0), 0));

  const addLine = (item: any, qty: number, opts: any[]) => {
    const key = lineKey(item.id, opts);
    const summary = opts.map((o) => (o.price > 0 ? `${o.optionName} (+₱${o.price})` : o.optionName)).join(', ');
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(50, l.qty + qty) } : l));
      return [...prev, { key, item, qty, options: opts, summary }];
    });
  };
  const setLineQty = (key: string, qty: number) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(50, qty)) } : l)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const openItem = (item: any) => {
    if (!item.optionGroups || item.optionGroups.length === 0) { addLine(item, 1, []); return; }
    const init: Record<string, string[]> = {};
    item.optionGroups.forEach((g: any) => {
      const def = (g.options || []).find((o: any) => o.is_default || o.isDefault);
      if (def) init[g.id] = [def.id];
      else if (g.type === 'single' && g.required && g.options && g.options.length > 0) init[g.id] = [g.options[0].id];
      else init[g.id] = [];
    });
    setSelectedOptions(init); setCustomQty(1); setOptError(''); setCustomizing(item);
  };

  const toggleOption = (group: any, optId: string) => {
    setOptError('');
    setSelectedOptions((prev) => {
      const cur = prev[group.id] || [];
      if (group.type === 'single') return { ...prev, [group.id]: cur.includes(optId) && !group.required ? [] : [optId] };
      if (cur.includes(optId)) return { ...prev, [group.id]: cur.filter((x) => x !== optId) };
      if (group.maxSelections && cur.length >= group.maxSelections) { setOptError(`You can choose at most ${group.maxSelections} options for "${group.name}".`); return prev; }
      return { ...prev, [group.id]: [...cur, optId] };
    });
  };

  const confirmCustomization = () => {
    if (!customizing) return;
    const opts: any[] = [];
    for (const group of customizing.optionGroups) {
      if (!groupVisible(group, selectedOptions)) continue;
      const sel = selectedOptions[group.id] || [];
      const minReq = group.required ? Math.max(1, group.minSelections || 0) : (group.minSelections || 0);
      if (sel.length < minReq) { setOptError(`Please make a selection for required group: "${group.name}".`); return; }
      if (group.maxSelections && sel.length > group.maxSelections) { setOptError(`You can choose at most ${group.maxSelections} options for "${group.name}".`); return; }
      (group.options || []).filter((o: any) => sel.includes(o.id)).forEach((o: any) =>
        opts.push({ groupId: group.id, groupName: group.name, optionId: o.id, optionName: o.name, price: Number(o.price || 0) }));
    }
    addLine(customizing, customQty, opts);
    setCustomizing(null);
  };

  // ======================================================================
  // Customer selection / creation
  // ======================================================================
  const chooseCustomer = (c: any, phone = '') => {
    setCustomer({ id: c.id, authUserId: c.auth_user_id || c.authUserId, name: c.name || 'Customer', identifier: c.identifier });
    setContactName(c.name || '');
    setContactEmail(String(c.identifier || '').includes('@') ? c.identifier : '');
    setContactPhone(phone || (String(c.identifier || '').includes('@') ? '' : c.identifier || ''));
    setCustResults([]); setCustQuery('');
  };

  const handleCreateCustomer = async () => {
    setCreateError(null); setCreateNotice(null);
    const name = newName.trim().replace(/\s+/g, ' ');
    const email = newEmail.trim().toLowerCase();
    const phone = newPhone.trim();
    if (name.length < 2) { setCreateError({ message: "Enter the customer's full name." }); return; }
    if (!EMAIL_RE.test(email)) { setCreateError({ message: 'Enter a valid email address.' }); return; }
    if (phone && !PHONE_RE.test(phone)) { setCreateError({ message: 'Enter a valid contact number (digits, +, -, spaces).' }); return; }
    if (creating) return;
    setCreating(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) { setCreateError({ message: 'Your session has expired. Please sign in again.' }); return; }
      const res = await fetch('/api/admin-create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'create', name, email, phone }),
      });
      const body = await res.json().catch(() => null);
      if (!body) {
        setCreateError({ message: res.status === 404 ? 'The account service (/api/admin-create-customer) is not deployed on this site.' : 'Unexpected response from the account service.' });
        return;
      }
      if (!res.ok || !body.ok) { setCreateError({ message: body.error || 'The account could not be created.', duplicate: body.code === 'duplicate_email' }); return; }
      chooseCustomer({ id: body.customer.id, auth_user_id: body.customer.authUserId, name: body.customer.name, identifier: body.customer.identifier }, phone);
      setCreateNotice({ sent: !!body.activationEmailSent, error: body.activationError, email });
      setNewName(''); setNewEmail(''); setNewPhone('');
      onOrdersChanged && onOrdersChanged(); // refreshes the Customer Accounts list too
    } catch (e: any) {
      setCreateError({ message: 'Network error. The account may not have been created; search for the email before retrying.' });
    } finally { setCreating(false); }
  };

  const handleResendActivation = async () => {
    if (!createNotice || resending) return;
    setResending(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token || ''}` },
        body: JSON.stringify({ action: 'resend', email: createNotice.email }),
      });
      const body = await res.json().catch(() => ({}));
      setCreateNotice({ ...createNotice, sent: !!body.ok, error: body.ok ? undefined : body.error || 'Could not send the email.' });
    } finally { setResending(false); }
  };

  // ======================================================================
  // Delivery map (Leaflet, loaded the same way as the customer checkout)
  // ======================================================================
  useEffect(() => {
    if (fulfillment !== 'delivery' || !customer) return;
    let cancelled = false;
    const init = () => {
      const L = (window as any).L;
      if (cancelled || !L || !mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current).setView([STORE_LAT, STORE_LNG], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      map.on('click', (e: any) => setPin({ lat: e.latlng.lat, lng: e.latlng.lng }));
      mapObj.current = map;
      if (pinRef.current) { markerObj.current = L.marker([pinRef.current.lat, pinRef.current.lng]).addTo(map); map.setView([pinRef.current.lat, pinRef.current.lng], 15); }
    };
    if ((window as any).L) { setTimeout(init, 50); }
    else {
      if (!document.getElementById('leaflet-css-admin')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-admin'; link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = init;
      document.body.appendChild(script);
    }
    return () => { cancelled = true; if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; markerObj.current = null; } };
  }, [fulfillment, customer?.authUserId]);

  const pinRef = useRef<any>(null);
  useEffect(() => {
    pinRef.current = pin;
    const L = (window as any).L;
    if (!pin) return;
    if (L && mapObj.current) {
      if (markerObj.current) markerObj.current.setLatLng([pin.lat, pin.lng]);
      else markerObj.current = L.marker([pin.lat, pin.lng]).addTo(mapObj.current);
    }
    if (!locationTouched.current) setLocation(`Lat: ${pin.lat.toFixed(4)}, Lng: ${pin.lng.toFixed(4)}`);
    const seq = ++geoSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pin.lat}&lon=${pin.lng}`);
        if (!res.ok || seq !== geoSeq.current || locationTouched.current) return;
        const d = await res.json();
        if (d && d.display_name) setLocation(d.display_name);
      } catch { /* keep the Lat/Lng text */ }
    }, 600);
    return () => clearTimeout(t);
  }, [pin]);

  // ======================================================================
  // Payload, server preview, validation
  // ======================================================================
  const payload = useMemo(() => customer ? ({
    customerUserId: customer.authUserId,
    name: contactName.trim(), phone: contactPhone.trim(), email: contactEmail.trim(),
    fulfillment, deliveryOption, orderType, dateKey: effectiveDate, slotTime,
    location: location.trim(), landmark: landmark.trim(),
    deliveryLat: fulfillment === 'delivery' && pin ? pin.lat : null,
    deliveryLng: fulfillment === 'delivery' && pin ? pin.lng : null,
    promoCodesList: selectedCodes,
    items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty, options: l.options.map((o: any) => ({ groupId: o.groupId, optionId: o.optionId })) })),
  }) : null, [customer, contactName, contactPhone, contactEmail, fulfillment, deliveryOption, orderType, effectiveDate, slotTime, location, landmark, pin, selectedCodes, lines]);

  const pricingSig = payload ? JSON.stringify({ c: payload.customerUserId, f: payload.fulfillment, la: payload.deliveryLat, ln: payload.deliveryLng, p: payload.promoCodesList, i: payload.items }) : '';
  useEffect(() => {
    if (!payload || lines.length === 0) { setPreview({ loading: false, data: null, error: '' }); return; }
    const seq = ++previewSeq.current;
    setPreview((p) => ({ ...p, loading: true, error: '' }));
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('admin_preview_order', { p_order: payload });
      if (seq !== previewSeq.current) return;
      if (error) setPreview({ loading: false, data: null, error: error.message });
      else setPreview({ loading: false, data, error: '' });
    }, 350);
    return () => clearTimeout(t);
  }, [pricingSig]);

  const bowlCount = lines.reduce((s, l) => s + l.qty, 0);
  const issues: string[] = [];
  if (!customer) issues.push('Select or create a customer.');
  if (lines.length === 0) issues.push('Add at least one item.');
  if (!contactName.trim()) issues.push('Customer name is required.');
  if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim())) issues.push('Contact email is not valid.');
  if (fulfillment === 'delivery') {
    if (!contactPhone.trim()) issues.push('Contact number is required for delivery.');
    else if (!PHONE_RE.test(contactPhone.trim())) issues.push('Contact number is not valid.');
    if (!pin) issues.push('Drop the delivery pin on the map.');
    if (!location.trim()) issues.push('Delivery address is required.');
    if (!landmark.trim()) issues.push('Nearest landmark is required.');
  }
  if (orderType === 'reservation' && effectiveDate < todayManila()) issues.push('Choose a date that is not in the past.');
  if (!slotTime) issues.push('Choose a time slot.');
  else if (slotEnded(effectiveDate, slotTime)) issues.push('The chosen time slot has already ended.');
  else {
    const si = slotInfo(slotTime);
    if (si.closed) issues.push('That slot was closed by the administrator.');
    else if (bowlCount > si.remaining) issues.push(`Only ${si.remaining} bowl(s) left in that slot.`);
  }
  if (preview.error) issues.push(preview.error);
  if (lines.length > 0 && !preview.data && !preview.error) issues.push('Calculating the total…');
  const canProcess = issues.length === 0 && !preview.loading && !submitting;

  const toggleCode = (code: string) => { setCodeError(''); setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])); };
  const applyTypedCode = () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    if (selectedCodes.some((c) => c.toUpperCase() === code)) { setCodeError('This code is already applied.'); return; }
    const found = allPromos.find((p: any) => String(p.code).toUpperCase() === code);
    if (!found) { setCodeError('Invalid promo code.'); return; }
    if (!promoUsable(found)) { setCodeError('This code is expired, not started yet, or fully used.'); return; }
    setSelectedCodes((prev) => [...prev, found.code]); setCodeInput(''); setCodeError('');
  };

  // ======================================================================
  // Submit
  // ======================================================================
  const getIdempotencyKey = (p: any) => {
    const sig = JSON.stringify(p);
    if (keyRef.current.sig !== sig) keyRef.current = { sig, key: newKey() }; // changed order => new key; identical retry => same key
    return keyRef.current.key;
  };

  const handleProcess = async () => {
    if (submittingRef.current || !payload) return; // double-click guard
    submittingRef.current = true; setSubmitting(true); setSubmitError('');
    try {
      const { data, error } = await supabase.rpc('admin_place_order', { p_order: { ...payload, idempotencyKey: getIdempotencyKey(payload) } });
      if (error) throw new Error(error.message);
      if (!data || !data.id || !data.order_number) throw new Error('The server did not confirm a saved order. Nothing was recorded; please check Sales Analytics before retrying.');
      // read the order back from the database before claiming success
      const { data: saved, error: readErr } = await supabase.from('orders')
        .select('id,order_number,user_id,customer_name,items,subtotal,promo_code,promo_discount,delivery_fee,delivery_discount,total,created_at,schedule_info')
        .eq('id', data.id).maybeSingle();
      setResult({ order: saved || data, verified: !readErr && !!saved && saved.user_id === customer.authUserId, duplicate: !!data.duplicate, customerName: customer.name });
      setConfirmOpen(false);
      onOrdersChanged && onOrdersChanged();
    } catch (e: any) {
      const msg = String(e?.message || 'Order could not be saved.');
      setSubmitError(/not authorized/i.test(msg) ? 'You do not have permission to process orders.' : msg);
    } finally { submittingRef.current = false; setSubmitting(false); }
  };

  const resetAll = () => {
    setResult(null); setCustomer(null); setLines([]); setSelectedCodes([]); setPin(null); setLocation(''); setLandmark('');
    locationTouched.current = false; setSlotTime(''); setOrderType('today'); setDateKey(todayManila());
    setContactName(''); setContactPhone(''); setContactEmail(''); setCreateNotice(null); setCreateError(null);
    setSubmitError(''); setConfirmOpen(false); keyRef.current = { sig: '', key: '' }; setMode('existing');
    loadMenu();
  };

  // ======================================================================
  // Render helpers
  // ======================================================================
  const pv = preview.data;
  const unitFor = (idx: number, l: any) => (pv && pv.items && pv.items[idx] ? Number(pv.items[idx].unitPrice) : estimateUnit(l.item, l.options));
  const money = (n: any) => formatPeso(Number(n || 0));
  const scheduleText = orderType === 'reservation' ? `Reservation on ${effectiveDate} (${slotTime || '—'})` : `Today (${slotTime || '—'})`;

  if (result) {
    const o = result.order;
    return (
      <div className={card + ' max-w-2xl mx-auto'}>
        {result.verified ? (
          <div className="flex items-start gap-3"><CheckCircle2 className="h-6 w-6 text-lime-400 shrink-0" />
            <div><p className="font-display text-lg font-extrabold text-white">{result.duplicate ? 'Order already saved' : 'Order processed'}</p>
              <p className="text-xs text-emerald-300">{result.duplicate ? 'This was a repeated submission, so the existing order is shown. No second order was created.' : 'Saved in the database and visible in Sales Analytics.'}</p></div></div>
        ) : (
          <div className="flex items-start gap-3"><AlertTriangle className="h-6 w-6 text-amber-400 shrink-0" />
            <div><p className="font-display text-lg font-extrabold text-white">Order accepted, but could not be re-verified</p>
              <p className="text-xs text-amber-300">The server returned an order number but the follow-up read failed. Check Sales Analytics for {o.order_number} before processing anything again.</p></div></div>
        )}
        <div className="bg-[#04140f] border border-emerald-800/60 rounded-xl p-4 text-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-emerald-400">Order #</span><span className="font-extrabold text-lime-400">{o.order_number}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Customer</span><span className="font-bold text-white">{result.customerName}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Food subtotal</span><span className="text-white">{money(o.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Promo</span><span className="text-amber-400 font-bold">{o.promo_code || 'NA'}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400">Delivery fee</span><span className="text-white">{money(o.delivery_fee)}</span></div>
          <div className="flex justify-between border-t border-emerald-900/60 pt-1.5"><span className="font-extrabold text-white">Total</span><span className="font-extrabold text-lime-400 text-sm">{money(o.total)}</span></div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button type="button" onClick={resetAll} className={limeBtn}>Process another order</Button>
          {onViewSales && <Button type="button" onClick={onViewSales} className={ghostBtn}>View in Sales Analytics</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* ---------------- 1. customer ---------------- */}
        <div className={card}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2"><Users className="h-4 w-4 text-lime-400" /> 1. Customer</h2>
            {customer && <Button type="button" onClick={() => { setCustomer(null); setCreateNotice(null); }} className={ghostBtn}>Change customer</Button>}
          </div>

          {customer ? (
            <div className="space-y-3">
              <div className="bg-[#04140f] border border-lime-400/40 rounded-xl p-3 flex items-center justify-between gap-3">
                <div><p className="text-sm font-extrabold text-white">{customer.name}</p><p className="text-[11px] text-emerald-300">{customer.identifier}</p></div>
                <span className="text-[9px] uppercase bg-emerald-900/60 text-lime-300 px-2 py-1 rounded font-extrabold">Selected</span>
              </div>
              {createNotice && (
                <div className={`rounded-xl border p-3 text-xs space-y-2 ${createNotice.sent ? 'border-lime-400/40 bg-lime-400/5 text-lime-200' : 'border-amber-500/50 bg-amber-500/10 text-amber-200'}`}>
                  <p className="font-bold">{createNotice.sent ? `Account created. A password-setup email was sent to ${createNotice.email}.` : 'Account created, but the password-setup email could not be sent.'}</p>
                  {!createNotice.sent && <p>{createNotice.error}</p>}
                  <p className="text-[11px] opacity-80">You can process the order now. The customer sets their own password from the email link; no password is ever shown to staff.</p>
                  {!createNotice.sent && <Button type="button" disabled={resending} onClick={handleResendActivation} className={ghostBtn}>{resending ? 'Sending…' : 'Resend activation email'}</Button>}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode('existing')} className={`px-3 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer ${mode === 'existing' ? 'bg-lime-400 text-black' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}><Search className="h-4 w-4" /> Existing customer</button>
                <button type="button" onClick={() => setMode('new')} className={`px-3 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer ${mode === 'new' ? 'bg-lime-400 text-black' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}><UserPlus className="h-4 w-4" /> Create new customer</button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-2">
                  <input value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Search by name or email (min. 2 characters)" className={inputCls} />
                  {custSearching && <p className="text-[11px] text-emerald-400">Searching…</p>}
                  {custError && <p className="text-[11px] text-red-400">{custError}</p>}
                  {!custSearching && !custError && custQuery.trim().length >= 2 && custResults.length === 0 && (
                    <div className="text-center py-4 space-y-2"><p className="text-xs text-emerald-300/80">No registered customer matches “{custQuery.trim()}”.</p>
                      <Button type="button" onClick={() => { setMode('new'); if (EMAIL_RE.test(custQuery.trim())) setNewEmail(custQuery.trim()); else setNewName(custQuery.trim()); }} className={ghostBtn}>Create a new customer</Button></div>
                  )}
                  <div className="space-y-1.5">
                    {custResults.map((c) => (
                      <button key={c.id} type="button" onClick={() => chooseCustomer(c)} className="w-full text-left bg-[#04140f] hover:border-lime-400/60 border border-emerald-800/60 rounded-xl p-3 cursor-pointer">
                        <span className="block text-xs font-extrabold text-white">{c.name || 'Valued Regular'}</span>
                        <span className="block text-[11px] text-emerald-300">{c.identifier}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={labelCls}>Full name *</label><input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} placeholder="Juan Dela Cruz" /></div>
                    <div><label className={labelCls}>Email *</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} placeholder="name@example.com" /></div>
                    <div className="sm:col-span-2"><label className={labelCls}>Contact number</label><input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputCls} placeholder="09XX XXX XXXX" /></div>
                  </div>
                  {createError && (
                    <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200 space-y-2"><p className="flex items-start gap-2"><XCircle className="h-4 w-4 shrink-0" />{createError.message}</p>
                      {createError.duplicate && <Button type="button" onClick={() => { setMode('existing'); setCustQuery(newEmail.trim()); setCreateError(null); }} className={ghostBtn}>Search for this customer</Button>}</div>
                  )}
                  <p className="text-[11px] text-emerald-400/80">An activation email lets the customer set their own password. No password is generated or shown.</p>
                  <Button type="button" disabled={creating} onClick={handleCreateCustomer} className={limeBtn}>{creating ? 'Creating account…' : 'Create account & select'}</Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ---------------- 2. products ---------------- */}
        <div className={card}>
          <h2 className="font-display text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-lime-400" /> 2. Items</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search menu…" className={inputCls} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-[#04140f] border border-emerald-800 rounded-xl px-3 py-2 text-xs text-lime-300 font-bold focus:outline-none">
              {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {menuLoading && <p className="text-xs text-emerald-400">Loading menu…</p>}
          {menuError && <p className="text-xs text-red-400">{menuError}</p>}
          {!menuLoading && !menuError && visibleItems.length === 0 && <p className="text-center text-xs text-emerald-300/80 py-6">No available menu items match your search.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {visibleItems.map((m: any) => (
              <button key={m.id} type="button" onClick={() => openItem(m)} className="text-left bg-[#04140f] hover:border-lime-400/60 border border-emerald-800/60 rounded-xl p-3 flex gap-3 cursor-pointer">
                {m.image ? <img src={m.image} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-white truncate">{m.name}</span>
                  <span className="block text-[10px] text-emerald-400">{m.category}{m.optionGroups.length > 0 ? ' • customizable' : ''}</span>
                  <span className="block text-xs font-extrabold text-lime-400">
                    {m.discountPercent > 0 && <span className="line-through text-emerald-600 mr-1.5">{money(m.price)}</span>}
                    {money(r2(m.price * (1 - m.discountPercent / 100)))}
                  </span>
                </span>
                <Plus className="h-4 w-4 text-lime-400 shrink-0 self-center" />
              </button>
            ))}
          </div>
        </div>

        {/* ---------------- 3. details ---------------- */}
        <div className={card}>
          <h2 className="font-display text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2"><MapPin className="h-4 w-4 text-lime-400" /> 3. Fulfillment & schedule</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['delivery', 'pickup'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFulfillment(f)} className={`px-3 py-2.5 rounded-xl text-xs font-extrabold uppercase cursor-pointer ${fulfillment === f ? 'bg-lime-400 text-black' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>{f}</button>
            ))}
          </div>
          {fulfillment === 'delivery' && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeliveryOption('our')} className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer ${deliveryOption === 'our' ? 'bg-emerald-800 text-white border border-lime-400/60' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>Personal delivery</button>
              <button type="button" onClick={() => setDeliveryOption('maxim')} className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer ${deliveryOption === 'maxim' ? 'bg-emerald-800 text-white border border-lime-400/60' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>Maxim delivery</button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOrderType('today')} className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer ${orderType === 'today' ? 'bg-emerald-800 text-white border border-lime-400/60' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>⚡ Order today</button>
            <button type="button" onClick={() => setOrderType('reservation')} className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer ${orderType === 'reservation' ? 'bg-emerald-800 text-white border border-lime-400/60' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>📅 Reservation</button>
          </div>
          {orderType === 'reservation' && (
            <div><label className={labelCls}>Reservation date</label><input type="date" min={todayManila()} value={dateKey} onChange={(e) => setDateKey(e.target.value)} className={inputCls} /></div>
          )}
          <div>
            <label className={labelCls}>Time slot (reserves bowls)</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((s) => {
                const si = slotInfo(s); const ended = slotEnded(effectiveDate, s); const full = si.closed || si.remaining < 1; const disabled = ended || full;
                return (
                  <button key={s} type="button" disabled={disabled} onClick={() => setSlotTime(s)} className={`px-3 py-2 rounded-xl text-[11px] font-bold text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${slotTime === s ? 'bg-lime-400 text-black' : 'bg-[#061c16] text-emerald-200 border border-emerald-800/60'}`}>
                    {s}<span className="block text-[10px] font-medium opacity-80">{ended ? 'Slot ended' : si.closed ? 'Closed' : full ? 'Fully booked' : `${si.remaining} bowls left`}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-900/60">
            <div><label className={labelCls}>Contact name *</label><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Contact number {fulfillment === 'delivery' ? '*' : ''}</label><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Contact email</label><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} /></div>
          </div>
          {fulfillment === 'delivery' && (
            <div className="space-y-3">
              <div><label className={labelCls}>Delivery pin * (click the map)</label>
                <div ref={mapRef} className="h-64 w-full rounded-xl overflow-hidden border border-emerald-800/60 bg-[#04140f] z-0" />
                <p className="text-[11px] mt-1 text-emerald-400">{pin ? `Pinned: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}${pv && pv.distanceKm != null ? ` • ${pv.distanceKm} km from store` : ''}` : 'No pin yet.'}</p></div>
              <div><label className={labelCls}>Delivery address *</label><input value={location} onChange={(e) => { locationTouched.current = true; setLocation(e.target.value); }} className={inputCls} /></div>
              <div><label className={labelCls}>Nearest landmark *</label><input value={landmark} onChange={(e) => setLandmark(e.target.value)} className={inputCls} /></div>
            </div>
          )}
        </div>

        {/* ---------------- 4. promos ---------------- */}
        <div className={card}>
          <h2 className="font-display text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-2"><Ticket className="h-4 w-4 text-lime-400" /> 4. Promotions & vouchers</h2>
          {!customer ? <p className="text-xs text-emerald-300/70">Select a customer to see their eligible promotions.</p> : (
            <>
              {eligiblePromos.length === 0 && <p className="text-xs text-emerald-300/70">No promotions are currently available for this customer.</p>}
              <div className="flex flex-wrap gap-2">
                {eligiblePromos.map((p: any) => {
                  const on = selectedCodes.includes(p.code);
                  return (
                    <button key={p.code} type="button" onClick={() => toggleCode(p.code)} className={`px-3 py-2 rounded-xl text-[11px] font-extrabold text-left cursor-pointer border ${on ? 'bg-amber-400 text-black border-amber-300' : 'bg-[#061c16] text-amber-300 border-amber-700/50'}`}>
                      {p.code}
                      <span className="block text-[10px] font-medium opacity-80">{p.type === 'percentage' ? `${p.value}%` : formatPeso(p.value)} off {p.target === 'delivery' ? 'delivery' : 'food'}{p.personal ? ' • personal' : ''}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyTypedCode(); }} placeholder="Have a code? Type it here" className={inputCls + ' uppercase placeholder:normal-case'} />
                <Button type="button" onClick={applyTypedCode} className={ghostBtn}>Apply</Button>
              </div>
              {codeError && <p className="text-[11px] text-red-400">{codeError}</p>}
              <p className="text-[11px] text-emerald-400/70">Eligibility, expiry, usage limits and stacking are validated by the same server rules as customer checkout.</p>
            </>
          )}
        </div>
      </div>

      {/* ---------------- summary ---------------- */}
      <div className="lg:col-span-1">
        <div className={card + ' lg:sticky lg:top-4'}>
          <h2 className="font-display text-sm font-extrabold text-white uppercase tracking-wide">Order summary</h2>
          {lines.length === 0 ? <p className="text-center text-xs text-emerald-300/70 py-6">No items added yet.</p> : (
            <div className="space-y-2">
              {lines.map((l, idx) => {
                const unit = unitFor(idx, l);
                return (
                  <div key={l.key} className="bg-[#04140f] border border-emerald-800/60 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between gap-2"><span className="text-xs font-extrabold text-white">{l.item.name}</span>
                      <button type="button" onClick={() => removeLine(l.key)} className="text-red-400 hover:text-red-300 cursor-pointer" aria-label="Remove item"><Trash2 className="h-3.5 w-3.5" /></button></div>
                    {l.summary && <p className="text-[10px] text-lime-300 font-mono">↳ {l.summary}</p>}
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setLineQty(l.key, l.qty - 1)} disabled={l.qty <= 1} className="p-1 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 disabled:opacity-30 cursor-pointer"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center font-extrabold text-white">{l.qty}</span>
                        <button type="button" onClick={() => setLineQty(l.key, l.qty + 1)} className="p-1 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 cursor-pointer"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="text-emerald-300">{money(unit)} each</span>
                      <span className="font-extrabold text-lime-400">{money(r2(unit * l.qty))}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {lines.length > 0 && (
            <div className="text-xs space-y-1.5 border-t border-emerald-900/60 pt-3">
              <div className="flex justify-between"><span className="text-emerald-400">Food subtotal</span><span className="text-white">{pv ? money(pv.subtotal) : '…'}</span></div>
              <div className="flex justify-between"><span className="text-emerald-400">Promo{pv && pv.appliedCodes ? ` (${pv.appliedCodes})` : ''}</span>
                <span className="text-amber-400 font-bold">{pv ? (pv.appliedCodes ? `−${money(Number(pv.foodDiscount) + Number(pv.deliveryDiscount))}` : 'NA') : '…'}</span></div>
              {fulfillment === 'delivery' && <div className="flex justify-between"><span className="text-emerald-400">Delivery fee{pv && pv.distanceKm != null ? ` (${pv.distanceKm} km)` : ''}</span><span className="text-white">{pv ? (pv.deliveryPinSet ? money(pv.deliveryFee) : 'Pin required') : '…'}</span></div>}
              <div className="flex justify-between border-t border-emerald-900/60 pt-2"><span className="font-extrabold text-white">Total</span><span className="font-extrabold text-lime-400 text-lg">{pv ? money(pv.total) : '…'}</span></div>
              <p className="text-[10px] text-emerald-500">{preview.loading ? 'Recalculating on the server…' : 'Totals are calculated by the server, using the same rules as customer checkout.'}</p>
            </div>
          )}

          {issues.length > 0 && lines.length + (customer ? 1 : 0) > 0 && (
            <ul className="text-[11px] text-amber-300 space-y-1 border-t border-emerald-900/60 pt-3">
              {issues.slice(0, 4).map((m, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />{m}</li>)}
            </ul>
          )}
          <Button type="button" disabled={!canProcess} onClick={() => { setSubmitError(''); setConfirmOpen(true); }} className={limeBtn + ' w-full py-3'}>Process order</Button>
        </div>
      </div>

      {/* ---------------- customization dialog ---------------- */}
      <Dialog open={!!customizing} onOpenChange={(open) => !open && setCustomizing(null)}>
        <DialogContent className="max-w-md w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[85vh] overflow-y-auto">
          {customizing && (
            <>
              <DialogTitle className="font-display text-lg font-extrabold text-white">{customizing.name}</DialogTitle>
              <DialogDescription className="text-xs text-emerald-300">Choose the customer's options.</DialogDescription>
              <div className="space-y-4 mt-3">
                {customizing.optionGroups.filter((g: any) => groupVisible(g, selectedOptions)).map((g: any) => (
                  <div key={g.id} className="space-y-2">
                    <p className="text-[11px] font-extrabold text-emerald-200 uppercase">{g.name} {g.required && <span className="text-lime-400">• required</span>}{g.maxSelections ? <span className="text-emerald-500"> • max {g.maxSelections}</span> : null}</p>
                    <div className="flex flex-wrap gap-2">
                      {(g.options || []).map((o: any) => {
                        const on = (selectedOptions[g.id] || []).includes(o.id);
                        return <button key={o.id} type="button" onClick={() => toggleOption(g, o.id)} className={`px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer border ${on ? 'bg-lime-400 text-black border-lime-300' : 'bg-[#061c16] text-emerald-200 border-emerald-800/60'}`}>{o.name}{Number(o.price) > 0 ? ` +₱${o.price}` : ''}</button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {optError && <p className="text-xs text-red-400 mt-3">{optError}</p>}
              <div className="flex items-center justify-between mt-5 pt-3 border-t border-emerald-900/60">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCustomQty((q) => Math.max(1, q - 1))} className="p-1.5 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="w-6 text-center font-extrabold">{customQty}</span>
                  <button type="button" onClick={() => setCustomQty((q) => Math.min(50, q + 1))} className="p-1.5 rounded bg-[#061d16] border border-emerald-800 text-emerald-300 cursor-pointer"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <Button type="button" onClick={confirmCustomization} className={limeBtn}>Add to order</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- confirmation dialog ---------------- */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open && !submitting) setConfirmOpen(false); }}>
        <DialogContent className="max-w-lg w-full bg-[#03120d] text-white border border-emerald-900/80 shadow-2xl p-6 rounded-3xl max-h-[88vh] overflow-y-auto">
          <DialogTitle className="font-display text-lg font-extrabold text-white">Confirm order</DialogTitle>
          <DialogDescription className="text-xs text-emerald-300">Review everything before it is saved. This creates a real order.</DialogDescription>
          {customer && pv && (
            <div className="space-y-3 mt-3 text-xs">
              <div className="bg-[#04140f] border border-emerald-800/60 rounded-xl p-3 space-y-1">
                <p className="font-extrabold text-white">{customer.name} <span className="font-normal text-emerald-400">({customer.identifier})</span></p>
                <p className="text-emerald-300">{contactName}{contactPhone ? ` • ${contactPhone}` : ''}{contactEmail ? ` • ${contactEmail}` : ''}</p>
                <p className="text-emerald-300 uppercase font-bold">{fulfillment} • {scheduleText}</p>
                {fulfillment === 'delivery' && <p className="text-emerald-300">{location} <span className="text-emerald-500">(Landmark: {landmark})</span></p>}
              </div>
              <div className="space-y-1">
                {lines.map((l, idx) => (
                  <div key={l.key} className="flex justify-between gap-3"><span className="text-emerald-100">{l.qty}× {l.item.name}{l.summary ? <span className="block text-[10px] text-lime-300 font-mono">↳ {l.summary}</span> : null}</span><span className="font-bold text-white">{money(r2(unitFor(idx, l) * l.qty))}</span></div>
                ))}
              </div>
              <div className="border-t border-emerald-900/60 pt-2 space-y-1">
                <div className="flex justify-between"><span className="text-emerald-400">Food subtotal</span><span>{money(pv.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-emerald-400">Promo</span><span className="text-amber-400 font-bold">{pv.appliedCodes ? `${pv.appliedCodes} (−${money(Number(pv.foodDiscount) + Number(pv.deliveryDiscount))})` : 'NA'}</span></div>
                {fulfillment === 'delivery' && <div className="flex justify-between"><span className="text-emerald-400">Delivery fee</span><span>{money(pv.deliveryFee)}</span></div>}
                <div className="flex justify-between text-sm pt-1"><span className="font-extrabold">Total</span><span className="font-extrabold text-lime-400">{money(pv.total)}</span></div>
              </div>
              <p className="text-[11px] text-emerald-400">Payment: Cash on pickup / delivery (existing workflow).</p>
            </div>
          )}
          {submitError && <div className="mt-3 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200 flex gap-2"><XCircle className="h-4 w-4 shrink-0" /><span>{submitError} <span className="block opacity-80 mt-1">Nothing was saved. You can fix the problem and press Confirm again; repeated clicks cannot create duplicate orders.</span></span></div>}
          <div className="flex gap-2 mt-5">
            <Button type="button" disabled={submitting} onClick={() => setConfirmOpen(false)} className={ghostBtn + ' flex-1'}>Go back</Button>
            <Button type="button" disabled={submitting} onClick={handleProcess} className={limeBtn + ' flex-1'}>{submitting ? 'Saving order…' : 'Confirm & process order'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminOrderProcessing;