import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, TrendingDown, AlertTriangle, Clock, CheckCircle,
  Plus, DollarSign, RefreshCcw, AlertCircle, X, Calendar
} from 'lucide-react';
import apiClient from '../services/apiClient';

type StatusFilter = 'ALL' | 'OPEN' | 'PARTIAL' | 'CLEARED' | 'OVERDUE';

const PCDReceivablesTracker: React.FC = () => {
  const [receivables, setReceivables] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Payment modal
  const [payModal, setPayModal] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  // Add Invoice modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    partner_id: '', invoice_id: '', invoice_date: '', invoice_amount: '', due_date: '',
  });
  const [adding, setAdding] = useState(false);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rRes, pRes] = await Promise.all([
        apiClient.get('/pcd/receivables'),
        apiClient.get('/pcd/partners?limit=200'),
      ]);
      if (rRes.success) setReceivables(rRes.data);
      if (pRes.success) setPartners(pRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load receivables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived metrics from real DB data
  const totalOutstanding = receivables.reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
  const overdueList = receivables.filter(r => Number(r.days_overdue) > 0 && r.status !== 'CLEARED');
  const totalOverdue = overdueList.reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
  const atRiskCount = receivables.filter(r => r.credit_limit_exceeded).length;
  const clearedTotal = receivables.filter(r => r.status === 'CLEARED').reduce((s, r) => s + Number(r.invoice_amount || 0), 0);
  const clearedCount = receivables.filter(r => r.status === 'CLEARED').length;

  // Aging buckets (by days_overdue from API — computed fresh server-side)
  const aging = {
    current: receivables.filter(r => Number(r.days_overdue) === 0 && r.status !== 'CLEARED'),
    d30:     receivables.filter(r => Number(r.days_overdue) > 0 && Number(r.days_overdue) <= 30),
    d60:     receivables.filter(r => Number(r.days_overdue) > 30 && Number(r.days_overdue) <= 60),
    d90:     receivables.filter(r => Number(r.days_overdue) > 60 && Number(r.days_overdue) <= 90),
    d90p:    receivables.filter(r => Number(r.days_overdue) > 90),
  };
  const agingAmt = (list: any[]) => list.reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);

  const filtered = receivables
    .filter(r => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'OVERDUE') return Number(r.days_overdue) > 0 && r.status !== 'CLEARED';
      return r.status === statusFilter;
    })
    .sort((a, b) => Number(b.days_overdue) - Number(a.days_overdue) || Number(b.outstanding_amount) - Number(a.outstanding_amount));

  const counts: Record<StatusFilter, number> = {
    ALL: receivables.length,
    OPEN: receivables.filter(r => r.status === 'OPEN').length,
    PARTIAL: receivables.filter(r => r.status === 'PARTIAL').length,
    CLEARED: receivables.filter(r => r.status === 'CLEARED').length,
    OVERDUE: overdueList.length,
  };

  const handlePaySubmit = async () => {
    if (!payAmount || Number(payAmount) <= 0) { showToast('error', 'Enter a valid payment amount'); return; }
    if (Number(payAmount) > Number(payModal.outstanding_amount)) {
      showToast('error', `Cannot exceed outstanding amount ₹${Number(payModal.outstanding_amount).toLocaleString('en-IN')}`);
      return;
    }
    setPaying(true);
    try {
      const res = await apiClient.put(`/pcd/receivables/${payModal.id}`, { paid_amount: Number(payAmount) });
      if (res.success) {
        showToast('success', `Payment ₹${Number(payAmount).toLocaleString('en-IN')} recorded for ${payModal.partner_name}`);
        setPayModal(null);
        setPayAmount('');
        await loadData();
      } else {
        showToast('error', res.error || 'Payment failed');
      }
    } catch (e: any) {
      showToast('error', e?.data?.error || e?.message || 'Failed');
    } finally {
      setPaying(false);
    }
  };

  const handleAddInvoice = async () => {
    if (!addForm.partner_id || !addForm.invoice_amount) {
      showToast('error', 'Partner and invoice amount are required'); return;
    }
    setAdding(true);
    try {
      const res = await apiClient.post('/pcd/receivables', {
        partner_id: addForm.partner_id,
        invoice_id: addForm.invoice_id || undefined,
        invoice_date: addForm.invoice_date || undefined,
        invoice_amount: Number(addForm.invoice_amount),
        due_date: addForm.due_date || undefined,
      });
      if (res.success) {
        showToast('success', 'Invoice added to receivables');
        setShowAddModal(false);
        setAddForm({ partner_id: '', invoice_id: '', invoice_date: '', invoice_amount: '', due_date: '' });
        await loadData();
      } else {
        showToast('error', res.error || 'Failed to add invoice');
      }
    } catch (e: any) {
      showToast('error', e?.data?.error || e?.message || 'Failed');
    } finally {
      setAdding(false);
    }
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

      {/* Action bar */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Receivables & Outstanding Dues</h3>
          <p className="text-xs text-slate-500">Live from pcd_receivables — days_overdue computed server-side daily</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCcw size={14} /> Refresh
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700">
            <Plus size={16} /> Add Invoice
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm font-medium">Total Outstanding</p>
            <CreditCard size={18} className="text-sky-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">{receivables.length} invoices</p>
        </div>

        <div className="bg-red-50 border border-red-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-red-600 text-sm font-medium">Overdue Amount</p>
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-700">₹{totalOverdue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-red-400 mt-1">{overdueList.length} invoices</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-orange-600 text-sm font-medium">At Risk Partners</p>
            <TrendingDown size={18} className="text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-700">{atRiskCount}</p>
          <p className="text-xs text-orange-400 mt-1">Credit limit exceeded</p>
        </div>

        <div className="bg-green-50 border border-green-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-600 text-sm font-medium">Cleared</p>
            <CheckCircle size={18} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-700">₹{clearedTotal.toLocaleString('en-IN')}</p>
          <p className="text-xs text-green-400 mt-1">{clearedCount} invoices</p>
        </div>
      </div>

      {/* Aging analysis */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-sky-500" /> Receivables Aging Analysis
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Current (0 Days)', list: aging.current, cls: 'bg-green-50 border-green-200 text-green-700' },
            { label: '1-30 Days',        list: aging.d30,     cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: '31-60 Days',       list: aging.d60,     cls: 'bg-orange-50 border-orange-200 text-orange-700' },
            { label: '61-90 Days',       list: aging.d90,     cls: 'bg-red-50 border-red-200 text-red-700' },
            { label: '90+ Days',         list: aging.d90p,    cls: 'bg-red-100 border-red-300 text-red-800' },
          ].map(b => (
            <div key={b.label} className={`p-4 rounded-xl border ${b.cls}`}>
              <p className="text-xs font-bold uppercase mb-1">{b.label}</p>
              <p className="text-xl font-bold">₹{agingAmt(b.list).toLocaleString('en-IN')}</p>
              <p className="text-xs mt-1">{b.list.length} invoice{b.list.length !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter + table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-200 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(['ALL','OPEN','PARTIAL','CLEARED','OVERDUE'] as StatusFilter[]).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {s}({counts[s]})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCcw size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Partner Name','Invoice ID','Invoice Date','Amount (₹)','Paid (₹)','Outstanding (₹)','Due Date','Days Overdue','Status','Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50 ${r.credit_limit_exceeded ? 'bg-red-50/60' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {r.partner_name}
                      {r.credit_limit_exceeded && <span className="ml-1 text-red-500 text-xs">⚠️ Over limit</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.invoice_id}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {r.invoice_date ? new Date(r.invoice_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">₹{Number(r.invoice_amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-green-600">₹{Number(r.paid_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">₹{Number(r.outstanding_amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {Number(r.days_overdue) > 0 && r.status !== 'CLEARED'
                        ? <span className="text-red-600 font-bold">{r.days_overdue}d</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        r.status === 'CLEARED' ? 'bg-green-100 text-green-700'
                        : r.status === 'PARTIAL' ? 'bg-blue-100 text-blue-700'
                        : Number(r.days_overdue) > 0 ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>{r.status}{Number(r.days_overdue) > 0 && r.status !== 'CLEARED' ? ' · OVERDUE' : ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status !== 'CLEARED' ? (
                        <button
                          onClick={() => { setPayModal(r); setPayAmount(''); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium whitespace-nowrap">
                          <DollarSign size={12} /> Pay
                        </button>
                      ) : (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle size={12} /> Cleared
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400">
                      No receivables for selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-slate-600">TOTALS ({filtered.length})</td>
                    <td className="px-4 py-3 font-bold text-slate-700">₹{filtered.reduce((s,r)=>s+Number(r.invoice_amount),0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-green-600">₹{filtered.reduce((s,r)=>s+Number(r.paid_amount||0),0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-sky-700">₹{filtered.reduce((s,r)=>s+Number(r.outstanding_amount),0).toLocaleString('en-IN')}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-auto">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2"><DollarSign size={18} /> Record Payment</h3>
              <button onClick={() => setPayModal(null)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Partner', payModal.partner_name],
                  ['Invoice', payModal.invoice_id],
                  ['Invoice Amt', `₹${Number(payModal.invoice_amount).toLocaleString('en-IN')}`],
                  ['Already Paid', `₹${Number(payModal.paid_amount||0).toLocaleString('en-IN')}`],
                  ['Outstanding', `₹${Number(payModal.outstanding_amount).toLocaleString('en-IN')}`],
                  ['Days Overdue', Number(payModal.days_overdue) > 0 ? `${payModal.days_overdue}d` : 'Current'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{k}</p>
                    <p className="font-semibold text-slate-800 text-sm">{v}</p>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder={`Max ₹${Number(payModal.outstanding_amount).toLocaleString('en-IN')}`}
                  max={Number(payModal.outstanding_amount)}
                  min={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">
                  Max: ₹{Number(payModal.outstanding_amount).toLocaleString('en-IN')} · Saved to pcd_receivables.paid_amount
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPayModal(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handlePaySubmit} disabled={paying}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {paying ? <RefreshCcw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {paying ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-auto">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold flex items-center gap-2"><Plus size={18} /> Add Receivable Invoice</h3>
              <button onClick={() => setShowAddModal(false)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Partner *</label>
                <select
                  value={addForm.partner_id}
                  onChange={e => setAddForm(f => ({ ...f, partner_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400">
                  <option value="">Select partner…</option>
                  {partners.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.territory}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Invoice ID (auto-generated if blank)</label>
                <input
                  value={addForm.invoice_id}
                  onChange={e => setAddForm(f => ({ ...f, invoice_id: e.target.value }))}
                  placeholder="e.g. INV-2026-009"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Date</label>
                  <input type="date"
                    value={addForm.invoice_date}
                    onChange={e => setAddForm(f => ({ ...f, invoice_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                  <input type="date"
                    value={addForm.due_date}
                    onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Amount (₹) *</label>
                <input type="number"
                  value={addForm.invoice_amount}
                  onChange={e => setAddForm(f => ({ ...f, invoice_amount: e.target.value }))}
                  placeholder="e.g. 150000"
                  min={1}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleAddInvoice} disabled={adding}
                  className="flex-1 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {adding ? <RefreshCcw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {adding ? 'Saving…' : 'Add Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PCDReceivablesTracker;
