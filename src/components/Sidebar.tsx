
import React from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, FileBarChart, Users, Settings,
  ShieldCheck, CreditCard, LogOut, Map, Factory, Briefcase,
  UserPlus, ClipboardCheck, Activity, FileText, Database, Layers, TrendingUp, Globe, Plus, Sparkles,
  History, Brain
} from 'lucide-react';
import { Tab } from '../types';
import { useAuth } from '../context/AuthContext';
import { ROLE_ACCESS } from '../constants';
import { useAppStore } from '../store/useAppStore';

interface SidebarProps {
  activeTab?: Tab;
  setActiveTab?: (tab: Tab) => void;
  isOpen?: boolean;
}
// ... (SECTION_HEADERS and MENU_STRUCTURE remain same)
const SECTION_HEADERS = {
  REVENUE: 'Revenue & Sales',
  SUPPLY: 'Supply Chain & Ops',
  PRODUCTION: 'Mfg & Quality',
  PEOPLE: 'Human Capital',
  FINANCE: 'Finance & Governance',
  SYSTEM: 'Intelligence & Admin'
};

const MENU_STRUCTURE = [
  {
    section: SECTION_HEADERS.REVENUE,
    items: [
      { id: Tab.CRM, label: 'CRM (Leads)', icon: <UserPlus size={18} /> },
      { id: Tab.PCD, label: 'PCD Network', icon: <Map size={18} /> },
      { id: Tab.OMS, label: 'Order Mgmt (OMS)', icon: <Globe size={18} /> },
      { id: Tab.POS, label: 'POS / Billing', icon: <ShoppingCart size={18} /> },
      { id: Tab.SALES_HISTORY, label: 'Sales Register', icon: <History size={18} /> },
      { id: Tab.SALES, label: 'Wholesale Sales', icon: <TrendingUp size={18} /> },
    ]
  },
  {
    section: SECTION_HEADERS.SUPPLY,
    items: [
      { id: Tab.INVENTORY_HUB, label: 'Inventory Hub', icon: <Package size={18} /> },
      { id: Tab.PURCHASE, label: 'Purchase', icon: <Truck size={18} /> },
      { id: Tab.LOGISTICS, label: 'Logistics', icon: <Truck size={18} /> },
      { id: Tab.ASSETS, label: 'Assets & Maint.', icon: <Database size={18} /> },
      { id: Tab.DOCUMENTS, label: 'Documents (DMS)', icon: <FileText size={18} /> },
    ]
  },
  {
    section: SECTION_HEADERS.PRODUCTION,
    items: [
      { id: Tab.MANUFACTURING, label: 'Manufacturing', icon: <Factory size={18} /> },
      { id: Tab.QC, label: 'Quality Control', icon: <ClipboardCheck size={18} /> },
      { id: Tab.R_AND_D, label: 'R&D Lab', icon: <Activity size={18} /> },
    ]
  },
  {
    section: SECTION_HEADERS.PEOPLE,
    items: [
      { id: Tab.HRMS, label: 'HRMS (AI-Era)', icon: <Brain size={18} className="text-indigo-500" /> },
      { id: Tab.EMPLOYEES, label: 'HR & Payroll', icon: <Briefcase size={18} /> },
    ]
  },
  {
    section: SECTION_HEADERS.FINANCE,
    items: [
      { id: Tab.ACCOUNTS, label: 'Accounts', icon: <CreditCard size={18} /> },
      { id: Tab.LEDGER_CREATION, label: 'Ledger Creation', icon: <Plus size={18} /> },
      { id: Tab.VOUCHER_SETUP, label: 'Voucher Setup', icon: <Settings size={18} /> },
      { id: Tab.COMPLIANCE, label: 'Compliance', icon: <ShieldCheck size={18} /> },
      { id: Tab.CUSTOMER_DATABASE, label: 'Customer DB', icon: <Users size={18} /> },
    ]
  },
  {
    section: SECTION_HEADERS.SYSTEM,
    items: [
      { id: Tab.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: Tab.INTELLIGENCE_DASHBOARD, label: 'Intelligence Center', icon: <Sparkles size={18} className="text-indigo-500" /> },
      { id: Tab.REPORTS, label: 'Reports', icon: <FileBarChart size={18} /> },
      { id: Tab.AUDIT, label: 'Audit Logs', icon: <Layers size={18} /> },
      { id: Tab.MULTI_BRANCH, label: 'Enterprise Hub', icon: <Globe size={18} /> },
      { id: Tab.SETTINGS, label: 'Settings', icon: <Settings size={18} /> },
    ]
  }
];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  isOpen: propIsOpen
}) => {
  const { user, logout } = useAuth();

  // Connect to Zustand store
  const {
    sidebarOpen: storeIsOpen,
    activeTab: storeActiveTab,
    setActiveTab: storeSetActiveTab,
    setPosTerminalOpen,
    setPosInternalTab,
    posState,
    posBillState
  } = useAppStore();

  // Use props if provided, otherwise fallback to store
  const isOpen = propIsOpen !== undefined ? propIsOpen : storeIsOpen;
  const activeTab = propActiveTab !== undefined ? propActiveTab : (storeActiveTab as Tab);

  const setActiveTab = (tab: any) => {
    if (propSetActiveTab) propSetActiveTab(tab);
    storeSetActiveTab(tab);
  };

  return (
    <div className={`
 ${isOpen ? 'w-48' : 'w-14'}
 bg-slate-50 h-full transition-all duration-300 flex flex-col shadow-inner z-20 sticky top-0 border-r border-slate-200
 `}>
      {/* Header */}
      <div className={`h-16 flex items-center border-b border-slate-200 bg-white sticky top-0 z-10 ${isOpen ? 'px-4' : 'px-0 justify-center'}`}>
        <div className={`flex items-center min-w-0 ${isOpen ? 'gap-3' : 'justify-center'}`}>
          <div className="h-10 w-10 flex-shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden">
            <div className="h-8 w-8 flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
          </div>
          {isOpen && (
            <div className="flex min-w-0 flex-col justify-center">
              <span className="truncate text-[12px] font-[800] text-slate-900 tracking-[0.12em] uppercase leading-none">Metapharsic</span>
              <span className="mt-1 text-[8px] text-[#16a34a] font-[800] uppercase tracking-[0.08em] leading-none">Enterprise Hub</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar">
        <div className="space-y-2">
          {MENU_STRUCTURE.map((section, idx) => {
            // Filter items based on user permission
            const allowedItems = section.items.filter(item => {
              if (!user) return false;
              // Handle special POS internal tabs permissions - they inherit from POS
              // If it's a regular Tab enum value, use it. If it's one of the 4 new items, use Tab.POS.
              const tabId = Object.values(Tab).includes(item.id as any) ? item.id : Tab.POS;
              return ROLE_ACCESS[tabId as Tab]?.includes(user.role);
            });

            if (allowedItems.length === 0) return null;

            return (
              <div key={idx}>
                {isOpen && (
                  <h4 className="px-3 pt-3 pb-2 text-[10px] font-[800] text-[#94a3b8] uppercase tracking-[0.08em] border-t border-slate-100 first:border-0 first:pt-0">
                    {section.section}
                  </h4>
                )}
                <ul className="space-y-1">
                  {allowedItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveTab(item.id)}
                          className={`
 w-full h-9 flex items-center rounded-[6px] transition-all duration-200 relative group text-[13px] ${isOpen ? 'px-3 justify-start' : 'px-0 justify-center'}
 ${isActive
                              ? 'bg-[#f0fdf4] text-[#16a34a] font-[700] shadow-[inset_3px_0_0_#22c55e]'
                              : 'text-[#475569] font-[500] hover:bg-white hover:text-[#0f172a]'}
 `}
                          title={!isOpen ? item.label : ''}
                        >
                          <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center ${isOpen ? 'mr-[10px]' : 'mr-0'} ${isActive ? 'text-[#16a34a]' : 'text-[#94a3b8] group-hover:text-[#0f172a]'}`}>
                            {React.cloneElement(item.icon as React.ReactElement, { size: 15 })}
                          </span>

                          {isOpen && (
                            <span className="min-w-0 whitespace-nowrap transition-all flex items-center justify-between w-full">
                              <span className="truncate">{item.label}</span>
                              {item.id === Tab.POS && (posState === 'side' || posState === 'mini') && (
                                <span title="POS is active in background">
                                  {posBillState.items.some(i => parseFloat(i.quantity) > 0) ? (
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1D9E75] text-[9px] font-bold text-white shadow-sm ring-1 ring-white">
                                      {posBillState.items.filter(i => parseFloat(i.quantity) > 0).length}
                                    </span>
                                  ) : (
                                    <span className="flex h-2 w-2 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1D9E75] opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1D9E75]"></span>
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer User Profile */}
      <div className={`${isOpen ? 'p-3' : 'p-2'} border-t border-slate-200 bg-white shrink-0`}>
        <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
          <div className="flex items-center min-w-0 gap-2">
            <div className="w-8 h-8 flex-shrink-0 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
              {user?.name.charAt(0)}
            </div>
            {isOpen && (
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-800 truncate leading-none mb-1">{user?.name}</p>
                <p className="text-[8px] text-accent font-bold uppercase tracking-tighter leading-none">{user?.role.replace('_', ' ')}</p>
              </div>
            )}
          </div>

          {isOpen && (
            <button
              onClick={logout}
              className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};



export default Sidebar;

