/**
 * DailySalesIntelligence.tsx
 *
 * FIX: Previously fetched /api/sales and estimated COGS at a hardcoded 70%.
 * Now fetches /api/accounting/diagnostic which computes COGS per-item from
 * batches.purchase_rate (actual batch cost), giving accurate gross profit.
 *
 * Data shape from /api/accounting/diagnostic:
 *   { stats: [{date, invoice_count, revenue, cogs, gross_profit, margin_percentage}],
 *     summary: { total_period_revenue, total_period_profit, average_margin } }
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp, Target, Zap,
  Activity, RefreshCw, AlertCircle
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useDataFetch } from '../hooks/useDataFetch';
import { Badge } from './UniversalLayout';

// ── Stable chart configs ──────────────────────────────────────────────────────
const CHART_MARGIN = { top: 10, right: 10, left: 0, bottom: 0 };
const CHART_TICK_STYLE = { fontSize: 10, fontWeight: 'bold', fill: '#64748b' };
const TOOLTIP_STYLE = {
  borderRadius: '16px',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
};
const TOOLTIP_ITEM_STYLE = { fontWeight: 'bold' };
const formatYAxisTick = (value: number) => `₹${(value / 1000).toFixed(0)}k`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface DailyStat {
  date: string;
  invoice_count: number | string;
  revenue: number | string;
  cogs: number | string;
  gross_profit: number | string;
  margin_percentage: number | string;
}

interface DiagnosticResponse {
  stats?: DailyStat[];
  summary?: {
    total_period_revenue: number;
    total_period_profit: number;
    average_margin: number | string;
  };
  recordCount?: number;
}

// ── Safe number helpers ────────────────────────────────────────────────────────
const safeNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? 0));
  return isFinite(n) ? n : 0;
};

const safeMargin = (profit: number, revenue: number): number =>
  revenue > 0 ? Math.min(100, Math.max(-999, (profit / revenue) * 100)) : 0;

// ─────────────────────────────────────────────────────────────────────────────
const DailySalesIntelligence: React.FC = () => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // ── Fetch real data (with actual batch-based COGS) ─────────────────────────
  // /api/accounting/diagnostic computes:
  //   cogs = SUM(quantity × batch.purchase_rate)
  //   gross_profit = SUM(line_total) - COGS
  //   margin_percentage = gross_profit / revenue × 100
  const { data: diagnosticData, loading, error, refetch } =
    useDataFetch<DiagnosticResponse>('/api/accounting/diagnostic');

  // ── Normalise API response ─────────────────────────────────────────────────
  const { stats, summary } = useMemo(() => {
    const rawStats = diagnosticData?.stats;

    if (!rawStats || !Array.isArray(rawStats) || rawStats.length === 0) {
      return {
        stats: [],
        summary: { total_period_revenue: 0, total_period_profit: 0, average_margin: '0.00' },
      };
    }

    // Sort descending by date, normalise numeric fields
    const sorted = rawStats
      .filter(s => {
        const d = new Date(s.date);
        return !isNaN(d.getTime()); // drop malformed dates
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(s => {
        const rev = safeNum(s.revenue);
        const cogs = safeNum(s.cogs);
        const gp = safeNum(s.gross_profit);
        // Re-compute margin from actual values to guard against stale DB column
        const margin = safeMargin(gp, rev);
        return {
          date: String(s.date).split('T')[0], // normalise to YYYY-MM-DD
          invoice_count: parseInt(String(s.invoice_count)) || 0,
          revenue: rev,
          cogs,
          gross_profit: gp,
          margin_percentage: parseFloat(margin.toFixed(2)),
        };
      });

    // Summary — prefer API-provided, but recompute from sorted if missing
    const apiSummary = diagnosticData?.summary;
    const totalRev = apiSummary?.total_period_revenue ?? sorted.reduce((a, s) => a + s.revenue, 0);
    const totalGP  = apiSummary?.total_period_profit  ?? sorted.reduce((a, s) => a + s.gross_profit, 0);
    const avgMargin = sorted.length > 0
      ? (sorted.reduce((a, s) => a + s.margin_percentage, 0) / sorted.length).toFixed(2)
      : '0.00';

    return {
      stats: sorted,
      summary: {
        total_period_revenue: safeNum(totalRev),
        total_period_profit: safeNum(totalGP),
        average_margin: avgMargin,
      },
    };
  }, [diagnosticData]);

  // ── Chart data — last 7 days, chronological ────────────────────────────────
  const chartData = useMemo(() =>
    stats.slice(0, 7).reverse().map(s => ({
      date: new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      revenue: s.revenue,
      profit: s.gross_profit,
      cogs: s.cogs,
      margin: s.margin_percentage,
    })),
    [stats]
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
        <RefreshCw className="animate-spin text-accent mb-2" size={32} />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
          Processing Intelligence...
        </p>
      </div>
    );
  }

  // ── Error / empty ──────────────────────────────────────────────────────────
  if (error || stats.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-rose-50 rounded-xl border border-dashed border-rose-200 p-8 text-center">
        <AlertCircle className="text-rose-600 mb-2" size={32} />
        <p className="text-sm font-bold text-rose-800">
          {error ? 'Intelligence Link Failure' : 'No Sales Data Available'}
        </p>
        <p className="text-[10px] text-rose-500 font-mono mt-1 mb-3">
          {error
            ? (typeof error === 'string' ? error : 'API error')
            : 'No completed sales invoices found for this company'}
        </p>
        <p className="text-xs text-rose-600 mt-1 uppercase font-bold">
          {error ? 'Verify database entries & token integrity' : 'Create sales invoices to see analytics'}
        </p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-accent">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Period Revenue
            </p>
            <p className="text-xl font-bold text-slate-800" data-testid="period-revenue">
              {formatCurrency(summary.total_period_revenue)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Gross Profit
            </p>
            <p className="text-xl font-bold text-slate-800" data-testid="gross-profit">
              {formatCurrency(summary.total_period_profit)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
            <Target size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Avg. Margin
            </p>
            <p
              className="text-xl font-bold text-slate-800"
              data-testid="avg-margin"
            >
              {summary.average_margin}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart + Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h4 className="text-lg font-bold text-slate-800 tracking-tight">
              Daily Performance Analytics
            </h4>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Revenue vs COGS (Pharmaceutical Margin Tracking)
            </p>
          </div>
          <div className="flex gap-2">
            <Badge value="Live Data" variant="success" />
            <Badge value="UltraBrain Enabled" variant="warning" />
          </div>
        </div>

        <div className="w-full relative" style={{ height: '300px', minWidth: 0 }}>
          {isMounted && (
            <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
              <AreaChart data={chartData} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_TICK_STYLE}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_TICK_STYLE}
                  tickFormatter={formatYAxisTick}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Breakdown Table */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left" data-testid="daily-stats-table">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="pb-4">Date</th>
                  <th className="pb-4">Invoices</th>
                  <th className="pb-4 text-right">Revenue</th>
                  <th className="pb-4 text-right">COGS</th>
                  <th className="pb-4 text-right">Gross Profit</th>
                  <th className="pb-4 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-700">
                {stats.slice(0, 5).map((row, idx) => (
                  <tr key={`${row.date}-${idx}`} className="border-t border-slate-50">
                    <td className="py-4">{formatDate(row.date)}</td>
                    <td className="py-4">{row.invoice_count}</td>
                    <td className="py-4 text-right">{formatCurrency(row.revenue)}</td>
                    <td className="py-4 text-right text-slate-400">{formatCurrency(row.cogs)}</td>
                    <td className="py-4 text-right text-emerald-600">
                      {formatCurrency(row.gross_profit)}
                    </td>
                    <td className="py-4 text-right">
                      <span
                        className={`px-2 py-1 rounded-lg ${
                          row.margin_percentage >= 30
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {row.margin_percentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailySalesIntelligence;
