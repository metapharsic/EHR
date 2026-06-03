import React, { useState, useMemo } from 'react';
import { 
 Shield, Clock, User, Download, Eye, Filter, Calendar, AlertTriangle, 
 CheckCircle, X, Server, Globe, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
 ERPLayout, 
 FilterBar, 
 DataTable, 
 StatCard, 
 Tabs, 
 Badge, 
 Modal 
} from './UniversalLayout';
import { 
 useDataFetch, 
 useDatabaseStatus, 
 useSearch, 
 usePagination 
} from '../hooks/useDataFetch';
import { AuditLogEntry } from '../types';

const AuditLog: React.FC = () => {
 // 1. Database Status
 const { status: dbStatus } = useDatabaseStatus();

 // 2. Fetch Data
 const { data: logs, loading, error, refetch } = useDataFetch<AuditLogEntry[]>(
 '/api/audit',
 { cacheTime: 60000 } // Cache for 1 minute
 );

 // 3. Local States
 const [activeTab, setActiveTab] = useState('ALL_LOGS');
 const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
 const [showDetailsModal, setShowDetailsModal] = useState(false);
 
 const [filters, setFilters] = useState({
 searchTerm: '',
 module: 'ALL',
 severity: 'ALL',
 });

 // 4. Search & Filter Logic
 const { query, setQuery, results: searchResults } = useSearch<AuditLogEntry>(
 logs || [],
 ['user', 'action', 'module', 'details']
 );

 const filteredData = useMemo(() => {
 if (!searchResults) return [];
 return searchResults.filter(log => {
 if (filters.module !== 'ALL' && log.module !== filters.module) return false;
 return true;
 });
 }, [searchResults, filters.module]);

 const pagination = usePagination<AuditLogEntry>(filteredData, 20);

 // 5. Stats Calculation
 const stats = useMemo(() => {
 if (!logs) return { total: 0, today: 0, critical: 0 };
 const today = new Date().toISOString().split('T')[0];
 return {
 total: logs.length,
 today: logs.filter(l => l.timestamp.startsWith(today)).length,
 critical: logs.filter(l => l.action.toLowerCase().includes('failed') || l.action.toLowerCase().includes('delete')).length
 };
 }, [logs]);

 // 6. Event Handlers
 const handleRefresh = async () => {
 await refetch();
 };

 const handleExport = () => {
 const headers = ['Timestamp', 'User', 'Module', 'Action', 'IP Address', 'Details'];
 const rows = filteredData.map(l => [l.timestamp, l.user, l.module, l.action, l.ipAddress, l.details]);
 const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
 const blob = new Blob([csvContent], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 };

 const handleFilterChange = (key: string, value: string) => {
 setFilters(prev => ({ ...prev, [key]: value }));
 pagination.goToPage(1);
 };

 // 7. DB Connection Check
 if (!dbStatus.connected) {
 return (
 <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
 <div className="flex gap-3">
 <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
 <div>
 <h3 className="font-semibold text-red-900">⚠️ Database Connection Failed</h3>
 <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
 <button onClick={handleRefresh} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">🔄 Retry</button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <ERPLayout
 title="Security Audit Logs"
 description="Monitor system activities, user actions, and security-critical events"
 onRefresh={handleRefresh}
 onExport={handleExport}
 isLoading={loading}
 >
 {/* Stats Summary */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <StatCard label="Total Logs" value={stats.total} color="blue" icon={<Shield size={20} />} />
 <StatCard label="Today's Events" value={stats.today} color="success" icon={<Clock size={20} />} />
 <StatCard label="Security Alerts" value={stats.critical} color="danger" icon={<AlertTriangle size={20} />} />
 </div>

 {/* Filters */}
 <FilterBar
 filters={[
 {
 id: 'searchTerm',
 label: 'Search Logs',
 type: 'text',
 value: filters.searchTerm,
 placeholder: 'Search user, action, or details...',
 onChange: (v) => {
 handleFilterChange('searchTerm', v);
 setQuery(v);
 }
 },
 {
 id: 'module',
 label: 'Module',
 type: 'select',
 value: filters.module,
 onChange: (v) => handleFilterChange('module', v),
 options: [
 { value: 'ALL', label: 'All Modules' },
 { value: 'Auth', label: 'Authentication' },
 { value: 'Inventory', label: 'Inventory' },
 { value: 'POS', label: 'POS / Billing' },
 { value: 'Settings', label: 'Settings' },
 { value: 'HR', label: 'HR / Users' }
 ]
 }
 ]}
 />

 {/* Tabs */}
 <Tabs
 activeTab={activeTab}
 onChange={setActiveTab}
 tabs={[
 { id: 'ALL_LOGS', label: 'All Activity', badge: stats.total },
 { id: 'SECURITY', label: 'Security Alerts', badge: stats.critical },
 { id: 'SYSTEM', label: 'System Events' }
 ]}
 />

 {/* Main Table */}
 <DataTable
 loading={loading}
 emptyMessage="No audit logs found"
 data={pagination.paginatedData}
 columns={[
 { 
 key: 'timestamp', 
 label: 'Timestamp', 
 width: '18%',
 render: (value) => <span className="text-xs font-mono text-slate-500">{value}</span>
 },
 { 
 key: 'user', 
 label: 'User', 
 width: '15%',
 render: (value) => (
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
 {value?.charAt(0) || 'U'}
 </div>
 <span className="text-xs font-medium">{value}</span>
 </div>
 )
 },
 { 
 key: 'module', 
 label: 'Module', 
 width: '12%',
 render: (value) => <Badge text={value} variant="info" />
 },
 { 
 key: 'action', 
 label: 'Action', 
 width: '20%',
 render: (value) => <span className="font-medium text-slate-800">{value}</span>
 },
 { 
 key: 'ipAddress', 
 label: 'IP Address', 
 width: '12%',
 render: (value) => <span className="text-xs font-mono text-slate-400">{value}</span>
 },
 { 
 key: 'details', 
 label: 'Details', 
 width: '15%',
 render: (value) => <span className="text-xs text-slate-500 truncate block max-w-[200px]">{value}</span>
 },
 { 
 key: 'actions', 
 label: 'View', 
 width: '8%', 
 align: 'center',
 render: (_, row: any) => (
 <button 
 onClick={() => {
 setSelectedLog(row);
 setShowDetailsModal(true);
 }}
 className="text-primary hover:bg-primary/10 p-1.5 rounded"
 >
 <Eye size={16} />
 </button>
 )
 }
 ]}
 />

 {/* Pagination */}
 {pagination.totalPages > 1 && (
 <div className="mt-4 flex justify-between items-center">
 <p className="text-sm text-slate-500">Showing {pagination.paginatedData.length} of {filteredData.length}</p>
 <div className="flex gap-2">
 <button 
 disabled={!pagination.hasPrevPage} 
 onClick={() => pagination.goToPage(pagination.currentPage - 1)}
 className="px-3 py-1 border rounded disabled:opacity-50"
 >Prev</button>
 <span className="px-3 py-1">Page {pagination.currentPage} of {pagination.totalPages}</span>
 <button 
 disabled={!pagination.hasNextPage} 
 onClick={() => pagination.goToPage(pagination.currentPage + 1)}
 className="px-3 py-1 border rounded disabled:opacity-50"
 >Next</button>
 </div>
 </div>
 )}

 {/* Details Modal */}
 {showDetailsModal && selectedLog && (
 <Modal 
 title="Audit Record Details" 
 onClose={() => setShowDetailsModal(false)}
 size="md"
 >
 <div className="space-y-4">
 <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase">Timestamp</p>
 <p className="text-sm font-mono">{selectedLog.timestamp}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase">IP Address</p>
 <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase">User</p>
 <p className="text-sm font-medium">{selectedLog.user}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase">Module</p>
 <p className="text-sm font-medium">{selectedLog.module}</p>
 </div>
 </div>
 
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Action Performed</p>
 <p className="text-md font-bold text-slate-800">{selectedLog.action}</p>
 </div>
 
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Detailed Log Information</p>
 <div className="bg-slate-900 text-slate-300 p-4 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed">
 {selectedLog.details}
 </div>
 </div>
 
 <div className="pt-4 border-t flex justify-end">
 <button 
 onClick={() => setShowDetailsModal(false)}
 className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold"
 >
 Close Record
 </button>
 </div>
 </div>
 </Modal>
 )}
 </ERPLayout>
 );
};

export default AuditLog;

