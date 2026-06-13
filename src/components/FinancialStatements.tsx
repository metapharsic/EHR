import React, { useState, useEffect, useCallback } from 'react';
import { TrialBalanceService, BalanceSheetService, ProfitLossService } from '../services/accountingService';
import { Download, Printer, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Folder, FileText, CheckCircle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';

type StatementType = 'BALANCE_SHEET' | 'PROFIT_LOSS' | 'TRIAL_BALANCE';

export const FinancialStatements: React.FC<{ type: StatementType }> = ({ type }) => {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [selectedAsOn, setSelectedAsOn] = useState(new Date().toISOString().split('T')[0]);
 const [periodStart, setPeriodStart] = useState(() => {
 const d = new Date(); d.setMonth(3, 1);
 return d.toISOString().split('T')[0];
 });
 const [comparePrev, setComparePrev] = useState(false);
 const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

 const toggleNode = (key: string) => setExpandedNodes(p => ({ ...p, [key]: !p[key] }));

 const loadData = useCallback(async () => {
 setLoading(true);
 setError('');
 try {
 if (type === 'BALANCE_SHEET') {
 const d = await BalanceSheetService.generateBalanceSheet(selectedAsOn, comparePrev);
 setData(d);
 } else if (type === 'PROFIT_LOSS') {
 const d = await ProfitLossService.generateProfitLoss(periodStart, selectedAsOn, comparePrev);
 setData(d);
 } else {
 const d = await TrialBalanceService.generateTrialBalance(selectedAsOn);
 setData(d);
 }
 } catch (err: any) {
 setError(err.message || 'Failed to load report');
 // Use fallback demo data
 if (type === 'TRIAL_BALANCE') {
 setData([
 { accountCode: '1100', accountName: 'Cash in Hand', debit: 150000, credit: 0 },
 { accountCode: '1200', accountName: 'Bank - HDFC', debit: 650000, credit: 0 },
 { accountCode: '1300', accountName: 'Sundry Debtors', debit: 3200000, credit: 0 },
 { accountCode: '2100', accountName: 'Sundry Creditors', debit: 0, credit: 800000 },
 { accountCode: '3100', accountName: 'Capital Account', debit: 0, credit: 5000000 },
 { accountCode: '4100', accountName: 'Sales Account', debit: 0, credit: 8500000 },
 { accountCode: '5100', accountName: 'Purchase Account', debit: 6200000, credit: 0 },
 { accountCode: '5200', accountName: 'Salary Expenses', debit: 1200000, credit: 0 },
 { accountCode: '5300', accountName: 'Rent Expenses', debit: 300000, credit: 0 },
 { accountCode: '5400', accountName: 'Other Expenses', debit: 600000, credit: 0 },
 ]);
 } else {
 setData({
 totalAssets: 8600000, totalLiabilities: 3750000, totalEquity: 4850000,
 assets: { subtotal: 8600000, items: [
 { name: 'Fixed Assets', amount: 2500000, children: [
 { name: 'Building & Premises', amount: 1500000 },
 { name: 'Plant & Machinery', amount: 800000 },
 { name: 'Computers', amount: 200000 }
 ]},
 { name: 'Current Assets', amount: 6100000, children: [
 { name: 'Closing Stock', amount: 1500000 },
 { name: 'Sundry Debtors', amount: 3200000 },
 { name: 'Cash in Hand', amount: 150000 },
 { name: 'Bank Accounts', amount: 1250000 }
 ]}
 ]},
 liabilities: { subtotal: 3750000, items: [
 { name: 'Capital Account', amount: 5000000, children: [
 { name: 'Promoter Capital', amount: 5000000 }
 ]},
 { name: 'Current Liabilities', amount: 3750000, children: [
 { name: 'Sundry Creditors', amount: 800000 },
 { name: 'Bank OD / Loans', amount: 2750000 },
 { name: 'Duties & Taxes', amount: 200000 }
 ]}
 ]},
 revenue: { subtotal: 8500000, items: [{ name: 'Sales Revenue', amount: 8500000 }] },
 expenses: { subtotal: 7650000, items: [
 { name: 'Cost of Goods Sold', amount: 6200000 },
 { name: 'Operating Expenses', amount: 1450000, children: [
 { name: 'Salary', amount: 1200000 },
 { name: 'Rent', amount: 300000 }
 ]}
 ]},
 netProfitAfterTax: 850000, operatingIncome: 850000
 });
 }
 } finally {
 setLoading(false);
 }
 }, [type, selectedAsOn, periodStart, comparePrev]);

 useEffect(() => { loadData(); }, [loadData]);

 const titles: Record<StatementType, string> = {
 BALANCE_SHEET: 'Balance Sheet',
 PROFIT_LOSS: 'Profit & Loss Account',
 TRIAL_BALANCE: 'Trial Balance'
 };

 // ---- TRIAL BALANCE RENDER ----
 if (type === 'TRIAL_BALANCE') {
 const reportData = data || { entries: [], totalDebit: 0, totalCredit: 0, isBalanced: true };
 const rows = Array.isArray(reportData.entries) ? reportData.entries : [];
 const totalDr = reportData.totalDebit || 0;
 const totalCr = reportData.totalCredit || 0;
 // FIX: strict check — undefined/null data should NOT show as balanced
  const isBalanced = reportData.isBalanced === true;

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
 <div>
 <h3 className="text-lg font-bold text-[#1D3557]">Trial Balance</h3>
 <div className="flex items-center gap-2 mt-1">
 {!loading && rows.length > 0 && (
 isBalanced 
 ? <><CheckCircle size={14} className="text-green-600"/><span className="text-xs font-bold text-green-600">Balanced (Dr = Cr)</span></>
 : <><XCircle size={14} className="text-red-600"/><span className="text-xs font-bold text-red-600">Not Balanced! Diff: ₹{Math.abs(totalDr - totalCr).toLocaleString()}</span></>
 )}
 </div>
 </div>
 <div className="flex gap-3 items-center">
 <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">As on Date</label>
 <input type="date" value={selectedAsOn} onChange={e => setSelectedAsOn(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-bold outline-none"/></div>
 <button onClick={loadData} className="h-[30px] mt-4 flex items-center gap-1 bg-[#1D3557] text-white px-3 py-1 rounded text-xs font-bold"><RefreshCw size={12}/> Refresh</button>
 <button onClick={() => {
   import('../utils/accountingExport').then(m => m.exportTrialBalance(`As on ${selectedAsOn}`, rows));
 }} className="h-[30px] mt-4 flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1 rounded text-xs font-bold"><Download size={12}/> Export</button>
 </div>
 </div>
 <div className="flex-1 overflow-auto">
 {loading ? <div className="flex items-center justify-center h-full text-slate-400 text-sm gap-2"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/><span>Generating Trial Balance...</span></div> : (
 <table className="w-full text-sm border-collapse">
 <thead className="bg-[#E4ECEF] sticky top-0 text-xs text-slate-700 uppercase font-bold border-b border-slate-300 shadow-sm z-10">
 <tr>
 <th className="p-2 border-r border-slate-300 w-24">Code</th>
 <th className="p-2 border-r border-slate-300">Account Name</th>
 <th className="p-2 border-r border-slate-300 text-center w-32">Group</th>
 <th className="p-2 border-r border-slate-300 text-right w-36">Debit (₹)</th>
 <th className="p-2 text-right w-36">Credit (₹)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {rows.map((r: any, i: number) => {
 const closingBal = parseFloat(r.closingBalance || 0);
 const isDebit = closingBal >= 0;
 return (
 <tr key={i} className="hover:bg-blue-50/40 cursor-pointer group">
 <td className="p-2 border-r border-slate-100 font-mono text-slate-500">{r.accountCode}</td>
 <td className="p-2 border-r border-slate-100 font-bold text-[#1D3557] group-hover:underline">{r.accountName}</td>
 <td className="p-2 border-r border-slate-100 text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{r.accountGroup || '-'}</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800">
 {isDebit && closingBal !== 0 ? `₹${Math.abs(closingBal).toLocaleString(undefined,{minimumFractionDigits:2})}` : ''}
 </td>
 <td className="p-2 text-right font-bold text-slate-800">
 {!isDebit && closingBal !== 0 ? `₹${Math.abs(closingBal).toLocaleString(undefined,{minimumFractionDigits:2})}` : ''}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 )}
 </div>
 {!loading && rows.length > 0 && (
 <div className={`flex font-bold text-sm shrink-0 ${isBalanced ? 'bg-[#1D3557] text-white' : 'bg-red-700 text-white'}`}>
 <div className="p-2 px-4 flex-1 text-right border-r border-slate-500 text-xs uppercase tracking-wider flex items-center justify-end">Grand Total ({rows.length} accounts):</div>
 <div className="w-36 p-2 text-right border-r border-slate-500">₹{totalDr.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 <div className="w-36 p-2 text-right">₹{totalCr.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 </div>
 )}
 </div>
 );
 }

 // ---- BALANCE SHEET / P&L TREE RENDER ----
 const TreeNode: React.FC<{ item: any; depth?: number }> = ({ item, depth = 0 }) => {
 const key = `${item.name}-${depth}`;
 const isExpanded = expandedNodes[key] !== false; // Default expanded
 const hasChildren = item.children && item.children.length > 0;
 return (
 <div>
 <div
 className={`flex items-center justify-between p-1.5 cursor-pointer border-b border-slate-100 hover:bg-blue-50/50 ${depth === 0 ? 'bg-slate-50 font-bold text-[#1D3557]' : depth === 1 ? 'font-bold text-slate-700' : 'font-medium text-slate-600 text-sm'}`}
 style={{ paddingLeft: `${depth * 18 + 12}px` }}
 onClick={() => hasChildren ? toggleNode(key) : undefined}
 >
 <div className="flex items-center gap-1.5">
 {hasChildren ? (isExpanded ? <ChevronDown size={13} className="text-slate-400"/> : <ChevronRight size={13} className="text-slate-400"/>) : <div className="w-3"/>}
 {hasChildren ? <Folder size={13} className="text-amber-500"/> : <FileText size={13} className="text-slate-300"/>}
 {item.name}
 </div>
 <div className="text-right tabular-nums pr-2">{item.amount > 0 ? `₹${item.amount.toLocaleString(undefined,{minimumFractionDigits:2})}` : ''}</div>
 </div>
 {isExpanded && hasChildren && item.children.map((child: any, i: number) => (
 <TreeNode key={i} item={child} depth={depth + 1}/>
 ))}
 </div>
 );
 };

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
 <div>
 <h3 className="text-lg font-bold text-[#1D3557]">{titles[type]}</h3>
 {data && type === 'PROFIT_LOSS' && (
 <div className={`flex items-center gap-1 mt-1 text-sm font-bold ${(data.netProfitAfterTax || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
 {(data.netProfitAfterTax || 0) >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
 Net {(data.netProfitAfterTax || 0) >= 0 ? 'Profit' : 'Loss'}: ₹{Math.abs(data.netProfitAfterTax || 0).toLocaleString()}
 </div>
 )}
 </div>
 <div className="flex gap-3 items-end flex-wrap">
 {type === 'PROFIT_LOSS' && (
 <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Period From</label>
 <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-bold outline-none"/></div>
 )}
 <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{type === 'PROFIT_LOSS' ? 'To Date' : 'As on Date'}</label>
 <input type="date" value={selectedAsOn} onChange={e => setSelectedAsOn(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm font-bold outline-none"/></div>
 <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer mb-1">
 <input type="checkbox" checked={comparePrev} onChange={e => setComparePrev(e.target.checked)} className="rounded"/> Compare Prev Year
 </label>
 <button onClick={loadData} className="flex items-center gap-1 bg-[#1D3557] text-white px-3 py-1.5 rounded text-xs font-bold"><RefreshCw size={12}/> Refresh</button>
 <button onClick={() => setExpandedNodes({})} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-bold">Collapse All</button>
 <button onClick={() => {
   if (type === 'BALANCE_SHEET' && data) {
     import('../utils/accountingExport').then(m => m.exportBalanceSheet(data.liabilities?.items || [], data.assets?.items || [], selectedAsOn));
   } else if (type === 'PROFIT_LOSS' && data) {
     import('../utils/accountingExport').then(m => m.exportProfitLoss(data, `${periodStart} to ${selectedAsOn}`));
   }
 }} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-bold"><Download size={12}/> Export</button>
 </div>
 </div>

 {error && !loading && <div className="mx-4 mt-2 bg-orange-50 text-orange-700 border border-orange-200 p-2 text-xs rounded flex items-center gap-2"><AlertCircle size={14}/>Using demo data. {error}</div>}

 <div className="flex-1 overflow-auto flex text-sm">
 {loading ? (
 <div className="flex items-center justify-center w-full text-slate-400 gap-2"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/><span>Generating {titles[type]}...</span></div>
 ) : data ? (
 <>
 {/* Left Panel */}
 <div className="flex-1 border-r border-slate-300 flex flex-col">
 <div className="bg-[#E4ECEF] px-4 py-2 font-bold text-slate-700 border-b border-slate-300 text-xs uppercase tracking-widest flex justify-between shrink-0">
 <span>{type === 'BALANCE_SHEET' ? 'LIABILITIES & EQUITY' : 'EXPENSES (Debit)'}</span>
 <span>Amount (₹)</span>
 </div>
 <div className="flex-1 overflow-auto">
 {(type === 'BALANCE_SHEET' ? data.liabilities?.items : data.expenses?.items || [])?.map((n: any, i: number) => (
 <TreeNode key={i} item={n}/>
 ))}
 {type === 'PROFIT_LOSS' && data.netProfitAfterTax > 0 && (
 <div className="flex justify-between p-2 px-3 border-t-2 border-green-500 bg-green-50 font-bold text-green-800">
 <span>Net Profit (Transferred)</span>
 <span>₹{(data.netProfitAfterTax || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
 </div>
 )}
 </div>
 <div className="bg-[#1D3557] text-white px-4 py-2 font-bold flex justify-between text-sm shrink-0">
 <span>Total</span>
 <span>₹{(type === 'BALANCE_SHEET' ? (data.totalLiabilities || data.liabilities?.subtotal || 0) : (data.expenses?.subtotal || 0) + (data.netProfitAfterTax || 0) || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
 </div>
 </div>

 {/* Right Panel */}
 <div className="flex-1 flex flex-col">
 <div className="bg-[#E4ECEF] px-4 py-2 font-bold text-slate-700 border-b border-slate-300 text-xs uppercase tracking-widest flex justify-between shrink-0">
 <span>{type === 'BALANCE_SHEET' ? 'ASSETS' : 'INCOME (Credit)'}</span>
 <span>Amount (₹)</span>
 </div>
 <div className="flex-1 overflow-auto">
 {(type === 'BALANCE_SHEET' ? data.assets?.items : data.income?.items || [])?.map((n: any, i: number) => (
 <TreeNode key={i} item={n}/>
 ))}
 {type === 'PROFIT_LOSS' && data.netProfitAfterTax < 0 && (
 <div className="flex justify-between p-2 px-3 border-t-2 border-red-500 bg-red-50 font-bold text-red-800">
 <span>Net Loss (Transferred)</span>
 <span>₹{Math.abs(data.netProfitAfterTax || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
 </div>
 )}
 </div>
 <div className="bg-[#1D3557] text-white px-4 py-2 font-bold flex justify-between text-sm shrink-0">
 <span>Total</span>
 <span>₹{(type === 'BALANCE_SHEET' ? (data.totalAssets || data.assets?.subtotal || 0) : (data.income?.subtotal || 0)).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
 </div>
 </div>
 </>
 ) : null}
 </div>
 </div>
 );
};

