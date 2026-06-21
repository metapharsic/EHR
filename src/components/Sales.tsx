import React, { useState, useMemo } from 'react';
import {
  FileText, Download, AlertCircle,
  TrendingUp, ShoppingBag, CheckCircle, ExternalLink, Trash2, Loader2
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
import {
  useDataFetch,
  useDatabaseStatus,
  useSearch,
  usePagination
} from '../hooks/useDataFetch';
import { apiClient } from '../services/apiClient';

const Sales: React.FC = () => {
  const { status: dbStatus } = useDatabaseStatus();

  const { data: salesData, loading, refetch } = useDataFetch<any[]>('/api/sales', { cacheTime: 300000 });
  const { data: statsResponse, loading: statsLoading, refetch: refetchStats } = useDataFetch<any>('/api/sales/stats');
  const { data: dropdownData } = useDataFetch<any>('/api/sales/dropdown');
  const { data: partiesData, loading: partiesLoading, refetch: refetchParties } = useDataFetch<any[]>('/api/pos/parties?status=All');
  const { data: productsData } = useDataFetch<any[]>('/api/sales/products');

  const [activeTab, setActiveTab] = useState('INVOICES');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [filters, setFilters] = useState({ searchTerm: '', status: 'All' });

  const [invoiceForm, setInvoiceForm] = useState({
    party_id: '',
    party_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Credit',
    items: [] as any[]
  });

  const [pendingItem, setPendingItem] = useState({
    product_id: '',
    name: '',
    quantity: 1,
    rate: 0,
    mrp: 0,
    gst_percent: 12
  });

  const { query, setQuery, results: searchResults } = useSearch<any>(
    salesData || [],
    ['invoice_no', 'party_name']
  );

  const filteredData = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter(s => {
      if (filters.status !== 'All' && s.status !== filters.status) return false;
      return true;
    });
  }, [searchResults, filters.status]);

  const pagination = usePagination<any>(filteredData, 10);

  const stats = useMemo(() => {
    const data = statsResponse?.data || statsResponse || {};
    return {
      totalRevenue: data.totalRevenue || 0,
      monthlyRevenue: data.monthlyRevenue || 0,
      totalInvoices: data.totalInvoices || 0
    };
  }, [statsResponse]);

  const invoiceSubTotal = invoiceForm.items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.rate), 0);
  const invoiceTotalGst = invoiceForm.items.reduce((s, i) => {
    return s + parseFloat(i.quantity) * parseFloat(i.rate) * (parseFloat(i.gst_percent) || 12) / 100;
  }, 0);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchStats(), refetchParties()]);
  };

  const handleProductSelect = (product_id: string) => {
    const prod = (productsData || []).find((p: any) => p.id === product_id);
    if (prod) {
      setPendingItem(prev => ({
        ...prev,
        product_id: prod.id,
        name: prod.name,
        rate: parseFloat(prod.ptr) || 0,
        mrp: parseFloat(prod.mrp) || 0,
        gst_percent: parseFloat(prod.gst) || 12
      }));
    } else {
      setPendingItem(prev => ({ ...prev, product_id: '', name: '' }));
    }
  };

  const handleAddItem = () => {
    if (!pendingItem.product_id) {
      alert('Please select a product.');
      return;
    }
    if (!pendingItem.quantity || pendingItem.quantity <= 0) {
      alert('Enter a valid quantity.');
      return;
    }
    if (!pendingItem.rate || pendingItem.rate <= 0) {
      alert('Enter a valid PTR rate.');
      return;
    }
    setInvoiceForm(prev => ({ ...prev, items: [...prev.items, { ...pendingItem }] }));
    setPendingItem({ product_id: '', name: '', quantity: 1, rate: 0, mrp: 0, gst_percent: 12 });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.party_id || invoiceForm.items.length === 0) {
      alert('Please select a distributor and add at least one item.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiClient.post('/api/sales', invoiceForm);
      if (res.success) {
        setShowInvoiceModal(false);
        handleRefresh();
        setInvoiceForm({
          party_id: '', party_name: '',
          invoice_date: new Date().toISOString().split('T')[0],
          payment_mode: 'Credit', items: []
        });
        setPendingItem({ product_id: '', name: '', quantity: 1, rate: 0, mrp: 0, gst_percent: 12 });
      } else {
        alert(res.error || 'Failed to create invoice');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to create invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const headers = ['Invoice No', 'Date', 'Customer', 'Amount', 'Status'];
    const rows = filteredData.map(s => [s.invoice_no, s.invoice_date, s.party_name, s.net_payable, s.status]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wholesale_sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    pagination.goToPage(1);
  };

  if (!dbStatus.connected) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto mt-8">
        <div className="flex gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Database Connection Failed</h3>
            <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
            <button onClick={handleRefresh} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ERPLayout
      title="Sales Management (Wholesale)"
      description="Professional wholesale invoicing, distributor accounts, and revenue tracking"
      onRefresh={handleRefresh}
      onExport={handleExport}
      isLoading={loading || statsLoading || partiesLoading}
      actionButtons={[
        { label: '+ New Wholesale Invoice', onClick: () => setShowInvoiceModal(true), variant: 'primary' }
      ]}
    >
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue (All Time)" value={`₹${stats.totalRevenue.toLocaleString()}`} color="blue" icon={<TrendingUp size={20} />} />
        <StatCard title="Monthly Sales" value={`₹${stats.monthlyRevenue.toLocaleString()}`} color="success" icon={<ShoppingBag size={20} />} />
        <StatCard title="Total Invoices" value={stats.totalInvoices} color="indigo" icon={<FileText size={20} />} />
      </div>

      {/* Filters */}
      <FilterBar
        filters={[
          {
            id: 'searchTerm', label: 'Search Invoice', type: 'text',
            value: filters.searchTerm, placeholder: 'Invoice No or Customer name...',
            onChange: (v) => { handleFilterChange('searchTerm', v); setQuery(v); }
          },
          {
            id: 'status', label: 'Status', type: 'select', value: filters.status,
            onChange: (v) => handleFilterChange('status', v),
            options: dropdownData?.data?.statuses || [
              { value: 'All', label: 'All Statuses' },
              { value: 'Completed', label: 'Completed' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Cancelled', label: 'Cancelled' }
            ]
          }
        ]}
      />

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'INVOICES', label: 'Wholesale Invoices', badge: filteredData.length },
          { id: 'CUSTOMERS', label: 'Distributor Master' },
          { id: 'ANALYTICS', label: 'Revenue Analysis' }
        ]}
      />

      {/* Invoices Tab */}
      {activeTab === 'INVOICES' && (
        <>
          <DataTable
            loading={loading}
            emptyMessage="No wholesale invoices found"
            data={pagination.paginatedData}
            columns={[
              { key: 'invoice_no', label: 'Invoice No', width: '18%', render: (val) => <span className="font-bold text-primary">{val}</span> },
              { key: 'invoice_date', label: 'Date', width: '12%', render: (val) => <span className="text-slate-500">{new Date(val).toLocaleDateString()}</span> },
              { key: 'party_name', label: 'Customer / Distributor', width: '28%', render: (val) => <span className="font-medium text-slate-800">{val}</span> },
              { key: 'item_count', label: 'Items', width: '8%', align: 'center' },
              { key: 'net_payable', label: 'Amount', width: '15%', align: 'right', render: (val) => <span className="font-bold">₹{Number(val).toLocaleString()}</span> },
              { key: 'status', label: 'Status', width: '12%', render: (val) => <Badge text={val} variant={val === 'Completed' ? 'success' : val === 'Cancelled' ? 'danger' : 'warning'} /> },
              {
                key: 'actions', label: 'View', width: '7%', align: 'center',
                render: (_, row: any) => (
                  <button onClick={() => { setSelectedInvoice(row); setShowDetailsModal(true); }} className="text-primary hover:bg-primary/10 p-1.5 rounded">
                    <ExternalLink size={16} />
                  </button>
                )
              }
            ]}
          />
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-slate-500">Showing {pagination.paginatedData.length} of {filteredData.length}</p>
              <div className="flex gap-2">
                <button disabled={!pagination.hasPrevPage} onClick={() => pagination.goToPage(pagination.currentPage - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
                <span className="px-3 py-1">Page {pagination.currentPage} of {pagination.totalPages}</span>
                <button disabled={!pagination.hasNextPage} onClick={() => pagination.goToPage(pagination.currentPage + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Distributor Master Tab */}
      {activeTab === 'CUSTOMERS' && (
        <DataTable
          loading={partiesLoading}
          emptyMessage="No distributors found in database"
          data={partiesData || []}
          columns={[
            {
              key: 'name', label: 'Distributor Name', width: '30%',
              render: (val, row: any) => (
                <div>
                  <div className="font-bold text-slate-800">{val}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{row.id?.split('-')[0]}</div>
                </div>
              )
            },
            { key: 'city', label: 'Location', width: '15%', render: (val, row: any) => <span>{val || row.territory || 'N/A'}</span> },
            { key: 'mobile', label: 'Contact', width: '15%' },
            {
              key: 'currentBalance', label: 'Outstanding', width: '15%', align: 'right',
              render: (val) => <span className={`font-bold ${Number(val) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{Math.abs(Number(val)).toLocaleString()}</span>
            },
            { key: 'status', label: 'Status', width: '12%', render: (val) => <Badge text={val} variant={val === 'Active' ? 'success' : 'neutral'} /> },
            {
              key: 'actions', label: 'Ledger', width: '13%', align: 'center',
              render: () => <button className="text-primary hover:underline font-bold text-xs">Ledger &rarr;</button>
            }
          ]}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" /> Monthly Revenue Trend
              </h3>
              <div className="h-[250px] flex items-end justify-between gap-2 pt-10">
                {[45, 60, 35, 80, 95, 70, 55].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full bg-primary/20 hover:bg-primary/40 rounded-t transition-all cursor-pointer relative" style={{ height: `${h}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        ₹{(h * 10000).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">M{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-500" /> Top Categories
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Antibiotics', val: 42, color: 'bg-blue-500' },
                  { label: 'Analgesics', val: 28, color: 'bg-emerald-500' },
                  { label: 'Cardio', val: 18, color: 'bg-purple-500' },
                  { label: 'Other', val: 12, color: 'bg-slate-300' }
                ].map((cat, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600">{cat.label}</span>
                      <span className="text-slate-900">{cat.val}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${cat.color}`} style={{ width: `${cat.val}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      <Modal isOpen={showInvoiceModal} title="Create Wholesale Invoice" onClose={() => setShowInvoiceModal(false)} size="xl">
        <form onSubmit={handleCreateInvoice} className="space-y-6">
          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distributor *</label>
              <select
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                value={invoiceForm.party_id}
                onChange={(e) => {
                  const p = (partiesData || []).find((x: any) => x.id === e.target.value);
                  setInvoiceForm({ ...invoiceForm, party_id: e.target.value, party_name: p?.name || '' });
                }}
              >
                <option value="">Select Distributor</option>
                {(partiesData || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date *</label>
              <input
                required type="date"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={invoiceForm.invoice_date}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Mode</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={invoiceForm.payment_mode}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_mode: e.target.value })}
              >
                <option value="Credit">Credit (Post to Ledger)</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Product Picker */}
          <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/60">
            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Add Product</p>
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">Product</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                >
                  <option value="">Select product...</option>
                  {(productsData || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">Qty</label>
                <input
                  type="number" min="1"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.quantity}
                  onChange={(e) => setPendingItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">PTR (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.rate}
                  onChange={(e) => setPendingItem(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">GST %</label>
                <input
                  type="number" min="0" max="28"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.gst_percent}
                  onChange={(e) => setPendingItem(prev => ({ ...prev, gst_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="col-span-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-sky-600 transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-center" style={{ width: 80 }}>Qty</th>
                  <th className="px-4 py-2 text-right" style={{ width: 120 }}>Rate (PTR)</th>
                  <th className="px-4 py-2 text-right" style={{ width: 80 }}>GST %</th>
                  <th className="px-4 py-2 text-right" style={{ width: 140 }}>Amount</th>
                  <th className="px-4 py-2 text-center" style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoiceForm.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                      No items added yet. Use the picker above to add products.
                    </td>
                  </tr>
                ) : (
                  invoiceForm.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-medium">{item.name}</td>
                      <td className="px-4 py-2 text-center">{item.quantity}</td>
                      <td className="px-4 py-2 text-right">₹{parseFloat(item.rate).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{item.gst_percent}%</td>
                      <td className="px-4 py-2 text-right font-semibold">₹{(item.quantity * item.rate).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const ni = [...invoiceForm.items];
                            ni.splice(idx, 1);
                            setInvoiceForm({ ...invoiceForm, items: ni });
                          }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {invoiceForm.items.length > 0 && (
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Taxable Amount</td>
                    <td className="px-4 py-2 text-right font-bold">₹{invoiceSubTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right text-[10px] font-bold uppercase text-orange-500">+ Total GST</td>
                    <td className="px-4 py-2 text-right font-bold text-orange-500">₹{invoiceTotalGst.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  <tr className="text-primary">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-extrabold uppercase">Net Payable</td>
                    <td className="px-4 py-3 text-right text-base font-extrabold">₹{(invoiceSubTotal + invoiceTotalGst).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t flex justify-between items-center">
            <p className="text-slate-400 text-xs">
              GST auto-calculated per product rate. Invoice posted under <span className="font-mono font-bold text-slate-600">WHO-</span> prefix.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || invoiceForm.items.length === 0}
                className="px-8 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Finalize & Post Invoice
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Invoice Details Modal */}
      {showDetailsModal && selectedInvoice && (
        <Modal
          title={`Wholesale Invoice: ${selectedInvoice.invoice_no}`}
          onClose={() => setShowDetailsModal(false)}
          size="lg"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Date</p>
                <p className="text-sm font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Status</p>
                <Badge text={selectedInvoice.status} variant={selectedInvoice.status === 'Completed' ? 'success' : 'warning'} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Payment Mode</p>
                <p className="text-sm font-medium">{selectedInvoice.payment_mode || 'Credit'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Items</p>
                <p className="text-sm font-medium">{selectedInvoice.item_count || '—'}</p>
              </div>
            </div>

            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Distributor</h4>
              <div className="bg-white border border-slate-200 p-4 rounded-xl">
                <p className="font-bold text-slate-800 text-lg">{selectedInvoice.party_name}</p>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Financial Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Sub Total</p>
                  <p className="text-lg font-bold">₹{Number(selectedInvoice.total_taxable || selectedInvoice.sub_total || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Total GST</p>
                  <p className="text-lg font-bold text-orange-600">
                    ₹{Number(
                      selectedInvoice.total_gst ||
                      (Number(selectedInvoice.total_cgst || 0) + Number(selectedInvoice.total_sgst || 0) + Number(selectedInvoice.total_igst || 0))
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <p className="text-[10px] text-primary/60 font-bold uppercase">Net Payable</p>
                  <p className="text-lg font-bold text-primary">₹{Number(selectedInvoice.net_payable).toLocaleString()}</p>
                </div>
              </div>
            </section>

            <div className="pt-4 border-t flex justify-end gap-3">
              <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-50">
                <Download size={16} /> Download PDF
              </button>
              <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ERPLayout>
  );
};

export default Sales;
