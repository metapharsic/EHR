import React, { useState, useEffect, useCallback } from 'react';
import { BudgetService, CostCenterService } from '../services/accountingService';
import { Plus, Save, X, AlertCircle, Download, TrendingUp, TrendingDown, BarChart2, Printer } from 'lucide-react';
import { exportBudgetReport } from '../utils/accountingExport';

export const BudgetManager: React.FC = () => {
 const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
 const [budgets, setBudgets] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');

 const [form, setForm] = useState({
 budgetName: '', financialYear: '2025-26', budgetType: 'Annual',
 period: 'Annual', startDate: '2025-04-01', endDate: '2026-03-31',
 notes: '',
 allocations: [
 { costCenter: '', account: '', budgetAmount: 0, description: '' }
 ]
 });

 const loadBudgets = useCallback(async () => {
 setLoading(true);
 try {
 const data = await BudgetService.getBudgets();
 setBudgets(Array.isArray(data) ? data : []);
 } catch {
 // Fall back to demo data
 setBudgets([
 { id: '1', budgetName: 'FY 2025-26 Annual Budget', financialYear: '2025-26', budgetType: 'Annual', totalBudget: 5000000, totalActual: 2300000, status: 'Active', startDate: '2025-04-01', endDate: '2026-03-31' },
 { id: '2', budgetName: 'Marketing Q1 Budget', financialYear: '2025-26', budgetType: 'Departmental', totalBudget: 800000, totalActual: 650000, status: 'Active', startDate: '2025-04-01', endDate: '2025-06-30' },
 ]);
 } finally { setLoading(false); }
 }, []);

 useEffect(() => { if (view === 'LIST') loadBudgets(); }, [view, loadBudgets]);

 const handleSave = async () => {
 if (!form.budgetName) { setError('Budget name is required'); return; }
 setSaving(true);
 setError('');
 try {
 await BudgetService.createBudget({
 budgetName: form.budgetName,
 financialYear: form.financialYear,
 budgetType: form.budgetType as any,
 period: form.period as any,
 startDate: form.startDate,
 endDate: form.endDate,
 status: 'Active',
 createdBy: 'Admin',
 allocations: form.allocations
 } as any);
 setView('LIST');
 } catch (err: any) {
 setError(err.message || 'Failed to save budget');
 } finally { setSaving(false); }
 };

 const getVariance = (budget: number, actual: number) => {
 const diff = budget - actual;
 const pct = budget > 0 ? (diff / budget) * 100 : 0;
 return { diff, pct };
 };

 if (view === 'FORM') {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="bg-[#1D3557] text-white px-4 py-2 flex justify-between items-center shrink-0">
 <h3 className="font-bold text-sm">New Budget Plan</h3>
 <button onClick={() => setView('LIST')} className="text-slate-300 hover:text-white text-xs font-bold">Cancel (Esc)</button>
 </div>
 <div className="flex-1 overflow-auto p-6 bg-slate-50">
 {error && <div className="mb-4 bg-red-50 text-red-700 border border-red-200 p-2 text-xs rounded flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
 <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-sm rounded p-6">
 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b pb-2">Budget Header</h4>
 <div className="grid grid-cols-3 gap-4 mb-6">
 <div className="col-span-3">
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Budget Name *</label>
 <input value={form.budgetName} onChange={e => setForm({...form, budgetName: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none focus:border-accent bg-yellow-50" placeholder="e.g. FY 2025-26 Operations Budget"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Financial Year</label>
 <select value={form.financialYear} onChange={e => setForm({...form, financialYear: e.target.value})} className="w-full border-b border-slate-300 p-1 text-sm outline-none">
 <option>2025-26</option><option>2024-25</option><option>2026-27</option>
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Budget Type</label>
 <select value={form.budgetType} onChange={e => setForm({...form, budgetType: e.target.value})} className="w-full border-b border-slate-300 p-1 text-sm outline-none">
 <option>Annual</option><option>Quarterly</option><option>Monthly</option><option>Departmental</option><option>Project</option>
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Period</label>
 <select value={form.period} onChange={e => setForm({...form, period: e.target.value})} className="w-full border-b border-slate-300 p-1 text-sm outline-none">
 <option>Annual</option><option>Half-Yearly</option><option>Quarterly</option><option>Monthly</option>
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
 <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full border-b border-slate-300 p-1 text-sm outline-none"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Date</label>
 <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full border-b border-slate-300 p-1 text-sm outline-none"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
 <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border-b border-slate-300 p-1 text-sm outline-none" placeholder="Optional notes..."/>
 </div>
 </div>

 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 border-b pb-2">Account Allocations</h4>
 <table className="w-full text-sm border-collapse">
 <thead className="bg-slate-100 text-xs uppercase text-slate-600 font-bold">
 <tr>
 <th className="p-2 text-left border border-slate-200">Cost Center</th>
 <th className="p-2 text-left border border-slate-200">Account/Expense Head</th>
 <th className="p-2 text-right border border-slate-200 w-36">Budget Amount (₹)</th>
 <th className="p-2 border border-slate-200 w-8"></th>
 </tr>
 </thead>
 <tbody>
 {form.allocations.map((a, i) => (
 <tr key={i} className="hover:bg-blue-50/30">
 <td className="border border-slate-200 p-1">
 <select value={a.costCenter} onChange={e => {const n=[...form.allocations];n[i].costCenter=e.target.value;setForm({...form,allocations:n});}} className="w-full text-sm outline-none bg-transparent">
 <option value="">Select Center</option>
 {['Main HQ','Marketing','Operations','R&D','Sales'].map(c => <option key={c}>{c}</option>)}
 </select>
 </td>
 <td className="border border-slate-200 p-1"><input value={a.account} onChange={e => {const n=[...form.allocations];n[i].account=e.target.value;setForm({...form,allocations:n});}} className="w-full text-sm outline-none" placeholder="Account name..."/></td>
 <td className="border border-slate-200 p-1"><input type="number" value={a.budgetAmount || ''} onChange={e => {const n=[...form.allocations];n[i].budgetAmount=Number(e.target.value);setForm({...form,allocations:n});}} className="w-full text-sm outline-none text-right font-bold" placeholder="0"/></td>
 <td className="border border-slate-200 p-1 text-center"><button onClick={() => {const n=form.allocations.filter((_,j)=>j!==i);setForm({...form,allocations:n});}} className="text-red-400 hover:text-red-600"><X size={14}/></button></td>
 </tr>
 ))}
 </tbody>
 </table>
 <button onClick={() => setForm({...form, allocations:[...form.allocations,{costCenter:'',account:'',budgetAmount:0,description:''}]})} className="mt-2 text-xs font-bold text-accent hover:underline flex items-center gap-1"><Plus size={12}/> Add Row</button>
 <div className="mt-4 p-3 bg-blue-50 rounded flex justify-between text-sm font-bold text-[#1D3557]">
 <span>Total Budget Allocated:</span>
 <span>₹ {form.allocations.reduce((s,r)=>s+Number(r.budgetAmount||0),0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
 </div>
 </div>
 </div>
 <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end gap-3 shrink-0">
 <button onClick={() => setView('LIST')} className="px-5 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white">Cancel</button>
 <button onClick={handleSave} disabled={saving} className="px-6 py-1.5 text-sm font-bold text-white bg-[#1D3557] rounded flex items-center gap-2 hover:bg-[#2A4B7C] disabled:opacity-50">
 <Save size={14}/> {saving ? 'Saving...' : 'Save Budget Plan'}
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Budget vs Actuals</h3>
 <p className="text-xs text-slate-500">Monitor planned vs actual spending with variance analysis</p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => exportBudgetReport(budgets)} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export Excel</button>
 <button onClick={() => setView('FORM')} className="flex items-center gap-1 bg-[#1D3557] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm hover:bg-[#2A4B7C]"><Plus size={16}/> New Budget</button>
 </div>
 </div>

 <div className="flex-1 overflow-auto p-4 bg-slate-100">
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading budgets...</div>
 ) : budgets.map(b => {
 const { diff, pct } = getVariance(b.totalBudget || 0, b.totalActual || 0);
 const usedPct = b.totalBudget > 0 ? ((b.totalActual || 0) / b.totalBudget) * 100 : 0;
 return (
 <div key={b.id} className="bg-white border border-slate-200 shadow-sm rounded mb-4 overflow-hidden">
 <div className="p-4 flex justify-between items-start border-b border-slate-100">
 <div>
 <div className="font-bold text-[#1D3557] text-base">{b.budgetName}</div>
 <div className="text-xs text-slate-500 font-medium mt-0.5">{b.budgetType} • {b.financialYear} • {b.startDate} to {b.endDate}</div>
 </div>
 <div className="flex items-center gap-3">
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${diff >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
 {diff >= 0 ? 'Under Budget' : 'Over Budget'}
 </span>
 <button className="text-xs font-bold text-accent hover:underline flex items-center gap-1"><BarChart2 size={12}/> Drill Down</button>
 </div>
 </div>
 <div className="p-4 grid grid-cols-4 gap-4">
 <div>
 <div className="text-[10px] text-slate-500 uppercase font-bold">Total Budget</div>
 <div className="font-bold text-slate-800 text-lg">₹{(b.totalBudget || 0).toLocaleString()}</div>
 </div>
 <div>
 <div className="text-[10px] text-slate-500 uppercase font-bold">Actual Spent</div>
 <div className="font-bold text-slate-800 text-lg">₹{(b.totalActual || 0).toLocaleString()}</div>
 </div>
 <div>
 <div className="text-[10px] text-slate-500 uppercase font-bold">Variance</div>
 <div className={`font-bold text-lg flex items-center gap-1 ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
 {diff >= 0 ? <TrendingDown size={16}/> : <TrendingUp size={16}/>}
 ₹{Math.abs(diff).toLocaleString()} ({Math.abs(pct).toFixed(1)}%)
 </div>
 </div>
 <div>
 <div className="text-[10px] text-slate-500 uppercase font-bold">Utilisation</div>
 <div className="font-bold text-slate-800 text-lg">{usedPct.toFixed(1)}%</div>
 <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${usedPct > 90 ? 'bg-red-500' : usedPct > 75 ? 'bg-orange-400' : 'bg-green-500'}`} style={{width:`${Math.min(usedPct,100)}%`}}/>
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
};

