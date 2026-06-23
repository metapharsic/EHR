
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
// HR component retired — Tab.EMPLOYEES now redirects to HRMS
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
import { GodownMaster } from './components/GodownMaster';

import { Tab } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { KeyboardShortcutProvider } from './context/KeyboardShortcutContext';
import { NotificationProvider, NotificationBell } from './context/NotificationContext';
import { useAppStore } from './store/useAppStore';
import { Menu, ShieldOff, ShieldAlert, X } from 'lucide-react';
import { useDataFetch } from './hooks/useDataFetch';

// ── Compliance Alert Banner ───────────────────────────────────────────────────
const ComplianceAlertBanner: React.FC = () => {
  const [dismissed, setDismissed] = React.useState(false);
  const { data } = useDataFetch<any>('/api/customers/alerts', { cacheTime: 300000 });
  const summary = data?.summary;
  if (!summary || dismissed) return null;
  const critical = (summary.expired || 0) + (summary.critical || 0);
  const warn = summary.expiring || 0;
  const incomplete = summary.incomplete || 0;
  if (critical === 0 && warn === 0 && incomplete === 0) return null;
  const isRed = critical > 0;
  return (
    <div className={`relative flex items-center gap-3 px-4 py-2.5 text-sm font-semibold
      ${isRed
        ? 'bg-red-600 text-white animate-pulse'
        : 'bg-amber-500 text-white'
      }`}>
      {isRed ? <ShieldOff size={16} className="shrink-0"/> : <ShieldAlert size={16} className="shrink-0"/>}
      <span className="flex-1">
        {isRed
          ? `🚨 COMPLIANCE ALERT — ${summary.expired} customer(s) EXPIRED drug license · ${summary.critical} CRITICAL (< 30 days). Sales to these customers may be ILLEGAL.`
          : `⚠ Compliance Warning — ${warn} customer(s) expiring within 90 days · ${incomplete} profile(s) incomplete.`
        }
        <a href="#" onClick={(e) => { e.preventDefault(); (window as any).__erp_goto?.('CUSTOMER_DATABASE'); }}
          className="underline ml-2 font-bold">View Customers →</a>
      </span>
      <button onClick={() => setDismissed(true)} className="p-1 hover:opacity-70 shrink-0" aria-label="Dismiss">
        <X size={15}/>
      </button>
    </div>
  );
};

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
      case Tab.EMPLOYEES: return <HRMS />; // redirected — HR.tsx retired, HRMS is canonical
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
      case Tab.GODOWN_MASTER: return <GodownMaster />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto transition-all duration-300">
        <ComplianceAlertBanner />
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
                <AppContent />
            </NotificationProvider>
          </KeyboardShortcutProvider>
        </CompanyProvider>
      </AuthProvider>
    </React.StrictMode>
  );
};

export default App;
