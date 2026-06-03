import React, { useState, useEffect } from 'react';
import { ERPLayout, FilterBar, StatCard, DataTable, Badge } from './UniversalLayout';
import { Clock, AlertTriangle, FileText, Send } from 'lucide-react';
import { AgingAnalysisService } from '../services/accountingService';

interface AgingRecord {
 id: string;
 name: string;
 current_balance: number;
 bucket_0_30: number;
 bucket_31_60: number;
 bucket_61_90: number;
 bucket_90_plus: number;
}

const AgingAnalysis: React.FC = () => {
 const [data, setData] = useState<AgingRecord[]>([]);
 const [loading, setLoading] = useState(false);
 const [partyType, setPartyType] = useState<'Debtor' | 'Creditor'>('Debtor');
 const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split('T')[0]);

 useEffect(() => {
 fetchAging();
 }, [partyType, asOnDate]);

 const fetchAging = async () => {
 setLoading(true);
 try {
 const response = await AgingAnalysisService.getAgingAnalysis(asOnDate, partyType);
 setData(response);
 } catch (error) {
 console.error('Failed to load aging data:', error);
 // Fallback Demo Data for testing
 setData([
 { id: '1', name: 'Apollo Hospitals', current_balance: 450000, bucket_0_30: 200000, bucket_31_60: 150000, bucket_61_90: 100000, bucket_90_plus: 0 },
 { id: '2', name: 'Max Healthcare', current_balance: 850000, bucket_0_30: 100000, bucket_31_60: 0, bucket_61_90: 250000, bucket_90_plus: 500000 }
 ]);
 }
 setLoading(false);
 };

 const columns = [
 { key: 'name', label: 'Party Name', width: '25%' },
 { 
 key: 'current_balance', 
 label: 'Outstanding (₹)', 
 width: '15%', 
 align: 'right' as const,
 format: (v: number) => `₹${Number(v).toLocaleString('en-IN')}` 
 },
 { key: 'bucket_0_30', label: '0-30 Days', width: '12%', align: 'right' as const, format: (v: number) => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
 { key: 'bucket_31_60', label: '31-60 Days', width: '12%', align: 'right' as const, format: (v: number) => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
 { 
 key: 'bucket_61_90', 
 label: '61-90 Days', 
 width: '12%', 
 align: 'right' as const, 
 format: (v: number) => v > 0 ? <span className="text-amber-600 font-bold">₹{v.toLocaleString('en-IN')}</span> : '-' 
 },
 { 
 key: 'bucket_90_plus', 
 label: '> 90 Days', 
 width: '12%', 
 align: 'right' as const, 
 format: (v: number) => v > 0 ? <span className="text-red-600 font-bold bg-red-50 p-1 rounded">₹{v.toLocaleString('en-IN')}</span> : '-' 
 },
 {
 key: 'actions',
 label: 'Actions',
 width: '12%',
 align: 'center' as const,
 render: (_, row: AgingRecord) => (
 <button 
 onClick={() => alert(`Sending dunning letter to ${row.name}`)}
 className="text-xs flex items-center justify-center gap-1 bg-slate-100 hover:bg-blue-100 hover:text-accent text-slate-600 px-2 py-1 rounded w-full font-bold transition-colors"
 >
 <Send size={12} /> Send Reminder
 </button>
 )
 }
 ];

 return (
 <ERPLayout
 title="Aging Analysis"
 description={`${partyType}s outstanding balances timeline`}
 icon={<Clock className="text-accent" size={24} />}
 onRefresh={fetchAging}
 onExport={() => {}}
 isLoading={loading}
 >
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <StatCard
 label="Total Outstanding"
 value={`₹${data.reduce((sum, r) => sum + Number(r.current_balance), 0).toLocaleString('en-IN')}`}
 icon={<FileText className="text-accent" />}
 color="blue"
 />
 <StatCard
 label="Critical (> 90 Days)"
 value={`₹${data.reduce((sum, r) => sum + Number(r.bucket_90_plus), 0).toLocaleString('en-IN')}`}
 icon={<AlertTriangle className="text-rose-600" />}
 color="danger"
 />
 </div>

 <FilterBar
 searchPlaceholder="Search party..."
 filters={[
 {
 label: 'Party Type',
 value: partyType,
 onChange: (val) => setPartyType(val as any),
 options: ['Debtor', 'Creditor']
 },
 {
 label: 'As On Date',
 value: asOnDate,
 onChange: setAsOnDate,
 type: 'date'
 }
 ]}
 />

 <DataTable 
 columns={columns} 
 data={data} 
 loading={loading}
 emptyMessage={`No outstanding ${partyType}s found`} 
 />
 </ERPLayout>
 );
};

export default AgingAnalysis;

