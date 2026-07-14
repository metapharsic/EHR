import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Brain, Zap, Clock, CheckCircle2,
  AlertCircle, Loader2, Sparkles, TrendingUp,
  ArrowRight, RefreshCw, Wallet, Users, Activity,
  ChevronRight, TrendingDown, ShieldCheck, XCircle,
  Package, FileBarChart
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAppStore } from '../store/useAppStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FinancialKpis {
  currentRatio: string;
  netProfitMargin: string;
  workingCapital: number;
  burnRate: string;
  forecastedCash30d: string;
}

interface FinancialIntelligence {
  kpis: FinancialKpis;
  intelligence: { status: string; recommendation: string };
}

interface CustomerRisk {
  name: string;
  drift_status: string;
}

interface CustomerIntelligence {
  driftingCount: number;
  lostCount: number;
  growingCount: number;
  atRisk: CustomerRisk[];
}

interface DashboardSummary {
  inventory: { totalProducts: number; totalStockValue: number; lowStockProducts: number };
  sales: { totalInvoices: number; todaySales: number; monthSales: number };
  accounts: { netProfit: number; workingCapital: number; totalAssets: number; totalLiabilities: number };
  crm: { totalLeads: number; convertedLeads: number };
}

interface PosStats {
  monthlyRevenue: number;
  growth: number;
}

interface ReportJob {
  jobId: string;
  reportId: string;
  type: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: { summary?: string; recommendations?: string[] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtCr = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const computeHealthScore = (fin: FinancialIntelligence | null, summary: DashboardSummary | null) => {
  let score = 0;
  const parts: string[] = [];

  if (fin) {
    const cr = parseFloat(fin.kpis?.currentRatio ?? '0') || 0;
    const npm = parseFloat((fin.kpis?.netProfitMargin ?? '0%').replace('%', '')) || 0;
    const wc = fin.kpis?.workingCapital ?? 0;
    const status = fin.intelligence?.status ?? '';

    const liq = Math.min(25, Math.round((Math.min(cr, 2) / 2) * 25));
    const prof = Math.min(25, Math.round((Math.max(0, npm) / 20) * 25));
    const wcPts = wc > 0 ? 25 : 0;
    const statusPts = status === 'HEALTHY' ? 25 : 0;

    score = liq + prof + wcPts + statusPts;
    parts.push(`Liquidity: ${liq}/25`, `Margin: ${prof}/25`, `Working Capital: ${wcPts}/25`, `Status: ${statusPts}/25`);
  } else if (summary) {
    // Fallback: use dashboard summary
    const wc = summary.accounts?.workingCapital ?? 0;
    const wcPts = wc > 0 ? 25 : 0;
    const profitPts = (summary.accounts?.netProfit ?? 0) > 0 ? 25 : 0;
    const stockOk = (summary.inventory?.lowStockProducts ?? 99) < 5 ? 25 : 10;
    const salesOk = (summary.sales?.monthSales ?? 0) > 0 ? 25 : 0;
    score = wcPts + profitPts + stockOk + salesOk;
    parts.push(`Working Capital: ${wcPts}/25`, `Profitability: ${profitPts}/25`, `Stock Health: ${stockOk}/25`, `Sales: ${salesOk}/25`);
  }

  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'At Risk';
  const color = score >= 80 ? 'emerald' : score >= 60 ? 'blue' : score >= 40 ? 'amber' : 'rose';
  return { score, label, color, parts };
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; accent: string;
}) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</p>
      <h3 className="text-xl font-bold text-slate-800 leading-tight">{value}</h3>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const ReportJobCard = ({ job }: { job: ReportJob }) => {
  const statusConfig = {
    waiting: { icon: <Loader2 size={16} className="animate-spin text-amber-500" />, label: 'Queued', bg: 'bg-amber-50 border-amber-200' },
    active: { icon: <Loader2 size={16} className="animate-spin text-blue-500" />, label: 'Processing', bg: 'bg-blue-50 border-blue-200' },
    completed: { icon: <CheckCircle2 size={16} className="text-emerald-500" />, label: 'Completed', bg: 'bg-emerald-50 border-emerald-200' },
    failed: { icon: <XCircle size={16} className="text-red-500" />, label: 'Failed', bg: 'bg-red-50 border-red-200' },
  };
  const cfg = statusConfig[job.status] || statusConfig.waiting;

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          {job.type.replace(/_/g, ' ')}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
          {cfg.icon} {cfg.label}
        </div>
      </div>
      {job.status === 'active' && (
        <div className="h-1.5 bg-white rounded-full overflow-hidden mt-2">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: `${job.progress || 30}%` }} />
        </div>
      )}
      {job.status === 'completed' && job.result?.result?.summary && (
        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{job.result.result.summary}</p>
      )}
      {job.status === 'completed' && job.result?.result?.recommendations && (
        <ul className="mt-2 space-y-1">
          {job.result.result.recommendations.map((r: string, i: number) => (
            <li key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
              <span className="mt-0.5">•</span> {r}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-slate-400 mt-2 font-mono">{job.reportId}</p>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const IntelligenceDashboard: React.FC = () => {
  const { addNotification } = useAppStore();

  const [financials, setFinancials] = useState<FinancialIntelligence | null>(null);
  const [customers, setCustomers] = useState<CustomerIntelligence | null>(null);
  const [posStats, setPosStats] = useState<PosStats | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activeJobs, setActiveJobs] = useState<ReportJob[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const reportTypes = [
    { id: 'inventory_intelligence', name: 'Inventory Intelligence', icon: Package, desc: 'ABC/FSN/VED analysis + dead-stock detection and reorder optimization.' },
    { id: 'financial_health', name: 'Financial Health', icon: TrendingUp, desc: 'Deep-dive into liquidity ratios, profit margins, and working capital trends.' },
    { id: 'demand_forecast', name: 'Demand Forecast', icon: Brain, desc: 'Predictive modelling for next-quarter stock requirements by category.' },
  ];

  // ── Fetch all intelligence data ──────────────────────────────────────────
  const fetchIntelligence = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);

    const [finRes, custRes, posRes, summaryRes] = await Promise.allSettled([
      apiClient.get('/analytics/financial/summary'),
      apiClient.get('/analytics/customers/drift'),
      apiClient.get('/pos/terminal/summary'),
      apiClient.get('/reports/dashboard-summary'),
    ]);

    let anySuccess = false;

    if (finRes.status === 'fulfilled' && finRes.value?.success) {
      setFinancials(finRes.value.data);
      anySuccess = true;
    }
    if (custRes.status === 'fulfilled' && custRes.value?.success) {
      setCustomers(custRes.value.data);
      anySuccess = true;
    }
    if (posRes.status === 'fulfilled' && posRes.value?.success) {
      setPosStats(posRes.value.data);
      anySuccess = true;
    }
    if (summaryRes.status === 'fulfilled' && summaryRes.value?.success) {
      setSummary(summaryRes.value.data);
      anySuccess = true;
    }

    if (!anySuccess) setHasError(true);
    setLastFetched(new Date());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchIntelligence();
  }, [fetchIntelligence]);

  // Keep a ref to activeJobs so the polling interval can read current state
  // without being listed as a dependency (avoids interval being cleared on every update)
  const activeJobsRef = React.useRef<ReportJob[]>([]);
  activeJobsRef.current = activeJobs;

  // ── Poll active jobs (stable interval — never recreated) ──────────────────
  useEffect(() => {
    const timer = setInterval(async () => {
      const pending = activeJobsRef.current.filter(
        j => j.status === 'waiting' || j.status === 'active'
      );
      if (pending.length === 0) return;

      try {
        const ids = pending.map(j => j.jobId).join(',');
        const data = await apiClient.get(`/analytics/reports/status/batch?jobIds=${ids}`);
        if (!data?.success) return;

        data.data.forEach((item: any) => {
          const job = pending.find(j => j.jobId === item.id);
          if (!job) return;

          const newStatus = item.state === 'completed' ? 'completed'
            : item.state === 'failed' ? 'failed'
            : item.state === 'active' ? 'active'
            : 'waiting';

          setActiveJobs(prev => prev.map(j =>
            j.jobId === item.id
              ? { ...j, status: newStatus, progress: item.progress ?? j.progress, result: item.result }
              : j
          ));

          if (newStatus === 'completed') {
            addNotification({ type: 'success', message: `Report "${job.type.replace(/_/g, ' ')}" is ready.` });
          }
        });
      } catch {
        // poll failure is non-fatal
      }
    }, 3000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start a report job ───────────────────────────────────────────────────
  const startReport = async (type: string) => {
    if (isRequesting) return;
    setIsRequesting(true);
    try {
      const data = await apiClient.post('/analytics/reports/generate', { type, params: {} });
      if (data?.success) {
        setActiveJobs(prev => [{
          jobId: String(data.jobId),
          reportId: data.reportId,
          type,
          status: 'waiting',
          progress: 0,
        }, ...prev]);
        addNotification({ type: 'info', message: 'Report queued — results appear below when ready.' });
      }
    } catch {
      addNotification({ type: 'error', message: 'Failed to start report. Try again.' });
    } finally {
      setIsRequesting(false);
    }
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const health = computeHealthScore(financials, summary);

  const kpiCash = financials
    ? fmtCr(parseFloat(financials.kpis?.forecastedCash30d ?? '0'))
    : summary ? fmtCr(summary.accounts?.workingCapital ?? 0)
    : '—';

  const kpiAtRisk = customers?.driftingCount ?? 0;
  const kpiLost = customers?.lostCount ?? 0;

  const kpiRevenue = posStats
    ? fmtCr(posStats.monthlyRevenue)
    : summary ? fmtCr(summary.sales?.monthSales ?? 0)
    : '—';

  const kpiGrowth = posStats?.growth != null
    ? `${posStats.growth > 0 ? '+' : ''}${posStats.growth.toFixed(1)}%`
    : null;

  const intelligenceStatus = financials?.intelligence?.status ?? (summary ? 'OK' : '—');
  const recommendation = financials?.intelligence?.recommendation ?? null;
  const burnRate = financials?.kpis?.burnRate ?? null;

  const timeSince = lastFetched
    ? (() => {
        const diff = Math.round((Date.now() - lastFetched.getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
      })()
    : null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse p-1">
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 h-96 bg-slate-100 rounded-xl" />
          <div className="col-span-4 h-96 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error fallback ───────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="bg-red-50 rounded-full p-5"><AlertCircle className="text-red-400" size={36} /></div>
        <h3 className="text-lg font-bold text-slate-700">Intelligence Engine Offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">All analytics endpoints failed to respond. Check server health or try again.</p>
        <button
          onClick={fetchIntelligence}
          className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-xl text-white ring-4 ring-indigo-50">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Intelligence Center <span className="text-indigo-500 text-sm align-top ml-1 font-semibold">V4</span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">Predictive Modelling &amp; Actionable Business Insights</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {timeSince && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock size={12} /> Updated {timeSince}
            </span>
          )}
          <button
            onClick={fetchIntelligence}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-10 h-10 rounded-xl flex items-center justify-center transition-all"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Cash Flow Forecast (30d)"
          value={kpiCash}
          sub={intelligenceStatus === 'HEALTHY' ? 'Healthy trajectory' : intelligenceStatus === 'LIQUIDITY_RISK' ? 'Liquidity at risk' : ''}
          icon={<Wallet size={22} className="text-indigo-600" />}
          accent="bg-indigo-50"
        />
        <KpiCard
          label="Customers at Risk"
          value={String(kpiAtRisk)}
          sub={`${kpiLost} lost · ${customers?.growingCount ?? 0} growing`}
          icon={<Users size={22} className="text-rose-500" />}
          accent="bg-rose-50"
        />
        <KpiCard
          label="Revenue (Last 30d)"
          value={kpiRevenue}
          sub={kpiGrowth ? `${kpiGrowth} vs prev period` : 'POS + Wholesale'}
          icon={<Activity size={22} className="text-amber-500" />}
          accent="bg-amber-50"
        />
        <KpiCard
          label="Intelligence Status"
          value={intelligenceStatus.replace('_', ' ')}
          sub={`Health score: ${health.score}/100 (${health.label})`}
          icon={<ShieldCheck size={22} className="text-emerald-600" />}
          accent="bg-emerald-50"
        />
      </div>

      {/* Inventory + Accounts quick stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Products" value={String(summary.inventory.totalProducts)} sub="Active SKUs" icon={<Package size={20} className="text-blue-500" />} accent="bg-blue-50" />
          <KpiCard label="Low Stock Alerts" value={String(summary.inventory.lowStockProducts)} sub="Below reorder level" icon={<AlertCircle size={20} className="text-orange-500" />} accent="bg-orange-50" />
          <KpiCard label="Net Profit" value={fmtCr(summary.accounts.netProfit)} sub="Income minus expenses" icon={<TrendingUp size={20} className="text-purple-500" />} accent="bg-purple-50" />
          <KpiCard label="CRM Leads" value={String(summary.crm.totalLeads)} sub={`${summary.crm.convertedLeads} converted`} icon={<FileBarChart size={20} className="text-cyan-500" />} accent="bg-cyan-50" />
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">

        {/* ── Left: Report Engine + Predictive Box ── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">

          {/* Report Engine Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {reportTypes.map((rpt) => (
              <div
                key={rpt.id}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <rpt.icon size={100} />
                </div>
                <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <rpt.icon size={22} />
                </div>
                <h3 className="font-bold text-slate-800 mb-1 text-sm">{rpt.name}</h3>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">{rpt.desc}</p>
                <button
                  onClick={() => startReport(rpt.id)}
                  disabled={isRequesting}
                  className="w-full bg-slate-900 group-hover:bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isRequesting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {isRequesting ? 'Queuing...' : 'Run Analysis'}
                </button>
              </div>
            ))}
          </div>

          {/* Active Report Jobs */}
          {activeJobs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analysis Queue</h3>
              {activeJobs.map(job => <ReportJobCard key={job.jobId} job={job} />)}
            </div>
          )}

          {/* Predictive Recommendation */}
          <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-x-32 -translate-y-32 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-500/20 p-2 rounded-lg">
                  <Brain className="text-indigo-400" size={22} />
                </div>
                <h3 className="font-bold text-lg tracking-tight">V4 Predictive Recommendation</h3>
              </div>

              {recommendation ? (
                <p className="text-indigo-100 text-base mb-6 font-medium leading-relaxed max-w-2xl">
                  {recommendation}.
                  {burnRate && ` Current burn rate is ${fmtCr(parseFloat(burnRate))}/month.`}
                  {' '}Maintaining current collection velocity should sustain healthy liquidity.
                </p>
              ) : summary ? (
                <p className="text-indigo-100 text-base mb-6 font-medium leading-relaxed max-w-2xl">
                  {summary.accounts.netProfit > 0
                    ? `Business is profitable with ${fmtCr(summary.accounts.netProfit)} net income. Working capital stands at ${fmtCr(summary.accounts.workingCapital)}.`
                    : `Working capital is ${fmtCr(summary.accounts.workingCapital)}. Focus on accelerating collections.`}
                  {summary.inventory.lowStockProducts > 0
                    ? ` ${summary.inventory.lowStockProducts} products are below reorder level — initiate purchase orders.`
                    : ' Inventory levels are healthy.'}
                </p>
              ) : (
                <p className="text-indigo-300 text-base mb-6">Run a Financial Health analysis above to generate predictive insights.</p>
              )}

              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                <Clock size={13} />
                {timeSince ? `Data refreshed ${timeSince}` : 'Refreshing...'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Risk Radar + Health Score ── */}
        <div className="col-span-12 lg:col-span-4 space-y-5">

          {/* Risk Radar */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">
              <TrendingDown className="text-rose-500" size={14} /> Customer Risk Radar
            </h3>

            {!customers || customers.atRisk.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <ShieldCheck className="mx-auto mb-2 text-emerald-400" size={28} />
                <p className="text-xs font-medium">No at-risk customers detected</p>
                <p className="text-[10px] mt-1 text-slate-300">All active customers are stable or growing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.atRisk.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${c.drift_status === 'LOST' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                        {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: c.drift_status === 'LOST' ? '#e11d48' : '#d97706' }}>
                          {c.drift_status}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="bg-rose-50 rounded-lg p-2">
                <p className="font-bold text-rose-700 text-base">{customers?.lostCount ?? 0}</p>
                <p className="text-rose-400 font-semibold uppercase">Lost</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="font-bold text-amber-700 text-base">{customers?.driftingCount ?? 0}</p>
                <p className="text-amber-400 font-semibold uppercase">Drifting</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="font-bold text-emerald-700 text-base">{customers?.growingCount ?? 0}</p>
                <p className="text-emerald-400 font-semibold uppercase">Growing</p>
              </div>
            </div>
          </div>

          {/* Health Score */}
          <div className={`p-6 rounded-[2rem] text-white ${
            health.color === 'emerald' ? 'bg-emerald-600' :
            health.color === 'blue' ? 'bg-blue-600' :
            health.color === 'amber' ? 'bg-amber-500' : 'bg-rose-600'
          }`}>
            <h3 className="font-bold text-white/80 mb-3 flex items-center gap-2 uppercase tracking-widest text-[10px]">
              <Activity size={12} /> Business Health Score
            </h3>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-bold italic">{health.score}</span>
              <span className="text-white/60 font-bold">/100</span>
              <span className="text-sm text-white/70 ml-1">({health.label})</span>
            </div>

            {/* Score bar */}
            <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-700"
                style={{ width: `${health.score}%` }}
              />
            </div>

            <div className="space-y-1">
              {health.parts.map((p, i) => (
                <p key={i} className="text-[10px] text-white/60 font-medium">{p}</p>
              ))}
            </div>

            {!financials && !summary && (
              <p className="text-xs text-white/50 mt-3 italic">Connect analytics engine to calculate score</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
