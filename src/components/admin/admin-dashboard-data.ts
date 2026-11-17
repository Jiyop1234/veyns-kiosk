// @ts-nocheck
// Step A3: admin data loading and Supabase Realtime, moved unchanged from employee-dashboard.tsx.
// Only the state declarations and the final return are new; the effect and fetchCloudData are the original code.
// Step B3b: customers also carry status, tier, current_stamp_count and block_start; orders carry userId (the customer's auth id) and createdAt for the Users screen.
// Step A5: the 1-second countdown clock (nowTimestamp) moved to admin-promos-tab.tsx, so this hook no longer ticks every second.
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { MENU_GRID, getActivePromoCodes } from '@/lib/menu-data';
import { requestStaffGeocode } from '@/lib/order-geocode';

export function useAdminDashboardData() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [slotCapacities, setSlotCapacities] = useState<any[]>([]);
  const geoTriedRef = useRef<Set<string>>(new Set()); // orders whose map address was already requested this session

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
          userId: o.user_id || null,
          createdAt: o.created_at || null,
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

      // If a loyalty column is missing in the database, the query would fail and the whole customer list would be empty; retry with the original columns so the Users and Vouchers tabs keep working.
      let { data: cloudProfiles, error: profilesErr } = await supabase.from('profiles').select('id,name,identifier,role,created_at,stamps_data,penalty_data,auth_user_id,status,tier,current_stamp_count,block_start');
      if (profilesErr) {
        console.error('profiles query with loyalty columns failed, retrying without them:', profilesErr.message);
        ({ data: cloudProfiles } = await supabase.from('profiles').select('id,name,identifier,role,created_at,stamps_data,penalty_data,auth_user_id'));
      }
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
          return { id: p.id, name: p.name || 'Valued Regular', identifier: p.identifier, type: p.role || 'regular', auth_user_id: p.auth_user_id, created_at: p.created_at, status: p.status === undefined ? undefined : (p.status || 'ACTIVE'), tier: p.tier || null, current_stamp_count: p.current_stamp_count === undefined ? undefined : Number(p.current_stamp_count ?? 0), block_start: !!p.block_start };
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

  return { menuItems, promos, orders, setOrders, customers, slotCapacities, fetchCloudData };
}
