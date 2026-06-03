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

const Assets: React.FC = () => {
 // 1. Database Status
 const { status: dbStatus } = useDatabaseStatus();

 // 2. Data Fetching
 const { data: assetsResponse, loading: assetsLoading, error: assetsError, refetch: refetchAssets } = useDataFetch<any>('/api/assets', { cacheTime: 300000 });
 const { data: categoriesData } = useDataFetch<any>('/api/assets/categories');
 const { data: maintenanceResponse, loading: maintenanceLoading } = useDataFetch<any>('/api/assets/history');

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

 // 4. Transform Data
 const assets = useMemo(() => {
 const data = assetsResponse?.data || assetsResponse || [];
 return Array.isArray(data) ? data : [];
 }, [assetsResponse]);

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
 await Promise.all([refetchAssets()]);
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
 ...(categoriesData?.data || []).map((c: any) => ({ value: c.name, label: c.name }))
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
 <button 
 onClick={() => {
 setSelectedAsset(row);
 setActiveTab('MAINTENANCE');
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

 {/* Maintenance Tab */}
 {activeTab === 'MAINTENANCE' && (
 <DataTable
 loading={maintenanceLoading}
 emptyMessage="No maintenance logs found"
 data={maintenanceLogs}
 columns={[
 { key: 'maintenance_date', label: 'Date', width: '15%', render: (val) => new Date(val).toLocaleDateString() },
 { key: 'asset_id', label: 'Asset ID', width: '20%', render: (val) => <span className="font-mono text-xs">{val}</span> },
 { key: 'type', label: 'Type', width: '15%', render: (val) => <Badge text={val} variant="info" /> },
 { key: 'description', label: 'Description', width: '30%' },
 { key: 'cost', label: 'Cost', width: '15%', align: 'right', render: (val) => <span className="font-bold">₹{Number(val).toLocaleString()}</span> },
 { key: 'performed_by', label: 'Technician', width: '15%' }
 ]}
 />
 )}

 {/* Placeholder for other tabs */}
 {['DEPRECIATION', 'REPORTS'].includes(activeTab) && (
 <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
 <TrendingUp size={48} className="text-slate-300 mx-auto mb-4" />
 <h3 className="font-bold text-slate-700 text-lg">Asset Intelligence</h3>
 <p className="text-slate-500 max-w-sm mx-auto mt-2">Comprehensive reports and value analysis coming with the next update.</p>
 </div>
 )}
 </ERPLayout>
 );
};

export default Assets;

