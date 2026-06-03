import React, { useState } from 'react';
import { ShoppingCart, Plus, RefreshCcw, Printer, X, Search, FileText, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import { ERPLayout, FilterBar, DataTable, StatCard, Badge } from '../components/UniversalLayout';
import { useDataFetch, useDatabaseStatus, useSearch, usePagination } from '../hooks/useDataFetch';
import { useAuth } from '../context/AuthContext';

interface SalesInvoice {
  id: string;
  invoice_no: string;
  party_name: string;
  invoice_date: string;
  status: 'Completed' | 'Draft' | 'Cancelled';
  item_count: number;
  total_amount: number;
  net_payable: number;
  payment_mode: string;
}

const POS: React.FC = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(['ADMIN', 'PHARMACIST', 'POS_OPERATOR']);
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
  const { data: invoiceData, loading, error, refetch } = useDataFetch('/api/pos/invoices');
  const { searchTerm, setSearchTerm, filteredResults } = useSearch(invoiceData?.data || [], ['invoice_no', 'party_name']);
  const { currentPage, pageSize, totalPages, paginatedData } = usePagination(filteredResults, 20);

  const stats = {
    totalInvoices: invoiceData?.data?.length || 0,
    completed: invoiceData?.data?.filter((i: any) => i.status === 'Completed')?.length || 0,
    totalSales: invoiceData?.data?.reduce((sum: number, i: any) => sum + (i.net_payable || 0), 0) || 0,
    avgBill: invoiceData?.data?.length ? (invoiceData.data.reduce((sum: number, i: any) => sum + (i.net_payable || 0), 0) / invoiceData.data.length) : 0
  };

  const statusFilteredData = statusFilter === 'All' 
    ? paginatedData 
    : paginatedData.filter((i: any) => i.status === statusFilter);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Completed': 'bg-emerald-100 text-emerald-700',
      'Draft': 'bg-slate-100 text-slate-700',
      'Cancelled': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const columns = [
    { key: 'invoice_no', label: 'Invoice No.', width: 'w-28' },
    { key: 'party_name', label: 'Customer', width: 'w-32' },
    { key: 'invoice_date', label: 'Date', width: 'w-24', format: (d: any) => new Date(d.invoice_date).toLocaleDateString() },
    { key: 'item_count', label: 'Items', width: 'w-16' },
    { key: 'total_amount', label: 'Subtotal', width: 'w-24', format: (d: any) => `?$($d.total_amount)` },
    { key: 'net_payable', label: 'Net', width: 'w-24', format: (d: any) => `?$($d.total_amount)` },
    { key: 'payment_mode', label: 'Mode', width: 'w-20' },
    {
      key: 'status',
      label: 'Status',
      width: 'w-20',
      format: (d: any) => (
        <Badge className={getStatusColor(d.status)} value={d.status} />
      )
    }
  ];

  return (
    <ERPLayout
      title="POS / Billing"
      description="Sales Invoices • Counter Billing • Customer Management"
      actionButtons={[
        { label: 'Refresh', onClick: refetch, icon: <RefreshCcw className="w-4 h-4" /> },
        canCreate && { label: 'New Invoice', onClick: () => {}, icon: <Plus className="w-4 h-4" />, variant: 'primary' }
      ].filter(Boolean)}
    >
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} label="Total Invoices" value={stats.totalInvoices} color="blue" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Completed" value={stats.completed} color="emerald" />
        <StatCard icon={<CreditCard className="w-5 h-5" />} label="Total Sales" value={`?${(stats.totalSales/100000).toFixed(1)}L`} color="purple" />
        <StatCard icon={<FileText className="w-5 h-5" />} label="Avg Bill" value={`?${stats.totalInvoices ? Math.round(stats.totalSales / stats.totalInvoices) : 0}`} color="amber" />
      </div>

      <FilterBar
        searchPlaceholder="Search by Invoice No or Customer..."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: ['All', 'Completed', 'Draft', 'Cancelled']
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

export default POS;

