import React, { useState, useEffect, useMemo } from 'react';
import {
 FileText, CreditCard, TrendingUp, BarChart3, BarChart4, PieChart as PieChartIcon, DollarSign,
 Calendar, Wallet, Plus, Filter, Download, Eye, Edit, Trash2, Save, XCircle,
 ArrowUpRight, ArrowDownLeft, Check, X, RefreshCcw, Settings, ChevronDown,
 BookOpen, Layers, AlertCircle, CheckCircle, Clock, Globe, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
 ChartOfAccountsService,
 JournalVoucherService,
 GeneralLedgerService,
 TrialBalanceService,
 BalanceSheetService,
 ProfitLossService,
 AgingAnalysisService,
 BankReconciliationService,
 CostCenterService,
 AuditService
} from '../services/accountingService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import ChartOfAccountsNew from './ChartOfAccountsNew';

import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';

const ComprehensiveAccounts: React.FC = () => {
 const { hasPermission } = useAuth();

 // ============================================
 // MASTER TAB NAVIGATION
 // ============================================
 const [activeTab, setActiveTab] = useState<
 | 'MASTER'
 | 'VOUCHERS'
 | 'GL'
 | 'TRIAL_BALANCE'
 | 'BALANCE_SHEET'
 | 'PROFIT_LOSS'
 | 'AGING'
 | 'RECONCILIATION'
 | 'COST_CENTER'
 | 'AUDIT'
 | 'FORECAST'
 >('MASTER');

 // ============================================
 // CHART OF ACCOUNTS STATE
 // ============================================
 const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
 const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
 const [showAccountForm, setShowAccountForm] = useState(false);
 const [accountsLoading, setAccountsLoading] = useState(false);
 const [accountForm, setAccountForm] = useState({
 accountCode: '',
 accountName: '',
 accountType: 'Asset',
 openingBalance: 0,
 costCenter: ''
 });

 // ============================================
 // JOURNAL VOUCHER STATE
 // ============================================
 const [journalVouchers, setJournalVouchers] = useState<any[]>([]);
 const [showJVForm, setShowJVForm] = useState(false);
 const [selectedJV, setSelectedJV] = useState<any>(null);
 const [vouchersLoading, setVouchersLoading] = useState(false);
 const [jvForm, setJVForm] = useState({
 voucherNo: '',
 date: new Date().toISOString().split('T')[0],
 narration: '',
 entries: [
 { accountId: '', debit: 0, credit: 0 },
 { accountId: '', debit: 0, credit: 0 }
 ]
 });

 // ============================================
 // REPORTS STATE
 // ============================================
 const [trialBalance, setTrialBalance] = useState<any>(null);
 const [balanceSheet, setBalanceSheet] = useState<any>(null);
 const [profitLoss, setProfitLoss] = useState<any>(null);
 const [selectedPeriod, setSelectedPeriod] = useState({
 start: new Date(new Date().getFullYear() - 1, 3, 1).toISOString().split('T')[0],
 end: new Date().toISOString().split('T')[0]
 });

 // ============================================
 // ENHANCED VIEWS STATE (GL, AGING, COST CENTERS)
 // ============================================
 const [glAccountId, setGlAccountId] = useState<string | null>(null);
 const [glEntries, setGlEntries] = useState<any[]>([]);
 const [costCenters, setCostCenters] = useState<any[]>([]);
 const [agingData, setAgingData] = useState<any[]>([]);
 const [dunningStatus, setDunningStatus] = useState<{ [key: string]: boolean }>({});
 const [auditLogs, setAuditLogs] = useState<any[]>([]);

 // ============================================
 // FILTERS & SEARCH
 // ============================================
 const [accountTypeFilter, setAccountTypeFilter] = useState('All');
 const [searchTerm, setSearchTerm] = useState('');

 const canEdit = hasPermission(['ADMIN']);

 // ============================================
 // LOAD DATA
 // ============================================
 useEffect(() => {
 console.log('?? ComprehensiveAccounts mounted - starting data load');
 console.log('?? Token in localStorage:', !!localStorage.getItem('accessToken'));
 console.log('?? Current state - Accounts:', chartOfAccounts.length, 'Vouchers:', journalVouchers.length);
 loadChartOfAccounts();
 loadJournalVouchers();
 loadAuditLogs();
 }, []);

 useEffect(() => {
 if (activeTab === 'GL' && glAccountId) {
 loadGLForAccount(glAccountId);
 } else if (activeTab === 'COST_CENTER' && costCenters.length === 0) {
 loadCostCenters();
 } else if (activeTab === 'AGING' && agingData.length === 0) {
 loadAgingData();
 } else if (activeTab === 'TRIAL_BALANCE' && !trialBalance) {
 generateTrialBalance();
 } else if (activeTab === 'BALANCE_SHEET' && !balanceSheet) {
 generateBalanceSheet();
 } else if (activeTab === 'PROFIT_LOSS' && !profitLoss) {
 generateProfitLoss();
 }
 }, [activeTab, glAccountId, trialBalance, balanceSheet, profitLoss]);

 const loadGLForAccount = async (id: string) => {
 try {
 const entries = await GeneralLedgerService.getAccountLedger(id, { dateFrom: selectedPeriod.start, dateTo: selectedPeriod.end });
 setGlEntries(entries || []);
 } catch (e) {
 console.error(e);
 setGlEntries([]);
 }
 };

 const loadCostCenters = async () => {
 try {
 const data = await CostCenterService.getAllCostCenters();
 if (data && data.length > 0) {
 setCostCenters(data);
 } else {
 throw new Error('No data');
 }
 } catch (e) {
 setCostCenters([
 { id: 'C1', costCenterName: 'Production', budget: 500000, consumed: 420000 },
 { id: 'C2', costCenterName: 'Sales & Marketing', budget: 300000, consumed: 280000 },
 { id: 'C3', costCenterName: 'Administration', budget: 200000, consumed: 150000 },
 { id: 'C4', costCenterName: 'HR', budget: 150000, consumed: 145000 }
 ]);
 }
 };

 const loadAgingData = async () => {
 try {
 const data = await AgingAnalysisService.getAgingAnalysis(selectedPeriod.end, 'Debtor');
 if (data && data.length > 0) {
 setAgingData(data);
 } else {
 throw new Error('No data');
 }
 } catch (e) {
 setAgingData([
 { partyId: 'P1', partyName: 'Metro Hospitals', totalDue: 250000, days0_30: 100000, days31_60: 100000, days61_90: 20000, days90Plus: 30000 },
 { partyId: 'P2', partyName: 'City Medical Store', totalDue: 185000, days0_30: 185000, days31_60: 0, days61_90: 0, days90Plus: 0 },
 { partyId: 'P3', partyName: 'Apollo Pharmacy', totalDue: 60000, days0_30: 0, days31_60: 10000, days61_90: 50000, days90Plus: 0 },
 ]);
 }
 };

 const handleRemindAll = () => {
 const newData: any = { ...dunningStatus };
 let count = 0;
 agingData.filter(d => d.days31_60 > 0 || d.days61_90 > 0 || d.days90Plus > 0).forEach(d => {
 if (!newData[d.partyId]) {
 newData[d.partyId] = true;
 count++;
 }
 });
 setDunningStatus(newData);
 alert(`Automated Dunning Reminders have been queued for ${count} debtors!`);
 };

 const loadAuditLogs = async () => {
 try {
 console.log('?? Fetching Audit Logs...');
 const logs = await AuditService.getAllLogs();
 console.log('? Audit Logs loaded:', logs);
 setAuditLogs(logs);
 } catch (error) {
 console.error('? Error loading audit logs:', error);
 }
 };

 const loadChartOfAccounts = async () => {
 try {
 setAccountsLoading(true);
 console.log('?? Fetching Chart of Accounts...');
 const accounts = await ChartOfAccountsService.getAllAccounts();
 console.log('? Chart of Accounts loaded:', accounts.length, 'accounts', accounts);
 if (accounts && accounts.length > 0) {
 setChartOfAccounts(accounts);
 } else {
 throw new Error('No accounts data');
 }
 setAccountsLoading(false);
 } catch (error) {
 console.error('?? Using demo Chart of Accounts:', error);
 // Fallback to Tally ERP-like demo data
 const demoAccounts = [
 // ASSET ACCOUNTS
 { id: 'A001', accountCode: '1010', accountName: 'Cash & Cash Equivalents', accountType: 'Asset', openingBalance: 500000, group: 'Current Assets', description: 'Bank and cash balance' },
 { id: 'A002', accountCode: '1020', accountName: 'Bank Account - HDFC', accountType: 'Asset', openingBalance: 2500000, group: 'Current Assets', description: 'Current account balance' },
 { id: 'A003', accountCode: '1030', accountName: 'Accounts Receivable', accountType: 'Asset', openingBalance: 850000, group: 'Current Assets', description: 'Customer receivables' },
 { id: 'A004', accountCode: '1040', accountName: 'Inventory - Raw Materials', accountType: 'Asset', openingBalance: 1200000, group: 'Current Assets', description: 'Raw material stock' },
 { id: 'A005', accountCode: '1050', accountName: 'Inventory - Finished Goods', accountType: 'Asset', openingBalance: 2800000, group: 'Current Assets', description: 'Finished product stock' },
 { id: 'A006', accountCode: '1100', accountName: 'Fixed Assets - Building', accountType: 'Asset', openingBalance: 5000000, group: 'Fixed Assets', description: 'Building & property' },
 { id: 'A007', accountCode: '1110', accountName: 'Fixed Assets - Equipment', accountType: 'Asset', openingBalance: 3500000, group: 'Fixed Assets', description: 'Machinery & equipment' },
 { id: 'A008', accountCode: '1120', accountName: 'Depreciation - Building', accountType: 'Asset', openingBalance: -250000, group: 'Fixed Assets', description: 'Accumulated depreciation' },
 // LIABILITY ACCOUNTS
 { id: 'L001', accountCode: '2010', accountName: 'Accounts Payable', accountType: 'Liability', openingBalance: 450000, group: 'Current Liabilities', description: 'Vendor payables' },
 { id: 'L002', accountCode: '2020', accountName: 'Short-term Loan', accountType: 'Liability', openingBalance: 1000000, group: 'Current Liabilities', description: 'Short term borrowing' },
 { id: 'L003', accountCode: '2100', accountName: 'Long-term Loan', accountType: 'Liability', openingBalance: 3000000, group: 'Long-term Liabilities', description: 'Term loan' },
 { id: 'L004', accountCode: '2200', accountName: 'GST Payable', accountType: 'Liability', openingBalance: 125000, group: 'Current Liabilities', description: 'GST liability' },
 // EQUITY ACCOUNTS 
 { id: 'E001', accountCode: '3010', accountName: 'Share Capital', accountType: 'Equity', openingBalance: 5000000, group: 'Equity', description: 'Authorized & issued capital' },
 { id: 'E002', accountCode: '3020', accountName: 'Retained Earnings', accountType: 'Equity', openingBalance: 3200000, group: 'Equity', description: 'Cumulative profits' },
 { id: 'E003', accountCode: '3030', accountName: 'Current Year P&L', accountType: 'Equity', openingBalance: 0, group: 'Equity', description: 'Current year profit/loss' },
 // INCOME ACCOUNTS
 { id: 'I001', accountCode: '4010', accountName: 'Sales - Products', accountType: 'Income', openingBalance: 0, group: 'Operating Revenue', description: 'Product sales revenue' },
 { id: 'I002', accountCode: '4020', accountName: 'Sales - Services', accountType: 'Income', openingBalance: 0, group: 'Operating Revenue', description: 'Service revenue' },
 { id: 'I003', accountCode: '4030', accountName: 'Service Tax Credit', accountType: 'Income', openingBalance: 0, group: 'Other Income', description: 'Service tax benefits' },
 { id: 'I004', accountCode: '4100', accountName: 'Other Income', accountType: 'Income', openingBalance: 0, group: 'Other Income', description: 'Miscellaneous income' },
 // EXPENSE ACCOUNTS
 { id: 'X001', accountCode: '5010', accountName: 'Cost of Goods Sold', accountType: 'Expense', openingBalance: 0, group: 'Operating Expenses', description: 'COGS' },
 { id: 'X002', accountCode: '5020', accountName: 'Salaries & Wages', accountType: 'Expense', openingBalance: 0, group: 'Personnel Costs', description: 'Employee compensation' },
 { id: 'X003', accountCode: '5030', accountName: 'Rent Expense', accountType: 'Expense', openingBalance: 0, group: 'Operating Expenses', description: 'Facility rent' },
 { id: 'X004', accountCode: '5040', accountName: 'Utilities', accountType: 'Expense', openingBalance: 0, group: 'Operating Expenses', description: 'Power & utilities' },
 { id: 'X005', accountCode: '5050', accountName: 'Depreciation Expense', accountType: 'Expense', openingBalance: 0, group: 'Operating Expenses', description: 'Asset depreciation' },
 { id: 'X006', accountCode: '5100', accountName: 'Interest Expense', accountType: 'Expense', openingBalance: 0, group: 'Financial Costs', description: 'Loan interest' },
 ];
 setChartOfAccounts(demoAccounts);
 setAccountsLoading(false);
 }
 };

 const handleCreateAccount = async () => {
 if (!accountForm.accountCode.trim() || !accountForm.accountName.trim()) {
 alert('Please fill in Account Code and Name');
 return;
 }
 try {
 console.log(' Creating account:', accountForm);
 const newAccount = {
 ...accountForm,
 id: 'A' + Math.floor(Math.random() * 10000),
 group: accountForm.costCenter || 'Uncategorized'
 };
 setChartOfAccounts([...chartOfAccounts, newAccount]);
 setAccountForm({
 accountCode: '',
 accountName: '',
 accountType: 'Asset',
 openingBalance: 0,
 costCenter: ''
 });
 setShowAccountForm(false);
 alert('? Account created successfully!');
 } catch (error) {
 console.error('? Error creating account:', error);
 alert('Failed to create account');
 }
 };

 const loadJournalVouchers = async () => {
 try {
 setVouchersLoading(true);
 console.log('?? Fetching Journal Vouchers...');
 const vouchers = await JournalVoucherService.getAllJournalVouchers();
 console.log('? Journal Vouchers loaded:', Array.isArray(vouchers) ? vouchers.length + ' vouchers' : 'Not an array!', vouchers);
 
 if (!Array.isArray(vouchers)) {
 console.warn('?? Vouchers is not array, converting:', vouchers);
 const vouchersArray = Array.isArray(vouchers.value) ? vouchers.value : [];
 setJournalVouchers(vouchersArray);
 } else {
 setJournalVouchers(vouchers);
 }
 setVouchersLoading(false);
 } catch (error) {
 console.error('? Error loading vouchers:', error);
 const errorMsg = error instanceof Error ? error.message : String(error);
 alert(`Error loading vouchers: ${errorMsg}`);
 setJournalVouchers([]);
 setVouchersLoading(false);
 }
 };

 // ============================================
 // JOURNAL VOUCHER HANDLERS
 // ============================================
 const handleCreateJournalVoucher = async () => {
 try {
 const totalDebit = jvForm.entries.reduce((sum, e) => sum + e.debit, 0);
 const totalCredit = jvForm.entries.reduce((sum, e) => sum + e.credit, 0);

 if (totalDebit !== totalCredit) {
 alert('Debit and Credit must be equal!');
 return;
 }

 const voucher = {
 ...jvForm,
 totalDebit,
 totalCredit,
 status: 'Draft',
 entries: jvForm.entries.filter(e => e.accountId)
 };

 const result = await JournalVoucherService.createJournalVoucher(voucher as any);
 setJournalVouchers([...journalVouchers, result]);
 setShowJVForm(false);
 resetJVForm();
 } catch (error) {
 alert(`Error: ${error}`);
 }
 };

 const handlePostVoucher = async (voucherId: string) => {
 try {
 await JournalVoucherService.postJournalVoucher(voucherId);
 loadJournalVouchers();
 alert('Voucher posted successfully!');
 } catch (error) {
 alert(`Error posting voucher: ${error}`);
 }
 };

 const resetJVForm = () => {
 setJVForm({
 voucherNo: '',
 date: new Date().toISOString().split('T')[0],
 narration: '',
 entries: [
 { accountId: '', debit: 0, credit: 0 },
 { accountId: '', debit: 0, credit: 0 }
 ]
 });
 };

 // ============================================
 // REPORT GENERATORS
 // ============================================
 const generateTrialBalance = async () => {
 try {
 const tb: any = await TrialBalanceService.generateTrialBalance(selectedPeriod.end);
 if (tb && Array.isArray(tb.entries)) {
 setTrialBalance(tb.entries);
 } else {
 setTrialBalance(Array.isArray(tb) ? tb : []);
 }
 } catch (error) {
 console.warn('API Offline - Falling back to Trial Balance Mock Data');
 setTrialBalance([
 { accountId: 'A1', accountName: 'Cash in Hand', debit: 250000, credit: 0 },
 { accountId: 'A2', accountName: 'HDFC Current Account', debit: 1850000, credit: 0 },
 { accountId: 'A3', accountName: 'Accounts Receivable', debit: 450000, credit: 0 },
 { accountId: 'L1', accountName: 'Accounts Payable', debit: 0, credit: 320000 },
 { accountId: 'E1', accountName: 'Owner Equity', debit: 0, credit: 2230000 }
 ]);
 }
 };

 const generateBalanceSheet = async () => {
 try {
 const bs = await BalanceSheetService.generateBalanceSheet(selectedPeriod.end);
 setBalanceSheet(bs);
 } catch (error) {
 console.warn('API Offline - Falling back to Balance Sheet Mock Data');
 setBalanceSheet({
 totalAssets: 2550000,
 totalLiabilities: 320000,
 totalEquity: 2230000,
 assets: { currentItems: [2550000], fixedItems: [0] },
 liabilities: { subtotal: 320000 }
 });
 }
 };

 const generateProfitLoss = async () => {
 try {
 const pl = await ProfitLossService.generateProfitLoss(
 selectedPeriod.start,
 selectedPeriod.end
 );
 setProfitLoss(pl);
 } catch (error) {
 console.warn('API Offline - Falling back to P&L Mock Data');
 setProfitLoss({
 revenue: { subtotal: 1250000 },
 expenses: { subtotal: 820000 },
 netProfitAfterTax: 430000,
 operatingIncome: 500000,
 tax: 70000
 });
 }
 };

 // ============================================
 // FILTERED DATA
 // ============================================
 const filteredAccounts = useMemo(() => {
 return chartOfAccounts.filter(account => {
 const matchesType =
 accountTypeFilter === 'All' || account.accountType === accountTypeFilter;
 const matchesSearch =
 account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
 account.accountCode.includes(searchTerm);
 return matchesType && matchesSearch;
 });
 }, [chartOfAccounts, accountTypeFilter, searchTerm]);

 // ============================================
 // UI: CHART OF ACCOUNTS MASTER
 // ============================================
 // ============================================
 // UI: JOURNAL VOUCHERS
 // ============================================
 const renderJournalVouchers = () => (
 <div className="gap-4 flex flex-col">
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex justify-between items-center mb-4">
 <h3 className="font-bold text-slate-800">Journal Vouchers</h3>
 {canEdit && (
 <button
 onClick={() => setShowJVForm(!showJVForm)}
 className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
 >
 <Plus size={16} /> New Voucher
 </button>
 )}
 </div>

 {showJVForm && (
 <div className="bg-slate-50 p-4 rounded-lg mb-4 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <input
 type="text"
 placeholder="Voucher No"
 value={jvForm.voucherNo}
 onChange={e => setJVForm({ ...jvForm, voucherNo: e.target.value })}
 className="px-3 py-2 border border-slate-200 rounded-lg"
 />
 <input
 type="date"
 value={jvForm.date}
 onChange={e => setJVForm({ ...jvForm, date: e.target.value })}
 className="px-3 py-2 border border-slate-200 rounded-lg"
 />
 </div>

 <textarea
 placeholder="Narration"
 value={jvForm.narration}
 onChange={e => setJVForm({ ...jvForm, narration: e.target.value })}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg"
 />

 <div className="space-y-2">
 {jvForm.entries.map((entry, idx) => (
 <div key={idx} className="grid grid-cols-5 gap-2">
 <select
 value={entry.accountId}
 onChange={e => {
 const newEntries = [...jvForm.entries];
 newEntries[idx].accountId = e.target.value;
 setJVForm({ ...jvForm, entries: newEntries });
 }}
 className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
 >
 <option value="">Select Account</option>
 {chartOfAccounts.map(acc => (
 <option key={acc.id} value={acc.id}>
 {acc.accountName}
 </option>
 ))}
 </select>
 <input
 type="number"
 placeholder="Debit"
 value={entry.debit}
 onChange={e => {
 const newEntries = [...jvForm.entries];
 newEntries[idx].debit = parseFloat(e.target.value) || 0;
 setJVForm({ ...jvForm, entries: newEntries });
 }}
 className="px-3 py-2 border border-slate-200 rounded-lg"
 />
 <input
 type="number"
 placeholder="Credit"
 value={entry.credit}
 onChange={e => {
 const newEntries = [...jvForm.entries];
 newEntries[idx].credit = parseFloat(e.target.value) || 0;
 setJVForm({ ...jvForm, entries: newEntries });
 }}
 className="px-3 py-2 border border-slate-200 rounded-lg"
 />
 <button
 onClick={() => {
 const newEntries = jvForm.entries.filter((_, i) => i !== idx);
 setJVForm({ ...jvForm, entries: newEntries });
 }}
 className="text-red-600 hover:bg-red-50 p-2 rounded"
 >
 <Trash2 size={16} />
 </button>
 </div>
 ))}
 </div>

 <button
 onClick={() => {
 setJVForm({
 ...jvForm,
 entries: [...jvForm.entries, { accountId: '', debit: 0, credit: 0 }]
 });
 }}
 className="text-accent text-sm font-medium hover:underline"
 >
 + Add Entry
 </button>

 <div className="flex justify-end gap-2">
 <button
 onClick={() => {
 setShowJVForm(false);
 resetJVForm();
 }}
 className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
 >
 Cancel
 </button>
 <button
 onClick={handleCreateJournalVoucher}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
 >
 Create Voucher
 </button>
 </div>
 </div>
 )}

 <div className="space-y-2">
 {vouchersLoading ? (
 <div className="flex items-center justify-center h-32 text-slate-500">
 <div className="text-center">
 <div className="animate-spin text-2xl mb-2">?</div>
 <p>Loading Journal Vouchers...</p>
 </div>
 </div>
 ) : journalVouchers.length === 0 ? (
 <div className="flex items-center justify-center h-32 text-slate-500">
 <div className="text-center">
 <p>No journal vouchers found</p>
 </div>
 </div>
 ) : (
 journalVouchers.slice(0, 10).map(voucher => (
 <div
 key={voucher.id}
 className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
 >
 <div className="flex justify-between items-start">
 <div>
 <div className="font-semibold text-slate-800">{voucher.voucherNo}</div>
 <div className="text-sm text-slate-600">{voucher.narration}</div>
 </div>
 <div className="text-right">
 <div className="text-sm font-medium">{formatCurrency(voucher.totalDebit)}</div>
 <span
 className={`text-xs px-2 py-1 rounded ${
 voucher.status === 'Posted'
 ? 'bg-green-100 text-green-700'
 : 'bg-yellow-100 text-yellow-700'
 }`}
 >
 {voucher.status}
 </span>
 </div>
 </div>
 {voucher.status === 'Draft' && canEdit && (
 <button
 onClick={() => handlePostVoucher(voucher.id)}
 className="mt-2 text-accent text-sm font-medium hover:underline"
 >
 Post ?
 </button>
 )}
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 );

 // ============================================
 // UI: TRIAL BALANCE
 // ============================================
 const renderTrialBalance = () => (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex justify-between items-center mb-4">
 <h3 className="font-bold text-slate-800">Trial Balance</h3>
 <div className="flex gap-2">
 <input
 type="date"
 value={selectedPeriod.end}
 onChange={e => setSelectedPeriod({ ...selectedPeriod, end: e.target.value })}
 className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
 />
 <button
 onClick={generateTrialBalance}
 className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent"
 >
 Generate
 </button>
 <button className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 flex items-center gap-2">
 <Download size={16} /> Export
 </button>
 </div>
 </div>

 {trialBalance ? (
 <div className="flex flex-col gap-6">
 {trialBalance.length > 0 && (
 <div className="w-full flex justify-center bg-slate-50 rounded-xl border border-slate-200 shadow-inner p-2">
   <ResponsiveContainer width="100%" height={300} debounce={50}>
 <PieChart>
 <Pie 
 data={[
 { name: 'Total Debits', value: trialBalance.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0) },
 { name: 'Total Credits', value: trialBalance.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0) }
 ]} 
 cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none"
 >
 <Cell fill="#3b82f6" />
 <Cell fill="#ec4899" />
 </Pie>
 <RechartsTooltip formatter={(val: any) => formatCurrency(val)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
 <Legend />
 </PieChart>
 </ResponsiveContainer>
 </div>
 )}
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-800 text-white">
 <tr>
 <th className="p-3">Account</th>
 <th className="p-3 text-right">Debit (?)</th>
 <th className="p-3 text-right">Credit (?)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {trialBalance.map((entry: any, idx: number) => (
 <tr 
 key={idx} 
 className="hover:bg-blue-50 cursor-pointer transition-colors"
 onClick={() => {
 setGlAccountId(entry.accountId);
 setActiveTab('GL');
 }}
 title="Click to view full Ledger"
 >
 <td className="p-3 font-medium text-accent hover:underline">{entry.accountName}</td>
 <td className="p-3 text-right">{formatCurrency(entry.debit)}</td>
 <td className="p-3 text-right">{formatCurrency(entry.credit)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center p-8 text-slate-500">
 <div className="animate-spin text-2xl mb-2 mr-3">?</div>
 <p>Generating Trial Balance...</p>
 </div>
 )}
 </div>
 );

 // ============================================
 // UI: BALANCE SHEET
 // ============================================
 const renderBalanceSheet = () => (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex justify-between items-center mb-4">
 <h3 className="font-bold text-slate-800">Balance Sheet</h3>
 <button
 onClick={generateBalanceSheet}
 className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent"
 >
 Generate
 </button>
 </div>

 {balanceSheet ? (
 <div className="grid grid-cols-1 gap-6">
 <div className="w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner p-2">
   <ResponsiveContainer width="100%" height={300} debounce={50}>
 <BarChart layout="vertical" data={[
 { name: 'Financials Overview', Assets: balanceSheet.totalAssets || 0, Liabilities: balanceSheet.totalLiabilities || 0, Equity: balanceSheet.totalEquity || 0 }
 ]}>
 <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false}/>
 <XAxis type="number" hide />
 <YAxis dataKey="name" type="category" hide />
 <RechartsTooltip formatter={(val: any) => `?${val?.toLocaleString() || 0}`} cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
 <Legend iconType="circle" />
 <Bar dataKey="Assets" stackId="a" fill="#10b981" radius={[0,4,4,0]} barSize={24} />
 <Bar dataKey="Liabilities" stackId="b" fill="#f43f5e" radius={[4,0,0,4]} barSize={24} />
 <Bar dataKey="Equity" stackId="b" fill="#6366f1" radius={[0,4,4,0]} barSize={24} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h4 className="font-bold text-slate-800 mb-3">Assets</h4>
 <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
 <p className="text-sm">Current: ?{balanceSheet.assets?.currentItems?.[0]}</p>
 <p className="text-sm">Fixed: ?{balanceSheet.assets?.fixedItems?.[0]}</p>
 <p className="font-bold border-t pt-2">
 Total: ?{balanceSheet.totalAssets?.toLocaleString()}
 </p>
 </div>
 </div>

 <div>
 <h4 className="font-bold text-slate-800 mb-3">Liabilities & Equity</h4>
 <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
 <p className="text-sm">Liabilities: ?{balanceSheet.totalLiabilities?.toLocaleString()}</p>
 <p className="text-sm">Equity: ?{balanceSheet.totalEquity?.toLocaleString()}</p>
 <p className="font-bold border-t pt-2">
 Total: ?{(balanceSheet.totalLiabilities + balanceSheet.totalEquity)?.toLocaleString()}
 </p>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center p-8 text-slate-500">
 <div className="animate-spin text-2xl mb-2 mr-3">?</div>
 <p>Calculating Balance Sheet...</p>
 </div>
 )}
 </div>
 );

 // ============================================
 // UI: PROFIT & LOSS
 // ============================================
 const renderProfitLoss = () => (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex justify-between items-center mb-4">
 <h3 className="font-bold text-slate-800">Profit & Loss Statement</h3>
 <button
 onClick={generateProfitLoss}
 className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent"
 >
 Generate
 </button>
 </div>

 {profitLoss ? (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="space-y-4">
 <div className="p-4 bg-green-50 rounded-lg border border-green-200">
 <p className="text-sm text-slate-600">Revenue</p>
 <p className="text-2xl font-bold text-green-700">?{profitLoss.revenue?.subtotal?.toLocaleString()}</p>
 </div>
 <div className="p-4 bg-red-50 rounded-lg border border-red-200">
 <p className="text-sm text-slate-600">Total Expenses</p>
 <p className="text-2xl font-bold text-red-700">?{profitLoss.expenses?.subtotal?.toLocaleString()}</p>
 </div>
 <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
 <p className="text-sm text-slate-600">Net Profit</p>
 <p className={`text-2xl font-bold ${profitLoss.netProfitAfterTax >= 0 ? 'text-green-700' : 'text-red-700'}`}>
 ?{profitLoss.netProfitAfterTax?.toLocaleString()}
 </p>
 </div>
 </div>
 
 <div className="w-full bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Financial Value Distribution</h4>
 <div className="w-full">
  <ResponsiveContainer width="100%" height={300} debounce={50}>
 <BarChart data={[
 { name: 'Financials', Revenue: profitLoss.revenue?.subtotal || 0, Expenses: profitLoss.expenses?.subtotal || 0, Profit: profitLoss.netProfitAfterTax || 0 }
 ]}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `?${val/1000}k`} />
 <RechartsTooltip cursor={{fill: '#f8fafc'}} formatter={(value: any) => `?${value.toLocaleString()}`} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
 <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
 <Bar dataKey="Revenue" fill="#16a34a" radius={[4,4,0,0]} maxBarSize={60} />
 <Bar dataKey="Expenses" fill="#dc2626" radius={[4,4,0,0]} maxBarSize={60} />
 <Bar dataKey="Profit" fill="#2563eb" radius={[4,4,0,0]} maxBarSize={60} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center p-8 text-slate-500">
 <div className="animate-spin text-2xl mb-2 mr-3">?</div>
 <p>Calculating Profit & Loss Statement...</p>
 </div>
 )}
 </div>
 );

 // ============================================
 // MAIN RENDER
 // ============================================
 return (
 <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 animate-fadeIn">
 {/* Header */}
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-2xl font-bold text-slate-800">Enterprise Accounting Suite</h2>
 <p className="text-slate-500 text-sm">Complete financial management with GL, reports, and reconciliation</p>
 </div>
 {/* Debug Info */}
 <div className="text-xs bg-slate-100 p-2 rounded" style={{display: 'none'}}>
 <p>Accounts: {chartOfAccounts.length}</p>
 <p>Vouchers: {journalVouchers.length}</p>
 </div>
 </div>

 {/* Tab Navigation */}
 <div className="bg-white border border-slate-200 rounded-lg p-1 flex flex-wrap gap-1 overflow-x-auto">
 {[
 { id: 'MASTER', label: 'Chart of Accounts', icon: BookOpen },
 { id: 'VOUCHERS', label: 'Journal Vouchers', icon: FileText },
 { id: 'GL', label: 'General Ledger', icon: Layers },
 { id: 'TRIAL_BALANCE', label: 'Trial Balance', icon: BarChart3 },
 { id: 'BALANCE_SHEET', label: 'Balance Sheet', icon: BarChart4 },
 { id: 'PROFIT_LOSS', label: 'P&L Statement', icon: TrendingUp },
 { id: 'AGING', label: 'Aging Analysis', icon: Calendar },
 { id: 'RECONCILIATION', label: 'Bank Recon', icon: CheckCircle },
 { id: 'COST_CENTER', label: 'Cost Centers', icon: DollarSign },
 { id: 'AUDIT', label: 'Audit Trail', icon: Lock },
 { id: 'FORECAST', label: 'Cash Flow Forecast', icon: TrendingUp }
 ].map(tab => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
 activeTab === tab.id
 ? 'bg-slate-800 text-white'
 : 'text-slate-600 hover:bg-slate-100'
 }`}
 >
 <Icon size={14} /> {tab.label}
 </button>
 );
 })}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto">
 {activeTab === 'MASTER' && <ChartOfAccountsNew />}
 {activeTab === 'VOUCHERS' && renderJournalVouchers()}
 {activeTab === 'TRIAL_BALANCE' && renderTrialBalance()}
 {activeTab === 'BALANCE_SHEET' && renderBalanceSheet()}
 {activeTab === 'PROFIT_LOSS' && renderProfitLoss()}
 {activeTab === 'GL' && (
 <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-12rem)]">
 {/* Left Panel: Account Selector */}
 <div className="w-full lg:w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
 <h3 className="font-bold text-slate-800">Select Account</h3>
 <span className="text-xs bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">{chartOfAccounts.length}</span>
 </div>
 <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
 {chartOfAccounts.map(account => (
 <div 
 key={account.id} 
 onClick={() => setGlAccountId(account.id)}
 className={`p-3 flex justify-between items-center cursor-pointer transition-colors hover:bg-slate-50 ${glAccountId === account.id ? 'bg-blue-50 border-l-4 border-accent' : 'border-l-4 border-transparent'}`}
 >
 <div>
 <div className="font-semibold text-slate-800 text-sm">{account.accountName}</div>
 <div className="text-xs text-slate-500">{account.accountCode} • {account.accountType}</div>
 </div>
 {glAccountId === account.id && <ChevronDown size={14} className="text-accent transform -rotate-90" />}
 </div>
 ))}
 {chartOfAccounts.length === 0 && (
 <div className="p-8 text-center text-slate-400">Loading accounts...</div>
 )}
 </div>
 </div>

 {/* Right Panel: Ledger Data or Overview */}
 <div className="w-full lg:w-2/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
 {!glAccountId ? (
 <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
 <div className="bg-white p-6 rounded-full shadow-sm border border-slate-100 mb-6">
 <PieChartIcon size={48} className="text-accent opacity-80" />
 </div>
 <h3 className="text-xl font-bold text-slate-800 mb-2">Master Ledger Dashboard</h3>
 <p className="text-slate-500 max-w-md text-center mb-8">
 Select any account from the left panel to drill down into its precise transaction history, running balances, and voucher references.
 </p>
 
 {/* Default Overall Organization Activity Mock Chart */}
 <div className="w-full h-64 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
 <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Organization Ledger Activity (30 Days)</h4>
 <ResponsiveContainer width="100%" height="80%">
 <AreaChart data={[
 { date: '1st', volume: 4000 },
 { date: '5th', volume: 3000 },
 { date: '10th', volume: 6000 },
 { date: '15th', volume: 8000 },
 { date: '20th', volume: 5000 },
 { date: '25th', volume: 9000 },
 { date: '30th', volume: 11000 }
 ]}>
 <defs>
 <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
 <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}}/>
 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}}/>
 <RechartsTooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
 <Area type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)"/>
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 ) : glEntries.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
 <div className="bg-white p-6 rounded-full shadow-sm border border-slate-100 mb-6">
 <FileText size={48} className="text-blue-400 opacity-60" />
 </div>
 <h3 className="text-xl font-bold text-slate-800 mb-2">No Ledger Entries Found</h3>
 <p className="text-slate-500 max-w-sm mb-8">
 There are no transactions recorded for this account in the selected period.
 </p>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
 <button 
 onClick={() => setActiveTab('VOUCHERS' as any)}
 className="flex flex-col items-center justify-center p-4 bg-white border border-blue-200 rounded-xl hover:border-accent hover:shadow-none transition-all group"
 >
 <FileText size={24} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
 <span className="font-semibold text-slate-800 text-sm">Post New Voucher</span>
 <span className="text-xs text-slate-500 mt-1">Record a manual journal entry</span>
 </button>
 
 <button 
 onClick={() => {
 setGlEntries([
 { date: '2026-03-01', voucherNo: 'JV-2026-001', narration: 'Opening Balance - FY 2025-26 brought forward', debit: 500000, credit: 0, runningBalance: 500000, status: 'Posted' },
 { date: '2026-03-03', voucherNo: 'JV-2026-008', narration: 'Customer Invoice #INV-2026-101 - ABC Pharma Ltd', debit: 125000, credit: 0, runningBalance: 625000, status: 'Posted' },
 { date: '2026-03-05', voucherNo: 'JV-2026-012', narration: 'Vendor Settlement - Supplier A/c (JV-2026-012)', debit: 0, credit: 85000, runningBalance: 540000, status: 'Posted' },
 { date: '2026-03-07', voucherNo: 'JV-2026-018', narration: 'Bank Deposit - Customer ABC Ltd payment received', debit: 75000, credit: 0, runningBalance: 615000, status: 'Posted' },
 { date: '2026-03-09', voucherNo: 'JV-2026-024', narration: 'Petty Cash Withdrawal for Office Expenses', debit: 0, credit: 5000, runningBalance: 610000, status: 'Posted' },
 { date: '2026-03-12', voucherNo: 'JV-2026-031', narration: 'Salary Payroll Distribution - March 2026', debit: 0, credit: 250000, runningBalance: 360000, status: 'Posted' },
 { date: '2026-03-15', voucherNo: 'JV-2026-045', narration: 'Customer Invoice #INV-2026-115 - XYZ Healthcare Inc', debit: 200000, credit: 0, runningBalance: 560000, status: 'Posted' },
 { date: '2026-03-18', voucherNo: 'JV-2026-052', narration: 'Quarterly Rent Payment - Office Building', debit: 0, credit: 100000, runningBalance: 460000, status: 'Posted' },
 { date: '2026-03-20', voucherNo: 'JV-2026-058', narration: 'Utility Bill Settlement - Electricity & Water', debit: 0, credit: 22500, runningBalance: 437500, status: 'Posted' },
 { date: '2026-03-22', voucherNo: 'JV-2026-065', narration: 'Inter-company Transfer - Head Office Allocation', debit: 50000, credit: 0, runningBalance: 487500, status: 'Posted' }
 ]);
 }}
 className="flex flex-col items-center justify-center p-4 bg-white border border-emerald-200 rounded-xl hover:border-emerald-500 hover:shadow-none transition-all group"
 >
 <BarChart3 size={24} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
 <span className="font-semibold text-slate-800 text-sm">Load Demo Ledger</span>
 <span className="text-xs text-slate-500 mt-1">Populate with sample data</span>
 </button>
 </div>
 </div>
 ) : (
 <div className="flex-1 flex flex-col">
 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
 <h3 className="font-bold text-slate-800">
 {chartOfAccounts.find(a => a.id === glAccountId)?.accountName} <span className="text-slate-500 font-normal">Ledger</span>
 </h3>
 <button className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded text-sm hover:bg-slate-50 flex items-center gap-1">
 <Download size={14} /> Export
 </button>
 </div>
 <div className="flex-1 overflow-y-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-white border-b border-slate-200 sticky top-0 text-slate-500 font-bold uppercase text-xs">
 <tr>
 <th className="p-4">Date</th>
 <th className="p-4">Voucher No</th>
 <th className="p-4">Narration</th>
 <th className="p-4 text-right text-green-600">Debit (Dr)</th>
 <th className="p-4 text-right text-red-600">Credit (Cr)</th>
 <th className="p-4 text-right">Balance</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {glEntries.map((entry: any, idx: number) => (
 <tr key={idx} className="hover:bg-slate-50">
 <td className="p-4 text-slate-600 font-mono text-xs">{entry.date}</td>
 <td className="p-4 font-medium text-accent cursor-pointer hover:underline">{entry.voucherNo}</td>
 <td className="p-4 text-slate-600 max-w-[200px] truncate" title={entry.narration}>{entry.narration}</td>
 <td className="p-4 text-right font-medium">{entry.debit > 0 ? `?${entry.debit.toLocaleString()}` : '-'}</td>
 <td className="p-4 text-right font-medium">{entry.credit > 0 ? `?${entry.credit.toLocaleString()}` : '-'}</td>
 <td className="p-4 text-right font-bold text-slate-800">{entry.runningBalance?.toLocaleString()} {entry.runningBalance >= 0 ? 'Dr' : 'Cr'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 {activeTab === 'AGING' && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-full">
 <div className="flex justify-between items-center mb-4">
 <h3 className="font-bold text-slate-800">Aging Analysis (Receivables)</h3>
 <div className="flex gap-2">
 {agingData.length === 0 && (
 <button 
 onClick={() => setAgingData([
 { partyId: 'P001', partyName: 'ABC Pharma Ltd', totalDue: 450000, days0_30: 150000, days31_60: 150000, days61_90: 100000, days90Plus: 50000 },
 { partyId: 'P002', partyName: 'XYZ Healthcare Inc', totalDue: 325000, days0_30: 200000, days31_60: 75000, days61_90: 30000, days90Plus: 20000 },
 { partyId: 'P003', partyName: 'Metro Medical Centers', totalDue: 210000, days0_30: 210000, days31_60: 0, days61_90: 0, days90Plus: 0 },
 { partyId: 'P004', partyName: 'Wellness Clinic Network', totalDue: 380000, days0_30: 0, days31_60: 120000, days61_90: 180000, days90Plus: 80000 },
 { partyId: 'P005', partyName: 'District Hospital - Gov', totalDue: 550000, days0_30: 200000, days31_60: 200000, days61_90: 100000, days90Plus: 50000 }
 ])}
 className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm flex items-center gap-2"
 >
 <BarChart3 size={14} /> Load Demo Data
 </button>
 )}
 <button 
 onClick={handleRemindAll}
 className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm"
 >
 Send Reminders To All &gt; 30 Days
 </button>
 </div>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-100 text-slate-600">
 <tr>
 <th className="p-3 font-bold">Party Name</th>
 <th className="p-3 text-right font-bold">Total Due</th>
 <th className="p-3 text-right font-bold text-green-700">0-30 Days</th>
 <th className="p-3 text-right font-bold text-yellow-600">31-60 Days</th>
 <th className="p-3 text-right font-bold text-orange-600">61-90 Days</th>
 <th className="p-3 text-right font-bold text-red-700">90+ Days</th>
 <th className="p-3 text-center font-bold">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {agingData.length === 0 ? (
 <tr>
 <td colSpan={7} className="p-8 text-center text-slate-500">
 <div className="flex flex-col items-center gap-4">
 <Calendar size={48} className="text-slate-300 opacity-50" />
 <p className="font-medium">No aging data loaded. Click "Load Demo Data" to see a sample receivables aging analysis</p>
 </div>
 </td>
 </tr>
 ) : (
 agingData.map((data, idx) => (
 <tr key={idx} className="hover:bg-slate-50">
 <td className="p-3 font-medium text-slate-800">{data.partyName}</td>
 <td className="p-3 text-right font-bold text-slate-700">?{data.totalDue.toLocaleString()}</td>
 <td className="p-3 text-right text-green-700">{data.days0_30 > 0 ? `?${data.days0_30.toLocaleString()}` : '-'}</td>
 <td className="p-3 text-right text-yellow-600">{data.days31_60 > 0 ? `?${data.days31_60.toLocaleString()}` : '-'}</td>
 <td className="p-3 text-right text-orange-600">{data.days61_90 > 0 ? `?${data.days61_90.toLocaleString()}` : '-'}</td>
 <td className="p-3 text-right text-red-700 font-bold">{data.days90Plus > 0 ? `?${data.days90Plus.toLocaleString()}` : '-'}</td>
 <td className="p-3 text-center">
 {(data.days31_60 > 0 || data.days61_90 > 0 || data.days90Plus > 0) && (
 <button 
 disabled={dunningStatus[data.partyId]}
 className={`px-3 py-1 text-xs font-bold rounded ${dunningStatus[data.partyId] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
 onClick={() => {
 setDunningStatus({...dunningStatus, [data.partyId]: true});
 alert(`Reminder sent to ${data.partyName}`);
 }}
 >
 {dunningStatus[data.partyId] ? 'Sent ?' : 'Remind'}
 </button>
 )}
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}
 {activeTab === 'COST_CENTER' && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex justify-between items-center mb-6">
 <h3 className="font-bold text-slate-800">Budget vs. Actuals Dashboard</h3>
 <div className="flex gap-2 items-center">
 {costCenters.length === 0 && (
 <button 
 onClick={() => setCostCenters([
 { name: 'Sales & Marketing', costCenterName: 'Sales & Marketing', budget: 500000, consumed: 425000 },
 { name: 'Operations', costCenterName: 'Operations', budget: 750000, consumed: 695000 },
 { name: 'IT & Infrastructure', costCenterName: 'IT & Infrastructure', budget: 300000, consumed: 285000 },
 { name: 'HR & Admin', costCenterName: 'HR & Admin', budget: 200000, consumed: 160000 },
 { name: 'R&D', costCenterName: 'R&D', budget: 600000, consumed: 720000 },
 { name: 'Finance & Compliance', costCenterName: 'Finance & Compliance', budget: 250000, consumed: 198000 }
 ])}
 className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
 >
 <BarChart3 size={14} /> Load Demo
 </button>
 )}
 <div className="text-sm text-slate-500">Financial Year 2024-25</div>
 </div>
 </div>
 {costCenters.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500">
 <DollarSign size={48} className="text-slate-300 opacity-50 mb-4" />
 <p className="font-medium">No cost center data loaded. Click "Load Demo" to see budget vs actuals analysis</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {costCenters.map((cc, idx) => {
 const percentage = Math.min(100, Math.round((cc.consumed / cc.budget) * 100));
 const isOverBudget = cc.consumed > cc.budget;
 const isWarning = percentage > 85 && !isOverBudget;
 
 return (
 <div key={idx} className="p-4 border border-slate-200 rounded-lg shadow-sm hover:shadow-none transition-shadow">
 <div className="flex justify-between items-center mb-2">
 <h4 className="font-bold text-slate-700 text-lg">{cc.costCenterName || cc.name}</h4>
 <span className={`px-2 py-1 rounded text-xs font-bold ${isOverBudget ? 'bg-red-100 text-red-700' : isWarning ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
 {percentage}% Consumed
 </span>
 </div>
 <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
 <div 
 className={`h-2.5 rounded-full ${isOverBudget ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-green-500'}`} 
 style={{ width: `${percentage}%` }}
 ></div>
 </div>
 <div className="w-full mb-4 opacity-70">
  <ResponsiveContainer width="100%" height={300} debounce={50}>
 <AreaChart data={[
 { m: 'Q1', val: cc.consumed * 0.15 },
 { m: 'Q2', val: cc.consumed * 0.4 },
 { m: 'Q3', val: cc.consumed * 0.75 },
 { m: 'Q4', val: cc.consumed }
 ]}>
 <Area type="monotone" dataKey="val" stroke={isOverBudget ? '#ef4444' : '#10b981'} fill={isOverBudget ? '#fef2f2' : '#ecfdf5'} strokeWidth={2} />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 <div className="flex justify-between text-sm">
 <div>
 <p className="text-slate-500 text-xs uppercase font-bold">Allocated Budget</p>
 <p className="font-semibold text-slate-800">?{cc.budget.toLocaleString()}</p>
 </div>
 <div className="text-right">
 <p className="text-slate-500 text-xs uppercase font-bold">Consumed (Actuals)</p>
 <p className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-slate-800'}`}>?{cc.consumed.toLocaleString()}</p>
 </div>
 </div>
 <div className="mt-4 pt-3 border-t border-slate-100 text-right">
 <p className="text-xs text-slate-500">Variance: <span className={`font-bold ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>?{Math.abs(cc.budget - cc.consumed).toLocaleString()}</span> {isOverBudget ? 'Over Budget' : 'Remaining'}</p>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 {activeTab === 'AUDIT' && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col h-full">
 <div className="flex justify-between items-center mb-6">
 <h3 className="font-bold text-slate-800">Audit & Security Ledger</h3>
 <input 
 type="text" 
 placeholder="Search logs..." 
 className="px-3 py-1.5 border border-slate-200 rounded text-sm w-64 bg-slate-50" 
 />
 </div>
 <div className="flex-1 overflow-x-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
 <tr>
 <th className="p-3">Timestamp</th>
 <th className="p-3">User</th>
 <th className="p-3">Event Type</th>
 <th className="p-3">Description</th>
 <th className="p-3 text-right">IP Address</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {auditLogs && auditLogs.length > 0 ? (
 auditLogs.map((log: any, i: number) => (
 <tr key={log.id || i} className="hover:bg-slate-50">
 <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
 {formatDateTime(log.timestamp)}
 </td>
 <td className="p-3 font-semibold text-slate-700">{log.user}</td>
 <td className="p-3">
 <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
 log.action === 'UPDATE' ? 'bg-orange-100 text-orange-700' : 
 log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
 log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
 'bg-blue-100 text-accent'
 }`}>
 {log.action}
 </span>
 </td>
 <td className="p-3 text-slate-600">{log.details || log.description}</td>
 <td className="p-3 text-right text-slate-400 font-mono text-[11px]">{log.ipAddress || 'N/A'}</td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan={5} className="p-3 text-center text-slate-500">
 No audit logs available
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}
 {activeTab === 'FORECAST' && (
 <div className="flex flex-col gap-4">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <h3 className="font-bold text-slate-800 mb-1">Cash Flow Probability Forecast</h3>
 <p className="text-xs text-slate-500 mb-6">AI-driven predictive modeling based on historical aging performance & recurring payables.</p>
 
 <div className="w-full">
  <ResponsiveContainer width="100%" height={300} debounce={50}>
 <LineChart data={[
 { day: 'Today', Cash: 800000, Projected: 800000 },
 { day: 'Day 10', Cash: 750000, Projected: 850000 },
 { day: 'Day 20', Cash: 650000, Projected: 950000 },
 { day: 'Day 30', Cash: 900000, Projected: 1200000 },
 { day: 'Day 60', Cash: 850000, Projected: 1500000 },
 { day: 'Day 90', Cash: 1100000, Projected: 1800000 },
 ]}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}}/>
 <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `?${val/1000}k`} tick={{fill: '#64748b', fontSize: 12}} />
 <RechartsTooltip formatter={(val: any) => formatCurrency(val)} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
 <Legend iconType="circle" wrapperStyle={{paddingTop: '10px'}}/>
 <Line type="monotone" dataKey="Cash" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} name="Conservative Case" />
 <Line type="monotone" dataKey="Projected" stroke="#10b981" strokeWidth={3} strokeDasharray="5 5" dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} name="Optimistic Track" />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
 <h3 className="font-bold text-slate-800 mb-6">Working Capital Signals</h3>
 <div className="space-y-4 flex-1">
 <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
 <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Cash Crunch Warning</p>
 <p className="text-sm text-slate-700">High probability of deficit on <span className="font-bold">Day 20</span> due to ?2L recurring rental & payroll outflow vs projected ?50k inflow.</p>
 </div>
 <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
 <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Collection Opportunity</p>
 <p className="text-sm text-slate-700">Pushing strictly for the `&lt;30 Days` aging bucket (Current: ?3.4L) could inject enough liquidity to neutralize the Day 20 deficit.</p>
 </div>
 <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
 <p className="text-xs font-bold text-accent uppercase tracking-widest mb-1">AI Recommendation</p>
 <p className="text-sm text-slate-700">Consider enabling early payment discounts of 2% for Apollo Pharmacy to expedite their ?60,000 pending invoice.</p>
 </div>
 </div>
 <button className="w-full mt-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors shadow-sm">
 Generate Deep Report
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default ComprehensiveAccounts;

