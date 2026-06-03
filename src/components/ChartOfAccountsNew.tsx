import React, { useState, useMemo } from 'react';
import {
 Plus, Filter, Download, Eye, Edit, Trash2, Save, XCircle, Check, X,
 BookOpen, TrendingUp, Layers, DollarSign, Printer, LayoutGrid
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChartOfAccountsService } from '../services/accountingService';
import { utils, writeFile } from 'xlsx';
import { printReport } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';
import { Tab } from '../types';

interface Account {
 id: string;
 accountCode: string;
 accountName: string;
 accountType: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
 openingBalance: number;
 group?: string;
 description?: string;
 createdDate?: string;
 createdTime?: string;
 status?: 'Active' | 'Inactive';
 gstApplicable?: boolean;
 accountFormat?: string;
 createdAt?: string;
}

interface ChartOfAccountsProps {
 onNavigate?: (tab: Tab) => void;
}

// Helper: Convert snake_case to camelCase
const toCamelCase = (obj: any): any => {
 if (Array.isArray(obj)) {
 return obj.map(item => toCamelCase(item));
 }
 if (obj !== null && typeof obj === 'object') {
 const result: any = {};
 for (const [key, value] of Object.entries(obj)) {
 const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
 result[camelKey] = toCamelCase(value);
 }
 return result;
 }
 return obj;
};

const ChartOfAccountsNew: React.FC<ChartOfAccountsProps> = ({ onNavigate }) => {
 const { hasPermission } = useAuth();
 const { company } = useCompany();
 const canEdit = hasPermission(['ADMIN']);

 // State
 const [chartOfAccounts, setChartOfAccounts] = useState<Account[]>([]);
 const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
 const [showAccountForm, setShowAccountForm] = useState(false);
 const [accountsLoading, setAccountsLoading] = useState(false);
 const [accountTypeFilter, setAccountTypeFilter] = useState('All');
 const [searchTerm, setSearchTerm] = useState('');

 const [accountForm, setAccountForm] = useState({
 accountCode: '',
 accountName: '',
 accountType: 'Asset' as const,
 openingBalance: 0,
 group: '',
 description: '',
 status: 'Active' as const,
 gstApplicable: false,
 tdsApplicable: false,
 isBankOrCash: false,
 parentAccountId: '',
 accountFormat: 'debit'
 });

 React.useEffect(() => {
 loadChartOfAccounts();
 }, []);

 const loadChartOfAccounts = async () => {
 try {
 setAccountsLoading(true);
 console.log('📨 Fetching Chart of Accounts...');
 const accounts = await ChartOfAccountsService.getAllAccounts();
 console.log('✅ Chart of Accounts loaded:', accounts);
 setChartOfAccounts(Array.isArray(accounts) ? accounts : []);
 setAccountsLoading(false);
 } catch (error) {
 console.log('⚠️ API Error or No Data - Using Tally ERP Demo Data fallback');
 const demoAccounts: Account[] = [
 { id: 'A001', accountCode: '1010', accountName: 'Cash & Bank', accountType: 'Asset', openingBalance: 500000, group: 'Current Assets', status: 'Active', gstApplicable: false, createdDate: '2026-01-01', createdTime: '09:00:00', accountFormat: 'debit' },
 { id: 'A002', accountCode: '1020', accountName: 'Bank Account HDFC', accountType: 'Asset', openingBalance: 2500000, group: 'Current Assets', status: 'Active', gstApplicable: false, createdDate: '2026-01-01', createdTime: '09:15:00', accountFormat: 'debit' },
 { id: 'A003', accountCode: '1030', accountName: 'Accounts Receivable', accountType: 'Asset', openingBalance: 850000, group: 'Current Assets', status: 'Active', gstApplicable: false, createdDate: '2026-01-01', createdTime: '09:30:00', accountFormat: 'debit' },
 { id: 'L001', accountCode: '2010', accountName: 'Accounts Payable', accountType: 'Liability', openingBalance: 450000, group: 'Current Liabilities', status: 'Active', gstApplicable: false, createdDate: '2026-01-04', createdTime: '14:00:00', accountFormat: 'credit' },
 { id: 'E001', accountCode: '3010', accountName: 'Share Capital', accountType: 'Equity', openingBalance: 5000000, group: 'Equity', status: 'Active', gstApplicable: false, createdDate: '2026-01-06', createdTime: '08:00:00', accountFormat: 'credit' },
 { id: 'I001', accountCode: '4010', accountName: 'Sales Revenue', accountType: 'Income', openingBalance: 0, group: 'Operating Revenue', status: 'Active', gstApplicable: true, createdDate: '2026-01-07', createdTime: '10:00:00', accountFormat: 'credit' },
 { id: 'X001', accountCode: '5010', accountName: 'Cost of Goods Sold', accountType: 'Expense', openingBalance: 0, group: 'Operating Expenses', status: 'Active', gstApplicable: false, createdDate: '2026-01-08', createdTime: '12:00:00', accountFormat: 'debit' },
 ];
 setChartOfAccounts(demoAccounts);
 setAccountsLoading(false);
 }
 };

 const handleCreateAccount = async () => {
 if (!accountForm.accountCode.trim() || !accountForm.accountName.trim()) {
 alert('Please fill Account Code and Name');
 return;
 }
 
 try {
 const response = await ChartOfAccountsService.createAccount(accountForm);
 const savedAccount = toCamelCase(response);
 setChartOfAccounts([...chartOfAccounts, savedAccount]);
 setAccountForm({ accountCode: '', accountName: '', accountType: 'Asset', openingBalance: 0, group: '', description: '', status: 'Active', gstApplicable: false, tdsApplicable: false, isBankOrCash: false, parentAccountId: '', accountFormat: 'debit' });
 setShowAccountForm(false);
 await loadChartOfAccounts();
 alert('✅ Account created and saved!');
 } catch (error) {
 alert(`❌ Error: ${error instanceof Error ? error.message : 'Failed to save account'}`);
 }
 };

 const filteredAccounts = useMemo(() => {
 return chartOfAccounts.filter(account => {
 if (!account) return false;
 const matchesType = accountTypeFilter === 'All' || account.accountType === accountTypeFilter;
 const matchesSearch = (account?.accountName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
 (account?.accountCode || '').includes(searchTerm);
 return matchesType && matchesSearch;
 });
 }, [chartOfAccounts, accountTypeFilter, searchTerm]);

 const getAccountTypeColor = (type: string) => {
 switch(type) {
 case 'Asset': return 'bg-green-100 text-green-700';
 case 'Liability': return 'bg-red-100 text-red-700';
 case 'Equity': return 'bg-purple-100 text-purple-700';
 case 'Income': return 'bg-blue-100 text-accent';
 case 'Expense': return 'bg-orange-100 text-orange-700';
 default: return 'bg-gray-100 text-gray-700';
 }
 };

 const exportAccounts = () => {
 const rows = filteredAccounts.map(a => ({
 'Code': a.accountCode, 'Name': a.accountName, 'Type': a.accountType,
 'Group': a.group || '', 'Opening Balance (₹)': a.openingBalance || 0,
 'GST Applicable': a.gstApplicable ? 'Yes' : 'No', 'Status': a.status || 'Active',
 'Description': a.description || ''
 }));
 const ws = utils.json_to_sheet(rows);
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws, 'Chart of Accounts');
 writeFile(wb, `Chart_of_Accounts_${new Date().toISOString().slice(0, 10)}.xlsx`);
 };

 return (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
 {/* Account List */}
 <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
 {/* Header */}
 <div className="p-4 border-b border-slate-100 space-y-3">
 <div className="flex justify-between items-center">
 <h3 className="font-bold text-slate-800">Chart of Accounts</h3>
 <div className="flex gap-2">
 {onNavigate && (
 <button
 onClick={() => onNavigate(Tab.LEDGER_CREATION)}
 className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-none transition-all"
 >
 <LayoutGrid size={16} /> Tally Style Creation
 </button>
 )}
 {canEdit && (
 <button
 onClick={() => setShowAccountForm(!showAccountForm)}
 className="bg-accent hover:bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
 >
 <Plus size={16} /> New Account
 </button>
 )}
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Filter className="absolute left-3 top-2.5 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Search by name or code..."
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
 />
 </div>

 {/* Type Filter */}
 <div className="flex gap-2 flex-wrap">
 {['All', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(type => (
 <button
 key={type}
 onClick={() => setAccountTypeFilter(type)}
 className={`px-3 py-1 text-xs font-medium rounded border transition ${
 accountTypeFilter === type
 ? 'bg-slate-800 text-white border-slate-800'
 : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
 }`}
 >
 {type}
 </button>
 ))}
 </div>
 </div>

 {/* Account List */}
 <div className="flex-1 overflow-y-auto">
 {accountsLoading ? (
 <div className="flex items-center justify-center h-48 text-slate-500">
 <p>Loading...</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-100">
 {filteredAccounts.map(account => (
 <div
 key={account.id}
 onClick={() => setSelectedAccountId(account.id)}
 className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${
 selectedAccountId === account.id ? 'bg-blue-50 border-l-4 border-accent' : ''
 }`}
 >
 <div className="flex justify-between items-start">
 <div>
 <div className="font-semibold text-slate-800">{account?.accountName}</div>
 <div className="text-xs text-slate-500">Code: {account?.accountCode}</div>
 </div>
 <span className={`px-2 py-1 text-xs rounded font-medium ${getAccountTypeColor(account?.accountType)}`}>
 {account?.accountType}
 </span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Right Panel: Form or Details */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
 {showAccountForm ? (
 <div className="space-y-3 flex-1 overflow-y-auto">
 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
 <Plus size={18} /> Quick New Account
 </h3>
 <input
 type="text"
 placeholder="Account Code"
 value={accountForm.accountCode}
 onChange={e => setAccountForm({ ...accountForm, accountCode: e.target.value })}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none"
 />
 <input
 type="text"
 placeholder="Account Name"
 value={accountForm.accountName}
 onChange={e => setAccountForm({ ...accountForm, accountName: e.target.value })}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none"
 />
 <select
 value={accountForm.accountType}
 onChange={e => setAccountForm({ ...accountForm, accountType: e.target.value as any })}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none"
 >
 <option value="Asset">Asset</option>
 <option value="Liability">Liability</option>
 <option value="Equity">Equity</option>
 <option value="Income">Income</option>
 <option value="Expense">Expense</option>
 </select>
 
 <div className="grid grid-cols-2 gap-2">
 <select
 value={accountForm.accountFormat}
 onChange={e => setAccountForm({ ...accountForm, accountFormat: e.target.value })}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
 >
 <option value="debit">Debit Balance</option>
 <option value="credit">Credit Balance</option>
 </select>
 <input
 type="text"
 placeholder="Parent Acc ID (Opt)"
 value={accountForm.parentAccountId}
 onChange={e => setAccountForm({ ...accountForm, parentAccountId: e.target.value })}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
 />
 </div>

 <div className="flex flex-wrap gap-4 pt-2">
 <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
 <input 
 type="checkbox" 
 checked={accountForm.tdsApplicable}
 onChange={e => setAccountForm({ ...accountForm, tdsApplicable: e.target.checked })}
 className="rounded border-slate-300 text-accent focus:ring-blue-500" 
 />
 TDS Applicable
 </label>
 <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
 <input 
 type="checkbox" 
 checked={accountForm.isBankOrCash}
 onChange={e => setAccountForm({ ...accountForm, isBankOrCash: e.target.checked })}
 className="rounded border-slate-300 text-accent focus:ring-blue-500" 
 />
 Is Bank/Cash
 </label>
 </div>

 <button
 onClick={handleCreateAccount}
 className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold mt-4 transition-colors"
 >
 Save Account
 </button>
 </div>
 ) : selectedAccountId ? (
 <div className="space-y-4">
 {chartOfAccounts.find(a => a.id === selectedAccountId) && (() => {
 const acc = chartOfAccounts.find(a => a.id === selectedAccountId);
 return (
 <div className="space-y-4">
 <h3 className="font-bold text-slate-800 border-b pb-2">Account Details</h3>
 <div className="bg-slate-50 p-4 rounded-lg">
 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Code</label>
 <p className="text-xl font-bold text-slate-700">{acc?.accountCode}</p>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</label>
 <p className="text-lg font-bold text-slate-800">{acc?.accountName}</p>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
 <p className="font-semibold text-accent">{acc?.accountType}</p>
 </div>
 {acc?.group && (
 <div>
 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group</label>
 <p className="font-semibold text-slate-600">{acc?.group}</p>
 </div>
 )}
 <div className="pt-4 border-t">
 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opening Balance</label>
 <p className="text-2xl font-bold text-green-600">₹{acc?.openingBalance?.toLocaleString()}</p>
 </div>
 </div>
 );
 })()}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-full text-slate-300">
 <BookOpen size={64} strokeWidth={1} />
 <p className="mt-4 font-bold uppercase tracking-widest text-xs">Select an account</p>
 </div>
 )}
 </div>
 </div>
 );
};

export default ChartOfAccountsNew;

