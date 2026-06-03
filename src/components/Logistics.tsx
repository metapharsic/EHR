import React, { useState, useMemo, useEffect } from 'react';
import { 
 Truck, Box, FileText, MapPin, ExternalLink, Plus, Search, Filter, 
 Download, BarChart3, Calendar, Package, User, CreditCard, 
 Navigation, Thermometer, Shield, Fuel, Route, Clock, CheckCircle, X, RefreshCw, AlertCircle
} from 'lucide-react';
import { 
 ERPLayout, 
 FilterBar, 
 DataTable, 
 StatCard, 
 Badge, 
 Tabs,
 Modal
} from '../components/UniversalLayout';
import { 
 useDataFetch, 
 useDatabaseStatus, 
 useSearch, 
 usePagination 
} from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';
import { DispatchEntry } from '../types';
import { 
 exportLogisticsDispatchSummaryReport,
 exportLogisticsPerformanceAnalyticsReport,
 exportLogisticsCostAnalysisReport
} from '../utils/excelExport';

const Logistics: React.FC = () => {
 const { user, hasPermission } = useAuth();
 const { status: dbStatus } = useDatabaseStatus();
 
 // ============================================================
 // DATA FETCHING
 // ============================================================
 const { data: logisticsData, loading, error, refetch } = useDataFetch<any[]>('/api/logistics');
 const { data: statsData, loading: statsLoading, refetch: refetchStats } = useDataFetch<any>('/api/logistics/stats');

 // ============================================================
 // FILTER & VIEW STATES
 // ============================================================
 const [activeTab, setActiveTab] = useState('DISPATCHES');
 const [statusFilter, setStatusFilter] = useState('All');
 const [showAddModal, setShowAddModal] = useState(false);
 
 // Search and Pagination
 const { query: searchTerm, setQuery: setSearchTerm, results: searchResults } = useSearch<any>(
 logisticsData || [],
 ['invoice_no', 'customer_name', 'lr_number']
 );

 const filteredResults = useMemo(() => {
 if (statusFilter === 'All') return searchResults;
 return searchResults.filter(d => d.status === statusFilter);
 }, [searchResults, statusFilter]);

 const { currentPage, totalPages, paginatedData, goToPage, hasNextPage, hasPrevPage } = usePagination(filteredResults, 10);

 // ============================================================
 // FORM STATE
 // ============================================================
 const [dispatchForm, setDispatchForm] = useState({
 invoice_no: '',
 customer_name: '',
 customer_address: '',
 customer_city: '',
 customer_state: '',
 customer_pincode: '',
 dispatch_date: new Date().toISOString().split('T')[0],
 expected_delivery_date: '',
 transporter: '',
 transporter_id: '',
 lr_number: '',
 eway_bill_no: '',
 eway_bill_date: '',
 boxes: 1,
 weight: '',
 volume: '',
 package_type: 'Box',
 fragile: false,
 temperature_controlled: false,
 insurance_value: 0,
 insurance_company: '',
 cod_amount: 0,
 shipping_cost: 0,
 handling_charges: 0,
 payment_mode: 'Prepaid',
 status: 'Packed',
 vehicle_number: '',
 driver_name: '',
 driver_contact: '',
 route_details: ''
 });

 // ============================================================
 // EVENT HANDLERS
 // ============================================================
 const handleRefresh = () => {
 refetch();
 refetchStats();
 };

 const handleAddDispatch = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const response = await fetch('/api/logistics', {
 method: 'POST',
 headers: { 
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`
 },
 body: JSON.stringify({
 ...dispatchForm,
 total_charges: Number(dispatchForm.shipping_cost) + Number(dispatchForm.handling_charges),
 delivery_attempts: 0,
 tracking_updates: [
 { 
 timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16), 
 location: 'Origin Facility', 
 status: 'Packed', 
 remarks: 'Package created in system' 
 }
 ]
 })
 });

 if (response.ok) {
 setShowAddModal(false);
 handleRefresh();
 resetForm();
 } else {
 const errData = await response.json();
 alert(`Error: ${errData.error || 'Failed to add dispatch'}`);
 }
 } catch (err) {
 console.error('Error adding dispatch:', err);
 alert('Network error while adding dispatch');
 }
 };

 const resetForm = () => {
 setDispatchForm({
 invoice_no: '',
 customer_name: '',
 customer_address: '',
 customer_city: '',
 customer_state: '',
 customer_pincode: '',
 dispatch_date: new Date().toISOString().split('T')[0],
 expected_delivery_date: '',
 transporter: '',
 transporter_id: '',
 lr_number: '',
 eway_bill_no: '',
 eway_bill_date: '',
 boxes: 1,
 weight: '',
 volume: '',
 package_type: 'Box',
 fragile: false,
 temperature_controlled: false,
 insurance_value: 0,
 insurance_company: '',
 cod_amount: 0,
 shipping_cost: 0,
 handling_charges: 0,
 payment_mode: 'Prepaid',
 status: 'Packed',
 vehicle_number: '',
 driver_name: '',
 driver_contact: '',
 route_details: ''
 });
 };

 const getStatusVariant = (status: string) => {
 switch (status) {
 case 'Delivered': return 'success';
 case 'Cancelled': return 'danger';
 case 'Returned': return 'warning';
 case 'Shipped':
 case 'In Transit':
 case 'Out for Delivery': return 'primary';
 default: return 'neutral';
 }
 };

 // ============================================================
 // RENDER
 // ============================================================
 
 if (!dbStatus.connected) {
 return (
 <div className="p-12 text-center">
 <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
 <h2 className="text-2xl font-bold text-slate-800">Database Offline</h2>
 <p className="text-slate-500 max-w-md mx-auto mt-2">Logistics module requires active database connection to track live shipments.</p>
 <button onClick={handleRefresh} className="mt-6 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors">
 Retry Connection
 </button>
 </div>
 );
 }

 const columns = [
 { 
 key: 'invoice_no', 
 label: 'Invoice / Customer', 
 width: '20%',
 render: (val: string, row: any) => (
 <div>
 <p className="font-bold text-slate-800">{val}</p>
 <p className="text-xs text-slate-500">{row.customer_name}</p>
 <p className="text-[10px] text-slate-400">{row.customer_city}, {row.customer_state}</p>
 </div>
 )
 },
 { 
 key: 'transporter', 
 label: 'Transporter Info', 
 width: '15%',
 render: (val: string, row: any) => (
 <div>
 <p className="font-medium text-slate-700">{val}</p>
 <p className="text-[10px] text-slate-500 font-mono">LR: {row.lr_number}</p>
 <p className="text-[10px] text-slate-400">Veh: {row.vehicle_number || 'N/A'}</p>
 </div>
 )
 },
 { 
 key: 'boxes', 
 label: 'Package Details', 
 width: '15%',
 render: (val: number, row: any) => (
 <div className="text-xs text-slate-600">
 <div className="flex items-center gap-1">
 <Box size={12}/>
 <span>{val} {row.package_type}(s)</span>
 </div>
 <div>{row.weight} | {row.volume}</div>
 <div className="flex gap-1 mt-1">
 {row.fragile && <Badge text="Fragile" variant="danger" className="text-[9px] px-1 py-0" />}
 {row.temperature_controlled && <Badge text="Temp" variant="primary" className="text-[9px] px-1 py-0" />}
 </div>
 </div>
 )
 },
 { 
 key: 'total_charges', 
 label: 'Costs', 
 width: '10%',
 render: (val: number, row: any) => (
 <div className="text-xs">
 <p className="font-medium">₹{Number(val).toLocaleString()}</p>
 <p className="text-[10px] text-slate-500">{row.payment_mode}</p>
 </div>
 )
 },
 { 
 key: 'dispatch_date', 
 label: 'Dates', 
 width: '15%',
 render: (val: string, row: any) => (
 <div className="text-[10px] text-slate-600">
 <div>Dispatch: {new Date(val).toLocaleDateString()}</div>
 <div className="text-slate-400">Exp: {row.expected_delivery_date ? new Date(row.expected_delivery_date).toLocaleDateString() : 'N/A'}</div>
 {row.actual_delivery_date && <div className="text-green-600 font-bold">Del: {new Date(row.actual_delivery_date).toLocaleDateString()}</div>}
 </div>
 )
 },
 { 
 key: 'status', 
 label: 'Status', 
 width: '15%',
 render: (val: string) => <Badge text={val} variant={getStatusVariant(val)} />
 },
 {
 key: 'actions',
 label: 'Actions',
 width: '10%',
 render: (_: any, row: any) => (
 <div className="flex gap-2">
 <button className="text-accent hover:text-blue-800 p-1" title="View Details">
 <ExternalLink size={14} />
 </button>
 <button className="text-emerald-600 hover:text-emerald-800 p-1" title="Tracking">
 <Navigation size={14} />
 </button>
 </div>
 )
 }
 ];

 return (
 <ERPLayout
 title="Logistics & Dispatch"
 description="Shipment Tracking • Transporter Management • Delivery Performance"
 actionButtons={[
 { label: 'Refresh', onClick: handleRefresh, icon: <RefreshCw size={16}/> },
 { label: 'New Dispatch', onClick: () => setShowAddModal(true), variant: 'primary', icon: <Plus size={16}/> }
 ]}
 >
 {/* Stats Section */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <StatCard 
 label="Total Dispatches" 
 value={statsData?.totalDispatches || 0} 
 icon={<Truck size={20}/>} 
 color="blue" 
 />
 <StatCard 
 label="Delivered" 
 value={statsData?.deliveredCount || 0} 
 icon={<CheckCircle size={20}/>} 
 color="success" 
 />
 <StatCard 
 label="In Transit / Pending" 
 value={statsData?.pendingCount || 0} 
 icon={<Clock size={20}/>} 
 color="warning" 
 />
 <StatCard 
 label="Total Shipping Cost" 
 value={`₹${(statsData?.totalRevenue || 0).toLocaleString()}`} 
 icon={<CreditCard size={20}/>} 
 color="purple" 
 />
 </div>

 <Tabs 
 activeTab={activeTab} 
 onChange={setActiveTab}
 tabs={[
 { id: 'DISPATCHES', label: 'Dispatches', badge: filteredResults.length },
 { id: 'ANALYTICS', label: 'Analytics' },
 { id: 'REPORTS', label: 'Reports' }
 ]}
 />

 {activeTab === 'DISPATCHES' && (
 <div className="space-y-4 mt-4">
 <FilterBar 
 searchValue={searchTerm}
 onSearchChange={setSearchTerm}
 searchPlaceholder="Search by Invoice, Customer or LR..."
 filters={[
 {
 label: 'Status',
 value: statusFilter,
 onChange: setStatusFilter,
 options: ['All', 'Packed', 'Shipped', 'In Transit', 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled']
 }
 ]}
 />

 <DataTable 
 columns={columns} 
 data={paginatedData} 
 loading={loading}
 />

 {/* Pagination */}
 <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200">
 <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
 <div className="flex gap-2">
 <button 
 disabled={!hasPrevPage} 
 onClick={() => goToPage(currentPage - 1)}
 className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
 >
 Previous
 </button>
 <button 
 disabled={!hasNextPage} 
 onClick={() => goToPage(currentPage + 1)}
 className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-slate-50"
 >
 Next
 </button>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'ANALYTICS' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
 <Package size={20} className="text-accent"/> Package Type Distribution
 </h3>
 <div className="space-y-4">
 {['Box', 'Carton', 'Pallet', 'Drum'].map(type => {
 const count = logisticsData?.filter(d => d.package_type === type).length || 0;
 const total = logisticsData?.length || 1;
 const percent = (count / total) * 100;
 return (
 <div key={type}>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-slate-600">{type}</span>
 <span className="font-bold">{count} ({percent.toFixed(0)}%)</span>
 </div>
 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
 <div className="bg-accent h-full" style={{ width: `${percent}%` }}></div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
 <Navigation size={20} className="text-emerald-600"/> Delivery Status Breakdown
 </h3>
 <div className="space-y-4">
 {['Delivered', 'Shipped', 'In Transit', 'Packed', 'Cancelled'].map(status => {
 const count = logisticsData?.filter(d => d.status === status).length || 0;
 const total = logisticsData?.length || 1;
 const percent = (count / total) * 100;
 return (
 <div key={status}>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-slate-600">{status}</span>
 <span className="font-bold">{count} ({percent.toFixed(0)}%)</span>
 </div>
 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
 <div className={`h-full ${status === 'Delivered' ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${percent}%` }}></div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'REPORTS' && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center hover:shadow-none transition-shadow">
 <div className="w-12 h-12 bg-blue-50 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
 <FileText size={24} />
 </div>
 <h4 className="font-bold text-slate-800 mb-2">Dispatch Summary</h4>
 <p className="text-xs text-slate-500 mb-4">Complete log of all shipments with status and transporter details.</p>
 <button 
 onClick={() => exportLogisticsDispatchSummaryReport(logisticsData || [])}
 className="w-full py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors flex items-center justify-center gap-2 text-sm"
 >
 <Download size={14}/> Download Excel
 </button>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center hover:shadow-none transition-shadow">
 <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
 <BarChart3 size={24} />
 </div>
 <h4 className="font-bold text-slate-800 mb-2">Performance Analytics</h4>
 <p className="text-xs text-slate-500 mb-4">Analysis of delivery times, transporter efficiency and success rates.</p>
 <button 
 onClick={() => exportLogisticsPerformanceAnalyticsReport(logisticsData || [])}
 className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-sm"
 >
 <Download size={14}/> Download Excel
 </button>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center hover:shadow-none transition-shadow">
 <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
 <CreditCard size={24} />
 </div>
 <h4 className="font-bold text-slate-800 mb-2">Cost Analysis</h4>
 <p className="text-xs text-slate-500 mb-4">Financial breakdown of shipping costs, handling fees and COD collections.</p>
 <button 
 onClick={() => exportLogisticsCostAnalysisReport(logisticsData || [])}
 className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm"
 >
 <Download size={14}/> Download Excel
 </button>
 </div>
 </div>
 )}

 {/* ADD MODAL */}
 {showAddModal && (
 <Modal 
 title="New Dispatch Entry" 
 onClose={() => setShowAddModal(false)}
 size="lg"
 >
 <form onSubmit={handleAddDispatch} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Number *</label>
 <input 
 required
 type="text" 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.invoice_no}
 onChange={e => setDispatchForm({...dispatchForm, invoice_no: e.target.value})}
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Name *</label>
 <input 
 required
 type="text" 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.customer_name}
 onChange={e => setDispatchForm({...dispatchForm, customer_name: e.target.value})}
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Transporter</label>
 <input 
 type="text" 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.transporter}
 onChange={e => setDispatchForm({...dispatchForm, transporter: e.target.value})}
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LR Number (Consignment No)</label>
 <input 
 type="text" 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.lr_number}
 onChange={e => setDispatchForm({...dispatchForm, lr_number: e.target.value})}
 />
 </div>
 </div>

 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Boxes</label>
 <input 
 type="number" 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.boxes}
 onChange={e => setDispatchForm({...dispatchForm, boxes: parseInt(e.target.value)})}
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shipping Cost</label>
 <input 
 type="number" 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.shipping_cost}
 onChange={e => setDispatchForm({...dispatchForm, shipping_cost: parseFloat(e.target.value)})}
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Mode</label>
 <select 
 className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
 value={dispatchForm.payment_mode}
 onChange={e => setDispatchForm({...dispatchForm, payment_mode: e.target.value})}
 >
 <option value="Prepaid">Prepaid</option>
 <option value="COD">COD</option>
 <option value="ToPay">ToPay</option>
 </select>
 </div>
 </div>

 <div className="pt-4 border-t flex justify-end gap-2">
 <button 
 type="button"
 onClick={() => setShowAddModal(false)}
 className="px-4 py-2 border rounded text-sm text-slate-600 hover:bg-slate-50"
 >
 Cancel
 </button>
 <button 
 type="submit"
 className="px-6 py-2 bg-accent text-white rounded text-sm font-bold hover:bg-accent"
 >
 Save Dispatch
 </button>
 </div>
 </form>
 </Modal>
 )}
 </ERPLayout>
 );
};

export default Logistics;

