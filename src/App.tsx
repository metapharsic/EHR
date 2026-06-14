
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StrategicPOS from './components/StrategicPOS';
import InventoryHub from './components/InventoryHub';
import Manufacturing from './components/Manufacturing';
import PurchaseEnhanced from './components/PurchaseEnhanced';
import Reports from './components/Reports';
import Accounts from './components/Accounts';
import StrategicPCD from './components/StrategicPCD';
import HR from './components/HR';
import HRMS from './components/HRMS';
import Settings from './components/Settings';
import Login from './components/Login';
import Compliance from './components/Compliance';
import CRM from './components/CRM';
import QualityControl from './components/QualityControl';
import Logistics from './components/Logistics';
import Sales from './components/Sales';
import AuditLog from './components/AuditLog';
import Documents from './components/Documents';
import Assets from './components/Assets';
import RnD from './components/RnD';
import OMS from './components/OMS';
import SalesHistoryPage from './components/SalesHistoryPage';
import CustomerDatabasePage from './components/CustomerDatabasePage';
import VoucherSetupPage from './components/VoucherSetupPage';
import LedgerCreation from './components/LedgerCreation';
import { InventoryVouchers } from './components/InventoryVouchers';
import MultiBranchDashboard from './components/MultiBranchDashboard';
import { IntelligenceDashboard } from './components/IntelligenceDashboard';
import TallyVoucherEntry from './components/TallyVoucherEntry';
import POSTerminalModal from './components/POSTerminalModal';

import { Tab } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { KeyboardShortcutProvider } from './context/KeyboardShortcutContext';
import { NotificationProvider, NotificationBell } from './context/NotificationContext';
import { DeerflowProvider } from './context/DeerflowContext';
import { useAppStore } from './store/useAppStore';
import { Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    activeTab,
    sidebarOpen,
    toggleSidebar
  } = useAppStore();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 flex-col">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
        <div className="text-slate-500 font-medium animate-pulse">Verifying Authentication...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case Tab.DASHBOARD: return <Dashboard />;
      case Tab.POS: return <StrategicPOS />;
      case Tab.INVENTORY_HUB: return <InventoryHub />;
      case Tab.PURCHASE: return <PurchaseEnhanced />;
      case Tab.ACCOUNTS: return <Accounts />;
      case Tab.PCD: return <StrategicPCD />;
      case Tab.CRM: return <CRM />;
      case Tab.OMS: return <OMS />;
      case Tab.SALES: return <Sales />;
      case Tab.MANUFACTURING: return <Manufacturing />;
      case Tab.QC: return <QualityControl />;
      case Tab.R_AND_D: return <RnD />;
      case Tab.LOGISTICS: return <Logistics />;
      case Tab.ASSETS: return <Assets />;
      case Tab.DOCUMENTS: return <Documents />;
      case Tab.HRMS: return <HRMS />;
      case Tab.EMPLOYEES: return <HR />;
      case Tab.REPORTS: return <Reports />;
      case Tab.COMPLIANCE: return <Compliance />;
      case Tab.AUDIT: return <AuditLog />;
      case Tab.SETTINGS: return <Settings />;
      case Tab.MULTI_BRANCH: return <MultiBranchDashboard />;
      case Tab.INTELLIGENCE_DASHBOARD: return <IntelligenceDashboard />;
      case Tab.LEDGER_CREATION: return <LedgerCreation />;
      case Tab.SALES_HISTORY: return <SalesHistoryPage />;
      case Tab.CUSTOMER_DATABASE: return <CustomerDatabasePage />;
      case Tab.VOUCHER_SETUP: return <VoucherSetupPage />;
      case Tab.INVENTORY_VOUCHERS: return <InventoryVouchers />;
      case Tab.TALLY_VOUCHER_ENTRY: return <TallyVoucherEntry />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto transition-all duration-300">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-white/80 px-4 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded-lg">
               <Menu size={20} />
             </button>
             <h1 className="text-xl font-bold text-slate-800">Metapharsic ERP</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>
        <div className="p-6">
          {renderActiveTab()}
        </div>
      </main>
      <POSTerminalModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <AuthProvider>
        <CompanyProvider>
          <KeyboardShortcutProvider>
            <NotificationProvider>
              <DeerflowProvider>
                <AppContent />
              </DeerflowProvider>
            </NotificationProvider>
          </KeyboardShortcutProvider>
        </CompanyProvider>
      </AuthProvider>
    </React.StrictMode>
  );
};

export default App;
