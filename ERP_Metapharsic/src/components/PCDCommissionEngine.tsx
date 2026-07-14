import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, CheckCircle, AlertCircle, RefreshCcw,
  Download, Zap, Clock, ChevronDown
} from 'lucide-react';
import apiClient from '../services/apiClient';

const GRADE_RATES: Record<string, number> = {
  PLATINUM: 0.10, GOLD: 0.085, SILVER: 0.07, BRONZE: 0.05,
};

const PCDCommissionEngine: React.FC = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [filterPeriod, setFilterPeriod] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [generatePeriod, setGeneratePeriod] = useState('');
  const [generating, setGenerating] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, pRes] = await Promise.all([
        apiClient.get('/pcd/commissions'),
        apiClient.get('/pcd/partners?limit=200'),
      ]);
      if (cRes.success) setCommissions(cRes.data);
      if (pRes.success) setPartners(pRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Available periods from actual data
  const periods = ['ALL', ...Array.from(new Set(commissions.map(c => c.period).filter(Boolean))).sort().reverse()];

  const filtered = commissions.filter(c => {
    const periodOk = filterPeriod === 'ALL' || c.period === filterPeriod;
    const statusOk = filterStatus === 'ALL' || c.payment_status === filterStatus;
    return periodOk && statusOk;
  });

  const totalBase = filtered.reduce((s, c) => s + Number(c.base_commission || 0), 0);
  const totalBonus = filtered.reduce((s, c) => s + Number(c.scheme_bonus || 0), 0);
  const totalDeductions = filtered.reduce((s, c) => s + Number(c.deductions || 0), 0);
  const totalNet = filtered.reduce((s, c) => s + Number(c.net_commission || 0), 0);
  const paidNet = filtered.filter(c => c.payment_status === 'PAID').reduce((s, c) => s + Number(c.net_commission || 0), 0);
  const pendingNet = filtered.filter(c => c.payment_status === 'PENDING').reduce((s, c) => s + Number(c.net_commission || 0), 0);
  const paidCount = filtered.filter(c => c.payment_status === 'PAID').length;
  const pendingCount = filtered.filter(c => c.payment_status === 'PENDING').length;

  const handleGenerate = async () => {
    if (!generatePeriod.trim()) { showToast('error', 'Enter a period (e.g. Q2-2026)'); return; }
    setGenerating(true);
    try {
      const res = await apiClient.post('/pcd/commissions/generate', { period: generatePeriod });
      if (res.success) {
        showToast('success', `Generated ${res.generated} commission records for ${generatePeriod}`);
        setGeneratePeriod('');
        await loadData();
      } else {
        showToast('error', res.error || 'Generation failed');
      }
    } catch (e: any) {
      showToast('error', e?.data?.error || e?.message || 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setPaying(id);
    try {
      const res = await apiClient.put(`/pcd/commissions/${id}`, {
        payment_status: 'PAID',
        paid_on: new Date().toISOString().split('T')[0],
      });
      if (res.success) {
        showToast('success', 'Commission marked as PAID');
        await loadData();
      } else {
        showToast('error', res.error || 'Update failed');
      }
    } catch (e: any) {
      showToast('error', e?.message || 'Failed');
    } finally {
      setPaying(null);
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ['Partner', 'Grade', 'Period', 'Total Sales (from targets)', 'Base Comm.', 'Scheme Bonus', 'Deductions', 'Net Comm.', 'Status', 'Paid On'],
      ...filtered.map(c => {
        const p = partners.find((x: any) => x.id === c.partner_id);
        const totalSales = p?.total_business || 0;
        return [
          c.partner_name || c.partner_id,
          c.partner_grade || '—',
          c.period,
          totalSales,
          c.base_commission,
          c.scheme_bonus,
          c.deductions,
          c.net_commission,
          c.payment_status,
          c.paid_on || '',
        ];
      })
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `pcd-commissions-${filterPeriod}-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Generate + filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end justify-between">
          {/* Generate commissions */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Generate for Period</label>
              <input
                value={generatePeriod}
                onChange={e => setGeneratePeriod(e.target.value)}
                placeholder="e.g. Q2-2026"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400 w-36"
              />
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {generating ? <RefreshCcw size={14} className="animate-spin" /> : <Zap size={14} />}
              {generating ? 'Generating…' : 'Generate'}
            </button>
            <p className="text-xs text-slate-400 self-center">Calculates from pcd_targets by grade rate</p>
          </div>
          {/* Filters */}
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period</label>
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400">
                {periods.map(p => <option key={p} value={p}>{p === 'ALL' ? 'All Periods' : p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400">
                <option value="ALL">ALL ({filtered.length})</option>
                <option value="PENDING">PENDING ({commissions.filter(c => (filterPeriod === 'ALL' || c.period === filterPeriod) && c.payment_status === 'PENDING').length})</option>
                <option value="PAID">PAID ({commissions.filter(c => (filterPeriod === 'ALL' || c.period === filterPeriod) && c.payment_status === 'PAID').length})</option>
              </select>
            </div>
            <button onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <RefreshCcw size={14} /> Refresh
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm font-medium">Total Commissions</p>
            <DollarSign size={18} className="text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">₹{totalNet.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">{filtered.length} records · Period: {filterPeriod}</p>
          <div className="mt-3 flex gap-3 text-xs">
            <span className="text-slate-500">Base <span className="font-semibold text-slate-700">₹{totalBase.toLocaleString('en-IN')}</span></span>
            <span className="text-green-600">Bonus <span className="font-semibold">+₹{totalBonus.toLocaleString('en-IN')}</span></span>
            <span className="text-red-500">Deduct <span className="font-semibold">-₹{totalDeductions.toLocaleString('en-IN')}</span></span>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-600 text-sm font-medium">Paid</p>
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">₹{paidNet.toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-500 mt-1">{paidCount} partners</p>
          {totalNet > 0 && <p className="text-xs text-green-400 mt-0.5">{Math.round((paidNet / totalNet) * 100)}% of total</p>}
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-orange-600 text-sm font-medium">Pending Disbursement</p>
            <Clock size={18} className="text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-700">₹{pendingNet.toLocaleString('en-IN')}</p>
          <p className="text-xs text-orange-500 mt-1">{pendingCount} partners awaiting</p>
          {totalNet > 0 && <p className="text-xs text-orange-400 mt-0.5">{Math.round((pendingNet / totalNet) * 100)}% of total</p>}
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-purple-600 text-sm font-medium">Grade Rates</p>
            <TrendingUp size={18} className="text-purple-500" />
          </div>
          <div className="text-xs space-y-1 text-purple-700 mt-1">
            <div className="flex justify-between"><span>Platinum</span><span className="font-bold">10%</span></div>
            <div className="flex justify-between"><span>Gold</span><span className="font-bold">8.5%</span></div>
            <div className="flex justify-between"><span>Silver</span><span className="font-bold">7%</span></div>
            <div className="flex justify-between"><span>Bronze</span><span className="font-bold">5%</span></div>
          </div>
        </div>
      </div>

      {/* Commission table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
          <RefreshCcw size={22} className="animate-spin mr-3" /> Loading commissions…
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Partner Name','Grade','Period','Total Sales','Base Comm.','Scheme Bonus','Deductions','Net Comm.','Status','Paid On','Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered
                  .sort((a, b) => {
                    // Pending first, then by net commission desc
                    if (a.payment_status !== b.payment_status) return a.payment_status === 'PENDING' ? -1 : 1;
                    return Number(b.net_commission) - Number(a.net_commission);
                  })
                  .map(c => {
                    const partner = partners.find((p: any) => p.id === c.partner_id);
                    const totalSales = partner ? Number(partner.total_business || 0) : 0;
                    return (
                      <tr key={c.id} className={`hover:bg-slate-50 ${c.payment_status === 'PENDING' ? '' : 'opacity-80'}`}>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{c.partner_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            c.partner_grade === 'PLATINUM' ? 'bg-purple-100 text-purple-700'
                            : c.partner_grade === 'GOLD' ? 'bg-yellow-100 text-yellow-700'
                            : c.partner_grade === 'SILVER' ? 'bg-slate-200 text-slate-700'
                            : 'bg-orange-100 text-orange-700'
                          }`}>{c.partner_grade || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{c.period}</td>
                        <td className="px-4 py-3 text-slate-600">₹{totalSales.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-slate-700">₹{Number(c.base_commission).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">
                          {Number(c.scheme_bonus) > 0 ? `+₹${Number(c.scheme_bonus).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-red-500">
                          {Number(c.deductions) > 0 ? `-₹${Number(c.deductions).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">₹{Number(c.net_commission).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            c.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>{c.payment_status}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {c.paid_on ? new Date(c.paid_on).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.payment_status === 'PENDING' ? (
                            <button
                              onClick={() => handleMarkPaid(c.id)}
                              disabled={paying === c.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium whitespace-nowrap">
                              {paying === c.id ? <RefreshCcw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                              Mark Paid
                            </button>
                          ) : (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle size={12} /> Disbursed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">
                      {commissions.length === 0
                        ? 'No commissions generated yet. Enter a period above and click Generate.'
                        : 'No records for selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-600">TOTALS ({filtered.length} records)</td>
                    <td className="px-4 py-3 font-bold text-slate-800">₹{totalBase.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-green-600">+₹{totalBonus.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-red-500">-₹{totalDeductions.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-sky-700 text-base">₹{totalNet.toLocaleString('en-IN')}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Grade rate info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <TrendingUp size={16} /> Commission Calculation — Live from pcd_targets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-blue-800 mb-3">
          {Object.entries(GRADE_RATES).map(([grade, rate]) => (
            <div key={grade} className="bg-white/60 rounded-lg p-3">
              <p className="font-bold">{grade}</p>
              <p>{(rate * 100).toFixed(1)}% of achieved sales</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-blue-600">
          Generate reads <strong>pcd_targets.achieved_amount</strong> × grade rate = base commission.
          Bonus +1% for achieved &gt; ₹5L. Use "Generate" to create or update records for any period.
        </p>
      </div>
    </div>
  );
};

export default PCDCommissionEngine;
