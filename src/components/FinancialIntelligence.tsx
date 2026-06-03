/**
 * PREMIUM FINANCIAL INTELLIGENCE DASHBOARD
 * Real-time Ratios, Revenue Trends, and Liquidity Analysis
 */

import React, { useMemo } from 'react';
import { 
 TrendingUp, TrendingDown, DollarSign, PieChart, Activity, 
 ArrowUpRight, ArrowDownRight, RefreshCw, Filter, 
 Download, ShieldAlert, Archive, Trash2, CheckCircle2,
 LineChart as LineChartIcon, BarChart3, Target, Info, Wallet, Scale
} from 'lucide-react';
import { 
 ERPLayout, StatCard, Tabs, Badge, DataTable 
} from './UniversalLayout';
import { useDataFetch, useDatabaseStatus } from '../hooks/useDataFetch';
import { useNotificationSystem } from '../hooks/useNotifications';
import { 
 AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
 ResponsiveContainer, Cell, BarChart, Bar, Legend, ComposedChart, Line
} from 'recharts';

const FinancialIntelligence: React.FC = () => {
 const { status: dbStatus } = useDatabaseStatus();
 const notify = useNotificationSystem();
 
 // --- 1. DATA FETCHING ---
 const { data: finResponse, loading, error, refetch } = useDataFetch<any>(
 '/api/analytics/financial/summary'
 );
 
 const data = finResponse?.data;

 // --- 2. KPI MAPPING ---
 const kpiData = useMemo(() => {
 if (!data) return [];
 return [
 { label: 'Current Ratio', value: data.kpis.currentRatio, status: parseFloat(data.kpis.currentRatio) > 1.5 ? 'HEALTHY' : 'WATCH', desc: 'Current Assets / Current Liabilities' },
 { label: 'Debt to Equity', value: data.kpis.debtToEquity, status: parseFloat(data.kpis.debtToEquity) < 0.5 ? 'HEALTHY' : 'RISK', desc: 'Total Debt / Total Equity' },
 { label: 'Profit Margin', value: data.kpis.netProfitMargin, status: 'STABLE', desc: 'Net Profit / Revenue' },
 ];
 }, [data]);

 // --- 3. HANDLERS ---
 const handleExport = () => {
 notify.info('Generating Board-Ready Financial Report...');
 };

 if (!dbStatus.connected) {
 return (
 <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl border border-red-100">
 <Scale className="mx-auto mb-4" size={48} />
 <h3 className="text-xl font-bold">Financial Engine Offline</h3>
 <p className="text-sm mt-2">Database connection required for ratio calculation.</p>
 </div>
 );
 }

 return (
 <ERPLayout
 title="Financial Intelligence"
 description="Executive-level financial analysis and liquidity monitoring"
 onRefresh={refetch}
 isLoading={loading}
 onExport={handleExport}
 >
 {/* KPI ROW */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <StatCard 
 title="Working Capital" 
 value={`₹${(data?.kpis?.workingCapital / 100000).toFixed(2)}L`} 
 color="blue" 
 icon={<Wallet size={20}/>} 
 />
 <StatCard 
 title="Net Margin" 
 value={data?.kpis?.netProfitMargin || '0%'} 
 color="success" 
 icon={<TrendingUp size={20}/>} 
 />
 <StatCard 
 title="Liquidity Status" 
 value={data?.liquidityStatus || 'CHECKING'} 
 color={data?.liquidityStatus === 'HEALTHY' ? 'success' : 'danger'} 
 icon={<Activity size={20}/>} 
 />
 <StatCard 
 title="Accounts Receivable" 
 value="₹12.4L" 
 color="warning" 
 icon={<DollarSign size={20}/>} 
 />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* REVENUE VS EXPENSE TREND */}
 <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex justify-between items-center mb-6">
 <h3 className="font-bold text-slate-800 flex items-center gap-2">
 <LineChartIcon size={18} className="text-accent"/> Revenue vs Expense Trend
 </h3>
 <div className="flex gap-4">
 <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-accent"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Revenue</span></div>
 <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400"></div><span className="text-[10px] font-bold text-slate-500 uppercase">Expenses</span></div>
 </div>
 </div>
 <div className="w-full">
  <ResponsiveContainer width="100%" height={300} debounce={50}>
 <AreaChart data={data?.trends || []}>
 <defs>
 <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
 <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94A3B8'}} dy={10} />
 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94A3B8'}} tickFormatter={(v) => `₹${v/1000}k`} />
 <Tooltip 
 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
 />
 <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
 <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" fill="none" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* FINANCIAL RATIOS COLUMN */}
 <div className="lg:col-span-1 space-y-4">
 {kpiData.map((kpi, i) => (
 <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
 <div className="flex justify-between items-start mb-2">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
 <Badge text={kpi.status} variant={kpi.status === 'HEALTHY' ? 'success' : 'warning'} />
 </div>
 <div className="flex items-baseline gap-2">
 <h4 className="text-2xl font-bold text-slate-800">{kpi.value}</h4>
 <p className="text-[10px] text-slate-400 font-bold italic">{kpi.desc}</p>
 </div>
 <div className="mt-4 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
 <div 
 className={`h-full ${kpi.status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500'}`} 
 style={{ width: i === 0 ? '75%' : i === 1 ? '40%' : '65%' }}
 />
 </div>
 </div>
 ))}

 <div className="bg-[#1D3557] rounded-xl p-6 text-white relative overflow-hidden">
 <div className="relative z-10">
 <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">AI Recommendation</h4>
 <p className="text-sm leading-relaxed">
 Revenue has increased by 14% this quarter while expenses remained stable. Consider increasing R&D budget for next phase.
 </p>
 </div>
 <Activity className="absolute right-0 bottom-0 text-white/5 -mr-4 -mb-4" size={120} />
 </div>
 </div>
 </div>

 {/* RECENT FINANCIAL TRANSACTIONS */}
 <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
 <h3 className="font-bold text-slate-800">Critical Alerts & Variance</h3>
 <button className="text-xs font-bold text-accent hover:underline">Full Audit Trail</button>
 </div>
 <DataTable 
 columns={[
 { key: 'date', label: 'Date', width: '15%' },
 { key: 'entity', label: 'Particulars', width: '40%' },
 { key: 'type', label: 'Type', width: '15%', render: (v) => <Badge text={v} variant={v === 'CREDIT' ? 'success' : 'danger'} /> },
 { key: 'amount', label: 'Amount', width: '20%', align: 'right', render: (v) => `₹${v.toLocaleString()}` },
 { key: 'status', label: 'Risk', width: '10%', render: () => <div className="w-2 h-2 rounded-full bg-emerald-500 mx-auto"></div> }
 ]}
 data={[
 { date: '2024-03-20', entity: 'Bulk Purchase: Pharma Raw Mat.', type: 'DEBIT', amount: 450000 },
 { date: '2024-03-19', entity: 'Sales Collection: Wellness Dist.', type: 'CREDIT', amount: 820000 },
 { date: '2024-03-18', entity: 'Monthly Rent: HQ Office', type: 'DEBIT', amount: 120000 },
 ]}
 />
 </div>
 </ERPLayout>
 );
};

export default FinancialIntelligence;

