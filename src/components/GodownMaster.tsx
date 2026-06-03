import React, { useState, useEffect, useCallback } from 'react';
import { Save, Search, Plus, MapPin, Download, Printer, Edit3, AlertCircle, RefreshCw, Warehouse } from 'lucide-react';
import { GodownService } from '../services/accountingService';
import { utils, writeFile } from 'xlsx';
import { printReport, addExcelBranding } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';

const DEMO_GODOWNS = [
 { id: '1', name: 'Main Warehouse', parent: 'Primary', manager: 'Admin', address: 'Plot 12, Industrial Area, Mumbai', isThirdParty: false, isActive: true },
 { id: '2', name: 'Cold Storage Unit', parent: 'Main Warehouse', manager: 'John Dsouza', address: 'Annex - B, Main Warehouse', isThirdParty: false, isActive: true },
 { id: '3', name: 'Transit Store', parent: 'Primary', manager: 'System', address: 'Loading Bay, Gate 2', isThirdParty: false, isActive: true },
 { id: '4', name: 'Job Worker - Raj Labs', parent: 'Primary', manager: 'External', address: 'Raj Laboratories, Pune', isThirdParty: true, isActive: true },
];

export const GodownMaster: React.FC = () => {
 const { company } = useCompany();
 const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
 const [godowns, setGodowns] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [successMsg, setSuccessMsg] = useState('');

 const defaultForm = { name: '', parent: 'Primary', manager: '', address: '', isThirdParty: false, isActive: true };
 const [form, setForm] = useState(defaultForm);

 const loadGodowns = useCallback(async () => {
 setLoading(true);
 try {
 const data = await GodownService.getAll();
 setGodowns(Array.isArray(data) ? data : []);
 } catch {
 setGodowns(DEMO_GODOWNS);
 } finally { setLoading(false); }
 }, []);

 useEffect(() => { if (view === 'LIST') loadGodowns(); }, [view, loadGodowns]);

 const handleSave = async () => {
 if (!form.name.trim()) return;
 setSaving(true);
 try {
 if (editingId) {
 await GodownService.update(editingId, form);
 setGodowns(prev => prev.map(g => g.id === editingId ? { ...g, ...form } : g));
 } else {
 const result = await GodownService.create(form);
 setGodowns(prev => [...prev, result]);
 }
 setSuccessMsg('Godown saved successfully');
 } catch {
 const newG = { id: Date.now().toString(), ...form };
 if (editingId) setGodowns(prev => prev.map(g => g.id === editingId ? newG : g));
 else setGodowns(prev => [...prev, newG]);
 setSuccessMsg('Godown saved (offline mode)');
 } finally {
 setSaving(false); setView('LIST'); setEditingId(null); setForm(defaultForm);
 setTimeout(() => setSuccessMsg(''), 3000);
 }
 };

 const handleExport = () => {
 const rows = filtered.map(g => ({
 'Name': g.name, 'Parent Location': g.parent, 'Manager': g.manager,
 'Address': g.address, 'Third Party Stock': g.isThirdParty ? 'Yes' : 'No', 'Status': g.isActive ? 'Active' : 'Inactive'
 }));
 const ws = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws, 'Godown / Location Master', company);
 utils.sheet_add_json(ws, rows, { origin: 'A6' });
 ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 16 }, { wch: 10 }];
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws, 'Godowns');
 writeFile(wb, `Godown_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
 };

 const handlePrint = () => {
 const rows = godowns.map(g => `<tr>
 <td>${g.code}</td><td>${g.name}</td><td>${g.address}</td><td>${g.city}</td><td>${g.capacity || '-'}</td>
 <td><span class="badge ${g.isActive ? 'badge-green' : ''}">${g.isActive ? 'Active' : 'Inactive'}</span></td>
 </tr>`).join('');
 printReport('Godown / Location Master', `<table><thead><tr><th>Code</th><th>Name</th><th>Address</th><th>City</th><th>Capacity</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`, company);
 };

 const filtered = godowns.filter(g => {
 const t = searchTerm.toLowerCase();
 return !t || g.name?.toLowerCase().includes(t) || g.parent?.toLowerCase().includes(t) || g.manager?.toLowerCase().includes(t);
 });

 if (view === 'FORM') {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="bg-[#1D3557] text-white px-4 py-2 flex justify-between items-center shrink-0">
 <h3 className="font-bold tracking-wider text-sm flex items-center gap-2"><Warehouse size={16}/>{editingId ? 'Edit' : 'Create'} Godown / Location</h3>
 <button onClick={() => { setView('LIST'); setEditingId(null); setForm(defaultForm); }} className="text-slate-300 hover:text-white text-xs font-bold">Close (Esc)</button>
 </div>
 <div className="flex-1 overflow-auto p-4 bg-slate-50">
 <div className="max-w-3xl mx-auto space-y-5">
 <div className="bg-white p-5 rounded border border-slate-200 shadow-sm">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2"><MapPin size={14}/> Location Details</h4>
 <div className="space-y-4">
 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Godown / Location Name *</label>
 <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 bg-yellow-50 outline-none" placeholder="e.g. Warehouse A — Cold Storage"/></div>
 <div className="grid grid-cols-2 gap-4">
 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Under (Parent Location)</label>
 <select value={form.parent} onChange={e => setForm({...form, parent: e.target.value})} className="w-full text-sm border border-slate-300 rounded p-1.5 outline-none bg-yellow-50">
 <option>Primary</option>
 {godowns.filter(g => g.id !== editingId).map(g => <option key={g.id}>{g.name}</option>)}
 </select></div>
 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Manager / Incharge</label>
 <input value={form.manager} onChange={e => setForm({...form, manager: e.target.value})} className="w-full text-sm border-b border-slate-300 p-1 outline-none" placeholder="Name or department"/></div>
 </div>
 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Physical Address</label>
 <textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full text-sm border border-slate-300 rounded p-2 outline-none resize-none" rows={3} placeholder="Full warehouse / godown address"/></div>
 <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-dashed border-slate-300">
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={form.isThirdParty} onChange={e => setForm({...form, isThirdParty: e.target.checked})} className="w-4 h-4"/>
 <span className="text-sm font-bold text-amber-700">Our Stock with Third Party (Job Worker)</span>
 </label>
 <label className="flex items-center gap-3 cursor-pointer">
 <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="w-4 h-4"/>
 <span className="text-sm font-bold text-green-700">Active Location</span>
 </label>
 </div>
 </div>
 </div>
 </div>
 </div>
 <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end gap-3 shrink-0">
 <button onClick={() => { setView('LIST'); setEditingId(null); setForm(defaultForm); }} className="px-6 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white">Cancel</button>
 <button onClick={handleSave} disabled={saving} className="px-6 py-1.5 text-sm font-bold text-white bg-[#1D3557] rounded flex items-center gap-2 hover:bg-[#2A4B7C] disabled:opacity-50">
 <Save size={14}/>{saving ? 'Saving...' : editingId ? 'Update Godown' : 'Save Godown'}
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">Godowns / Warehouse Locations</h3>
 <p className="text-xs text-slate-500">Manage stock points, cold storage units, and third-party warehouses</p>
 </div>
 <div className="flex gap-2">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
 <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search godowns..." className="pl-8 pr-4 py-1.5 border border-slate-300 rounded text-sm outline-none w-48"/>
 </div>
 <button onClick={handlePrint} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Printer size={14}/> Print</button>
 <button onClick={handleExport} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export</button>
 <button onClick={() => { setEditingId(null); setForm(defaultForm); setView('FORM'); }} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm">
 <Plus size={16}/> Create (F2)
 </button>
 </div>
 </div>
 {successMsg && <div className="bg-green-50 border-b border-green-200 text-green-700 px-4 py-2 text-xs font-bold">{successMsg}</div>}
 <div className="flex-1 overflow-auto">
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm">
 <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading godowns...
 </div>
 ) : (
 <table className="w-full text-left border-collapse text-sm">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-xs uppercase tracking-wider text-slate-600">
 <tr>
 <th className="p-3 font-bold border-r border-white/50">Godown Name</th>
 <th className="p-3 font-bold border-r border-white/50 w-40">Parent</th>
 <th className="p-3 font-bold border-r border-white/50 w-32">Manager</th>
 <th className="p-3 font-bold border-r border-white/50">Address</th>
 <th className="p-3 font-bold border-r border-white/50 w-24 text-center">Type</th>
 <th className="p-3 font-bold w-20 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filtered.map(g => (
 <tr key={g.id} className="hover:bg-blue-50/50 cursor-pointer group">
 <td className="p-3 border-r border-slate-100 font-bold text-[#1D3557] flex items-center gap-2"><Warehouse size={14} className="text-slate-400"/>{g.name}</td>
 <td className="p-3 border-r border-slate-100 text-xs italic text-slate-600">{g.parent}</td>
 <td className="p-3 border-r border-slate-100 text-xs">{g.manager || '–'}</td>
 <td className="p-3 border-r border-slate-100 text-xs text-slate-500 truncate max-w-xs">{g.address || '–'}</td>
 <td className="p-3 border-r border-slate-100 text-center">
 {g.isThirdParty ? <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">External</span>
 : <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">Own</span>}
 </td>
 <td className="p-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => { setEditingId(g.id); setForm({ ...defaultForm, ...g }); setView('FORM'); }} className="p-1 text-amber-600 hover:bg-amber-50 rounded"><Edit3 size={13}/></button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 <div className="bg-[#1D3557] text-white flex text-xs font-bold shrink-0 px-4 py-2">
 <div className="flex-1">{filtered.length} locations</div>
 <div className="text-slate-300">{filtered.filter(g => g.isThirdParty).length} third-party · {filtered.filter(g => g.isActive).length} active</div>
 </div>
 </div>
 );
};

