// @ts-nocheck
// ProfilePage — "My Order History" dialog, plus everything that loads and refreshes the customer's orders.
// Moved out of ordering-counter.tsx (Step 3). Look and behavior are unchanged.
// StorePage owns the open flag and the order list; this file loads them from Supabase / local / session storage
// and keeps them live when staff edit an order.
import React, { useEffect } from 'react';
import { History, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { formatPeso } from '@/lib/menu-data';
import { supabase } from '@/lib/supabase';

// Same guest rule the ordering counter has always used.
export function isGuestUser(currentUser: any) {
  return !currentUser || currentUser.role === 'guest' || (currentUser.name && currentUser.name.toLowerCase().includes('guest')) || (currentUser.identifier && currentUser.identifier.toLowerCase().includes('guest'));
}

// Per-customer storage key for the cached order history (also used when an order is placed).
export function getOrderHistoryStorageKey(currentUser: any) {
  const userIdentifier = isGuestUser(currentUser) ? 'guest_session_user' : (currentUser.email || currentUser.name || 'admin').toLowerCase().trim();
  return `veyns_user_orders_${userIdentifier}`;
}

export function ProfilePage({
  open,
  onOpenChange,
  currentUser,
  orderHistory,
  setOrderHistory
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser?: any;
  orderHistory: any[];
  setOrderHistory: (orders: any[]) => void;
}) {
  const isGuest = isGuestUser(currentUser);
  const historyList = orderHistory || [];
  const setHistoryList = setOrderHistory;
  const userIdentifier = isGuest ? 'guest_session_user' : (currentUser.email || currentUser.name || 'admin').toLowerCase().trim();
  const userHistoryStorageKey = getOrderHistoryStorageKey(currentUser);

  // SECTION 14: Retrieve and normalize order history from Supabase and local/session storage.
  const refreshOrderHistoryFromStorage = async () => {
    try {
      if (!isGuest) {
        const { data: cloudOrders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', currentUser.authUserId || currentUser.userId)
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
            scheduleInfo: o.schedule_info || 'Immediate / Today',
            status: o.status || 'pending',
            lastEditedAt: o.last_edited_at || null
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

  // SECTION 14b: Live updates. When staff edit this customer's order (items, fulfillment, schedule),
  // "My Order History" refreshes immediately without reloading the page.
  useEffect(() => {
    if (isGuest) return;
    const liveUserId = currentUser?.authUserId || currentUser?.userId;
    if (!liveUserId) return;
    const myOrdersChannel = supabase
      .channel('my_orders_live_' + liveUserId + '_' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${liveUserId}` }, () => {
        refreshOrderHistoryFromStorage();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(myOrdersChannel);
    };
  }, [currentUser]);

  // Refresh the list every time the dialog is opened.
  useEffect(() => {
    if (open) {
      refreshOrderHistoryFromStorage();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (isOpen) refreshOrderHistoryFromStorage();
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
                      {order.lastEditedAt && (
                        <p className="text-[10px] text-amber-300 mt-1 font-semibold">✎ Updated by VEYNS staff • {new Date(order.lastEditedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
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
            onClick={() => onOpenChange(false)}
            className="w-full bg-lime-400 hover:bg-lime-500 text-black font-extrabold py-2.5 rounded-xl text-xs transition-all shadow-lg"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
  );
}
