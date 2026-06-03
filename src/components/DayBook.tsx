import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Download, Printer, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { DayBookService } from '../services/accountingService';
import { printReport, addExcelBranding } from '../utils/accountingExport';
import { utils, writeFile } from 'xlsx';
import { useCompany } from '../context/CompanyContext';

const VCH_TYPES = ['All', 'Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra', 'Debit Note', 'Credit Note'];

export const DayBook: React.FC = () => {
 const { company } = useCompany();
 const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 8) + '01');
 const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
 const [vchType, setVchType] = useState('All');
 const [entries, setEntries] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');

 const DEMO_ENTRIES = [
 { id: 1, date: dateFrom, particulars: 'Cash Account', vchType: 'Receipt', vchNo: 'RCP-001', debit: 50000, credit: 0, sourceTable: 'journal_vouchers' },
 { id: 2, date: dateFrom, particulars: 'SBI Bank', vchType: 'Payment', vchNo: 'PMT-001', debit: 0, credit: 15000, sourceTable: 'journal_vouchers' },
 { id: 3, date: dateFrom, particulars: 'Apollo Hospitals', vchType: 'Sales', vchNo: 'SAL-001', debit: 125000, credit: 0, sourceTable: 'sales_invoices' },
 { id: 4, date: dateFrom, particulars: 'Sales A/c', vchType: 'Sales', vchNo: 'SAL-001', debit: 0, credit: 125000, sourceTable: 'sales_invoices' },
 { id: 5, date: dateFrom, particulars: 'Office Rent A/c', vchType: 'Payment', vchNo: 'PMT-002', debit: 0, credit: 35000, sourceTable: 'expenses' },
 { id: 6, date: dateFrom, particulars: 'Supplier - MedChem Ltd', vchType: 'Purchase', vchNo: 'PUR-001', debit: 0, credit: 85000, sourceTable: 'journal_vouchers' },
 { id: 7, date: dateFrom, particulars: 'Purchase A/c', vchType: 'Purchase', vchNo: 'PUR-001', debit: 85000, credit: 0, sourceTable: 'journal_vouchers' },
 ];

 const loadEntries = useCallback(async () => {
 setLoading(true); setError('');
 try {
 const data = await DayBookService.getEntries(dateFrom, dateTo, vchType);
 
 let runningBalance = 0;
 const sortedData = (Array.isArray(data) ? data : []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
 const processedData = sortedData.map(entry => {
 runningBalance += (entry.debit || 0) - (entry.credit || 0);
 return { ...entry, runningBalance };
 });
 setEntries(processedData);
 } catch {
 let runningBalance = 0;
 const filtered = DEMO_ENTRIES.filter(e => vchType === 'All' || e.vchType === vchType).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
 setEntries(filtered.map(entry => {
 runningBalance += (entry.debit || 0) - (entry.credit || 0);
 return { ...entry, runningBalance };
 }));
 } finally { setLoading(false); }
 }, [dateFrom, dateTo, vchType]);

 useEffect(() => { loadEntries(); }, [loadEntries]);

 const totalDebit = entries.reduce((a, b) => a + (b.debit || 0), 0);
 const totalCredit = entries.reduce((a, b) => a + (b.credit || 0), 0);

 const handleExport = () => {
 const rows = entries.map(e => ({
 'Date': e.date,
 'Particulars': e.particulars,
 'Voucher Type': e.vchType,
 'Voucher No': e.vchNo,
 'Debit (₹)': e.debit || 0,
 'Credit (₹)': e.credit || 0
 }));
 rows.push({ 'Date': '', 'Particulars': 'GRAND TOTAL', 'Voucher Type': '', 'Voucher No': '', 'Debit (₹)': totalDebit, 'Credit (₹)': totalCredit });
 const ws = utils.aoa_to_sheet([[]]);
 addExcelBranding(ws, `Day Book (${dateFrom} to ${dateTo})`, company);
 utils.sheet_add_json(ws, rows, { origin: 'A6' });
 ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
 const wb = utils.book_new();
 utils.book_append_sheet(wb, ws, 'Day Book');
 writeFile(wb, `Day_Book_${dateFrom}_to_${dateTo}.xlsx`);
 };

 const handlePrint = () => {
 const rows = entries.map(e => `<tr>
 <td>${e.date}</td><td>${e.particulars}</td><td>${e.vchType}</td><td>${e.vchNo}</td>
 <td class="text-right">₹${(e.debit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td class="text-right">₹${(e.credit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
 </tr>`).join('');
 printReport('Day Book', `<table><thead><tr><th>Date</th><th>Particulars</th><th>Type</th><th>No</th><th class="text-right">Debit (₹)</th><th class="text-right">Credit (₹)</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="4">TOTAL</td><td class="text-right">₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td class="text-right">₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr></tbody></table>`, company);
 };

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex flex-col gap-4">
 <div className="flex justify-between items-center">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">Day Book</h3>
 <p className="text-xs text-slate-500 font-medium">Chronological record of all financial transactions — live from database</p>
 </div>
 <div className="flex gap-2 text-sm font-bold">
 <button onClick={handlePrint} className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded shadow-sm transition-colors">
 <Printer size={14} /> Print
 </button>
 <button onClick={handleExport} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded shadow-sm transition-colors">
 <Download size={14} /> Export Excel
 </button>
 </div>
 </div>
 <div className="flex gap-4 items-end bg-white p-3 rounded border border-slate-200 shadow-sm flex-wrap">
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Period From</label>
 <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-bold outline-none"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Period To</label>
 <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-bold outline-none"/>
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Voucher Type</label>
 <select value={vchType} onChange={e => setVchType(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-bold outline-none w-48 bg-yellow-50 text-[#1D3557]">
 {VCH_TYPES.map(v => <option key={v}>{v}</option>)}
 </select>
 </div>
 <button onClick={loadEntries} className="bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1 text-sm font-bold rounded flex items-center gap-1 h-[30px]">
 <RefreshCw size={13}/> Refresh
 </button>
 {error && <div className="text-xs text-amber-600 font-bold flex items-center gap-1"><AlertCircle size={12}/>Using demo data (API unavailable)</div>}
 </div>
 </div>

 <div className="flex-1 overflow-auto bg-white flex flex-col">
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm">
 <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/> Fetching Real-time Transactions...
 </div>
 ) : (
 <table className="w-full text-left border-collapse text-sm flex-1">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-xs text-slate-700 z-10">
 <tr>
 <th className="p-2 font-bold border-r border-slate-300 w-28">Date</th>
 <th className="p-2 font-bold border-r border-slate-300">Particulars</th>
 <th className="p-2 font-bold border-r border-slate-300 w-32">Vch Type</th>
 <th className="p-2 font-bold border-r border-slate-300 w-28">Vch No.</th>
 <th className="p-2 font-bold border-r border-slate-300 text-right w-36">Debit (₹)</th>
 <th className="p-2 font-bold border-r border-slate-300 text-right w-36">Credit (₹)</th>
 <th className="p-2 font-bold border-r border-slate-300 text-right w-36">Running Bal (₹)</th>
 <th className="p-2 font-bold text-center w-24">Link</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 align-top">
 {entries.map((e, idx) => (
 <tr key={idx} className="hover:bg-blue-50/50 cursor-pointer group">
 <td className="p-2 border-r border-slate-100 font-bold text-slate-600 text-xs">
 {new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
 </td>
 <td className="p-2 border-r border-slate-100">
 <div className="font-bold text-[#1D3557] group-hover:underline flex items-center justify-between">
 {e.particulars}
 <ChevronRight size={14} className="text-slate-300 group-hover:text-accent opacity-0 group-hover:opacity-100"/>
 </div>
 </td>
 <td className="p-2 border-r border-slate-100 text-xs font-semibold text-slate-600">
 <span className={`px-2 py-0.5 rounded-full ${
 e.vchType === 'Sales' ? 'bg-green-100 text-green-700' : 
 e.vchType === 'Expense' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-accent'
 }`}>
 {e.vchType}
 </span>
 </td>
 <td className="p-2 border-r border-slate-100 text-xs font-bold text-slate-500 font-mono">{e.vchNo}</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800">
 {Number(e.debit || 0) > 0 ? `₹${Number(e.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
 </td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800">
 {Number(e.credit || 0) > 0 ? `₹${Number(e.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
 </td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-accent">
 ₹{Number(Math.abs(e.runningBalance || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {Number(e.runningBalance) >= 0 ? 'Dr' : 'Cr'}
 </td>
 <td className="p-2 text-center">
 <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase" title={`Fetched from ${e.sourceTable}`}>
 {e.sourceTable?.split('_')[0]}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 <div className="bg-[#1D3557] text-white flex text-sm font-bold shrink-0 shadow-inner">
 <div className="flex-1 p-2 text-right uppercase tracking-wider text-xs border-r border-slate-500 flex items-center justify-end">
 {entries.length} entries — Grand Total:
 </div>
 <div className="w-36 p-2 text-right border-r border-slate-500">₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
 <div className="w-36 p-2 text-right">₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
 </div>
 </div>
 );
};

