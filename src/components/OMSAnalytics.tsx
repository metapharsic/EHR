/**
 * OMSAnalytics.tsx
 * Analytics dashboard for the OMS module — charts, SLA breach table, export.
 * Uses Recharts for all visualizations.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Download,
  RefreshCcw,
  Users,
  Target,
  BarChart2,
  PieChartIcon,
} from 'lucide-react';
import { omsService } from '../services/omsService';
import { useAppStore } from '../store/useAppStore';
import type { OmsAnalyticsData, OmsSlaBreachEntry } from '../types';

const CHART_COLORS = {
  green: '#22c55e',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  indigo: '#6366f1',
};

const STATUS_COLORS: Record<string, string> = {
  'Pending Approval': CHART_COLORS.amber,
  Approved: CHART_COLORS.blue,
  Processing: CHART_COLORS.purple,
  Shipped: CHART_COLORS.indigo,
  Delivered: CHART_COLORS.teal,
  Invoiced: CHART_COLORS.green,
  Cancelled: CHART_COLORS.red,
  Rejected: '#94a3b8',
  Hold: '#cbd5e1',
};

const inr = (v: any) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />
);

const OMSAnalytics: React.FC = () => {
  const addNotification = useAppStore((s) => s.addNotification);

  const [analytics, setAnalytics] = useState<OmsAnalyticsData | null>(null);
  const [slaBreaches, setSlaBreaches] = useState<OmsSlaBreachEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsData, slaData] = await Promise.all([
        omsService.getAnalytics(),
        omsService.getSlaBreaches(),
      ]);
      setAnalytics(analyticsData);
      setSlaBreaches(slaData);
    } catch (e: any) {
      addNotification({
        type: 'error',
        message: e?.data?.error || e?.message || 'Failed to load OMS analytics',
      });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await omsService.exportOrders();
      // Handle CSV blob download
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oms-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addNotification({ type: 'success', message: 'Orders exported successfully' });
    } catch (e: any) {
      addNotification({
        type: 'error',
        message: e?.data?.error || e?.message || 'Export failed',
      });
    } finally {
      setExporting(false);
    }
  };

  const slaHoursColor = (entry: OmsSlaBreachEntry) => {
    const ratio = entry.hoursOpen / entry.maxHours;
    if (ratio >= 2) return 'bg-red-100 text-red-700 border-red-200';
    if (ratio >= 1.5) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const pieData =
    analytics?.statusBreakdown?.map((s) => ({
      name: s.status,
      value: s.count,
    })) ?? [];

  const topDistributors = [...(analytics?.distributorPerformance ?? [])]
    .sort((a, b) => b.total_value - a.total_value)
    .slice(0, 10)
    .map((d) => ({
      name:
        d.distributor_name.length > 20
          ? d.distributor_name.slice(0, 18) + '…'
          : d.distributor_name,
      value: d.total_value,
      orders: d.total_orders,
    }));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-[#22c55e]" />
          <h3 className="text-[15px] font-bold text-slate-800">OMS Analytics</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <RefreshCcw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* Charts grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonBlock className="h-[300px]" />
          <SkeletonBlock className="h-[300px]" />
          <SkeletonBlock className="h-[300px]" />
          <SkeletonBlock className="h-[300px]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly Value Trend */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-[#22c55e]" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Monthly Order Value Trend
              </span>
            </div>
            {(analytics?.monthlyTrend?.length ?? 0) === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">
                No trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280} debounce={50}>
                <AreaChart data={analytics!.monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotalValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorInvoicedValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      inr(value),
                      name === 'total_value' ? 'Total Value' : 'Invoiced Value',
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) =>
                      value === 'total_value' ? 'Total Value' : 'Invoiced Value'
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="total_value"
                    stroke={CHART_COLORS.green}
                    strokeWidth={2}
                    fill="url(#colorTotalValue)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="invoiced_value"
                    stroke={CHART_COLORS.blue}
                    strokeWidth={2}
                    fill="url(#colorInvoicedValue)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status Distribution */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <PieChartIcon size={15} className="text-amber-500" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Order Status Distribution
              </span>
            </div>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">
                No status data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240} debounce={50}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    dataKey="value"
                    label={({ name, percent }) =>
                      percent > 0.04 ? `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] ?? CHART_COLORS.cyan}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: string) => [value + ' orders', name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10 }}
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Distributors */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} className="text-indigo-500" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Top 10 Distributors by Order Value
              </span>
            </div>
            {topDistributors.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">
                No distributor data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280} debounce={50}>
                <BarChart
                  data={topDistributors}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 120, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    tickLine={false}
                    axisLine={false}
                    width={115}
                  />
                  <Tooltip
                    formatter={(value: any) => [inr(value), 'Total Value']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="value" fill={CHART_COLORS.green} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* SLA Breach Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 bg-red-50/60 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-500" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-red-600">
              SLA Breach Monitor
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            {slaBreaches.length} breach{slaBreaches.length !== 1 ? 'es' : ''} detected
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-10" />
            ))}
          </div>
        ) : slaBreaches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Target size={36} className="text-emerald-300 mb-2" />
            <p className="text-[13px] text-slate-400 font-semibold">All orders within SLA targets</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Order #</th>
                  <th className="p-3">Distributor</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Priority</th>
                  <th className="p-3 text-center">Hours Open</th>
                  <th className="p-3 text-center">Max Allowed</th>
                  <th className="p-3 text-center">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slaBreaches.map((breach) => {
                  const isOverdue = breach.hoursOpen > breach.maxHours;
                  const ratio = breach.hoursOpen / breach.maxHours;
                  return (
                    <tr key={breach.orderId} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono text-[12px] font-bold text-slate-700">
                        {breach.orderNumber}
                      </td>
                      <td className="p-3 text-[13px] text-slate-700 max-w-[180px] truncate">
                        {breach.distributorName}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {breach.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            breach.priority === 'Urgent'
                              ? 'bg-red-100 text-red-600'
                              : breach.priority === 'High'
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {breach.priority}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-lg border ${slaHoursColor(breach)}`}
                        >
                          {isOverdue && <AlertTriangle size={10} />}
                          {breach.hoursOpen}h
                        </span>
                      </td>
                      <td className="p-3 text-center text-[12px] text-slate-500 font-semibold">
                        {breach.maxHours}h
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            ratio >= 2
                              ? 'bg-red-100 text-red-600 border-red-200'
                              : ratio >= 1.5
                              ? 'bg-orange-100 text-orange-600 border-orange-200'
                              : 'bg-amber-100 text-amber-600 border-amber-200'
                          }`}
                        >
                          {breach.severity === 'critical'
                            ? '🔴 Critical'
                            : breach.severity === 'warning'
                            ? '🟠 Warning'
                            : '🟡 Info'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OMSAnalytics;
