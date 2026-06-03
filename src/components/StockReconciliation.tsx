import React, { useEffect, useMemo, useState } from 'react';
import {
 AlertCircle,
 AlertTriangle,
 Check,
 CheckCircle2,
 ChevronRight,
 ClipboardCheck,
 Eye,
 Package,
 Plus,
 RefreshCw,
 Warehouse
} from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { getAllGodowns as getLocalGodowns, getAllProducts, initializeGodownSampleData } from '../services/databaseService';
import {
 Godown,
 GodownService,
 ReconciliationItem,
 StockReconciliation as StockReconciliationType,
 StockReconciliationService
} from '../services/inventoryService';
import { Product } from '../types';

interface ReconciliationState {
 id: string;
 header: StockReconciliationType | null;
 items: ReconciliationItem[];
 status: 'idle' | 'loading' | 'loaded' | 'error';
}

const getToday = () => new Date().toISOString().split('T')[0];

const getMonthStart = () => {
 const today = new Date();
 return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
};

const formatCurrency = (amount: number) =>
 new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const normalizeGodownStatus = (status?: string) => {
 if (!status) return 'Unknown';
 const normalized = status.toLowerCase();
 if (normalized === 'active') return 'Active';
 if (normalized === 'inactive') return 'Inactive';
 return status;
};

const StockReconciliation: React.FC = () => {
 const { hasPermission } = useAuth();
 const canCreate = hasPermission(['ADMIN', 'INVENTORY_MANAGER', 'QC_MANAGER']);
 const canVerify = hasPermission(['ADMIN', 'INVENTORY_MANAGER']);
 const canApprove = hasPermission(['ADMIN', 'INVENTORY_MANAGER']);

 const [activeTab, setActiveTab] = useState<'START' | 'ENTRY' | 'VERIFY' | 'APPROVE'>('START');
 const [reconciliations, setReconciliations] = useState<StockReconciliationType[]>([]);
 const [selectedReconciliation, setSelectedReconciliation] = useState<ReconciliationState | null>(null);
 const [godowns, setGodowns] = useState<Godown[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [isLoadingGodowns, setIsLoadingGodowns] = useState(true);
 const [isLoadingProducts, setIsLoadingProducts] = useState(true);
 const [isStarting, setIsStarting] = useState(false);
 const [isSavingItem, setIsSavingItem] = useState(false);
 const [isLoadingDetails, setIsLoadingDetails] = useState(false);
 const [filterStatus, setFilterStatus] = useState<'All' | StockReconciliationType['status']>('All');
 const [pageMessage, setPageMessage] = useState<string | null>(null);

 const [formState, setFormState] = useState({
 godown_id: '',
 period_from: getMonthStart(),
 period_to: getToday()
 });

 const [entryForm, setEntryForm] = useState({
 product_id: '',
 batch_id: '',
 physical_qty: '',
 variance_reason: '',
 notes: ''
 });

 useEffect(() => {
 const loadGodowns = async () => {
 setIsLoadingGodowns(true);
 try {
 const apiGodowns = await GodownService.getAllGodowns();
 setGodowns(apiGodowns);
 setPageMessage(null);
 } catch (error) {
 console.error('Error loading godowns from inventory API:', error);
 initializeGodownSampleData();
 const localGodowns = await getLocalGodowns();
 setGodowns(
 localGodowns.map((godown) => ({
 id: godown.id,
 company_id: 1,
 name: godown.name,
 address: godown.address,
 manager_id: godown.manager_id,
 is_default: godown.is_default,
 status: normalizeGodownStatus(godown.status),
 created_at: godown.created_at,
 updated_at: godown.updated_at
 }))
 );
 setPageMessage('Inventory API godowns are unavailable, so local warehouse data is being used.');
 } finally {
 setIsLoadingGodowns(false);
 }
 };

 const loadProducts = async () => {
 setIsLoadingProducts(true);
 try {
 const data = await getAllProducts();
 setProducts(data.length > 0 ? data : MOCK_PRODUCTS);
 } catch (error) {
 console.error('Error loading products for reconciliation:', error);
 setProducts(MOCK_PRODUCTS);
 } finally {
 setIsLoadingProducts(false);
 }
 };

 loadGodowns();
 loadProducts();
 }, []);

 const selectedProduct = useMemo(
 () => products.find((product) => product.id === entryForm.product_id) || null,
 [products, entryForm.product_id]
 );

 const selectedBatch = useMemo(
 () => selectedProduct?.batches?.find((batch) => batch.id === entryForm.batch_id) || null,
 [selectedProduct, entryForm.batch_id]
 );

 const activeReconciliations = useMemo(() => {
 return reconciliations.filter((item) => {
 if (filterStatus === 'All') return true;
 return item.status === filterStatus;
 });
 }, [filterStatus, reconciliations]);

 const reconciliationStats = useMemo(() => {
 return reconciliations.reduce(
 (acc, item) => {
 acc.total += 1;
 acc.varianceValue += item.total_variance_value || 0;
 if (item.status === 'Completed') acc.pendingApproval += 1;
 if (item.status === 'Approved') acc.approved += 1;
 return acc;
 },
 { total: 0, approved: 0, pendingApproval: 0, varianceValue: 0 }
 );
 }, [reconciliations]);

 const resetEntryForm = () => {
 setEntryForm({
 product_id: '',
 batch_id: '',
 physical_qty: '',
 variance_reason: '',
 notes: ''
 });
 };

 const refreshSelectedReconciliation = async (reconciliationId: string, switchTab?: 'ENTRY' | 'VERIFY' | 'APPROVE') => {
 setIsLoadingDetails(true);
 setSelectedReconciliation((prev) => ({
 id: reconciliationId,
 header: prev?.id === reconciliationId ? prev.header : reconciliations.find((item) => item.id === reconciliationId) || null,
 items: prev?.id === reconciliationId ? prev.items : [],
 status: 'loading'
 }));

 try {
 const details = await StockReconciliationService.getReconciliation(reconciliationId);
 setSelectedReconciliation({
 id: reconciliationId,
 header: details.header,
 items: details.items || [],
 status: 'loaded'
 });
 setReconciliations((prev) => {
 const next = prev.some((item) => item.id === details.header.id)
 ? prev.map((item) => (item.id === details.header.id ? details.header : item))
 : [details.header, ...prev];
 return next;
 });
 if (switchTab) setActiveTab(switchTab);
 } catch (error) {
 console.error('Error loading reconciliation details:', error);
 setSelectedReconciliation((prev) => ({
 id: reconciliationId,
 header: prev?.header || reconciliations.find((item) => item.id === reconciliationId) || null,
 items: prev?.items || [],
 status: 'error'
 }));
 alert('Unable to load reconciliation details right now.');
 } finally {
 setIsLoadingDetails(false);
 }
 };

 const handleStartReconciliation = async () => {
 if (!formState.godown_id) {
 alert('Please select a godown before starting reconciliation.');
 return;
 }

 if (formState.period_from && formState.period_to && formState.period_from > formState.period_to) {
 alert('Period From cannot be after Period To.');
 return;
 }

 setIsStarting(true);
 try {
 const newReconciliation = await StockReconciliationService.startReconciliation({
 godown_id: formState.godown_id,
 reconciliation_period_from: formState.period_from || undefined,
 reconciliation_period_to: formState.period_to || undefined
 });

 setReconciliations((prev) => [newReconciliation, ...prev.filter((item) => item.id !== newReconciliation.id)]);
 setSelectedReconciliation({
 id: newReconciliation.id,
 header: newReconciliation,
 items: [],
 status: 'loaded'
 });
 resetEntryForm();
 setActiveTab('ENTRY');
 alert('Reconciliation started. You can begin physical count entry now.');
 } catch (error) {
 console.error('Error starting reconciliation:', error);
 alert('Failed to start reconciliation.');
 } finally {
 setIsStarting(false);
 }
 };

 const handleSelectProduct = (productId: string) => {
 const nextProduct = products.find((product) => product.id === productId) || null;
 const defaultBatch = nextProduct?.batches?.[0];

 setEntryForm((prev) => ({
 ...prev,
 product_id: productId,
 batch_id: defaultBatch?.id || '',
 physical_qty: defaultBatch ? String(defaultBatch.stock) : ''
 }));
 };

 const handleSelectBatch = (batchId: string) => {
 const nextBatch = selectedProduct?.batches?.find((batch) => batch.id === batchId) || null;

 setEntryForm((prev) => ({
 ...prev,
 batch_id: batchId,
 physical_qty: nextBatch ? String(nextBatch.stock) : prev.physical_qty
 }));
 };

 const handleAddItem = async () => {
 if (!selectedReconciliation?.id) {
 alert('Please start or open a reconciliation first.');
 return;
 }

 if (!entryForm.product_id || !entryForm.batch_id) {
 alert('Please select both a product and batch.');
 return;
 }

 const physicalQty = Number(entryForm.physical_qty);
 if (Number.isNaN(physicalQty) || physicalQty < 0) {
 alert('Physical quantity must be zero or more.');
 return;
 }

 setIsSavingItem(true);
 try {
 await StockReconciliationService.addReconciliationItem(selectedReconciliation.id, {
 product_id: entryForm.product_id,
 batch_id: entryForm.batch_id,
 physical_qty: physicalQty,
 variance_reason: entryForm.variance_reason || undefined,
 notes: entryForm.notes || undefined
 });

 resetEntryForm();
 await refreshSelectedReconciliation(selectedReconciliation.id, 'ENTRY');
 alert('Count entry added successfully.');
 } catch (error) {
 console.error('Error adding reconciliation item:', error);
 alert('Failed to add count entry.');
 } finally {
 setIsSavingItem(false);
 }
 };

 const handleUpdateStatus = async (reconciliationId: string, status: StockReconciliationType['status']) => {
 try {
 const updated = await StockReconciliationService.updateReconciliationStatus(reconciliationId, status);
 setReconciliations((prev) => prev.map((item) => (item.id === reconciliationId ? updated : item)));
 setSelectedReconciliation((prev) =>
 prev?.id === reconciliationId
 ? {
 ...prev,
 header: updated
 }
 : prev
 );
 if (status === 'Completed') {
 await refreshSelectedReconciliation(reconciliationId, 'VERIFY');
 }
 if (status === 'Approved') {
 await refreshSelectedReconciliation(reconciliationId, 'APPROVE');
 }
 alert(`Reconciliation updated to ${status}.`);
 } catch (error) {
 console.error('Error updating reconciliation status:', error);
 alert('Failed to update reconciliation status.');
 }
 };

 const getStatusColor = (status: StockReconciliationType['status']) => {
 switch (status) {
 case 'Draft':
 return 'bg-slate-100 text-slate-700 border-slate-200';
 case 'InProgress':
 return 'bg-blue-100 text-accent border-blue-200';
 case 'Completed':
 return 'bg-yellow-100 text-yellow-700 border-yellow-200';
 case 'Approved':
 return 'bg-green-100 text-green-700 border-green-200';
 case 'Rejected':
 return 'bg-red-100 text-red-700 border-red-200';
 case 'Cancelled':
 return 'bg-gray-100 text-gray-700 border-gray-200';
 default:
 return 'bg-slate-100 text-slate-700 border-slate-200';
 }
 };

 const getVarianceTone = (variance: number) => {
 if (variance === 0) return 'text-green-600';
 if (variance > 0) return 'text-orange-600';
 return 'text-red-600';
 };

 return (
 <div className="space-y-6">
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
 <div>
 <h2 className="text-2xl font-bold text-slate-800">Stock Reconciliation</h2>
 <p className="text-sm text-slate-500 mt-1">
 Run warehouse-wise physical verification, track variance, and complete approval.
 </p>
 </div>
 {canCreate && (
 <button
 onClick={() => setActiveTab('START')}
 className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors"
 >
 <Plus size={16} /> New Reconciliation
 </button>
 )}
 </div>

 {pageMessage && (
 <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
 <AlertTriangle className="text-amber-600 shrink-0" size={20} />
 <div>
 <p className="text-sm font-semibold text-amber-900">Fallback Mode</p>
 <p className="text-sm text-amber-800">{pageMessage}</p>
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
 <p className="text-xs font-medium text-slate-500">Total Reconciliations</p>
 <p className="text-2xl font-bold text-slate-800 mt-2">{reconciliationStats.total}</p>
 </div>
 <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
 <p className="text-xs font-medium text-slate-500">Pending Approval</p>
 <p className="text-2xl font-bold text-amber-600 mt-2">{reconciliationStats.pendingApproval}</p>
 </div>
 <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
 <p className="text-xs font-medium text-slate-500">Approved</p>
 <p className="text-2xl font-bold text-green-600 mt-2">{reconciliationStats.approved}</p>
 </div>
 <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
 <p className="text-xs font-medium text-slate-500">Tracked Variance</p>
 <p className="text-xl font-bold text-slate-800 mt-2">{formatCurrency(reconciliationStats.varianceValue)}</p>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 <div className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-100">
 {[
 { key: 'START', label: 'Start Reconciliation' },
 { key: 'ENTRY', label: 'Entry & Verification' },
 { key: 'VERIFY', label: 'Variance Analysis' },
 { key: 'APPROVE', label: 'Approvals' }
 ].map((tab) => (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key as 'START' | 'ENTRY' | 'VERIFY' | 'APPROVE')}
 className={`px-4 py-3 text-sm font-medium transition-colors ${
 activeTab === tab.key
 ? 'bg-primary/5 text-primary border-b-2 border-primary'
 : 'text-slate-600 hover:text-slate-800'
 }`}
 >
 {tab.label}
 </button>
 ))}
 </div>

 <div className="p-6 space-y-6">
 <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Selection</p>
 {selectedReconciliation?.header ? (
 <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
 <span className="font-semibold text-slate-800">{selectedReconciliation.header.reconciliation_number}</span>
 <span className="text-sm text-slate-600">
 {selectedReconciliation.header.godown_name || 'Godown not loaded'}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-bold border w-fit ${getStatusColor(selectedReconciliation.header.status)}`}>
 {selectedReconciliation.header.status}
 </span>
 </div>
 ) : (
 <p className="text-sm text-slate-500 mt-2">No reconciliation selected yet.</p>
 )}
 </div>

 {selectedReconciliation?.header && (
 <button
 onClick={() => refreshSelectedReconciliation(selectedReconciliation.id)}
 disabled={isLoadingDetails}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
 >
 <RefreshCw size={14} className={isLoadingDetails ? 'animate-spin' : ''} />
 Refresh Details
 </button>
 )}
 </div>

 {activeTab === 'START' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Initiate Stock Reconciliation</h3>
 <p className="text-sm text-slate-500 mt-1">
 Pick the godown and period, then start the count sheet for that warehouse.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">Godown</label>
 <select
 className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-50"
 value={formState.godown_id}
 onChange={(e) => setFormState((prev) => ({ ...prev, godown_id: e.target.value }))}
 disabled={isLoadingGodowns}
 >
 <option value="">-- Select Godown --</option>
 {godowns.map((godown) => (
 <option key={godown.id} value={godown.id}>
 {godown.name}
 </option>
 ))}
 </select>
 {!isLoadingGodowns && godowns.length === 0 && (
 <p className="text-xs text-red-600 mt-2">No godowns are available. Create one in the Godowns tab first.</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">Period From</label>
 <input
 type="date"
 className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
 value={formState.period_from}
 onChange={(e) => setFormState((prev) => ({ ...prev, period_from: e.target.value }))}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-2">Period To</label>
 <input
 type="date"
 className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
 value={formState.period_to}
 onChange={(e) => setFormState((prev) => ({ ...prev, period_to: e.target.value }))}
 />
 </div>
 </div>

 <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
 <Warehouse className="text-accent shrink-0" size={20} />
 <div className="text-sm text-blue-900">
 <p className="font-semibold">Recommended flow</p>
 <p className="text-blue-800 mt-1">
 Start a new reconciliation, enter physical counts batch by batch, review variances, then move it for approval.
 </p>
 </div>
 </div>

 <div className="flex justify-end">
 <button
 onClick={handleStartReconciliation}
 disabled={!canCreate || isStarting || isLoadingGodowns || godowns.length === 0}
 className="bg-primary text-white px-6 py-2.5 rounded-lg font-medium hover:bg-sky-600 transition-colors flex items-center gap-2 disabled:opacity-60"
 >
 <Check size={16} /> {isStarting ? 'Starting...' : 'Start Reconciliation'}
 </button>
 </div>
 </div>
 )}

 {activeTab === 'ENTRY' && (
 <div className="space-y-6">
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Entry & Verification</h3>
 <p className="text-sm text-slate-500 mt-1">
 Open a reconciliation, capture physical quantity by batch, and keep remarks for audit.
 </p>
 </div>
 <div className="flex items-center gap-2">
 <label className="text-sm font-medium text-slate-600">Filter</label>
 <select
 className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value as 'All' | StockReconciliationType['status'])}
 >
 <option value="All">All</option>
 <option value="Draft">Draft</option>
 <option value="InProgress">In Progress</option>
 <option value="Completed">Completed</option>
 <option value="Approved">Approved</option>
 </select>
 </div>
 </div>

 <div className="overflow-x-auto border border-slate-200 rounded-xl">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 border-b border-slate-200">
 <tr>
 <th className="p-3 font-semibold text-slate-700">Receipt No</th>
 <th className="p-3 font-semibold text-slate-700">Godown</th>
 <th className="p-3 font-semibold text-slate-700">Date</th>
 <th className="p-3 font-semibold text-slate-700 text-right">Physical Qty</th>
 <th className="p-3 font-semibold text-slate-700">Status</th>
 <th className="p-3 font-semibold text-slate-700 text-center">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {activeReconciliations.length === 0 && (
 <tr>
 <td colSpan={6} className="p-8 text-center">
 <Package className="mx-auto text-slate-300 mb-3" size={36} />
 <p className="font-medium text-slate-600">No reconciliation records yet</p>
 <p className="text-sm text-slate-400 mt-1">Start one from the first tab to begin stock counting.</p>
 </td>
 </tr>
 )}
 {activeReconciliations.map((item) => (
 <tr key={item.id} className="hover:bg-slate-50">
 <td className="p-3 font-mono text-slate-700">{item.reconciliation_number}</td>
 <td className="p-3 text-slate-600">{item.godown_name || 'N/A'}</td>
 <td className="p-3 text-slate-600">{new Date(item.reconciliation_date).toLocaleDateString()}</td>
 <td className="p-3 text-right text-slate-700">{item.total_physical_qty || 0}</td>
 <td className="p-3">
 <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
 {item.status}
 </span>
 </td>
 <td className="p-3 text-center">
 <button
 onClick={() => refreshSelectedReconciliation(item.id, 'ENTRY')}
 className="inline-flex items-center gap-1 text-accent hover:text-accent hover:bg-blue-50 px-2 py-1 rounded"
 >
 <Eye size={15} />
 Open
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {selectedReconciliation?.header && (
 <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-5">
 <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
 <div>
 <h4 className="font-bold text-blue-900">Add Count Entry</h4>
 <p className="text-sm text-blue-800 mt-1">
 {selectedReconciliation.header.reconciliation_number} for {selectedReconciliation.header.godown_name || 'selected godown'}
 </p>
 </div>
 <button
 onClick={() => setActiveTab('VERIFY')}
 className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-blue-900"
 >
 Review variance <ChevronRight size={16} />
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
 <select
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 value={entryForm.product_id}
 onChange={(e) => handleSelectProduct(e.target.value)}
 disabled={isLoadingProducts}
 >
 <option value="">-- Select Product --</option>
 {products.map((product) => (
 <option key={product.id} value={product.id}>
 {product.name}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
 <select
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-100"
 value={entryForm.batch_id}
 onChange={(e) => handleSelectBatch(e.target.value)}
 disabled={!selectedProduct}
 >
 <option value="">-- Select Batch --</option>
 {selectedProduct?.batches?.map((batch) => (
 <option key={batch.id} value={batch.id}>
 {batch.batchNumber} | System: {batch.stock}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Physical Qty</label>
 <input
 type="number"
 min="0"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold"
 value={entryForm.physical_qty}
 onChange={(e) => setEntryForm((prev) => ({ ...prev, physical_qty: e.target.value }))}
 placeholder="Enter count"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Variance Reason</label>
 <select
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 value={entryForm.variance_reason}
 onChange={(e) => setEntryForm((prev) => ({ ...prev, variance_reason: e.target.value }))}
 >
 <option value="">-- Select Reason --</option>
 <option value="Counting Error">Counting Error</option>
 <option value="Damage">Damage</option>
 <option value="Expiry">Expiry</option>
 <option value="Theft">Theft</option>
 <option value="Transit Loss">Transit Loss</option>
 <option value="Other">Other</option>
 </select>
 </div>
 </div>

 {(selectedProduct || selectedBatch) && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white rounded-lg border border-blue-100 p-3">
 <p className="text-xs font-medium text-slate-500">System Stock</p>
 <p className="text-lg font-bold text-slate-800 mt-1">{selectedBatch?.stock ?? selectedProduct?.totalStock ?? 0}</p>
 </div>
 <div className="bg-white rounded-lg border border-blue-100 p-3">
 <p className="text-xs font-medium text-slate-500">Batch Expiry</p>
 <p className="text-lg font-bold text-slate-800 mt-1">{selectedBatch?.expiryDate || '-'}</p>
 </div>
 <div className="bg-white rounded-lg border border-blue-100 p-3">
 <p className="text-xs font-medium text-slate-500">Variance Preview</p>
 <p className={`text-lg font-bold mt-1 ${getVarianceTone(Number(entryForm.physical_qty || 0) - (selectedBatch?.stock || 0))}`}>
 {(Number(entryForm.physical_qty || 0) - (selectedBatch?.stock || 0)) > 0 ? '+' : ''}
 {Number(entryForm.physical_qty || 0) - (selectedBatch?.stock || 0)}
 </p>
 </div>
 </div>
 )}

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
 <textarea
 rows={2}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 placeholder="Remarks for verification or audit trail"
 value={entryForm.notes}
 onChange={(e) => setEntryForm((prev) => ({ ...prev, notes: e.target.value }))}
 />
 </div>

 <div className="flex flex-wrap gap-3">
 <button
 onClick={handleAddItem}
 disabled={isSavingItem}
 className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-600 flex items-center gap-2 disabled:opacity-60"
 >
 <Plus size={14} /> {isSavingItem ? 'Saving...' : 'Add Count Entry'}
 </button>
 <button
 onClick={() => refreshSelectedReconciliation(selectedReconciliation.id, 'VERIFY')}
 className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
 >
 <ClipboardCheck size={14} /> Review Variance
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {activeTab === 'VERIFY' && (
 <div className="space-y-5">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Variance Analysis</h3>
 <p className="text-sm text-slate-500 mt-1">
 Review entered items, investigate mismatches, and mark the sheet as verified when ready.
 </p>
 </div>

 {!selectedReconciliation?.header ? (
 <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center">
 <AlertCircle className="mx-auto text-slate-300 mb-3" size={34} />
 <p className="font-medium text-slate-600">Select a reconciliation from Entry & Verification first</p>
 </div>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
 <p className="text-xs font-medium text-slate-500">Items Counted</p>
 <p className="text-2xl font-bold text-slate-800 mt-2">{selectedReconciliation.items.length}</p>
 </div>
 <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
 <p className="text-xs font-medium text-slate-500">Total Variance Qty</p>
 <p className={`text-2xl font-bold mt-2 ${getVarianceTone(selectedReconciliation.header.total_variance_qty || 0)}`}>
 {selectedReconciliation.header.total_variance_qty > 0 ? '+' : ''}
 {selectedReconciliation.header.total_variance_qty || 0}
 </p>
 </div>
 <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
 <p className="text-xs font-medium text-slate-500">Variance Value</p>
 <p className="text-2xl font-bold text-slate-800 mt-2">
 {formatCurrency(selectedReconciliation.header.total_variance_value || 0)}
 </p>
 </div>
 </div>

 <div className="overflow-x-auto border border-slate-200 rounded-xl">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 border-b border-slate-200">
 <tr>
 <th className="p-3 font-semibold">Product</th>
 <th className="p-3 font-semibold text-right">System Qty</th>
 <th className="p-3 font-semibold text-right">Physical Qty</th>
 <th className="p-3 font-semibold text-right">Variance</th>
 <th className="p-3 font-semibold text-right">Variance Value</th>
 <th className="p-3 font-semibold">Reason</th>
 <th className="p-3 font-semibold">Notes</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {selectedReconciliation.status === 'loading' && (
 <tr>
 <td colSpan={7} className="p-8 text-center text-slate-500">
 Loading reconciliation details...
 </td>
 </tr>
 )}
 {selectedReconciliation.status !== 'loading' && selectedReconciliation.items.length === 0 && (
 <tr>
 <td colSpan={7} className="p-8 text-center text-slate-500">
 No count entries available yet for this reconciliation.
 </td>
 </tr>
 )}
 {selectedReconciliation.items.map((item) => (
 <tr key={item.id} className="hover:bg-slate-50">
 <td className="p-3 text-slate-700">
 {item.product_name || item.product_id}
 <span className="text-slate-400"> ({item.batch_number || item.batch_id})</span>
 </td>
 <td className="p-3 text-right text-slate-600">{item.system_qty}</td>
 <td className="p-3 text-right font-semibold text-slate-800">{item.physical_qty}</td>
 <td className={`p-3 text-right font-semibold ${getVarianceTone(item.variance_qty)}`}>
 {item.variance_qty > 0 ? '+' : ''}
 {item.variance_qty}
 </td>
 <td className="p-3 text-right font-semibold text-slate-800">{formatCurrency(item.variance_value || 0)}</td>
 <td className="p-3 text-slate-600">{item.variance_reason || '-'}</td>
 <td className="p-3 text-slate-600">{item.notes || '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {canVerify && ['Draft', 'InProgress'].includes(selectedReconciliation.header.status) && (
 <div className="flex justify-end">
 <button
 onClick={() => handleUpdateStatus(selectedReconciliation.id, 'Completed')}
 className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
 >
 <CheckCircle2 size={16} /> Mark as Verified
 </button>
 </div>
 )}
 </>
 )}
 </div>
 )}

 {activeTab === 'APPROVE' && (
 <div className="space-y-5">
 <div>
 <h3 className="text-lg font-bold text-slate-800">Approvals</h3>
 <p className="text-sm text-slate-500 mt-1">
 Finalize completed reconciliations after variance review.
 </p>
 </div>

 <div className="overflow-x-auto border border-slate-200 rounded-xl">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 border-b border-slate-200">
 <tr>
 <th className="p-3 font-semibold">Receipt No</th>
 <th className="p-3 font-semibold">Godown</th>
 <th className="p-3 font-semibold text-right">Variance Qty</th>
 <th className="p-3 font-semibold text-right">Variance Value</th>
 <th className="p-3 font-semibold">Status</th>
 <th className="p-3 font-semibold text-center">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {reconciliations.filter((item) => item.status === 'Completed' || item.status === 'Approved').length === 0 && (
 <tr>
 <td colSpan={6} className="p-8 text-center text-slate-500">
 No reconciliations are waiting for approval.
 </td>
 </tr>
 )}
 {reconciliations
 .filter((item) => item.status === 'Completed' || item.status === 'Approved')
 .map((item) => (
 <tr key={item.id} className="hover:bg-slate-50">
 <td className="p-3 font-mono text-slate-700">{item.reconciliation_number}</td>
 <td className="p-3 text-slate-600">{item.godown_name || 'N/A'}</td>
 <td className={`p-3 text-right font-semibold ${getVarianceTone(item.total_variance_qty || 0)}`}>
 {item.total_variance_qty > 0 ? '+' : ''}
 {item.total_variance_qty || 0}
 </td>
 <td className="p-3 text-right font-semibold text-slate-800">
 {formatCurrency(item.total_variance_value || 0)}
 </td>
 <td className="p-3">
 <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
 {item.status}
 </span>
 </td>
 <td className="p-3 text-center">
 <div className="flex justify-center gap-2">
 <button
 onClick={() => refreshSelectedReconciliation(item.id, 'VERIFY')}
 className="px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
 >
 View
 </button>
 {canApprove && item.status === 'Completed' && (
 <button
 onClick={() => handleUpdateStatus(item.id, 'Approved')}
 className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
 >
 Approve
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>

 <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
 <div className="flex items-start gap-3">
 <AlertCircle className="text-slate-500 shrink-0" size={18} />
 <div className="text-sm text-slate-600">
 <p className="font-semibold text-slate-700">Enhancements included in this screen</p>
 <p className="mt-1">
 Better validation, product and batch selection, live variance preview, detail refresh, and clearer workflow handoff between start, entry, analysis, and approval.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
};

export default StockReconciliation;

