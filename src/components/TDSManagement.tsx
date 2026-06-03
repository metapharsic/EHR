import React, { useState, useEffect, useCallback } from 'react';
import { TDSService } from '../services/accountingService';
import { Plus, Download, Search, AlertCircle, Printer, FileText, Calculator } from 'lucide-react';
import { exportTDSRegister, printTDSRegister } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';

const TDS_SECTIONS = [
 { section: '194C', nature: 'Contractor Payments', rate: 1, thresholdSingle: 30000, thresholdYear: 100000 },
 { section: '194I', nature: 'Rent', rate: 10, thresholdSingle: 0, thresholdYear: 240000 },
 { section: '194J', nature: 'Professional Fees', rate: 10, thresholdSingle: 30000, thresholdYear: 30000 },
 { section: '192', nature: 'Salary', rate: 0, thresholdSingle: 0, thresholdYear: 250000 },
 { section: '194Q', nature: 'Purchase of Goods', rate: 0.1, thresholdSingle: 0, thresholdYear: 5000000 },
 { section: '194H', nature: 'Commission/Brokerage', rate: 5, thresholdSingle: 15000, thresholdYear: 15000 },
];

const TDSManagement: React.FC = () => {
 const { company } = useCompany();
 const [activeTab, setActiveTab] = useState<'REGISTER' | 'SECTIONS' | '26Q'>('REGISTER');
 const [entries, setEntries] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [periodStart, setPeriodStart] = useState('2025-04-01');
 const [periodEnd, setPeriodEnd] = useState('2025-03-31');
 const [searchTerm, setSearchTerm] = useState('');

 // Calc helper state
 const [calcAmount, setCalcAmount] = useState('');
 const [calcSection, setCalcSection] = useState('194C');

 const loadEntries = useCallback(async () => {
 setLoading(true);
 try {
 const data = await TDSService.getTDSSummary(periodStart, periodEnd);
 setEntries(Array.isArray(data) ? data : []);
 } catch {
 setEntries([
 { id: '1', date: '2025-04-05', party: 'BuildTech Contractors', pan: 'AAACC1234C', section: '194C', nature: 'Contractor Payments', grossAmount: 150000, tdsRate: 1, tdsAmount: 1500, netPaid: 148500, status: 'Deducted', quarter: 'Q1' },
 { id: '2', date: '2025-04-10', party: 'Office Park Ltd', pan: 'BBBLL4321B', section: '194I', nature: 'Rent', grossAmount: 50000, tdsRate: 10, tdsAmount: 5000, netPaid: 45000, status: 'Deposited', quarter: 'Q1' },
 { id: '3', date: '2025-05-01', party: 'CA Sharma & Co.', pan: 'CCCSS9876S', section: '194J', nature: 'Professional Fees', grossAmount: 35000, tdsRate: 10, tdsAmount: 3500, netPaid: 31500, status: 'Deducted', quarter: 'Q1' },
 { id: '4', date: '2025-05-15', party: 'RK Logistics', pan: 'DDDLL5432L', section: '194C', nature: 'Contractor Payments', grossAmount: 80000, tdsRate: 1, tdsAmount: 800, netPaid: 79200, status: 'Pending Deposit', quarter: 'Q1' },
 ]);
 } finally { setLoading(false); }
 }, [periodStart, periodEnd]);

 useEffect(() => { if (activeTab === 'REGISTER') loadEntries(); }, [activeTab, loadEntries]);

 const filtered = entries.filter(e => {
 const t = searchTerm.toLowerCase();
 return !t || e.party?.toLowerCase().includes(t) || e.pan?.toLowerCase().includes(t) || e.section?.toLowerCase().includes(t);
 });

 const totalTDS = filtered.reduce((s, e) => s + (e.tdsAmount || 0), 0);
 const totalGross = filtered.reduce((s, e) => s + (e.grossAmount || 0), 0);

 const selectedSection = TDS_SECTIONS.find(s => s.section === calcSection);
 const calcTDS = selectedSection ? (Number(calcAmount) * selectedSection.rate) / 100 : 0;

 const STATUS_COLORS: Record<string, string> = {
 Deducted: 'bg-blue-100 text-accent',
 Deposited: 'bg-green-100 text-green-700',
 'Pending Deposit': 'bg-orange-100 text-orange-700',
 };

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
 <div className="flex justify-between items-center mb-3">
 <div>
 <h3 className="text-lg font-bold text-slate-800">TDS / TCS Management</h3>
 <p className="text-xs text-slate-500">Tax Deducted at Source — deduction register, Form 26Q, and TDS certificates</p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => printTDSRegister(filtered, `${periodStart} to ${periodEnd}`, company)} className="flex items-center gap-1 bg-white border text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm self-center"><Printer size={14}/> Print 26Q</button>
 <button onClick={() => exportTDSRegister(filtered, `${periodStart}_to_${periodEnd}`, company)} className="flex items-center gap-1 bg-white border text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export Excel</button>
 </div>
 </div>
 <div className="flex bg-slate-200 p-0.5 rounded-lg w-max">
 {(['REGISTER','SECTIONS','26Q'] as const).map(t => (
 <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === t ? 'bg-white text-[#1D3557] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
 {t === 'REGISTER' ? 'TDS Deduction Register' : t === 'SECTIONS' ? 'TDS Rate Chart' : 'Form 26Q Preview'}
 </button>
 ))}
 </div>
 </div>

 {/* REGISTER TAB */}
 {activeTab === 'REGISTER' && (
 <>
 {/* Filters */}
 <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex gap-3 items-end shrink-0">
 <div className="relative flex-1 min-w-40">
 <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
 <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search party, PAN, section..." className="pl-7 pr-3 py-1.5 border border-slate-300 rounded text-xs w-full outline-none"/>
 </div>
 <div><label className="text-[10px] font-bold text-slate-500 uppercase block">From</label>
 <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-xs outline-none"/></div>
 <div><label className="text-[10px] font-bold text-slate-500 uppercase block">To</label>
 <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-xs outline-none"/></div>
 <button onClick={loadEntries} className="text-xs font-bold bg-[#1D3557] text-white px-3 py-1.5 rounded h-[30px] flex items-center gap-1">Refresh</button>
 </div>
 <div className="flex-1 overflow-auto">
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading TDS register...</div>
 ) : (
 <table className="w-full text-left border-collapse text-xs">
 <thead className="bg-[#E4ECEF] sticky top-0 text-slate-600 uppercase font-bold border-b border-slate-300 shadow-sm z-10 tracking-wider">
 <tr>
 <th className="p-2 border-r border-slate-300 w-24">Date</th>
 <th className="p-2 border-r border-slate-300">Deductee (Party)</th>
 <th className="p-2 border-r border-slate-300 w-28">PAN</th>
 <th className="p-2 border-r border-slate-300 w-20">Section</th>
 <th className="p-2 border-r border-slate-300 w-16 text-center">Rate %</th>
 <th className="p-2 border-r border-slate-300 text-right w-28">Gross Amt (₹)</th>
 <th className="p-2 border-r border-slate-300 text-right w-28">TDS Amt (₹)</th>
 <th className="p-2 border-r border-slate-300 text-right w-28">Net Paid (₹)</th>
 <th className="p-2 text-center w-28">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filtered.map(e => (
 <tr key={e.id} className="hover:bg-blue-50/40 group">
 <td className="p-2 border-r border-slate-100 font-medium text-slate-600">{new Date(e.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</td>
 <td className="p-2 border-r border-slate-100 font-bold text-[#1D3557]">{e.party}</td>
 <td className="p-2 border-r border-slate-100 font-mono text-slate-600">{e.pan}</td>
 <td className="p-2 border-r border-slate-100 font-bold text-accent">{e.section}</td>
 <td className="p-2 border-r border-slate-100 text-center font-bold">{e.tdsRate}%</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold">₹{e.grossAmount.toLocaleString()}</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-red-700">₹{e.tdsAmount.toLocaleString()}</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold">₹{e.netPaid.toLocaleString()}</td>
 <td className="p-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border border-transparent ${STATUS_COLORS[e.status] || 'bg-slate-100 text-slate-500'}`}>{e.status}</span></td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 <div className="bg-[#1D3557] text-white flex text-xs font-bold shrink-0">
 <div className="flex-1 p-2 px-4 text-right border-r border-slate-500 uppercase tracking-wider flex items-center justify-end">{filtered.length} Entries — Gross Total:</div>
 <div className="w-28 p-2 text-right border-r border-slate-500">₹{totalGross.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 <div className="w-28 p-2 text-right border-r border-slate-500 text-red-300">₹{totalTDS.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 <div className="w-28 p-2 text-right border-r border-slate-500">₹{(totalGross - totalTDS).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 <div className="w-28"></div>
 </div>
 </>
 )}

 {/* SECTIONS TAB (TDS Rate Chart) */}
 {activeTab === 'SECTIONS' && (
 <div className="flex-1 overflow-auto flex gap-0">
 <div className="flex-1 overflow-auto">
 <table className="w-full text-sm border-collapse">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 text-xs uppercase font-bold text-slate-600 tracking-wider">
 <tr>
 <th className="p-3 border-r border-slate-300 w-24">Section</th>
 <th className="p-3 border-r border-slate-300">Nature of Payment</th>
 <th className="p-3 border-r border-slate-300 text-center w-20">Rate %</th>
 <th className="p-3 border-r border-slate-300 text-right w-40">Single Txn Limit (₹)</th>
 <th className="p-3 text-right w-40">Annual Limit (₹)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {TDS_SECTIONS.map(s => (
 <tr key={s.section} className="hover:bg-blue-50/40">
 <td className="p-3 border-r border-slate-100 font-bold text-accent">{s.section}</td>
 <td className="p-3 border-r border-slate-100 font-semibold text-slate-700">{s.nature}</td>
 <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-800">{s.rate}%</td>
 <td className="p-3 border-r border-slate-100 text-right text-slate-600">{s.thresholdSingle > 0 ? `₹${s.thresholdSingle.toLocaleString()}` : '-'}</td>
 <td className="p-3 text-right text-slate-600">{s.thresholdYear > 0 ? `₹${s.thresholdYear.toLocaleString()}` : '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {/* TDS Calculator Panel */}
 <div className="w-64 border-l border-slate-200 bg-slate-50 p-4 flex flex-col shrink-0">
 <div className="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2"><Calculator size={16} className="text-accent"/> TDS Calculator</div>
 <div className="mb-3">
 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Section</label>
 <select value={calcSection} onChange={e => setCalcSection(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm outline-none bg-white">
 {TDS_SECTIONS.map(s => <option key={s.section} value={s.section}>{s.section} — {s.nature}</option>)}
 </select>
 </div>
 <div className="mb-4">
 <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Payment Amount (₹)</label>
 <input type="number" value={calcAmount} onChange={e => setCalcAmount(e.target.value)} className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-bold text-right outline-none" placeholder="0"/>
 </div>
 <div className="bg-white border border-slate-200 rounded p-3">
 <div className="flex justify-between text-xs mb-2"><span className="text-slate-500">Rate:</span><span className="font-bold text-accent">{selectedSection?.rate}%</span></div>
 <div className="flex justify-between text-xs mb-2"><span className="text-slate-500">Gross Amount:</span><span className="font-bold">₹{Number(calcAmount||0).toLocaleString()}</span></div>
 <div className="flex justify-between text-xs mb-3"><span className="text-slate-500 font-bold">TDS Deduction:</span><span className="font-bold text-red-600">₹{calcTDS.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
 <div className="flex justify-between text-sm border-t pt-2"><span className="font-bold text-slate-700">Net Payable:</span><span className="font-bold text-green-700">₹{(Number(calcAmount||0) - calcTDS).toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
 </div>
 </div>
 </div>
 )}

 {/* 26Q TAB */}
 {activeTab === '26Q' && (
 <div className="flex-1 overflow-auto p-4 bg-slate-100">
 <div className="max-w-2xl mx-auto bg-white border border-slate-200 shadow-sm rounded p-6">
 <div className="text-center mb-6">
 <div className="font-bold text-[#1D3557] text-lg">FORM 26Q</div>
 <div className="text-slate-500 text-sm">Quarterly Statement of TDS (Other than Salary)</div>
 <div className="text-xs text-slate-400 mt-1">Under sub-section (3) of section 200 of the Income-tax Act, 1961</div>
 </div>
 <div className="grid grid-cols-2 gap-4 mb-4 text-sm border p-4 rounded bg-slate-50">
 <div><span className="font-bold text-slate-600">TAN No.:</span> MUMA12345A</div>
 <div><span className="font-bold text-slate-600">PAN:</span> AAAAA0000A</div>
 <div><span className="font-bold text-slate-600">Financial Year:</span> 2025-26</div>
 <div><span className="font-bold text-slate-600">Quarter:</span> Q1 (Apr–Jun)</div>
 <div><span className="font-bold text-slate-600">Due Date:</span> 31-Jul-2025</div>
 </div>
 <table className="w-full text-xs border-collapse mb-4">
 <thead className="bg-slate-200 font-bold text-slate-700 uppercase">
 <tr>
 <th className="p-2 border border-slate-300 text-center">S.No</th>
 <th className="p-2 border border-slate-300">Deductee Name</th>
 <th className="p-2 border border-slate-300">PAN</th>
 <th className="p-2 border border-slate-300 text-center">Section</th>
 <th className="p-2 border border-slate-300 text-right">Gross (₹)</th>
 <th className="p-2 border border-slate-300 text-right">TDS (₹)</th>
 </tr>
 </thead>
 <tbody>
 {entries.slice(0,4).map((e, i) => (
 <tr key={i} className="border-b border-slate-200">
 <td className="p-2 border border-slate-200 text-center">{i+1}</td>
 <td className="p-2 border border-slate-200 font-semibold">{e.party}</td>
 <td className="p-2 border border-slate-200 font-mono">{e.pan}</td>
 <td className="p-2 border border-slate-200 text-center font-bold">{e.section}</td>
 <td className="p-2 border border-slate-200 text-right">₹{(e.grossAmount||0).toLocaleString()}</td>
 <td className="p-2 border border-slate-200 text-right font-bold text-red-700">₹{(e.tdsAmount||0).toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <button className="w-full py-2 bg-[#1D3557] text-white font-bold text-sm rounded hover:bg-[#2A4B7C] flex items-center justify-center gap-2"><Download size={16}/> Download Form 26Q (XML)</button>
 </div>
 </div>
 )}
 </div>
 );
};

export default TDSManagement;

