import React, { useState } from 'react';
import { ERPLayout, FilterBar, DataTable, Badge } from '../UniversalLayout';
import { useDataFetch } from '../../hooks/useDataFetch';
import { GeneralLedgerEntry } from '../../types';
import { BookOpen, Search, Filter } from 'lucide-react';

const GeneralLedgerView: React.FC = () => {
 const [filters, setFilters] = useState({
 accountId: '',
 startDate: '2025-04-01',
 endDate: '2026-03-31'
 });

 const { data: ledgerEntries, loading, error, refetch } = useDataFetch<GeneralLedgerEntry[]>(
 `/api/accounting/general-ledger/${filters.accountId || 'all'}?startDate=${filters.startDate}&endDate=${filters.endDate}`
 );

 const columns = [
 { key: 'date' as keyof GeneralLedgerEntry, label: 'Date', width: '12%' },
 { key: 'voucherNo' as keyof GeneralLedgerEntry, label: 'Voucher', width: '15%' },
 { key: 'narration' as keyof GeneralLedgerEntry, label: 'Narration', width: '33%' },
 { 
 key: 'debit' as keyof GeneralLedgerEntry, 
 label: 'Debit', 
 width: '13%', 
 align: 'right' as const,
 render: (val: number) => val > 0 ? `₹${val.toLocaleString()}` : '-'
 },
 { 
 key: 'credit' as keyof GeneralLedgerEntry, 
 label: 'Credit', 
 width: '13%', 
 align: 'right' as const,
 render: (val: number) => val > 0 ? `₹${val.toLocaleString()}` : '-'
 },
 { 
 key: 'runningBalance' as keyof GeneralLedgerEntry, 
 label: 'Balance', 
 width: '14%', 
 align: 'right' as const,
 render: (val: number) => (
 <span className="font-bold">₹{val.toLocaleString()}</span>
 )
 }
 ];

 return (
 <ERPLayout
 title="General Ledger"
 description="View detailed transaction history for every account"
 onRefresh={refetch}
 onPrint={() => window.print()}
 isLoading={loading}
 >
 <FilterBar
 filters={[
 {
 id: 'startDate',
 label: 'From',
 type: 'date',
 value: filters.startDate,
 onChange: (v) => setFilters(prev => ({ ...prev, startDate: v }))
 },
 {
 id: 'endDate',
 label: 'To',
 type: 'date',
 value: filters.endDate,
 onChange: (v) => setFilters(prev => ({ ...prev, endDate: v }))
 },
 {
 id: 'accountId',
 label: 'Account',
 type: 'search',
 placeholder: 'Search Account...',
 value: filters.accountId,
 onChange: (v) => setFilters(prev => ({ ...prev, accountId: v }))
 }
 ]}
 onApply={refetch}
 />

 <DataTable
 columns={columns}
 data={ledgerEntries || []}
 loading={loading}
 emptyMessage="Select an account and date range to view ledger entries"
 />
 </ERPLayout>
 );
};

export default GeneralLedgerView;

