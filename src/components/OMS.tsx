/**
 * ORDER MANAGEMENT SYSTEM (OMS) — AI-era B2B order lifecycle hub.
 *
 * Tabs: Orders · Pipeline · Analytics · AI Command Center · Returns
 * Full lifecycle: Pending Approval → Approved (reserve) → Processing →
 * Shipped (decrement) → Delivered → Invoiced (order-to-cash).
 * AI: order risk scoring, fulfillment feasibility, confirmation drafting,
 *     portfolio insights, demand forecast, auto-reorder suggestions.
 * Returns: initiate, approve, track.
 * Partial Dispatch: per-item dispatch with carrier + tracking.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingCart, Package, Truck, CheckCircle, Clock, XCircle, AlertTriangle,
  Eye, Plus, Sparkles, RefreshCcw, FileText, Send, ShieldCheck, Trash2,
  TrendingUp, Brain, ClipboardCheck, Copy, Boxes, IndianRupee, ArrowRight,
  Zap, RotateCcw, Users, Target, ChevronRight,
} from 'lucide-react';

import { ERPLayout, FilterBar, DataTable, StatCard, Tabs, Badge, Modal } from './UniversalLayout';
import { useDatabaseStatus, useDataFetch } from '../hooks/useDataFetch';
import { useAppStore } from '../store/useAppStore';
import { omsService } from '../services/omsService';
import OrderReturnModal from './OrderReturnModal';
import OMSAnalytics from './OMSAnalytics';
import type {
  OmsStats, OmsDropdown, DistributorOrder, OrderDetail,
  AiFulfillment, OmsPortfolioInsights, OrderReturn,
  OmsDemandPrediction, OmsAutoReorderSuggestion,
} from '../types';

const inr = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const statusVariant = (s: string): any => {
  switch (s) {
    case 'Pending Approval': return 'warning';
    case 'Approved': return 'info';
    case 'Processing': return 'warning';
    case 'Shipped': return 'info';
    case 'Delivered': return 'success';
    case 'Invoiced': return 'success';
    case 'Rejected':
    case 'Cancelled': return 'danger';
    case 'Hold': return 'neutral';
    default: return 'neutral';
  }
};

const riskVariant = (lvl?: string): any =>
  lvl === 'High' ? 'danger' : lvl === 'Medium' ? 'warning' : lvl === 'Low' ? 'success' : 'neutral';

const nextAction = (status: string): { label: string; to: string; icon: React.ReactNode } | null => {
  switch (status) {
    case 'Pending Approval': return { label: 'Approve', to: 'Approved', icon: <CheckCircle size={14} /> };
    case 'Approved': return { label: 'Ship', to: 'Shipped', icon: <Truck size={14} /> };
    case 'Processing': return { label: 'Ship', to: 'Shipped', icon: <Truck size={14} /> };
    case 'Shipped': return { label: 'Mark Delivered', to: 'Delivered', icon: <Package size={14} /> };
    case 'Delivered': return { label: 'Generate Invoice', to: 'Invoiced', icon: <FileText size={14} /> };
    default: return null;
  }
};

const isActiveStatus = (status: string) =>
  ['Pending Approval', 'Approved', 'Processing', 'Shipped'].includes(status);

const isNonTerminal = (status: string) =>
  !['Shipped', 'Delivered', 'Invoiced', 'Cancelled', 'Rejected'].includes(status);

const PIPELINE_COLUMNS = ['Pending Approval', 'Approved', 'Processing', 'Shipped', 'Delivered'];

const confidenceColor = (c: string) => {
  if (c === 'High') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (c === 'Medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const urgencyColor = (u: string) => {
  if (u === 'Critical') return 'bg-red-100 text-red-700 border-red-200';
  if (u === 'High') return 'bg-orange-100 text-orange-700 border-orange-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const returnStatusVariant = (s: string): any => {
  if (s === 'Approved' || s === 'Restocked' || s === 'Credit Issued') return 'success';
  if (s === 'Pending') return 'warning';
  return 'neutral';
};

// ============================================================

const OMS: React.FC = () => {
  const { status: dbStatus } = useDatabaseStatus();
  const addNotification = useAppStore((s) => s.addNotification);

  // Core data
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'PIPELINE' | 'AI' | 'ANALYTICS' | 'RETURNS'>('ORDERS');
  const [stats, setStats] = useState<OmsStats | null>(null);
  const [dropdown, setDropdown] = useState<OmsDropdown | null>(null);
  const [orders, setOrders] = useState<DistributorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({ search: '', status: 'ALL', priority: 'ALL' });

  const { data: products } = useDataFetch<any[]>('/api/products');

  // Detail modal
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // AI panels (detail)
  const [aiFulfillment, setAiFulfillment] = useState<AiFulfillment | null>(null);
  const [aiDraft, setAiDraft] = useState<string>('');
  const [aiBusy, setAiBusy] = useState<{ risk?: boolean; fulfil?: boolean; draft?: boolean }>({});

  // AI Command Center
  const [insights, setInsights] = useState<OmsPortfolioInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // AI Demand Forecast & Auto-Reorder
  const [demandPredictions, setDemandPredictions] = useState<{ predictions: OmsDemandPrediction[]; insight: string } | null>(null);
  const [reorderSuggestions, setReorderSuggestions] = useState<{ suggestions: OmsAutoReorderSuggestion[]; summary: string } | null>(null);
  const [predictionsLoading, setPredictionsLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);

  // SLA
  const [slaBreaches, setSlaBreaches] = useState<any[]>([]);

  // Returns
  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsFilter, setReturnsFilter] = useState('ALL');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [orderReturns, setOrderReturns] = useState<OrderReturn[]>([]);
  const [approveReturnBusy, setApproveReturnBusy] = useState<string | null>(null);

  // Partial Dispatch (detail)
  const [showDispatchPanel, setShowDispatchPanel] = useState(false);
  const [dispatchItems, setDispatchItems] = useState<
    Array<{ orderItemId: string; productId: string; productName: string; quantity: number; batchId?: string }>
  >([]);
  const [dispatchCarrier, setDispatchCarrier] = useState('');
  const [dispatchTracking, setDispatchTracking] = useState('');
  const [dispatchBusy, setDispatchBusy] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [distributorId, setDistributorId] = useState('');
  const [godownId, setGodownId] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [packingSpecs, setPackingSpecs] = useState('');
  const [labelingSpecs, setLabelingSpecs] = useState('');
  const [cart, setCart] = useState<any[]>([]);

  const notifyError = (e: any, fallback: string) =>
    addNotification({ type: 'error', message: e?.data?.error || e?.message || fallback });

  // ---- Data loading ----
  const loadOrders = useCallback(async () => {
    const res = await omsService.getOrders({
      search: filters.search,
      status: filters.status,
      priority: filters.priority,
      limit: 200,
    });
    setOrders(res.data || []);
  }, [filters]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d] = await Promise.all([omsService.getStats(), omsService.getDropdown()]);
      setStats(s);
      setDropdown(d);
      await loadOrders();
      // Load SLA breaches in background
      omsService.getSlaBreaches().then(setSlaBreaches).catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'Failed to load OMS data');
    } finally {
      setLoading(false);
    }
  }, [loadOrders]);

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(() => { loadOrders().catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [filters, loadOrders]);

  const refreshAfterMutation = async () => {
    try {
      const s = await omsService.getStats();
      setStats(s);
      await loadOrders();
    } catch { /* non-fatal */ }
  };

  // ---- Returns tab loading ----
  const loadReturns = useCallback(async () => {
    setReturnsLoading(true);
    try {
      const res = await omsService.getReturns(returnsFilter !== 'ALL' ? { status: returnsFilter } : {});
      setReturns(res.data || []);
    } catch (e: any) {
      notifyError(e, 'Failed to load returns');
    } finally {
      setReturnsLoading(false);
    }
  }, [returnsFilter]); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'RETURNS') loadReturns();
  }, [activeTab, loadReturns]);

  // ---- Detail ----
  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetail(null);
    setAiFulfillment(null);
    setAiDraft('');
    setDetailLoading(true);
    setShowDispatchPanel(false);
    setDispatchItems([]);
    setDispatchCarrier('');
    setDispatchTracking('');
    setOrderReturns([]);
    try {
      const [orderData] = await Promise.all([omsService.getOrder(id)]);
      setDetail(orderData);
      // Load order returns in background
      omsService.getOrderReturns(id).then(setOrderReturns).catch(() => {});
    } catch (e: any) {
      notifyError(e, 'Failed to load order');
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadDetail = async () => {
    if (detailId) {
      try { setDetail(await omsService.getOrder(detailId)); } catch { /* ignore */ }
    }
  };

  // ---- Lifecycle actions ----
  const advance = async (order: { id: string; status: string }, to: string) => {
    setActionBusy(true);
    try {
      if (to === 'Approved') {
        await omsService.approveOrder(order.id);
        addNotification({ type: 'success', message: 'Order approved — stock reserved' });
      } else if (to === 'Invoiced') {
        const res = await omsService.convertToInvoice(order.id);
        addNotification({ type: 'success', message: res.message || 'Invoice generated' });
      } else {
        const res = await omsService.updateStatus(order.id, to);
        addNotification({ type: 'success', message: res.message || `Moved to ${to}` });
      }
      await refreshAfterMutation();
      await reloadDetail();
    } catch (e: any) {
      notifyError(e, `Could not move order to ${to}`);
    } finally {
      setActionBusy(false);
    }
  };

  const cancelOrder = async (id: string) => {
    setActionBusy(true);
    try {
      await omsService.cancelOrder(id);
      addNotification({ type: 'success', message: 'Order cancelled' });
      await refreshAfterMutation();
      await reloadDetail();
    } catch (e: any) {
      notifyError(e, 'Could not cancel order');
    } finally {
      setActionBusy(false);
    }
  };

  // ---- AI actions ----
  const runRisk = async (id: string) => {
    setAiBusy((b) => ({ ...b, risk: true }));
    try {
      const ai = await omsService.runAiRisk(id);
      addNotification({ type: 'info', message: `AI risk: ${ai.riskLevel} (${ai.riskScore}) — ${ai.recommendation}` });
      await reloadDetail();
      await refreshAfterMutation();
    } catch (e: any) {
      notifyError(e, 'AI risk analysis failed');
    } finally {
      setAiBusy((b) => ({ ...b, risk: false }));
    }
  };

  const runFulfillment = async (id: string) => {
    setAiBusy((b) => ({ ...b, fulfil: true }));
    try {
      setAiFulfillment(await omsService.getAiFulfillment(id));
    } catch (e: any) {
      notifyError(e, 'AI fulfillment forecast failed');
    } finally {
      setAiBusy((b) => ({ ...b, fulfil: false }));
    }
  };

  const draftConfirmation = async (id: string) => {
    setAiBusy((b) => ({ ...b, draft: true }));
    try {
      setAiDraft(await omsService.getAiConfirmation(id));
    } catch (e: any) {
      notifyError(e, 'AI drafting failed');
    } finally {
      setAiBusy((b) => ({ ...b, draft: false }));
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      setInsights(await omsService.getPortfolioInsights());
    } catch (e: any) {
      notifyError(e, 'Could not load AI insights');
    } finally {
      setInsightsLoading(false);
    }
  };

  const loadPredictions = async () => {
    setPredictionsLoading(true);
    try {
      setDemandPredictions(await omsService.predictNextOrders());
    } catch (e: any) {
      notifyError(e, 'Could not load demand predictions');
    } finally {
      setPredictionsLoading(false);
    }
  };

  const loadReorderSuggestions = async () => {
    setReorderLoading(true);
    try {
      setReorderSuggestions(await omsService.suggestAutoReorder());
    } catch (e: any) {
      notifyError(e, 'Could not load reorder suggestions');
    } finally {
      setReorderLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AI') {
      if (!insights) loadInsights();
      if (!demandPredictions) loadPredictions();
      if (!reorderSuggestions) loadReorderSuggestions();
    }
    /* eslint-disable-next-line */
  }, [activeTab]);

  // ---- Partial Dispatch ----
  const initDispatch = (orderDetail: OrderDetail) => {
    setDispatchItems(
      orderDetail.items.map((it) => ({
        orderItemId: it.id,
        productId: it.product_id,
        productName: it.product_name,
        quantity: 0,
        batchId: it.batch_id ?? undefined,
      }))
    );
    setShowDispatchPanel(true);
  };

  const handleDispatch = async () => {
    if (!detail) return;
    const itemsToDispatch = dispatchItems.filter((i) => i.quantity > 0);
    if (itemsToDispatch.length === 0) {
      addNotification({ type: 'warning', message: 'Enter quantity > 0 for at least one item' });
      return;
    }
    setDispatchBusy(true);
    try {
      const res = await omsService.dispatchPartial(detail.id, {
        items: itemsToDispatch,
        carrier: dispatchCarrier || undefined,
        trackingNumber: dispatchTracking || undefined,
      });
      addNotification({ type: 'success', message: res.message || `Dispatched — ${res.data?.shipmentNumber ?? ''}` });
      setShowDispatchPanel(false);
      await reloadDetail();
      await refreshAfterMutation();
    } catch (e: any) {
      notifyError(e, 'Dispatch failed');
    } finally {
      setDispatchBusy(false);
    }
  };

  // ---- Return approval ----
  const approveReturn = async (returnId: string) => {
    setApproveReturnBusy(returnId);
    try {
      const res = await omsService.approveReturn(returnId);
      addNotification({ type: 'success', message: res.message || 'Return approved' });
      await loadReturns();
    } catch (e: any) {
      notifyError(e, 'Could not approve return');
    } finally {
      setApproveReturnBusy(null);
    }
  };

  // ---- Create order ----
  const addToCart = (p: any) => {
    setCart((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing) return c.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      const rate = Number(p.selling_rate || p.ptr_rate || (p.mrp ? p.mrp * 0.7 : 0));
      return [...c, { productId: p.id, productName: p.name, quantity: 1, rate, gstPercent: Number(p.gst || 0) }];
    });
  };
  const setQty = (productId: string, quantity: number) =>
    setCart((c) => c.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i)));
  const setRate = (productId: string, rate: number) =>
    setCart((c) => c.map((i) => (i.productId === productId ? { ...i, rate: Math.max(0, rate) } : i)));
  const removeItem = (productId: string) => setCart((c) => c.filter((i) => i.productId !== productId));

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.quantity * i.rate, 0), [cart]);

  const resetCreate = () => {
    setCart([]); setDistributorId(''); setGodownId(''); setPriority('Normal');
    setExpectedDelivery(''); setPackingSpecs(''); setLabelingSpecs('');
  };

  const placeOrder = async () => {
    const dist = dropdown?.distributors.find((d) => d.value === distributorId);
    if (!dist || cart.length === 0) {
      addNotification({ type: 'warning', message: 'Select a distributor and add at least one product' });
      return;
    }
    setPlacing(true);
    try {
      const res = await omsService.createOrder({
        distributorId: dist.value,
        distributorName: dist.label,
        items: cart,
        priority,
        godownId: godownId || undefined,
        expectedDeliveryDate: expectedDelivery || undefined,
        packingSpecs,
        labelingSpecs,
      });
      addNotification({ type: 'success', message: res.message || 'Order placed' });
      setShowCreate(false);
      resetCreate();
      await refreshAfterMutation();
    } catch (e: any) {
      notifyError(e, 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  // ---- Derived ----
  const selectedDistributor = dropdown?.distributors.find((d) => d.value === distributorId);

  const daysSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // SLA warning: non-terminal order older than 7 days
  const hasSlaWarning = (order: DistributorOrder) =>
    isActiveStatus(order.status) && daysSince(order.date) > 7;

  const columns = [
    {
      key: 'orderNumber', label: 'Order #', width: '12%',
      render: (v: string, row: DistributorOrder) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-slate-600">{v || '—'}</span>
          {hasSlaWarning(row) && (
            <span title="SLA Warning: Order open >7 days" className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 flex items-center gap-0.5">
              <AlertTriangle size={8} /> SLA
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'distributorName', label: 'Distributor', width: '20%',
      render: (v: string, row: DistributorOrder) => (
        <div>
          <span className="text-[13px] text-slate-800">{v}</span>
          {row.creditStatus === 'Limit Exceeded' && (
            <span className="ml-1.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5">
              Credit Limit
            </span>
          )}
        </div>
      ),
    },
    { key: 'date', label: 'Date', width: '10%', render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—') },
    {
      key: 'totalAmount', label: 'Amount', width: '11%', align: 'right' as const,
      render: (v: number) => <span className="font-semibold">{inr(v)}</span>,
    },
    {
      key: 'aiRiskLevel', label: 'AI Risk', width: '10%', align: 'center' as const,
      render: (v: string, row: DistributorOrder) =>
        v ? <Badge text={`${v}${row.aiRiskScore != null ? ` ${row.aiRiskScore}` : ''}`} variant={riskVariant(v)} /> : <span className="text-slate-300 text-xs">—</span>,
    },
    { key: 'status', label: 'Status', width: '13%', align: 'center' as const, render: (v: string) => <Badge text={v} variant={statusVariant(v)} /> },
    {
      key: 'actions', label: '', width: '24%', align: 'right' as const,
      render: (_: any, row: DistributorOrder) => {
        const na = nextAction(row.status);
        return (
          <div className="flex items-center justify-end gap-1.5">
            {na && (
              <button
                onClick={() => advance(row, na.to)}
                disabled={actionBusy}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-semibold bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:opacity-50 transition-colors"
              >
                {na.icon}{na.label}
              </button>
            )}
            <button onClick={() => openDetail(row.id)} className="p-1.5 text-slate-500 hover:text-[#22c55e] hover:bg-slate-100 rounded-md transition-colors" title="View details">
              <Eye size={16} />
            </button>
            {isNonTerminal(row.status) && (
              <button
                onClick={() => { if (window.confirm(`Cancel order ${row.orderNumber}?`)) cancelOrder(row.id); }}
                disabled={actionBusy}
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                title="Cancel order"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // Returns table columns
  const returnsColumns = [
    {
      key: 'return_number', label: 'Return #', width: '12%',
      render: (v: string) => <span className="font-mono text-xs font-bold text-indigo-600">{v || '—'}</span>,
    },
    {
      key: 'order_number', label: 'Order #', width: '12%',
      render: (v: string) => <span className="font-mono text-xs font-bold text-slate-600">{v || '—'}</span>,
    },
    { key: 'distributor_name', label: 'Distributor', width: '20%' },
    {
      key: 'items', label: 'Items', width: '8%', align: 'center' as const,
      render: (v: any[]) => <span className="text-[13px] font-semibold text-slate-600">{v?.length ?? 0}</span>,
    },
    {
      key: 'status', label: 'Status', width: '14%', align: 'center' as const,
      render: (v: string) => <Badge text={v} variant={returnStatusVariant(v)} />,
    },
    {
      key: 'return_date', label: 'Date', width: '10%',
      render: (v: string) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      key: 'actions', label: '', width: '16%', align: 'right' as const,
      render: (_: any, row: OrderReturn) =>
        row.status === 'Pending' ? (
          <button
            onClick={() => approveReturn(row.id)}
            disabled={approveReturnBusy === row.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            {approveReturnBusy === row.id ? <RefreshCcw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            Approve
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 font-semibold">{row.status}</span>
        ),
    },
  ];

  if (!dbStatus.connected && !loading) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-6 flex gap-3">
        <AlertTriangle className="w-6 h-6 text-red-600" />
        <div>
          <p className="font-semibold text-red-900">Database Connection Failed</p>
          <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
        </div>
      </div>
    );
  }

  return (
    <ERPLayout
      title="Order Management System (OMS)"
      description="AI-assisted B2B order processing & fulfillment"
      onRefresh={loadAll}
      isLoading={loading}
      actionButtons={[
        <button
          key="new-order"
          onClick={() => setShowCreate(true)}
          className="bg-[#22c55e] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 hover:bg-[#16a34a] transition-colors text-[13px]"
        >
          <Plus size={16} /> New Order
        </button>,
      ]}
    >
      {/* Stat band — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <StatCard label="Total Orders" value={stats?.total_orders ?? 0} icon={<ShoppingCart size={18} />} color="blue" />
        <StatCard label="Pending" value={stats?.pending_orders ?? 0} icon={<Clock size={18} />} color="warning" />
        <StatCard label="In Fulfilment" value={(stats?.active_orders ?? 0) + (stats?.shipped_orders ?? 0)} icon={<Truck size={18} />} color="info" />
        <StatCard label="At Risk (AI)" value={stats?.at_risk_orders ?? 0} icon={<ShieldCheck size={18} />} color="danger" />
        <StatCard label="Open Value" value={inr(stats?.open_value)} icon={<IndianRupee size={18} />} color="success" />
        <StatCard label="SLA Breaches" value={slaBreaches.length} icon={<AlertTriangle size={18} />} color="danger" />
      </div>

      <Tabs
        tabs={[
          { id: 'ORDERS', label: 'Orders', badge: stats?.total_orders },
          { id: 'PIPELINE', label: 'Pipeline' },
          { id: 'ANALYTICS', label: 'Analytics' },
          { id: 'AI', label: 'AI Command Center' },
          { id: 'RETURNS', label: 'Returns' },
        ]}
        activeTab={activeTab}
        onChange={(t) => setActiveTab(t as any)}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ============ ORDERS TAB ============ */}
      {activeTab === 'ORDERS' && (
        <>
          <FilterBar
            searchPlaceholder="Search by order # or distributor..."
            searchValue={filters.search}
            onSearchChange={(v) => setFilters((f) => ({ ...f, search: v }))}
            filters={[
              {
                label: 'Status', value: filters.status, type: 'select',
                onChange: (v) => setFilters((f) => ({ ...f, status: v })),
                options: dropdown?.statuses || [{ value: 'ALL', label: 'All Statuses' }],
              },
              {
                label: 'Priority', value: filters.priority, type: 'select',
                onChange: (v) => setFilters((f) => ({ ...f, priority: v })),
                options: [{ value: 'ALL', label: 'All Priorities' }, ...(dropdown?.priorities || [])],
              },
            ]}
          />
          <DataTable columns={columns as any} data={orders} loading={loading} emptyMessage="No orders found" />
        </>
      )}

      {/* ============ PIPELINE TAB (Kanban) ============ */}
      {activeTab === 'PIPELINE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {PIPELINE_COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => o.status === col);
            return (
              <div key={col} className="bg-slate-100/70 rounded-xl border border-slate-200 p-2.5 min-h-[200px]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{col}</span>
                  <span className="text-[10px] font-bold bg-white text-slate-500 rounded-full px-1.5 py-0.5 border border-slate-200">{colOrders.length}</span>
                </div>
                <div className="space-y-2">
                  {colOrders.map((o) => {
                    const na = nextAction(o.status);
                    const dayAge = daysSince(o.date);
                    const slaWarn = hasSlaWarning(o);
                    // Progress: shipped / approved quantities
                    const items = o.items ?? [];
                    const totalApproved = items.reduce((s, i) => s + (i.approvedQuantity ?? i.quantity), 0);
                    const totalShipped = items.reduce((s, i) => s + (i.approvedQuantity && o.status === 'Shipped' ? i.approvedQuantity : 0), 0);
                    const progressPct = totalApproved > 0 ? Math.round((totalShipped / totalApproved) * 100) : 0;
                    const showProgress = ['Processing', 'Shipped'].includes(o.status);

                    return (
                      <div key={o.id} className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm hover:shadow transition-shadow">
                        <div className="flex items-center justify-between">
                          <button onClick={() => openDetail(o.id)} className="font-mono text-[11px] font-bold text-slate-600 hover:text-[#22c55e]">{o.orderNumber}</button>
                          <div className="flex items-center gap-1">
                            {slaWarn && (
                              <span title="SLA Warning" className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 flex items-center gap-0.5">
                                <AlertTriangle size={7} /> {dayAge}d
                              </span>
                            )}
                            {o.aiRiskLevel && <Badge text={o.aiRiskLevel} variant={riskVariant(o.aiRiskLevel)} />}
                          </div>
                        </div>
                        <p className="text-[13px] font-semibold text-slate-800 truncate mt-1">{o.distributorName}</p>
                        <p className="text-[12px] text-slate-500">{inr(o.totalAmount)}</p>

                        {/* Progress bar */}
                        {showProgress && totalApproved > 0 && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                              <span>Shipped</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#22c55e] rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {na && (
                          <button
                            onClick={() => advance(o, na.to)}
                            disabled={actionBusy}
                            className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 transition-colors"
                          >
                            {na.icon}{na.label} <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {colOrders.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ ANALYTICS TAB ============ */}
      {activeTab === 'ANALYTICS' && <OMSAnalytics />}

      {/* ============ AI COMMAND CENTER ============ */}
      {activeTab === 'AI' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="text-indigo-500" size={20} />
              <h3 className="text-lg font-bold text-slate-800">AI Order Operations</h3>
            </div>
            <button onClick={loadInsights} disabled={insightsLoading} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50">
              <RefreshCcw size={14} className={insightsLoading ? 'animate-spin' : ''} /> Regenerate
            </button>
          </div>

          {insightsLoading && !insights ? (
            <div className="py-20 text-center"><RefreshCcw className="animate-spin mx-auto text-slate-400" /></div>
          ) : insights ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Sparkles size={16} className="text-indigo-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">Market Insight</span></div>
                  <p className="text-sm text-slate-700">{insights.marketInsight}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3"><Zap size={16} className="text-amber-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Priority Orders</span></div>
                  <div className="space-y-2">
                    {insights.priorityOrders.length === 0 && <p className="text-sm text-slate-400">No priority orders.</p>}
                    {insights.priorityOrders.map((p, i) => (
                      <button key={i} onClick={() => p.id && openDetail(p.id)} className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                        <span className="font-mono text-[11px] font-bold text-[#22c55e] mt-0.5">{p.orderNumber || '—'}</span>
                        <span className="text-[13px] text-slate-600 flex-1">{p.reason}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3"><ClipboardCheck size={16} className="text-[#22c55e]" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Recommended Actions</span></div>
                  <ul className="space-y-2">
                    {insights.recommendedActions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700"><CheckCircle size={14} className="text-[#22c55e] mt-0.5 shrink-0" />{a}</li>
                    ))}
                  </ul>
                </div>
                {insights.reorderSuggestions.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3"><Boxes size={16} className="text-blue-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reorder Suggestions</span></div>
                    <div className="space-y-2">
                      {insights.reorderSuggestions.map((r, i) => (
                        <div key={i} className="text-[13px]"><span className="font-semibold text-slate-800">{r.product}</span><span className="text-slate-500"> — {r.reason}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-10 text-center">No insights yet.</p>
          )}

          {/* Demand Forecast Panel */}
          <div className="border border-indigo-100 rounded-xl p-4 bg-gradient-to-br from-indigo-50/50 to-white mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-500" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Demand Forecast</span>
              </div>
              <button
                onClick={loadPredictions}
                disabled={predictionsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-indigo-100 text-indigo-600 hover:bg-indigo-200 disabled:opacity-50 transition-colors"
              >
                {predictionsLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {predictionsLoading ? 'Forecasting…' : 'Run Forecast'}
              </button>
            </div>

            {predictionsLoading && !demandPredictions && (
              <div className="py-8 text-center"><RefreshCcw className="animate-spin mx-auto text-slate-400 mb-2" /><p className="text-[12px] text-slate-400">Analysing order patterns…</p></div>
            )}

            {demandPredictions && (
              <>
                {demandPredictions.insight && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
                    <p className="text-[13px] text-indigo-700 font-medium">{demandPredictions.insight}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {demandPredictions.predictions.map((pred, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-[13px] font-bold text-slate-800 truncate">{pred.distributorName}</p>
                          <p className="text-[11px] text-slate-500">Last order: {new Date(pred.lastOrderDate).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[10px] font-bold border rounded-md px-1.5 py-0.5 ${confidenceColor(pred.confidence)}`}>
                          {pred.confidence}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-slate-400">Predicted Value</p>
                          <p className="text-[14px] font-bold text-indigo-600">{inr(pred.predictedValue)}</p>
                        </div>
                        {pred.daysOverdue > 0 && (
                          <div className="text-right">
                            <p className="text-[11px] text-slate-400">Overdue by</p>
                            <p className="text-[14px] font-bold text-red-600">{pred.daysOverdue}d</p>
                          </div>
                        )}
                      </div>
                      {pred.products.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Expected Products</p>
                          {pred.products.slice(0, 2).map((p, j) => (
                            <p key={j} className="text-[11px] text-slate-600 truncate">
                              {p.productName} <span className="text-slate-400">avg {p.avgQty} units</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {!predictionsLoading && !demandPredictions && (
              <p className="text-[12px] text-slate-400 text-center py-4">Run forecast to see demand predictions for upcoming orders.</p>
            )}
          </div>

          {/* Auto-Reorder Alerts Panel */}
          <div className="border border-amber-100 rounded-xl p-4 bg-gradient-to-br from-amber-50/50 to-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Boxes size={16} className="text-amber-500" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Auto-Reorder Alerts</span>
              </div>
              <button
                onClick={loadReorderSuggestions}
                disabled={reorderLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors"
              >
                {reorderLoading ? <RefreshCcw size={12} className="animate-spin" /> : <Zap size={12} />}
                {reorderLoading ? 'Analysing…' : 'Analyse Stock'}
              </button>
            </div>

            {reorderLoading && !reorderSuggestions && (
              <div className="py-8 text-center"><RefreshCcw className="animate-spin mx-auto text-slate-400 mb-2" /><p className="text-[12px] text-slate-400">Scanning stock levels…</p></div>
            )}

            {reorderSuggestions && (
              <>
                {reorderSuggestions.summary && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3">
                    <p className="text-[13px] text-amber-700 font-medium">{reorderSuggestions.summary}</p>
                  </div>
                )}
                <div className="space-y-2">
                  {reorderSuggestions.suggestions
                    .sort((a, b) => {
                      const order = { Critical: 0, High: 1, Normal: 2 };
                      return order[a.urgency] - order[b.urgency];
                    })
                    .map((sug, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3 shadow-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-slate-800 truncate">{sug.productName}</span>
                            <span className={`text-[10px] font-bold border rounded-md px-1.5 py-0.5 ${urgencyColor(sug.urgency)}`}>
                              {sug.urgency}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                            <div>
                              <p className="text-[10px] text-slate-400">Available</p>
                              <p className="text-[13px] font-semibold text-slate-700">{sug.availableQty}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">Open Demand</p>
                              <p className="text-[13px] font-semibold text-slate-700">{sug.totalOpenDemand}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">Shortfall</p>
                              <p className={`text-[13px] font-semibold ${sug.shortfall > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{sug.shortfall}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400">Suggested PO</p>
                              <p className="text-[13px] font-bold text-indigo-600">{sug.suggestedPurchaseQty}</p>
                            </div>
                          </div>
                        </div>
                        {sug.urgency === 'Critical' && (
                          <div className="shrink-0 w-2 h-full rounded-full bg-red-500 self-stretch" />
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}

            {!reorderLoading && !reorderSuggestions && (
              <p className="text-[12px] text-slate-400 text-center py-4">Analyse stock to see which products need reordering.</p>
            )}
          </div>
        </div>
      )}

      {/* ============ RETURNS TAB ============ */}
      {activeTab === 'RETURNS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw size={18} className="text-indigo-500" />
              <h3 className="text-[15px] font-bold text-slate-800">Sales Returns</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={returnsFilter}
                onChange={(e) => setReturnsFilter(e.target.value)}
                className="h-9 pl-3 pr-8 border border-slate-200 rounded-lg text-[13px] text-slate-700 bg-white outline-none focus:ring-2 focus:ring-[#22c55e]/30"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Restocked">Restocked</option>
                <option value="Credit Issued">Credit Issued</option>
              </select>
              <button
                onClick={loadReturns}
                disabled={returnsLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCcw size={14} className={returnsLoading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          <DataTable
            columns={returnsColumns as any}
            data={returns}
            loading={returnsLoading}
            emptyMessage="No returns found"
          />
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {detailId && (
        <Modal isOpen title="Order Details" size="xl" onClose={() => { setDetailId(null); setDetail(null); }}>
          {detailLoading || !detail ? (
            <div className="py-20 text-center"><RefreshCcw className="animate-spin mx-auto text-slate-400" /></div>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-800">{detail.order_number}</h3>
                    <Badge text={detail.status} variant={statusVariant(detail.status)} />
                  </div>
                  <p className="text-slate-500 text-sm mt-1">
                    {detail.distributor_name} · {new Date(detail.order_date).toLocaleDateString()}
                    {detail.expected_delivery_date ? ` · ETA ${new Date(detail.expected_delivery_date).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {nextAction(detail.status) && (
                    <button onClick={() => advance(detail, nextAction(detail.status)!.to)} disabled={actionBusy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:opacity-50">
                      {nextAction(detail.status)!.icon}{nextAction(detail.status)!.label}
                    </button>
                  )}
                  {isNonTerminal(detail.status) && (
                    <button onClick={() => cancelOrder(detail.id)} disabled={actionBusy}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                  {/* Initiate Return button for Invoiced orders with no pending return */}
                  {detail.status === 'Invoiced' && orderReturns.filter((r) => r.status === 'Pending').length === 0 && (
                    <button
                      onClick={() => setShowReturnModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      <RotateCcw size={14} /> Initiate Return
                    </button>
                  )}
                  {/* Partial Dispatch button for Approved/Processing orders */}
                  {['Approved', 'Processing', 'Partially Shipped'].includes(detail.status) && (
                    <button
                      onClick={() => initDispatch(detail)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <Truck size={14} /> Dispatch Items
                    </button>
                  )}
                </div>
              </div>

              {/* AI Risk banner */}
              <div className="bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-indigo-500" size={22} />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-400">AI Order Risk</p>
                    {detail.ai_risk_level ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge text={`${detail.ai_risk_level} · ${detail.ai_risk_score}`} variant={riskVariant(detail.ai_risk_level)} />
                        <span className="text-[13px] font-semibold text-slate-700">{detail.ai_recommendation}</span>
                      </div>
                    ) : <p className="text-sm text-slate-400">Not analysed yet</p>}
                    {detail.ai_insight && <p className="text-[12px] text-slate-500 mt-1 max-w-xl">{detail.ai_insight}</p>}
                  </div>
                </div>
                <button onClick={() => runRisk(detail.id)} disabled={aiBusy.risk}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 shrink-0">
                  <Brain size={14} className={aiBusy.risk ? 'animate-pulse' : ''} /> {detail.ai_risk_level ? 'Re-run' : 'Analyse'}
                </button>
              </div>

              {/* Items table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Ordered</th>
                      <th className="p-3 text-center">Approved</th>
                      <th className="p-3 text-center">Shipped</th>
                      <th className="p-3 text-center">Avail.</th>
                      <th className="p-3 text-right">Rate</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium text-slate-800">{it.product_name}</td>
                        <td className="p-3 text-center">{it.quantity}</td>
                        <td className="p-3 text-center">{it.approved_quantity ?? '—'}</td>
                        <td className="p-3 text-center">{it.shipped_quantity || 0}</td>
                        <td className={`p-3 text-center font-semibold ${Number(it.available) < Number(it.approved_quantity ?? it.quantity) ? 'text-red-500' : 'text-slate-500'}`}>{it.available ?? '—'}</td>
                        <td className="p-3 text-right">{inr(it.rate)}</td>
                        <td className="p-3 text-right font-semibold">{inr(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={6} className="p-3 text-right uppercase text-[10px] tracking-wider text-slate-500">Total</td>
                      <td className="p-3 text-right text-lg text-slate-900">{inr(detail.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Partial Dispatch Panel */}
              {showDispatchPanel && (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck size={15} className="text-blue-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-blue-600">Partial Dispatch</span>
                    <button
                      onClick={() => setShowDispatchPanel(false)}
                      className="ml-auto text-slate-400 hover:text-slate-600 text-[12px]"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                  <div className="overflow-hidden border border-blue-100 rounded-xl bg-white mb-3">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-blue-50 text-blue-500 uppercase text-[10px] font-bold border-b border-blue-100">
                        <tr>
                          <th className="p-3">Product</th>
                          <th className="p-3 text-center">Ordered</th>
                          <th className="p-3 text-center">Approved</th>
                          <th className="p-3 text-center">Shipped</th>
                          <th className="p-3 text-center">Remaining</th>
                          <th className="p-3 text-center w-28">Dispatch Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-50">
                        {detail.items.map((it, idx) => {
                          const dispItem = dispatchItems[idx];
                          if (!dispItem) return null;
                          const remaining = Math.max(
                            0,
                            (it.approved_quantity ?? it.quantity) - (it.shipped_quantity ?? 0)
                          );
                          return (
                            <tr key={it.id}>
                              <td className="p-3 font-medium text-slate-800 text-[13px]">{it.product_name}</td>
                              <td className="p-3 text-center text-[13px]">{it.quantity}</td>
                              <td className="p-3 text-center text-[13px]">{it.approved_quantity ?? '—'}</td>
                              <td className="p-3 text-center text-[13px]">{it.shipped_quantity ?? 0}</td>
                              <td className="p-3 text-center font-semibold text-[13px]">
                                <span className={remaining === 0 ? 'text-slate-400' : 'text-blue-600'}>{remaining}</span>
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={remaining}
                                  value={dispItem.quantity}
                                  disabled={remaining === 0}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0));
                                    setDispatchItems((prev) =>
                                      prev.map((d, i) => (i === idx ? { ...d, quantity: val } : d))
                                    );
                                  }}
                                  className="w-20 p-1.5 border border-blue-200 rounded-lg text-[13px] text-center outline-none focus:ring-2 focus:ring-blue-400/30 disabled:opacity-40 disabled:bg-slate-50"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Carrier</label>
                      <input
                        type="text"
                        value={dispatchCarrier}
                        onChange={(e) => setDispatchCarrier(e.target.value)}
                        placeholder="e.g. FedEx, BlueDart..."
                        className="w-full p-2 border border-slate-200 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-blue-400/30"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Tracking Number</label>
                      <input
                        type="text"
                        value={dispatchTracking}
                        onChange={(e) => setDispatchTracking(e.target.value)}
                        placeholder="AWB / Tracking ID..."
                        className="w-full p-2 border border-slate-200 rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-blue-400/30"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleDispatch}
                    disabled={dispatchBusy}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {dispatchBusy ? <RefreshCcw size={14} className="animate-spin" /> : <Truck size={14} />}
                    Dispatch Items
                  </button>
                </div>
              )}

              {/* AI tools row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Fulfillment */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Truck size={15} className="text-blue-500" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fulfillment Feasibility</span></div>
                    <button onClick={() => runFulfillment(detail.id)} disabled={aiBusy.fulfil} className="text-[12px] font-semibold text-blue-600 hover:underline disabled:opacity-50">{aiBusy.fulfil ? 'Analysing…' : 'Forecast'}</button>
                  </div>
                  {aiFulfillment ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge text={aiFulfillment.feasible ? 'Feasible' : 'At Risk'} variant={aiFulfillment.feasible ? 'success' : 'danger'} />
                        <span className="text-[13px] font-semibold text-slate-700">{aiFulfillment.fillRate}% fillable</span>
                        <span className="text-[12px] text-slate-400">· ETA {aiFulfillment.eta}</span>
                      </div>
                      <p className="text-[12px] text-slate-500">{aiFulfillment.note}</p>
                      {aiFulfillment.shortages.length > 0 && (
                        <div className="text-[12px] text-red-600">
                          {aiFulfillment.shortages.map((s, i) => <div key={i}>⚠ {s.productName}: need {s.required}, have {s.available}</div>)}
                        </div>
                      )}
                    </div>
                  ) : <p className="text-[12px] text-slate-400">Run a forecast to check stock readiness.</p>}
                </div>

                {/* Confirmation draft */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Send size={15} className="text-[#22c55e]" /><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">AI Confirmation Email</span></div>
                    <div className="flex items-center gap-2">
                      {aiDraft && <button onClick={() => { navigator.clipboard?.writeText(aiDraft); addNotification({ type: 'success', message: 'Copied to clipboard' }); }} className="text-slate-400 hover:text-slate-600"><Copy size={14} /></button>}
                      <button onClick={() => draftConfirmation(detail.id)} disabled={aiBusy.draft} className="text-[12px] font-semibold text-[#22c55e] hover:underline disabled:opacity-50">{aiBusy.draft ? 'Drafting…' : 'Draft'}</button>
                    </div>
                  </div>
                  {aiDraft ? (
                    <textarea readOnly value={aiDraft} className="w-full h-32 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 resize-none" />
                  ) : <p className="text-[12px] text-slate-400">Generate a professional confirmation for the distributor.</p>}
                </div>
              </div>

              {/* Status timeline */}
              <div className="border border-slate-200 rounded-xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Status Timeline</span>
                <div className="mt-3 space-y-3">
                  {detail.statusHistory.length === 0 && <p className="text-[12px] text-slate-400">No history.</p>}
                  {detail.statusHistory.map((h) => (
                    <div key={h.id} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[13px] text-slate-700">
                          <span className="font-semibold">{h.to_status}</span>
                          {h.from_status ? <span className="text-slate-400"> (from {h.from_status})</span> : ''}
                          {h.note ? <span className="text-slate-500"> — {h.note}</span> : ''}
                        </p>
                        <p className="text-[11px] text-slate-400">{new Date(h.changed_at).toLocaleString()}{h.changed_by_name ? ` · ${h.changed_by_name}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipment + specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Packing / Labeling</p>
                  <p className="text-sm text-slate-700">{detail.packing_specs || 'Standard packing'}</p>
                  <p className="text-sm text-slate-700">{detail.labeling_specs || 'Standard labeling'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Shipment</p>
                  {detail.shipments.length === 0 ? <p className="text-sm text-slate-400">Not yet dispatched</p> :
                    detail.shipments.map((s) => (
                      <p key={s.id} className="text-sm text-slate-700">{s.carrier} · {s.tracking_number || 'No tracking'} · <span className="font-semibold">{s.status}</span></p>
                    ))}
                  {detail.sales_invoice_id && <p className="text-[12px] text-[#22c55e] font-semibold mt-1">✓ Invoiced</p>}
                </div>
              </div>

              {/* Returns history (if any) */}
              {orderReturns.length > 0 && (
                <div className="border border-indigo-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                    <RotateCcw size={14} className="text-indigo-500" />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Return History</span>
                    <span className="text-[10px] text-indigo-400 font-semibold">({orderReturns.length})</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-100">
                      <tr>
                        <th className="p-3">Return #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Items</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderReturns.map((ret) => (
                        <tr key={ret.id}>
                          <td className="p-3 font-mono text-[12px] font-bold text-indigo-600">{ret.return_number || ret.id.slice(0, 8)}</td>
                          <td className="p-3 text-[12px] text-slate-600">{new Date(ret.return_date).toLocaleDateString()}</td>
                          <td className="p-3 text-[12px] text-slate-600">{ret.items?.length ?? 0}</td>
                          <td className="p-3 text-center"><Badge text={ret.status} variant={returnStatusVariant(ret.status)} /></td>
                          <td className="p-3 text-[12px] text-slate-500 max-w-[200px] truncate">{ret.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ============ ORDER RETURN MODAL ============ */}
      {showReturnModal && detail && (
        <OrderReturnModal
          order={detail}
          onClose={() => setShowReturnModal(false)}
          onSuccess={async () => {
            if (detailId) {
              omsService.getOrderReturns(detailId).then(setOrderReturns).catch(() => {});
            }
            if (activeTab === 'RETURNS') await loadReturns();
          }}
        />
      )}

      {/* ============ CREATE ORDER MODAL ============ */}
      {showCreate && (
        <Modal isOpen title="Create B2B Order" size="xl" onClose={() => setShowCreate(false)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Distributor</label>
                  <select value={distributorId} onChange={(e) => setDistributorId(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/40">
                    <option value="">Choose partner…</option>
                    {dropdown?.distributors.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  {selectedDistributor && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Credit limit {inr(selectedDistributor.credit_limit)} · Balance {inr(selectedDistributor.current_balance)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/40">
                    {(dropdown?.priorities || [{ value: 'Normal', label: 'Normal' }]).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                {dropdown?.godowns && dropdown.godowns.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Godown</label>
                    <select value={godownId} onChange={(e) => setGodownId(e.target.value)}
                      className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/40">
                      <option value="">Default</option>
                      {dropdown.godowns.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Expected Delivery</label>
                  <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)}
                    className="w-full mt-1 p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/40" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Product Catalog</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto mt-1 p-0.5">
                  {(products || []).map((p: any) => (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="p-2.5 border border-slate-100 rounded-lg hover:border-[#22c55e] text-left transition-colors flex justify-between items-center group">
                      <div className="min-w-0">
                        <p className="font-semibold text-[13px] text-slate-800 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500">{inr(p.selling_rate || p.ptr_rate || (p.mrp ? p.mrp * 0.7 : 0))}{p.gst ? ` · GST ${p.gst}%` : ''}</p>
                      </div>
                      <Plus size={15} className="text-slate-300 group-hover:text-[#22c55e] shrink-0" />
                    </button>
                  ))}
                  {(!products || products.length === 0) && <p className="text-[12px] text-slate-400 col-span-2 py-6 text-center">No products available.</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input value={packingSpecs} onChange={(e) => setPackingSpecs(e.target.value)} placeholder="Packing instructions"
                  className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/40" />
                <input value={labelingSpecs} onChange={(e) => setLabelingSpecs(e.target.value)} placeholder="Labeling specs"
                  className="p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#22c55e]/40" />
              </div>
            </div>

            {/* Cart */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col">
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ShoppingCart size={16} /> Cart ({cart.length})</h4>
              <div className="flex-1 space-y-2 overflow-y-auto mb-3 max-h-[300px]">
                {cart.length === 0 && <p className="text-[12px] text-slate-400 text-center py-6">Add products from the catalog</p>}
                {cart.map((it) => (
                  <div key={it.productId} className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[12px] font-semibold truncate flex-1">{it.productName}</span>
                      <button onClick={() => removeItem(it.productId)} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="number" min={1} value={it.quantity} onChange={(e) => setQty(it.productId, parseInt(e.target.value) || 1)}
                        className="w-14 p-1 border border-slate-200 rounded text-[12px] text-center" />
                      <span className="text-slate-400 text-[12px]">×</span>
                      <input type="number" min={0} value={it.rate} onChange={(e) => setRate(it.productId, parseFloat(e.target.value) || 0)}
                        className="w-20 p-1 border border-slate-200 rounded text-[12px] text-right" />
                      <span className="text-[12px] font-semibold ml-auto">{inr(it.quantity * it.rate)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{inr(cartTotal)}</span></div>
                <button onClick={placeOrder} disabled={placing || !distributorId || cart.length === 0}
                  className="w-full py-2.5 bg-[#22c55e] text-white rounded-lg font-bold hover:bg-[#16a34a] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {placing ? <RefreshCcw size={16} className="animate-spin" /> : <Send size={16} />} Place Order
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ERPLayout>
  );
};

export default OMS;
