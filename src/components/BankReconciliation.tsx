import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, FileText, Printer, Download } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { printReport, exportBankRecon } from '../utils/accountingExport';

export const BankReconciliation: React.FC = () => {
 const [fileUploaded, setFileUploaded] = useState(false);
 const [reconTab, setReconTab] = useState<'MATCHED' | 'UNMATCHED_BANK' | 'UNMATCHED_BOOKS'>('UNMATCHED_BOOKS');
 const { company } = useCompany();

 const [booksEntries] = useState([
 { id: 1, date: '2025-04-01', ref: 'Chq-001', details: 'Apollo Hospitals', amount: -45000, type: 'Payment' },
 { id: 2, date: '2025-04-02', ref: 'NEFT-11', details: 'Receipt from Max', amount: 120000, type: 'Receipt' },
 { id: 3, date: '2025-04-05', ref: 'Chq-002', details: 'Office Rent', amount: -15000, type: 'Payment' },
 ]);

 const [bankEntries] = useState([
 { id: 101, date: '2025-04-02', ref: 'NEFT-11', details: 'MAX PHARMA RTGS', amount: 120000 },
 { id: 102, date: '2025-04-06', ref: 'CHQ002', details: 'OFFICE RENT CLEAR', amount: -15000 },
 { id: 103, date: '2025-04-07', ref: 'CHG', details: 'BANK CHARGES', amount: -250 },
 ]);

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">Auto Bank Reconciliation</h3>
 <p className="text-xs text-slate-500 font-medium">Upload statements (CSV/Excel) to auto-match entries</p>
 </div>
 <div className="flex gap-2">
 <select className="border border-slate-300 rounded px-3 py-1.5 text-sm font-bold bg-white text-slate-700 outline-none shadow-sm mr-2">
 <option>HDFC Current A/c - 110022</option>
 <option>SBI OD A/c - 4455</option>
 </select>
 <button 
 onClick={() => {
 const rows = booksEntries.map(e => `<tr><td>${e.date}</td><td>${e.ref}</td><td>${e.details}</td><td class="text-right">${e.amount < 0 ? '₹' + Math.abs(e.amount).toLocaleString() : ''}</td><td class="text-right">${e.amount > 0 ? '₹' + e.amount.toLocaleString() : ''}</td></tr>`).join('');
 printReport('Bank Reconciliation Statement', `
 <div style="margin-bottom:15px"><b>Bank:</b> HDFC Current A/c - 110022</div>
 <table><thead><tr><th>Date</th><th>Ref</th><th>Particulars</th><th class="text-right">Withdrawals</th><th class="text-right">Deposits</th></tr></thead><tbody>${rows}</tbody></table>`, company);
 }}
 className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"
 >
 <Printer size={16} /> Print
 </button>
 <button 
 onClick={() => {
 const data = booksEntries.map(e => ({
 date: e.date, description: e.details, amount: Math.abs(e.amount), type: e.amount < 0 ? 'Withdrawal' : 'Deposit', reference: e.ref, reconciled: false 
 }));
 exportBankRecon(data, 'HDFC Current A/c - 110022', '30-Apr-2025', company);
 }}
 className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"
 >
 <Download size={16} /> Export
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-auto bg-slate-100 p-4 flex flex-col gap-4">
 
 {/* Top Panel - Statement Upload & Status */}
 <div className="grid grid-cols-3 gap-4 shrink-0">
 <div className="col-span-1 bg-white p-6 rounded border border-slate-200 shadow-sm flex flex-col items-center justify-center border-dashed border-2 hover:bg-slate-50 hover:border-blue-400 cursor-pointer transition-colors"
 onClick={() => setFileUploaded(true)}>
 <UploadCloud size={32} className={fileUploaded ? "text-green-500 mb-2" : "text-slate-400 mb-2"}/>
 <span className="text-sm font-bold text-slate-700">
 {fileUploaded ? 'HDFC_Stmt_April.csv Loaded' : 'Upload Bank Statement'}
 </span>
 <span className="text-xs text-slate-500">{fileUploaded ? '324 entries found' : 'Drag & drop CSV or Excel (XLSX)'}</span>
 </div>

 <div className="col-span-2 bg-white p-4 rounded border border-slate-200 shadow-sm">
 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b pb-2 flex items-center gap-2">
 Reconciliation Summary As per Bank Date
 </h4>
 <div className="grid grid-cols-2 gap-8 text-sm">
 <div className="flex justify-between items-center border-b border-dashed pb-1">
 <span className="font-bold text-slate-600">Balance as per Company Books:</span>
 <span className="font-bold text-slate-800">₹ 12,45,000.00</span>
 </div>
 <div className="flex justify-between items-center border-b border-dashed pb-1">
 <span className="font-bold text-slate-600">Balance as per Bank Statement:</span>
 <span className="font-bold text-[#1D3557]">₹ 12,29,750.00</span>
 </div>
 <div className="flex justify-between items-center border-b border-dashed pb-1">
 <span className="font-bold text-red-500 text-xs">Amounts not reflected in bank:</span>
 <span className="font-bold text-red-700">- ₹ 45,000.00</span>
 </div>
 <div className="flex justify-between items-center border-b border-dashed pb-1">
 <span className="font-bold text-accent text-xs">Amounts not reflected in books:</span>
 <span className="font-bold text-accent">- ₹ 250.00</span>
 </div>
 </div>
 {fileUploaded && (
 <div className="mt-4 flex justify-end">
 <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-1.5 rounded text-xs font-bold shadow hover:bg-emerald-700">
 <RefreshCw size={14}/> Run Auto-Match Engine (AI)
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Bottom Panel - Side by side or tabbed view */}
 {fileUploaded && (
 <div className="bg-white border text-sm flex-1 border-slate-200 shadow-sm flex flex-col min-h-[300px]">
 <div className="flex bg-[#1D3557] text-white">
 <button onClick={() => setReconTab('UNMATCHED_BOOKS')} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${reconTab === 'UNMATCHED_BOOKS' ? 'bg-white text-[#1D3557]' : 'hover:bg-white/10'}`}>Unreconciled In Books (1)</button>
 <button onClick={() => setReconTab('UNMATCHED_BANK')} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${reconTab === 'UNMATCHED_BANK' ? 'bg-white text-[#1D3557]' : 'hover:bg-white/10'}`}>Unreconciled In Bank (1)</button>
 <button onClick={() => setReconTab('MATCHED')} className={`flex-1 py-2 font-bold text-xs uppercase tracking-wider ${reconTab === 'MATCHED' ? 'bg-green-500 text-white' : 'hover:bg-white/10'}`}>Successfully Matched (2)</button>
 </div>

 <div className="flex-1 overflow-auto">
 {/* Simplified render based on tab */}
 <table className="w-full text-left border-collapse">
 <thead className="bg-[#E4ECEF] sticky top-0 shadow-sm text-xs uppercase tracking-wider text-slate-600">
 {reconTab === 'UNMATCHED_BOOKS' && (
 <tr>
 <th className="p-3 w-10 text-center"><input type="checkbox"/></th>
 <th className="p-3 w-32">Book Date</th>
 <th className="p-3 w-32">Instrument</th>
 <th className="p-3">Particulars</th>
 <th className="p-3 text-right w-32">Withdrawals</th>
 <th className="p-3 text-right w-32">Deposits</th>
 <th className="p-3 w-40">Clearance Date</th>
 </tr>
 )}
 {reconTab === 'UNMATCHED_BANK' && (
 <tr>
 <th className="p-3 w-32">Bank Date</th>
 <th className="p-3 w-32">Ref No.</th>
 <th className="p-3">Bank Particulars</th>
 <th className="p-3 text-right w-32">Withdrawals</th>
 <th className="p-3 text-right w-32">Deposits</th>
 <th className="p-3 w-40 text-center">Action</th>
 </tr>
 )}
 {reconTab === 'MATCHED' && (
 <tr>
 <th className="p-3 w-8"></th>
 <th className="p-3">Book Record</th>
 <th className="p-3">Bank Record</th>
 <th className="p-3 text-right text-green-700">Matched Amt (₹)</th>
 </tr>
 )}
 </thead>
 <tbody className="divide-y divide-slate-100">
 {reconTab === 'UNMATCHED_BOOKS' && (
 <tr className="hover:bg-blue-50/50">
 <td className="p-3 text-center"><input type="checkbox"/></td>
 <td className="p-3 font-bold text-slate-700">2025-04-01</td>
 <td className="p-3 font-semibold text-slate-500">Chq-001</td>
 <td className="p-3 font-bold text-[#1D3557]">Apollo Hospitals</td>
 <td className="p-3 text-right font-bold text-red-600">45,000.00</td>
 <td className="p-3 text-right"></td>
 <td className="p-3"><input type="date" className="w-full border p-1 rounded text-xs outline-none"/></td>
 </tr>
 )}
 {reconTab === 'UNMATCHED_BANK' && (
 <tr className="hover:bg-blue-50/50">
 <td className="p-3 font-bold text-slate-700">2025-04-07</td>
 <td className="p-3 font-semibold text-slate-500">CHG</td>
 <td className="p-3 font-bold text-[#1D3557]">BANK CHARGES</td>
 <td className="p-3 text-right font-bold text-red-600">250.00</td>
 <td className="p-3 text-right"></td>
 <td className="p-3 text-center">
 <button className="text-xs font-bold text-accent bg-blue-50 px-2 py-1 rounded border border-blue-200 hover:bg-accent hover:text-white transition">Create Voucher</button>
 </td>
 </tr>
 )}
 {reconTab === 'MATCHED' && (
 <>
 <tr className="bg-green-50/30">
 <td className="p-3 text-center text-green-500"><CheckCircle2 size={16}/></td>
 <td className="p-3 text-xs"><span className="font-bold">Receipt from Max</span> (NEFT-11, 02-Apr)</td>
 <td className="p-3 text-xs italic text-slate-500">MAX PHARMA RTGS (NEFT-11, 02-Apr)</td>
 <td className="p-3 text-right font-bold text-green-700">1,20,000.00</td>
 </tr>
 <tr className="bg-green-50/30">
 <td className="p-3 text-center text-green-500"><CheckCircle2 size={16}/></td>
 <td className="p-3 text-xs"><span className="font-bold">Office Rent</span> (Chq-002, 05-Apr)</td>
 <td className="p-3 text-xs italic text-slate-500">OFFICE RENT CLEAR (CHQ002, 06-Apr)</td>
 <td className="p-3 text-right font-bold text-red-600">15,000.00</td>
 </tr>
 </>
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

