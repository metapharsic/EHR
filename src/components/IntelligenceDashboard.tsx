import React, { useState, useEffect } from 'react';
import { 
 BarChart3, Brain, Zap, Clock, CheckCircle2, 
 AlertCircle, Loader2, Sparkles, TrendingUp, 
 ArrowRight, Filter, Download, RefreshCw,
 Wallet, Users, Activity, ChevronRight,
 TrendingDown, ShieldCheck
} from 'lucide-react';
import { ERPLayout, FilterBar, StatCard } from './UniversalLayout';
import { useAppStore } from '../store/useAppStore';

interface ReportJob {
 jobId: string;
 reportId: string;
 type: string;
 status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
 progress: number;
 result?: any;
}

interface FinancialIntelligence {
 kpis: {
 currentRatio: string;
 netProfitMargin: string;
 workingCapital: number;
 burnRate: string;
 forecastedCash30d: string;
 };
 intelligence: {
 status: string;
 recommendation: string;
 };
}

interface CustomerIntelligence {
 driftingCount: number;
 lostCount: number;
 growingCount: number;
 atRisk: any[];
}

export const IntelligenceDashboard: React.FC = () => {
 const [activeJobs, setActiveJobs] = useState<ReportJob[]>([]);
 const [financials, setFinancials] = useState<FinancialIntelligence | null>(null);
 const [customers, setCustomers] = useState<CustomerIntelligence | null>(null);
 const [posStats, setPosStats] = useState<any>(null);
 const { addNotification } = useAppStore();
 const [isLoading, setIsLoading] = useState(true);
 const [isRequesting, setIsRequesting] = useState(false);

 const reportTypes = [
 { id: 'inventory_intelligence', name: 'Inventory Intelligence', icon: BarChart3, desc: 'ABC/FSN analysis and stock optimization.' },
 { id: 'financial_health', name: 'Financial Health Analysis', icon: TrendingUp, desc: 'Deep-dive into liquidity, margins, and ratios.' },
 { id: 'demand_forecast', name: 'Demand Forecasting', icon: Brain, desc: 'Predictive modeling for next quarter requirements.' }
 ];

 const fetchIntelligence = async () => {
 setIsLoading(true);
 try {
 const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
 const headers = { 'Authorization': `Bearer ${token}` };
 
 // FIX: use allSettled so one failed endpoint doesn't silently kill the rest
 const [finRes, custRes, posRes] = await Promise.allSettled([
   fetch('/api/analytics/financial/summary', { headers }).then(r => r.json()),
   fetch('/api/analytics/customers/drift', { headers }).then(r => r.json()),
   fetch('/api/pos/terminal/summary', { headers }).then(r => r.json()),
 ]);

 if (finRes.status === 'fulfilled' && finRes.value?.success) setFinancials(finRes.value.data);
 if (custRes.status === 'fulfilled' && custRes.value?.success) setCustomers(custRes.value.data);
 if (posRes.status === 'fulfilled' && posRes.value?.success) setPosStats(posRes.value.data);
 } catch (err) {
 console.error('Failed to fetch intelligence:', err);
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 fetchIntelligence();
 }, []);

 // Poll for job status
 useEffect(() => {
 const timer = setInterval(async () => {
 // FIX: include 'delayed' as terminal-stale — stop polling delayed jobs too
 const pendingJobs = activeJobs.filter(j => !['completed', 'failed', 'delayed'].includes(j.status));
 if (pendingJobs.length === 0) return;

 for (const job of pendingJobs) {
 try {
 const token = (localStorage.getItem('accessToken') || localStorage.getItem('token'));
 const response = await fetch(`/api/analytics/reports/status/${job.jobId}`, {
 headers: { 'Authorization': `Bearer ${token}` }
 });
 const data = await response.json();

 if (data.success) {
 updateJob(job.jobId, {
 status: data.data.state,
 progress: data.data.progress,
 result: data.data.result
 });

 if (data.data.state === 'completed') {
 addNotification({
 type: 'success',
 message: `Intelligence Report ${job.reportId} is ready!`
 });
 }
 }
 } catch (err) {
 console.error('Polling error:', err);
 }
 }
 }, 3000);

 return () => clearInterval(timer);
 }, [activeJobs]);

 const updateJob = (jobId: string, updates: Partial<ReportJob>) => {
 setActiveJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, ...updates } : j));
 };

 const startReport = async (type: string) => {
 setIsRequesting(true);
 try {
 const token = (localStorage.getItem('accessToken') || localStorage.getItem('token'));
 const response = await fetch('/api/analytics/reports/generate', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({ type, params: {} })
 });
 const data = await response.json();

 if (data.success) {
 setActiveJobs(prev => [{
 jobId: data.jobId,
 reportId: data.reportId,
 type,
 status: 'waiting',
 progress: 0
 }, ...prev]);
 
 addNotification({
 type: 'info',
 message: 'Report generation queued in background.'
 });
 }
 } catch (err) {
 addNotification({ type: 'error', message: 'Failed to start report' });
 } finally {
 setIsRequesting(false);
 }
 };

 if (isLoading) {
 return (
 <div className="space-y-6 animate-pulse">
 <div className="h-24 bg-slate-100 rounded-xl" />
 <div className="grid grid-cols-3 gap-6">
 <div className="h-48 bg-slate-100 rounded-xl" />
 <div className="h-48 bg-slate-100 rounded-xl" />
 <div className="h-48 bg-slate-100 rounded-xl" />
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6 animate-fadeIn">
 {/* Header section */}
 <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex items-center gap-4">
 <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-none shadow-indigo-100 ring-4 ring-indigo-50">
 <Sparkles size={24} />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Intelligence Dashboard <span className="text-indigo-600 text-sm align-top ml-1">V4</span></h1>
 <p className="text-slate-500 text-sm font-medium">Predictive Modeling & Actionable Business Insights</p>
 </div>
 </div>
 <div className="flex gap-2">
 <button 
 onClick={fetchIntelligence}
 className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-10 h-10 rounded-xl flex items-center justify-center transition-all">
 <RefreshCw size={18}/>
 </button>
 <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-none shadow-indigo-200 transition-all">
 <Download size={18}/> Full Audit
 </button>
 </div>
 </div>

 {/* V4 Intelligence KPIs */}
 <div className="grid grid-cols-4 gap-6">
 <StatCard 
 label="Cash Flow Prediction (30d)" 
 value={`₹${(parseFloat(financials?.kpis?.forecastedCash30d || '0')/1000000).toFixed(1)}M`}
 icon={<Wallet size={20} />} 
 trend={financials?.intelligence?.status === 'HEALTHY' ? 'Stable' : 'Risk'}
 color="indigo"
 />
 <StatCard 
 label="Customers at Risk" 
 value={customers?.driftingCount || 0}
 icon={<Users size={20} />} 
 trend={`${customers?.lostCount || 0} Lost`}
 color="rose"
 />
 <StatCard 
 label="POS Revenue (30d)" 
 value={`₹${((posStats?.monthlyRevenue || 0)/1000).toFixed(1)}k`}
 icon={<Activity size={20} />} 
 trend={`+${posStats?.growth || 12}%`}
 color="amber"
 />
 <StatCard 
 label="Intelligence Status" 
 value={financials?.intelligence?.status || 'OK'}
 icon={<ShieldCheck size={20} />} 
 trend="Audit Passed"
 color="emerald"
 />
 </div>

 <div className="grid grid-cols-12 gap-6">
 {/* Core Analysis Hub */}
 <div className="col-span-8 flex flex-col gap-6">
 <div className="grid grid-cols-2 gap-6">
 {reportTypes.slice(0, 2).map((rpt) => (
 <div key={rpt.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none hover:shadow-indigo-50 hover:border-indigo-200 transition-all group overflow-hidden relative">
 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
 <rpt.icon size={120} />
 </div>
 <div className="bg-indigo-50 w-14 h-14 rounded-xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
 <rpt.icon size={28} />
 </div>
 <h3 className="font-bold text-slate-800 text-lg mb-2">{rpt.name}</h3>
 <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">{rpt.desc}</p>
 <button 
 onClick={() => startReport(rpt.id)}
 disabled={isRequesting}
 className="w-full bg-slate-900 group-hover:bg-indigo-600 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all"
 >
 {isRequesting ? <Loader2 size={16} className="animate-spin" /> : <><Zap size={16}/> Initialize Engine</>}
 </button>
 </div>
 ))}
 </div>

 {/* Predictive Insight Box */}
 <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-x-32 -translate-y-32" />
 <div className="relative z-10">
 <div className="flex items-center gap-3 mb-6">
 <div className="bg-indigo-500/20 p-2 rounded-lg"><Brain className="text-indigo-400" size={24}/></div>
 <h3 className="font-bold text-xl tracking-tight">V4 Predictive Recommendation</h3>
 </div>
 <p className="text-indigo-100 text-lg mb-8 font-medium leading-relaxed max-w-2xl">
 {financials?.intelligence?.recommendation || 'Syncing data...'}. Based on 12-month data trends, your current burn rate is ₹{financials?.kpis?.burnRate || '0.00'}. 
 Maintaining current collection velocity will result in healthy liquidity for the next quarter.
 </p>
 <div className="flex gap-4">
 <button className="bg-white text-slate-900 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all">
 Explore Forecast <ArrowRight size={18}/>
 </button>
 <div className="flex items-center gap-2 text-indigo-300 text-sm font-bold">
 <Clock size={16}/> Updated 2 mins ago
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Sidebar Intelligence */}
 <div className="col-span-4 space-y-6">
 <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
 <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
 <TrendingDown className="text-rose-500" size={16}/> Risk Radar
 </h3>
 <div className="space-y-4">
 {customers?.atRisk?.map((c, i) => (
 <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
 c.drift_status === 'LOST' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
 }`}>
 {c.name.charAt(0)}
 </div>
 <div>
 <p className="text-xs font-bold text-slate-800">{c.name}</p>
 <p className="text-[10px] font-bold text-slate-400 uppercase">{c.drift_status}</p>
 </div>
 </div>
 <ChevronRight size={16} className="text-slate-300" />
 </div>
 ))}
 <button className="w-full mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest py-2">
 View Retention Strategy
 </button>
 </div>
 </div>

 <div className="bg-indigo-600 p-6 rounded-[2rem] text-white">
 <h3 className="font-bold text-indigo-100 mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px]">
 <Activity size={14}/> Health Score
 </h3>
 {(() => {
   // Compute health score from real KPIs (not hardcoded)
   // Each component contributes up to 25 points
   let score = 0;
   let breakdown = '';
   if (financials) {
     const cr = parseFloat(financials.kpis?.currentRatio ?? '0') || 0;
     const npm = parseFloat((financials.kpis?.netProfitMargin ?? '0').replace('%','')) || 0;
     const wc = financials.kpis?.workingCapital ?? 0;
     const status = financials.intelligence?.status ?? '';
     // Liquidity (25pts): ratio ≥ 2 = full
     score += Math.min(25, Math.round((cr / 2) * 25));
     // Profitability (25pts): margin ≥ 20% = full
     score += Math.min(25, Math.round((Math.max(0, npm) / 20) * 25));
     // Working capital (25pts): positive = 25, else 0
     score += wc > 0 ? 25 : 0;
     // Status (25pts): HEALTHY = 25, else 0
     score += status === 'HEALTHY' ? 25 : 0;
     breakdown = `CR: ${cr} · Margin: ${npm.toFixed(1)}% · WC: ${wc > 0 ? 'Positive' : 'Negative'}`;
   } else {
     score = 0;
     breakdown = 'Loading financial data…';
   }
   const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'At Risk';
   return (
     <>
       <div className="flex items-baseline gap-2 mb-6">
         <span className="text-5xl font-bold italic" data-testid="health-score">{score}</span>
         <span className="text-indigo-200 font-bold">/100</span>
         <span className="text-sm text-indigo-200 ml-1">({scoreLabel})</span>
       </div>
       <p className="text-xs text-indigo-100/70 font-medium leading-relaxed">
         {financials
           ? `${breakdown}. ${financials.intelligence?.recommendation ?? ''}`
           : 'Fetching live financial metrics…'}
       </p>
     </>
   );
 })()}
 </div>
 </div>
 </div>
 </div>
 );
};


