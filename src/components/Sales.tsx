import React, { useState, useMemo, useRef } from 'react';
import {
  FileText, Download, AlertCircle, TrendingUp, ShoppingBag,
  CheckCircle, ExternalLink, Trash2, Loader2, Printer, X,
  Building2, Phone, Mail, MapPin, Hash
} from 'lucide-react';
import {
  ERPLayout, FilterBar, DataTable, StatCard, Badge, Tabs, Modal
} from './UniversalLayout';
import { useDataFetch, useDatabaseStatus, useSearch, usePagination, invalidateCache } from '../hooks/useDataFetch';
import { apiClient } from '../services/apiClient';

// ── Company info for invoice header (edit here or pull from settings API) ──
const COMPANY = {
  name: 'Metapharsic Lifesciences Pvt. Ltd.',
  address: 'Plot No. 42, MIDC Industrial Area, Pune – 411 028',
  phone: '+91 98765 43210',
  email: 'sales@metapharsic.com',
  gstin: '27AABCM1234A1ZK',
  dl: 'MH-PUN-20B-12345',
  logo: '/logo.svg'
};

const Sales: React.FC = () => {
  const { status: dbStatus } = useDatabaseStatus();

  const { data: salesData, loading, refetch } = useDataFetch<any[]>('/api/sales', { cacheTime: 60000 });
  const { data: statsResponse, loading: statsLoading, refetch: refetchStats } = useDataFetch<any>('/api/sales/stats');
  const { data: dropdownData } = useDataFetch<any>('/api/sales/dropdown');
  const { data: partiesData, loading: partiesLoading, refetch: refetchParties } = useDataFetch<any[]>('/api/pos/parties?status=All');
  const { data: productsData } = useDataFetch<any[]>('/api/sales/products');
  const { data: analyticsResp } = useDataFetch<any>('/api/sales/analytics');

  const [activeTab, setActiveTab] = useState('INVOICES');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ searchTerm: '', status: 'All' });
  const printRef = useRef<HTMLDivElement>(null);

  const [invoiceForm, setInvoiceForm] = useState({
    party_id: '', party_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Credit', items: [] as any[]
  });
  const [pendingItem, setPendingItem] = useState({
    product_id: '', name: '', quantity: 1, rate: 0, mrp: 0, gst_percent: 12,
    scheme_type: 'none' as 'none' | '10+7', paid_strips: 10, free_strips: 7, total_strips: 17
  });

  const { query, setQuery, results: searchResults } = useSearch<any>(salesData || [], ['invoice_no', 'party_name']);

  const filteredData = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter(s => filters.status === 'All' || s.status === filters.status);
  }, [searchResults, filters.status]);

  const pagination = usePagination<any>(filteredData, 10);

  const stats = useMemo(() => {
    const d = statsResponse?.data || statsResponse || {};
    return { totalRevenue: d.totalRevenue || 0, monthlyRevenue: d.monthlyRevenue || 0, totalInvoices: d.totalInvoices || 0 };
  }, [statsResponse]);

  const analytics = useMemo(() => {
    const d = analyticsResp?.data || {};
    return { trend: d.trend || [], topCategories: d.topCategories || [] };
  }, [analyticsResp]);

  const invoiceSubTotal = invoiceForm.items.reduce((s, i) => s + parseFloat(i.quantity) * parseFloat(i.rate), 0);
  const invoiceTotalGst = invoiceForm.items.reduce((s, i) =>
    s + parseFloat(i.quantity) * parseFloat(i.rate) * (parseFloat(i.gst_percent) || 12) / 100, 0);

  const handleRefresh = async () => {
    invalidateCache('/api/sales');
    await Promise.all([refetch(), refetchStats(), refetchParties()]);
  };

  const handleProductSelect = (product_id: string) => {
    const prod = (productsData || []).find((p: any) => p.id === product_id);
    if (prod) {
      const mrp = parseFloat(prod.mrp) || 0;
      setPendingItem(prev => {
        const effRate = prev.scheme_type === '10+7' ? parseFloat((mrp * prev.paid_strips / prev.total_strips).toFixed(2)) : (parseFloat(prod.ptr) || 0);
        return { ...prev, product_id: prod.id, name: prod.name, rate: effRate, mrp, gst_percent: parseFloat(prod.gst) || 12 };
      });
    } else setPendingItem(prev => ({ ...prev, product_id: '', name: '' }));
  };

  const handleSchemeToggle = (scheme: 'none' | '10+7') => {
    setPendingItem(prev => {
      const mrp = prev.mrp;
      const rate = scheme === '10+7' && mrp > 0 ? parseFloat((mrp * 10 / 17).toFixed(2)) : prev.rate;
      return { ...prev, scheme_type: scheme, paid_strips: 10, free_strips: 7, total_strips: 17, rate };
    });
  };

  const handleAddItem = () => {
    if (!pendingItem.product_id) { alert('Select a product.'); return; }
    if (!pendingItem.quantity || pendingItem.quantity <= 0) { alert('Enter valid quantity.'); return; }
    if (!pendingItem.rate || pendingItem.rate <= 0) { alert('Enter valid PTR rate.'); return; }
    setInvoiceForm(prev => ({ ...prev, items: [...prev.items, { ...pendingItem }] }));
    setPendingItem({ product_id: '', name: '', quantity: 1, rate: 0, mrp: 0, gst_percent: 12, scheme_type: 'none', paid_strips: 10, free_strips: 7, total_strips: 17 });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.party_id || invoiceForm.items.length === 0) { alert('Select distributor and add at least one item.'); return; }
    setIsSaving(true);
    try {
      const res = await apiClient.post('/api/sales', invoiceForm);
      if (res.success) {
        setShowInvoiceModal(false);
        invalidateCache('/api/sales');
        handleRefresh();
        setInvoiceForm({ party_id: '', party_name: '', invoice_date: new Date().toISOString().split('T')[0], payment_mode: 'Credit', items: [] });
        setPendingItem({ product_id: '', name: '', quantity: 1, rate: 0, mrp: 0, gst_percent: 12 });
      } else alert(res.error || 'Failed to create invoice');
    } catch (error: any) {
      alert(error.message || 'Failed to create invoice');
    } finally { setIsSaving(false); }
  };

  const handleDeleteInvoice = async (inv: any) => {
    if (!window.confirm(`Cancel invoice ${inv.invoice_no}? This cannot be undone.`)) return;
    setDeletingId(inv.id);
    try {
      const res = await apiClient.delete(`/api/sales/${inv.id}`);
      if (res.success) { invalidateCache('/api/sales'); handleRefresh(); }
      else alert(res.error || 'Failed to cancel invoice');
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'Failed');
    } finally { setDeletingId(null); }
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head>
      <title>Invoice ${selectedInvoice?.invoice_no}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; background: white; }
        .page { width: 210mm; min-height: 297mm; padding: 16mm; position: relative; }
        .watermark {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%,-50%) rotate(-35deg);
          font-size: 80px; font-weight: 900; color: rgba(14,165,233,0.07);
          white-space: nowrap; pointer-events: none; z-index: 0; letter-spacing: 10px;
        }
        .content { position: relative; z-index: 1; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px; }
        .company-name { font-size: 20px; font-weight: 900; color: #0ea5e9; }
        .company-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
        .invoice-title { text-align: right; }
        .invoice-title h1 { font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 2px; }
        .invoice-title .inv-no { font-size: 13px; font-weight: 700; color: #0ea5e9; margin-top: 4px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .meta-label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #94a3b8; margin-bottom: 4px; }
        .meta-val { font-weight: 700; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead th { background: #0f172a; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        thead th:last-child { text-align: right; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tbody td:last-child { text-align: right; font-weight: 700; }
        .totals { display: flex; justify-content: flex-end; }
        .totals-box { width: 260px; }
        .tot-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
        .tot-row.net { font-size: 15px; font-weight: 900; color: #0ea5e9; border-top: 2px solid #0ea5e9; border-bottom: none; padding-top: 8px; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        .sig-line { border-top: 1px solid #94a3b8; width: 160px; text-align: center; padding-top: 4px; font-size: 10px; color: #64748b; margin-top: 40px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>
      <div class="page">
        <div class="watermark">METAPHARSIC</div>
        <div class="content">${el.innerHTML}</div>
      </div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
      </body></html>`);
    w.document.close();
  };

  const handleExport = () => {
    const headers = ['Invoice No', 'Date', 'Customer', 'Amount', 'Status'];
    const rows = filteredData.map(s => [s.invoice_no, s.invoice_date, s.party_name, s.net_payable, s.status]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `wholesale_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    pagination.goToPage(1);
  };

  const inv = selectedInvoice;
  const invSubTotal = Number(inv?.total_taxable || inv?.sub_total || 0);
  const invGst = Number(inv?.total_gst || (Number(inv?.total_cgst || 0) + Number(inv?.total_sgst || 0) + Number(inv?.total_igst || 0)));
  const invNet = Number(inv?.net_payable || 0);

  if (!dbStatus.connected) return (
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

  return (
    <ERPLayout
      title="Sales Management (Wholesale)"
      description="Wholesale invoicing, distributor accounts, and revenue analytics"
      onRefresh={handleRefresh}
      onExport={handleExport}
      isLoading={loading || statsLoading || partiesLoading}
      actionButtons={[{ label: '+ New Wholesale Invoice', onClick: () => setShowInvoiceModal(true), variant: 'primary' }]}
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} color="blue" icon={<TrendingUp size={20} />} />
        <StatCard title="Monthly Sales" value={`₹${stats.monthlyRevenue.toLocaleString()}`} color="success" icon={<ShoppingBag size={20} />} />
        <StatCard title="Total Invoices" value={stats.totalInvoices} color="indigo" icon={<FileText size={20} />} />
      </div>

      <FilterBar filters={[
        { id: 'searchTerm', label: 'Search', type: 'text', value: filters.searchTerm, placeholder: 'Invoice No or Customer...', onChange: (v) => { handleFilterChange('searchTerm', v); setQuery(v); } },
        { id: 'status', label: 'Status', type: 'select', value: filters.status, onChange: (v) => handleFilterChange('status', v),
          options: dropdownData?.data?.statuses || [{ value: 'All', label: 'All Statuses' }, { value: 'Completed', label: 'Completed' }, { value: 'Pending', label: 'Pending' }, { value: 'Cancelled', label: 'Cancelled' }] }
      ]} />

      <Tabs activeTab={activeTab} onChange={setActiveTab} tabs={[
        { id: 'INVOICES', label: 'Wholesale Invoices', badge: filteredData.length },
        { id: 'CUSTOMERS', label: 'Distributor Master' },
        { id: 'ANALYTICS', label: 'Revenue Analysis' }
      ]} />

      {/* ── INVOICES TAB ── */}
      {activeTab === 'INVOICES' && (
        <>
          <DataTable
            loading={loading}
            emptyMessage="No wholesale invoices found"
            data={pagination.paginatedData}
            columns={[
              { key: 'invoice_no', label: 'Invoice No', width: '16%', render: (val) => <span className="font-bold text-primary font-mono">{val}</span> },
              { key: 'invoice_date', label: 'Date', width: '11%', render: (val) => <span className="text-slate-500">{new Date(val).toLocaleDateString()}</span> },
              { key: 'party_name', label: 'Distributor', width: '26%', render: (val) => <span className="font-medium text-slate-800">{val}</span> },
              { key: 'item_count', label: 'Items', width: '7%', align: 'center' },
              { key: 'net_payable', label: 'Amount', width: '14%', align: 'right', render: (val) => <span className="font-bold">₹{Number(val).toLocaleString()}</span> },
              { key: 'status', label: 'Status', width: '12%', render: (val) => <Badge text={val} variant={val === 'Completed' ? 'success' : val === 'Cancelled' ? 'danger' : 'warning'} /> },
              {
                key: 'actions', label: 'Actions', width: '14%', align: 'center',
                render: (_: any, row: any) => (
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => { setSelectedInvoice(row); setShowDetailsModal(true); }} title="View Invoice"
                      className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors">
                      <ExternalLink size={15} />
                    </button>
                    {row.status !== 'Cancelled' && (
                      <button onClick={() => handleDeleteInvoice(row)} disabled={deletingId === row.id} title="Cancel Invoice"
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40">
                        {deletingId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    )}
                  </div>
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

      {/* ── DISTRIBUTOR MASTER TAB ── */}
      {activeTab === 'CUSTOMERS' && (
        <DataTable
          loading={partiesLoading}
          emptyMessage="No distributors found"
          data={partiesData || []}
          columns={[
            { key: 'name', label: 'Distributor', width: '28%', render: (val, row: any) => (
              <div><div className="font-bold text-slate-800">{val}</div><div className="text-[10px] text-slate-400 font-mono">{row.gstin || row.gst_number || '—'}</div></div>
            )},
            { key: 'city', label: 'Location', width: '14%', render: (val, row: any) => <span className="text-slate-600">{val || row.territory || '—'}</span> },
            { key: 'mobile', label: 'Contact', width: '14%', render: (val, row: any) => <span>{val || row.phone || '—'}</span> },
            { key: 'credit_limit', label: 'Credit Limit', width: '13%', align: 'right', render: (val) => <span className="font-mono text-slate-700">₹{Number(val || 0).toLocaleString()}</span> },
            { key: 'currentBalance', label: 'Outstanding', width: '14%', align: 'right', render: (val) => (
              <span className={`font-bold ${Number(val) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{Math.abs(Number(val)).toLocaleString()}</span>
            )},
            { key: 'status', label: 'Status', width: '10%', render: (val) => <Badge text={val} variant={val === 'Active' ? 'success' : 'neutral'} /> },
            { key: 'actions', label: '', width: '7%', align: 'center', render: (_: any, row: any) => (
              <button onClick={() => alert(`Ledger for ${row.name} — coming soon`)} className="text-primary hover:underline font-bold text-xs">Ledger →</button>
            )}
          ]}
        />
      )}

      {/* ── REVENUE ANALYSIS TAB ── */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" /> Monthly Revenue (Last 6 Months)
              </h3>
              {analytics.trend.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
              ) : (() => {
                const maxVal = Math.max(...analytics.trend.map((t: any) => Number(t.revenue)));
                return (
                  <div className="h-[200px] flex items-end justify-between gap-2 pt-6">
                    {analytics.trend.map((t: any, i: number) => {
                      const pct = maxVal > 0 ? (Number(t.revenue) / maxVal) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                          <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            ₹{Number(t.revenue).toLocaleString()}
                          </span>
                          <div className="w-full bg-primary/20 hover:bg-primary/50 rounded-t transition-all" style={{ height: `${Math.max(pct, 4)}%` }} />
                          <span className="text-[10px] font-bold text-slate-500">{t.month}</span>
                          <span className="text-[9px] text-slate-400">{t.invoices} inv</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Top Categories */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag size={18} className="text-emerald-500" /> Top Categories (Last 90 Days)
              </h3>
              {analytics.topCategories.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No data yet</div>
              ) : (() => {
                const total = analytics.topCategories.reduce((s: number, c: any) => s + Number(c.revenue), 0);
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                return (
                  <div className="space-y-3 mt-2">
                    {analytics.topCategories.map((cat: any, i: number) => {
                      const pct = total > 0 ? Math.round((Number(cat.revenue) / total) * 100) : 0;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600">{cat.category || 'Uncategorised'}</span>
                            <span className="text-slate-900">{pct}% · ₹{Number(cat.revenue).toLocaleString()}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── NEW INVOICE MODAL ── */}
      <Modal isOpen={showInvoiceModal} title="Create Wholesale Invoice" onClose={() => setShowInvoiceModal(false)} size="xl">
        <form onSubmit={handleCreateInvoice} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Distributor *</label>
              <select required className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                value={invoiceForm.party_id}
                onChange={(e) => { const p = (partiesData || []).find((x: any) => x.id === e.target.value); setInvoiceForm({ ...invoiceForm, party_id: e.target.value, party_name: p?.name || '' }); }}>
                <option value="">Select Distributor</option>
                {(partiesData || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date *</label>
              <input required type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={invoiceForm.invoice_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Payment Mode</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2"
                value={invoiceForm.payment_mode} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_mode: e.target.value })}>
                <option value="Credit">Credit (Post to Ledger)</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/60">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase">Add Product</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Scheme:</span>
                <button type="button" onClick={() => handleSchemeToggle('none')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${pendingItem.scheme_type === 'none' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-500'}`}>
                  None
                </button>
                <button type="button" onClick={() => handleSchemeToggle('10+7')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${pendingItem.scheme_type === '10+7' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-300 hover:border-emerald-400'}`}>
                  10+7 Free
                </button>
                {pendingItem.scheme_type === '10+7' && (
                  <span className="text-[10px] text-emerald-600 font-bold">
                    Eff. price = MRP×10÷17
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">Product</label>
                <select className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.product_id} onChange={(e) => handleProductSelect(e.target.value)}>
                  <option value="">Select product...</option>
                  {(productsData || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">Qty</label>
                <input type="number" min="1" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.quantity} onChange={(e) => setPendingItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">PTR (₹)</label>
                <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.rate} onChange={(e) => setPendingItem(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-slate-400 font-bold mb-1">GST %</label>
                <input type="number" min="0" max="28" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={pendingItem.gst_percent} onChange={(e) => setPendingItem(prev => ({ ...prev, gst_percent: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-1">
                <button type="button" onClick={handleAddItem} className="w-full py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-sky-600">+ Add</button>
              </div>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-center w-20">Boxes</th>
                  <th className="px-4 py-2 text-center w-32">Scheme</th>
                  <th className="px-4 py-2 text-right w-28">Eff. PTR</th>
                  <th className="px-4 py-2 text-right w-20">GST%</th>
                  <th className="px-4 py-2 text-right w-32">Amount</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoiceForm.items.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No items yet. Use picker above.</td></tr>
                ) : invoiceForm.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.name}</div>
                      {item.scheme_type === '10+7' && item.mrp > 0 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">MRP ₹{parseFloat(item.mrp).toFixed(2)}/strip · Eff ₹{item.rate}/strip</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                    <td className="px-4 py-2 text-center">
                      {item.scheme_type === '10+7'
                        ? <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">10 paid + 7 free</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">₹{parseFloat(item.rate).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{item.gst_percent}%</td>
                    <td className="px-4 py-2 text-right font-semibold">₹{(item.quantity * item.rate).toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                    <td className="px-4 py-2 text-center">
                      <button type="button" onClick={() => { const ni = [...invoiceForm.items]; ni.splice(idx, 1); setInvoiceForm({ ...invoiceForm, items: ni }); }} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {invoiceForm.items.length > 0 && (
                <tfoot className="bg-slate-50 text-sm">
                  <tr><td colSpan={5} className="px-4 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Taxable Amount</td><td className="px-4 py-2 text-right font-bold">₹{invoiceSubTotal.toLocaleString()}</td><td /></tr>
                  <tr><td colSpan={5} className="px-4 py-2 text-right text-[10px] font-bold uppercase text-orange-500">+ GST</td><td className="px-4 py-2 text-right font-bold text-orange-500">₹{invoiceTotalGst.toFixed(2)}</td><td /></tr>
                  <tr className="text-primary"><td colSpan={5} className="px-4 py-3 text-right text-xs font-extrabold uppercase">Net Payable</td><td className="px-4 py-3 text-right text-base font-extrabold">₹{(invoiceSubTotal + invoiceTotalGst).toLocaleString()}</td><td /></tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="pt-4 border-t flex justify-between items-center">
            <p className="text-slate-400 text-xs">Invoice posted under <span className="font-mono font-bold text-slate-600">WHO-</span> prefix.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowInvoiceModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={isSaving || invoiceForm.items.length === 0}
                className="px-8 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />} Finalize & Post
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── INVOICE DETAILS + PRINT MODAL ── */}
      {showDetailsModal && inv && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-sky-400" />
                <span className="font-bold text-white font-mono">{inv.invoice_no}</span>
                <Badge text={inv.status} variant={inv.status === 'Completed' ? 'success' : inv.status === 'Cancelled' ? 'danger' : 'warning'} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-1.5 bg-sky-500 text-white text-sm font-bold rounded-lg hover:bg-sky-400 transition-colors">
                  <Printer size={15} /> Print Invoice
                </button>
                <button onClick={() => setShowDetailsModal(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><X size={18} /></button>
              </div>
            </div>

            {/* Printable content */}
            <div ref={printRef} className="p-6 space-y-5">
              {/* Company Header */}
              <div className="flex items-start justify-between border-b-2 border-sky-500 pb-5">
                <div className="flex items-start gap-4">
                  <img src={COMPANY.logo} alt="Logo" className="h-14 w-14 object-contain border border-slate-200 rounded-xl p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <div>
                    <div className="text-xl font-black text-sky-600 tracking-tight">{COMPANY.name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1"><MapPin size={10} /> {COMPANY.address}</div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1"><Phone size={10} /> {COMPANY.phone}</span>
                      <span className="flex items-center gap-1"><Mail size={10} /> {COMPANY.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1"><Hash size={9} /> GSTIN: {COMPANY.gstin}</span>
                      <span>DL: {COMPANY.dl}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-slate-800 tracking-widest uppercase">Invoice</div>
                  <div className="font-mono font-bold text-sky-600 text-sm mt-1">{inv.invoice_no}</div>
                  <div className="text-xs text-slate-500 mt-1">Date: <strong>{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                  <div className="text-xs text-slate-500">Mode: <strong>{inv.payment_mode || 'Credit'}</strong></div>
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><Building2 size={9} /> Bill To</p>
                  <p className="font-bold text-slate-800 text-base">{inv.party_name}</p>
                </div>
                <div className="bg-sky-50 rounded-xl p-4 border border-sky-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sky-400 mb-2">Summary</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-slate-500">Items:</span><span className="font-bold text-right">{inv.item_count || '—'}</span>
                    <span className="text-slate-500">Taxable:</span><span className="font-bold text-right">₹{invSubTotal.toLocaleString()}</span>
                    <span className="text-slate-500">GST:</span><span className="font-bold text-right text-orange-600">₹{invGst.toLocaleString()}</span>
                    <span className="text-sky-600 font-black">Net:</span><span className="font-black text-sky-600 text-right">₹{invNet.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 bg-slate-800 text-white rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Sub Total</span><span className="font-bold">₹{invSubTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-orange-300">GST</span><span className="font-bold text-orange-300">₹{invGst.toLocaleString()}</span></div>
                  <div className="border-t border-slate-600 pt-2 flex justify-between text-sky-400 font-black text-base">
                    <span>Net Payable</span><span>₹{invNet.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <div className="border-t border-slate-200 pt-4 flex justify-between items-end text-[10px] text-slate-400">
                <span>This is a computer-generated invoice. No signature required.</span>
                <span className="font-mono">{COMPANY.name}</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 rounded-b-2xl">
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-white">
                <Download size={15} /> Export CSV
              </button>
              <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </ERPLayout>
  );
};

export default Sales;
