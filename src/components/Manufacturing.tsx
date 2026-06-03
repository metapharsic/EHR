/**
 * REFACTORED MANUFACTURING COMPONENT
 * Uses ERPLayout + useDataFetch patterns
 * This provides consistent, professional manufacturing management
 */

import React, { useState, useMemo } from 'react';
import { 
 Factory, Layers, ClipboardList, Package, FlaskConical, PlayCircle, 
 CheckCircle, Clock, AlertTriangle, Plus, Edit, Trash2, Save, X, 
 Search, ArrowRight, AlertCircle 
} from 'lucide-react';
import { 
 ERPLayout, FilterBar, DataTable, StatCard, Tabs, Badge, Modal 
} from './UniversalLayout';
import { 
 useDataFetch, useDatabaseStatus, useSearch, usePagination 
} from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';
import { useNotificationSystem } from '../hooks/useNotifications';
import { RawMaterial, BillOfMaterial, ProductionOrder, Product } from '../types';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Manufacturing: React.FC = () => {
 const { status: dbStatus } = useDatabaseStatus();
 const { hasPermission } = useAuth();
 const notify = useNotificationSystem();
 const canManageManufacturing = hasPermission(['ADMIN', 'PRODUCTION_MANAGER']);

 // --- 1. DATA FETCHING ---
 const { data: productionOrders, loading: loadingOrders, refetch: refetchOrders } = useDataFetch<ProductionOrder[]>(
 '/api/manufacturing/production-orders'
 );
 const { data: boms, loading: loadingBoms, refetch: refetchBoms } = useDataFetch<BillOfMaterial[]>(
 '/api/manufacturing/boms'
 );
 const { data: rawMaterials, loading: loadingRM, refetch: refetchRM } = useDataFetch<RawMaterial[]>(
 '/api/manufacturing/raw-materials'
 );

 // --- 2. VIEW STATES ---
 const [activeTab, setActiveTab] = useState('PRODUCTION');
 const [searchTerm, setSearchTerm] = useState('');

 // --- 3. MODAL STATES ---
 const [showOrderModal, setShowOrderModal] = useState(false);
 const [showBomModal, setShowBomModal] = useState(false);
 const [showRmModal, setShowRmModal] = useState(false);
 const [selectedItem, setSelectedItem] = useState<any>(null);

 // --- 4. CALCULATED STATS ---
 const stats = useMemo(() => {
 return {
 activeOrders: productionOrders?.filter(o => o.status === 'In Process').length || 0,
 plannedOrders: productionOrders?.filter(o => o.status === 'Planned').length || 0,
 totalBoms: boms?.length || 0,
 lowStockRM: rawMaterials?.filter(rm => rm.currentStock <= rm.minStockLevel).length || 0
 };
 }, [productionOrders, boms, rawMaterials]);

 // --- 5. EVENT HANDLERS ---
 const handleRefresh = async () => {
 await Promise.all([refetchOrders(), refetchBoms(), refetchRM()]);
 notify.success('Manufacturing data refreshed');
 };

 const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
 switch(status) {
 case 'Completed': return 'success';
 case 'In Process': return 'info';
 case 'Planned': return 'warning';
 case 'QC Check': return 'warning';
 default: return 'info';
 }
 };

 // --- 6. DATABASE CONNECTION CHECK ---
 if (!dbStatus.connected) {
 return (
 <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
 <div className="flex gap-3">
 <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
 <div>
 <h3 className="font-semibold text-red-900">⚠️ Database Connection Failed</h3>
 <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
 <button
 onClick={handleRefresh}
 className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
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
 title="Manufacturing & Production"
 description="Manage Production Orders, Bill of Materials, and Raw Material Stock"
 onRefresh={handleRefresh}
 isLoading={loadingOrders || loadingBoms || loadingRM}
 actionButtons={
 canManageManufacturing && [
 { label: '➕ New Job Order', onClick: () => setShowOrderModal(true), icon: <Plus size={16}/> },
 { label: '📦 Create BOM', onClick: () => setShowBomModal(true), icon: <Plus size={16}/> },
 { label: '🧪 Add Material', onClick: () => setShowRmModal(true), icon: <Plus size={16}/> }
 ]
 }
 >
 {/* STATISTICS */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <StatCard label="Active Orders" value={stats.activeOrders} color="blue" icon={<PlayCircle size={20}/>} />
 <StatCard label="Planned Orders" value={stats.plannedOrders} color="warning" icon={<Clock size={20}/>} />
 <StatCard label="Total BOMs" value={stats.totalBoms} color="success" icon={<Layers size={20}/>} />
 <StatCard label="Low RM Stock" value={stats.lowStockRM} color="danger" icon={<AlertTriangle size={20}/>} />
 </div>

 {/* TABS */}
 <Tabs
 tabs={[
 { id: 'PRODUCTION', label: 'Production Orders', badge: productionOrders?.length },
 { id: 'BOM', label: 'Bill of Materials', badge: boms?.length },
 { id: 'RM', label: 'Raw Materials', badge: rawMaterials?.length }
 ]}
 activeTab={activeTab}
 onChange={setActiveTab}
 />

 {/* CONTENT: PRODUCTION ORDERS */}
 {activeTab === 'PRODUCTION' && (
 <DataTable
 columns={[
 { key: 'batchNumber', label: 'Batch No.', width: '15%' },
 { key: 'productName', label: 'Product', width: '25%' },
 { key: 'plannedQuantity', label: 'Planned Qty', width: '15%', align: 'right' },
 { key: 'startDate', label: 'Start Date', width: '15%' },
 { 
 key: 'status', 
 label: 'Status', 
 width: '15%', 
 render: (v) => <Badge text={v} variant={getStatusVariant(v)} /> 
 },
 { 
 key: 'actions', 
 label: 'Actions', 
 width: '15%', 
 render: (_, row) => (
 <button 
 onClick={() => { setSelectedItem(row); setShowOrderModal(true); }}
 className="text-accent hover:underline text-sm font-medium"
 >
 Edit
 </button>
 )
 }
 ]}
 data={productionOrders || []}
 loading={loadingOrders}
 emptyMessage="No production orders found"
 />
 )}

 {/* CONTENT: BOM */}
 {activeTab === 'BOM' && (
 <DataTable
 columns={[
 { key: 'productName', label: 'Product Name', width: '40%' },
 { key: 'batchSize', label: 'Std. Batch Size', width: '20%', align: 'right' },
 { 
 key: 'ingredients', 
 label: 'Ingredients', 
 width: '20%', 
 render: (v: any[]) => `${v?.length || 0} items` 
 },
 { 
 key: 'actions', 
 label: 'Actions', 
 width: '20%', 
 render: (_, row) => (
 <button 
 onClick={() => { setSelectedItem(row); setShowBomModal(true); }}
 className="text-accent hover:underline text-sm font-medium"
 >
 View BOM
 </button>
 )
 }
 ]}
 data={boms || []}
 loading={loadingBoms}
 emptyMessage="No BOM configurations found"
 />
 )}

 {/* CONTENT: RAW MATERIALS */}
 {activeTab === 'RM' && (
 <DataTable
 columns={[
 { key: 'name', label: 'Material Name', width: '30%' },
 { key: 'casNumber', label: 'CAS No.', width: '20%' },
 { key: 'currentStock', label: 'Stock', width: '15%', align: 'right' },
 { key: 'uom', label: 'UOM', width: '10%' },
 { 
 key: 'status', 
 label: 'Status', 
 width: '15%',
 render: (_, row: any) => (
 <Badge 
 text={row.currentStock <= row.minStockLevel ? 'LOW STOCK' : 'OK'} 
 variant={row.currentStock <= row.minStockLevel ? 'danger' : 'success'} 
 />
 )
 },
 { 
 key: 'actions', 
 label: 'Actions', 
 width: '10%', 
 render: (_, row) => (
 <button 
 onClick={() => { setSelectedItem(row); setShowRmModal(true); }}
 className="text-accent hover:underline text-sm font-medium"
 >
 Edit
 </button>
 )
 }
 ]}
 data={rawMaterials || []}
 loading={loadingRM}
 emptyMessage="No raw materials found"
 />
 )}

 {/* MODALS (Simplified for now - can be expanded with forms) */}
 {(showOrderModal || showBomModal || showRmModal) && (
 <Modal
 title={
 showOrderModal ? 'Production Order' : 
 showBomModal ? 'Bill of Materials' : 
 'Raw Material Master'
 }
 onClose={() => {
 setShowOrderModal(false);
 setShowBomModal(false);
 setShowRmModal(false);
 setSelectedItem(null);
 }}
 size="lg"
 >
 <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
 <Factory className="mx-auto mb-4 opacity-20" size={48}/>
 <p className="font-bold text-slate-700">Detailed Forms Integration</p>
 <p className="text-sm mt-2">Connecting real database forms in Phase 2 Expansion</p>
 <button 
 onClick={() => {
 setShowOrderModal(false);
 setShowBomModal(false);
 setShowRmModal(false);
 }}
 className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
 >
 Close
 </button>
 </div>
 </Modal>
 )}
 </ERPLayout>
 );
};

export default Manufacturing;

