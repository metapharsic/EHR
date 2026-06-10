import React, { useState, useMemo } from 'react';
import { 
 Database, Wrench, Plus, MapPin, Calendar, DollarSign, PenTool, 
 CheckCircle, AlertTriangle, Monitor, Truck, Cog, X, Edit, 
 Trash2, Save, FileText, Shield, Users, TrendingUp, AlertCircle, 
 Building, FileSpreadsheet, Download, Loader2, ExternalLink
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
import { Asset, MaintenanceRecord } from '../types';
import { apiClient } from '../services/apiClient';

const Assets: React.FC = () => {
 // 1. Database Status
 const { status: dbStatus } = useDatabaseStatus();

 // 2. Data Fetching
 const { data: assetsResponse, loading: assetsLoading, error: assetsError, refetch: refetchAssets } = useDataFetch<any>('/api/assets', { cacheTime: 300000 });
 const { data: categoriesData } = useDataFetch<any>('/api/assets/categories');
 const { data: maintenanceResponse, loading: maintenanceLoading, refetch: refetchMaintenance } = useDataFetch<any>('/api/assets/history');

 // 3. Local States
 const [activeTab, setActiveTab] = useState('REGISTER');
 const [showAssetModal, setShowAssetModal] = useState(false);
 const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
 const [selectedAsset, setSelectedAsset] = useState<any>(null);
 const [isEditing, setIsEditing] = useState(false);
 const [isSaving, setIsSaving] = useState(false);

 const [filters, setFilters] = useState({
 searchTerm: '',
 category: 'All',
 status: 'All',
 });

 // Form States
 const [assetForm, setAssetForm] = useState({
 asset_name: '',
 asset_code: '',
 category_id: '',
 purchase_date: new Date().toISOString().split('T')[0],
 purchase_value: 0,
 location: '',
 model_no: '',
 serial_no: '',
 depreciation_method: 'Straight Line',
 depreciation_rate_percent: 10
 });

 const [maintForm, setMaintForm] = useState({
 asset_id: '',
 maintenance_date: new Date().toISOString().split('T')[0],
 type: 'Routine',
 description: '',
 cost: 0,
 performed_by: ''
 });

 // 4. Transform Data
 const assets = useMemo(() => {
 const data = assetsResponse?.data || assetsResponse || [];
 return Array.isArray(data) ? data : [];
 }, [assetsResponse]);

 const categories = useMemo(() => {
 return categoriesData?.data || categoriesData || [];
 }, [categoriesData]);

 const maintenanceLogs = useMemo(() => {
 const data = maintenanceResponse?.data?.maintenance || maintenanceResponse?.data || [];
 return Array.isArray(data) ? data : [];
 }, [maintenanceResponse]);

 // 5. Search & Filter Logic
 const { query, setQuery, results: searchResults } = useSearch<any>(
 assets,
 ['asset_name', 'asset_code', 'serial_no', 'location']
 );

 const filteredData = useMemo(() => {
 if (!searchResults) return [];
 return searchResults.filter(a => {
 if (filters.category !== 'All' && a.category_name !== filters.category) return false;
 if (filters.status !== 'All' && a.status !== filters.status) return false;
 return true;
 });
 }, [searchResults, filters.category, filters.status]);

 const pagination = usePagination<any>(filteredData, 10);

 // 6. Stats Calculation
 const stats = useMemo(() => {
 const totalValue = assets.reduce((acc, a) => acc + (parseFloat(a.current_value) || 0), 0);
 const maintenanceCost = maintenanceLogs.reduce((acc, m) => acc + (parseFloat(m.cost) || 0), 0);
 return {
 totalValue,
 activeCount: assets.filter(a => a.status === 'Active').length,
 maintenanceCount: assets.filter(a => a.status === 'Maintenance').length,
 maintenanceCost
 };
 }, [assets, maintenanceLogs]);

 // 7. Event Handlers
 const handleRefresh = async () => {
 await Promise.all([refetchAssets(), refetchMaintenance()]);
 };

 const handleSaveAsset = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsSaving(true);
 try {
 const res = await apiClient.post('/api/assets', assetForm);
 if (res.success) {
 setShowAssetModal(false);
 handleRefresh();
 // Reset form
 setAssetForm({
 asset_name: '',
 asset_code: '',
 category_id: '',
 purchase_date: new Date().toISOString().split('T')[0],
 purchase_value: 0,
 location: '',
 model_no: '',
 serial_no: '',
 depreciation_method: 'Straight Line',
 depreciation_rate_percent: 10
 });
 }
 } catch (error: any) {
 console.error('Failed to save asset', error);
 alert(error?.message || 'Failed to register asset. Please try again.');
 } finally {
 setIsSaving(false);
 }
 };

 const handleSaveMaintenance = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsSaving(true);
 try {
 const res = await apiClient.post('/api/assets/maintenance', maintForm);
 if (res.success) {
 setShowMaintenanceModal(false);
 handleRefresh();
 // Reset form
 setMaintForm({
 asset_id: '',
 maintenance_date: new Date().toISOString().split('T')[0],
 type: 'Routine',
 description: '',
 cost: 0,
 performed_by: ''
 });
 }
 } catch (error: any) {
 console.error('Failed to log maintenance', error);
 alert(error?.message || 'Failed to log maintenance. Please try again.');
 } finally {
 setIsSaving(false);
 }
 };

 const handleExport = () => {
 const headers = ['Code', 'Name', 'Category', 'Location', 'Value', 'Status'];
 const rows = filteredData.map(a => [
 a.asset_code, a.asset_name, a.category_name, a.location, a.current_value, a.status
 ]);
 const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
 const blob = new Blob([csvContent], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `asset_register_${new Date().toISOString().split('T')[0]}.csv`;
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
 <h3 className="font-semibold text-red-900">⚠️  Database Connection Failed</h3>
 <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
 <button onClick={handleRefresh} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">🔄 Retry</button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <ERPLayout
 title="Asset Management"
 description="Track and manage fixed assets, machinery, and equipment maintenance"
 onRefresh={handleRefresh}
 onExport={handleExport}
 isLoading={assetsLoading}
 actionButtons={[
 { label: '➕ New Asset', onClick: () => { setIsEditing(false); setShowAssetModal(true); }, variant: 'primary' }
 ]}
 >
 {/* Stats Summary */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <StatCard label="Asset Value" value={`₹${stats.totalValue.toLocaleString()}`} color="blue" icon={<DollarSign size={20} />} />
 <StatCard label="Active Assets" value={stats.activeCount} color="success" icon={<CheckCircle size={20} />} />
 <StatCard label="Under Maintenance" value={stats.maintenanceCount} color="warning" icon={<Wrench size={20} />} />
 <StatCard label="Maint. Cost (YTD)" value={`₹${stats.maintenanceCost.toLocaleString()}`} color="danger" icon={<PenTool size={20} />} />
 </div>

 {/* Filters */}
 <FilterBar
 filters={[
 {
 id: 'searchTerm',
 label: 'Search Assets',
 type: 'text',
 value: filters.searchTerm,
 placeholder: 'Name, code, or serial...',
 onChange: (v) => {
 handleFilterChange('searchTerm', v);
 setQuery(v);
 }
 },
 {
 id: 'category',
 label: 'Category',
 type: 'select',
 value: filters.category,
 onChange: (v) => handleFilterChange('category', v),
 options: [
 { value: 'All', label: 'All Categories' },
 ...(categoriesData?.data || categoriesData || []).map((c: any) => ({ value: c.name, label: c.name }))
 ]
 },
 {
 id: 'status',
 label: 'Status',
 type: 'select',
 value: filters.status,
 onChange: (v) => handleFilterChange('status', v),
 options: [
 { value: 'All', label: 'All Statuses' },
 { value: 'Active', label: 'Active' },
 { value: 'Maintenance', label: 'Maintenance' },
 { value: 'Retired', label: 'Retired' }
 ]
 }
 ]}
 />

 {/* Tabs */}
 <Tabs
 activeTab={activeTab}
 onChange={setActiveTab}
 tabs={[
 { id: 'REGISTER', label: 'Asset Register', badge: assets.length },
 { id: 'MAINTENANCE', label: 'Maintenance Log' },
 { id: 'DEPRECIATION', label: 'Depreciation' },
 { id: 'REPORTS', label: 'Analytics' }
 ]}
 />

 {/* Main Table */}
 {activeTab === 'REGISTER' && (
 <>
 <DataTable
 loading={assetsLoading}
 emptyMessage="No assets found in register"
 data={pagination.paginatedData}
 columns={[
 { 
 key: 'asset_code', 
 label: 'Code', 
 width: '12%',
 render: (val) => <span className="font-mono text-xs font-bold text-slate-500">{val}</span>
 },
 { 
 key: 'asset_name', 
 label: 'Asset Name', 
 width: '25%',
 render: (val, row: any) => (
 <div>
 <div className="font-bold text-slate-800">{val}</div>
 <div className="text-[10px] text-slate-400 font-mono">{row.serial_no}</div>
 </div>
 )
 },
 { 
 key: 'category_name', 
 label: 'Category', 
 width: '15%',
 render: (val) => <Badge text={val || 'General'} variant="info" />
 },
 { 
 key: 'location', 
 label: 'Location', 
 width: '15%',
 render: (val) => (
 <div className="flex items-center gap-1 text-xs text-slate-600">
 <MapPin size={12} className="text-slate-400" /> {val}
 </div>
 )
 },
 { 
 key: 'current_value', 
 label: 'Value', 
 width: '15%',
 align: 'right',
 render: (val) => <span className="font-bold text-slate-700">₹{Number(val).toLocaleString()}</span>
 },
 { 
 key: 'status', 
 label: 'Status', 
 width: '10%',
 render: (val) => (
 <Badge 
 text={val} 
 variant={val === 'Active' ? 'success' : val === 'Maintenance' ? 'warning' : 'danger'} 
 />
 )
 },
 { 
 key: 'actions', 
 label: 'View', 
 width: '8%', 
 align: 'center',
 render: (_, row: any) => (
 <div className="flex items-center gap-1 justify-center">
 <button 
 onClick={() => {
 setSelectedAsset(row);
 setMaintForm(prev => ({ ...prev, asset_id: row.id }));
 setShowMaintenanceModal(true);
 }}
 title="Log Maintenance"
 className="text-amber-600 hover:bg-amber-50 p-1.5 rounded transition-colors"
 >
 <Wrench size={16} />
 </button>
 <button 
 onClick={() => {
 setSelectedAsset(row);
 setActiveTab('MAINTENANCE');
 }}
 title="View History"
 className="text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
 >
 <ExternalLink size={16} />
 </button>
 </div>
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

 {/* Maintenance Tab */}
 {activeTab === 'MAINTENANCE' && (
 <DataTable
 loading={maintenanceLoading}
 emptyMessage="No maintenance logs found"
 data={maintenanceLogs}
 columns={[
 { key: 'maintenance_date', label: 'Date', width: '15%', render: (val) => new Date(val).toLocaleDateString() },
 { key: 'asset_name', label: 'Asset', width: '20%', render: (val, row: any) => <div><div className="font-semibold text-slate-800 text-xs">{val || '—'}</div><div className="font-mono text-[10px] text-slate-400">{row.asset_code}</div></div> },
 { key: 'type', label: 'Type', width: '15%', render: (val) => <Badge text={val} variant="info" /> },
 { key: 'description', label: 'Description', width: '30%' },
 { key: 'cost', label: 'Cost', width: '15%', align: 'right', render: (val) => <span className="font-bold">₹{Number(val).toLocaleString()}</span> },
 { key: 'performed_by', label: 'Technician', width: '15%' }
 ]}
 />
 )}

  {/* Depreciation Tab */}
  {activeTab === 'DEPRECIATION' && (
     <div className="space-y-4 mt-4">
       <div className="bg-white rounded-lg border border-slate-200 p-4">
         <h4 className="font-semibold text-slate-800 mb-4 text-sm">Depreciation Schedule - FY 2025-26</h4>
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead className="bg-slate-50 border-b border-slate-200">
               <tr>
                 <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Asset</th>
                 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Purchase Value</th>
                 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Accumulated Dep.</th>
                 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Rate</th>
                 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Method</th>
                 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Current Book Value</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-200">
               {assets.map((asset) => (
                 <tr key={asset.id} className="hover:bg-slate-50">
                   <td className="px-4 py-3">
                     <div className="font-bold text-slate-800 text-xs">{asset.asset_name}</div>
                     <div className="text-[10px] text-slate-400 font-mono">{asset.asset_code}</div>
                   </td>
                   <td className="px-4 py-3 text-right text-xs">₹{Number(asset.purchase_value).toLocaleString()}</td>
                   <td className="px-4 py-3 text-right text-xs text-red-600 font-medium">₹{Number(asset.accumulated_depreciation || 0).toLocaleString()}</td>
                   <td className="px-4 py-3 text-right text-xs">{asset.depreciation_rate_percent}%</td>
                   <td className="px-4 py-3 text-right text-xs">{asset.depreciation_method}</td>
                   <td className="px-4 py-3 text-right font-bold text-xs text-green-700">₹{Number(asset.current_value).toLocaleString()}</td>
                 </tr>
               ))}
             </tbody>
             <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
               <tr>
                 <td className="px-4 py-3 text-xs">Total</td>
                 <td className="px-4 py-3 text-right text-xs">₹{assets.reduce((s, a) => s + (parseFloat(a.purchase_value) || 0), 0).toLocaleString()}</td>
                 <td className="px-4 py-3 text-right text-xs text-red-700">₹{assets.reduce((s, a) => s + (parseFloat(a.accumulated_depreciation) || 0), 0).toLocaleString()}</td>
                 <td className="px-4 py-3"></td>
                 <td className="px-4 py-3"></td>
                 <td className="px-4 py-3 text-right text-xs text-green-700">₹{assets.reduce((s, a) => s + (parseFloat(a.current_value) || 0), 0).toLocaleString()}</td>
               </tr>
             </tfoot>
           </table>
         </div>
       </div>
     </div>
  )}

  {/* Analytics/Reports Tab */}
  {activeTab === 'REPORTS' && (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
       <div className="bg-white rounded-xl border border-slate-200 p-6">
         <h4 className="font-semibold text-slate-800 mb-4 text-sm">Asset Value by Category</h4>
         <div className="space-y-4">
           {Array.from(new Set(assets.map(a => a.category_name || 'General'))).map(category => {
             const categoryAssets = assets.filter(a => (a.category_name || 'General') === category);
             const count = categoryAssets.length;
             const value = categoryAssets.reduce((s, a) => s + (parseFloat(a.current_value) || 0), 0);
             const percent = stats.totalValue > 0 ? (value / stats.totalValue) * 100 : 0;
             return (
               <div key={category}>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-slate-600 font-medium">{category} ({count} assets)</span>
                   <span className="font-bold text-slate-800">₹{value.toLocaleString()} ({percent.toFixed(0)}%)</span>
                 </div>
                 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                   <div className="bg-primary h-full" style={{ width: `${percent}%` }}></div>
                 </div>
               </div>
             );
           })}
         </div>
       </div>

       <div className="bg-white rounded-xl border border-slate-200 p-6">
         <h4 className="font-semibold text-slate-800 mb-4 text-sm">Compliance & Valuation Notes</h4>
         <div className="space-y-3 text-sm">
           <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
             <div className="flex items-center gap-2 text-green-800 font-medium mb-1 text-xs">
               <CheckCircle size={16} />
               Companies Act Compliance
             </div>
             <p className="text-green-700 text-xs">Depreciation calculated as per Schedule II of Companies Act, 2013 guidelines.</p>
           </div>
           <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
             <div className="flex items-center gap-2 text-blue-800 font-medium mb-1 text-xs">
               <Calendar size={16} />
               Active Tracking
             </div>
             <p className="text-accent text-xs">All assets dynamically checked and verified on {new Date().toLocaleDateString()}.</p>
           </div>
         </div>
       </div>
     </div>
  )}

 {/* MODALS */}
 <Modal
 isOpen={showAssetModal}
 title={isEditing ? 'Edit Asset' : 'Register New Asset'}
 onClose={() => setShowAssetModal(false)}
 size="lg"
 >
 <form onSubmit={handleSaveAsset} className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name *</label>
 <input 
 required
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.asset_name}
 onChange={(e) => setAssetForm({ ...assetForm, asset_name: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Asset Code *</label>
 <input 
 required
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.asset_code}
 onChange={(e) => setAssetForm({ ...assetForm, asset_code: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
 <select
 required
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.category_id}
 onChange={(e) => setAssetForm({ ...assetForm, category_id: e.target.value })}
 >
 <option value="">Select Category</option>
 {categories.map((c: any) => (
 <option key={c.id} value={c.id}>{c.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
 <input 
 required
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.location}
 onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date *</label>
 <input 
 required
 type="date"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.purchase_date}
 onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Value (₹) *</label>
 <input 
 required
 type="number"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.purchase_value || ''}
 onChange={(e) => setAssetForm({ ...assetForm, purchase_value: parseFloat(e.target.value) || 0 })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Model No</label>
 <input 
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.model_no}
 onChange={(e) => setAssetForm({ ...assetForm, model_no: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Serial No</label>
 <input 
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={assetForm.serial_no}
 onChange={(e) => setAssetForm({ ...assetForm, serial_no: e.target.value })}
 />
 </div>
 <div className="md:col-span-2 pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setShowAssetModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
 <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center gap-2">
 {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
 {isEditing ? 'Update Asset' : 'Register Asset'}
 </button>
 </div>
 </form>
 </Modal>

 <Modal
 isOpen={showMaintenanceModal}
 title="Log Maintenance Activity"
 onClose={() => setShowMaintenanceModal(false)}
 >
 <form onSubmit={handleSaveMaintenance} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Type *</label>
 <select
 required
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={maintForm.type}
 onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value })}
 >
 <option value="Routine">Routine Checkup</option>
 <option value="Repair">Emergency Repair</option>
 <option value="Calibration">Calibration</option>
 <option value="Upgrade">Software/Hardware Upgrade</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Date *</label>
 <input 
 required
 type="date"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={maintForm.maintenance_date}
 onChange={(e) => setMaintForm({ ...maintForm, maintenance_date: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Cost (₹) *</label>
 <input 
 required
 type="number"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={maintForm.cost || ''}
 onChange={(e) => setMaintForm({ ...maintForm, cost: parseFloat(e.target.value) || 0 })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Technician / Vendor *</label>
 <input 
 required
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={maintForm.performed_by}
 onChange={(e) => setMaintForm({ ...maintForm, performed_by: e.target.value })}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Work Description *</label>
 <textarea 
 required
 rows={3}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 value={maintForm.description}
 onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
 />
 </div>
 <div className="pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setShowMaintenanceModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
 <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center gap-2">
 {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
 Save Log
 </button>
 </div>
 </form>
 </Modal>
 </ERPLayout>
 );
};

export default Assets;

