import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, FileText, Printer, Download, Eye, Pencil, Trash2, RefreshCcw,
  X, AlertCircle, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight,
  ChevronLeft, ChevronRight, TrendingUp, Receipt, BarChart2, Percent,
  RotateCcw, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { printPOSInvoice, exportPOSInvoiceToExcel } from '../utils/accountingExport';
import { useAppStore } from '../store/useAppStore';
import { Tab, SalesInvoice } from '../types';
import apiClient from '../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────
interface InvoiceStats {
  total_invoices: number;
  total_revenue: number;
  avg_order_value: number;
  total_gst_collected: number;
  returns_count: number;
  monthly_trend: { month: string; invoice_count: number; revenue: number }[];
  payment_breakdown: { payment_mode: string; cnt: number; total: number }[];
  generated_at: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  date: string;
  customer_name: string;
  payment_mode: string;
  sub_total: number;
  total_gst: number;
  net_amount: number;
  status: string;
  source_type?: string;
  created_by_name?: string;
}

type SortField = 'date' | 'invoice_number' | 'net_amount' | 'customer_name';
type SortOrder = 'asc' | 'desc';

const PAYMENT_MODES = ['All', 'Cash', 'UPI', 'Credit Card', 'Bank', 'Cheque'];
const STATUS_OPTIONS = ['All', 'Completed', 'Returned', 'CreditNote', 'Cancelled'];
const SOURCE_TYPES = ['All', 'POS', 'PCD', 'OMS'];
const PAGE_SIZES = [25, 50, 100];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const paymentBadge = (mode: string) => {
  const map: Record<string, string> = {
    Cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    UPI: 'bg-violet-50 text-violet-700 border-violet-200',
    'Credit Card': 'bg-blue-50 text-blue-700 border-blue-200',
    Bank: 'bg-sky-50 text-sky-700 border-sky-200',
    Cheque: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return map[mode] || 'bg-slate-50 text-slate-600 border-slate-200';
};

const statusBadge = (status: string) => {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    Completed: { cls: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 size={10} /> },
    Returned:  { cls: 'bg-rose-50 text-rose-700',       icon: <RotateCcw size={10} /> },
    CreditNote:{ cls: 'bg-amber-50 text-amber-700',     icon: <Receipt size={10} /> },
    Cancelled: { cls: 'bg-slate-100 text-slate-500',    icon: <XCircle size={10} /> },
  };
  return map[status] || { cls: 'bg-slate-50 text-slate-500', icon: <Clock size={10} /> };
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: string; loading: boolean;
}> = ({ icon, label, value, sub, color, loading }) => (
  <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-4 shadow-sm min-w-0">
    <div className={`p-2.5 rounded-xl shrink-0 ${color}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
      {loading
        ? <div className="h-5 w-24 bg-slate-100 animate-pulse rounded mt-1" />
        : <p className="text-lg font-black text-slate-800 leading-tight">{value}</p>}
      {sub && !loading && <p className="text-[10px] text-slate-400 font-bold">{sub}</p>}
    </div>
  </div>
);

// ─── Sort Header ──────────────────────────────────────────────────────────────
const SortTh: React.FC<{
  label: string; field: SortField; sortBy: SortField; sortOrder: SortOrder;
  onSort: (f: SortField) => void; className?: string;
}> = ({ label, field, sortBy, sortOrder, onSort, className = '' }) => (
  <th
    className={`p-4 border-b cursor-pointer select-none hover:bg-slate-100 transition-colors group ${className}`}
    onClick={() => onSort(field)}
  >
    <span className="flex items-center gap-1">
      {label}
      <span className="opacity-40 group-hover:opacity-100 transition-opacity">
        {sortBy === field
          ? sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronDown size={12} className="opacity-30" />}
      </span>
    </span>
  </th>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const SalesHistoryPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const { setActiveTab } = useAppStore();

  // Data
  const [invoices, setInvoices]       = useState<InvoiceRow[]>([]);
  const [stats, setStats]             = useState<InvoiceStats | null>(null);
  const [total, setTotal]             = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);

  // UI state
  const [loadingList, setLoadingList] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [returnModal, setReturnModal] = useState<{ open: boolean; invoiceId: string; invoiceNo: string } | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string } | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [paymentMode, setPaymentMode] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [sortBy, setSortBy]           = useState<SortField>('date');
  const [sortOrder, setSortOrder]     = useState<SortOrder>('desc');
  const [page, setPage]               = useState(0);
  const [pageSize, setPageSize]       = useState(50);

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ── Fetch list & stats together ──────────────────────────────────────────
  const fetchAll = useCallback(async (resetPage = false) => {
    const effectivePage = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    setLoadingList(true);
    setLoadingStats(true);

    const params = new URLSearchParams({
      page: String(effectivePage),
      limit: String(pageSize),
      sort_by: sortBy,
      sort_order: sortOrder,
      ...(search       && { search }),
      ...(dateFrom     && { date_from: dateFrom }),
      ...(dateTo       && { date_to: dateTo }),
      ...(paymentMode !== 'All' && { payment_mode: paymentMode }),
      ...(statusFilter !== 'All' && { status: statusFilter }),
      ...(sourceFilter !== 'All' && { source_type: sourceFilter }),
    });

    const statsParams = new URLSearchParams({
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo   && { date_to: dateTo }),
    });

    const [listResult, statsResult] = await Promise.allSettled([
      apiClient.get(`/api/pos/invoices?${params}`),
      apiClient.get(`/api/pos/invoices/stats?${statsParams}`),
    ]);

    if (listResult.status === 'fulfilled') {
      const resp = listResult.value as any;
      setInvoices(resp.data || []);
      setTotal(resp.total || 0);
    } else {
      addNotification({ type: 'error', title: 'Load Error', message: 'Failed to load invoices.', priority: 'high' });
    }
    if (statsResult.status === 'fulfilled') {
      const resp = statsResult.value as any;
      setStats(resp.data || resp);
    }

    setLoadingList(false);
    setLoadingStats(false);
  }, [page, pageSize, sortBy, sortOrder, search, dateFrom, dateTo, paymentMode, statusFilter, sourceFilter]);

  useEffect(() => { fetchAll(true); }, [search, dateFrom, dateTo, paymentMode, statusFilter, sourceFilter, sortBy, sortOrder, pageSize]);
  useEffect(() => { fetchAll(); }, [page]);

  // 60-second auto-refresh (§17D)
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => fetchAll(), 60_000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchAll]);

  // ── Sort handler ──────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (field === sortBy) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  // ── View invoice detail ───────────────────────────────────────────────────
  const handleView = async (id: string) => {
    setLoadingDetail(true);
    try {
      const r = await apiClient.get(`/api/pos/invoices/${id}`);
      const d = r.data;
      setSelectedInvoice(d.data || d);
      setShowPreview(true);
    } catch {
      addNotification({ type: 'error', title: 'Error', message: 'Could not load invoice details.', priority: 'medium' });
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await apiClient.delete(`/api/pos/invoices/${confirmDelete.id}`);
      addNotification({ type: 'success', title: 'Deleted', message: 'Invoice removed.', priority: 'medium' });
      fetchAll(true);
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Delete Failed', message: e?.response?.data?.error || e.message, priority: 'high' });
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  // ── Sales Return ──────────────────────────────────────────────────────────
  const handleReturn = async () => {
    if (!returnModal) return;
    setProcessingReturn(true);
    try {
      await apiClient.post(`/api/pos/invoices/${returnModal.invoiceId}/return`, { reason: returnReason || 'Sales Return' });
      addNotification({ type: 'success', title: 'Return Processed', message: `Credit note created for ${returnModal.invoiceNo}.`, priority: 'medium' });
      setReturnModal(null);
      setReturnReason('');
      fetchAll(true);
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Return Failed', message: e?.response?.data?.error || e.message, priority: 'high' });
    } finally {
      setProcessingReturn(false);
    }
  };

  // ── Bulk CSV Export ───────────────────────────────────────────────────────
  const handleBulkExport = () => {
    if (invoices.length === 0) return;
    const headers = ['Invoice No', 'Customer', 'Date', 'Payment Mode', 'Gross Amount', 'GST', 'Net Amount', 'Status'];
    const rows = invoices.map(inv => [
      inv.invoice_number, inv.customer_name, formatDate(inv.date),
      inv.payment_mode,
      inv.sub_total, inv.total_gst, inv.net_amount, inv.status
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sales-register-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Bulk Print ────────────────────────────────────────────────────────────
  const handleBulkPrint = () => {
    const rows = invoices.map(inv =>
      `<tr><td>${inv.invoice_number}</td><td>${inv.customer_name}</td><td>${formatDate(inv.date)}</td>` +
      `<td>${inv.payment_mode}</td><td style="text-align:right">${formatCurrency(inv.sub_total)}</td>` +
      `<td style="text-align:right">${formatCurrency(inv.total_gst)}</td>` +
      `<td style="text-align:right">${formatCurrency(inv.net_amount)}</td>` +
      `<td>${inv.status}</td></tr>`
    ).join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Sales Register</title><style>
      body{font-family:sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ccc;padding:4px 8px}th{background:#1D3557;color:white}
    </style></head><body>
      <h2 style="color:#1D3557">Complete Sales Register</h2>
      <p>Exported: ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Invoice No</th><th>Customer</th><th>Date</th><th>Payment</th>
      <th>Gross Amount</th><th>GST</th><th>Net Amount</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.print();
  };

  const clearFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo('');
    setPaymentMode('All'); setStatusFilter('All'); setSourceFilter('All');
  };
  const hasFilters = search || dateFrom || dateTo || paymentMode !== 'All' || statusFilter !== 'All' || sourceFilter !== 'All';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden" data-testid="sales-register">

      {/* ── Header ── */}
      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl"><FileText size={22} /></div>
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Complete Sales Register</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master record of all POS & Billing transactions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchAll()}
            disabled={loadingList}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all"
            title="Refresh"
            data-testid="refresh-btn"
          >
            <RefreshCcw size={15} className={loadingList ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleBulkExport} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all" title="Export CSV" data-testid="export-btn">
            <Download size={15} />
          </button>
          <button onClick={handleBulkPrint} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all" title="Print Register">
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0" data-testid="kpi-bar">
        <KpiCard icon={<TrendingUp size={16} />}  label="Total Revenue"    value={formatCurrency(stats?.total_revenue ?? 0)}      color="bg-blue-50 text-blue-600"    loading={loadingStats} />
        <KpiCard icon={<Receipt size={16} />}      label="Total Invoices"   value={String(stats?.total_invoices ?? 0)}             color="bg-violet-50 text-violet-600" loading={loadingStats} sub={`${stats?.returns_count ?? 0} returns`} />
        <KpiCard icon={<BarChart2 size={16} />}    label="Avg Order Value"  value={formatCurrency(stats?.avg_order_value ?? 0)}    color="bg-emerald-50 text-emerald-600" loading={loadingStats} />
        <KpiCard icon={<Percent size={16} />}      label="GST Collected"    value={formatCurrency(stats?.total_gst_collected ?? 0)} color="bg-amber-50 text-amber-600"  loading={loadingStats} />
      </div>

      {/* ── Filters ── */}
      <div className="px-5 py-3 border-b border-slate-100 bg-white shrink-0 flex flex-wrap gap-2 items-center" data-testid="filters">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Invoice No or Customer..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            data-testid="search-input"
          />
        </div>
        {/* Date from */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400"
            data-testid="date-from" />
        </div>
        {/* Date to */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black text-slate-400 uppercase">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400"
            data-testid="date-to" />
        </div>
        {/* Payment mode */}
        <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
          className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400"
          data-testid="payment-filter">
          {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
        </select>
        {/* Status */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400"
          data-testid="status-filter">
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        {/* Source type */}
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
          className="px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400"
          data-testid="source-filter">
          {SOURCE_TYPES.map(s => <option key={s}>{s === 'All' ? 'All Sources' : s}</option>)}
        </select>
        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-2 text-[10px] font-black text-red-500 bg-red-50 hover:bg-red-100 rounded-lg uppercase tracking-wide transition-colors"
            data-testid="clear-filters">
            Clear Filters
          </button>
        )}
        {/* Result count + page size */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase">{total} records</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}/page</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto" data-testid="invoice-table">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
            <tr>
              <SortTh label="Invoice No" field="invoice_number" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="p-4" />
              <SortTh label="Customer"   field="customer_name"  sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="p-4" />
              <SortTh label="Date"       field="date"           sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="p-4" />
              <th className="p-4 border-b">Payment</th>
              <SortTh label="Gross Amount" field="net_amount"   sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="p-4 text-right" />
              <th className="p-4 border-b text-right">GST</th>
              <SortTh label="Net Amount" field="net_amount"     sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} className="p-4 text-right" />
              <th className="p-4 border-b">Status</th>
              <th className="p-4 border-b text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loadingList ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="p-4">
                      <div className="h-3 bg-slate-100 animate-pulse rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Receipt size={32} className="text-slate-200" />
                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No invoices found</p>
                    {hasFilters && (
                      <button onClick={clearFilters} className="text-xs font-bold text-blue-500 hover:text-blue-700">
                        Clear filters to see all invoices
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : invoices.map(inv => {
              const sb = statusBadge(inv.status);
              return (
                <tr
                  key={inv.id}
                  onClick={() => handleView(inv.id)}
                  className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                  data-testid={`invoice-row-${inv.id}`}
                >
                  <td className="p-4 font-mono text-xs font-bold text-blue-700 group-hover:underline">{inv.invoice_number}</td>
                  <td className="p-4 text-xs font-bold text-slate-700">{inv.customer_name}</td>
                  <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{formatDate(inv.date)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${paymentBadge(inv.payment_mode)}`}>
                      {inv.payment_mode}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-bold text-right tabular-nums">{formatCurrency(inv.sub_total)}</td>
                  <td className="p-4 text-xs text-right tabular-nums text-blue-600">{formatCurrency(inv.total_gst)}</td>
                  <td className="p-4 text-xs font-black text-right tabular-nums">{formatCurrency(inv.net_amount)}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${sb.cls}`}>
                      {sb.icon}{inv.status}
                    </span>
                  </td>
                  <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-center gap-1">
                      <button onClick={() => handleView(inv.id)} disabled={loadingDetail}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all" title="View" data-testid={`view-${inv.id}`}>
                        <Eye size={13} />
                      </button>
                      <button onClick={() => setActiveTab(Tab.POS)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Edit in POS">
                        <Pencil size={13} />
                      </button>
                      {inv.status === 'Completed' && (
                        <button
                          onClick={() => setReturnModal({ open: true, invoiceId: inv.id, invoiceNo: inv.invoice_number })}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-all" title="Sales Return"
                          data-testid={`return-${inv.id}`}>
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete({ open: true, id: inv.id })}
                        disabled={deletingId === inv.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all" title="Delete"
                        data-testid={`delete-${inv.id}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {total > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 flex items-center justify-between shrink-0" data-testid="pagination">
          <span className="text-[10px] font-black text-slate-400 uppercase">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={page === 0} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronsLeft size={14} /></button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
            <span className="px-3 py-1 text-xs font-black text-slate-600">
              {page + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronsRight size={14} /></button>
          </div>
        </div>
      )}

      {/* ── Invoice Preview Modal ── */}
      {showPreview && selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-testid="invoice-preview">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-[#1D3557] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg"><FileText size={18} /></div>
                <div>
                  <h3 className="font-black text-base">Tax Invoice</h3>
                  <p className="text-xs text-blue-200 font-bold tracking-widest uppercase">
                    {selectedInvoice.invoiceNumber || (selectedInvoice as any).invoice_number}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors" data-testid="close-preview"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                {/* Company Header */}
                <div className="flex justify-between items-start border-b border-dashed border-slate-100 pb-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#1D3557] rounded-xl flex items-center justify-center text-white font-black text-lg">M</div>
                      <div>
                        <h2 className="text-lg font-black text-[#1D3557]">Metapharsic Enterprise Hub</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Enterprise Pharma Distribution & Accounting</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 font-bold space-y-0.5">
                      <p>H-12, Industrial Area, Phase II, New Delhi – 110020</p>
                      <p>GSTIN: 07AAMCM4321A1Z9</p>
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <h1 className="text-3xl font-black text-slate-100 uppercase tracking-tighter">Tax Invoice</h1>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 inline-block text-left">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Inv No:</span>
                        <span className="text-xs font-black text-blue-700">{selectedInvoice.invoiceNumber || (selectedInvoice as any).invoice_number}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Date:</span>
                        <span className="text-xs font-black text-slate-800">{formatDate(selectedInvoice.date || (selectedInvoice as any).invoice_date)}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase">Status:</span>
                        <span className={`text-[9px] font-black uppercase ${statusBadge((selectedInvoice as any).status || 'Completed').cls}`}>
                          {(selectedInvoice as any).status || 'Completed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 border-b border-blue-50 pb-1">Bill To</h4>
                    <h3 className="font-black text-slate-800">{selectedInvoice.customerName || (selectedInvoice as any).customer_name}</h3>
                    {selectedInvoice.customerGstin && <p className="text-xs text-slate-400 font-bold mt-1">GSTIN: {selectedInvoice.customerGstin}</p>}
                    {(selectedInvoice as any).payment_mode && (
                      <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-black border ${paymentBadge((selectedInvoice as any).payment_mode)}`}>
                        {(selectedInvoice as any).payment_mode}
                      </span>
                    )}
                  </div>
                  {selectedInvoice.doctorName && (
                    <div>
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1">Prescribed By</h4>
                      <p className="text-xs font-bold text-slate-700">Dr. {selectedInvoice.doctorName}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#1D3557] text-white text-[9px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3 w-28 border-l border-white/10 text-center">Batch</th>
                        <th className="p-3 w-16 border-l border-white/10 text-center">Qty</th>
                        <th className="p-3 w-20 border-l border-white/10 text-right">Rate</th>
                        <th className="p-3 w-28 border-l border-white/10 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {selectedInvoice.items?.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <p className="text-xs font-black text-slate-800">{item.product_name || item.productName || 'Product'}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{item.product_code || item.generic_name || ''}</p>
                          </td>
                          <td className="p-3 text-center border-l border-slate-100">
                            <span className="font-mono text-[10px] font-bold text-blue-600">{item.batch_number || item.batchNumber || '—'}</span>
                          </td>
                          <td className="p-3 text-center text-xs font-black border-l border-slate-100">{item.quantity}</td>
                          <td className="p-3 text-right text-xs font-bold border-l border-slate-100">{formatCurrency(item.rate)}</td>
                          <td className="p-3 text-right text-xs font-black border-l border-slate-100 text-[#1D3557]">
                            {formatCurrency(item.total_amount || item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-xs text-slate-500 font-bold">
                      <span>Gross Amount</span><span>{formatCurrency(selectedInvoice.taxableValue || (selectedInvoice as any).sub_total)}</span>
                    </div>
                    {(() => {
                      const gst = selectedInvoice.totalGst || (selectedInvoice as any).total_gst || 0;
                      const half = gst / 2;
                      return gst > 0 ? (
                        <>
                          <div className="flex justify-between text-xs text-slate-400 font-bold pl-2">
                            <span>CGST</span><span className="text-blue-500">+ {formatCurrency(half)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400 font-bold pl-2">
                            <span>SGST</span><span className="text-blue-500">+ {formatCurrency(half)}</span>
                          </div>
                        </>
                      ) : null;
                    })()}
                    <div className="flex justify-between text-xs text-slate-500 font-bold">
                      <span>Total GST</span><span className="text-blue-600">+ {formatCurrency(selectedInvoice.totalGst || (selectedInvoice as any).total_gst)}</span>
                    </div>
                    {(selectedInvoice.totalDiscount || (selectedInvoice as any).total_discount) > 0 && (
                      <div className="flex justify-between text-xs text-emerald-600 font-bold">
                        <span>Discount</span><span>− {formatCurrency(selectedInvoice.totalDiscount || (selectedInvoice as any).total_discount)}</span>
                      </div>
                    )}
                    <div className="h-px bg-slate-100" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#1D3557] uppercase tracking-widest">Net Payable</span>
                      <span className="text-xl font-black text-[#1D3557]">{formatCurrency(selectedInvoice.netAmount || (selectedInvoice as any).net_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex justify-end gap-2 border-t border-slate-200">
              {(selectedInvoice as any).status === 'Completed' && (
                <button
                  onClick={() => {
                    setShowPreview(false);
                    const id = selectedInvoice.id || (selectedInvoice as any).id;
                    const no = selectedInvoice.invoiceNumber || (selectedInvoice as any).invoice_number;
                    setReturnModal({ open: true, invoiceId: id, invoiceNo: no });
                  }}
                  className="px-4 py-2 bg-teal-600 text-white text-xs font-black uppercase rounded shadow-sm flex items-center gap-1.5 hover:bg-teal-700"
                >
                  <RotateCcw size={13} /> Sales Return
                </button>
              )}
              <button onClick={() => printPOSInvoice(selectedInvoice, null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-black uppercase rounded shadow-sm flex items-center gap-1.5 hover:bg-slate-50">
                <Printer size={13} /> Print
              </button>
              <button onClick={() => exportPOSInvoiceToExcel(selectedInvoice)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-black uppercase rounded shadow-sm flex items-center gap-1.5 hover:bg-slate-50">
                <Download size={13} /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sales Return Modal ── */}
      {returnModal?.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-testid="return-modal">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-teal-700 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2"><RotateCcw size={16} /><h3 className="font-black uppercase tracking-wide text-sm">Sales Return</h3></div>
              <button onClick={() => { setReturnModal(null); setReturnReason(''); }}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-slate-600">
                Creating a credit note for invoice <span className="font-black text-teal-700">{returnModal.invoiceNo}</span>.
                Original invoice will be marked as Returned.
              </p>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Return Reason</label>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Product damaged, Customer changed mind..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 resize-none"
                  data-testid="return-reason"
                />
              </div>
            </div>
            <div className="bg-slate-50 p-4 flex justify-end gap-2 border-t">
              <button onClick={() => { setReturnModal(null); setReturnReason(''); }}
                className="px-4 py-2 text-xs font-black uppercase text-slate-600">Cancel</button>
              <button
                onClick={handleReturn}
                disabled={processingReturn}
                className="px-5 py-2 bg-teal-600 text-white text-xs font-black uppercase rounded shadow-sm flex items-center gap-1.5 hover:bg-teal-700 disabled:opacity-60"
                data-testid="confirm-return">
                {processingReturn ? <><RefreshCcw size={12} className="animate-spin" /> Processing...</> : <><CheckCircle2 size={12} /> Confirm Return</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete?.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" data-testid="delete-modal">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#1D3557] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2"><AlertCircle size={16} className="text-amber-400" /><h3 className="font-black text-sm">Confirm Delete</h3></div>
              <button onClick={() => setConfirmDelete(null)}><X size={18} /></button>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold text-slate-600">Delete this invoice? Stock will be restored and accounting entries reversed. This cannot be undone.</p>
            </div>
            <div className="bg-slate-50 p-4 flex justify-end gap-2 border-t">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-xs font-black uppercase text-slate-600">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={!!deletingId}
                className="px-5 py-2 bg-red-600 text-white text-xs font-black uppercase rounded shadow-sm flex items-center gap-1.5 hover:bg-red-700 disabled:opacity-60"
                data-testid="confirm-delete">
                {deletingId ? <><RefreshCcw size={12} className="animate-spin" /> Deleting...</> : <><Trash2 size={12} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistoryPage;
