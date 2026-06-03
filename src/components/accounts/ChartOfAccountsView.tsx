import React, { useState, useMemo } from 'react';
import { ERPLayout, FilterBar, DataTable, StatCard, Modal, Badge } from '../UniversalLayout';
import { useDataFetch } from '../../hooks/useDataFetch';
import { ChartOfAccount, AccountType } from '../../types';
import { Plus, BookOpen, Calculator, PieChart, Landmark } from 'lucide-react';

const ChartOfAccountsView: React.FC = () => {
 const { data: accounts, loading, error, refetch } = useDataFetch<ChartOfAccount[]>('/api/accounting/chart-of-accounts');
 const [searchTerm, setSearchTerm] = useState('');
 const [typeFilter, setTypeFilter] = useState('All');
 const [isModalOpen, setIsModalOpen] = useState(false);

 const filteredAccounts = useMemo(() => {
 if (!accounts) return [];
 return accounts.filter(acc => {
 const matchesSearch = acc.accountName.toLowerCase().includes(searchTerm.toLowerCase()) || 
 acc.accountCode.toLowerCase().includes(searchTerm.toLowerCase());
 const matchesType = typeFilter === 'All' || acc.accountType === typeFilter;
 return matchesSearch && matchesType;
 });
 }, [accounts, searchTerm, typeFilter]);

 const stats = useMemo(() => {
 if (!accounts) return { total: 0, assets: 0, liabilities: 0, income: 0, expense: 0 };
 return {
 total: accounts.length,
 assets: accounts.filter(a => a.accountType === 'Asset').length,
 liabilities: accounts.filter(a => a.accountType === 'Liability').length,
 income: accounts.filter(a => a.accountType === 'Income').length,
 expense: accounts.filter(a => a.accountType === 'Expense').length,
 };
 }, [accounts]);

 const columns = [
 { key: 'accountCode' as keyof ChartOfAccount, label: 'Code', width: '15%' },
 { key: 'accountName' as keyof ChartOfAccount, label: 'Account Name', width: '35%' },
 { 
 key: 'accountType' as keyof ChartOfAccount, 
 label: 'Type', 
 width: '20%',
 render: (val: AccountType) => (
 <Badge 
 label={val} 
 variant={
 val === 'Asset' ? 'info' : 
 val === 'Liability' ? 'danger' : 
 val === 'Income' ? 'success' : 
 val === 'Expense' ? 'warning' : 'neutral'
 } 
 />
 )
 },
 { 
 key: 'openingBalance' as keyof ChartOfAccount, 
 label: 'Opening Balance', 
 width: '20%',
 align: 'right' as const,
 render: (val: number) => `₹${val.toLocaleString()}`
 },
 { 
 key: 'status' as keyof any, 
 label: 'Status', 
 width: '10%',
 render: (val: string) => (
 <span className={val === 'Active' ? 'text-green-600' : 'text-red-600'}>
 ● {val}
 </span>
 )
 }
 ];

 return (
 <ERPLayout
 title="Chart of Accounts"
 description="Manage your general ledger accounts and hierarchical structure"
 onRefresh={refetch}
 onExport={() => console.log('Exporting...')}
 isLoading={loading}
 >
 {/* Stats Overview */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
 <StatCard label="Total Accounts" value={stats.total} icon={<BookOpen size={20}/>} color="blue" />
 <StatCard label="Assets" value={stats.assets} icon={<Landmark size={20}/>} color="cyan" />
 <StatCard label="Liabilities" value={stats.liabilities} icon={<Calculator size={20}/>} color="red" />
 <StatCard label="Income" value={stats.income} icon={<PieChart size={20}/>} color="green" />
 <StatCard label="Expenses" value={stats.expense} icon={<Calculator size={20}/>} color="orange" />
 </div>

 <div className="flex justify-between items-center mb-4">
 <div className="flex-1">
 <FilterBar
 showSearch
 searchValue={searchTerm}
 onSearchChange={setSearchTerm}
 filters={[
 {
 id: 'type',
 label: 'Account Type',
 type: 'select',
 value: typeFilter,
 onChange: setTypeFilter,
 options: [
 { label: 'All Types', value: 'All' },
 { label: 'Asset', value: 'Asset' },
 { label: 'Liability', value: 'Liability' },
 { label: 'Equity', value: 'Equity' },
 { label: 'Income', value: 'Income' },
 { label: 'Expense', value: 'Expense' },
 ]
 }
 ]}
 />
 </div>
 <button 
 onClick={() => setIsModalOpen(true)}
 className="ml-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 transition-colors"
 >
 <Plus size={18} />
 New Account
 </button>
 </div>

 {error ? (
 <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
 Error loading accounts: {error}
 </div>
 ) : (
 <DataTable
 columns={columns}
 data={filteredAccounts}
 loading={loading}
 emptyMessage="No accounts found matching your criteria"
 />
 )}

 {/* Modal for adding account would go here */}
 <Modal 
 isOpen={isModalOpen} 
 title="Add New Account" 
 onClose={() => setIsModalOpen(false)}
 >
 <p className="text-slate-500 mb-4">Hierarchical Account creation coming soon in Phase 3.</p>
 <div className="flex justify-end">
 <button 
 onClick={() => setIsModalOpen(false)}
 className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg"
 >
 Close
 </button>
 </div>
 </Modal>
 </ERPLayout>
 );
};

export default ChartOfAccountsView;

