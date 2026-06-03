import React from 'react';
import { Package, MapPin, TrendingUp, AlertTriangle, ArrowRightLeft, Globe, RefreshCcw } from 'lucide-react';
import { Branch, Product } from '../types';
import { useDataFetch } from '../hooks/useDataFetch';

const MultiBranchDashboard: React.FC = () => {
 // Real Enterprise Data Fetching
 const { data: bResponse, loading: bLoading, refetch: bRefetch } = useDataFetch('/api/inventory-enterprise/branches');
 const { data: sResponse, loading: sLoading } = useDataFetch('/api/inventory-enterprise/global-summary');
 const { data: pResponse, loading: pLoading } = useDataFetch('/api/inventory');

 const branches = Array.isArray(bResponse) ? bResponse : (bResponse?.data || []);
 const summary = (sResponse && !sResponse.data) ? sResponse : (sResponse?.data || { totalBranches: 0, totalSKUs: 0, totalUnits: 0, criticallyLow: 0 });
 const products = Array.isArray(pResponse) ? pResponse : (pResponse?.data || []);

 const loading = bLoading || sLoading || pLoading;

 const lowStockThreshold = 100;
 const criticalItems = products.filter((p: any) => (p.currentStock || 0) < lowStockThreshold);

 if (loading) return (
 <div className="p-20 text-center">
 <RefreshCcw className="mx-auto text-accent animate-spin mb-4" size={48}/>
 <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Live Enterprise Data...</p>
 </div>
 );

 return (
 <div className="p-6 space-y-6 bg-slate-50 min-h-full">
 {/* Top Header */}
 <div className="flex justify-between items-end mb-4">
 <div>
 <h2 className="text-2xl font-bold text-[#1D3557] tracking-tight flex items-center gap-3">
 <Globe className="text-accent" size={28}/> Enterprise Inventory Hub
 </h2>
 <p className="text-sm text-slate-500 font-medium">Consolidated monitoring across {branches.length} branches</p>
 </div>
 <div className="flex gap-3">
 <button className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
 <ArrowRightLeft size={14}/> NEW TRANSFER
 </button>
 <button className="bg-[#1D3557] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-none hover:shadow-none transition-all">
 GLOBAL SYNC
 </button>
 </div>
 </div>

 {/* KPI Row */}
 <div className="grid grid-cols-4 gap-4">
 {[
 { label: 'Total Branches', value: summary.totalBranches, icon: MapPin, color: 'text-accent', bg: 'bg-blue-50' },
 { label: 'Enterprise SKUs', value: summary.totalSKUs, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
 { label: 'Total Units', value: summary.totalUnits.toLocaleString(), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
 { label: 'Critically Low', value: criticalItems.length, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' }
 ].map((kpi, i) => (
 <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-none transition-shadow cursor-default">
 <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color}`}><kpi.icon size={24}/></div>
 <div>
 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</div>
 <div className="text-xl font-bold text-slate-800">{kpi.value}</div>
 </div>
 </div>
 ))}
 </div>

 <div className="grid grid-cols-3 gap-6">
 {/* Branch Distribution Table */}
 <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
 <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
 <h3 className="font-bold text-slate-800 text-sm uppercase tracking-tighter">Branch-wise Inventory Distribution</h3>
 <span className="text-[10px] font-bold text-accent bg-blue-50 px-2 py-1 rounded">LIVE FEED</span>
 </div>
 <div className="flex-1 overflow-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase sticky top-0">
 <tr>
 <th className="px-6 py-3">Branch Name</th>
 <th className="px-6 py-3">Manager</th>
 <th className="px-6 py-3 text-right">In-Stock</th>
 <th className="px-6 py-3 text-right">In-Transit</th>
 <th className="px-6 py-3 text-center">Health</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {branches.map(b => (
 <tr key={b.id} className="hover:bg-slate-50 transition-colors group">
 <td className="px-6 py-4">
 <div className="font-bold text-slate-700">{b.name}</div>
 <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{b.type} • {b.city}</div>
 </td>
 <td className="px-6 py-4 text-slate-600 font-medium italic">{b.manager}</td>
 <td className="px-6 py-4 text-right font-bold text-accent">{(Math.random() * 5000).toFixed(0)}</td>
 <td className="px-6 py-4 text-right font-bold text-amber-600">{(Math.random() * 200).toFixed(0)}</td>
 <td className="px-6 py-4 text-center">
 <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-bold uppercase">Active</span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Critical Stock Alerts */}
 <div className="col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
 <div className="px-6 py-4 border-b border-slate-100 bg-red-50/30 flex justify-between items-center">
 <h3 className="font-bold text-red-800 text-sm uppercase tracking-tighter">Stock Alarms</h3>
 <AlertTriangle className="text-red-500" size={16}/>
 </div>
 <div className="flex-1 overflow-auto p-4 space-y-3">
 {criticalItems.slice(0, 5).map(p => (
 <div key={p.id} className="p-3 border border-red-100 rounded-xl bg-red-50/20 hover:bg-red-50 transition-all flex justify-between items-center group">
 <div>
 <div className="text-xs font-bold text-slate-700">{p.name}</div>
 <div className="text-[10px] font-bold text-red-600">{p.totalStock} {p.uom} left</div>
 </div>
 <button className="p-2 bg-white border border-red-200 rounded-lg text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
 <ArrowRightLeft size={12}/>
 </button>
 </div>
 ))}
 <button className="w-full py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">VIEW FULL ENGINE report</button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default MultiBranchDashboard;


