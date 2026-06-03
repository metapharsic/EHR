import React, { useState, useEffect, useCallback } from 'react';
import {
  Send, MessageCircle, Mail, Users, CheckCircle, AlertCircle,
  RefreshCcw, X, Eye, Smartphone, Globe
} from 'lucide-react';
import apiClient from '../services/apiClient';

type Channel = 'EMAIL' | 'WHATSAPP' | 'BOTH';
type AudienceType = 'ALL' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'TERRITORY';

const CHANNEL_ICON: Record<Channel, React.ReactNode> = {
  EMAIL: <Mail size={14} />,
  WHATSAPP: <Smartphone size={14} />,
  BOTH: <Globe size={14} />,
};

const CHANNEL_COLOR: Record<Channel, string> = {
  EMAIL: 'bg-blue-100 text-blue-700',
  WHATSAPP: 'bg-green-100 text-green-700',
  BOTH: 'bg-purple-100 text-purple-700',
};

const EMPTY_FORM = {
  title: '',
  message: '',
  channel: 'EMAIL' as Channel,
  audienceType: 'ALL' as AudienceType,
  targetTerritory: '',
};

const PCDBroadcastCenter: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        apiClient.get('/pcd/broadcasts'),
        apiClient.get('/pcd/partners?limit=200'),
      ]);
      if (bRes.success) setBroadcasts(bRes.data);
      if (pRes.success) setPartners(pRes.data);
    } catch (e: any) {
      showToast('error', e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute recipient count based on audience selection
  const computeRecipients = (): { count: number; grades: string; states: string | null } => {
    const active = partners.filter(p => p.status === 'ACTIVE' || p.status === 'APPLIED');

    if (form.audienceType === 'ALL') {
      return { count: active.length, grades: 'ALL', states: null };
    }
    if (form.audienceType === 'TERRITORY') {
      const match = active.filter(p => p.territory === form.targetTerritory);
      return { count: match.length, grades: 'ALL', states: form.targetTerritory || null };
    }
    const gradeMatch = active.filter(p => p.partner_grade === form.audienceType);
    return { count: gradeMatch.length, grades: form.audienceType, states: null };
  };

  const { count: recipientCount, grades: targetGrades, states: targetStates } = computeRecipients();
  const territories = Array.from(new Set(partners.map(p => p.territory).filter(Boolean))).sort();

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      showToast('error', 'Subject and message are required');
      return;
    }
    if (form.audienceType === 'TERRITORY' && !form.targetTerritory) {
      showToast('error', 'Select a territory');
      return;
    }
    if (recipientCount === 0) {
      showToast('error', 'No partners match the selected audience');
      return;
    }
    setSending(true);
    try {
      const res = await apiClient.post('/pcd/broadcasts', {
        title: form.title.trim(),
        message: form.message.trim(),
        channel: form.channel,
        target_grades: targetGrades,
        target_states: targetStates,
        recipient_count: recipientCount,
      });
      if (res.success) {
        showToast('success', `Broadcast sent to ${recipientCount} partner${recipientCount !== 1 ? 's' : ''}`);
        setForm(EMPTY_FORM);
        setShowForm(false);
        setShowPreview(false);
        await loadData();
      } else {
        showToast('error', res.error || 'Send failed');
      }
    } catch (e: any) {
      showToast('error', e?.data?.error || e?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const totalDispatches = broadcasts.reduce((s, b) => s + Number(b.recipient_count || 0), 0);
  const activePartners = partners.filter(p => p.status === 'ACTIVE').length;

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400 transition';

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Broadcast Center</h2>
          <p className="text-slate-500 text-sm">Send announcements and alerts to PCD partners — saved to pcd_broadcast_messages</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { setShowForm(f => !f); setShowPreview(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors">
            <Send size={16} /> New Message
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Total Sent</p>
            <Send size={18} className="text-sky-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{broadcasts.length}</p>
          <p className="text-xs text-slate-400 mt-1">broadcast messages</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Total Dispatches</p>
            <MessageCircle size={18} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalDispatches}</p>
          <p className="text-xs text-slate-400 mt-1">partner notifications sent</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Active Partners</p>
            <Users size={18} className="text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{activePartners}</p>
          <p className="text-xs text-slate-400 mt-1">in network</p>
        </div>
      </div>

      {/* Compose form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Send size={16} className="text-sky-500" /> Compose Broadcast</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Q2 Scheme Announcement" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Message *</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Dear Partner, ..." rows={5}
              className={`${inputCls} resize-none`} />
            <p className="text-xs text-slate-400 mt-1">{form.message.length} characters</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Channel *</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as Channel }))} className={inputCls}>
                <option value="EMAIL">Email Only</option>
                <option value="WHATSAPP">WhatsApp Only</option>
                <option value="BOTH">WhatsApp + Email</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Target Audience *</label>
              <select value={form.audienceType} onChange={e => setForm(f => ({ ...f, audienceType: e.target.value as AudienceType, targetTerritory: '' }))} className={inputCls}>
                <option value="ALL">All Partners ({partners.length})</option>
                <option value="PLATINUM">Platinum Grade Only ({partners.filter(p => p.partner_grade === 'PLATINUM').length})</option>
                <option value="GOLD">Gold Grade Only ({partners.filter(p => p.partner_grade === 'GOLD').length})</option>
                <option value="SILVER">Silver Grade Only ({partners.filter(p => p.partner_grade === 'SILVER').length})</option>
                <option value="BRONZE">Bronze Grade Only ({partners.filter(p => p.partner_grade === 'BRONZE').length})</option>
                <option value="TERRITORY">Specific Territory</option>
              </select>
            </div>
          </div>

          {form.audienceType === 'TERRITORY' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Territory *</label>
              <select value={form.targetTerritory} onChange={e => setForm(f => ({ ...f, targetTerritory: e.target.value }))} className={inputCls}>
                <option value="">Choose territory…</option>
                {territories.map(t => {
                  const count = partners.filter(p => p.territory === t).length;
                  return <option key={t} value={t}>{t} ({count} partner{count !== 1 ? 's' : ''})</option>;
                })}
              </select>
            </div>
          )}

          <div className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
            recipientCount > 0 ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span>
              <strong>{recipientCount}</strong> partner{recipientCount !== 1 ? 's' : ''} will receive this message
              {targetGrades !== 'ALL' && <span className="ml-1 text-xs opacity-70">(grade: {targetGrades})</span>}
              {targetStates && <span className="ml-1 text-xs opacity-70">(territory: {targetStates})</span>}
            </span>
            <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded border">Saved to DB ✓</span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowPreview(true)} disabled={!form.title || !form.message}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-40 flex items-center gap-1.5">
              <Eye size={14} /> Preview
            </button>
            <button onClick={handleSend} disabled={sending}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors">
              {sending ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending…' : `Send to ${recipientCount} Partner${recipientCount !== 1 ? 's' : ''}`}
            </button>
            <button onClick={() => { setForm(EMPTY_FORM); setShowForm(false); }}
              className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-auto">
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center rounded-t-xl">
              <h3 className="font-bold">Message Preview</h3>
              <button onClick={() => setShowPreview(false)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3 text-sm">
                {[
                  ['Subject', form.title],
                  ['Channel', form.channel],
                  ['Audience', form.audienceType === 'TERRITORY' ? `Territory: ${form.targetTerritory}` : form.audienceType],
                  ['Recipients', `${recipientCount} partner${recipientCount !== 1 ? 's' : ''}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b border-slate-100 pb-2">
                    <span className="text-slate-400 w-24 flex-shrink-0">{k}</span>
                    <span className="font-medium text-slate-800">{v}</span>
                  </div>
                ))}
                <div>
                  <p className="text-slate-400 text-xs mb-2">Message Body</p>
                  <div className="bg-slate-50 rounded-lg p-4 text-slate-700 whitespace-pre-wrap text-sm border border-slate-200">
                    {form.message}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                  Back to Edit
                </button>
                <button onClick={() => { setShowPreview(false); handleSend(); }}
                  disabled={sending}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                  Confirm & Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message history */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <MessageCircle size={16} className="text-sky-500" /> Message History
          </h3>
          <span className="text-xs text-slate-400">{broadcasts.length} messages</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCcw size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Send size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No broadcasts sent yet</p>
            <p className="text-sm mt-1">Click "New Message" to compose your first broadcast</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Date','Subject','Channel','Target Grades','States/Territory','Recipients','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadcasts.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{b.title}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${CHANNEL_COLOR[b.channel as Channel] || 'bg-slate-100 text-slate-600'}`}>
                        {CHANNEL_ICON[b.channel as Channel]} {b.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.target_grades ? (
                        <div className="flex flex-wrap gap-1">
                          {String(b.target_grades).split(',').map(g => g.trim()).filter(Boolean).map(g => (
                            <span key={g} className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              g === 'PLATINUM' ? 'bg-purple-100 text-purple-700'
                              : g === 'GOLD' ? 'bg-yellow-100 text-yellow-700'
                              : g === 'SILVER' ? 'bg-slate-200 text-slate-700'
                              : g === 'ALL' ? 'bg-sky-100 text-sky-700'
                              : 'bg-orange-100 text-orange-700'
                            }`}>{g}</span>
                          ))}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{b.target_states || '—'}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">{b.recipient_count}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold w-fit ${
                        b.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        <CheckCircle size={11} /> {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-600">TOTAL DISPATCHES</td>
                  <td className="px-4 py-3 text-center font-bold text-sky-700 text-base">{totalDispatches}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PCDBroadcastCenter;
