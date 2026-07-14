/**
 * REFACTORED QUALITY CONTROL COMPONENT
 * Uses ERPLayout + useDataFetch patterns
 * Standardized for Metapharsic ERP Unified Design System
 */

import React, { useState, useMemo } from 'react';
import { 
 ClipboardCheck, FlaskConical, CheckCircle, XCircle, 
 FileText, Printer, AlertTriangle, Search, Filter,
 Plus, RefreshCcw, Download, Eye
} from 'lucide-react';

// Import UI components from UniversalLayout
import {
 ERPLayout,
 FilterBar,
 DataTable,
 StatCard,
 Badge,
 Modal,
} from './UniversalLayout';

// Import data hooks
import {
 useDataFetch,
 useDatabaseStatus,
 useSearch,
 usePagination,
} from '../hooks/useDataFetch';

const QualityControl: React.FC = () => {
 // Check database connection
 const { status: dbStatus } = useDatabaseStatus();
 
 // Fetch data
 const { data: rawQcData, loading, error, refetch } = useDataFetch('/api/qc');
 const { data: rawDropdownData } = useDataFetch('/api/qc/dropdown');

 const qcData = rawQcData?.data || [];
 const dropdownData = rawDropdownData?.data || {};

 // UI States
 const [filters, setFilters] = useState({
 searchTerm: '',
 status: 'ALL',
 });
 const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
 const [showDetailModal, setShowDetailModal] = useState(false);

 // Fetch detail data when a record is selected
 const { data: rawSelectedRecord, loading: loadingDetail } = useDataFetch(
 selectedRecordId ? `/api/qc/${selectedRecordId}` : null
 );
 const selectedRecord = rawSelectedRecord?.data;

 // Advanced features: Search & Pagination
 const { results } = useSearch(qcData || [], ['batchNumber', 'productName']);
 
 // Filter by status if not 'ALL'
 const filteredResults = useMemo(() => {
 if (filters.status === 'ALL') return results;
 return results.filter((item: any) => item.finalStatus === filters.status);
 }, [results, filters.status]);

 const pagination = usePagination(filteredResults, 10);

 // Event handlers
 const handleRefresh = async () => {
 await refetch();
 };

 const handleFilterChange = (key: string, value: string) => {
 setFilters(prev => ({ ...prev, [key]: value }));
 pagination.goToPage(1);
 };

 const handleViewDetail = (record: any) => {
 setSelectedRecordId(record.id);
 setShowDetailModal(true);
 };

 // Columns for DataTable
 const columns = [
 { 
 key: 'batchNumber', 
 label: 'Batch Number', 
 width: '15%',
 render: (val: string) => <span className="font-mono font-bold text-slate-700">{val}</span>
 },
 { key: 'productName', label: 'Product Name', width: '25%' },
 { 
 key: 'testDate', 
 label: 'Test Date', 
 width: '15%',
 render: (val: string) => new Date(val).toLocaleDateString()
 },
 { 
 key: 'finalStatus', 
 label: 'Status', 
 width: '15%',
 render: (val: string) => (
 <Badge 
 text={val} 
 variant={val === 'Approved' ? 'success' : val === 'Rejected' ? 'danger' : 'warning'} 
 />
 )
 },
 { 
 key: 'coaGenerated', 
 label: 'COA', 
 width: '10%',
 render: (val: boolean) => val ? (
 <div className="flex items-center gap-1 text-green-600">
 <CheckCircle size={14} /> <span className="text-xs font-medium">Generated</span>
 </div>
 ) : (
 <div className="flex items-center gap-1 text-slate-400">
 <XCircle size={14} /> <span className="text-xs font-medium">Pending</span>
 </div>
 )
 },
 {
 key: 'actions',
 label: 'Actions',
 width: '10%',
 render: (_: any, row: any) => (
 <button 
 onClick={() => handleViewDetail(row)}
 className="p-2 text-accent hover:bg-blue-50 rounded-lg transition-colors"
 title="View Details"
 >
 <Eye size={18} />
 </button>
 )
 }
 ];

 // Database Connection Error View
 if (!dbStatus.connected && !loading) {
 return (
 <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-6">
 <div className="flex gap-3">
 <AlertTriangle className="w-6 h-6 text-red-600" />
 <div>
 <p className="font-semibold text-red-900">Database Connection Failed</p>
 <p className="text-red-700 text-sm mt-1">{dbStatus.error || 'Unable to connect to the Metapharsic ERP database.'}</p>
 <button 
 onClick={() => window.location.reload()}
 className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
 >
 Retry Connection
 </button>
 </div>
 </div>
 </div>
 );
 }

 return (
 <ERPLayout
 title="Quality Control (QC) Lab"
 description="Batch Testing, COA Generation & Release Approval"
 onRefresh={handleRefresh}
 onExport={() => {}}
 isLoading={loading}
 topActions={
 <button className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-900 transition-colors shadow-sm">
 <Plus size={18} /> New Test Request
 </button>
 }
 >
 {error && (
 <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center gap-3">
 <XCircle size={20} />
 <span>Error loading QC data: {error}</span>
 </div>
 )}

 {/* KPI Stats */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <StatCard label="Total Tests" value={qcData?.length || 0} color="blue" />
 <StatCard label="Approved" value={qcData?.filter((r: any) => r.finalStatus === 'Approved').length || 0} color="success" />
 <StatCard label="Rejected" value={qcData?.filter((r: any) => r.finalStatus === 'Rejected').length || 0} color="danger" />
 <StatCard label="Pending" value={qcData?.filter((r: any) => r.finalStatus === 'Pending').length || 0} color="warning" />
 </div>

 {/* Filters */}
 <FilterBar
 filters={[
 {
 id: 'searchTerm',
 label: 'Search',
 type: 'text',
 placeholder: 'Batch or product name...',
 value: filters.searchTerm,
 onChange: (v) => handleFilterChange('searchTerm', v),
 },
 {
 id: 'status',
 label: 'Status',
 type: 'select',
 value: filters.status,
 onChange: (v) => handleFilterChange('status', v),
 options: dropdownData?.statuses || [
 { value: 'ALL', label: 'All Statuses' },
 { value: 'Approved', label: 'Approved' },
 { value: 'Rejected', label: 'Rejected' },
 { value: 'Pending', label: 'Pending' },
 ]
 }
 ]}
 />

 {/* Data Table */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <DataTable
 columns={columns}
 data={pagination.paginatedData}
 loading={loading}
 />
 
 {/* Empty State */}
 {!loading && pagination.paginatedData.length === 0 && (
 <div className="py-20 text-center">
 <FlaskConical size={48} className="mx-auto text-slate-200 mb-4" />
 <p className="text-slate-500 font-medium">No QC records found matching your filters.</p>
 </div>
 )}

 {/* Pagination */}
 {pagination.totalPages > 1 && (
 <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
 <span className="text-sm text-slate-500">
 Showing {((pagination.currentPage - 1) * 10) + 1} to {Math.min(pagination.currentPage * 10, filteredResults.length)} of {filteredResults.length} records
 </span>
 <div className="flex gap-2">
 <button 
 onClick={() => pagination.goToPage(pagination.currentPage - 1)}
 disabled={pagination.currentPage === 1}
 className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-white transition-colors"
 >
 Previous
 </button>
 <div className="flex items-center gap-1">
 {[...Array(pagination.totalPages)].map((_, i) => (
 <button
 key={i}
 onClick={() => pagination.goToPage(i + 1)}
 className={`w-8 h-8 rounded text-sm transition-colors ${pagination.currentPage === i + 1 ? 'bg-slate-800 text-white' : 'hover:bg-white border border-transparent hover:border-slate-300'}`}
 >
 {i + 1}
 </button>
 ))}
 </div>
 <button 
 onClick={() => pagination.goToPage(pagination.currentPage + 1)}
 disabled={pagination.currentPage === pagination.totalPages}
 className="px-3 py-1 border border-slate-300 rounded text-sm disabled:opacity-50 hover:bg-white transition-colors"
 >
 Next
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Detail Modal */}
 {showDetailModal && (
 <Modal 
 isOpen={showDetailModal} 
 onClose={() => setShowDetailModal(false)}
 title={selectedRecord ? `QC Details: ${selectedRecord.batch_number}` : 'Loading...'}
 >
 {loadingDetail ? (
 <div className="py-20 text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
 <p className="mt-4 text-slate-500">Fetching record details...</p>
 </div>
 ) : selectedRecord ? (
 <div className="space-y-6">
 <div className="flex justify-between items-start border-b border-slate-100 pb-4">
 <div>
 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
 {selectedRecord.product_name} 
 <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">Batch: {selectedRecord.batch_number}</span>
 </h3>
 <p className="text-slate-500 text-sm mt-1">Test Date: {new Date(selectedRecord.test_date).toLocaleDateString()}</p>
 </div>
 {selectedRecord.coa_generated && (
 <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors">
 <Printer size={14}/> Print COA
 </button>
 )}
 </div>

 <div>
 <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
 <ClipboardCheck size={18} className="text-accent"/> Test Parameters
 </h4>
 <div className="overflow-hidden border border-slate-100 rounded-lg">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
 <tr>
 <th className="p-3">Parameter</th>
 <th className="p-3">Standard Limit</th>
 <th className="p-3">Result</th>
 <th className="p-3 text-center">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {selectedRecord.parameters?.map((param: any, idx: number) => (
 <tr key={idx} className="hover:bg-slate-50 transition-colors">
 <td className="p-3 font-medium text-slate-800">{param.parameter}</td>
 <td className="p-3 text-slate-500">{param.standard}</td>
 <td className="p-3 font-bold">{param.result}</td>
 <td className="p-3 text-center">
 {param.status === 'Pass' 
 ? <CheckCircle size={16} className="text-green-500 mx-auto"/> 
 : <XCircle size={16} className="text-red-500 mx-auto"/>
 }
 </td>
 </tr>
 ))}
 {(!selectedRecord.parameters || selectedRecord.parameters.length === 0) && (
 <tr>
 <td colSpan={4} className="p-8 text-center text-slate-400 italic">
 No parameters recorded for this batch.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 <div className={`p-4 rounded-xl border ${selectedRecord.final_status === 'Approved' ? 'bg-green-50 border-green-100' : selectedRecord.final_status === 'Rejected' ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100'} flex items-center gap-4`}>
 {selectedRecord.final_status === 'Approved' ? <CheckCircle size={32} className="text-green-600" /> : selectedRecord.final_status === 'Rejected' ? <AlertTriangle size={32} className="text-red-600" /> : <RefreshCcw size={32} className="text-yellow-600 animate-spin-slow" />}
 <div>
 <h4 className={`font-bold ${selectedRecord.final_status === 'Approved' ? 'text-green-800' : selectedRecord.final_status === 'Rejected' ? 'text-red-800' : 'text-yellow-800'}`}>
 Batch Status: {selectedRecord.final_status}
 </h4>
 <p className={`text-sm ${selectedRecord.final_status === 'Approved' ? 'text-green-700' : selectedRecord.final_status === 'Rejected' ? 'text-red-700' : 'text-yellow-700'}`}>
 {selectedRecord.final_status === 'Approved' 
 ? "This batch complies with IP/BP/USP standards and is released for sale."
 : selectedRecord.final_status === 'Rejected' 
 ? "This batch failed critical parameters and is quarantined."
 : "Testing in progress. Final release pending."}
 </p>
 </div>
 </div>
 
 {selectedRecord.remarks && (
 <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Remarks</p>
 <p className="text-sm text-slate-700">{selectedRecord.remarks}</p>
 </div>
 )}
 
 <div className="flex justify-end gap-3 mt-4">
 <button 
 onClick={() => setShowDetailModal(false)}
 className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
 >
 Close
 </button>
 </div>
 </div>
 ) : (
 <div className="py-20 text-center text-slate-400">
 Record not found.
 </div>
 )}
 </Modal>
 )}
 </ERPLayout>
 );
};

export default QualityControl;

