// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { DollarSign, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle, Upload, Calendar, ArrowRightLeft } from 'lucide-react';
import { MENU_GRID, getActivePromoCodes } from '@/lib/menu-data';
import { AdminOrderProcessing } from '@/components/admin/orders-pos/admin-order-processing';
import { AdminFeedbackManager } from '@/components/admin/feedback/admin-feedback-manager';
import { useTimeSlots } from '@/lib/time-slots';
import { slotEndsAt } from '@/components/admin/admin-slot-times';
import { AdminSlotCapacityTab } from '@/components/admin/slot-capacity/admin-slot-capacity-tab';
import { AdminVouchersTab } from '@/components/admin/vouchers/admin-vouchers-tab';
import { AdminMenuManagerTab } from '@/components/admin/menu-manager/admin-menu-manager-tab';
import { AdminUsersTab } from '@/components/admin/users/admin-users-tab';
import { AdminOrderLogTab } from '@/components/admin/orders-pos/admin-order-log-tab';
import { AdminSalesSummaryCards } from '@/components/admin/sales-analytics/admin-sales-summary-cards';
import { useAdminDashboardData } from '@/components/admin/admin-dashboard-data';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopBar } from '@/components/admin/admin-top-bar';
import { useAdminFitScreen } from '@/components/admin/admin-fit-screen';
import { AdminComingSoon } from '@/components/admin/admin-coming-soon';
import { AdminOverviewTab } from '@/components/admin/overview/admin-overview-tab';
import { AdminLedgerTab } from '@/components/admin/ledger/admin-ledger-tab';
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

  // --- Dashboard page layout: sidebar, header and the sections ---
  return (
    <div className={`bg-[#020b08] text-white ${fitLedger ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
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

      <div className={`pt-14 transition-[padding] duration-200 md:pl-24 md:pt-0 ${navExpanded ? 'lg:pl-72' : ''} ${fitLedger ? 'h-[calc(100vh-4rem)]' : ''}`}>
        <div className={fitLedger ? 'h-full px-8 pb-6' : 'mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8'}>
          {/* The Ledger shows its own heading, so the shared title row is skipped for it */}
          {activeTab !== 'ledger' && (
            <div className="hidden items-center justify-between gap-4 md:flex">
              <h1 className="font-display text-2xl font-extrabold text-white">{activeTitle}</h1>
            </div>
          )}

          {/* Overview page lives in admin/overview/ (placeholder until Step B1b) */}
          <AdminOverviewTab active={activeTab === 'overview'} orders={orders} menuItems={menuItems} />

          {/* Sales analytics: summary cards live in admin/sales-analytics/; the order log, its state and all order dialogs live in admin/orders-pos/ */}
          <AdminOrderLogTab active={activeTab === 'sales'} orders={orders} setOrders={setOrders} slotCapacities={slotCapacities} timeSlotsList={timeSlotsList} fetchCloudData={fetchCloudData}>
            <AdminSalesSummaryCards orders={orders} />
          </AdminOrderLogTab>

          {/* Ledger screen lives in admin/ledger/ (sample data until its database step) */}
          <AdminLedgerTab active={activeTab === 'ledger'} fit={fitLedger} />

          {/* Delivery Fees: in the navigation, not built yet (Part B) */}
          {activeTab === 'fees' && <AdminComingSoon title="Delivery fees are coming" text="The delivery fee rules will be managed here." />}

          {/* Admin order processing: place an order on behalf of an existing or new customer */}
          {activeTab === 'process' && (
            <AdminOrderProcessing onOrdersChanged={fetchCloudData} onViewSales={() => setActiveTab('sales')} />
          )}

          {/* Customer feedback management */}
          {activeTab === 'feedback' && <AdminFeedbackManager />}

          {/* Slot Capacity tab, its two dialogs and the slot card live in admin/slot-capacity/ */}
          <AdminSlotCapacityTab active={activeTab === 'slots'} timeSlotsList={timeSlotsList} slotCapacities={slotCapacities} fetchCloudData={fetchCloudData} />

          {/* Users tab (customer accounts, edit account dialog, Loyalty Manager) lives in admin/users/ */}
          <AdminUsersTab active={activeTab === 'customers'} customers={customers} fetchCloudData={fetchCloudData} />

          {/* Menu Manager tab and the Add / Edit item dialog live in admin/menu-manager/ */}
          <AdminMenuManagerTab active={activeTab === 'menu'} menuItems={menuItems} fetchCloudData={fetchCloudData} />

          {/* Vouchers & Promos tab (form, list, countdowns, redemptions) lives in admin/vouchers/ */}
          <AdminVouchersTab active={activeTab === 'promos'} promos={promos} customers={customers} fetchCloudData={fetchCloudData} />
        </div>
      </div>
    </div>
  );
}

// --- Default export for the employee dashboard ---
export default EmployeeDashboard;
