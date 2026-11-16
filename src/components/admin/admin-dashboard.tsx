// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { ArrowLeft, Tag, DollarSign, BarChart2, Users, KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, XCircle, Clock, Upload, Calendar, Ticket, ArrowRightLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MENU_GRID, getActivePromoCodes } from '@/lib/menu-data';
import { AdminOrderProcessing } from '@/components/admin/orders-pos/admin-order-processing';
import { AdminFeedbackManager } from '@/components/admin/feedback/admin-feedback-manager';
import { useTimeSlots } from '@/lib/time-slots';
import { MessageSquare } from 'lucide-react';
import { slotEndsAt } from '@/components/admin/admin-slot-times';
import { AdminSlotCapacityTab } from '@/components/admin/slot-capacity/admin-slot-capacity-tab';
import { AdminVouchersTab } from '@/components/admin/vouchers/admin-vouchers-tab';
import { AdminMenuManagerTab } from '@/components/admin/menu-manager/admin-menu-manager-tab';
import { AdminUsersTab } from '@/components/admin/users/admin-users-tab';
import { AdminOrderLogTab } from '@/components/admin/orders-pos/admin-order-log-tab';
import { AdminSalesSummaryCards } from '@/components/admin/sales-analytics/admin-sales-summary-cards';
import { useAdminDashboardData } from '@/components/admin/admin-dashboard-data';

// --- Main employee/admin dashboard component ---

export function EmployeeDashboard({ onBackToStore }: { onBackToStore?: () => void }) {
  const [activeTab, setActiveTab] = useState<'sales' | 'menu' | 'promos' | 'customers' | 'slots' | 'process' | 'feedback'>('sales');
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

        {/* Sales analytics: summary cards live in admin/sales-analytics/; the order log, its state and all order dialogs live in admin/orders-pos/ */}
        <AdminOrderLogTab active={activeTab === 'sales'} orders={orders} setOrders={setOrders} slotCapacities={slotCapacities} timeSlotsList={timeSlotsList} fetchCloudData={fetchCloudData}>
          <AdminSalesSummaryCards orders={orders} />
        </AdminOrderLogTab>

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
  );
}

// --- Default export for the employee dashboard ---
export default EmployeeDashboard;