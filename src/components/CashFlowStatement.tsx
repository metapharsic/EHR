import React, { useState, useEffect, useCallback } from 'react';
import { ERPLayout, FilterBar, StatCard, DataTable } from './UniversalLayout';
import { FileText, TrendingUp, TrendingDown, DollarSign, Activity, RefreshCw } from 'lucide-react';
import { CashFlowService } from '../services/accountingService';
import { useAuth } from '../context/AuthContext';

interface CashFlowEntry {
 id: string;
 activity: string;
 category: string;
 amount: number;
}

const DEMO_CASH_FLOW: CashFlowEntry[] = [
 { id: '1', activity: 'Operating', category: 'Cash received from customers', amount: 1500000 },
 { id: '2', activity: 'Operating', category: 'Cash paid to suppliers', amount: -600000 },
 { id: '3', activity: 'Operating', category: 'Cash paid for operational expenses', amount: -250000 },
 { id: '4', activity: 'Investing', category: 'Purchase of fixed assets', amount: -400000 },
 { id: '5', activity: 'Financing', category: 'Proceeds from long-term borrowings', amount: 500000 },
];

const CashFlowStatement: React.FC = () => {
 const [period, setPeriod] = useState('This Month');
 const [data, setData] = useState<{ summary: any; items: CashFlowEntry[] }>({
 summary: { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 },
 items: []
 });
 const [loading, setLoading] = useState(false);

 const fetchCashFlow = useCallback(async () => {
 setLoading(true);
 try {
 // Calculate dates based on period
 let start = '2024-04-01';
 const end = new Date().toISOString().split('T')[0];
 
 const response = await CashFlowService.getStatement(start, end);
 const items: CashFlowEntry[] = (response.data || []).map((gl: any, index: number) => ({
 id: index.toString(),
 activity: parseFloat(gl.in) > 0 ? 'Cash Inflow' : 'Cash Outflow',
 category: gl.narration || gl.voucherType,
 amount: parseFloat(gl.in) > 0 ? parseFloat(gl.in) : -parseFloat(gl.out)
 }));
 
 setData({
 summary: response.summary,
 items: items
 });
 } catch (error) {
 console.error('Failed to load cash flow:', error);
 setData({ summary: { totalInflow: 0, totalOutflow: 0, netCashFlow: 0 }, items: [] });
 }
 setLoading(false);
 }, [period]);

 useEffect(() => {
 fetchCashFlow();
 }, [fetchCashFlow]);

 const operatingTotal = data.items.reduce((sum, d) => sum + d.amount, 0);
 const inflowTotal = data.summary.totalInflow || 0;
 const outflowTotal = data.summary.totalOutflow || 0;
 
 const netCashFlow = data.summary.netCashFlow || 0;
 const openingBalance = 0; // Simplified for now
 const closingBalance = openingBalance + netCashFlow;

 const columns = [
 { key: 'activity', label: 'Activity Type', width: '20%' },
 { key: 'category', label: 'Particulars', width: '45%' },
 { 
 key: 'amount', 
 label: 'Amount (₹)', 
 width: '35%', 
 align: 'right' as const,
 format: (v: number) => (
 <span className={v < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
 {v < 0 ? `(₹${Math.abs(v).toLocaleString('en-IN')})` : `₹${v.toLocaleString('en-IN')}`}
 </span>
 )
 }
 ];

 return (
 <ERPLayout
 title="Cash Flow Statement"
 description="Direct method cash flow analysis"
 icon={<Activity className="text-accent" size={24} />}
 onRefresh={fetchCashFlow}
 onExport={() => {}}
 isLoading={loading}
 >
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <StatCard
 label="Total Inflow"
 value={`₹${inflowTotal.toLocaleString('en-IN')}`}
 icon={<TrendingUp className="text-emerald-600" />}
 color="success"
 />
 <StatCard
 label="Total Outflow"
 value={`₹${outflowTotal.toLocaleString('en-IN')}`}
 icon={<TrendingDown className="text-amber-600" />}
 color="warning"
 />
 <StatCard
 label="Net Cash Flow"
 value={`₹${netCashFlow.toLocaleString('en-IN')}`}
 icon={<Activity className="text-indigo-600" />}
 color={netCashFlow >= 0 ? "success" : "danger"}
 trend={netCashFlow >= 0 ? "+ Positive" : "- Negative"}
 />
 </div>

 <FilterBar
 searchPlaceholder="Search activities..."
 filters={[
 {
 label: 'Period',
 value: period,
 onChange: setPeriod,
 options: ['This Month', 'Last Month', 'This Quarter', 'This Year']
 }
 ]}
 />

 <div className="space-y-6">
 <DataTable 
 columns={columns} 
 data={data.items} 
 loading={loading}
 emptyMessage="No cash flow activities found for the selected period" 
 />
 </div>

 <div className="mt-8 bg-slate-800 text-white p-6 rounded-xl shadow-none flex justify-between items-center">
 <div>
 <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Opening Balance</div>
 <div className="text-2xl font-bold">₹{openingBalance.toLocaleString('en-IN')}</div>
 </div>
 <div className="text-center">
 <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Net Change</div>
 <div className={`text-xl font-bold ${netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
 {netCashFlow >= 0 ? '+' : ''}₹{netCashFlow.toLocaleString('en-IN')}
 </div>
 </div>
 <div className="text-right">
 <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Closing Balance</div>
 <div className="text-3xl font-bold text-blue-400">₹{closingBalance.toLocaleString('en-IN')}</div>
 </div>
 </div>
 </ERPLayout>
 );
};

export default CashFlowStatement;

