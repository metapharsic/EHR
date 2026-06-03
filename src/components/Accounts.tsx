/**
 * REFACTORED ACCOUNTS COMPONENT
 * Uses EnterpriseLayout + useDataFetch patterns
 * Standardized for Metapharsic ERP Unified Design System
 */

import React, { useState, useMemo } from 'react';
import { 
 FileText, User, Plus, TrendingUp, RefreshCcw, BookOpen,
 Grid, Shield, Zap, LayoutDashboard, Package, Scale, Landmark, Calculator,
 ArrowUpRight, ArrowDownLeft, Wallet, PieChart
} from 'lucide-react';

// Standardized Layout Components
import { EnterpriseLayout, FilterBar, DataTable, StatCard, Badge } from './UniversalLayout';
import { useDataFetch, useDatabaseStatus, useSearch, usePagination } from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';
import { useNotificationSystem } from '../hooks/useNotifications';
import { formatCurrency, formatDate } from '../utils/formatters';

// Sub-components
import { DayBook } from './DayBook';
import { GeneralLedger } from './GeneralLedger';
import { FinancialStatements } from './FinancialStatements';
import { JournalVoucherManager } from './JournalVoucherManager';
import InventoryHub from './InventoryHub';
import { GodownMaster } from './GodownMaster';
import { BomMaster } from './BomMaster';
import { InventoryVouchers } from './InventoryVouchers';
import { PdcManagement } from './PdcManagement';
import { BankReconciliation } from './BankReconciliation';
import { GstReports } from './GstReports';
import { StockSummary } from './StockSummary';
import Assets from './Assets';
import { CostCenterManager } from './CostCenterManager';
import TDSManagement from './TDSManagement';
import { AuditTrailView } from './AuditTrailView';
import { BudgetManager } from './BudgetManager';
import DailySalesIntelligence from './DailySalesIntelligence';
import CashFlowStatement from './CashFlowStatement';
import AgingAnalysis from './AgingAnalysis';

// Types
import { Party } from '../types';

const Accounts: React.FC = () => {
 const { hasPermission } = useAuth();
 const notify = useNotificationSystem();
 const { status: dbStatus } = useDatabaseStatus();
 const canEdit = hasPermission(['ADMIN', 'FINANCE_MANAGER']);

 // ============================================================
 // 1. DATA FETCHING
 // ============================================================
 
 // Fetch Parties/Accounts
 // Adding accountTypeFilter state here to inject into URL
 const [openTabs, setOpenTabs] = useState<{id: string, label: string}[]>([
 { id: 'FINANCIAL_SUMMARY', label: 'Financial Dashboard' }
 ]);
 const [activeTab, setActiveTab] = useState<string>('FINANCIAL_SUMMARY');
 const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
 const [accountTypeFilter, setAccountTypeFilter] = useState('All');

 const { data: parties, loading: loadingParties, refetch: refetchParties } = useDataFetch<Party[]>(
 `/api/accounting/chart-of-accounts${accountTypeFilter !== 'All' ? `?type=${accountTypeFilter}` : ''}`,
 { cacheTime: 300000 }
 );

 // Fetch Dashboard Stats (In a real app, this might be a separate endpoint)
 // For now, we calculate from parties or use a dedicated endpoint if available
 const { data: dashboardStats, loading: loadingStats } = useDataFetch<any>(
 '/api/accounting/diagnostic' 
 );

 // ============================================================
 // 2. STATE MANAGEMENT
 // ============================================================
 
 // Moved states up to handle the useDataFetch dependency

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
 // 4. SEARCH & PAGINATION (For Parties Tab)
 // ============================================================
 
 const { query: partySearch, setQuery: setPartySearch, results: filteredParties } = useSearch<any>(
 parties || [],
 ['account_name', 'account_code', 'account_group', 'name', 'city', 'mobile'] as string[]
 );

 const partyPagination = usePagination<Party>(filteredParties, 15);

 // ============================================================
 // 5. CALCULATED STATS
 // ============================================================
 
 const totals = useMemo(() => {
 if (!parties) return { receivables: 0, payables: 0, net: 0 };
 
 // Fallback to openingBalance if currentBalance is not provided by the API
 const getBalance = (p: any) => Number(p.current_balance || p.opening_balance || 0);
 
 const rec = parties.filter(p => getBalance(p) > 0).reduce((acc, p) => acc + getBalance(p), 0);
 const pay = parties.filter(p => getBalance(p) < 0).reduce((acc, p) => acc + Math.abs(getBalance(p)), 0);
 
 return {
 receivables: rec,
 payables: pay,
 net: rec - pay
 };
 }, [parties]);

 // ============================================================
 // 6. SIDEBAR & TOP ACTIONS
 // ============================================================

 const sidebarItems = [
 { id: 'FINANCIAL_SUMMARY', label: 'Dashboard', icon: <LayoutDashboard size={18}/>, onClick: () => openTab('FINANCIAL_SUMMARY', 'Dashboard'), isActive: activeTab === 'FINANCIAL_SUMMARY', group: 'Overview' },
 { id: 'DAY_BOOK', label: 'Day Book', icon: <BookOpen size={18}/>, onClick: () => openTab('DAY_BOOK', 'Day Book'), isActive: activeTab === 'DAY_BOOK', group: 'Overview' },
 
 { id: 'PARTIES', label: 'Chart of Accounts', icon: <User size={18}/>, onClick: () => openTab('PARTIES', 'Chart of Accounts'), isActive: activeTab === 'PARTIES', group: 'Masters' },
 { id: 'INVENTORY_HUB', label: 'Inventory Hub', icon: <Package size={18}/>, onClick: () => openTab('INVENTORY_HUB', 'Inventory Hub'), isActive: activeTab === 'INVENTORY_HUB', group: 'Masters' },
 { id: 'GODOWN_MASTER', label: 'Godown Master', icon: <Package size={18}/>, onClick: () => openTab('GODOWN_MASTER', 'Godown Master'), isActive: activeTab === 'GODOWN_MASTER', group: 'Masters' },
 { id: 'BOM_MASTER', label: 'Bill of Materials', icon: <Grid size={18}/>, onClick: () => openTab('BOM_MASTER', 'Bill of Materials'), isActive: activeTab === 'BOM_MASTER', group: 'Masters' },
 
 { id: 'JOURNAL_VOUCHERS', label: 'Journal Entry', icon: <FileText size={18}/>, onClick: () => openTab('JOURNAL_VOUCHERS', 'Journal Entry'), isActive: activeTab === 'JOURNAL_VOUCHERS', group: 'Transactions' },
 { id: 'INVENTORY_VOUCHERS', label: 'Inventory Vouchers', icon: <Package size={18}/>, onClick: () => openTab('INVENTORY_VOUCHERS', 'Inventory Vouchers'), isActive: activeTab === 'INVENTORY_VOUCHERS', group: 'Transactions' },
 
 { id: 'GENERAL_LEDGER', label: 'General Ledger', icon: <FileText size={18}/>, onClick: () => openTab('GENERAL_LEDGER', 'General Ledger'), isActive: activeTab === 'GENERAL_LEDGER', group: 'Reports' },
 { id: 'STOCK_SUMMARY', label: 'Stock Summary', icon: <Package size={18}/>, onClick: () => openTab('STOCK_SUMMARY', 'Stock Summary'), isActive: activeTab === 'STOCK_SUMMARY', group: 'Reports' },
 { id: 'TRIAL_BALANCE', label: 'Trial Balance', icon: <Scale size={18}/>, onClick: () => openTab('TRIAL_BALANCE', 'Trial Balance'), isActive: activeTab === 'TRIAL_BALANCE', group: 'Reports' },
 { id: 'PROFIT_LOSS', label: 'Profit & Loss', icon: <TrendingUp size={18}/>, onClick: () => openTab('PROFIT_LOSS', 'Profit & Loss'), isActive: activeTab === 'PROFIT_LOSS', group: 'Reports' },
 { id: 'BALANCE_SHEET', label: 'Balance Sheet', icon: <Landmark size={18}/>, onClick: () => openTab('BALANCE_SHEET', 'Balance Sheet'), isActive: activeTab === 'BALANCE_SHEET', group: 'Reports' },
 { id: 'CASH_FLOW', label: 'Cash Flow', icon: <TrendingUp size={18}/>, onClick: () => openTab('CASH_FLOW', 'Cash Flow'), isActive: activeTab === 'CASH_FLOW', group: 'Reports' },
 { id: 'AGING_ANALYSIS', label: 'Aging Analysis', icon: <FileText size={18}/>, onClick: () => openTab('AGING_ANALYSIS', 'Aging Analysis'), isActive: activeTab === 'AGING_ANALYSIS', group: 'Reports' },
 
 { id: 'GST', label: 'GST Compliance', icon: <Shield size={18}/>, onClick: () => openTab('GST', 'GST Compliance'), isActive: activeTab === 'GST', group: 'Compliance' },
 { id: 'TDS', label: 'TDS Management', icon: <Calculator size={18}/>, onClick: () => openTab('TDS', 'TDS Management'), isActive: activeTab === 'TDS', group: 'Compliance' },
 
 { id: 'AI_REPORTS', label: 'AI Insights', icon: <Zap size={18}/>, onClick: () => openTab('AI_REPORTS', 'AI Insights'), isActive: activeTab === 'AI_REPORTS', group: 'Enterprise' },
 { id: 'BUDGET', label: 'Budget Manager', icon: <Calculator size={18}/>, onClick: () => openTab('BUDGET', 'Budget Manager'), isActive: activeTab === 'BUDGET', group: 'Enterprise' },
 { id: 'ASSETS', label: 'Fixed Assets', icon: <Landmark size={18}/>, onClick: () => openTab('ASSETS', 'Fixed Assets'), isActive: activeTab === 'ASSETS', group: 'Enterprise' },
 { id: 'COST_CENTERS', label: 'Cost Centers', icon: <PieChart size={18}/>, onClick: () => openTab('COST_CENTERS', 'Cost Centers'), isActive: activeTab === 'COST_CENTERS', group: 'Enterprise' },
 { id: 'AUDIT_TRAIL', label: 'Audit Trail', icon: <Shield size={18}/>, onClick: () => openTab('AUDIT_TRAIL', 'Audit Trail'), isActive: activeTab === 'AUDIT_TRAIL', group: 'Enterprise' },
 ];

 const topActions = [
 { label: 'New Voucher', onClick: () => openTab('JOURNAL_VOUCHERS', 'Journal Entry'), icon: <Plus size={14}/> },
 { label: 'Trial Balance', onClick: () => openTab('TRIAL_BALANCE', 'Trial Balance'), icon: <FileText size={14}/> },
 { label: 'Refresh', onClick: () => { refetchParties(); notify.success('Financial data synchronized'); }, icon: <RefreshCcw size={14}/> }
 ];

 // ============================================================
 // 7. RENDER LOGIC
 // ============================================================

 const renderTabContent = () => {
 switch (activeTab) {
 case 'FINANCIAL_SUMMARY':
 return (
 <div className="space-y-8 animate-fadeIn">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <StatCard label="Total Receivables" value={formatCurrency(totals.receivables)} icon={<ArrowUpRight size={24}/>} color="blue" />
 <StatCard label="Total Payables" value={formatCurrency(totals.payables)} icon={<ArrowDownLeft size={24}/>} color="rose" />
 <StatCard label="Net Cash Flow" value={formatCurrency(totals.net)} icon={<Wallet size={24}/>} color="emerald" />
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
 <p className="font-bold text-lg">{new Date().toLocaleTimeString()}</p>
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
 <div>
 <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Chart of Accounts</h3>
 <p className="text-sm text-slate-500 font-medium mt-1">Master list of all ledgers, debtors, and creditors</p>
 </div>
 {canEdit && (
 <button className="px-6 py-3 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent transition-all flex items-center gap-2 shadow-none shadow-none">
 <Plus size={18} /> Add New Account
 </button>
 )}
 </div>
 
 <FilterBar 
 searchValue={partySearch}
 onSearchChange={setPartySearch}
 searchPlaceholder="Search by name, code or group..."
 onRefine={() => { refetchParties(); notify.info('Accounts data synchronized'); }}
 filters={[
 { 
 label: 'Account Type', 
 value: accountTypeFilter, 
 onChange: (val) => setAccountTypeFilter(val as string), 
 options: ['All', 'Asset', 'Liability', 'Income', 'Expense', 'Equity'] 
 }
 ]}
 />
 
 <DataTable 
 columns={[
 { key: 'account_code', label: 'Code', width: '10%' },
 { key: 'account_name', label: 'Account Name', width: '30%' },
 { key: 'account_type', label: 'Type', width: '15%', format: (v) => <Badge value={v} variant={v === 'Asset' || v === 'Income' ? 'success' : 'danger'} /> },
 { key: 'account_group', label: 'Group', width: '15%' },
 { key: 'current_balance', label: 'Live Balance', width: '20%', align: 'right', format: (v, row) => `₹${Math.abs(v || (row as any).opening_balance || 0).toLocaleString()} ${(v || 0) >= 0 ? 'Dr' : 'Cr'}` },
 { key: 'actions', label: 'View', width: '10%', align: 'center', format: (_, row) => (
 <button onClick={() => { setSelectedPartyId(row.id); openTab('LEDGER', 'General Ledger'); }} className="text-accent hover:underline font-bold text-xs uppercase tracking-widest">Detail</button>
 )}
 ]}
 data={partyPagination.paginatedData}
 loading={loadingParties}
 />
 
 {/* Pagination Placeholder */}
 {partyPagination.totalPages > 1 && (
 <div className="flex justify-end gap-2 mt-4">
 <button onClick={() => partyPagination.goToPage(partyPagination.currentPage - 1)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-50">PREV</button>
 <span className="px-4 py-2 text-xs font-bold text-slate-400">PAGE {partyPagination.currentPage} OF {partyPagination.totalPages}</span>
 <button onClick={() => partyPagination.goToPage(partyPagination.currentPage + 1)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-50">NEXT</button>
 </div>
 )}
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
 case 'CASH_FLOW': return <CashFlowStatement />;
 case 'AGING_ANALYSIS': return <AgingAnalysis />;
 case 'GST': return <GstReports />;
 case 'TDS': return <TDSManagement />;
 case 'AUDIT_TRAIL': return <AuditTrailView />;
 case 'BUDGET': return <BudgetManager />;
 case 'ASSETS': return <Assets />;
 case 'COST_CENTERS': return <CostCenterManager />;

 case 'LEDGER':
 return <GeneralLedger accountId={selectedPartyId} />;

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
 subtitle="Financial Intelligence & General Ledger"
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

export default Accounts;


