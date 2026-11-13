// @ts-nocheck
// SECTION 1: Imports for React, UI components, menu data, cart state, and Supabase.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, Camera, Check, CreditCard, Facebook, Instagram, MapPin, Minus, Plus, Search, ShoppingBag, Star, Trash2, Truck, User, History, Award, AlertTriangle, XCircle, Clock, Navigation, Calendar, UserPlus, Ticket, X, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MENU_GRID, UPSELL_ITEMS, CATEGORIES, formatPeso, getActivePromoCodes } from '@/lib/menu-data';
import { getPromoStatus, getPromoEndMs } from '@/lib/promo-campaigns';
import { menuImages } from '@/lib/menu-images';
import { useCart } from '@/lib/cart';
import { getOrderHistoryStorageKey } from '@/components/store/profile-page';
import { LoyaltyCard } from '@/components/store/loyalty-card';
import { MenuPage } from '@/components/store/menu-page';
import { Checkout } from '@/components/store/checkout';
import { supabase } from '@/lib/supabase';
import { requestCustomerGeocode } from '@/lib/order-geocode';
import { useTimeSlots, slotHasEnded, slotOrderBlock, isStoreOpenNow, todayKeyManila, useMinuteTick, STORE_OPEN_LABEL } from '@/lib/time-slots';

// SECTION 3: Main ordering experience, including menu browsing, checkout, order history, and loyalty UI.
export function OrderingCounter({ orderHistory, setOrderHistory, resetKey, currentUser, onOrderPlacedSuccess, onOpenRegister, onOpenExtras }: any) {
  // SECTION 4: Cart access and local state for menu browsing, promotions, loyalty, and slot availability.
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [fairPlayPenalty, setFairPlayPenalty] = useState<any>(null);

  // SECTION 5: Customer type and ordering-time eligibility checks.
  const isGuest = !currentUser || currentUser.role === 'guest' || (currentUser.name && currentUser.name.toLowerCase().includes('guest')) || (currentUser.identifier && currentUser.identifier.toLowerCase().includes('guest'));

  // --- Phase 3: Milestone loyalty status, wallet claiming, Platinum weekly claims ---
  const [loyaltyStatus, setLoyaltyStatus] = useState<any>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const loadLoyaltyStatus = async (notify = false) => {
    if (!currentUser || isGuest || !currentUser.authUserId) { setLoyaltyStatus(null); return; }
    setLoyaltyLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_loyalty_status', { p_user_id: currentUser.authUserId });
      if (!error && data) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('auth_user_id', currentUser.authUserId)
          .maybeSingle();
        const next = { ...data, member_since: prof?.created_at || null };
        if (notify) {
          if (next.weekly?.free_meal_state === 'unlocked' && loyaltyStatus?.weekly?.free_meal_state !== 'unlocked') {
            alert('🎉 FREE MEAL unlocked! Open your Loyalty Card and tap the gift circle to claim your reward.');
          }
          const prevCodes = (loyaltyStatus?.rewards || []).map((r: any) => r.promo_code).filter(Boolean);
          (next.rewards || []).forEach((r: any) => {
            if (r.promo_code && !prevCodes.includes(r.promo_code)) {
              alert(`🎉 You earned a ${String(r.reward_type).replace(/_/g, ' ')} voucher: ${r.promo_code} — type it at checkout! (single-use, 14 days)`);
            }
          });
        }
        setLoyaltyStatus(next);
      }
    } catch (e) { console.error('Loyalty status load failed:', e); }
    setLoyaltyLoading(false);
  };

  useEffect(() => { if (showLoyaltyModal) loadLoyaltyStatus(); }, [showLoyaltyModal]);
  const handleClaimReward = async (rewardId: string) => {
    const { data, error } = await supabase.rpc('claim_loyalty_reward', { p_reward_id: rewardId });
    if (error || !data?.success) { alert(error?.message || data?.message || 'Unable to claim reward.'); return; }
    alert(`Reward claimed! Voucher code: ${data.promo_code} (single-use, valid 7 days). It appears in your checkout voucher list.`);
    await loadLoyaltyStatus();
    await loadPromosFromCloud();
  };
  const handleClaimPlatinumDiscount = async (target: 'subtotal' | 'delivery' = 'subtotal') => {
    const { data, error } = await supabase.rpc('claim_platinum_weekly_discount', { p_target: target });
    if (error || !data?.success) { alert(error?.message || data?.message || 'No 10% voucher left this week.'); return; }
    alert(`Your Platinum 10% code for ${data.target === 'delivery' ? 'DELIVERY FEE' : 'FOOD'}: ${data.promo_code} — single-use, valid until Monday 12:00 AM (${data.claims_remaining} voucher(s) left this week).`);
    await loadLoyaltyStatus();
    await loadPromosFromCloud();
  };

  // --- Phase 3c: alert the customer when a new voucher (free meal) is earned ---
  const [prevOrderCount, setPrevOrderCount] = useState(orderHistory.length);
  useEffect(() => {
    if (orderHistory.length > prevOrderCount) { void loadLoyaltyStatus(true); }
    setPrevOrderCount(orderHistory.length);
  }, [orderHistory.length]);


  // SECTION 6: Load scheduling capacity, promotions, loyalty information, and menu configuration.
  // Real-time voucher expiry ticker & auto-purge task
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNowTimestamp(current);
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
          perPersonLimit: p.per_person_limit === null || p.per_person_limit === undefined ? null : Number(p.per_person_limit),
          createdAt: Number(p.created_at || Date.now()),
          name: p.name || '',
          description: p.description || '',
          startDate: p.start_date ? Date.parse(p.start_date) : null,
          expiresAt: p.expires_at ? Date.parse(p.expires_at) : null,
          minPurchase: Number(p.min_purchase || 0),
          isEnabled: p.is_enabled !== false
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

  // SECTION 8: Initial data loading, Supabase Realtime subscriptions, storage updates, and cleanup.
  useEffect(() => {
    if (typeof loadUserStampsAndPenalties === 'function') loadUserStampsAndPenalties();
    if (typeof loadPromosFromCloud === 'function') loadPromosFromCloud();

    const promosChannel = supabase
      .channel('public_promos_counter_' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, () => {
        loadPromosFromCloud();
      });
    promosChannel.subscribe();

    const handleStorageChange = () => {
      loadUserStampsAndPenalties();
      loadPromosFromCloud();
    };
    window.addEventListener('storage', handleStorageChange);
    const promoRefreshTimer = setInterval(() => loadPromosFromCloud(), 60000);

    return () => {
      clearInterval(promoRefreshTimer);
      supabase.removeChannel(promosChannel);
    };
  }, []);

  // Checkout open flag. The menu's "Review my order" button and the header reset both go through here.
  const [showCheckout, setShowCheckout] = useState(false);
  const handleReviewOrder = () => {
    setShowCheckout(true);
  };
  useEffect(() => {
    if (resetKey !== undefined) {
      setShowCheckout(false);
    }
  }, [resetKey]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* SECTIONS 23, 24, 27, 28: menu search, categories, item cards, customization modal and upsells — moved to store/menu-page.tsx */}
      <MenuPage
        resetKey={resetKey}
        isGuest={isGuest}
        loyaltyStatus={loyaltyStatus}
        onOpenRegister={onOpenRegister}
        onOpenLoyalty={() => { loadUserStampsAndPenalties(); setShowLoyaltyModal(true); }}
        onOpenExtras={onOpenExtras}
        onReviewOrder={handleReviewOrder}
      />

      {/* SECTION 25: Milestone Loyalty Card — moved to store/loyalty-card.tsx */}
      <LoyaltyCard
        open={showLoyaltyModal}
        onOpenChange={setShowLoyaltyModal}
        loyaltyStatus={loyaltyStatus}
        loyaltyLoading={loyaltyLoading}
        stamps={stamps}
        nowTimestamp={nowTimestamp}
        onClaimReward={handleClaimReward}
        onClaimPlatinumDiscount={handleClaimPlatinumDiscount}
      />

      {/* SECTION 29: Checkout — moved to store/checkout.tsx */}
      <Checkout
        open={showCheckout}
        onOpenChange={setShowCheckout}
        resetKey={resetKey}
        currentUser={currentUser}
        setOrderHistory={setOrderHistory}
        onOrderPlacedSuccess={onOrderPlacedSuccess}
        onOpenRegister={onOpenRegister}
        nowTimestamp={nowTimestamp}
        availablePromos={availablePromos}
        loadPromosFromCloud={loadPromosFromCloud}
        stamps={stamps}
        loyaltyStatus={loyaltyStatus}
      />
    </div>
  );
}
