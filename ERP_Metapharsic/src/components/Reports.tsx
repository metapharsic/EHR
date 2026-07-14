import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import {
  FileBarChart, ArrowDown, ArrowUp, Download, AlertCircle, FileText,
  Calendar, ShoppingBag, TrendingUp, Users, Map, Briefcase, Percent,
  BarChart3, RefreshCw, Loader2
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import PowerBIReports from './PowerBIReports';

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardSummary {
  accounts: { totalAssets: number; totalLiabilities: number; totalIncome: number; totalExpense: number; netProfit: number; workingCapital: number };
  inventory: { totalProducts: number; totalUnits: number; totalStockValue: number; lowStockProducts: number };
  pcd: { activePartners: number; totalPartners: number; verifiedSales: number };
  crm: { totalLeads: number; convertedLeads: number };
  sales: { totalInvoices: number; todaySales: number; monthSales: number };
  dms: { totalDocuments: number; expiringDocuments: number };
}

interface DailyStat {
  date: string;
  invoiceCount: number;
  revenue: number;
  grossProfit: number;
  marginPercentage: number;
}

interface GstR1Row {
  partyName: string;
  invoiceNo: string;
  invoiceDate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  totalValue: number;
}

interface Gstr3bSummary {
  outwardTaxableSupplies: number;
  totalIgst: number;
  totalCgst: number;
  totalSgst: number;
  netPayable: number;
  itcAvailable: number;
}

interface PurchaseStat {
  totalPurchases: number;
  pendingOrders: number;
  purchases: { id: string; invoice_no: string; supplier_name: string; total_amount: number; status: string; date: string }[];
}

interface InventoryProduct {
  name: string;
  current_stock: number;
  mrp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtK = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : fmt(n);

const ReportCard = ({ title, value, icon, trend }: { title: string; value: string; icon: React.ReactNode; trend?: number }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-50 rounded-lg text-slate-600">{icon}</div>
      {trend !== undefined && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-slate-500 text-sm mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
  </div>
);

const EmptyState = ({ msg }: { msg: string }) => (
  <div className="py-16 text-center text-slate-400">
    <FileText size={40} className="mx-auto mb-3 opacity-30" />
    <p className="text-sm">{msg}</p>
  </div>
);

const Spinner = () => (
  <div className="py-16 flex justify-center">
    <Loader2 className="animate-spin text-slate-400" size={28} />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SALES' | 'GST' | 'SUPPLIER' | 'POWERBI' | 'AI_REPORT'>('OVERVIEW');
  const [salesReportType, setSalesReportType] = useState<'DAILY' | 'MONTHLY' | 'PRODUCT' | 'FIELD_FORCE'>('DAILY');

  // Data state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [gstr1, setGstr1] = useState<GstR1Row[]>([]);
  const [gstr3b, setGstr3b] = useState<Gstr3bSummary | null>(null);
  const [purchases, setPurchases] = useState<PurchaseStat | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);

  // Loading / error
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingGst, setLoadingGst] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // AI Report
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ── Fetch: Overview ──────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await apiClient.get('/reports/dashboard-summary');
      if (res?.success) setSummary(res.data);
    } catch (e) {
      console.error('Overview fetch failed', e);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // ── Fetch: Daily Sales (last 30 days) ────────────────────────────────────
  const fetchDailySales = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const res = await apiClient.get(`/accounting/daily-sales-analytics?startDate=${start}&endDate=${end}`);
      if (res?.success) {
        const rows: DailyStat[] = (res.data?.stats || []).map((r: any) => ({
          date: r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
          invoiceCount: Number(r.invoice_count || 0),
          revenue: parseFloat(r.revenue || 0),
          grossProfit: parseFloat(r.gross_profit || 0),
          marginPercentage: parseFloat(r.margin_percentage || 0),
        }));
        setDailyStats(rows.reverse()); // oldest → newest for chart
      }
    } catch (e) {
      console.error('Daily sales fetch failed', e);
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  // ── Fetch: Products (for product-wise) ───────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await apiClient.get('/reports/inventory');
      if (res?.success) setProducts((res.data?.products || []).slice(0, 15));
    } catch (e) {
      console.error('Products fetch failed', e);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // ── Fetch: GST ───────────────────────────────────────────────────────────
  const fetchGst = useCallback(async () => {
    setLoadingGst(true);
    try {
      const [r1Res, r3bRes] = await Promise.allSettled([
        apiClient.get('/gst/gstr1'),
        apiClient.get('/gst/gstr3b'),
      ]);
      if (r1Res.status === 'fulfilled' && r1Res.value?.success) setGstr1(r1Res.value.data || []);
      if (r3bRes.status === 'fulfilled' && r3bRes.value?.success) {
        const d = r3bRes.value.data;
        setGstr3b({
          outwardTaxableSupplies: parseFloat(d?.outwardTaxableSupplies ?? d?.taxable_value ?? 0),
          totalIgst: parseFloat(d?.totalIgst ?? d?.igst ?? 0),
          totalCgst: parseFloat(d?.totalCgst ?? d?.cgst ?? 0),
          totalSgst: parseFloat(d?.totalSgst ?? d?.sgst ?? 0),
          netPayable: parseFloat(d?.netPayable ?? d?.net_payable ?? 0),
          itcAvailable: parseFloat(d?.itcAvailable ?? d?.itc_available ?? 0),
        });
      }
    } catch (e) {
      console.error('GST fetch failed', e);
    } finally {
      setLoadingGst(false);
    }
  }, []);

  // ── Fetch: Supplier outstanding ──────────────────────────────────────────
  const fetchSupplier = useCallback(async () => {
    setLoadingSupplier(true);
    try {
      const res = await apiClient.get('/reports/purchase?limit=20');
      if (res?.success) setPurchases(res.data);
    } catch (e) {
      console.error('Supplier fetch failed', e);
    } finally {
      setLoadingSupplier(false);
    }
  }, []);

  // ── Tab-driven loading ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'OVERVIEW' && !summary) fetchOverview();
  }, [activeTab, summary, fetchOverview]);

  useEffect(() => {
    if (activeTab === 'SALES') {
      if (salesReportType === 'DAILY' || salesReportType === 'MONTHLY') {
        if (dailyStats.length === 0) fetchDailySales();
      }
      if (salesReportType === 'PRODUCT' && products.length === 0) fetchProducts();
    }
  }, [activeTab, salesReportType, dailyStats.length, products.length, fetchDailySales, fetchProducts]);

  useEffect(() => {
    if (activeTab === 'GST' && gstr1.length === 0 && !gstr3b) fetchGst();
  }, [activeTab, gstr1.length, gstr3b, fetchGst]);

  useEffect(() => {
    if (activeTab === 'SUPPLIER' && !purchases) fetchSupplier();
  }, [activeTab, purchases, fetchSupplier]);

  // ── Monthly aggregation from daily data ──────────────────────────────────
  const monthlyData = React.useMemo(() => {
    const map: Record<string, { month: string; revenue: number; profit: number }> = {};
    dailyStats.forEach(d => {
      const parts = d.date.split(' ');
      const key = parts[1] || d.date;
      if (!map[key]) map[key] = { month: key, revenue: 0, profit: 0 };
      map[key].revenue += d.revenue;
      map[key].profit += d.grossProfit;
    });
    return Object.values(map);
  }, [dailyStats]);

  // ── Category pie from summary ─────────────────────────────────────────────
  const categoryData = summary ? [
    { name: 'Inventory Assets', value: Math.round(summary.inventory.totalStockValue / 1000) },
    { name: 'PCD Sales', value: Math.round(summary.pcd.verifiedSales / 1000) },
    { name: 'Direct Sales', value: Math.round(summary.sales.monthSales / 1000) },
    { name: 'CRM Leads', value: summary.crm.totalLeads },
  ].filter(c => c.value > 0) : [];

  // ── AI Report ─────────────────────────────────────────────────────────────
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
      const data = await apiClient.post('/reports/ai-generate', { query: aiQuery });
      if (data?.success) setAiResult(data.data);
    } catch (error) {
      console.error('AI Report failed', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (activeTab === 'GST' && gstr1.length > 0) {
      const headers = ['Party', 'Invoice No', 'Date', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total GST', 'Total Value'];
      const rows = gstr1.map(r => [r.partyName, r.invoiceNo, r.invoiceDate, r.taxableValue, r.cgst, r.sgst, r.igst, r.totalGst, r.totalValue]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `GSTR1_${new Date().toISOString().slice(0, 7)}.csv`;
      a.click();
    } else if (activeTab === 'SALES' && dailyStats.length > 0) {
      const headers = ['Date', 'Invoices', 'Revenue', 'Gross Profit', 'Margin %'];
      const rows = dailyStats.map(d => [d.date, d.invoiceCount, d.revenue.toFixed(2), d.grossProfit.toFixed(2), d.marginPercentage.toFixed(2)]);
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `Sales_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analytics & Reports</h2>
          <div className="flex flex-wrap gap-1 mt-2 bg-white p-1 rounded-lg border border-slate-200 inline-flex">
            {(['OVERVIEW', 'SALES', 'GST', 'SUPPLIER', 'POWERBI', 'AI_REPORT'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                  activeTab === t
                    ? t === 'AI_REPORT' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-white shadow-sm'
                    : t === 'AI_REPORT' ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t === 'OVERVIEW' && <FileBarChart size={12} />}
                {t === 'SALES' && <TrendingUp size={12} />}
                {t === 'GST' && <Percent size={12} />}
                {t === 'SUPPLIER' && <AlertCircle size={12} />}
                {t === 'POWERBI' && <BarChart3 size={12} />}
                {t === 'AI_REPORT' && <FileText size={12} />}
                {t === 'OVERVIEW' ? 'Overview' : t === 'SALES' ? 'Sales Reports' : t === 'GST' ? 'GST & Statutory' : t === 'SUPPLIER' ? 'Outstanding' : t === 'POWERBI' ? 'Power BI' : 'Ask AI'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setSummary(null); setDailyStats([]); setGstr1([]); setGstr3b(null); setPurchases(null); setProducts([]); fetchOverview(); }}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* ── OVERVIEW ───────────────────────────────────────────────────────── */}
      {activeTab === 'OVERVIEW' && (
        <>
          {loadingOverview ? <Spinner /> : !summary ? (
            <EmptyState msg="Could not load summary data." />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ReportCard title="Total Stock Value" value={fmtK(summary.inventory.totalStockValue)} icon={<FileBarChart size={20} />} trend={0} />
                <ReportCard title="Sales This Month" value={fmtK(summary.sales.monthSales)} icon={<ArrowUp size={20} />} />
                <ReportCard title="Today's Sales" value={fmtK(summary.sales.todaySales)} icon={<ShoppingBag size={20} />} />
                <ReportCard title="Net Profit (Est)" value={fmtK(summary.accounts.netProfit)} icon={<TrendingUp size={20} />} trend={summary.accounts.netProfit > 0 ? 8 : -3} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ReportCard title="Working Capital" value={fmtK(summary.accounts.workingCapital)} icon={<Briefcase size={20} />} />
                <ReportCard title="Total Products" value={String(summary.inventory.totalProducts)} icon={<FileBarChart size={20} />} />
                <ReportCard title="Low Stock Alerts" value={String(summary.inventory.lowStockProducts)} icon={<AlertCircle size={20} />} />
                <ReportCard title="Expiring Documents" value={String(summary.dms.expiringDocuments)} icon={<FileText size={20} />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Business Mix</h3>
                  {categoryData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={280} debounce={50}>
                        <PieChart>
                          <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                            {categoryData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => v.toLocaleString()} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-4 mt-2">
                        {categoryData.map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs text-slate-500">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : <EmptyState msg="No category data" />}
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Module Summary</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'CRM Leads', value: summary.crm.totalLeads, sub: `${summary.crm.convertedLeads} converted` },
                      { label: 'PCD Partners', value: summary.pcd.activePartners, sub: `of ${summary.pcd.totalPartners} total` },
                      { label: 'Sales Invoices', value: summary.sales.totalInvoices, sub: 'all time' },
                      { label: 'Documents', value: summary.dms.totalDocuments, sub: `${summary.dms.expiringDocuments} expiring` },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-bold text-slate-700">{item.label}</p>
                          <p className="text-xs text-slate-400">{item.sub}</p>
                        </div>
                        <span className="text-xl font-bold text-slate-800">{item.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── SALES ──────────────────────────────────────────────────────────── */}
      {activeTab === 'SALES' && (
        <div className="space-y-6">
          <div className="flex overflow-x-auto gap-4 border-b border-slate-200 pb-1">
            {([
              { id: 'DAILY', label: 'Daily Sales', icon: <Calendar size={16} /> },
              { id: 'MONTHLY', label: 'Monthly', icon: <TrendingUp size={16} /> },
              { id: 'PRODUCT', label: 'Product Wise', icon: <ShoppingBag size={16} /> },
              { id: 'FIELD_FORCE', label: 'Field Force (MR)', icon: <Users size={16} /> },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setSalesReportType(t.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  salesReportType === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* DAILY */}
          {salesReportType === 'DAILY' && (
            loadingDaily ? <Spinner /> : dailyStats.length === 0 ? <EmptyState msg="No sales data found for the last 30 days." /> : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">Daily Revenue — Last 30 Days</h3>
                    <ResponsiveContainer width="100%" height={300} debounce={50}>
                      <AreaChart data={dailyStats}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => fmtK(v)} />
                        <Tooltip formatter={(v: any) => [fmt(v), 'Revenue']} />
                        <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Avg Daily Revenue</p>
                      <h3 className="text-2xl font-bold text-slate-800">
                        {fmtK(dailyStats.reduce((a, b) => a + b.revenue, 0) / dailyStats.length)}
                      </h3>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Period Revenue</p>
                      <h3 className="text-2xl font-bold text-green-600">
                        {fmtK(dailyStats.reduce((a, b) => a + b.revenue, 0))}
                      </h3>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Avg Margin</p>
                      <h3 className="text-2xl font-bold text-indigo-600">
                        {(dailyStats.reduce((a, b) => a + b.marginPercentage, 0) / dailyStats.length).toFixed(1)}%
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">Detailed Daily Ledger</div>
                  <table className="w-full text-left">
                    <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                      <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4 text-center">Invoices</th>
                        <th className="p-4 text-right">Revenue</th>
                        <th className="p-4 text-right">Gross Profit</th>
                        <th className="p-4 text-right">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...dailyStats].reverse().map((day, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-4 text-sm font-medium text-slate-800">{day.date}</td>
                          <td className="p-4 text-sm text-center text-slate-600">{day.invoiceCount}</td>
                          <td className="p-4 text-sm text-right font-medium text-slate-800">{fmt(day.revenue)}</td>
                          <td className="p-4 text-sm text-right text-green-600 font-medium">{fmt(day.grossProfit)}</td>
                          <td className="p-4 text-sm text-right text-indigo-600 font-bold">{day.marginPercentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* MONTHLY */}
          {salesReportType === 'MONTHLY' && (
            loadingDaily ? <Spinner /> : monthlyData.length === 0 ? <EmptyState msg="No monthly data available." /> : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-6">Monthly Revenue vs Profit</h3>
                <ResponsiveContainer width="100%" height={300} debounce={50}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={v => fmtK(v)} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={30} />
                    <Bar dataKey="profit" name="Gross Profit" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-6 border-t border-slate-100 pt-4 grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Total Revenue</p>
                    <p className="text-xl font-bold text-slate-800">{fmtK(monthlyData.reduce((a, b) => a + b.revenue, 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Total Profit</p>
                    <p className="text-xl font-bold text-green-600">{fmtK(monthlyData.reduce((a, b) => a + b.profit, 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Months Covered</p>
                    <p className="text-xl font-bold text-accent">{monthlyData.length}</p>
                  </div>
                </div>
              </div>
            )
          )}

          {/* PRODUCT WISE */}
          {salesReportType === 'PRODUCT' && (
            loadingProducts ? <Spinner /> : products.length === 0 ? <EmptyState msg="No product data available." /> : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Top Products by Stock Value</h3>
                  <span className="text-xs text-slate-500 bg-white border px-2 py-1 rounded">Live Inventory</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                    <tr>
                      <th className="p-4">Rank</th>
                      <th className="p-4">Product Name</th>
                      <th className="p-4 text-center">Current Stock</th>
                      <th className="p-4 text-right">MRP</th>
                      <th className="p-4 text-right">Stock Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products
                      .map(p => ({ ...p, stockValue: (p.current_stock || 0) * (p.mrp || 0) }))
                      .sort((a, b) => b.stockValue - a.stockValue)
                      .map((prod, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-4 text-sm text-slate-500 font-mono">#{i + 1}</td>
                          <td className="p-4 text-sm font-bold text-slate-800">{prod.name}</td>
                          <td className="p-4 text-sm text-center text-slate-700">{(prod.current_stock || 0).toLocaleString()}</td>
                          <td className="p-4 text-sm text-right text-slate-600">{fmt(prod.mrp || 0)}</td>
                          <td className="p-4 text-sm text-right font-bold text-slate-800">{fmt(prod.stockValue)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* FIELD FORCE */}
          {salesReportType === 'FIELD_FORCE' && (
            <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-sm text-center text-slate-400">
              <Map size={48} className="mx-auto mb-4 opacity-30 text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">Field Force Analytics</h3>
              <p className="text-sm">MR-level PCD performance analytics are available in the <strong className="text-slate-700">PCD Network</strong> module under Territory View.</p>
            </div>
          )}
        </div>
      )}

      {/* ── GST ────────────────────────────────────────────────────────────── */}
      {activeTab === 'GST' && (
        loadingGst ? <Spinner /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">GSTR-1 — Output Tax</p>
                <h3 className="text-2xl font-bold text-slate-800">
                  {fmt(gstr1.reduce((a, r) => a + r.totalGst, 0))}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{gstr1.length} invoices this period</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">ITC Available</p>
                <h3 className="text-2xl font-bold text-green-600">{fmt(gstr3b?.itcAvailable || 0)}</h3>
                <p className="text-xs text-slate-400 mt-1">Input Tax Credit (GSTR-3B)</p>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">GSTR-3B — Net Payable</p>
                <h3 className="text-2xl font-bold text-red-600">{fmt(gstr3b?.netPayable || 0)}</h3>
                <p className="text-xs text-slate-400 mt-1">After ITC offset</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Percent size={18} className="text-primary" /> GSTR-1 Invoice-wise Summary
                </h3>
                <button onClick={handleExport} className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                  <Download size={14} /> Download CSV
                </button>
              </div>
              {gstr1.length === 0 ? (
                <EmptyState msg="No GSTR-1 data for current month. Ensure sales invoices are marked Completed." />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                    <tr>
                      <th className="p-4">Party</th>
                      <th className="p-4">Invoice No</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Taxable Value</th>
                      <th className="p-4 text-right">CGST</th>
                      <th className="p-4 text-right">SGST</th>
                      <th className="p-4 text-right">IGST</th>
                      <th className="p-4 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gstr1.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-800">{row.partyName}</td>
                        <td className="p-4 font-mono text-slate-600 text-xs">{row.invoiceNo}</td>
                        <td className="p-4 text-slate-500 text-xs">{row.invoiceDate}</td>
                        <td className="p-4 text-right text-slate-700">{fmt(row.taxableValue)}</td>
                        <td className="p-4 text-right text-slate-600">{fmt(row.cgst)}</td>
                        <td className="p-4 text-right text-slate-600">{fmt(row.sgst)}</td>
                        <td className="p-4 text-right text-slate-600">{fmt(row.igst)}</td>
                        <td className="p-4 text-right font-bold text-slate-800">{fmt(row.totalGst)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                    <tr>
                      <td className="p-4" colSpan={3}>TOTAL</td>
                      <td className="p-4 text-right">{fmt(gstr1.reduce((a, r) => a + r.taxableValue, 0))}</td>
                      <td className="p-4 text-right">{fmt(gstr1.reduce((a, r) => a + r.cgst, 0))}</td>
                      <td className="p-4 text-right">{fmt(gstr1.reduce((a, r) => a + r.sgst, 0))}</td>
                      <td className="p-4 text-right">{fmt(gstr1.reduce((a, r) => a + r.igst, 0))}</td>
                      <td className="p-4 text-right text-primary">{fmt(gstr1.reduce((a, r) => a + r.totalGst, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )
      )}

      {/* ── SUPPLIER OUTSTANDING ───────────────────────────────────────────── */}
      {activeTab === 'SUPPLIER' && (
        loadingSupplier ? <Spinner /> : !purchases ? (
          <EmptyState msg="Could not load purchase data." />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-50 border border-red-100 p-6 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-red-800 font-bold text-lg">Today's Purchases</h3>
                  <p className="text-red-600 text-sm">Received today from suppliers</p>
                </div>
                <div className="text-3xl font-bold text-red-700">{fmt(purchases.totalPurchases)}</div>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-6 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-amber-800 font-bold text-lg">Pending Orders</h3>
                  <p className="text-amber-600 text-sm">Purchase orders awaiting delivery</p>
                </div>
                <div className="text-3xl font-bold text-amber-700">{purchases.pendingOrders}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle size={18} className="text-primary" /> Recent Purchase Orders
                </h3>
              </div>
              {purchases.purchases.length === 0 ? (
                <EmptyState msg="No recent purchase orders found." />
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                    <tr>
                      <th className="p-4">Invoice No</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.purchases.map((po, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-mono text-slate-600 text-xs">{po.invoice_no || '—'}</td>
                        <td className="p-4 font-bold text-slate-800">{po.supplier_name}</td>
                        <td className="p-4 text-slate-500">{po.date ? new Date(po.date).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="p-4 text-right font-bold text-slate-800">{fmt(parseFloat(String(po.total_amount || 0)))}</td>
                        <td className="p-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            po.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                            po.status === 'Received' ? 'bg-green-100 text-green-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{po.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      )}

      {/* ── POWER BI ───────────────────────────────────────────────────────── */}
      {activeTab === 'POWERBI' && <PowerBIReports />}

      {/* ── AI REPORT ──────────────────────────────────────────────────────── */}
      {activeTab === 'AI_REPORT' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[500px]">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={24} /></div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Agentic AI Reporting</h3>
              <p className="text-sm text-slate-500">Query ERP data using natural language</p>
            </div>
          </div>

          <form onSubmit={handleAiSubmit} className="flex gap-2 mb-8">
            <input
              type="text"
              placeholder="e.g. 'Show Q2 revenue forecast' or 'Analyse recent expenses'"
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              disabled={isAiLoading}
            />
            <button
              type="submit"
              disabled={isAiLoading || !aiQuery.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {isAiLoading ? <><Loader2 size={16} className="animate-spin" /> Analysing...</> : 'Generate'}
            </button>
          </form>

          {aiResult && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fadeIn">
              <h4 className="text-xl font-bold text-slate-800 mb-2">{aiResult.title}</h4>
              <p className="text-sm text-slate-600 mb-6 bg-white p-4 rounded-lg border border-slate-100 italic">"{aiResult.summary}"</p>
              <div className="bg-white p-4 rounded-lg border border-slate-100">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aiResult.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={v => fmtK(v)} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
