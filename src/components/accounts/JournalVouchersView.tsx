import React, { useState } from 'react';
import { ERPLayout, FilterBar, DataTable, Badge } from '../UniversalLayout';
import { useDataFetch } from '../../hooks/useDataFetch';
import { JournalVoucher } from '../../types';
import { Plus, Eye, CheckCircle, Clock } from 'lucide-react';

const JournalVouchersView: React.FC = () => {
 const [dateFilter, setDateFilter] = useState({ start: '2025-04-01', end: '2026-03-31' });
 const [statusFilter, setStatusFilter] = useState('All');
 
 const { data: vouchers, loading, error, refetch } = useDataFetch<JournalVoucher[]>('/api/accounting/journal-vouchers');

 const columns = [
 { key: 'voucherNo' as keyof JournalVoucher, label: 'Voucher #', width: '15%' },
 { key: 'date' as keyof JournalVoucher, label: 'Date', width: '15%' },
 { key: 'narration' as keyof JournalVoucher, label: 'Narration', width: '35%' },
 { 
 key: 'totalDebit' as keyof JournalVoucher, 
 label: 'Amount', 
 width: '15%',
 align: 'right' as const,
 render: (val: number) => `₹${val.toLocaleString()}`
 },
 { 
 key: 'status' as keyof JournalVoucher, 
 label: 'Status', 
 width: '10%',
 render: (val: string) => (
 <Badge 
 label={val} 
 variant={
 val === 'Posted' || val === 'Approved' ? 'success' : 
 val === 'Draft' ? 'neutral' : 
 val === 'Rejected' ? 'danger' : 'warning'
 } 
 />
 )
 },
 {
 key: 'id' as keyof JournalVoucher,
 label: 'Actions',
 width: '10%',
 render: (id: string) => (
 <button className="text-accent hover:text-blue-800 transition-colors">
 <Eye size={18} />
 </button>
 )
 }
 ];

 return (
 <ERPLayout
 title="Journal Vouchers"
 description="Record and manage manual accounting entries and adjustments"
 onRefresh={refetch}
 onExport={() => console.log('Exporting...')}
 isLoading={loading}
 >
 <div className="flex justify-between items-center mb-4">
 <div className="flex-1">
 <FilterBar
 filters={[
 {
 id: 'start',
 label: 'From Date',
 type: 'date',
 value: dateFilter.start,
 onChange: (v) => setDateFilter(prev => ({ ...prev, start: v }))
 },
 {
 id: 'end',
 label: 'To Date',
 type: 'date',
 value: dateFilter.end,
 onChange: (v) => setDateFilter(prev => ({ ...prev, end: v }))
 },
 {
 id: 'status',
 label: 'Status',
 type: 'select',
 value: statusFilter,
 onChange: setStatusFilter,
 options: [
 { label: 'All Status', value: 'All' },
 { label: 'Draft', value: 'Draft' },
 { label: 'Posted', value: 'Posted' },
 { label: 'Approved', value: 'Approved' },
 { label: 'Rejected', value: 'Rejected' },
 ]
 }
 ]}
 />
 </div>
 <button className="ml-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 transition-colors">
 <Plus size={18} />
 New Voucher
 </button>
 </div>

 <DataTable
 columns={columns}
 data={vouchers || []}
 loading={loading}
 emptyMessage="No journal vouchers found for the selected period"
 />
 </ERPLayout>
 );
};

export default JournalVouchersView;

