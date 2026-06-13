import React, { useState, useEffect, useCallback } from 'react';
import { GeneralLedgerService, ChartOfAccountsService } from '../services/accountingService';
import { Search, Download, Printer, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';

export const GeneralLedger: React.FC<{ accountId?: string }> = ({ accountId }) => {
 const [accounts, setAccounts] = useState<any[]>([]);
 const [selectedAccount, setSelectedAccount] = useState<string>(accountId || '');
 const [entries, setEntries] = useState<any[]>([]);
 const [openingBalance, setOpeningBalance] = useState<number>(0);
 const [loading, setLoading] = useState(false);
 const [loadingAccounts, setLoadingAccounts] = useState(true);
 const [error, setError] = useState('');

 const [dateFrom, setDateFrom] = useState(() => {
 const d = new Date(); d.setDate(1);
 return d.toISOString().split('T')[0];
 });
 const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
 const [voucherTypeFilter, setVoucherTypeFilter] = useState('All');

 useEffect(() => {
 ChartOfAccountsService.getAllAccounts()
 .then(d => {
   const flatAccounts = Array.isArray(d) ? d : [];
   setAccounts(flatAccounts);
   if (accountId && !selectedAccount) {
     // Fallback selection if accounts load later
     const found = flatAccounts.find(a => (a.id === accountId) || (a.accountCode === accountId));
     if (found) setSelectedAccount(found.id || found.accountCode);
   }
 })
 .catch(() => setAccounts([]))
 .finally(() => setLoadingAccounts(false));
 }, [accountId]);

 const loadLedger = useCallback(async () => {
 if (!selectedAccount) return;
 setLoading(true);
 setError('');
 try {
 const data = await GeneralLedgerService.getAccountLedger(selectedAccount, {
 dateFrom,
 dateTo,
 voucherType: voucherTypeFilter !== 'All' ? voucherTypeFilter : undefined
 });
 // FIX: API now returns { openingBalance, entries, ... }
 const apiEntries = Array.isArray(data) ? data : (data?.entries || []);
 setEntries(apiEntries);
 if (data?.openingBalance !== undefined) setOpeningBalance(parseFloat(data.openingBalance) || 0);
 } catch (err: any) {
 setError(err.message || 'Failed to load ledger');
 setEntries([]);
 } finally {
 setLoading(false);
 }
 }, [selectedAccount, dateFrom, dateTo, voucherTypeFilter]);

 useEffect(() => { if (selectedAccount) loadLedger(); }, [selectedAccount, loadLedger]);

 // Calculate running balance
 const entriesWithBalance = entries.reduce<any[]>((acc, entry, idx) => {
 // FIX: start from account opening balance for the period, not 0
 const prevBal = idx === 0 ? openingBalance : acc[idx - 1].runningBalance;
 const runningBalance = prevBal + (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
 return [...acc, { ...entry, runningBalance }];
 }, []);

 const totalDebit  = entries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0);
 const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
 // FIX: closing balance includes opening balance
 const closingBalance = openingBalance + totalDebit - totalCredit;

 const selectedAccountDetails = accounts.find(a => (a.id || a.accountCode) === selectedAccount);

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 {/* Header */}
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
 <div className="flex justify-between items-center mb-3">
 <div>
 <h3 className="text-lg font-bold text-slate-800 tracking-tight">General Ledger</h3>
 <p className="text-xs text-slate-500">Account-wise transaction history with running balance</p>
 </div>
 <div className="flex gap-2">
 <button onClick={() => {
   if (selectedAccountDetails) {
     import('../utils/accountingExport').then(m => m.printGeneralLedger(selectedAccountDetails.accountName, entriesWithBalance, openingBalance));
   }
 }} className="flex items-center gap-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Printer size={14}/> Print</button>
 <button onClick={() => {
   if (selectedAccountDetails) {
     import('../utils/accountingExport').then(m => m.exportGeneralLedger(selectedAccountDetails.accountName, entriesWithBalance));
   }
 }} className="flex items-center gap-1 bg-[#1D3557] hover:bg-[#2A4B7C] text-white px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export</button>
 </div>
 </div>

 {/* Account Selector & Filters */}
 <div className="flex gap-3 items-end flex-wrap">
 <div className="flex-1 min-w-64">
 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Account Ledger</label>
 <select
 value={selectedAccount}
 onChange={e => setSelectedAccount(e.target.value)}
 className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm font-bold bg-yellow-50 text-[#1D3557] outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
 >
 <option value="">-- Select Account / Ledger --</option>
 {loadingAccounts && <option disabled>Loading accounts...</option>}
 {accounts.map(a => (
 <option key={a.id || a.accountCode} value={a.id || a.accountCode}>{a.accountName || a.accountCode}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Date</label>
 <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none"/>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To Date</label>
 <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none"/>
 </div>
 <div>
 <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Voucher Type</label>
 <select value={voucherTypeFilter} onChange={e => setVoucherTypeFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm font-bold bg-white outline-none">
 <option value="All">All Types</option>
 <option value="Sales">Sales</option>
 <option value="Purchase">Purchase</option>
 <option value="Receipt">Receipt</option>
 <option value="Payment">Payment</option>
 <option value="Journal">Journal</option>
 <option value="Contra">Contra</option>
 </select>
 </div>
 <button onClick={loadLedger} disabled={!selectedAccount} className="flex items-center gap-1 bg-[#1D3557] text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-[#2A4B7C] disabled:opacity-40 h-[33px]">
 <RefreshCw size={14}/> Refresh
 </button>
 </div>
 </div>

 {/* Account Info Strip */}
 {selectedAccountDetails && (
 <div className="flex gap-8 px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm shrink-0">
 <div><span className="text-xs text-slate-500 font-bold">Account:</span> <span className="font-bold text-[#1D3557]">{selectedAccountDetails.accountName}</span></div>
 <div><span className="text-xs text-slate-500 font-bold">Type:</span> <span className="font-bold">{selectedAccountDetails.accountType}</span></div>
 <div><span className="text-xs text-slate-500 font-bold">Group:</span> <span className="font-bold">{selectedAccountDetails.group || '-'}</span></div>
 </div>
 )}

 {/* Error */}
 {error && <div className="mx-4 mt-3 bg-red-50 text-red-700 border border-red-200 p-2 text-xs rounded flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}

 {/* Ledger Table */}
 <div className="flex-1 overflow-auto">
 {!selectedAccount ? (
 <div className="flex flex-col items-center justify-center h-full text-slate-400">
 <ChevronRight size={40} className="opacity-20 mb-2"/>
 <p className="font-bold text-slate-500">Select a ledger account above to view transactions</p>
 </div>
 ) : loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/><span>Loading ledger...</span></div>
 ) : (
 <table className="w-full text-left border-collapse text-sm">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-xs text-slate-600 uppercase tracking-wider z-10">
 <tr>
 <th className="p-2 font-bold border-r border-slate-300 w-32">Date</th>
 <th className="p-2 font-bold border-r border-slate-300">Particulars / Narration</th>
 <th className="p-2 font-bold border-r border-slate-300 w-32">Vch Type</th>
 <th className="p-2 font-bold border-r border-slate-300 w-32">Vch No.</th>
 <th className="p-2 font-bold border-r border-slate-300 text-right w-32">Debit (₹)</th>
 <th className="p-2 font-bold border-r border-slate-300 text-right w-32">Credit (₹)</th>
 <th className="p-2 font-bold text-right w-36">Running Bal (₹)</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {/* Opening Balance Row */}
 <tr className="bg-amber-50 font-bold text-amber-800">
 <td className="p-2 border-r border-slate-100" colSpan={4}>Opening Balance (as on {dateFrom})</td>
 <td className="p-2 border-r border-slate-100 text-right">-</td>
 <td className="p-2 border-r border-slate-100 text-right">-</td>
 <td className="p-2 text-right font-mono">
           ₹{Math.abs(openingBalance).toLocaleString(undefined,{minimumFractionDigits:2})} {openingBalance >= 0 ? 'Dr' : 'Cr'}
         </td>
 </tr>
 {entriesWithBalance.length === 0 ? (
 <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No transactions found for this period.</td></tr>
 ) : entriesWithBalance.map((e, i) => (
 <tr key={i} className="hover:bg-blue-50/40 cursor-pointer group">
 <td className="p-2 border-r border-slate-100 font-medium">{e.date ? new Date(e.date).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'2-digit'}) : '-'}</td>
 <td className="p-2 border-r border-slate-100">
 <div className="font-bold text-[#1D3557] group-hover:underline">{e.particulars || e.accountName || '-'}</div>
 {e.narration && <div className="text-xs italic text-slate-400">{e.narration}</div>}
 </td>
 <td className="p-2 border-r border-slate-100 text-xs font-semibold">{e.voucherType || '-'}</td>
 <td className="p-2 border-r border-slate-100 text-xs font-bold text-accent">{e.voucherNo || '-'}</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800">{e.debit > 0 ? `₹${e.debit.toLocaleString(undefined,{minimumFractionDigits:2})}` : ''}</td>
 <td className="p-2 border-r border-slate-100 text-right font-bold text-slate-800">{e.credit > 0 ? `₹${e.credit.toLocaleString(undefined,{minimumFractionDigits:2})}` : ''}</td>
 <td className={`p-2 text-right font-bold ${e.runningBalance >= 0 ? 'text-accent' : 'text-red-600'}`}>
 ₹{Math.abs(e.runningBalance).toLocaleString(undefined,{minimumFractionDigits:2})} {e.runningBalance >= 0 ? 'Dr' : 'Cr'}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>

 {/* Footer Summary */}
 {!loading && selectedAccount && entries.length > 0 && (
 <div className="bg-[#1D3557] text-white flex text-sm font-bold shrink-0">
 <div className="flex-1 p-2 px-3 text-right border-r border-slate-500 text-xs tracking-wider flex items-center justify-end uppercase">Closing Balance ({dateTo}):</div>
 <div className="w-32 p-2 text-right border-r border-slate-500">₹{totalDebit.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 <div className="w-32 p-2 text-right border-r border-slate-500">₹{totalCredit.toLocaleString(undefined,{minimumFractionDigits:2})}</div>
 <div className={`w-36 p-2 text-right ${closingBalance >= 0 ? 'text-[#A8DADC]' : 'text-red-400'}`}>
 ₹{Math.abs(closingBalance).toLocaleString(undefined,{minimumFractionDigits:2})} {closingBalance >= 0 ? 'Dr' : 'Cr'}
 </div>
 </div>
 )}
 </div>
 );
};

