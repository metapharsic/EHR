/**
 * INVENTORY HUB: THE ENTERPRISE INTELLIGENCE COMMAND CENTER
 * Consolidating Item Master, Stock Levels, and AI Analytics into a Single Unified Interface.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Archive, TrendingUp, AlertTriangle, Clock, Activity, 
  ArrowUpRight, BarChart3, Target, Wallet, BrainCircuit,
  Zap, Search, Filter, Plus, RefreshCw, Edit3, Trash2,
  ChevronDown, ChevronRight, CheckCircle2, ShoppingCart,
  Layers, Package, ShieldAlert, Download, Printer, Info,
  Eye, EyeOff, LayoutGrid, List as ListIcon, Maximize2, 
  Save, Calculator, Globe, PlusCircle, ExternalLink, ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { 
  ERPLayout, StatCard, Tabs, Badge, Modal, DataTable, FilterBar 
} from './UniversalLayout';
import { 
  useDataFetch, useDatabaseStatus, useSearch, usePagination 
} from '../hooks/useDataFetch';
import { useNotificationSystem } from '../hooks/useNotifications';
import { useAppStore } from '../store/useAppStore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend
} from 'recharts';
import { apiClient } from '../services/apiClient';

interface InventoryHubProps {
  isPosMode?: boolean;
  onBackToPos?: () => void;
  initialTab?: string;
}

const STOCK_GROUPS = ['Primary', 'Medicines', 'Surgicals', 'Medical Devices', 'FMCG', 'Raw Materials', 'Finished Goods', 'Packaging'];
const STOCK_CATEGORIES = ['General', 'General - Fast Moving', 'Life Saving', 'Schedule H', 'Schedule H1', 'Narcotics', 'Cold Chain', 'Costly Items'];
const UOM_LIST = ['Nos', 'Strip', 'Box', 'Kg', 'Litre', 'Sheet', 'Dozen', 'Carton'];
const GST_RATES = [0, 5, 12, 18, 28];

const InventoryHub: React.FC<InventoryHubProps> = ({ 
  isPosMode = false, 
  onBackToPos,
  initialTab = 'CATALOG'
}) => {
  const { status: dbStatus } = useDatabaseStatus();
  const notify = useNotificationSystem();
  const { posBillState, setPosBillState, setPosState, setActiveTab: setGlobalActiveTab } = useAppStore();

  // --- 1. DATA FETCHING ---
  const { 
    data: inventoryResponse, 
    loading: inventoryLoading, 
    refetch: refetchInventory 
  } = useDataFetch<any>('/api/inventory');
  
  const { 
    data: analyticsData, 
    loading: analyticsLoading, 
    refetch: refetchAnalytics 
  } = useDataFetch<any>('/api/analytics/inventory/comprehensive');

  // --- 2. VIEW STATES ---
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewMode, setViewMode] = useState<'DETAILED' | 'COMPACT'>('DETAILED');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [batchData, setBatchData] = useState<Record<string, any[]>>({});
  const [batchesLoading, setBatchesLoading] = useState<Record<string, boolean>>({});

  // SKU Modal States
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skuFormTab, setSkuFormTab] = useState('GENERAL');
  const [savingSku, setSavingSku] = useState(false);

  // Analytics sub-tabs
  const [analyticsActiveTab, setAnalyticsActiveTab] = useState('ABC');

  // Optimization modal
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState('ALL');

  // --- 3. SKU FORM LOGIC ---
  const defaultForm = {
    itemCode: '', itemName: '', genericName: '', manufacturer: '', stockGroup: 'Medicines', stockCategory: 'General',
    baseUom: 'Strip', altUom: 'Box', conversionFactor: 10,
    maintainBatches: true, trackExpiry: true,
    hsnCode: '', taxRate: 12, taxType: 'Taxable',
    openingStock: 0, openingValue: 0,
    reorderLevel: 0, minStockLevel: 0,
    isActive: true,
    scheme: '',
    mrp: 0, purchaseRate: 0, ptr: 0, pts: 0, sellingRate: 0, landingCost: 0, marginPercent: 0,
    // FIX: branchDistribution was hardcoded with mock branches (Delhi HQ, Mumbai, Lucknow).
    // Removed — godowns are managed separately in the Godown Master module.
    branchDistribution: [] as any[]
  };
  const [skuForm, setSkuForm] = useState(defaultForm);
  const toFormNumber = (value: string) => value === '' ? 0 : Number(value);

  // Computed landing cost & margin
  useEffect(() => {
    const pRate = Number(skuForm.purchaseRate) || 0;
    const sRate = Number(skuForm.sellingRate) || 0;
    const tRate = Number(skuForm.taxRate) || 12;
    const tax = (pRate * tRate) / 100;
    const landing = Number((pRate + tax).toFixed(2));
    let margin = 0;
    if (landing > 0 && sRate > landing) {
      margin = Number((((sRate - landing) / landing) * 100).toFixed(1));
    }
    setSkuForm(prev => ({ ...prev, landingCost: landing, marginPercent: margin }));
  }, [skuForm.purchaseRate, skuForm.taxRate, skuForm.sellingRate]);

  // --- 4. DATA PROCESSING ---
  const inventoryItems = useMemo(() => {
    if (inventoryResponse?.data) return inventoryResponse.data;
    return Array.isArray(inventoryResponse) ? inventoryResponse : [];
  }, [inventoryResponse]);

  // FIX: /api/analytics/inventory/comprehensive returns { success, data: { ... } }.
  // Unwrap once so all downstream consumers reference analytics.metadata,
  // analytics.abcAnalysis etc. directly — no more undefined chain reads.
  const analytics = useMemo(() => {
    if (!analyticsData) return null;
    // If already unwrapped (no .data wrapper), use directly
    return analyticsData?.data ?? analyticsData;
  }, [analyticsData]);

  // FIX: Compute Stock Velocity from real analytics metadata instead of hardcoded 12.4.
  // Velocity = total units sold in last 90 days / 3 months = avg monthly transactions.
  const stockVelocity = useMemo(() => {
    if (!analytics?.metadata) return 0;
    const { totalProducts } = analytics.metadata;
    // Sum units sold across all FSN items → monthly rate
    const totalUnitsSold =
      ((analytics.fsnAnalysis?.fast ?? []).concat(
        analytics.fsnAnalysis?.slow ?? [],
        analytics.fsnAnalysis?.nonMoving ?? []
      ) as any[]).reduce((sum: number, item: any) => sum + (item.unitsSold || 0), 0);
    // Convert 90-day total to monthly average
    return totalProducts > 0
      ? parseFloat((totalUnitsSold / 3).toFixed(1))
      : 0;
  }, [analytics]);

  // FIX: Compute Service Level from real data instead of hardcoded 94.2%.
  // Service Level = percentage of products that have stock above their reorder level
  // (i.e., are NOT in a stockout / critical state).
  const serviceLevel = useMemo(() => {
    if (!inventoryItems.length) return 0;
    const aboveReorder = inventoryItems.filter((item: any) =>
      (item.currentStock || 0) > (item.reorderLevel || 10)
    ).length;
    return parseFloat(((aboveReorder / inventoryItems.length) * 100).toFixed(1));
  }, [inventoryItems]);

  const { query, setQuery, results: searchResults } = useSearch(
    inventoryItems,
    ['name', 'genericName', 'code']
  );

  const filteredData = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter((item: any) => {
      if (activeTab === 'LOW_STOCK' || quickFilter === 'LOW_STOCK') return item.currentStock <= (item.reorderLevel || 10);
      if (activeTab === 'EXPIRY' || quickFilter === 'EXPIRING') return item.expiryStatus === 'EXPIRING_SOON' || item.expiryStatus === 'EXPIRED';
      if (quickFilter === 'EXPIRED') return item.expiryStatus === 'EXPIRED';
      return true;
    });
  }, [searchResults, activeTab, quickFilter]);

  const pagination = usePagination(filteredData, 20);

  // --- 5. HANDLERS ---
  const handleToggleRow = async (row: any) => {
    const isExpanded = !!expandedRows[row.id];
    setExpandedRows(prev => ({ ...prev, [row.id]: !isExpanded }));

    if (!isExpanded && !batchData[row.id]) {
      setBatchesLoading(prev => ({ ...prev, [row.id]: true }));
      try {
        const res = await apiClient.get(`/api/inventory/${row.id}/batches`);
        setBatchData(prev => ({ ...prev, [row.id]: res.data?.data || res.data || [] }));
      } catch (err) {
        notify.error(`Failed to load batches for ${row.name}`);
        // FIX: revert expanded state so the row doesn't hang open with empty content
        setExpandedRows(prev => ({ ...prev, [row.id]: false }));
      } finally {
        setBatchesLoading(prev => ({ ...prev, [row.id]: false }));
      }
    }
  };

  const handleSelectBatch = (product: any, batch: any) => {
    const newItem = {
      productId: product.id,
      name: product.name,
      batchNo: batch.batchNo ?? batch.batchNumber,
      expiryDate: batch.expiryDate,
      mrp: batch.mrp,
      // FIX: use nullish coalescing (??) instead of || so that a valid 0 rate
      // doesn't fall through to the next fallback (e.g., ptr=0 is a valid price)
      rate: batch.ptr ?? batch.sellingRate ?? product?.sellingRate ?? batch.rate ?? 0,
      quantity: 1,
      taxRate: product?.taxRate ?? 0,
      amount: batch.ptr ?? batch.sellingRate ?? product?.sellingRate ?? batch.rate ?? 0,
      batchId: batch.id
    };

    const currentItems = posBillState.items.filter(i => i.name !== '' || i.amount !== 0);
    setPosBillState({ items: [...currentItems, newItem] });
    
    notify.success(`${product.name} (Batch: ${newItem.batchNo}) added to bill`);
    
    if (isPosMode && onBackToPos) {
      onBackToPos();
    }
  };

  const handleSaveSku = async () => {
    if (!skuForm.itemCode?.trim() || !skuForm.itemName?.trim() || !skuForm.genericName?.trim() || !skuForm.manufacturer?.trim()) {
      notify.error("Item Code, Product Name, Generic Name, and Manufacturer are required");
      return;
    }
    // FIX: reject negative/invalid numeric pricing fields
    if (Number(skuForm.mrp) < 0 || Number(skuForm.purchaseRate) < 0 || Number(skuForm.sellingRate) < 0 || Number(skuForm.ptr) < 0 || Number(skuForm.pts) < 0) {
      notify.error("Prices cannot be negative. Please enter valid values.");
      return;
    }
    if (Number(skuForm.taxRate) < 0 || Number(skuForm.taxRate) > 100) {
      notify.error("Tax rate must be between 0 and 100.");
      return;
    }
    setSavingSku(true);
    try {
      const payload = {
        name: skuForm.itemName,
        genericName: skuForm.genericName,
        code: skuForm.itemCode,
        manufacturer: skuForm.manufacturer,
        category: skuForm.stockGroup,
        reorderLevel: Number(skuForm.reorderLevel) || 0,
        mrp: Number(skuForm.mrp) || 0,
        purchaseRate: Number(skuForm.purchaseRate) || 0,
        sellingRate: Number(skuForm.sellingRate) || 0,
        ptr: Number(skuForm.ptr) || 0,
        pts: Number(skuForm.pts) || 0,
        hsnCode: skuForm.hsnCode,
        taxRate: Number(skuForm.taxRate) || 0,
        uom: skuForm.baseUom,
        maintainBatches: skuForm.maintainBatches,
        trackExpiry: skuForm.trackExpiry,
        isActive: skuForm.isActive,
        scheme: skuForm.scheme
      };

      if (editingId) {
        await apiClient.put(`/api/inventory/${editingId}`, payload);
        notify.success('SKU Updated Successfully');
      } else {
        await apiClient.post('/api/inventory', payload);
        notify.success('SKU Created Successfully');
      }
      setShowSkuModal(false);
      refetchInventory();
    } catch (err: any) {
      notify.error(err?.data?.error || err?.message || 'Failed to save SKU');
    } finally {
      setSavingSku(false);
    }
  };

  const handleEditSku = (item: any) => {
    setEditingId(item.id);
    setSkuForm({
      ...defaultForm,
      itemCode: item.code || '',
      itemName: item.name || '',
      genericName: item.genericName || '',
      manufacturer: item.manufacturer || '',
      stockGroup: item.category || 'Medicines',
      reorderLevel: parseFloat(item.reorderLevel || 0),
      purchaseRate: parseFloat(item.purchaseRate || 0),
      sellingRate: parseFloat(item.sellingRate || 0),
      mrp: parseFloat(item.mrp || 0),
      ptr: parseFloat(item.ptr || 0),
      pts: parseFloat(item.pts || 0),
      hsnCode: item.hsnCode || '',
      taxRate: parseFloat(item.taxRate || 12),
      baseUom: item.uom || 'Nos',
      maintainBatches: item.maintainBatches !== undefined ? item.maintainBatches : true,
      trackExpiry: item.trackExpiry !== undefined ? item.trackExpiry : true,
      isActive: item.isActive !== undefined ? item.isActive : true,
      scheme: item.scheme || ''
    });
    setSkuFormTab('GENERAL');
    setShowSkuModal(true);
  };

  const handleDeleteSku = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiClient.delete(`/api/inventory/${id}`);
      notify.success('SKU deleted');
      // FIX: clear stale batch cache for the deleted product so it doesn't
      // reappear if a new product with the same ID is created later
      setBatchData(prev => { const next = { ...prev }; delete next[id]; return next; });
      setExpandedRows(prev => { const next = { ...prev }; delete next[id]; return next; });
      refetchInventory();
    } catch (err: any) {
      const detail = err?.message || err?.data?.error || 'Delete failed';
      notify.error(`Delete failed: ${detail}`);
    }
  };

  const handleOptimization = async () => {
    setOptimizing(true);
    try {
      // FIX: optimize endpoint returns { success, processingTime } directly (not wrapped in .data)
      const res = await apiClient.post('/api/analytics/inventory/optimize', {});
      const ok = (res as any)?.success ?? (res as any)?.data?.success ?? false;
      if (ok) {
        notify.success('AI Optimization Sync Complete — Reorder levels updated');
        refetchAnalytics();
        refetchInventory();
      } else {
        notify.error('Optimization returned no confirmation. Check server logs.');
      }
    } catch (err: any) {
      notify.error(`Optimization Engine Failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setOptimizing(false);
      setShowOptimizationModal(false);
    }
  };

  // --- 6. RENDER HELPERS ---
  const renderIntelligenceSummary = () => {
    // Use unwrapped analytics — not raw analyticsData which has a { success, data } wrapper
    const capitalLocked = analytics?.metadata?.totalValue != null
      ? (analytics.metadata.totalValue / 100000).toFixed(2)
      : '0.00';

    const deadStockVal = Array.isArray(analytics?.deadStock)
      ? (analytics.deadStock.reduce((s: number, i: any) => s + (Number(i.stockValue) || 0), 0) / 1000).toFixed(1)
      : '0.0';

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[12px] my-[20px]">
        <StatCard
          label="Capital Locked"
          value={`₹${capitalLocked}L`}
          color="blue"
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="Stock Velocity"
          value={`${stockVelocity} tx/mo`}
          color="success"
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Dead Stock Val"
          value={`₹${deadStockVal}K`}
          color="rose"
          icon={<Trash2 size={18} />}
        />
        <StatCard
          label="Service Level"
          value={`${serviceLevel}%`}
          color="amber"
          icon={<Target size={18} />}
        />
      </div>
    );
  };

  const renderExpandedBatches = (productId: string) => {
    const batches = batchData[productId] || [];
    const isLoading = batchesLoading[productId];

    if (isLoading) {
      return (
        <tr className="bg-slate-50/50">
          <td colSpan={10} className="px-10 py-4">
            <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              <RefreshCw size={14} className="animate-spin" /> Fetching Batch Intelligence...
            </div>
          </td>
        </tr>
      );
    }

    if (batches.length === 0) {
      return (
        <tr className="bg-slate-50/50">
          <td colSpan={10} className="px-10 py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            No active batches found for this SKU.
          </td>
        </tr>
      );
    }

    return (
      <tr className="bg-slate-50/50 border-b border-slate-100">
        <td colSpan={10} className="p-0">
          <div className="px-10 py-4">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-200">
                  <th className="pb-2">Batch ID</th>
                  <th className="pb-2">Expiry Date</th>
                  <th className="pb-2 text-right">MRP</th>
                  <th className="pb-2 text-right">Stock Qty</th>
                  <th className="pb-2 text-right">Rate</th>
                  <th className="pb-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch: any) => (
                  <tr key={batch.id} className="text-[11px]">
                    <td className="py-2.5 font-mono text-accent">{batch.batchNo || batch.batchNumber}</td>
                    <td className={`py-2.5 font-bold ${new Date(batch.expiryDate) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
                      {new Date(batch.expiryDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-700">₹{(batch.mrp || 0).toLocaleString()}</td>
                    <td className="py-2.5 text-right font-black text-primary">{batch.quantity || batch.stock}</td>
                    <td className="py-2.5 text-right font-bold text-slate-600">₹{(batch.ptr || batch.sellingRate || batch.rate || 0).toLocaleString()}</td>
                    <td className="py-2.5 text-center">
                      <button 
                        onClick={() => handleSelectBatch(inventoryItems.find((i:any) => i.id === productId), batch)}
                        className="bg-accent text-white px-3 py-1 rounded text-[9px] font-bold uppercase hover:bg-neutral-900 transition-all shadow-sm"
                      >
                        SELECT
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  };

  const renderStockCatalog = () => {
    const columns = viewMode === 'DETAILED' ? [
      { 
        key: 'identity', 
        label: 'Identity & Source', 
        width: '25%', 
        render: (_: any, row: any) => (
          <div className="flex items-start gap-[10px]">
            <button 
              onClick={(e) => { e.stopPropagation(); handleToggleRow(row); }}
              className="mt-[2px] p-0 text-[#cbd5e1] hover:text-[#64748b] transition-colors"
            >
              {expandedRows[row.id] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
            </button>
            <div className="min-w-0">
              <div className="font-[600] text-[#0f172a] truncate text-[13.5px]">{row.name}</div>
              <div className="text-[12px] text-[#64748b] mt-[2px] truncate">{row.genericName || 'No Generic'}</div>
              <div className="flex items-center gap-[6px] mt-[4px]">
                <span className="px-[7px] py-[2px] bg-[#f1f5f9] text-[#475569] text-[11px] font-[600] rounded-[4px]">{row.code}</span>
                <span className="px-[7px] py-[2px] bg-[#eff6ff] text-[#3b82f6] text-[11px] rounded-[4px] truncate">{row.manufacturer || 'N/A'}</span>
              </div>
            </div>
          </div>
        ) 
      },
      { 
        key: 'financials', 
        label: 'Financial Intelligence', 
        width: '18%', 
        align: 'right' as const,
        render: (_: any, row: any) => {
          const margin = row.purchaseRate > 0 ? (((row.mrp - row.purchaseRate) / row.purchaseRate) * 100).toFixed(1) : '0';
          const marginNum = Number(margin);
          return (
            <div className="flex flex-col items-end gap-[4px]">
              <div className="font-[600] text-[#0f172a] text-[13.5px]">₹{(row.mrp || 0).toLocaleString()}</div>
              <div className={`px-[8px] py-[2px] rounded-[4px] text-[11px] font-[600] ${marginNum > 0 ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#fef2f2] text-[#ef4444]'}`}>
                {margin}% MARGIN
              </div>
            </div>
          );
        }
      },
      { 
        key: 'stock_health', 
        label: 'Stock Health', 
        width: '18%', 
        align: 'center' as const,
        render: (_: any, row: any) => {
          const stock = row.currentStock || 0;
          const reorder = row.reorderLevel || 100;
          const status = stock <= reorder ? 'CRITICAL' : stock <= reorder * 1.5 ? 'LOW' : 'HEALTHY';
          return (
            <div className="w-full max-w-[120px] mx-auto space-y-[4px]">
              <div className="flex justify-between items-center">
                <span className="text-[12.5px] font-[500] text-[#0f172a]">{stock} {row.uom}</span>
                <span className="text-[11px] text-[#94a3b8]">TARGET: {reorder}</span>
              </div>
              <div className="h-[4px] w-full bg-[#f1f5f9] rounded-[2px] overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${status === 'CRITICAL' ? 'bg-[#ef4444]' : status === 'LOW' ? 'bg-[#f59e0b]' : 'bg-[#22c55e]'}`}
                  style={{ width: `${Math.min((stock / (reorder * 2)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          );
        }
      },
      { 
        key: 'compliance', 
        label: 'Statutory & Tax', 
        width: '12%', 
        align: 'center' as const,
        render: (_: any, row: any) => (
          <div className="flex flex-col items-center gap-[2px]">
            <span className="text-[12px] text-[#64748b]">{row.hsnCode || '---'}</span>
            <span className="text-[12.5px] font-[600] text-[#0f172a]">{row.taxRate || 0}% GST</span>
          </div>
        )
      },
      { 
        key: 'traceability', 
        label: 'Traceability', 
        width: '10%', 
        align: 'center' as const,
        render: (_: any, row: any) => (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-1">
              <Archive size={12} className={row.maintainBatches ? 'text-[#22c55e]' : 'text-slate-200'}/>
              <Clock size={12} className={row.trackExpiry ? 'text-[#f59e0b]' : 'text-slate-200'}/>
            </div>
            <span className="text-[11px] text-[#64748b]">{row.batchCount || 0} Batches</span>
          </div>
        ) 
      },
      { key: 'actions', label: 'Actions', width: '12%', align: 'center' as const, render: (_: any, row: any) => (
        <div className="flex gap-[4px] justify-center">
          <button onClick={(e) => { e.stopPropagation(); handleEditSku(row); }} className="w-[28px] h-[28px] flex items-center justify-center text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] bg-transparent rounded-[4px] transition-all">
            <Edit3 size={14}/>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteSku(row.id); }} className="w-[28px] h-[28px] flex items-center justify-center text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fef2f2] bg-transparent rounded-[4px] transition-all">
            <Trash2 size={14}/>
          </button>
          <button onClick={(e) => { e.stopPropagation(); window.location.hash = `#/analytics?sku=${row.id}`; }} className="w-[28px] h-[28px] flex items-center justify-center text-[#94a3b8] hover:text-[#22c55e] hover:bg-[#f0fdf4] bg-transparent rounded-[4px] transition-all">
            <BarChart3 size={14}/>
          </button>
        </div>
      ) }
    ] : [
      { key: 'name', label: 'Product Name', width: '30%', render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleToggleRow(row); }}>
            {expandedRows[row.id] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </button>
          <span className="font-bold text-xs uppercase">{row.name}</span>
        </div>
      )},
      { key: 'genericName', label: 'Generic', width: '20%', render: (v: any) => <span className="text-[10px] text-slate-500 font-medium italic">{v || 'N/A'}</span> },
      { key: 'manufacturer', label: 'Manufacturer', width: '15%', render: (v: any) => <span className="text-[10px] text-slate-400 font-bold uppercase">{v || 'N/A'}</span> },
      { key: 'currentStock', label: 'Stock', width: '10%', align: 'right' as const, render: (v: any, row: any) => <span className="font-bold text-xs">{v} {row.uom}</span> },
      { key: 'category', label: 'Category', width: '15%', render: (v: any) => <Badge text={v} variant="neutral" /> },
      { key: 'actions', label: 'Actions', width: '10%', align: 'center' as const, render: (_: any, row: any) => (
        <button onClick={(e) => { e.stopPropagation(); handleEditSku(row); }} className="text-accent hover:underline text-[10px] font-bold uppercase">Edit</button>
      )}
    ];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-[12px]">
          <div className="inline-flex bg-[#f1f5f9] rounded-[6px] p-[3px] gap-[2px]">
            <button 
              onClick={() => setViewMode('DETAILED')} 
              className={`flex items-center gap-[5px] px-[12px] py-[5px] rounded-[4px] text-[12px] font-[500] transition-all ${viewMode === 'DETAILED' ? 'bg-[#ffffff] text-[#0f172a] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#64748b]'}`}
            >
              <ListIcon size={13}/> Detailed View
            </button>
            <button 
              onClick={() => setViewMode('COMPACT')} 
              className={`flex items-center gap-[5px] px-[12px] py-[5px] rounded-[4px] text-[12px] font-[500] transition-all ${viewMode === 'COMPACT' ? 'bg-[#ffffff] text-[#0f172a] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#64748b]'}`}
            >
              <LayoutGrid size={13}/> Compact View
            </button>
          </div>
          <button 
            onClick={() => { setEditingId(null); setSkuForm(defaultForm); setShowSkuModal(true); }}
            className="flex items-center bg-[#22c55e] text-[#ffffff] h-[36px] px-[14px] rounded-[6px] font-[600] text-[13px] hover:bg-[#16a34a] transition-all"
          >
            <Plus size={15} className="mr-[5px]"/> Add New SKU
          </button>
        </div>

        <DataTable
          columns={columns}
          data={pagination.paginatedData}
          loading={inventoryLoading}
          onRowClick={(row) => handleToggleRow(row)}
          renderSubRow={(row) => expandedRows[row.id] && renderExpandedBatches(row.id)}
        />
      </div>
    );
  };

  const renderAnalytics = () => {
    // FIX: use pre-unwrapped `analytics` (not raw analyticsData which has a {success, data} wrapper)
    const data = analytics;
    const COLORS = { A: '#10B981', B: '#3B82F6', C: '#94A3B8', F: '#10B981', S: '#3B82F6', N: '#EF4444' };

    const abcChartData = [
      { name: 'Category A', value: data?.abcAnalysis?.summary?.valueA || 0, fill: COLORS.A },
      { name: 'Category B', value: data?.abcAnalysis?.summary?.valueB || 0, fill: COLORS.B },
      { name: 'Category C', value: data?.abcAnalysis?.summary?.valueC || 0, fill: COLORS.C },
    ];

    const fsnChartData = [
        { name: 'Fast Moving', value: data?.fsnAnalysis?.fast?.length || 0, fill: COLORS.F },
        { name: 'Slow Moving', value: data?.fsnAnalysis?.slow?.length || 0, fill: COLORS.S },
        { name: 'Non-Moving', value: data?.fsnAnalysis?.nonMoving?.length || 0, fill: COLORS.N },
    ];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight text-sm">
              <BarChart3 size={18} className="text-accent"/> 
              {analyticsActiveTab === 'ABC' ? 'Capital Allocation' : 'Movement Dynamics'}
            </h3>
            <div className="w-full">
              <ResponsiveContainer width="100%" height={300} debounce={50}>
                <RePieChart>
                  <Pie 
                    data={analyticsActiveTab === 'ABC' ? abcChartData : fsnChartData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={80} 
                    paddingAngle={5} 
                    dataKey="value"
                  >
                    {(analyticsActiveTab === 'ABC' ? abcChartData : fsnChartData).map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 text-accent bg-blue-50 p-3 rounded-xl">
                    <Zap size={16}/>
                    <p className="text-xs font-bold leading-tight">
                        {analyticsActiveTab === 'ABC' ? 'Category A items represent 80% of your capital. Tight control recommended.' : 'Slow moving items are increasing. Consider liquidation.'}
                    </p>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Tabs 
            tabs={[
              { id: 'ABC', label: 'Value-Based (ABC)' },
              { id: 'FSN', label: 'Movement (FSN)' },
              { id: 'VED', label: 'Criticality (VED)' },
              { id: 'EXPIRY_LIFE', label: 'Expiry Lifecycle' }
            ]}
            activeTab={analyticsActiveTab}
            onChange={setAnalyticsActiveTab}
          />
          <div className="mt-6">
            {analyticsActiveTab === 'ABC' && (
              <DataTable 
                columns={[
                  { key: 'name', label: 'Product', width: '50%' },
                  { key: 'totalStock', label: 'Stock', width: '20%', align: 'right' },
                  { key: 'stockValue', label: 'Value', width: '30%', align: 'right', format: (v) => `₹${v.toLocaleString()}` }
                ]}
                data={data?.abcAnalysis?.categoryA?.slice(0, 10) || []}
              />
            )}
            {analyticsActiveTab === 'FSN' && (
                <DataTable 
                    columns={[
                        { key: 'name', label: 'Product', width: '40%' },
                        { key: 'velocity', label: 'Tx/Mo', width: '15%', align: 'right', format: (v) => v.toFixed(1) },
                        { key: 'totalStock', label: 'Stock', width: '25%', align: 'right' },
                        { key: 'fsn', label: 'Velocity', width: '20%', format: (v) => <Badge text={v === 'F' ? 'FAST' : v === 'S' ? 'SLOW' : 'NON-MOVING'} variant={v === 'F' ? 'success' : v === 'S' ? 'info' : 'danger'} /> }
                    ]}
                    data={(data?.fsnAnalysis?.fast || []).concat(data?.fsnAnalysis?.slow || []).slice(0, 10)}
                    emptyMessage="No movement data available"
                />
            )}
            {analyticsActiveTab === 'VED' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { id: 'V', label: 'Vital', data: data?.vedAnalysis?.vital, color: 'rose' },
                        { id: 'E', label: 'Essential', data: data?.vedAnalysis?.essential, color: 'blue' },
                        { id: 'D', label: 'Desirable', data: data?.vedAnalysis?.desirable, color: 'slate' }
                    ].map(v => (
                        <div key={v.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-96 shadow-sm">
                            <div className={`p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center`}>
                                <h4 className={`font-bold text-slate-700 uppercase text-xs tracking-widest`}>{v.label}</h4>
                                <Badge text={v.data?.length || 0} variant="neutral" />
                            </div>
                            <div className="flex-1 overflow-auto p-3 space-y-2 custom-scrollbar">
                                {v.data?.map((item: any) => (
                                    <div key={item.productId} className="p-3 bg-slate-50 rounded-lg text-xs font-bold border border-transparent hover:border-slate-200 transition-all text-primary uppercase">
                                        {item.name}
                                        <div className="mt-1 text-[9px] text-slate-400 font-bold tracking-tighter italic">{item.status}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {analyticsActiveTab === 'EXPIRY_LIFE' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-rose-50 p-6 rounded-xl border border-rose-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Expired Capital Loss</p>
                                <h3 className="text-3xl font-bold text-rose-700">₹{(data?.expiryLifecycle?.expired?.reduce((s:any, i:any) => s + i.stockValue, 0) || 0).toLocaleString()}</h3>
                            </div>
                            <Archive className="text-rose-300" size={40}/>
                        </div>
                        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Near Expiry Risk</p>
                                <h3 className="text-3xl font-bold text-amber-700">{data?.expiryLifecycle?.nearExpiry?.length || 0} SKU</h3>
                            </div>
                            <Clock className="text-amber-300" size={40}/>
                        </div>
                    </div>
                    <DataTable 
                        columns={[
                            { key: 'name', label: 'Product', width: '50%' },
                            { key: 'totalStock', label: 'Stock Qty', width: '20%', align: 'right' },
                            { key: 'stockValue', label: 'Loss Value', width: '30%', align: 'right', format: (v) => `₹${v.toLocaleString()}` }
                        ]}
                        data={data?.expiryLifecycle?.expired || []}
                        emptyMessage="Zero expired stock. Excellent management!"
                    />
                </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderExpiryTab = () => {
    const expiringItems = inventoryItems.filter((i: any) => i.expiryStatus !== 'OK');
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-primary">Expiry Tracker Command</h3>
                    <p className="text-slate-500 text-sm">Managing lifecycle endpoints across {expiringItems.length} active alerts.</p>
                </div>
                <div className="flex gap-4">
                    <StatCard label="Critical (<30D)" value={expiringItems.filter((i:any) => i.expiryStatus === 'EXPIRED').length} icon={<AlertTriangle size={18}/>} color="rose" />
                    <StatCard label="Warning (<180D)" value={expiringItems.filter((i:any) => i.expiryStatus === 'EXPIRING_SOON').length} icon={<Clock size={18}/>} color="amber" />
                </div>
            </div>
            <DataTable 
                columns={[
                    { key: 'code', label: 'Code', width: '10%' },
                    { key: 'name', label: 'Product', width: '40%', render: (v, row) => (
                        <div>
                            <div className="font-bold text-primary uppercase text-xs">{v}</div>
                            <div className="text-[9px] text-slate-400 font-bold italic">{row.genericName}</div>
                        </div>
                    )},
                    { key: 'currentStock', label: 'Stock', width: '15%', align: 'right' },
                    { key: 'expiryStatus', label: 'Status', width: '15%', render: (v) => <Badge text={v} variant={v === 'EXPIRED' ? 'danger' : 'warning'} /> },
                    { key: 'actions', label: 'Action', width: '10%', align: 'center', render: (_, row) => (
                        <button onClick={() => handleToggleRow(row)} className="text-accent hover:underline font-bold text-[10px] uppercase">Review Batches</button>
                    )}
                ]}
                data={expiringItems}
                renderSubRow={(row) => expandedRows[row.id] && renderExpandedBatches(row.id)}
            />
        </div>
    );
  };

  const renderLowStockTab = () => {
    const lowStockItems = inventoryItems.filter((i: any) => i.currentStock <= (i.reorderLevel || 10));
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-xl font-bold text-primary">Stock Deficit Monitor</h3>
                    <p className="text-slate-500 text-sm">Optimizing supply chain for {lowStockItems.length} critical SKUs.</p>
                </div>
                <button 
                    onClick={() => notify.info('Bulk reorder review queued. Purchase order creation is not connected yet.')}
                    className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-neutral-800 transition-all"
                >
                    <ShoppingCart size={18}/> Bulk Reorder (Smart)
                </button>
            </div>
            <DataTable 
                columns={[
                    { key: 'name', label: 'Product', width: '40%', render: (v, row) => (
                        <div>
                            <div className="font-bold text-primary uppercase text-xs">{v}</div>
                            <div className="text-[9px] text-slate-400 font-bold italic">{row.manufacturer}</div>
                        </div>
                    )},
                    { key: 'currentStock', label: 'Stock', width: '15%', align: 'right', render: (v) => <span className="font-bold text-red-600">{v}</span> },
                    { key: 'reorderLevel', label: 'Threshold', width: '15%', align: 'right', render: (v) => <span className="font-bold text-slate-400">{v}</span> },
                    { key: 'deficit', label: 'Deficit', width: '15%', align: 'right', render: (_, row) => <span className="font-black text-rose-700">{(row.reorderLevel || 100) - row.currentStock}</span> },
                    { key: 'actions', label: 'Action', width: '15%', align: 'center', render: (_, row) => (
                        <button 
                            onClick={() => {
                                notify.success(`Reorder request for ${row.name} sent to Purchase module.`);
                                setGlobalActiveTab('PURCHASE' as any);
                            }}
                            className="bg-blue-50 text-accent px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase hover:bg-accent hover:text-white transition-all border border-blue-100"
                        >
                            Raise PO
                        </button>
                    )}
                ]}
                data={lowStockItems}
            />
        </div>
    );
  };

  const renderValuationTab = () => {
    const valuation = {
        totalAssetValue: inventoryItems.reduce((acc: number, curr: any) => acc + ((curr?.currentStock || 0) * (curr?.purchaseRate || 0)), 0),
        totalMarketValue: inventoryItems.reduce((acc: number, curr: any) => acc + ((curr?.currentStock || 0) * (curr?.mrp || 0)), 0),
        totalSkus: inventoryItems.length
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-primary uppercase tracking-tight">Enterprise Asset Valuation</h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Live Database Reconcilation</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-accent rounded-2xl border border-blue-100">
                            <Calculator size={24}/>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Asset Value (Purchase)</span>
                            <span className="text-3xl font-black text-primary">₹{(valuation.totalAssetValue / 100000).toFixed(2)}L</span>
                        </div>
                        <div className="flex justify-between items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Market Value (Potential)</span>
                            <span className="text-3xl font-black text-emerald-600">₹{(valuation.totalMarketValue / 100000).toFixed(2)}L</span>
                        </div>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-4 text-slate-400">
                    <Info size={20} className="text-accent"/>
                    <p className="text-[11px] font-bold leading-relaxed">
                        Reconciled against <span className="text-primary font-black">{valuation.totalSkus} SKUs</span> across all branches. 
                        Calculated using Weighted Average methodology.
                    </p>
                </div>
            </div>
            <div className="bg-[#1D3557] p-10 rounded-2xl text-white relative overflow-hidden flex flex-col justify-center shadow-2xl">
                <div className="relative z-10 space-y-6">
                    <div className="w-16 h-1 w-full bg-blue-400 rounded-full opacity-30"></div>
                    <h3 className="text-3xl font-black leading-tight">Financial Inventory <br/>Synchronization</h3>
                    <p className="text-blue-200 text-lg font-medium max-w-sm leading-relaxed">
                        Real-time ledger updates ensure your stock value accurately reflects in Balance Sheets and P&L Statements.
                    </p>
                    <div className="flex gap-4 pt-4">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/20">
                            <CheckCircle2 size={14} className="text-emerald-400"/> Audit Ready
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/20">
                            <Globe size={14} className="text-blue-400"/> Multi-Branch Sync
                        </div>
                    </div>
                </div>
                <Globe size={300} className="absolute -right-20 -bottom-20 opacity-10 rotate-12" />
            </div>
        </div>
    );
  };

  const renderSkuModal = () => (
    <Modal 
      title={`${editingId ? 'Edit' : 'Create'} Product Master Record`} 
      onClose={() => setShowSkuModal(false)}
      size="lg"
    >
      <div className="flex flex-col h-[70vh]">
        <div className="flex gap-8 border-b mb-8 overflow-x-auto custom-scrollbar shrink-0">
          {[
            { id: 'GENERAL', label: 'General Info' },
            { id: 'PRICING', label: 'Pricing Matrix' },
            { id: 'STATUTORY', label: 'Statutory (GST/HSN)' },
            { id: 'INVENTORY', label: 'Stock Control' }
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setSkuFormTab(t.id)}
              className={`pb-4 text-[11px] font-black uppercase border-b-2 transition-all tracking-widest whitespace-nowrap ${skuFormTab === t.id ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
          {skuFormTab === 'GENERAL' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-4 gap-6">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Item Code *</label>
                  <input value={skuForm.itemCode} onChange={e => setSkuForm({...skuForm, itemCode: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all uppercase" placeholder="ITM-001"/>
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Product Name *</label>
                  <input value={skuForm.itemName} onChange={e => setSkuForm({...skuForm, itemName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all uppercase" placeholder="Brand Name"/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Generic Name (Salt)</label>
                  <input value={skuForm.genericName} onChange={e => setSkuForm({...skuForm, genericName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all" placeholder="Salt Composition"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Manufacturer / Co.</label>
                  <input value={skuForm.manufacturer} onChange={e => setSkuForm({...skuForm, manufacturer: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all" placeholder="e.g. GSK, Pfizer"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Stock Group</label>
                  <select value={skuForm.stockGroup} onChange={e => setSkuForm({...skuForm, stockGroup: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none">
                    {STOCK_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Unit of Measure (Base)</label>
                  <select value={skuForm.baseUom} onChange={e => setSkuForm({...skuForm, baseUom: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none">
                    {UOM_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end pb-1">
                    <label className="flex items-center gap-4 cursor-pointer p-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <input type="checkbox" checked={skuForm.isActive} onChange={e => setSkuForm({...skuForm, isActive: e.target.checked})} className="w-6 h-6 accent-blue-600 rounded-lg" />
                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Active Status</span>
                    </label>
                </div>
              </div>
            </div>
          )}
          {skuFormTab === 'PRICING' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-2 gap-8">
                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner group transition-all hover:bg-white hover:border-accent hover:shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase Rate</label>
                    <ArrowDownRight className="text-rose-400" size={24}/>
                  </div>
                  <div className="text-4xl font-black flex items-center gap-3 text-primary">
                    <span className="text-slate-300">₹</span>
                    <input type="number" step="0.01" value={skuForm.purchaseRate} onChange={e => setSkuForm({...skuForm, purchaseRate: toFormNumber(e.target.value)})} className="bg-transparent w-full outline-none focus:text-accent transition-colors" placeholder="0.00"/>
                  </div>
                </div>
                <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner group transition-all hover:bg-white hover:border-emerald-500 hover:shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Selling Rate</label>
                    <ArrowUpRight className="text-emerald-400" size={24}/>
                  </div>
                  <div className="text-4xl font-black flex items-center gap-3 text-primary">
                    <span className="text-slate-300">₹</span>
                    <input type="number" step="0.01" value={skuForm.sellingRate} onChange={e => setSkuForm({...skuForm, sellingRate: toFormNumber(e.target.value)})} className="bg-transparent w-full outline-none focus:text-emerald-600 transition-colors" placeholder="0.00"/>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">MRP (Maximum Retail)</label>
                  <input type="number" step="0.01" value={skuForm.mrp} onChange={e => setSkuForm({...skuForm, mrp: toFormNumber(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:border-accent" placeholder="0.00"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">PTR (Price to Retailer)</label>
                  <input type="number" step="0.01" value={skuForm.ptr} onChange={e => setSkuForm({...skuForm, ptr: toFormNumber(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:border-accent" placeholder="0.00"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">PTS (Price to Stockist)</label>
                  <input type="number" step="0.01" value={skuForm.pts} onChange={e => setSkuForm({...skuForm, pts: toFormNumber(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:border-accent" placeholder="0.00"/>
                </div>
              </div>
              <div className="p-6 bg-slate-900 rounded-2xl text-white flex justify-between items-center shadow-xl">
                <div>
                    <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Estimated Net Margin</p>
                    <div className="text-2xl font-black">{skuForm.marginPercent}% <span className="text-sm font-medium text-slate-400 ml-2">Potential Profit</span></div>
                </div>
                <Badge text={skuForm.marginPercent > 20 ? 'HIGH MARGIN' : skuForm.marginPercent > 0 ? 'HEALTHY' : 'CRITICAL'} variant={skuForm.marginPercent > 20 ? 'success' : skuForm.marginPercent > 0 ? 'info' : 'danger'} />
              </div>
            </div>
          )}
          {skuFormTab === 'STATUTORY' && (
              <div className="space-y-8 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">HSN / SAC Code</label>
                        <input value={skuForm.hsnCode} onChange={e => setSkuForm({...skuForm, hsnCode: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-3xl text-2xl font-black outline-none focus:border-accent tracking-widest" placeholder="3004 0000"/>
                        <p className="text-[10px] text-slate-400 font-bold italic tracking-tighter">Standard pharmaceutical HSN is typically 3004.</p>
                    </div>
                    <div className="space-y-4">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">GST Rate (%)</label>
                        <div className="grid grid-cols-5 gap-3">
                            {GST_RATES.map(rate => (
                                <button 
                                    key={rate} 
                                    onClick={() => setSkuForm({...skuForm, taxRate: rate})} 
                                    className={`py-4 rounded-2xl border-2 font-black text-sm transition-all ${skuForm.taxRate === rate ? 'bg-accent border-accent text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50 hover:border-slate-200'}`}
                                >
                                    {rate}%
                                </button>
                            ))}
                        </div>
                    </div>
                  </div>
                  <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl flex gap-4 items-center">
                      <ShieldAlert className="text-accent" size={32}/>
                      <div>
                          <h4 className="font-black text-primary uppercase text-xs">Statutory Compliance Check</h4>
                          <p className="text-xs font-medium text-slate-500 mt-1">HSN and GST configuration is used for e-Invoicing and Tax Returns (GSTR-1, GSTR-3B). Please verify before saving.</p>
                      </div>
                  </div>
              </div>
          )}
          {skuFormTab === 'INVENTORY' && (
              <div className="space-y-8 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Target Reorder Level</label>
                            <div className="flex items-center gap-4">
                                <input type="number" value={skuForm.reorderLevel} onChange={e => setSkuForm({...skuForm, reorderLevel: toFormNumber(e.target.value)})} className="bg-transparent w-full text-3xl font-black outline-none focus:text-accent" placeholder="0"/>
                                <span className="text-xs font-black text-slate-400 uppercase">{skuForm.baseUom}</span>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-inner">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Min Safety Stock</label>
                            <div className="flex items-center gap-4">
                                <input type="number" value={skuForm.minStockLevel} onChange={e => setSkuForm({...skuForm, minStockLevel: toFormNumber(e.target.value)})} className="bg-transparent w-full text-3xl font-black outline-none focus:text-accent" placeholder="0"/>
                                <span className="text-xs font-black text-slate-400 uppercase">{skuForm.baseUom}</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setSkuForm({...skuForm, maintainBatches: !skuForm.maintainBatches})}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${skuForm.maintainBatches ? 'bg-blue-100 text-accent' : 'bg-slate-50 text-slate-300'}`}>
                                    <Layers size={24}/>
                                </div>
                                <div>
                                    <h4 className="font-black text-primary uppercase text-xs">Maintain Batches</h4>
                                    <p className="text-[10px] text-slate-400 font-bold italic tracking-tighter">Enable batch-wise stock tracking</p>
                                </div>
                            </div>
                            <input type="checkbox" checked={skuForm.maintainBatches} onChange={e => setSkuForm({...skuForm, maintainBatches: e.target.checked})} className="w-6 h-6 accent-blue-600 rounded-lg" />
                        </div>
                        <div className="flex items-center justify-between group cursor-pointer" onClick={() => setSkuForm({...skuForm, trackExpiry: !skuForm.trackExpiry})}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${skuForm.trackExpiry ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-300'}`}>
                                    <Clock size={24}/>
                                </div>
                                <div>
                                    <h4 className="font-black text-primary uppercase text-xs">Track Expiry</h4>
                                    <p className="text-[10px] text-slate-400 font-bold italic tracking-tighter">Enable lifecycle/expiry monitoring</p>
                                </div>
                            </div>
                            <input type="checkbox" checked={skuForm.trackExpiry} onChange={e => setSkuForm({...skuForm, trackExpiry: e.target.checked})} className="w-6 h-6 accent-blue-600 rounded-lg" />
                        </div>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Auto-Suggested Scheme</label>
                      <input value={skuForm.scheme} onChange={e => setSkuForm({...skuForm, scheme: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xl font-black focus:border-accent outline-none" placeholder="e.g. 10+1 or 5% DISCOUNT"/>
                  </div>
              </div>
          )}
        </div>

        <div className="pt-8 border-t mt-8 flex justify-between items-center shrink-0">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              {editingId ? 'Updating Record ID: ' + editingId.slice(0,8) : 'New SKU Initialization'}
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowSkuModal(false)} className="px-8 py-3 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all border border-slate-200">Cancel</button>
            <button onClick={handleSaveSku} disabled={savingSku} className="px-10 py-3 text-[11px] font-black text-white uppercase tracking-widest bg-accent rounded-2xl hover:bg-neutral-900 shadow-xl active:scale-95 transition-all flex items-center gap-3">
                {savingSku ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} 
                {savingSku ? 'COMMITING...' : 'SAVE TO MASTER (F2)'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );

  return (
    <ERPLayout
      title="Inventory Hub"
      description="Stock Management · Analytics · Intelligence"
      onRefresh={() => { refetchInventory(); refetchAnalytics(); }}
      isLoading={inventoryLoading || analyticsLoading}
      icon={<Layers size={20} className="text-primary"/>}
      actionButtons={isPosMode ? [
        <button 
          key="back"
          onClick={onBackToPos}
          className="bg-[#0f172a] text-[#ffffff] px-[16px] py-[8px] rounded-[6px] font-[600] text-[13px] hover:bg-[#1e293b] transition-all flex items-center gap-[6px]"
        >
          <ShoppingCart size={14}/> Back to POS
        </button>
      ] : [
        <button 
          key="opt"
          onClick={() => setShowOptimizationModal(true)}
          className="bg-[#22c55e] text-[#ffffff] px-[16px] py-[8px] rounded-[6px] font-[600] text-[13px] hover:bg-[#16a34a] transition-all flex items-center gap-[6px]"
        >
          <Sparkles size={14}/> AI OPTIMIZE
        </button>
      ]}
    >
      {renderIntelligenceSummary()}

      <FilterBar 
        searchPlaceholder="Universal search for Brand, Generic, or Code..."
        searchValue={searchTerm}
        onSearchChange={(v) => { setSearchTerm(v); setQuery(v); }}
        filters={[
          {
            id: 'status',
            label: 'Quick Filter',
            type: 'select',
            value: quickFilter,
            onChange: setQuickFilter,
            options: [
              { value: 'ALL', label: 'All Items' },
              { value: 'LOW_STOCK', label: 'Low Stock' },
              { value: 'EXPIRING', label: 'Expiring Soon' },
              { value: 'EXPIRED', label: 'Expired' }
            ]
          }
        ]}
      />

      <Tabs 
        tabs={[
          { id: 'CATALOG', label: 'Stock Catalog', badge: inventoryItems.length },
          { id: 'ANALYTICS', label: 'Analytics & Intelligence' },
          { id: 'EXPIRY', label: 'Expiry Tracker', badge: inventoryItems.filter((i:any) => i.expiryStatus !== 'OK').length },
          { id: 'LOW_STOCK', label: 'Low Stock Alerts', badge: inventoryItems.filter((i:any) => i.currentStock <= (i.reorderLevel || 10)).length },
          { id: 'VALUATION', label: 'Valuation Hub' }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="mt-8">
        {activeTab === 'CATALOG' && renderStockCatalog()}
        {activeTab === 'ANALYTICS' && renderAnalytics()}
        {activeTab === 'EXPIRY' && renderExpiryTab()}
        {activeTab === 'LOW_STOCK' && renderLowStockTab()}
        {activeTab === 'VALUATION' && renderValuationTab()}
      </div>

      {showSkuModal && renderSkuModal()}

      {showOptimizationModal && (
        <Modal 
          isOpen={showOptimizationModal} 
          title="AI Inventory Optimization" 
          onClose={() => setShowOptimizationModal(false)}
        >
          <div className="p-4 text-center">
            <BrainCircuit size={80} className="mx-auto text-accent mb-8 animate-pulse"/>
            <h3 className="text-2xl font-black mb-3 uppercase tracking-tight">Sync AI Reorder Points</h3>
            <p className="text-slate-500 text-sm mb-10 max-w-sm mx-auto leading-relaxed">Our engine will analyze consumption patterns across {inventoryItems.length} SKUs and adjust reorder levels across the database.</p>
            <button 
              onClick={handleOptimization}
              disabled={optimizing}
              className="w-full bg-[#1D3557] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {optimizing ? <RefreshCw className="animate-spin" size={20}/> : <Zap size={20}/>}
              {optimizing ? 'Calculating Vectors...' : 'Run Optimization Now'}
            </button>
          </div>
        </Modal>
      )}
    </ERPLayout>
  );
};

export default InventoryHub;
