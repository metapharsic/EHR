/**
 * STRATEGIC ACCOUNTS COMPONENT (Modernized v2.0)
 * Uses EnterpriseLayout + useDataFetch patterns
 * Standardized for Metapharsic ERP Unified Design System
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
 FileText, User, Plus, TrendingUp, RefreshCcw, BookOpen,
 Shield, Zap, LayoutDashboard, Package, Scale, Landmark, Calculator,
 ArrowUpRight, ArrowDownLeft, Wallet, PieChart
} from 'lucide-react';

// Standardized Layout Components
import { EnterpriseLayout, FilterBar, DataTable, StatCard, Badge } from './UniversalLayout';
import { useDataFetch, useDatabaseStatus, useSearch, usePagination } from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';
import { useNotificationSystem } from '../hooks/useNotifications';

// Sub-components
import { DayBook } from './DayBook';
import { GeneralLedger } from './GeneralLedger';
import { FinancialStatements } from './FinancialStatements';
import { JournalVoucherManager } from './JournalVoucherManager';
import InventoryHub from './InventoryHub';
import { GodownMaster } from './GodownMaster';
import { BomMaster } from './BomMaster';
import { InventoryVouchers } from './InventoryVouchers';
import { GstReports } from './GstReports';
import { StockSummary } from './StockSummary';
import { CostCenterManager } from './CostCenterManager';

import TDSManagement from './TDSManagement';
import { AuditTrailView } from './AuditTrailView';
import { BudgetManager } from './BudgetManager';
import DailySalesIntelligence from './DailySalesIntelligence';

// Types
import { Party, Tab } from '../types';

interface StrategicAccountsProps {
 onNavigate?: (tab: Tab) => void;
}

const StrategicAccounts: React.FC<StrategicAccountsProps> = ({ onNavigate }) => {
 const { hasPermission } = useAuth();
 const notify = useNotificationSystem();
 const { status: dbStatus } = useDatabaseStatus();
 const canEdit = hasPermission(['ADMIN', 'FINANCE_MANAGER']);

 // ============================================================
 // 1. DATA FETCHING
 // ============================================================
 
 // Track actual server-sync timestamp (not client wall-clock)
 const lastSyncRef = useRef<string>('—');

 // Fetch Parties/Accounts
 const { data: parties, loading: loadingParties, refetch: refetchParties } = useDataFetch<Party[]>(
 '/api/accounting/chart-of-accounts',
 { cacheTime: 300000 }
 );

 // Fetch Dashboard Stats
 const { data: dashboardStats, loading: loadingStats } = useDataFetch<any>(
 '/api/accounting/diagnostic'
 );

 // Update last-sync time whenever dashboardStats arrive from the server
 useMemo(() => {
   if (dashboardStats) {
     lastSyncRef.current = new Date().toLocaleTimeString('en-IN', {
       hour: '2-digit', minute: '2-digit', second: '2-digit',
     });
   }
 }, [dashboardStats]);

 // ============================================================
 // 2. STATE MANAGEMENT
 // ============================================================
 
 const [openTabs, setOpenTabs] = useState<{id: string, label: string}[]>([
 { id: 'FINANCIAL_SUMMARY', label: 'Financial Dashboard' }
 ]);
 const [activeTab, setActiveTab] = useState<string>('FINANCIAL_SUMMARY');
 const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);

 // ============================================================
 // 3. TAB MANAGEMENT
 // ============================================================

 const openTab = (id: string, label: string) => {
 if (!openTabs.find(t => t.id === id)) {
 setOpenTabs([...openTabs, { id, label }]);
 }
 setActiveTab(id);
 };

 const closeTab = (id: string) => {
 const newTabs = openTabs.filter(t => t.id !== id);
 setOpenTabs(newTabs);
 if (activeTab === id && newTabs.length > 0) {
 setActiveTab(newTabs[newTabs.length - 1].id);
 } else if (newTabs.length === 0) {
 setActiveTab('FINANCIAL_SUMMARY');
 if (!openTabs.find(t => t.id === 'FINANCIAL_SUMMARY')) {
 setOpenTabs([{ id: 'FINANCIAL_SUMMARY', label: 'Financial Dashboard' }]);
 }
 }
 };

 // ============================================================
 // 4. SEARCH & PAGINATION
 // ============================================================
 
 const { query: partySearch, setQuery: setPartySearch, results: filteredParties } = useSearch<any>(
 parties || [],
 ['account_name', 'account_code', 'account_type']
 );

 const partyPagination = usePagination<any>(filteredParties, 15);

 // ============================================================
 // 5. CALCULATED STATS
 // ============================================================
 
 const totals = useMemo(() => {
 if (!parties) return { receivables: 0, payables: 0, net: 0, count: 0 };

 const getBalance = (p: any) => {
   const b = Number(p.current_balance ?? p.opening_balance ?? 0);
   return isFinite(b) ? b : 0;
 };

 // FIXED: Filter by account_type, not just sign of balance.
 //
 // The chart-of-accounts API computes current_balance as:
 //   credit-normal (Liability): -opening_balance + net_gl_balance  → usually negative
 //   debit-normal  (Asset):      opening_balance + net_gl_balance  → usually positive
 //
 // Naively filtering by sign includes Income accounts (positive) in receivables
 // and Expense accounts (negative) in payables — inflating both totals.
 //
 // Correct rules:
 //  Receivables = Asset-type accounts with a positive (debit) balance
 //  Payables    = Liability-type accounts with a negative (credit) balance
 //  Net         = Receivables - Payables
 const receivableTypes = ['Asset', 'Sundry Debtor', 'Trade Receivable', 'Accounts Receivable'];
 const payableTypes    = ['Liability', 'Sundry Creditor', 'Trade Payable', 'Accounts Payable'];

 const isReceivable = (p: any) =>
   receivableTypes.some(t => (p.account_type ?? '').toLowerCase().includes(t.toLowerCase())) &&
   getBalance(p) > 0;

 const isPayable = (p: any) =>
   payableTypes.some(t => (p.account_type ?? '').toLowerCase().includes(t.toLowerCase())) &&
   getBalance(p) < 0;

 const rec = parties
   .filter(isReceivable)
   .reduce((acc, p) => acc + getBalance(p), 0);

 const pay = parties
   .filter(isPayable)
   .reduce((acc, p) => acc + Math.abs(getBalance(p)), 0);

 return {
   receivables: rec,
   payables: pay,
   net: rec - pay,
   count: parties.length,
 };
 }, [parties]);

 // ============================================================
 // 6. SIDEBAR & TOP ACTIONS
 // ============================================================

 const sidebarItems = [
 { id: 'FINANCIAL_SUMMARY', label: 'Financial Dashboard', icon: <LayoutDashboard size={18}/>, onClick: () => openTab('FINANCIAL_SUMMARY', 'Financial Dashboard'), isActive: activeTab === 'FINANCIAL_SUMMARY', group: 'Overview' },
 { id: 'DAY_BOOK', label: 'Day Book', icon: <BookOpen size={18}/>, onClick: () => openTab('DAY_BOOK', 'Day Book'), isActive: activeTab === 'DAY_BOOK', group: 'Overview' },
 { id: 'PARTIES', label: 'Chart of Accounts', icon: <User size={18}/>, onClick: () => openTab('PARTIES', 'Chart of Accounts'), isActive: activeTab === 'PARTIES', group: 'Masters' },
 { id: 'INVENTORY_HUB', label: 'Inventory Hub', icon: <Package size={18}/>, onClick: () => openTab('INVENTORY_HUB', 'Inventory Hub'), isActive: activeTab === 'INVENTORY_HUB', group: 'Masters' },
 { id: 'JOURNAL_VOUCHERS', label: 'Journal Entry', icon: <FileText size={18}/>, onClick: () => openTab('JOURNAL_VOUCHERS', 'Journal Entry'), isActive: activeTab === 'JOURNAL_VOUCHERS', group: 'Transactions' },
 { id: 'INVENTORY_VOUCHERS', label: 'Inventory Vouchers', icon: <Package size={18}/>, onClick: () => openTab('INVENTORY_VOUCHERS', 'Inventory Vouchers'), isActive: activeTab === 'INVENTORY_VOUCHERS', group: 'Transactions' },
 { id: 'GENERAL_LEDGER', label: 'General Ledger', icon: <FileText size={18}/>, onClick: () => openTab('GENERAL_LEDGER', 'General Ledger'), isActive: activeTab === 'GENERAL_LEDGER', group: 'Reports' },
 { id: 'TRIAL_BALANCE', label: 'Trial Balance', icon: <Scale size={18}/>, onClick: () => openTab('TRIAL_BALANCE', 'Trial Balance'), isActive: activeTab === 'TRIAL_BALANCE', group: 'Reports' },
 { id: 'PROFIT_LOSS', label: 'Profit & Loss', icon: <TrendingUp size={18}/>, onClick: () => openTab('PROFIT_LOSS', 'Profit & Loss'), isActive: activeTab === 'PROFIT_LOSS', group: 'Reports' },
 { id: 'BALANCE_SHEET', label: 'Balance Sheet', icon: <Landmark size={18}/>, onClick: () => openTab('BALANCE_SHEET', 'Balance Sheet'), isActive: activeTab === 'BALANCE_SHEET', group: 'Reports' },
 { id: 'GST', label: 'GST Compliance', icon: <Shield size={18}/>, onClick: () => openTab('GST', 'GST Compliance'), isActive: activeTab === 'GST', group: 'Compliance' },
 { id: 'TDS', label: 'TDS Management', icon: <Calculator size={18}/>, onClick: () => openTab('TDS', 'TDS Management'), isActive: activeTab === 'TDS', group: 'Compliance' },
 { id: 'AI_REPORTS', label: 'AI Insights', icon: <Zap size={18}/>, onClick: () => openTab('AI_REPORTS', 'AI Insights'), isActive: activeTab === 'AI_REPORTS', group: 'Enterprise' },
 { id: 'AUDIT_TRAIL', label: 'Audit Trail', icon: <Shield size={18}/>, onClick: () => openTab('AUDIT_TRAIL', 'Audit Trail'), isActive: activeTab === 'AUDIT_TRAIL', group: 'Enterprise' },
 ];

 const topActions = [
 { label: 'New Voucher', onClick: () => openTab('JOURNAL_VOUCHERS', 'Journal Entry'), icon: <Plus size={14}/> },
 { label: 'Refresh', onClick: () => { refetchParties(); notify.success('Financial data synchronized'); }, icon: <RefreshCcw size={14}/> }
 ];

 const renderTabContent = () => {
 if (loadingParties) {
 return (
 <div className="h-full flex flex-col items-center justify-center space-y-4">
 <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin"></div>
 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hydrating Financial Core...</p>
 </div>
 );
 }

 switch (activeTab) {
 case 'FINANCIAL_SUMMARY':
 return (
 <div className="space-y-8 animate-fadeIn">
 <div className="flex justify-between items-center mb-2">
 <h2 className="text-3xl font-bold text-slate-800 tracking-tight uppercase">Financial Dashboard</h2>
 <Badge value="Live Analysis" variant="success" />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <StatCard label="Total Receivables" value={`₹${totals.receivables.toLocaleString()}`} icon={<ArrowUpRight size={24}/>} color="blue" />
 <StatCard label="Total Payables" value={`₹${totals.payables.toLocaleString()}`} icon={<ArrowDownLeft size={24}/>} color="rose" />
 <StatCard label="Net Cash Flow" value={`₹${totals.net.toLocaleString()}`} icon={<Wallet size={24}/>} color="emerald" />
 <StatCard label="Accounts Active" value={dashboardStats?.recordCount || 0} icon={<PieChart size={24}/>} color="indigo" />
 </div>
 
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 <DailySalesIntelligence />
 
 <div className="bg-slate-100 !text-slate-900 p-8 rounded-xl text-white shadow-none shadow-none min-h-[300px] flex flex-col justify-between">
 <div>
 <div className="flex items-center gap-2 mb-2">
 <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-blue-100">System Integrity</span>
 </div>
 <h3 className="text-3xl font-bold tracking-tight">Accounting Audit Ready</h3>
 <p className="mt-4 text-blue-100/80 font-medium leading-relaxed">All ledger entries are timestamped and cryptographically linked to user sessions for full audit compliance.</p>
 </div>
 <div className="flex gap-4 mt-8">
 <div className="bg-white/10 p-4 rounded-xl flex-1 border border-white/10">
 <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">Last Sync</p>
 <p className="font-bold text-lg" data-testid="last-sync-time">{lastSyncRef.current}</p>
 </div>
 <div className="bg-white/10 p-4 rounded-xl flex-1 border border-white/10">
 <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mb-1">Status</p>
 <p className="font-bold text-lg">Secure</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 
 case 'PARTIES': 
 return (
 <div className="flex flex-col gap-6 animate-fadeIn">
 <div className="flex justify-between items-center">
 <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Chart of Accounts</h3>
 {canEdit && (
 <button className="px-6 py-3 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent transition-all flex items-center gap-2 shadow-none shadow-none">
 <Plus size={18} /> Add New Account
 </button>
 )}
 </div>
 
 <FilterBar 
 searchValue={partySearch}
 onSearchChange={setPartySearch}
 searchPlaceholder="Search by name, city or mobile..."
 filters={[{ label: 'Type', value: 'All', onChange: () => {}, options: ['All', 'Asset', 'Liability', 'Income', 'Expense'] }]}
 />
 
 <DataTable 
 columns={[
 { key: 'account_code', label: 'Code', width: '10%' },
 { key: 'account_name', label: 'Account Name', width: '30%' },
 { key: 'account_type', label: 'Type', width: '15%', format: (v) => <Badge value={v} variant={v === 'Asset' || v === 'Income' ? 'success' : 'danger'} /> },
 { key: 'account_group', label: 'Group', width: '15%' },
 { key: 'opening_balance', label: 'Balance', width: '20%', align: 'right', format: (v) => `₹${Math.abs(v).toLocaleString()} ${v >= 0 ? 'Dr' : 'Cr'}` },
 { key: 'actions', label: 'View', width: '10%', align: 'center', format: (_, row) => (
 <button onClick={() => { setSelectedPartyId(row.id); openTab('LEDGER', 'General Ledger'); }} className="text-accent hover:underline font-bold text-xs uppercase tracking-widest">Detail</button>
 )}
 ]}
 data={partyPagination.paginatedData}
 loading={loadingParties}
 />
 </div>
 );
 
 case 'DAY_BOOK': return <DayBook />;
 case 'INVENTORY_HUB': return <InventoryHub />;
 case 'GODOWN_MASTER': return <GodownMaster />;
 case 'BOM_MASTER': return <BomMaster />;
 case 'JOURNAL_VOUCHERS': return <JournalVoucherManager />;
 case 'INVENTORY_VOUCHERS': return <InventoryVouchers />;
 case 'GENERAL_LEDGER': return <GeneralLedger accountId={selectedPartyId} />;
 case 'STOCK_SUMMARY': return <StockSummary />;
 case 'TRIAL_BALANCE': return <FinancialStatements type="TRIAL_BALANCE" />;
 case 'PROFIT_LOSS': return <FinancialStatements type="PROFIT_LOSS" />;
 case 'BALANCE_SHEET': return <FinancialStatements type="BALANCE_SHEET" />;
 case 'GST': return <GstReports />;
 case 'TDS': return <TDSManagement />;
 
 case 'AUDIT_TRAIL': return <AuditTrailView />;
 case 'BUDGET': return <BudgetManager />;
 case 'COST_CENTERS': return <CostCenterManager />;
 case 'LEDGER': return <GeneralLedger accountId={selectedPartyId} />;

 default:
 return (
 <div className="flex items-center justify-center h-full text-slate-400 italic font-medium">
 Select a module from the navigator to begin
 </div>
 );
 }
 };

 return (
 <EnterpriseLayout
 title="Metapharsic Accounts"
 sidebarItems={sidebarItems}
 tabs={openTabs.map(tab => ({
 ...tab,
 isActive: activeTab === tab.id,
 onClick: () => setActiveTab(tab.id),
 onClose: () => closeTab(tab.id)
 }))}
 topActions={topActions}
 >
 {renderTabContent()}
 </EnterpriseLayout>
 );
};

export default StrategicAccounts;


