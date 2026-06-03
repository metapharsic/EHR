import React, { useState, useMemo } from 'react';
import { 
 Truck, Plus, Search, Filter, Calendar, FileText, CheckCircle, AlertCircle, 
 Clock, X, RefreshCw, ArrowRight, Save, Trash2, CreditCard, 
 Star, TrendingUp, TrendingDown, DollarSign, Package, 
 ShieldCheck, AlertTriangle, BarChart3, UserCheck, 
 ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Minus,
 Bell, Settings, Target, PieChart, Activity, Info
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
import { useDataFetch, useDatabaseStatus } from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { useNotificationSystem } from '../hooks/useNotifications';
import ProductForm from './ProductForm';
import { Product } from '../types';

// --- ENHANCED INTERFACES ---

interface PurchaseOrder {
 id: string;
 invoice_no: string;
 supplier_name: string;
 order_date: string;
 status: string;
 total_amount: number;
 item_count: number;
}

interface ThreeWayMatch {
 poId: string;
 poNumber: string;
 grnNumber: string;
 invoiceNumber: string;
 supplierName: string;
 poAmount: number;
 grnAmount: number;
 invoiceAmount: number;
 variance: number;
 status: 'Matched' | 'Partial' | 'Mismatch' | 'Pending';
}

interface VendorRating {
 supplier_id: string;
 supplierName: string;
 overall_rating: number;
 quality_score: number;
 delivery_score: number;
 price_score: number;
 on_time_delivery_rate: number;
 total_transactions: number;
}

interface ReorderAlert {
 productId: string;
 productName: string;
 reorderPoint: number;
 currentStock: number;
 supplierName: string;
}

interface PurchaseBudget {
 id: string;
 category_id: string;
 period_name: string;
 budgeted_amount: number;
 spent_amount: number;
 committed_amount: number;
 status: 'Under' | 'Near' | 'Over';
}

const PurchaseEnhanced: React.FC = () => {
 const [activeTab, setActiveTab] = useState('PURCHASES');
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState('All');
 const { user } = useAuth();
 const { status: dbStatus, recheck: recheckDb } = useDatabaseStatus();
 const { success, error: notifyError, warning } = useNotificationSystem();

 // --- DATA FETCHING ---
 
 const { data: purchases = [], loading: loadingPurchases, refetch: refetchPurchases, fullResponse: poResponse } = useDataFetch<PurchaseOrder[]>('/api/purchase');
 const { data: inventoryStats } = useDataFetch<any>('/api/reports/inventory');
 const { data: matches = [], loading: loadingMatches, refetch: refetchMatches } = useDataFetch<ThreeWayMatch[]>('/api/purchase/3-way-match');
 const { data: vendorRatings = [], loading: loadingVendors, refetch: refetchVendors } = useDataFetch<VendorRating[]>('/api/purchase/vendor-ratings');
 const { data: reorderAlerts = [], loading: loadingReorder, refetch: refetchReorder } = useDataFetch<ReorderAlert[]>('/api/purchase/reorder-alerts');
 const { data: budgets = [], loading: loadingBudgets, refetch: refetchBudgets } = useDataFetch<PurchaseBudget[]>('/api/purchase/budgets');
 const { data: approvals = [], loading: loadingApprovals, refetch: refetchApprovals } = useDataFetch<any[]>('/api/purchase/approvals');

 const [isNewPurchaseModalOpen, setIsNewPurchaseModalOpen] = useState(false);
 const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
 const [newOrderForm, setNewOrderForm] = useState({
 invoice_no: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
 supplier_id: '',
 order_date: new Date().toISOString().split('T')[0],
 category_id: 'RAW_MATERIALS', // Changed from GENERAL to match seeded data
 priority: 'Standard',
 notes: ''
 });
 const [newOrderItems, setNewOrderItems] = useState<any[]>([
 { product_id: '', quantity: 1, purchase_rate: 0, mrp: 0, gst_rate: 18, batch_no: '', expiry_date: '' }
 ]);

 const [selectedItem, setSelectedItem] = useState<any>(null);
 const [editForm, setEditForm] = useState<any>(null);
 const [editItems, setEditItems] = useState<any[]>([]);
 const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
 const [modalType, setModalType] = useState<'PURCHASE' | 'MATCH' | 'VENDOR' | 'REORDER' | 'APPROVAL' | 'BUDGET'>('PURCHASE');
 const [isUpdating, setIsUpdating] = useState(false);
 const [isCreating, setIsCreating] = useState(false);

 const { data: lists, refetch: refetchLists } = useDataFetch<any>('/api/purchase/lists/dropdown');

 const handleCreateOrder = async () => {
 if (!newOrderForm.supplier_id || newOrderItems.some(item => !item.product_id)) {
 warning('Please select a supplier and products for all line items.');
 return;
 }

 setIsCreating(true);
 try {
 const response = await apiClient.post('/api/purchase', {
 ...newOrderForm,
 items: newOrderItems
 });

 if (response.success) {
 success('Purchase Order Created & Budget Validated!');
 setIsNewPurchaseModalOpen(false);
 setNewOrderForm({
 invoice_no: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
 supplier_id: '',
 order_date: new Date().toISOString().split('T')[0],
 category_id: 'RAW_MATERIALS',
 priority: 'Standard',
 notes: ''
 });
 setNewOrderItems([{ product_id: '', quantity: 1, purchase_rate: 0, mrp: 0, gst_rate: 18, batch_no: '', expiry_date: '' }]);
 handleRefreshAll();
 } else {
 notifyError(response.error || 'Failed to create purchase order');
 }
 } catch (err: any) {
 notifyError(err.message || 'Server connection error');
 } finally {
 setIsCreating(false);
 }
 };

 const handleItemClick = async (item: any, type: typeof modalType) => {
 setSelectedItem(item);
 setEditForm({ ...item });
 setModalType(type);
 setEditItems([]); // Reset items
 
 if (type === 'PURCHASE') {
 const id = item.id || item.poId;
 try {
 const response = await apiClient.get(`/api/purchase/${id}`);
 if (response.success && response.data.items) {
 setEditItems(response.data.items);
 setEditForm(response.data); // Get full header info
 }
 } catch (err) {
 console.error('Failed to fetch PO items', err);
 }
 }
 
 setIsDetailModalOpen(true);
 };

 const handleUpdate = async () => {
 if (!selectedItem || !editForm) return;
 
 setIsUpdating(true);
 const id = selectedItem.id || selectedItem.poId || selectedItem.productId;
 
 try {
 let endpoint = '';
 let payload = { ...editForm };

 switch(modalType) {
 case 'PURCHASE': 
 endpoint = `/api/purchase/${id}`;
 payload = {
 invoice_no: editForm.invoice_no || null,
 supplier_id: editForm.supplier_id || null,
 order_date: editForm.order_date || null,
 expected_delivery_date: editForm.expected_delivery_date || null,
 payment_terms: editForm.payment_terms || null,
 delivery_mode: editForm.delivery_mode || null,
 notes: editForm.notes || null,
 status: editForm.status || null,
 items: editItems.map(item => ({
 ...item,
 product_id: item.product_id || null,
 batch_no: item.batch_no || null,
 expiry_date: item.expiry_date || null
 }))
 };
 break;
 case 'BUDGET': 
 endpoint = `/api/purchase/budgets/${id}`;
 break;
 case 'VENDOR':
 endpoint = `/api/purchase/vendor-ratings/${id}`;
 break;
 case 'MATCH':
 endpoint = `/api/purchase/3-way-match/${id}`;
 break;
 case 'APPROVAL':
 endpoint = `/api/purchase/approvals/${id}`;
 break;
 }

 if (endpoint) {
 const response = await apiClient.put(endpoint, payload);
 if (response.success) {
 success(`${modalType} Intelligence Updated Successfully!`);
 setIsDetailModalOpen(false);
 handleRefreshAll();
 } else {
 notifyError(`Update failed: ${response.error || 'Unknown error'}`);
 }
 } else {
 warning('Update logic for this intelligence type is being prioritized.');
 }
 } catch (err: any) {
 notifyError(`Update failed: ${err.message || 'Check database connectivity.'}`);
 } finally {
 setIsUpdating(false);
 }
 };

 const handleAddItem = (isNew = false) => {
 const newItem = { product_id: '', quantity: 1, purchase_rate: 0, mrp: 0, gst_rate: 18, batch_no: '', expiry_date: '' };
 if (isNew) {
 setNewOrderItems([...newOrderItems, newItem]);
 } else {
 setEditItems([...editItems, newItem]);
 }
 };

 const handleRemoveItem = (index: number, isNew = false) => {
 if (isNew) {
 setNewOrderItems(newOrderItems.filter((_, i) => i !== index));
 } else {
 setEditItems(editItems.filter((_, i) => i !== index));
 }
 };

 const handleItemChange = (index: number, field: string, value: any, isNew = false) => {
 if (isNew) {
 const newItems = [...newOrderItems];
 newItems[index] = { ...newItems[index], [field]: value };
 setNewOrderItems(newItems);
 } else {
 const newItems = [...editItems];
 newItems[index] = { ...newItems[index], [field]: value };
 setEditItems(newItems);
 }
 };

 const handleDelete = async () => {
 if (!selectedItem) return;
 if (!window.confirm(`⚠️ Are you sure you want to permanently delete this ${modalType} intelligence record? This action cannot be undone.`)) return;

 const id = selectedItem.id || selectedItem.poId || selectedItem.productId || selectedItem.supplier_id;
 if (!id) {
 notifyError('Cannot identify record ID for deletion.');
 return;
 }

 try {
 let endpoint = '';
 switch(modalType) {
 case 'PURCHASE': endpoint = `/api/purchase/${id}`; break;
 case 'MATCH': endpoint = `/api/purchase/3-way-match/${id}`; break;
 case 'VENDOR': endpoint = `/api/purchase/vendor-ratings/${id}`; break;
 case 'BUDGET': endpoint = `/api/purchase/budgets/${id}`; break;
 case 'APPROVAL': endpoint = `/api/purchase/approvals/${id}`; break;
 }

 if (endpoint) {
 const response = await apiClient.delete(endpoint);
 if (response.success) {
 success(`${modalType} record deleted from Intelligence Hub.`);
 setIsDetailModalOpen(false);
 handleRefreshAll();
 } else {
 notifyError(`Delete failed: ${response.error || 'Unknown error'}`);
 }
 } else {
 warning(`Deletion for ${modalType} is not supported directly.`);
 }
 } catch (err: any) {
 notifyError(`Deletion failed: ${err.message}`);
 }
 };

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('en-IN', {
 style: 'currency',
 currency: 'INR',
 maximumFractionDigits: 0
 }).format(amount);
 };

 // --- STATS CALCULATION ---
 const stats = useMemo(() => {
 const totalSpent = (purchases as any[] || []).reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
 const pendingApprovals = (approvals as any[] || []).length;
 const criticalReorders = (reorderAlerts as any[] || []).length;
 const mismatchCount = (matches as any[] || []).filter(m => m.status === 'Mismatch').length;
 const trend = poResponse?.trend || 0;

 return { totalSpent, pendingApprovals, criticalReorders, mismatchCount, trend };
 }, [purchases, reorderAlerts, matches, approvals, poResponse]);

 // Filtered purchases by search + status
 const filteredPurchases = useMemo(() => {
 let list = purchases as any[] || [];
 if (searchTerm) {
 const q = searchTerm.toLowerCase();
 list = list.filter((p: any) => 
 (p.invoice_no || '').toLowerCase().includes(q) || 
 (p.supplier_name || '').toLowerCase().includes(q)
 );
 }
 if (statusFilter !== 'All') {
 list = list.filter((p: any) => p.status === statusFilter);
 }
 return list;
 }, [purchases, searchTerm, statusFilter]);

 // Find relevant budget for current new order form
 const currentBudget = useMemo(() => {
 return (budgets as any[] || []).find(b => b.category_id === newOrderForm.category_id);
 }, [budgets, newOrderForm.category_id]);

 const handleCreateProduct = async (product: Partial<Product>) => {
 try {
 const response = await apiClient.post('/api/products', product);
 if (response.id) {
 success('New product created successfully');
 setIsNewProductModalOpen(false);
 refetchLists(); // Refresh the dropdown data
 } else {
 notifyError('Failed to create product');
 }
 } catch (err: any) {
 notifyError(`Error: ${err.message}`);
 }
 };

 const handleRefreshAll = () => {
 refetchPurchases();
 refetchMatches();
 refetchVendors();
 refetchReorder();
 refetchBudgets();
 refetchApprovals();
 };

 // --- DATABASE CONNECTION GUARD ---
 if (!dbStatus.connected) {
 return (
 <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-2xl mx-auto mt-8">
 <div className="flex gap-4">
 <AlertCircle className="w-7 h-7 text-red-600 flex-shrink-0" />
 <div>
 <h3 className="font-bold text-red-900 text-lg">⚠️ Database Connection Failed</h3>
 <p className="text-red-700 text-sm mt-1">{dbStatus.error || 'Unable to connect to database'}</p>
 <p className="text-red-600 text-xs mt-2">
 Ensure PostgreSQL is running and backend server is active on port 5005
 </p>
 <button
 onClick={recheckDb}
 className="mt-4 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-bold transition-all active:scale-95"
 >
 🔄 Retry Connection
 </button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <ERPLayout
 title="Purchase Intelligence Hub"
 description="Advanced Procurement, 3-Way Matching & Vendor Analytics"
 onRefresh={handleRefreshAll}
 onExport={() => {
 const csv = [
 ['Invoice No', 'Supplier', 'Order Date', 'Status', 'Total Amount'],
 ...(purchases as any[] || []).map((p: any) => [
 p.invoice_no, p.supplier_name, p.order_date, p.status, p.total_amount
 ])
 ].map(r => r.join(',')).join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = window.URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `purchase-intelligence-${new Date().toISOString().split('T')[0]}.csv`;
 a.click();
 }}
 onPrint={() => window.print()}
 isLoading={loadingPurchases}
 actionButtons={[
 {
 label: 'New Purchase Order',
 onClick: () => {
 setSelectedItem(null);
 setModalType('PURCHASE');
 setIsNewPurchaseModalOpen(true);
 },
 icon: <Plus size={18} />,
 variant: 'primary'
 }
 ]}
 >
 {/* TOP STATS ROW */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 <StatCard 
 label="Total Purchases" 
 value={formatCurrency(stats.totalSpent)} 
 color="blue" 
 icon={<FileText size={20}/>}
 trend={stats.trend ? `${Number(stats.trend) > 0 ? '+' : ''}${Number(stats.trend).toFixed(1)}%` : undefined}
 />
 <StatCard 
 label="Inventory Value" 
 value={formatCurrency(inventoryStats?.totalStockValue || 0)} 
 color="emerald" 
 icon={<Package size={20}/>}
 />
 <StatCard 
 label="Critical Reorders" 
 value={stats.criticalReorders} 
 color="rose" 
 icon={<AlertTriangle size={20}/>}
 onClick={() => setActiveTab('REORDER')}
 />
 <StatCard 
 label="Pending Approvals" 
 value={stats.pendingApprovals} 
 color="amber" 
 icon={<ShieldCheck size={20}/>}
 onClick={() => setActiveTab('APPROVALS')}
 />
 </div>


 {/* Main Feature Tabs */}
 <Tabs 
 tabs={[
 { id: 'PURCHASES', label: 'Purchases', badge: (purchases as any[] || []).length },
 { id: 'MATCHING', label: '3-Way Matching', badge: stats.mismatchCount },
 { id: 'VENDORS', label: 'Vendor Ratings' },
 { id: 'REORDER', label: 'Reorder Points', badge: stats.criticalReorders },
 { id: 'APPROVALS', label: 'Approvals', badge: stats.pendingApprovals },
 { id: 'BUDGET', label: 'Budget Control' }
 ]}
 activeTab={activeTab}
 onChange={setActiveTab}
 />

 {/* Tab Content */}
 <div className="animate-fadeIn">
 {activeTab === 'PURCHASES' && (
 <>
 <FilterBar
 searchPlaceholder="Search by Invoice No, Supplier Name..."
 searchValue={searchTerm}
 onSearchChange={setSearchTerm}
 onRefine={() => refetchPurchases()}
 filters={[
 {
 label: 'Status',
 value: statusFilter,
 onChange: setStatusFilter,
 options: [
 { value: 'All', label: 'All Orders' },
 { value: 'Draft', label: 'Draft' },
 { value: 'Ordered', label: 'Ordered' },
 { value: 'Received', label: 'Received' },
 { value: 'Partial', label: 'Partial' },
 { value: 'Cancelled', label: 'Cancelled' }
 ]
 }
 ]}
 />
 <DataTable 
 columns={[
 { 
 key: 'invoice_no', 
 label: 'Order No', 
 width: '15%',
 render: (v, row) => (
 <button 
 onClick={() => handleItemClick(row, 'PURCHASE')}
 className="text-accent font-bold hover:underline"
 >
 {v}
 </button>
 )
 },
 { key: 'supplier_name', label: 'Supplier', width: '25%' },
 { 
 key: 'order_date', 
 label: 'Order Date', 
 width: '15%',
 render: (v) => new Date(v).toLocaleDateString()
 },
 { 
 key: 'total_amount', 
 label: 'Total Value', 
 width: '15%', 
 align: 'right',
 render: (v) => <span className="font-bold text-slate-900">{formatCurrency(v)}</span>
 },
 { 
 key: 'status', 
 label: 'Status', 
 width: '15%', 
 align: 'center',
 render: (v) => (
 <Badge 
 text={v} 
 variant={v === 'Received' ? 'success' : v === 'Ordered' ? 'info' : v === 'Cancelled' ? 'danger' : 'warning'} 
 />
 )
 },
 {
 key: 'actions',
 label: 'Actions',
 width: '10%',
 align: 'center',
 render: (_, row) => (
 <div className="flex gap-2 justify-center">
 <button onClick={() => handleItemClick(row, 'PURCHASE')} className="p-2 text-accent hover:bg-blue-50 rounded-lg transition-all" title="View Details">
 <ArrowRight size={18} />
 </button>
 <button 
 onClick={(e) => { e.stopPropagation(); setSelectedItem(row); setModalType('PURCHASE'); handleDelete(); }}
 className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Delete"
 >
 <Trash2 size={18} />
 </button>
 </div>
 )
 }
 ]}
 data={filteredPurchases}
 loading={loadingPurchases}
 emptyMessage="No purchase orders found. Create your first PO using the button above."
 onRowClick={(row) => handleItemClick(row, 'PURCHASE')}
 />
 </>
 )}

 {activeTab === 'MATCHING' && (
 <DataTable 
 columns={[
 { 
 key: 'poNumber', 
 label: 'PO / GRN / Invoice', 
 width: '25%',
 render: (_, row: any) => (
 <button 
 onClick={() => handleItemClick(row, 'MATCH')}
 className="flex flex-col gap-1 text-left hover:bg-slate-50 p-1 rounded transition-all"
 >
 <div className="font-bold text-accent text-xs">PO: {row.poNumber}</div>
 <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">GRN: {row.grnNumber || 'PENDING'}</div>
 <div className="text-[10px] text-accent font-bold uppercase tracking-widest">INV: {row.invoiceNumber || 'PENDING'}</div>
 </button>
 )
 },
 { key: 'supplierName', label: 'Supplier', width: '20%' },
 { 
 key: 'poAmount', 
 label: 'PO Value', 
 width: '12%', 
 align: 'right',
 render: (v) => formatCurrency(v)
 },
 { 
 key: 'invoiceAmount', 
 label: 'Inv Value', 
 width: '12%', 
 align: 'right',
 render: (v) => v ? formatCurrency(v) : <span className="text-slate-300">N/A</span>
 },
 { 
 key: 'variance', 
 label: 'Variance', 
 width: '12%', 
 align: 'right',
 render: (v) => (
 <span className={`font-bold ${Number(v) !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
 {v > 0 ? '+' : ''}{formatCurrency(v)}
 </span>
 )
 },
 { 
 key: 'status', 
 label: 'Match Status', 
 width: '15%', 
 align: 'center',
 render: (v) => (
 <Badge 
 text={v} 
 variant={v === 'Matched' ? 'success' : v === 'Mismatch' ? 'danger' : 'warning'} 
 />
 )
 }
 ]}
 data={matches as any[] || []}
 loading={loadingMatches}
 onRowClick={(row) => handleItemClick(row, 'MATCH')}
 />
 )}

 {activeTab === 'VENDORS' && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {(vendorRatings as any[] || []).map((vendor: any) => (
 <div 
 key={vendor.supplier_id} 
 onClick={() => handleItemClick(vendor, 'VENDOR')}
 className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-all group cursor-pointer"
 >
 <div className="flex justify-between items-start mb-6">
 <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
 <Truck size={24} />
 </div>
 <div className="flex flex-col items-end">
 <div className="text-2xl font-bold text-slate-900">{Number(vendor.overall_rating || 0).toFixed(1)}</div>
 <div className="flex gap-0.5">
 {[1,2,3,4,5].map(s => (
 <Star key={s} size={12} className={s <= Math.round(Number(vendor.overall_rating || 0)) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'} />
 ))}
 </div>
 </div>
 </div>
 
 <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight mb-1">{vendor.supplierName}</h3>
 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Preferred Strategic Partner</p>
 
 <div className="space-y-4">
 <ScoreBar label="Quality" score={vendor.quality_score} color="emerald" />
 <ScoreBar label="Delivery" score={vendor.delivery_score} color="blue" />
 <ScoreBar label="Price" score={vendor.price_score} color="indigo" />
 </div>
 </div>
 ))}
 </div>
 )}

 {activeTab === 'REORDER' && (
 <DataTable 
 columns={[
 { 
 key: 'productName', 
 label: 'Product Intelligence', 
 width: '35%',
 render: (v, row) => (
 <button onClick={() => handleItemClick(row, 'REORDER')} className="text-accent font-bold hover:underline">
 {v}
 </button>
 )
 },
 { key: 'supplierName', label: 'Manufacturer / Vendor', width: '25%' },
 { 
 key: 'currentStock', 
 label: 'Stock Status', 
 width: '15%', 
 align: 'center',
 render: (v, row: any) => (
 <div className="flex flex-col items-center">
 <div className={`text-lg font-bold ${v <= row.reorderPoint ? 'text-rose-600' : 'text-slate-700'}`}>{v}</div>
 <div className="text-[9px] text-slate-400 font-bold uppercase">Min: {row.reorderPoint}</div>
 </div>
 )
 },
 { 
 key: 'status', 
 label: 'Risk level', 
 width: '15%', 
 align: 'center',
 render: (_, row: any) => (
 <Badge 
 text={row.currentStock <= row.reorderPoint ? 'Critical' : 'Low'} 
 variant={row.currentStock <= row.reorderPoint ? 'danger' : 'warning'} 
 />
 )
 },
 {
 key: 'actions',
 label: 'Automate',
 width: '10%',
 align: 'center',
 render: (v, row) => (
 <button 
 onClick={(e) => { e.stopPropagation(); handleItemClick(row, 'REORDER'); }}
 className="px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent shadow-none shadow-none active:scale-95 transition-all"
 >
 Generate PO
 </button>
 )
 }
 ]}
 data={reorderAlerts as any[] || []}
 loading={loadingReorder}
 onRowClick={(row) => handleItemClick(row, 'REORDER')}
 />
 )}

 {activeTab === 'APPROVALS' && (
 <DataTable 
 columns={[
 { 
 key: 'documentNo', 
 label: 'Document No', 
 width: '20%',
 render: (v, row) => (
 <button onClick={() => handleItemClick(row, 'APPROVAL')} className="text-accent font-bold hover:underline">
 {v}
 </button>
 )
 },
 { key: 'document_type', label: 'Type', width: '15%', align: 'center' },
 { key: 'requestedBy', label: 'Requested By', width: '20%' },
 { 
 key: 'amount', 
 label: 'Amount', 
 width: '15%', 
 align: 'right',
 render: (v) => formatCurrency(v)
 },
 { 
 key: 'current_level', 
 label: 'Level', 
 width: '10%', 
 align: 'center',
 render: (v, row: any) => `Level ${v} / ${row.total_levels}`
 },
 {
 key: 'actions',
 label: 'Actions',
 width: '20%',
 align: 'center',
 render: (_, row) => (
 <div className="flex gap-2 justify-center">
 <button onClick={(e) => { e.stopPropagation(); handleItemClick(row, 'APPROVAL'); }} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-700 transition-all">Approve</button>
 <button onClick={(e) => { e.stopPropagation(); handleItemClick(row, 'APPROVAL'); }} className="px-3 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-rose-700 transition-all">Reject</button>
 </div>
 )
 }
 ]}
 data={approvals as any[] || []}
 loading={loadingApprovals}
 onRowClick={(row) => handleItemClick(row, 'APPROVAL')}
 />
 )}

 {activeTab === 'BUDGET' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {(budgets as any[] || []).length === 0 && !loadingBudgets && (
 <div className="col-span-2 bg-amber-50/50 border border-amber-200 rounded-xl p-12 text-center">
 <DollarSign className="mx-auto mb-4 text-amber-400" size={48} />
 <h3 className="text-lg font-bold text-slate-700">No Budget Records Found</h3>
 <p className="text-sm text-slate-500 mt-2">Run the purchase seed script to populate budget categories.</p>
 <code className="mt-4 inline-block bg-slate-900 text-emerald-400 px-4 py-2 rounded-lg text-xs font-mono">
 node server/seed-advanced-purchase.js
 </code>
 </div>
 )}
 {(budgets as any[] || []).map((budget: any) => {
 const budgeted = Number(budget.budgeted_amount) || 0;
 const spent = Number(budget.spent_amount) || 0;
 const committed = Number(budget.committed_amount) || 0;
 const remaining = budgeted - spent - committed;
 const utilizationPct = budgeted > 0 ? Math.min(100, ((spent + committed) / budgeted) * 100) : 0;
 const spentPct = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;
 const committedPct = budgeted > 0 ? Math.min(100, (committed / budgeted) * 100) : 0;

 return (
 <div 
 key={budget.id} 
 onClick={() => handleItemClick(budget, 'BUDGET')}
 className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-none transition-all group"
 >
 {/* Budget status indicator bar */}
 <div className={`absolute top-0 left-0 right-0 h-1 ${
 budget.status === 'Under' ? 'bg-emerald-500' : budget.status === 'Near' ? 'bg-amber-500' : 'bg-rose-500'
 }`} />

 <div className="flex justify-between items-start mb-8">
 <div>
 <h3 className="text-xl font-bold text-slate-800 tracking-tight uppercase">{budget.category_id.replace(/_/g, ' ')}</h3>
 <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{budget.period_name}</p>
 </div>
 <Badge 
 text={budget.status} 
 variant={budget.status === 'Under' ? 'success' : budget.status === 'Near' ? 'warning' : 'danger'} 
 />
 </div>

 <div className="grid grid-cols-3 gap-6 mb-6">
 <div>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Budgeted</p>
 <p className="text-lg font-bold text-slate-900">{formatCurrency(budgeted)}</p>
 </div>
 <div>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Spent</p>
 <p className="text-lg font-bold text-rose-600">{formatCurrency(spent)}</p>
 </div>
 <div>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Committed</p>
 <p className="text-lg font-bold text-accent">{formatCurrency(committed)}</p>
 </div>
 </div>

 {/* Budget Utilization Progress Bar */}
 <div className="space-y-2">
 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
 <span className="text-slate-400">Utilization</span>
 <span className={utilizationPct > 90 ? 'text-rose-600' : utilizationPct > 70 ? 'text-amber-600' : 'text-emerald-600'}>
 {utilizationPct.toFixed(1)}%
 </span>
 </div>
 <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
 <div 
 className="h-full bg-rose-500 transition-all duration-1000" 
 style={{ width: `${spentPct}%` }}
 />
 <div 
 className="h-full bg-blue-400 transition-all duration-1000" 
 style={{ width: `${committedPct}%` }}
 />
 </div>
 <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400">
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Spent</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Committed</span>
 <span className="ml-auto font-bold text-slate-600">Remaining: {formatCurrency(remaining)}</span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Item Detail/Update Modal */}
 <Modal 
 isOpen={isDetailModalOpen} 
 onClose={() => setIsDetailModalOpen(false)}
 title={`Intelligence Detail: ${modalType}`}
 size="xl"
 >
 {editForm && (
 <div className="space-y-8">
 <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-8 shadow-inner">
 {Object.entries(editForm).map(([key, value]) => {
 // Filter technical/audit fields and complex objects
 const filteredKeys = [
 'id', 'poId', 'productId', 'supplier_id', 'items', 'item_count', 
 'total_amount', 'supplier_name', 'supplier_code', 'created_by', 
 'updated_by', 'created_at', 'updated_at', 'company_id', 'active',
 'city', 'code', 'name', 'type', 'gstin', 'mobile', 'email'
 ];
 if (filteredKeys.includes(key) || typeof value === 'object') return null;
 
 const isEditable = (modalType === 'PURCHASE' && ['status', 'notes', 'expected_delivery_date', 'invoice_no', 'order_date', 'payment_terms', 'delivery_mode'].includes(key)) ||
 (modalType === 'BUDGET' && ['budgeted_amount', 'spent_amount', 'committed_amount', 'status'].includes(key)) ||
 (modalType === 'VENDOR' && ['quality_score', 'delivery_score', 'price_score', 'service_score', 'overall_rating', 'on_time_delivery_rate'].includes(key)) ||
 (modalType === 'MATCH' && ['match_status', 'variance_amount', 'remarks'].includes(key)) ||
 (modalType === 'APPROVAL' && ['status', 'current_level'].includes(key));

 return (
 <div key={key}>
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{key.replace(/_/g, ' ')}</p>
 {isEditable ? (
 <input 
 type={key.includes('date') ? 'date' : typeof value === 'number' ? 'number' : 'text'}
 value={key.includes('date') && value ? new Date(value as string).toISOString().split('T')[0] : String(value || '')}
 onChange={(e) => setEditForm({ ...editForm, [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value })}
 className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-accent outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-accent transition-all"
 />
 ) : (
 <p className="text-sm font-bold text-slate-800 bg-white/50 px-4 py-2 rounded-xl border border-slate-100/50">{String(value)}</p>
 )}
 </div>
 );
 })}

 {/* Explicit Supplier Selection for Purchase orders */}
 {modalType === 'PURCHASE' && (
 <div key="supplier_select">
 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Strategic Supplier</p>
 <select 
 value={editForm.supplier_id || ''}
 onChange={(e) => setEditForm({ ...editForm, supplier_id: e.target.value })}
 className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-accent outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-accent transition-all"
 >
 <option value="">Select Partner...</option>
 {lists?.suppliers?.map((s: any) => (
 <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
 ))}
 </select>
 </div>
 )}
 </div>

 {modalType === 'PURCHASE' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Line Items Intelligence</h4>
 <div className="flex gap-2">
 <button 
 onClick={() => setIsNewProductModalOpen(true)}
 className="flex items-center gap-1 text-[10px] font-bold bg-emerald-600 text-white uppercase tracking-widest hover:bg-emerald-700 px-4 py-2 rounded-xl transition-all shadow-none shadow-emerald-200"
 >
 <Plus size={14} /> New Product
 </button>
 <button 
 onClick={() => handleAddItem(false)}
 className="flex items-center gap-1 text-[10px] font-bold bg-accent text-white uppercase tracking-widest hover:bg-accent px-4 py-2 rounded-xl transition-all shadow-none shadow-none"
 >
 <Plus size={14} /> Add Item
 </button>
 </div>
 </div>
 
 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <table className="min-w-full text-left whitespace-nowrap">
 <thead>
 <tr className="bg-slate-50 border-b border-slate-100">
 <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">Product</th>
 <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[80px] text-center">Qty</th>
 <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px] text-right">Rate</th>
 <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[80px] text-center">GST%</th>
 <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px]">Batch No</th>
 <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[130px]">Expiry</th>
 <th className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px] text-right">Total</th>
 <th className="px-6 py-4 w-10"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {editItems.map((item, idx) => (
 <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
 <td className="px-6 py-4">
 <select 
 value={item.product_id}
 onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
 className="w-full bg-transparent font-bold text-slate-700 outline-none text-sm"
 >
 <option value="">Select Product...</option>
 {lists?.products?.map((p: any) => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 </select>
 </td>
 <td className="px-4 py-4 text-center">
 <input 
 type="number"
 value={item.quantity}
 onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
 className="w-full text-center font-bold text-accent bg-blue-50/50 rounded-lg px-2 py-1 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
 />
 </td>
 <td className="px-4 py-4 text-right">
 <input 
 type="number"
 value={item.purchase_rate}
 onChange={(e) => handleItemChange(idx, 'purchase_rate', Number(e.target.value))}
 className="w-full text-right font-bold text-accent bg-blue-50/50 rounded-lg px-2 py-1 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
 />
 </td>
 <td className="px-4 py-4 text-center">
 <input 
 type="number"
 value={item.gst_rate}
 onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
 className="w-full text-center font-bold text-slate-500 bg-slate-50 rounded-lg px-2 py-1 outline-none"
 />
 </td>
 <td className="px-4 py-4">
 <input 
 type="text"
 value={item.batch_no || ''}
 placeholder="Batch"
 onChange={(e) => handleItemChange(idx, 'batch_no', e.target.value)}
 className="w-full text-xs font-bold text-slate-600 bg-slate-50 rounded-lg px-2 py-1 outline-none"
 />
 </td>
 <td className="px-4 py-4">
 <input 
 type="date"
 value={item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : ''}
 onChange={(e) => handleItemChange(idx, 'expiry_date', e.target.value)}
 className="w-full text-xs font-bold text-slate-600 bg-slate-50 rounded-lg px-2 py-1 outline-none"
 />
 </td>
 <td className="px-4 py-4 text-right font-bold text-slate-900 text-sm">
 {formatCurrency(item.quantity * item.purchase_rate * (1 + (item.gst_rate || 0)/100))}
 </td>
 <td className="px-6 py-4 text-right">
 <button onClick={() => handleRemoveItem(idx)} className="text-rose-300 hover:text-rose-600 transition-colors">
 <Trash2 size={16} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 <tfoot>
 <tr className="bg-slate-50/50">
 <td colSpan={6} className="px-6 py-6 text-right font-bold text-slate-400 uppercase tracking-widest">Strategic Total</td>
 <td className="px-4 py-6 text-right font-bold text-accent text-lg">
 {formatCurrency(editItems.reduce((sum, item) => sum + (item.quantity * item.purchase_rate * (1 + (item.gst_rate || 0)/100)), 0))}
 </td>
 <td></td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>
 )}

 <div className="flex justify-between items-center pt-8 border-t border-slate-100">
 <button 
 onClick={handleDelete}
 className="flex items-center gap-2 text-rose-600 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-xl transition-all"
 >
 <Trash2 size={16} /> Delete Record
 </button>
 <div className="flex gap-4">
 <button onClick={() => setIsDetailModalOpen(false)} className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Close</button>
 <button 
 onClick={handleUpdate}
 disabled={isUpdating}
 className={`px-12 py-4 bg-[#1D3557] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-2xl shadow-none hover:scale-105 active:scale-95 transition-all ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 {isUpdating ? 'Updating...' : 'Update Intelligence'}
 </button>
 </div>
 </div>
 </div>
 )}
 </Modal>

 {/* New Purchase Modal */}
 <Modal 
 isOpen={isNewPurchaseModalOpen} 
 onClose={() => setIsNewPurchaseModalOpen(false)}
 title="Intelligence-Driven Procurement"
 size="lg"
 >
 <div className="space-y-8">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="space-y-6">
 <div>
 <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Strategic Supplier</label>
 <select 
 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20"
 value={newOrderForm.supplier_id}
 onChange={(e) => setNewOrderForm({...newOrderForm, supplier_id: e.target.value})}
 >
 <option value="">Select Partner...</option>
 {lists?.suppliers?.map((s: any) => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Order Reference</label>
 <input 
 type="text" 
 value={newOrderForm.invoice_no}
 onChange={(e) => setNewOrderForm({...newOrderForm, invoice_no: e.target.value})}
 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm" 
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Priority</label>
 <select 
 className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700"
 value={newOrderForm.priority}
 onChange={(e) => setNewOrderForm({...newOrderForm, priority: e.target.value})}
 >
 <option>Standard</option>
 <option>Urgent</option>
 <option>Emergency</option>
 </select>
 </div>
 </div>
 </div>

 <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 space-y-4">
 <div className="flex items-center gap-3 text-blue-800 mb-2">
 <Target size={20} />
 <h4 className="font-bold uppercase tracking-tight">Budget Validation</h4>
 </div>
 <p className="text-xs text-accent leading-relaxed font-medium">
 System is automatically validating this order against the **{newOrderForm.category_id.replace('_', ' ')}** budget for **FY2024-Q1**. 
 </p>
 <div className="pt-4 border-t border-blue-100">
 <div className="flex justify-between text-[10px] font-bold text-blue-400 uppercase mb-2">
 <span>Remaining Budget</span>
 <span>{currentBudget ? formatCurrency(Number(currentBudget.budgeted_amount) - Number(currentBudget.spent_amount) - Number(currentBudget.committed_amount)) : 'N/A'}</span>
 </div>
 <div className="h-2 bg-white rounded-full overflow-hidden">
 <div 
 className="h-full bg-accent transition-all duration-1000" 
 style={{ width: currentBudget ? `${Math.min(100, (Number(currentBudget.spent_amount) + Number(currentBudget.committed_amount)) / Number(currentBudget.budgeted_amount) * 100)}%` : '0%' }}
 ></div>
 </div>
 </div>
 </div>
 </div>

 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Procurement Line Items</h4>
 <div className="flex gap-4 items-center">
 <select 
 className="bg-transparent border-none text-[10px] font-bold text-accent uppercase tracking-widest outline-none cursor-pointer"
 value={newOrderForm.category_id}
 onChange={(e) => setNewOrderForm({...newOrderForm, category_id: e.target.value})}
 >
 <option value="RAW_MATERIALS">Raw Materials</option>
 <option value="PACKAGING">Packaging</option>
 <option value="LAB_EQUIPMENT">Lab Equipment</option>
 </select>
 <button 
 onClick={() => setIsNewProductModalOpen(true)}
 className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all"
 >
 <Plus size={14} /> New Product
 </button>
 <button 
 onClick={() => handleAddItem(true)}
 className="flex items-center gap-1 text-[10px] font-bold text-accent uppercase tracking-widest hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
 >
 <Plus size={14} /> Add Line Item
 </button>
 </div>
 </div>
 
 <div className="overflow-x-auto">
 <table className="w-full text-left text-xs">
 <thead>
 <tr className="border-b border-slate-100">
 <th className="pb-2 font-bold text-slate-400 uppercase tracking-widest">Product Intelligence</th>
 <th className="pb-2 font-bold text-slate-400 uppercase tracking-widest w-16 text-center">Qty</th>
 <th className="pb-2 font-bold text-slate-400 uppercase tracking-widest w-32 text-right">Rate (₹)</th>
 <th className="pb-2 font-bold text-slate-400 uppercase tracking-widest w-32 text-right">Subtotal</th>
 <th className="pb-2 w-10"></th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {newOrderItems.map((item, idx) => (
 <tr key={idx}>
 <td className="py-2">
 <select 
 value={item.product_id}
 onChange={(e) => handleItemChange(idx, 'product_id', e.target.value, true)}
 className="w-full bg-transparent font-bold text-slate-700 outline-none"
 >
 <option value="">Select Product...</option>
 {lists?.products?.map((p: any) => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 </select>
 </td>
 <td className="py-2 text-center">
 <input 
 type="number"
 value={item.quantity}
 onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value), true)}
 className="w-16 text-center font-bold text-accent bg-blue-50 rounded px-1 outline-none"
 />
 </td>
 <td className="py-2 text-right">
 <input 
 type="number"
 value={item.purchase_rate}
 onChange={(e) => handleItemChange(idx, 'purchase_rate', Number(e.target.value), true)}
 className="w-24 text-right font-bold text-accent bg-blue-50 rounded px-1 outline-none"
 />
 </td>
 <td className="py-2 text-right font-bold text-slate-900">
 {formatCurrency(item.quantity * item.purchase_rate)}
 </td>
 <td className="py-2 text-right">
 <button 
 onClick={() => handleRemoveItem(idx, true)}
 className="text-rose-400 hover:text-rose-600"
 >
 <Trash2 size={14} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <div className="pt-8 border-t border-slate-100 flex justify-end gap-4">
 <button 
 onClick={() => setIsNewPurchaseModalOpen(false)}
 className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
 >
 Abort
 </button>
 <button 
 onClick={handleCreateOrder}
 disabled={isCreating}
 className={`px-8 py-3 bg-[#1D3557] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-none shadow-none hover:scale-105 active:scale-95 transition-all ${isCreating ? 'opacity-50' : ''}`}
 >
 {isCreating ? 'Validating...' : 'Initiate Approval Workflow'}
 </button>
 </div>
 </div>
 </Modal>

 {/* New Product Modal */}
 <Modal 
 isOpen={isNewProductModalOpen} 
 onClose={() => setIsNewProductModalOpen(false)}
 maxWidth="4xl"
 >
 <ProductForm 
 onSubmit={handleCreateProduct}
 onCancel={() => setIsNewProductModalOpen(false)}
 />
 </Modal>
 </ERPLayout>
 );
};

// --- HELPER COMPONENTS ---

const ScoreBar: React.FC<{ label: string; score: number | string; color: 'emerald' | 'blue' | 'indigo' }> = ({ label, score, color }) => {
 const colorMap = {
 emerald: 'bg-emerald-500',
 blue: 'bg-accent',
 indigo: 'bg-indigo-500'
 };

 return (
 <div className="space-y-1.5">
 <div className="flex justify-between items-center px-1">
 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
 <span className="text-[10px] font-bold text-slate-700">{Number(score || 0).toFixed(1)}/5.0</span>
 </div>
 <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
 <div 
 className={`h-full transition-all duration-1000 ${colorMap[color]}`}
 style={{ width: `${(Number(score || 0) / 5) * 100}%` }}
 />
 </div>
 </div>
 );
};

export default PurchaseEnhanced;


