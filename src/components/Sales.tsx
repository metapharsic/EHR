import React, { useState, useMemo } from 'react';
import { 
 FileText, Plus, Search, Filter, Download, RefreshCw, AlertCircle, 
 TrendingUp, Users, Calendar, ShoppingBag, CheckCircle, Clock, ExternalLink
} from 'lucide-react';
import { 
 ERPLayout, 
 FilterBar, 
 DataTable, 
 StatCard, 
 Badge, 
 Tabs,
 Modal
} from './UniversalLayout';
import { 
 useDataFetch, 
 useDatabaseStatus, 
 useSearch, 
 usePagination 
} from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';
import { useNotificationSystem } from '../hooks/useNotifications';

const Sales: React.FC = () => {
 // 1. Database Status
 const { status: dbStatus } = useDatabaseStatus();
 
 // 2. Data Fetching
 const { data: salesData, loading, error, refetch } = useDataFetch<any[]>('/api/sales', { cacheTime: 300000 });
 const { data: statsResponse, loading: statsLoading, refetch: refetchStats } = useDataFetch<any>('/api/sales/stats');
 const { data: dropdownData } = useDataFetch<any>('/api/sales/dropdown');

 // 3. Auth & Notifications
 const { user } = useAuth();
 const { notifySales } = useNotificationSystem();

 // 4. Local States
 const [activeTab, setActiveTab] = useState('INVOICES');
 const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
 const [showDetailsModal, setShowDetailsModal] = useState(false);
 
 const [filters, setFilters] = useState({
 searchTerm: '',
 status: 'All',
 dateFrom: '',
 dateTo: '',
 });

 // 5. Search & Filter Logic
 const { query, setQuery, results: searchResults } = useSearch<any>(
 salesData || [],
 ['invoice_no', 'party_name']
 );

 const filteredData = useMemo(() => {
 if (!searchResults) return [];
 return searchResults.filter(s => {
 if (filters.status !== 'All' && s.status !== filters.status) return false;
 return true;
 });
 }, [searchResults, filters.status]);

 const pagination = usePagination<any>(filteredData, 10);

 // 6. Stats Calculation (from API)
 const stats = useMemo(() => {
 const data = statsResponse?.data || statsResponse || {};
 return {
 totalRevenue: data.totalRevenue || 0,
 monthlyRevenue: data.monthlyRevenue || 0,
 totalInvoices: data.totalInvoices || 0
 };
 }, [statsResponse]);

 // 7. Event Handlers
 const handleRefresh = async () => {
 await Promise.all([refetch(), refetchStats()]);
 notifySales?.paymentReceived('System', 0); // Just a generic way to use the notify for now or use notifySuccess
 };

 const handleExport = () => {
 const headers = ['Invoice No', 'Date', 'Customer', 'Amount', 'Status'];
 const rows = filteredData.map(s => [
 s.invoice_no, 
 s.invoice_date, 
 s.party_name, 
 s.net_payable, 
 s.status
 ]);
 const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
 const blob = new Blob([csvContent], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `wholesale_sales_${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 };

 const handleFilterChange = (key: string, value: string) => {
 setFilters(prev => ({ ...prev, [key]: value }));
 pagination.goToPage(1);
 };

 // 8. DB Connection Check
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
 title="Sales Management (Wholesale)"
 description="Professional wholesale invoicing, distributor accounts, and revenue tracking"
 onRefresh={handleRefresh}
 onExport={handleExport}
 isLoading={loading || statsLoading}
 actionButtons={[
 { label: '➕ New Wholesale Invoice', onClick: () => {}, variant: 'primary' }
 ]}
 >
 {/* Stats Summary */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <StatCard 
 title="Total Revenue (All Time)" 
 value={`₹${stats.totalRevenue.toLocaleString()}`} 
 color="blue" 
 icon={<TrendingUp size={20} />} 
 />
 <StatCard 
 title="Monthly Sales" 
 value={`₹${stats.monthlyRevenue.toLocaleString()}`} 
 color="success" 
 icon={<ShoppingBag size={20} />} 
 />
 <StatCard 
 title="Total Invoices" 
 value={stats.totalInvoices} 
 color="indigo" 
 icon={<FileText size={20} />} 
 />
 </div>

 {/* Filters */}
 <FilterBar
 filters={[
 {
 id: 'searchTerm',
 label: 'Search Invoice',
 type: 'text',
 value: filters.searchTerm,
 placeholder: 'Invoice No or Customer name...',
 onChange: (v) => {
 handleFilterChange('searchTerm', v);
 setQuery(v);
 }
 },
 {
 id: 'status',
 label: 'Status',
 type: 'select',
 value: filters.status,
 onChange: (v) => handleFilterChange('status', v),
 options: dropdownData?.data?.statuses || [
 { value: 'All', label: 'All Statuses' },
 { value: 'Completed', label: 'Completed' },
 { value: 'Pending', label: 'Pending' },
 { value: 'Cancelled', label: 'Cancelled' }
 ]
 }
 ]}
 />

 {/* Tabs */}
 <Tabs
 activeTab={activeTab}
 onChange={setActiveTab}
 tabs={[
 { id: 'INVOICES', label: 'Wholesale Invoices', badge: filteredData.length },
 { id: 'CUSTOMERS', label: 'Distributor Master' },
 { id: 'ANALYTICS', label: 'Revenue Analysis' }
 ]}
 />

 {/* Main Table */}
 {activeTab === 'INVOICES' && (
 <>
 <DataTable
 loading={loading}
 emptyMessage="No wholesale invoices found"
 data={pagination.paginatedData}
 columns={[
 { 
 key: 'invoice_no', 
 label: 'Invoice No', 
 width: '15%',
 render: (val) => <span className="font-bold text-primary">{val}</span>
 },
 { 
 key: 'invoice_date', 
 label: 'Date', 
 width: '12%',
 render: (val) => <span className="text-slate-500">{new Date(val).toLocaleDateString()}</span>
 },
 { 
 key: 'party_name', 
 label: 'Customer / Distributor', 
 width: '25%',
 render: (val) => <span className="font-medium text-slate-800">{val}</span>
 },
 { 
 key: 'item_count', 
 label: 'Items', 
 width: '10%',
 align: 'center'
 },
 { 
 key: 'net_payable', 
 label: 'Amount', 
 width: '15%',
 align: 'right',
 render: (val) => <span className="font-bold">₹{Number(val).toLocaleString()}</span>
 },
 { 
 key: 'status', 
 label: 'Status', 
 width: '12%',
 render: (val) => (
 <Badge 
 text={val} 
 variant={val === 'Completed' ? 'success' : val === 'Cancelled' ? 'danger' : 'warning'} 
 />
 )
 },
 { 
 key: 'actions', 
 label: 'View', 
 width: '10%', 
 align: 'center',
 render: (_, row: any) => (
 <button 
 onClick={() => {
 setSelectedInvoice(row);
 setShowDetailsModal(true);
 }}
 className="text-primary hover:bg-primary/10 p-1.5 rounded"
 >
 <ExternalLink size={16} />
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
 </>
 )}

 {/* Customer Tab Placeholder */}
 {activeTab === 'CUSTOMERS' && (
 <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
 <Users size={48} className="text-slate-300 mx-auto mb-4" />
 <h3 className="font-bold text-slate-700 text-lg">Distributor Accounts</h3>
 <p className="text-slate-500 max-w-sm mx-auto mt-2">Manage wholesale party ledgers, credit limits, and contact details from this centralized master list.</p>
 </div>
 )}

 {/* Analytics Tab Placeholder */}
 {activeTab === 'ANALYTICS' && (
 <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
 <TrendingUp size={48} className="text-slate-300 mx-auto mb-4" />
 <h3 className="font-bold text-slate-700 text-lg">Wholesale Sales Intelligence</h3>
 <p className="text-slate-500 max-w-sm mx-auto mt-2">Visual insights into your top-selling products, most valuable distributors, and quarterly revenue trends.</p>
 </div>
 )}

 {/* Invoice Details Modal */}
 {showDetailsModal && selectedInvoice && (
 <Modal 
 title={`Wholesale Invoice: ${selectedInvoice.invoice_no}`} 
 onClose={() => setShowDetailsModal(false)}
 size="lg"
 >
 <div className="space-y-6">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Date</p>
 <p className="text-sm font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Status</p>
 <Badge text={selectedInvoice.status} variant={selectedInvoice.status === 'Completed' ? 'success' : 'warning'} />
 </div>
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Payment Mode</p>
 <p className="text-sm font-medium">{selectedInvoice.payment_mode || 'Credit'}</p>
 </div>
 <div>
 <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Created By</p>
 <p className="text-sm font-medium">System Admin</p>
 </div>
 </div>

 <section>
 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Distributor Details</h4>
 <div className="bg-white border border-slate-200 p-4 rounded-xl">
 <p className="font-bold text-slate-800 text-lg">{selectedInvoice.party_name}</p>
 <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-slate-600">
 <p>GSTIN: <span className="font-mono text-slate-800">24AAAAA0000A1Z5</span></p>
 <p>DL No: <span className="font-mono text-slate-800">GZ-12345/67</span></p>
 </div>
 </div>
 </section>

 <section>
 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Financial Summary</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
 <p className="text-[10px] text-slate-400 font-bold uppercase">Sub Total</p>
 <p className="text-lg font-bold">₹{Number(selectedInvoice.total_taxable || 0).toLocaleString()}</p>
 </div>
 <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
 <p className="text-[10px] text-slate-400 font-bold uppercase">Total Tax</p>
 <p className="text-lg font-bold text-orange-600">₹{Number(selectedInvoice.total_gst || (Number(selectedInvoice.total_cgst || 0) + Number(selectedInvoice.total_sgst || 0) + Number(selectedInvoice.total_igst || 0))).toLocaleString()}</p>
 </div>
 <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
 <p className="text-[10px] text-primary/60 font-bold uppercase">Net Payable</p>
 <p className="text-lg font-bold text-primary">₹{Number(selectedInvoice.net_payable).toLocaleString()}</p>
 </div>
 </div>
 </section>

 <div className="pt-4 border-t flex justify-end gap-3">
 <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50">
 <Download size={16} /> Download PDF
 </button>
 <button 
 onClick={() => setShowDetailsModal(false)}
 className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold"
 >
 Close
 </button>
 </div>
 </div>
 </Modal>
 )}
 </ERPLayout>
 );
};

export default Sales;

