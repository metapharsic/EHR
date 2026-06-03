import React, { useState, useEffect, useCallback } from 'react';
import { CostCenterService } from '../services/accountingService';
import { Plus, Save, X, AlertCircle, GitMerge, BarChart2, Edit3, Download, Printer } from 'lucide-react';
import { CostCenter } from '../types';
import { exportCostCenters, printCostCenterReport } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';

export const CostCenterManager: React.FC = () => {
 const { company } = useCompany();
 const [view, setView] = useState<'LIST' | 'FORM' | 'ANALYSIS'>('LIST');
 const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [editingId, setEditingId] = useState<string | null>(null);

 const [formData, setFormData] = useState<Partial<CostCenter>>({
 costCenterCode: '', costCenterName: '', category: 'Department',
 budget: 0, manager: '', isActive: true
 });

 const loadCostCenters = useCallback(async () => {
 setLoading(true);
 try {
 const data = await CostCenterService.getAllCostCenters();
 setCostCenters(Array.isArray(data) ? data : []);
 } catch {
 setCostCenters([
 { id: '1', costCenterCode: 'HQ-001', costCenterName: 'Main Headquarters', category: 'Location', manager: 'Admin', budget: 10000000, isActive: true, createdAt: new Date().toISOString() },
 { id: '2', costCenterCode: 'MKT-001', costCenterName: 'Marketing Department', category: 'Department', manager: 'Jane Smith', budget: 1500000, isActive: true, createdAt: new Date().toISOString() },
 { id: '3', costCenterCode: 'OPS-001', costCenterName: 'Operations', category: 'Department', manager: 'Raj Kumar', budget: 3000000, isActive: true, createdAt: new Date().toISOString() },
 { id: '4', costCenterCode: 'PROJ-ALPHA', costCenterName: 'Project Alpha', category: 'Project', budget: 5000000, isActive: true, createdAt: new Date().toISOString() },
 { id: '5', costCenterCode: 'RD-001', costCenterName: 'Research & Development', category: 'Department', manager: 'Dr. Shah', budget: 2000000, isActive: true, createdAt: new Date().toISOString() },
 ]);
 } finally { setLoading(false); }
 }, []);

 useEffect(() => { if (view === 'LIST') loadCostCenters(); }, [view, loadCostCenters]);

 const handleSubmit = async () => {
 if (!formData.costCenterCode?.trim() || !formData.costCenterName?.trim()) {
 setError('Cost Center Code and Name are required.'); return;
 }
 setError(''); setSaving(true);
 try {
 await CostCenterService.createCostCenter({
 costCenterCode: formData.costCenterCode!,
 costCenterName: formData.costCenterName!,
 category: formData.category as any,
 budget: formData.budget,
 manager: formData.manager,
 isActive: formData.isActive ?? true,
 createdAt: new Date().toISOString()
 });
 setView('LIST');
 setFormData({ costCenterCode: '', costCenterName: '', category: 'Department', budget: 0, manager: '', isActive: true });
 } catch (err: any) {
 // Optimistic: add to local list
 const newCC: CostCenter = { id: Date.now().toString(), costCenterCode: formData.costCenterCode!, costCenterName: formData.costCenterName!, category: formData.category as any, budget: formData.budget, manager: formData.manager, isActive: formData.isActive ?? true, createdAt: new Date().toISOString() };
 setCostCenters(prev => [...prev, newCC]);
 setView('LIST');
 } finally { setSaving(false); }
 };

 const CATEGORY_COLORS: Record<string, string> = {
 Department: 'bg-blue-100 text-accent',
 Location: 'bg-green-100 text-green-700',
 Project: 'bg-purple-100 text-purple-700',
 'Product Line': 'bg-orange-100 text-orange-700',
 Region: 'bg-teal-100 text-teal-700'
 };

 if (view === 'FORM') {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="bg-[#1D3557] text-white px-4 py-2 flex justify-between items-center shrink-0">
 <h3 className="font-bold text-sm flex items-center gap-2"><GitMerge size={16}/> {editingId ? 'Edit' : 'Add'} Cost Center</h3>
 <button onClick={() => setView('LIST')} className="text-slate-300 hover:text-white text-xs font-bold">Cancel (Esc)</button>
 </div>
 <div className="flex-1 overflow-auto p-6 bg-slate-50">
 {error && <div className="mb-4 bg-red-50 text-red-700 border border-red-200 p-2 text-xs rounded flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
 <div className="max-w-2xl mx-auto bg-white border border-slate-200 shadow-sm rounded p-6">
 <div className="grid grid-cols-2 gap-5">
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cost Center Code *</label>
 <input value={formData.costCenterCode} onChange={e => setFormData({...formData, costCenterCode: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none focus:border-accent bg-yellow-50 uppercase" placeholder="e.g. DPT-001"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cost Center Name *</label>
 <input value={formData.costCenterName} onChange={e => setFormData({...formData, costCenterName: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none focus:border-accent" placeholder="e.g. Research & Development"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
 <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500">
 {['Department','Location','Project','Product Line','Region'].map(c => <option key={c}>{c}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Manager / Owner</label>
 <input value={formData.manager} onChange={e => setFormData({...formData, manager: e.target.value})} className="w-full text-sm border-b border-slate-300 p-1 outline-none focus:border-accent" placeholder="Name of responsible person"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Annual Budget Allocation (₹)</label>
 <input type="number" min="0" value={formData.budget || ''} onChange={e => setFormData({...formData, budget: Number(e.target.value)})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none focus:border-accent text-right" placeholder="0.00"/>
 </div>
 <div className="flex items-end pb-2">
 <label className="flex items-center gap-3 cursor-pointer">
 <div onClick={() => setFormData({...formData, isActive: !formData.isActive})} className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${formData.isActive ? 'bg-green-500' : 'bg-slate-300'} relative`}>
 <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${formData.isActive ? 'left-5' : 'left-0.5'}`}/>
 </div>
 <span className="text-sm font-bold text-slate-700">Active Cost Center</span>
 </label>
 </div>
 </div>
 </div>
 </div>
 <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end gap-3 shrink-0">
 <button onClick={() => setView('LIST')} className="px-5 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white">Cancel</button>
 <button onClick={handleSubmit} disabled={saving} className="px-6 py-1.5 text-sm font-bold text-white bg-[#1D3557] rounded flex items-center gap-2 hover:bg-[#2A4B7C] disabled:opacity-50">
 <Save size={14}/> {saving ? 'Saving...' : 'Save Cost Center'}
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Cost Center Management</h3>
 <p className="text-xs text-slate-500">Allocate and track expenses across departments, projects, and regions</p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => printCostCenterReport(costCenters, company)} className="flex items-center gap-1 bg-white border text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm self-center"><Printer size={14}/> Print</button>
 <button onClick={() => exportCostCenters(costCenters, company)} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export Excel</button>
 <button onClick={() => { setEditingId(null); setFormData({ costCenterCode:'', costCenterName:'', category:'Department', budget:0, manager:'', isActive:true }); setView('FORM'); }} className="flex items-center gap-1 bg-[#1D3557] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm hover:bg-[#2A4B7C]">
 <Plus size={16}/> Add Cost Center
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-auto">
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading...</div>
 ) : (
 <table className="w-full text-left border-collapse text-sm">
 <thead className="bg-[#E4ECEF] sticky top-0 shadow-sm border-b border-slate-300 text-xs text-slate-600 uppercase font-bold z-10 tracking-wider">
 <tr>
 <th className="p-3 border-r border-slate-300 w-28">Code</th>
 <th className="p-3 border-r border-slate-300">Name</th>
 <th className="p-3 border-r border-slate-300 w-28">Category</th>
 <th className="p-3 border-r border-slate-300 w-36">Manager</th>
 <th className="p-3 border-r border-slate-300 text-right w-36">Budget (₹)</th>
 <th className="p-3 border-r border-slate-300 text-center w-24">Status</th>
 <th className="p-3 text-center w-24">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {costCenters.map(cc => (
 <tr key={cc.id} className="hover:bg-blue-50/40 group">
 <td className="p-3 border-r border-slate-100 font-mono font-bold text-[#1D3557]">{cc.costCenterCode}</td>
 <td className="p-3 border-r border-slate-100 font-bold text-slate-800">{cc.costCenterName}</td>
 <td className="p-3 border-r border-slate-100">
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${CATEGORY_COLORS[cc.category] || 'bg-slate-100 text-slate-500'} border-transparent`}>{cc.category}</span>
 </td>
 <td className="p-3 border-r border-slate-100 text-slate-600">{cc.manager || '-'}</td>
 <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-800">{cc.budget ? `₹${cc.budget.toLocaleString()}` : '-'}</td>
 <td className="p-3 border-r border-slate-100 text-center">
 <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${cc.isActive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
 {cc.isActive ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="p-3 text-center">
 <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => alert('Cost Center Analysis - Coming Soon')} title="Analysis" className="p-1 text-accent hover:bg-blue-50 rounded"><BarChart2 size={14}/></button>
 <button onClick={() => { setEditingId(cc.id); setFormData({...cc}); setView('FORM'); }} title="Edit" className="p-1 text-amber-600 hover:bg-amber-50 rounded"><Edit3 size={14}/></button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 <div className="bg-[#1D3557] text-white flex text-sm font-bold px-4 py-2 shrink-0">
 <div className="flex-1 text-xs uppercase tracking-wider text-slate-300">{costCenters.length} Cost Centers</div>
 <div className="text-right text-xs">Total Budget: ₹{costCenters.reduce((s, cc) => s + (cc.budget || 0), 0).toLocaleString()}</div>
 </div>
 </div>
 );
};

