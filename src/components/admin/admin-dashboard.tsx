// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { DollarSign, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle, Upload, Calendar, ArrowRightLeft } from 'lucide-react';
import { AdminOrderProcessing } from '@/components/admin/orders-pos/admin-order-processing';
import { AdminFeedbackManager } from '@/components/admin/feedback/admin-feedback-manager';
import { useTimeSlots } from '@/lib/time-slots';
import { slotEndsAt } from '@/components/admin/admin-slot-times';
import { AdminSlotCapacityTab } from '@/components/admin/slot-capacity/admin-slot-capacity-tab';
import { AdminVouchersTab } from '@/components/admin/vouchers/admin-vouchers-tab';
import { AdminMenuManagerTab } from '@/components/admin/menu-manager/admin-menu-manager-tab';
import { AdminUsersTab } from '@/components/admin/users/admin-users-tab';
import { AdminOrderLogTab } from '@/components/admin/orders-pos/admin-order-log-tab';
import { AdminSalesAnalytics } from '@/components/admin/sales-analytics/admin-sales-analytics';
import { useAdminDashboardData } from '@/components/admin/admin-dashboard-data';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopBar } from '@/components/admin/admin-top-bar';
import { useAdminFitScreen } from '@/components/admin/admin-fit-screen';
import { AdminOverviewTab } from '@/components/admin/overview/admin-overview-tab';
import { AdminLedgerTab } from '@/components/admin/ledger/admin-ledger-tab';
import { AdminInventoryTab } from '@/components/admin/inventory/admin-inventory-tab';
import { AdminDeliveryFeesTab } from '@/components/admin/delivery-fees/admin-delivery-fees-tab';
import { ADMIN_NAV_ITEMS, type AdminTabId } from '@/components/admin/admin-nav-items';

// --- Main employee/admin dashboard component ---

export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Step B1a3: the tablet/desktop pill is collapsed (icons only) by default; the choice is remembered in this browser.
  const [navExpanded, setNavExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem('veyns_admin_nav_expanded') === '1'; } catch (e) { return false; }
  });
  // Step A3: data loading and Realtime now live in admin/admin-dashboard-data.ts
  const { menuItems, promos, orders, setOrders, customers, slotCapacities, fetchCloudData } = useAdminDashboardData();

  const timeSlotsList = useTimeSlots(); // editable in Slot Capacity; shared live with customer checkout

  // --- Return from the dashboard to the customer-facing store ---
  const handleExitStore = () => {
    if (onBackToStore) {
      onBackToStore();
    } else {
      try { localStorage.setItem('veyns_active_view', 'store'); } catch (e) {}
      window.location.reload();
    }
  };

  const handleToggleNav = () => {
    const next = !navExpanded;
    setNavExpanded(next);
    try { localStorage.setItem('veyns_admin_nav_expanded', next ? '1' : '0'); } catch (e) {}
  };

  // Step B1a: choosing a label switches the tab and closes the phone drawer.
  const handleSelectTab = (id: AdminTabId) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  const activeTitle = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? '';

  // Step B10b: on a large screen the Ledger fills the window and the page does not scroll.
  const fitScreen = useAdminFitScreen(navExpanded);
  const fitLedger = fitScreen && activeTab === 'ledger';
  // Step B2a2: Orders & POS also fills the window on a large screen (lower height needed than the Ledger).
  const fitOrdersScreen = useAdminFitScreen(navExpanded, 'orders');
  const fitOrders = fitOrdersScreen && activeTab === 'process';
  // Step B2b: with enough height the order form and the Order Transactions table share one no-scroll window;
  // with less height the form fills the window and the table is reached by scrolling.
  const fitOrdersTall = useAdminFitScreen(navExpanded, 'orders-table') && activeTab === 'process';
  // Step B3a: the Users screen also fills the window on a large screen (same widths as Orders & POS).
  const fitUsers = useAdminFitScreen(navExpanded, 'users') && activeTab === 'customers';
  // Step B4: the Slot Capacity screen also fills the window on a large screen (same widths as Orders & POS).
  const fitSlots = useAdminFitScreen(navExpanded, 'slots') && activeTab === 'slots';
  // Step B5: the Feedback screen also fills the window on a large screen (same widths as Orders & POS).
  const fitFeedback = useAdminFitScreen(navExpanded, 'feedback') && activeTab === 'feedback';
  // Step B6: the Vouchers screen also fills the window on a large screen (same widths as Orders & POS).
  const fitVouchers = useAdminFitScreen(navExpanded, 'vouchers') && activeTab === 'promos';
  // Step B7: the Menu Manager screen also fills the window on a large screen (same widths as Orders & POS).
  const fitMenu = useAdminFitScreen(navExpanded, 'menu') && activeTab === 'menu';
  // Step B12: the Inventory screen also fills the window on a large screen (same widths as Orders & POS, more height).
  const fitInventory = useAdminFitScreen(navExpanded, 'inventory') && activeTab === 'inventory';
  // Step B11a: the Delivery Fee screen also fills the window on a large screen (same widths as Orders & POS, more height).
  const fitFees = useAdminFitScreen(navExpanded, 'fees') && activeTab === 'fees';
  const fitPage = fitLedger || fitOrdersTall || fitUsers || fitSlots || fitFeedback || fitVouchers || fitMenu || fitInventory || fitFees;

  // --- Dashboard page layout: sidebar, header and the sections ---
  return (
    <div className={`bg-[#020b08] text-white ${fitPage ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <AdminTopBar />
      <AdminSidebar
        activeTab={activeTab}
        onSelect={handleSelectTab}
        counts={{ sales: orders.length, customers: customers.length, promos: promos.length, menu: menuItems.length }}
        title={activeTitle}
        expanded={navExpanded}
        onToggleExpanded={handleToggleNav}
        mobileOpen={mobileNavOpen}
        onOpenMobile={() => setMobileNavOpen(true)}
        onCloseMobile={() => setMobileNavOpen(false)}
        onExit={handleExitStore}
      />

      <div className={`pt-14 transition-[padding] duration-200 md:pl-24 md:pt-0 ${navExpanded ? 'lg:pl-72' : ''} ${fitPage ? 'h-[calc(100vh-4rem)]' : ''}`}>
        <div className={fitLedger ? 'h-full px-8 pb-6' : fitUsers || fitSlots || fitFeedback || fitVouchers || fitMenu || fitInventory || fitFees ? 'flex h-full flex-col gap-3 px-8 pb-6' : fitOrders ? `flex flex-col gap-3 px-8 pb-6 ${fitOrdersTall ? 'h-full' : ''}` : `mx-auto ${activeTab === 'process' ? 'max-w-[1800px]' : 'max-w-7xl'} space-y-6 p-4 sm:p-6 lg:p-8`}>
          {/* The Ledger, the Menu Manager, Inventory and Delivery Fees show their own heading, so the shared title row is skipped for them */}
          {activeTab !== 'ledger' && activeTab !== 'menu' && activeTab !== 'inventory' && activeTab !== 'fees' && !fitFeedback && (
            <div className={`hidden items-center justify-between gap-4 md:flex ${fitOrders || fitUsers || fitSlots || fitVouchers ? 'shrink-0' : ''}`}>
              <h1 className="font-display text-2xl font-extrabold text-white">{activeTitle}</h1>
            </div>
          )}

          {/* Overview page lives in admin/overview/ (placeholder until Step B1b) */}
          <AdminOverviewTab active={activeTab === 'overview'} orders={orders} menuItems={menuItems} />

          {/* Sales analytics and Orders & POS: the Sales Analytics page above the log lives in admin/sales-analytics/ (Step B9); the order log, its state and all order dialogs live in admin/orders-pos/ and serve both screens */}
          <AdminOrderLogTab active={activeTab === 'sales' || activeTab === 'process'} view={activeTab === 'process' ? 'pos' : 'sales'} fitMode={fitOrdersTall ? 'all' : fitOrders ? 'form' : 'none'} orders={orders} setOrders={setOrders} slotCapacities={slotCapacities} timeSlotsList={timeSlotsList} fetchCloudData={fetchCloudData}>
            {activeTab === 'process'
              ? <AdminOrderProcessing onOrdersChanged={fetchCloudData} onViewSales={() => setActiveTab('sales')} fit={fitOrders} />
              : <AdminSalesAnalytics orders={orders} customers={customers} promos={promos} onRefresh={fetchCloudData} onOpenTab={setActiveTab} />}
          </AdminOrderLogTab>

          {/* Ledger screen lives in admin/ledger/ (sample data until its database step) */}
          <AdminLedgerTab active={activeTab === 'ledger'} fit={fitLedger} />

          {/* Inventory screen lives in admin/inventory/ (sample data until its database step) */}
          <AdminInventoryTab active={activeTab === 'inventory'} fit={fitInventory} />

          {/* Delivery Fee screen lives in admin/delivery-fees/ (a simulator on the live rule; nothing is published yet) */}
          <AdminDeliveryFeesTab active={activeTab === 'fees'} orders={orders} fit={fitFees} />

          {/* Orders & POS: the order form (AdminOrderProcessing, passed as children above) with the Order Transactions table under it */}

          {/* Customer feedback management */}
          {activeTab === 'feedback' && <AdminFeedbackManager fit={fitFeedback} />}

          {/* Slot Capacity tab, its slot row, owners panel, time windows panel and transfer dialog live in admin/slot-capacity/ */}
          <AdminSlotCapacityTab active={activeTab === 'slots'} timeSlotsList={timeSlotsList} slotCapacities={slotCapacities} fetchCloudData={fetchCloudData} fit={fitSlots} />

          {/* Users tab (customer accounts, edit account dialog, Loyalty Manager) lives in admin/users/; it gets the orders for the Orders / Spent columns */}
          <AdminUsersTab active={activeTab === 'customers'} customers={customers} orders={orders} fit={fitUsers} fetchCloudData={fetchCloudData} />

          {/* Menu Manager tab, its item cards, stat cards, Category Mix and the Add / Edit panel live in admin/menu-manager/; it gets the orders for the sold numbers */}
          <AdminMenuManagerTab active={activeTab === 'menu'} menuItems={menuItems} orders={orders} fit={fitMenu} fetchCloudData={fetchCloudData} />

          {/* Vouchers & Promos tab (form, list, countdowns, redemptions) lives in admin/vouchers/ */}
          <AdminVouchersTab active={activeTab === 'promos'} promos={promos} customers={customers} orders={orders} fit={fitVouchers} fetchCloudData={fetchCloudData} />
        </div>
      </div>
    </div>
  );
}

// --- Default export for the employee dashboard ---
export default EmployeeDashboard;
