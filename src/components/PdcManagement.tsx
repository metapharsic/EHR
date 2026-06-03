import React, { useState } from 'react';
import { Save, Search, Plus, CreditCard, RefreshCw, Printer, Download } from 'lucide-react';
import { DenseGrid, ColumnDef } from './common/DenseGrid';
import { useCompany } from '../context/CompanyContext';
import { printReport, addExcelBranding, ts } from '../utils/accountingExport';
import { utils, writeFile } from 'xlsx';

export const PdcManagement: React.FC = () => {
 const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
 const { company } = useCompany();

 // Dummy PDCs
 const [pdcs, setPdcs] = useState([
 { id: '1', type: 'Receipt', party: 'Apollo Hospitals', bank: 'HDFC', chqNo: '772211', pdcDate: '2025-04-10', amount: 45000, status: 'Pending' }
 ]);

 const [form, setForm] = useState({
 type: 'Receipt', entryDate: new Date().toISOString().split('T')[0],
 party: 'Apollo Hospitals', pdcDate: '2025-05-01', chqNo: '', bank: '', amount: 0,
 drawnOn: 'SBI'
 });

 if (view === 'FORM') {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="bg-[#1D3557] text-white px-4 py-2 flex justify-between items-center shrink-0">
 <h3 className="font-bold tracking-wider text-sm flex items-center gap-2"><CreditCard size={16}/> PDC Entry</h3>
 <button onClick={() => setView('LIST')} className="text-slate-300 hover:text-white uppercase text-xs font-bold px-2">Close (Esc)</button>
 </div>
 
 <div className="flex-1 overflow-auto p-4 bg-slate-50 flex flex-col gap-4">
 {/* PDC Details */}
 <div className="bg-white p-6 rounded border border-slate-200 shadow-sm max-w-3xl mx-auto w-full mt-4">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 border-b pb-2 flex items-center gap-2">Cheque Details</h4>
 
 <div className="grid grid-cols-12 gap-6">
 <div className="col-span-12 flex bg-slate-100 p-1 rounded-lg w-max">
 <button onClick={() => setForm({...form, type: 'Receipt'})} className={`px-6 py-1.5 text-sm font-bold rounded-md ${form.type === 'Receipt' ? 'bg-green-600 text-white shadow' : 'text-slate-500 hover:bg-white'}`}>PDC Receipt</button>
 <button onClick={() => setForm({...form, type: 'Payment'})} className={`px-6 py-1.5 text-sm font-bold rounded-md ${form.type === 'Payment' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:bg-white'}`}>PDC Payment</button>
 </div>

 <div className="col-span-6">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Party A/C</label>
 <select className="w-full text-sm font-bold border-b border-slate-300 p-1 bg-yellow-50 outline-none text-[#1D3557]">
 <option>Apollo Hospitals</option>
 <option>Max Pharma</option>
 </select>
 </div>
 <div className="col-span-6">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Amount (₹)</label>
 <input type="number" className="w-full text-lg font-bold border-b border-slate-300 p-1 outline-none text-green-700 bg-yellow-50" placeholder="0.00"/>
 </div>
 
 <div className="col-span-4">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Cheque/Inst No.</label>
 <input className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none"/>
 </div>
 <div className="col-span-4">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">PDC Date (Clearing Date)</label>
 <input type="date" value={form.pdcDate} onChange={e => setForm({...form, pdcDate: e.target.value})} className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none"/>
 </div>
 <div className="col-span-4">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Drawn On Bank</label>
 <input className="w-full text-sm font-bold border-b border-slate-300 p-1 outline-none" placeholder="e.g. HDFC Bank"/>
 </div>

 <div className="col-span-12">
 <label className="block text-[10px] font-bold text-slate-500 uppercase">Status</label>
 <div className="flex gap-4 mt-2">
 <label className="flex items-center gap-2 text-sm font-bold"><input type="radio" name="st" defaultChecked/> Pending</label>
 <label className="flex items-center gap-2 text-sm font-bold text-accent"><input type="radio" name="st"/> Deposited</label>
 <label className="flex items-center gap-2 text-sm font-bold text-green-600"><input type="radio" name="st"/> Cleared</label>
 <label className="flex items-center gap-2 text-sm font-bold text-red-600"><input type="radio" name="st"/> Bounced</label>
 </div>
 </div>
 </div>
 </div>
 </div>
 
 <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end gap-3 shrink-0">
 <button onClick={() => setView('LIST')} className="px-6 py-1.5 text-sm font-bold text-slate-600 border border-slate-400 rounded bg-white hover:bg-slate-50">Cancel</button>
 <button onClick={() => setView('LIST')} className="px-6 py-1.5 text-sm font-bold text-white bg-[#1D3557] hover:bg-[#2A4B7C] rounded flex items-center gap-2 shadow-sm"><Save size={14}/> Save PDC Entry</button>
 </div>
 </div>
 );
 }

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">Post-Dated Cheques (PDC)</h3>
 <p className="text-xs text-slate-500 font-medium">Track advanced payments and cheque clearing lifecycles</p>
 </div>
 <div className="flex gap-2">
 <button 
 onClick={() => {
 const rows = pdcs.map(p => `<tr><td>${p.type}</td><td>${p.pdcDate}</td><td>${p.party}</td><td>${p.chqNo}</td><td>${p.bank}</td><td>${p.status}</td><td class="text-right">₹${p.amount.toLocaleString()}</td></tr>`).join('');
 printReport('Post-Dated Cheques Register', `<table><thead><tr><th>Type</th><th>PDC Date</th><th>Party</th><th>Chq No</th><th>Bank</th><th>Status</th><th class="text-right">Amount</th></tr></thead><tbody>${rows}</tbody></table>`, company);
 }}
 className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors"
 >
 <Printer size={16} /> Print
 </button>
 <button 
 onClick={() => {
 const rows = pdcs.map(p => ({ 'Type': p.type, 'PDC Date': p.pdcDate, 'Party': p.party, 'Chq No': p.chqNo, 'Bank': p.bank, 'Status': p.status, 'Amount': p.amount }));
 const ws = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws, 'Post-Dated Cheques Register', company);
 utils.sheet_add_json(ws, rows, { origin: 'A6' });
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws, 'PDCs');
 writeFile(wb, `PDC_Register_${ts()}.xlsx`);
 }}
 className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors"
 >
 <Download size={16} /> Export
 </button>
 <button onClick={() => setView('FORM')} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm transition-colors">
 <Plus size={16} /> New PDC
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-auto p-4 bg-slate-100">
 <div className="bg-white border border-slate-200 shadow-sm">
 <table className="w-full text-left border-collapse text-sm">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-xs uppercase tracking-wider text-slate-600">
 <tr>
 <th className="p-3 font-bold border-r border-white/50 w-24 text-center">Type</th>
 <th className="p-3 font-bold border-r border-white/50 w-32">PDC Date</th>
 <th className="p-3 font-bold border-r border-white/50">Party A/c</th>
 <th className="p-3 font-bold border-r border-white/50 w-32">Chq No.</th>
 <th className="p-3 font-bold border-r border-white/50 w-32">Target Bank</th>
 <th className="p-3 font-bold border-r border-white/50 w-32 text-center">Status</th>
 <th className="p-3 font-bold text-right w-32">Amount (₹)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {pdcs.map(p => (
 <tr key={p.id} className="hover:bg-blue-50/50 cursor-pointer text-slate-700" onClick={() => setView('FORM')}>
 <td className="p-3 border-r border-slate-100 text-center font-bold text-[10px] uppercase">
 <span className={`px-2 py-0.5 rounded ${p.type === 'Receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.type}</span>
 </td>
 <td className="p-3 border-r border-slate-100 font-bold">{p.pdcDate}</td>
 <td className="p-3 border-r border-slate-100 font-bold text-[#1D3557]">{p.party}</td>
 <td className="p-3 border-r border-slate-100">{p.chqNo}</td>
 <td className="p-3 border-r border-slate-100 text-xs">{p.bank}</td>
 <td className="p-3 border-r border-slate-100 text-center text-xs font-bold text-slate-500">{p.status}</td>
 <td className="p-3 text-right font-bold text-slate-800">₹ {p.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
};

