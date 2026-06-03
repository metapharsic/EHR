import React, { useState, useMemo } from 'react';
import { 
 Microscope, FlaskConical, ClipboardList, Beaker, Plus, CheckCircle, 
 AlertTriangle, PlayCircle, Clock, X, Save, Trash2, DollarSign, RefreshCw
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

const RnD: React.FC = () => {
 const { status: dbStatus } = useDatabaseStatus();
 const { hasPermission } = useAuth();
 
 // ============================================================
 // DATA FETCHING
 // ============================================================
 const { data: formulationsData, loading: loadingFormulations, refetch: refetchFormulations } = useDataFetch<any[]>('/api/rnd/formulations');
 const { data: experimentsData, loading: loadingExperiments, refetch: refetchExperiments } = useDataFetch<any[]>('/api/rnd/experiments');

 const formulations = formulationsData || [];
 const experiments = experimentsData || [];

 // ============================================================
 // VIEW STATES
 // ============================================================
 const [activeTab, setActiveTab] = useState('PIPELINE');
 const [showAddModal, setShowAddModal] = useState(false);
 
 // Search
 const { query: searchTerm, setQuery: setSearchTerm, results: filteredFormulations } = useSearch<any>(
 formulations,
 ['product_name', 'dosage_form']
 );

 const { currentPage, totalPages, paginatedData, goToPage, hasNextPage, hasPrevPage } = usePagination(filteredFormulations, 9);

 // ============================================================
 // EVENT HANDLERS
 // ============================================================
 const handleRefresh = () => {
 refetchFormulations();
 refetchExperiments();
 };

 const getStageVariant = (stage: string) => {
 switch(stage) {
 case 'Ideation': return 'neutral';
 case 'Lab Scale': return 'primary';
 case 'Pilot': return 'warning';
 case 'Stability': return 'warning';
 case 'Ready for Mfg': return 'success';
 default: return 'neutral';
 }
 };

 const getExperimentStatusVariant = (status: string) => {
 switch(status) {
 case 'Completed': return 'success';
 case 'Failed': return 'danger';
 case 'In Progress': return 'primary';
 default: return 'neutral';
 }
 };

 if (!dbStatus.connected) {
 return (
 <div className="p-12 text-center">
 <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
 <h2 className="text-2xl font-bold text-slate-800">Database Connection Required</h2>
 <p className="text-slate-500 max-w-md mx-auto mt-2">RnD module requires active database connection to manage formulations and experiments.</p>
 <button onClick={handleRefresh} className="mt-6 px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors">
 Retry Connection
 </button>
 </div>
 );
 }

 return (
 <ERPLayout
 title="R&D / Formulation Lab"
 description="New Product Development • Recipe Management • Lab Experiments"
 actionButtons={[
 { label: 'Refresh', onClick: handleRefresh, icon: <RefreshCw size={16}/> },
 { label: 'New Formulation', onClick: () => setShowAddModal(true), variant: 'primary', icon: <Plus size={16}/> }
 ]}
 >
 {/* Stats Section */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <StatCard 
 title="Active Projects" 
 value={formulations.filter(f => f.stage !== 'Ready for Mfg').length} 
 icon={<Microscope size={20}/>} 
 color="purple" 
 />
 <StatCard 
 title="Pending Experiments" 
 value={experiments.filter(e => e.status === 'Scheduled' || e.status === 'In Progress').length} 
 icon={<FlaskConical size={20}/>} 
 color="blue" 
 />
 <StatCard 
 title="Formulations Ready" 
 value={formulations.filter(f => f.stage === 'Ready for Mfg').length} 
 icon={<CheckCircle size={20}/>} 
 color="success" 
 />
 </div>

 <Tabs 
 activeTab={activeTab} 
 onChange={setActiveTab}
 tabs={[
 { id: 'PIPELINE', label: 'Formulation Pipeline', badge: formulations.length },
 { id: 'EXPERIMENTS', label: 'Lab Experiments', badge: experiments.length }
 ]}
 />

 {activeTab === 'PIPELINE' && (
 <div className="space-y-6 mt-6">
 <FilterBar 
 searchValue={searchTerm}
 onSearchChange={setSearchTerm}
 searchPlaceholder="Search formulations..."
 />

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {paginatedData.map((f: any) => (
 <div key={f.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-none transition-shadow group">
 <div className="flex justify-between items-start mb-3">
 <div className="p-2 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-blue-50 group-hover:text-primary transition-colors">
 <Beaker size={20} />
 </div>
 <Badge text={f.stage} variant={getStageVariant(f.stage)} />
 </div>
 
 <h3 className="text-lg font-bold text-slate-800 mb-1">{f.product_name}</h3>
 <p className="text-sm text-slate-500 mb-4">{f.dosage_form} • v{f.version}</p>

 <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
 <div className="flex justify-between">
 <span>Start Date</span>
 <span className="font-medium">{new Date(f.start_date).toLocaleDateString()}</span>
 </div>
 <div className="flex justify-between">
 <span>Target Cost</span>
 <span className="font-bold text-green-600">₹{Number(f.target_cost).toFixed(4)}</span>
 </div>
 </div>
 </div>
 ))}

 <div 
 onClick={() => setShowAddModal(true)}
 className="bg-slate-50 rounded-xl border border-slate-300 border-dashed p-5 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-100 hover:border-primary/50 hover:text-primary transition-all cursor-pointer min-h-[180px]"
 >
 <Plus size={32} className="mb-2 opacity-50" />
 <p className="font-medium">New Project</p>
 </div>
 </div>
 
 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex justify-center gap-2 mt-4">
 <button disabled={!hasPrevPage} onClick={() => goToPage(currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
 <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
 <button disabled={!hasNextPage} onClick={() => goToPage(currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
 </div>
 )}
 </div>
 )}

 {activeTab === 'EXPERIMENTS' && (
 <div className="mt-6">
 <DataTable 
 columns={[
 { key: 'test_name', label: 'Experiment Name', width: '25%' },
 { key: 'formulation_name', label: 'Formulation', width: '20%' },
 { key: 'start_date', label: 'Start Date', width: '15%', render: (val: string) => new Date(val).toLocaleDateString() },
 { key: 'assigned_to', label: 'Assigned To', width: '15%' },
 { key: 'status', label: 'Status', width: '15%', render: (val: string) => <Badge text={val} variant={getExperimentStatusVariant(val)} /> },
 { key: 'actions', label: 'Actions', width: '10%', render: () => <button className="text-accent hover:underline">Details</button> }
 ]}
 data={experiments}
 loading={loadingExperiments}
 />
 </div>
 )}
 </ERPLayout>
 );
};

export default RnD;

