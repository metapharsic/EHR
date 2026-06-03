import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, Users, ShoppingCart, DollarSign, MessageSquare,
  Calendar, Filter, RefreshCcw, AlertCircle, Target, Gift,
  TrendingUp, Award, Megaphone, UserPlus, CreditCard
} from 'lucide-react';
import apiClient from '../services/apiClient';

// Map DB action_type → display config
const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; badge: string }> = {
  ORDER_PLACED:       { label: 'Order Placed',        icon: <ShoppingCart size={16} />, bg: 'bg-green-100',   badge: 'bg-green-100 text-green-700' },
  PAYMENT_RECEIVED:   { label: 'Payment Received',    icon: <DollarSign size={16} />,   bg: 'bg-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  INVOICE_RAISED:     { label: 'Invoice Raised',      icon: <CreditCard size={16} />,   bg: 'bg-blue-100',    badge: 'bg-blue-100 text-blue-700' },
  MR_VISIT:           { label: 'MR Visit',            icon: <Users size={16} />,        bg: 'bg-sky-100',     badge: 'bg-sky-100 text-sky-700' },
  MR_ASSIGNED:        { label: 'MR Assigned',         icon: <UserPlus size={16} />,     bg: 'bg-indigo-100',  badge: 'bg-indigo-100 text-indigo-700' },
  PARTNER_CREATED:    { label: 'Partner Created',     icon: <UserPlus size={16} />,     bg: 'bg-teal-100',    badge: 'bg-teal-100 text-teal-700' },
  PARTNER_ONBOARDED:  { label: 'Partner Onboarded',   icon: <UserPlus size={16} />,     bg: 'bg-teal-100',    badge: 'bg-teal-100 text-teal-700' },
  PARTNER_UPGRADED:   { label: 'Partner Upgraded',    icon: <TrendingUp size={16} />,   bg: 'bg-purple-100',  badge: 'bg-purple-100 text-purple-700' },
  TARGET_ACHIEVED:    { label: 'Target Achieved',     icon: <Target size={16} />,       bg: 'bg-green-100',   badge: 'bg-green-100 text-green-700' },
  TARGET_EXCEEDED:    { label: 'Target Exceeded',     icon: <Award size={16} />,        bg: 'bg-yellow-100',  badge: 'bg-yellow-100 text-yellow-700' },
  SCHEME_CREATED:     { label: 'Scheme Created',      icon: <Gift size={16} />,         bg: 'bg-orange-100',  badge: 'bg-orange-100 text-orange-700' },
  SCHEME_ENROLLED:    { label: 'Scheme Enrolled',     icon: <Gift size={16} />,         bg: 'bg-amber-100',   badge: 'bg-amber-100 text-amber-700' },
  BROADCAST_SENT:     { label: 'Broadcast Sent',      icon: <Megaphone size={16} />,    bg: 'bg-blue-100',    badge: 'bg-blue-100 text-blue-700' },
  COMMISSION_PAID:    { label: 'Commission Paid',     icon: <CreditCard size={16} />,   bg: 'bg-cyan-100',    badge: 'bg-cyan-100 text-cyan-700' },
  COMMISSION_GENERATED: { label: 'Commission Generated', icon: <DollarSign size={16} />, bg: 'bg-sky-100',   badge: 'bg-sky-100 text-sky-700' },
};

const getConfig = (type: string) =>
  ACTION_CONFIG[type] || { label: type.replace(/_/g, ' '), icon: <Activity size={16} />, bg: 'bg-slate-100', badge: 'bg-slate-100 text-slate-600' };

const formatTime = (ts: string) => {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  if (diffH < 168) return `${Math.floor(diffH / 24)}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PCDActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterType, setFilterType] = useState('ALL');
  const [filterPartner, setFilterPartner] = useState('');
  const [limit, setLimit] = useState(50);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, pRes] = await Promise.all([
        apiClient.get(`/pcd/activity-log?limit=${limit}`),
        apiClient.get('/pcd/partners?limit=200'),
      ]);
      if (aRes.success) setActivities(aRes.data);
      if (pRes.success) setPartners(pRes.data);
    } catch (e: any) {
      setError(e.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { loadData(); }, [loadData]);

  // All distinct action types in data
  const actionTypes = useMemo(() =>
    ['ALL', ...Array.from(new Set(activities.map(a => a.action_type))).sort()],
    [activities]
  );

  const filtered = useMemo(() => {
    return activities.filter(a => {
      const typeOk = filterType === 'ALL' || a.action_type === filterType;
      const partnerOk = !filterPartner || a.partner_id === filterPartner;
      return typeOk && partnerOk;
    });
  }, [activities, filterType, filterPartner]);

  // KPI stats from real log
  const orderCount = activities.filter(a => a.action_type === 'ORDER_PLACED').length;
  const paymentCount = activities.filter(a => a.action_type === 'PAYMENT_RECEIVED').length;
  const mrVisitCount = activities.filter(a => a.action_type === 'MR_VISIT').length;
  const targetCount = activities.filter(a => ['TARGET_ACHIEVED', 'TARGET_EXCEEDED'].includes(a.action_type)).length;

  // Most active partner (by order count)
  const mostActivePartner = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    activities.filter(a => a.action_type === 'ORDER_PLACED' && a.partner_id).forEach(a => {
      const key = a.partner_id;
      if (!counts[key]) counts[key] = { name: a.partner_name || a.partner_id, count: 0 };
      counts[key].count++;
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [activities]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Activity Feed</h2>
          <p className="text-slate-500 text-sm">Live from pcd_activity_log — all partner & system interactions</p>
        </div>
        <button onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Total Activities</p>
            <Activity size={18} className="text-sky-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{activities.length}</p>
          <p className="text-xs text-slate-400 mt-1">All time in log</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Orders</p>
            <ShoppingCart size={18} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{orderCount}</p>
          <p className="text-xs text-slate-400 mt-1">ORDER_PLACED events</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Payments</p>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{paymentCount}</p>
          <p className="text-xs text-slate-400 mt-1">PAYMENT_RECEIVED events</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm">Targets Hit</p>
            <Target size={18} className="text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800">{targetCount}</p>
          <p className="text-xs text-slate-400 mt-1">Achieved + Exceeded</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Filter size={16} className="text-sky-500" /> Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Activity Type</label>
            <div className="flex flex-wrap gap-1.5">
              {actionTypes.map(type => {
                const count = type === 'ALL' ? activities.length : activities.filter(a => a.action_type === type).length;
                return (
                  <button key={type} onClick={() => setFilterType(type)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      filterType === type ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {type === 'ALL' ? 'ALL' : getConfig(type).label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Partner</label>
            <select value={filterPartner}
              onChange={e => setFilterPartner(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400">
              <option value="">All Partners</option>
              {partners.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — {p.territory}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Show last N records</label>
            <select value={limit} onChange={e => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-400">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity size={18} className="text-sky-500" /> Activity Timeline
          <span className="text-xs font-normal text-slate-400 ml-2">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
            <RefreshCcw size={20} className="animate-spin mr-2" /> Loading activities…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center text-slate-400">
            <Activity size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No activities found for the selected filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a, idx) => {
              const cfg = getConfig(a.action_type);
              return (
                <div key={a.id} className="relative flex gap-4">
                  {/* Vertical connector */}
                  {idx < filtered.length - 1 && (
                    <div className="absolute left-5 top-10 w-0.5 h-full bg-slate-100 -z-0" />
                  )}

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center z-10 shadow-sm`}>
                    {cfg.icon}
                  </div>

                  {/* Card */}
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow mb-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${cfg.badge}`}>{cfg.label}</span>
                          {a.entity_type && (
                            <span className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              {a.entity_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-800 mt-1">{a.description}</p>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                          {a.actor_name && (
                            <span className="flex items-center gap-1">
                              <Users size={11} /> {a.actor_name}
                            </span>
                          )}
                          {a.partner_name && (
                            <span className="flex items-center gap-1">
                              🏢 {a.partner_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-slate-400 flex items-center gap-1 justify-end whitespace-nowrap">
                          <Calendar size={11} /> {formatTime(a.created_at)}
                        </p>
                        <p className="text-xs text-slate-300 mt-1 font-mono">
                          {new Date(a.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Engagement summary — from real data only */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          <MessageSquare size={18} /> Engagement Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-blue-600 font-medium text-xs uppercase mb-1">Most Active Partner</p>
            <p className="text-blue-900 font-bold">
              {mostActivePartner ? `${mostActivePartner.name} (${mostActivePartner.count} orders)` : 'No order data yet'}
            </p>
          </div>
          <div>
            <p className="text-blue-600 font-medium text-xs uppercase mb-1">MR Visits Logged</p>
            <p className="text-blue-900 font-bold">{mrVisitCount} field visits in log</p>
          </div>
          <div>
            <p className="text-blue-600 font-medium text-xs uppercase mb-1">Unique Action Types</p>
            <p className="text-blue-900 font-bold">{actionTypes.length - 1} distinct activity types</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PCDActivityFeed;
