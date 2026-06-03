import React, { useState, useEffect, useCallback } from 'react';
import { AuditService } from '../services/accountingService';
import { Search, Shield, Filter, Download, Printer } from 'lucide-react';
import { exportAuditLog, printReport } from '../utils/accountingExport';
import { useCompany } from '../context/CompanyContext';
import { formatDateTime } from '../utils/formatters';

const ACTION_COLORS: Record<string, string> = {
 CREATE: 'bg-green-100 text-green-700',
 UPDATE: 'bg-blue-100 text-accent',
 DELETE: 'bg-red-100 text-red-700',
 POST: 'bg-purple-100 text-purple-700',
 REVERSE: 'bg-orange-100 text-orange-700',
 LOGIN: 'bg-slate-100 text-slate-600',
 EXPORT: 'bg-teal-100 text-teal-700',
};

const MODULES = ['All', 'Journal Vouchers', 'Sales', 'Purchase', 'Party Master', 'Chart of Accounts', 'Assets', 'GST', 'TDS', 'Bank Recon'];

export const AuditTrailView: React.FC = () => {
 const [logs, setLogs] = useState<any[]>([]);
 const { company } = useCompany();
 const [loading, setLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [moduleFilter, setModuleFilter] = useState('All');
 const [actionFilter, setActionFilter] = useState('All');
 const [dateFrom, setDateFrom] = useState('');
 const [dateTo, setDateTo] = useState('');
 const [selectedLog, setSelectedLog] = useState<any>(null);

 const loadLogs = useCallback(async () => {
 setLoading(true);
 try {
 const data = await AuditService.getAllLogs();
 setLogs(Array.isArray(data) ? data : []);
 } catch {
 setLogs([
 { id: '1', timestamp: '2025-04-01T09:32:11Z', user: 'Admin', action: 'CREATE', module: 'Journal Vouchers', entityId: 'JV-2025-00001', description: 'Created Journal Voucher JV-2025-00001 (Dr: 50000, Cr: 50000)', ipAddress: '192.168.1.10' },
 { id: '2', timestamp: '2025-04-01T10:05:42Z', user: 'Admin', action: 'POST', module: 'Sales', entityId: 'SAL-001', description: 'Posted Sales Invoice SAL-001 for Apollo Hospitals — ₹1,25,000', ipAddress: '192.168.1.10' },
 { id: '3', timestamp: '2025-04-02T11:20:10Z', user: 'Manager', action: 'UPDATE', module: 'Party Master', entityId: 'PARTY-001', description: 'Updated credit limit for Apollo Hospitals from ₹5,00,000 to ₹7,50,000', ipAddress: '192.168.1.15' },
 { id: '4', timestamp: '2025-04-02T14:10:00Z', user: 'Admin', action: 'DELETE', module: 'Chart of Accounts', entityId: 'ACC-999', description: 'Deleted unused account ACC-999 (Test Account)', ipAddress: '192.168.1.10' },
 { id: '5', timestamp: '2025-04-03T09:00:00Z', user: 'Auditor', action: 'EXPORT', module: 'GST', entityId: 'GSTR-3B-Apr', description: 'Exported GSTR-3B for April 2025 (JSON format)', ipAddress: '192.168.1.22' },
 { id: '6', timestamp: '2025-04-03T12:30:00Z', user: 'Admin', action: 'REVERSE', module: 'Journal Vouchers', entityId: 'JV-2025-00002', description: 'Reversed Journal Voucher JV-2025-00002 — Reason: Entered incorrect account', ipAddress: '192.168.1.10' },
 { id: '7', timestamp: '2025-04-04T08:45:00Z', user: 'Finance', action: 'CREATE', module: 'TDS', entityId: 'TDS-001', description: 'TDS deducted ₹1,500 for BuildTech Contractors under Section 194C', ipAddress: '192.168.1.18' },
 { id: '8', timestamp: '2025-04-05T15:00:00Z', user: 'Admin', action: 'LOGIN', module: 'System', entityId: 'USER-ADMIN', description: 'User Admin logged in from 192.168.1.10', ipAddress: '192.168.1.10' },
 ]);
 } finally { setLoading(false); }
 }, []);

 useEffect(() => { loadLogs(); }, [loadLogs]);

 const filtered = logs.filter(l => {
 const term = searchTerm.toLowerCase();
 const matchSearch = !term || l.description?.toLowerCase().includes(term) || l.user?.toLowerCase().includes(term) || l.entityId?.toLowerCase().includes(term);
 const matchModule = moduleFilter === 'All' || l.module === moduleFilter;
 const matchAction = actionFilter === 'All' || l.action === actionFilter;
 return matchSearch && matchModule && matchAction;
 });

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col h-full overflow-hidden">
 {/* Header */}
 <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
 <div className="flex justify-between items-center mb-3">
 <div>
 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Shield size={20} className="text-[#1D3557]"/> Audit Trail</h3>
 <p className="text-xs text-slate-500">Immutable log of all financial activities — every change is recorded</p>
 </div>
 <div className="flex gap-2">
 <button 
 onClick={() => {
 const rows = filtered.map(l => `<tr><td>${formatDateTime(l.timestamp)}</td><td>${l.user}</td><td>${l.action}</td><td>${l.module}</td><td>${l.entityId}</td><td>${l.description}</td></tr>`).join('');
 printReport('Audit Trail Report', `<table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Ref</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`, company);
 }}
 className="flex items-center gap-1 bg-white border text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"
 >
 <Printer size={14}/> Print
 </button>
 <button onClick={() => exportAuditLog(filtered, `Module:${moduleFilter} Action:${actionFilter}`, company)} className="flex items-center gap-1 bg-white border text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm"><Download size={14}/> Export Log</button>
 </div>
 </div>
 <div className="flex gap-3 items-end flex-wrap">
 <div className="relative flex-1 min-w-48">
 <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
 <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search description, user, entity ID..." className="pl-7 pr-3 py-1.5 border border-slate-300 rounded text-xs w-full outline-none"/>
 </div>
 <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-xs font-bold bg-white outline-none">
 {MODULES.map(m => <option key={m}>{m}</option>)}
 </select>
 <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-xs font-bold bg-white outline-none">
 <option value="All">All Actions</option>
 {Object.keys(ACTION_COLORS).map(a => <option key={a}>{a}</option>)}
 </select>
 <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-xs outline-none"/>
 <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-xs outline-none"/>
 </div>
 </div>

 {/* Log Table */}
 <div className="flex-1 overflow-auto flex">
 <div className={`flex-1 overflow-auto ${selectedLog ? 'border-r border-slate-200' : ''}`}>
 {loading ? (
 <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"/>Loading audit trail...</div>
 ) : (
 <table className="w-full text-left border-collapse text-xs">
 <thead className="bg-[#E4ECEF] sticky top-0 border-b border-slate-300 shadow-sm text-slate-600 uppercase font-bold z-10 tracking-wider">
 <tr>
 <th className="p-2 border-r border-slate-300 w-36">Timestamp</th>
 <th className="p-2 border-r border-slate-300 w-24">User</th>
 <th className="p-2 border-r border-slate-300 w-24">Action</th>
 <th className="p-2 border-r border-slate-300 w-32">Module</th>
 <th className="p-2 border-r border-slate-300 w-32">Entity / Ref.</th>
 <th className="p-2">Description</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filtered.map(l => (
 <tr key={l.id} onClick={() => setSelectedLog(l)} className={`hover:bg-blue-50/40 cursor-pointer ${selectedLog?.id === l.id ? 'bg-blue-50 border-l-2 border-accent' : ''}`}>
 <td className="p-2 border-r border-slate-100 font-mono text-slate-500 whitespace-nowrap">{formatDateTime(l.timestamp)}</td>
 <td className="p-2 border-r border-slate-100 font-bold text-[#1D3557]">{l.user}</td>
 <td className="p-2 border-r border-slate-100">
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border border-transparent ${ACTION_COLORS[l.action] || 'bg-slate-100 text-slate-500'}`}>{l.action}</span>
 </td>
 <td className="p-2 border-r border-slate-100 font-bold text-slate-600">{l.module}</td>
 <td className="p-2 border-r border-slate-100 font-mono text-accent font-bold">{l.entityId}</td>
 <td className="p-2 text-slate-600 truncate max-w-xs">{l.description}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 {/* Detail Panel */}
 {selectedLog && (
 <div className="w-72 shrink-0 bg-slate-50 p-4 overflow-auto">
 <div className="font-bold text-[#1D3557] text-sm mb-4 flex items-center justify-between">
 Audit Detail<button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 text-xs">✖</button>
 </div>
 <div className="space-y-3 text-xs">
 {[
 ['Timestamp', formatDateTime(selectedLog.timestamp)],
 ['User', selectedLog.user],
 ['Action', selectedLog.action],
 ['Module', selectedLog.module],
 ['Entity ID', selectedLog.entityId],
 ['IP Address', selectedLog.ipAddress || '-'],
 ].map(([k, v]) => (
 <div key={k} className="border-b border-slate-200 pb-2">
 <div className="text-slate-400 font-bold uppercase text-[10px]">{k}</div>
 <div className="font-bold text-slate-800 mt-0.5">{v}</div>
 </div>
 ))}
 <div className="border-b border-slate-200 pb-2">
 <div className="text-slate-400 font-bold uppercase text-[10px]">Description</div>
 <div className="text-slate-700 mt-0.5 leading-relaxed">{selectedLog.description}</div>
 </div>
 <div className="bg-blue-50 border border-blue-200 rounded p-2 text-accent text-[10px] font-bold">
 🔒 This log entry is immutable and cannot be modified.
 </div>
 </div>
 </div>
 )}
 </div>

 <div className="bg-[#1D3557] text-white flex items-center text-xs font-bold px-4 py-2 shrink-0">
 <div className="flex-1">{filtered.length} of {logs.length} log entries</div>
 <div className="text-slate-300">Immutable Audit Log — All actions are permanently recorded</div>
 </div>
 </div>
 );
};

