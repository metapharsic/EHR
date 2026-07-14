import React, { useState } from 'react';
import { Truck, Plus, RefreshCcw, X, Calendar, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { ERPLayout, FilterBar, DataTable, StatCard, Badge } from '../components/UniversalLayout';
import { useDataFetch, useDatabaseStatus, useSearch, usePagination } from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';

interface PurchaseOrder {
  id: string;
  invoice_no: string;
  supplier_name: string;
  supplier_code: string;
  order_date: string;
  status: 'Draft' | 'Ordered' | 'Received' | 'Partial' | 'Cancelled' | 'Returned';
  item_count: number;
  total_amount: number;
}

const Purchase: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['ADMIN', 'PHARMACIST', 'PURCHASE_MANAGER']);
  const dbStatus = useDatabaseStatus();

  if (!dbStatus.isConnected) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-600 inline mr-2" />
        <span className="text-red-700">Database connection unavailable</span>
      </div>
    );
  }

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const { data: purchaseData, loading, error, refetch } = useDataFetch('/api/purchase');
  const { searchTerm, setSearchTerm, filteredResults } = useSearch(purchaseData?.data || [], ['invoice_no', 'supplier_name']);
  const { currentPage, pageSize, totalPages, paginatedData } = usePagination(filteredResults, 20);

  const stats = {
    totalOrders: purchaseData?.data?.length || 0,
    pending: purchaseData?.data?.filter((p: any) => p.status === 'Ordered')?.length || 0,
    received: purchaseData?.data?.filter((p: any) => p.status === 'Received')?.length || 0,
    totalValue: purchaseData?.data?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0
  };

  const statusFilteredData = statusFilter === 'All' 
    ? paginatedData 
    : paginatedData.filter((p: any) => p.status === statusFilter);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Draft': 'bg-slate-100 text-slate-700',
      'Ordered': 'bg-blue-100 text-blue-700',
      'Received': 'bg-emerald-100 text-emerald-700',
      'Partial': 'bg-amber-100 text-amber-700',
      'Cancelled': 'bg-red-100 text-red-700',
      'Returned': 'bg-orange-100 text-orange-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const columns = [
    { key: 'invoice_no', label: 'Invoice No.', width: 'w-24' },
    { key: 'supplier_name', label: 'Supplier', width: 'w-32' },
    { key: 'order_date', label: 'Date', width: 'w-24', format: (d: any) => new Date(d.order_date).toLocaleDateString() },
    { key: 'item_count', label: 'Items', width: 'w-16' },
    { key: 'total_amount', label: 'Amount', width: 'w-24', format: (d: any) => `?$($d.total_amount)` },
    {
      key: 'status',
      label: 'Status',
      width: 'w-24',
      format: (d: any) => (
        <Badge className={getStatusColor(d.status)} value={d.status} />
      )
    }
  ];

  return (
    <ERPLayout
      title="Purchase Management"
      description="Purchase Orders � Supplier Management � Stock Replenishment"
      actionButtons={[
        { label: 'Refresh', onClick: refetch, icon: <RefreshCcw className="w-4 h-4" /> },
        canCreate && { label: 'New PO', onClick: () => {}, icon: <Plus className="w-4 h-4" />, variant: 'primary' }
      ].filter(Boolean)}
    >
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FileText className="w-5 h-5" />} label="Total Orders" value={stats.totalOrders} color="blue" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending" value={stats.pending} color="amber" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Received" value={stats.received} color="emerald" />
        <StatCard icon={<Truck className="w-5 h-5" />} label="Total Value" value={`₹${(stats.totalValue/100000).toFixed(1)}L`} color="purple" />
      </div>

      <FilterBar
        searchPlaceholder="Search by Invoice No or Supplier..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: ['All', 'Draft', 'Ordered', 'Received', 'Partial', 'Cancelled']
          }
        ]}
      />

      {loading ? (
        <div className="p-6 text-center text-slate-500">Loading...</div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-600">Error: {error}</div>
      ) : (
        <>
          <DataTable columns={columns} data={statusFilteredData} />
          <div className="mt-6 flex justify-between items-center p-4 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={currentPage === 1} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">Previous</button>
              <button disabled={currentPage === totalPages} className="px-4 py-2 text-sm bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        </>
      )}
    </ERPLayout>
  );
};

export default Purchase;

