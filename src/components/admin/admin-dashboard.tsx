// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { ArrowLeft, DollarSign, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle, Upload, Calendar, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { AdminComingSoon } from '@/components/admin/admin-coming-soon';
import { AdminOverviewTab } from '@/components/admin/overview/admin-overview-tab';
import { ADMIN_NAV_ITEMS, type AdminTabId } from '@/components/admin/admin-nav-items';

// --- Main employee/admin dashboard component ---

export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  // Step B1a: choosing a label switches the tab and closes the phone drawer.
  const handleSelectTab = (id: AdminTabId) => {
    setActiveTab(id);
    setMobileNavOpen(false);
  };

  const activeTitle = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? '';

  // --- Dashboard page layout: sidebar, header and the sections ---
  return (
    <div className="min-h-screen bg-[#020b08] text-white">
      <AdminSidebar
        activeTab={activeTab}
        onSelect={handleSelectTab}
        counts={{ sales: orders.length, customers: customers.length, promos: promos.length, menu: menuItems.length }}
        title={activeTitle}
        mobileOpen={mobileNavOpen}
        onOpenMobile={() => setMobileNavOpen(true)}
        onCloseMobile={() => setMobileNavOpen(false)}
        onExit={handleExitStore}
      />

      <div className="pt-14 md:pl-16 md:pt-0 lg:pl-60">
        <div className="hidden items-center justify-between gap-4 border-b border-emerald-900/65 px-6 py-4 md:flex lg:px-8">
          <h1 className="font-display text-2xl font-extrabold text-white">{activeTitle}</h1>
          <Button
            type="button"
            onClick={handleExitStore}
            className="bg-[#082d22] hover:bg-lime-400 hover:text-black text-lime-400 border border-emerald-700/80 font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Exit to Store
          </Button>
        </div>

        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Overview page lives in admin/overview/ (placeholder until Step B1b) */}
          <AdminOverviewTab active={activeTab === 'overview'} orders={orders} menuItems={menuItems} />

          {/* Sales analytics: summary cards live in admin/sales-analytics/; the order log, its state and all order dialogs live in admin/orders-pos/ */}
          <AdminOrderLogTab active={activeTab === 'sales'} orders={orders} setOrders={setOrders} slotCapacities={slotCapacities} timeSlotsList={timeSlotsList} fetchCloudData={fetchCloudData}>
            <AdminSalesSummaryCards orders={orders} />
          </AdminOrderLogTab>

          {/* Ledger and Delivery Fees: in the navigation, not built yet (Part B) */}
          {activeTab === 'ledger' && <AdminComingSoon title="Ledger is coming" text="Expenses, capital and cash flow will be recorded here." />}
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
