import React, { useState, useEffect, useCallback } from 'react';
import { Save, Search, Plus, Wrench, PackagePlus, Download, Printer, Edit3 } from 'lucide-react';
import { DenseGrid, ColumnDef } from './common/DenseGrid';
import { BOMService } from '../services/accountingService';
import { utils, writeFile } from 'xlsx';
import { printReport, addExcelBranding } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';

const DEMO_BOMS = [
 { id: '1', bomName: 'Paracetamol 500mg Std Recipe', targetItem: 'Paracetamol 500mg (Box)', batchYield: 1, stdCost: 137.50, isActive: true,
 materials: [
 { item: 'Paracetamol Powder', qty: 0.5, uom: 'Kg', cost: 80, scrap: 2 },
 { item: 'Blister Foil', qty: 10, uom: 'Sheets', cost: 5, scrap: 5 },
 { item: 'Mono Carton', qty: 10, uom: 'Nos', cost: 2, scrap: 0 },
 ]
 },
 { id: '2', bomName: 'Amoxicillin 250mg Recipe', targetItem: 'Amoxicillin 250mg (Strip)', batchYield: 1, stdCost: 92.00, isActive: true,
 materials: [
 { item: 'Amoxicillin Trihydrate', qty: 0.25, uom: 'Kg', cost: 300, scrap: 3 },
 { item: 'Blister Pack', qty: 10, uom: 'Nos', cost: 4, scrap: 2 },
 ]
 }
];

export const BomMaster: React.FC = () => {
 const { company } = useCompany();
 const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
 const [boms, setBoms] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [successMsg, setSuccessMsg] = useState('');

 const defaultMaterials = [{ item: '', qty: 1, uom: 'Nos', cost: 0, scrap: 0 }];
 const defaultForm = { bomName: '', targetItem: '', batchYield: 1, isActive: true };
 const [form, setForm] = useState<any>(defaultForm);
 const [materials, setMaterials] = useState<any[]>(defaultMaterials);

 const loadBoms = useCallback(async () => {
 setLoading(true);
 try {
 const data = await BOMService.getAll();
 setBoms(Array.isArray(data) ? data : []);
 } catch {
 setBoms(DEMO_BOMS);
 } finally { setLoading(false); }
 }, []);

 useEffect(() => { if (view === 'LIST') loadBoms(); }, [view, loadBoms]);

 const stdCost = materials.reduce((s, m) => s + ((m.cost || 0) * (m.qty || 0) * (1 + (m.scrap || 0) / 100)), 0);

 const handleSave = async () => {
 if (!form.bomName.trim() || !form.targetItem.trim()) return;
 setSaving(true);
 const payload = { ...form, stdCost: Math.round(stdCost * 100) / 100, materials };
 try {
 if (editingId) {
 await BOMService.update(editingId, payload);
 setBoms(prev => prev.map(b => b.id === editingId ? { ...b, ...payload } : b));
 } else {
 const result = await BOMService.create(payload);
 setBoms(prev => [...prev, result]);
 }
 setSuccessMsg('BOM saved successfully');
 } catch {
 const newB = { id: Date.now().toString(), ...payload };
 if (editingId) setBoms(prev => prev.map(b => b.id === editingId ? newB : b));
 else setBoms(prev => [...prev, newB]);
 setSuccessMsg('BOM saved (offline mode)');
 } finally {
 setSaving(false); setView('LIST'); setEditingId(null); setForm(defaultForm); setMaterials(defaultMaterials);
 setTimeout(() => setSuccessMsg(''), 3000);
 }
 };

 const handleExport = () => {
 const wb = utils.book_new();
 // Summary sheet
 const summary = filtered.map(b => ({
 'BOM Name': b.bomName, 'Target Item': b.targetItem, 'Batch Yield': b.batchYield,
 'Std Cost (₹)': b.stdCost, 'Materials Count': (b.materials || []).length, 'Status': b.isActive ? 'Active' : 'Inactive'
 }));
 const ws1 = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws1, 'BOM Master Summary', company);
 utils.sheet_add_json(ws1, summary, { origin: 'A6' });
 ws1['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
 utils.book_append_sheet(wb, ws1, 'BOM List');
 // Materials detail sheet
 const matRows = filtered.flatMap(b => (b.materials || []).map((m: any) => ({
 'BOM Name': b.bomName, 'Raw Material': m.item, 'Qty': m.qty, 'UOM': m.uom, 'Std Cost/Unit': m.cost, 'Scrap %': m.scrap,
 'Effective Cost': ((m.cost || 0) * (m.qty || 0) * (1 + (m.scrap || 0) / 100)).toFixed(2)
 })));
 if (matRows.length) {
 const ws2 = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws2, 'BOM Materials Detail', company);
 utils.sheet_add_json(ws2, matRows, { origin: 'A6' });
 ws2['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
 utils.book_append_sheet(wb, ws2, 'Materials Detail');
 }
 writeFile(wb, `BOM_Master_${new Date().toISOString().slice(0, 10)}.xlsx`);
 };

 const handlePrint = () => {
 const rows = filtered.map(b => `<tr>
 <td>${b.bomName}</td><td>${b.targetItem}</td><td class="text-right">${b.batchYield}</td>
 <td class="text-right">₹${(b.stdCost || 0).toLocaleString()}</td><td><span class="badge ${b.isActive ? 'badge-green' : ''}">${b.isActive ? 'Active' : 'Inactive'}</span></td>
 </tr>`).join('');
 printReport('Bill of Materials (BOM)', `<table><thead><tr><th>BOM Name</th><th>Target Item</th><th class="text-right">Yield</th><th class="text-right">Std. Cost</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`, company);
 };

 const columns: ColumnDef<any>[] = [
 { key: 'item', header: 'Raw Material / Ingredient', type: 'text' },
 { key: 'qty', header: 'Quantity', type: 'number', align: 'right', width: '100px' },
 { key: 'uom', header: 'UOM', type: 'select', align: 'center', width: '80px', options: ['Nos','Kg','Litre','Strip','Box','Sheet','Gm'].map(v=>({value:v,label:v})) },
 { key: 'scrap', header: 'Scrap %', type: 'number', align: 'right', width: '80px' },
 { key: 'cost', header: 'Cost/Unit (₹)', type: 'number', align: 'right', width: '110px' }
 ];

 const filtered = boms.filter(b => {
 const t = searchTerm.toLowerCase();
 return !t || b.bomName?.toLowerCase().includes(t) || b.targetItem?.toLowerCase().includes(t);
 });

 if (view === 'FORM') {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="bg-[#1D3557] text-white px-4 py-2 flex justify-between items-center shrink-0">
 <h3 className="font-bold tracking-wider text-sm flex items-center gap-2"><Wrench size={16}/>{editingId ? 'Edit' : 'Create'} Bill of Materials</h3>
 <button onClick={() => { setView('LIST'); setEditingId(null); setForm(defaultForm); setMaterials(defaultMaterials); }} className="text-slate-300 hover:text-white text-xs font-bold">Close (Esc)</button>
 </div>
 <div className="flex-1 overflow-auto p-4 bg-slate-50 flex flex-col gap-4">
 <div className="bg-white p-4 rounded border border-slate-200 shadow-sm shrink-0">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2"><PackagePlus size={14}/> Finished Good / Recipe Header</h4>
 <div className="grid grid-cols-4 gap-4">
 <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">BOM Name *</label>
 <input value={form.bomName} onChange={e => setForm({...form, bomName: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 bg-yellow-50 outline-none" placeholder="e.g. Paracetamol 500mg Standard Recipe"/></div>
 <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Item (Output) *</label>
 <input value={form.targetItem} onChange={e => setForm({...form, targetItem: e.target.value})} className="w-full text-sm font-bold text-[#1D3557] border-b border-slate-300 p-1 bg-yellow-50 outline-none" placeholder="e.g. Paracetamol 500mg (Box)"/></div>
 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Batch Yield Qty</label>
 <input type="number" value={form.batchYield} onChange={e => setForm({...form, batchYield: Number(e.target.value)})} min={1} className="w-full text-sm font-bold border-b border-slate-300 p-1 text-center text-green-700 outline-none"/></div>
 <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Std Cost (Auto)</label>
 <div className="w-full text-sm border-b border-slate-300 p-1 text-right font-bold text-[#1D3557] bg-slate-50">₹{stdCost.toFixed(2)}</div></div>
 </div>
 </div>
 <div className="bg-white border flex-1 border-slate-200 shadow-sm flex flex-col min-h-[280px]">
 <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-widest">Raw Materials & Ingredients</div>
 <div className="flex-1">
 <DenseGrid
 columns={columns} data={materials}
 onChange={(rIdx, col, val) => { const n = [...materials]; (n[rIdx] as any)[col] = val; setMaterials(n); }}
 onAddRow={() => setMaterials([...materials, { item: '', qty: 1, uom: 'Nos', cost: 0, scrap: 0 }])}
 onRemoveRow={rIdx => { const n = [...materials]; n.splice(rIdx, 1); setMaterials(n); }}
 />
 </div>
 </div>
 </div>
 <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end gap-3 shrink-0">
 <button onClick={() => { setView('LIST'); setEditingId(null); setForm(defaultForm); setMaterials(defaultMaterials); }} className="px-6 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white">Cancel</button>
 <button onClick={handleSave} disabled={saving} className="px-6 py-1.5 text-sm font-bold text-white bg-[#1D3557] rounded flex items-center gap-2 hover:bg-[#2A4B7C] disabled:opacity-50">
 <Save size={14}/>{saving ? 'Saving...' : editingId ? 'Update BOM' : 'Save BOM'}
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">Bill of Materials</h3>
 <p className="text-xs text-slate-500">Define recipes, sub-assemblies, and manufacturing configurations</p>
 </div>
 <div className="flex gap-2">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
 <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search BOMs..." className="pl-8 pr-4 py-1.5 border border-slate-300 rounded text-sm outline-none w-48"/>
 </div>
 <button onClick={handlePrint} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Printer size={14}/> Print</button>
 <button onClick={handleExport} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export</button>
 <button onClick={() => { setEditingId(null); setForm(defaultForm); setMaterials(defaultMaterials); setView('FORM'); }} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm">
 <Plus size={16}/> Create (F2)
 </button>
 </div>
 </div>
 {successMsg && <div className="bg-green-50 border-b border-green-200 text-green-700 px-4 py-2 text-xs font-bold">{successMsg}</div>}
 <div className="flex-1 overflow-auto">
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm">
 <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading BOMs...
 </div>
 ) : (
 <table className="w-full text-left border-collapse text-sm">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-xs uppercase tracking-wider text-slate-600">
 <tr>
 <th className="p-3 font-bold border-r border-white/50">BOM Name</th>
 <th className="p-3 font-bold border-r border-white/50 w-60">Target Item</th>
 <th className="p-3 font-bold border-r border-white/50 w-16 text-center">Yield</th>
 <th className="p-3 font-bold border-r border-white/50 w-16 text-center">Materials</th>
 <th className="p-3 font-bold border-r border-white/50 w-32 text-right">Std Cost (₹)</th>
 <th className="p-3 font-bold w-20 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filtered.map(b => (
 <tr key={b.id} className="hover:bg-blue-50/50 group">
 <td className="p-3 border-r border-slate-100 font-bold text-[#1D3557]">{b.bomName}</td>
 <td className="p-3 border-r border-slate-100 text-xs text-slate-600">{b.targetItem}</td>
 <td className="p-3 border-r border-slate-100 text-center text-xs font-bold text-green-700">{b.batchYield}</td>
 <td className="p-3 border-r border-slate-100 text-center text-xs font-bold text-slate-500">{(b.materials || []).length}</td>
 <td className="p-3 border-r border-slate-100 text-right font-bold text-slate-800">₹{(b.stdCost || 0).toFixed(2)}</td>
 <td className="p-3 text-center opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => { setEditingId(b.id); setForm({ bomName: b.bomName, targetItem: b.targetItem, batchYield: b.batchYield, isActive: b.isActive }); setMaterials(b.materials || defaultMaterials); setView('FORM'); }} className="p-1 text-amber-600 hover:bg-amber-50 rounded"><Edit3 size={13}/></button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 <div className="bg-[#1D3557] text-white flex text-xs font-bold shrink-0 px-4 py-2">
 <div className="flex-1">{filtered.length} BOMs</div>
 <div className="text-slate-300">Avg Std Cost: ₹{filtered.length ? (filtered.reduce((s,b) => s+(b.stdCost||0), 0)/filtered.length).toFixed(2) : '0.00'}</div>
 </div>
 </div>
 );
};

