import React, { useState, useEffect } from 'react';
import { 
  Search, CreditCard, ArrowUpRight, ArrowDownLeft, FileText, Calendar, 
  Wallet, Check, X, Plus, PieChart, TrendingUp, DollarSign, RefreshCcw, 
  Filter, User, MapPin, Briefcase, Printer, 
  Download, Eye, Pencil, Trash2, Save, XCircle, Package, Layers, 
  AlertCircle, ShoppingCart, History, Calculator,
  Receipt, Users, Clock, Database, BarChart3, ShieldCheck
} from 'lucide-react';
import TallyVoucherEntry from './TallyVoucherEntry';
import { Product, Batch, SalesInvoice, SalesInvoiceItem, Party, Tab } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  getAllInvoices, getInvoiceById, getAllParties, 
  getAllProducts, saveProduct, deleteProduct, deleteInvoice
} from '../services/databaseService';
import { apiClient } from '../services/apiClient';
import { EnterpriseLayout } from './UniversalLayout';
import { printPOSInvoice } from '../utils/accountingExport';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

interface POSDashboardInvoiceRow {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  amount: number;
  status: string;
  items_sold: number;
}

interface POSDashboardSummary {
  tables: string[];
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueChangePercent: number;
  invoicesGenerated: number;
  itemsSoldToday: number;
  pendingDrafts: number;
  monthlyRevenue: number;
  recentInvoices: POSDashboardInvoiceRow[];
}

const StrategicPOS: React.FC = () => {
  const { addNotification } = useNotifications();
  const { setPosTerminalOpen, setActiveTab: setStoreActiveTab } = useAppStore();

  // --- State: Internal Terminal Mode ---
  const [activeMode, setActiveMode] = useState<string>('POS_DASHBOARD');

  // --- Top Ribbon Actions ---
  const topActions = [
    { label: 'Counter Sale (F8)', onClick: () => setActiveMode('NEW_INVOICE'), icon: <ShoppingCart size={14}/> },
    { label: 'Wholesale (F9)', onClick: () => setActiveMode('WHOLESALE_BILL'), icon: <Briefcase size={14}/> },
    { label: 'Returns (F10)', onClick: () => setActiveMode('VOUCHER_ENTRY_Return'), icon: <RefreshCcw size={14}/> },
    { 
      label: 'Day Book', 
      onClick: () => addNotification({ 
        type: 'info', 
        title: 'Coming Soon', 
        message: 'Day Book module is currently being optimized for enterprise scale.' 
      }), 
      icon: <Receipt size={14}/> 
    },
  ];

  // --- Shared POS State ---
  const [cartItems, setCartItems] = useState<SalesInvoiceItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [posDashboardSummary, setPosDashboardSummary] = useState<POSDashboardSummary>({
    tables: ['sales_invoices', 'sales_invoice_items', 'parties'],
    todayRevenue: 0,
    yesterdayRevenue: 0,
    revenueChangePercent: 0,
    invoicesGenerated: 0,
    itemsSoldToday: 0,
    pendingDrafts: 0,
    monthlyRevenue: 0,
    recentInvoices: []
  });
  
  // --- Product Management State ---
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    genericName: '',
    manufacturer: '',
    packing: '',
    uom: 'Strip',
    hsn: '',
    gst: 12,
    minStockLevel: 50,
    reorderLevel: 100,
    therapeuticCategory: 'OTC',
    totalStock: 0
  });

  // --- Custom Confirmation Dialog State ---
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const loadPosDashboardSummary = async () => {
    try {
      const response = await apiClient.get(`/pos/dashboard-summary?t=${Date.now()}`);
      const summaryData = response?.success ? response.data : response;

      const mappedInvoices = Array.isArray(summaryData?.recentInvoices) 
        ? summaryData.recentInvoices.map((inv: any) => ({
            ...inv,
            id: inv.id || inv.invoice_number || inv.invoice_no,
            invoice_number: inv.invoice_number || inv.invoice_no || inv.id || 'N/A',
            customer_name: inv.customer_name || inv.party_name || 'Counter Customer',
            invoice_date: inv.date || inv.invoice_date || new Date().toISOString(),
            amount: Number(inv.net_amount || inv.amount || inv.net_payable || 0),
            status: inv.status || 'Completed',
            items_sold: Number(inv.items_sold || 0)
          })) 
        : [];

      setPosDashboardSummary({
        tables: summaryData?.tables || ['sales_invoices', 'sales_invoice_items', 'parties'],
        todayRevenue: Number(summaryData?.todayRevenue || 0),
        yesterdayRevenue: Number(summaryData?.yesterdayRevenue || 0),
        revenueChangePercent: Number(summaryData?.revenueChangePercent || 0),
        invoicesGenerated: Number(summaryData?.invoicesGenerated || 0),
        itemsSoldToday: Number(summaryData?.itemsSoldToday || 0),
        pendingDrafts: Number(summaryData?.pendingDrafts || 0),
        monthlyRevenue: Number(summaryData?.monthlyRevenue || 0),
        recentInvoices: mappedInvoices
      });
    } catch (error) {
      console.error('StrategicPOS: Failed to load dashboard summary', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [productsData] = await Promise.all([
          getAllProducts()
        ]);
        await loadPosDashboardSummary();
        setAvailableProducts(productsData || []);
      } catch (err: any) {
        console.error('StrategicPOS: Failed to load data', err);
        addNotification({
          type: 'error',
          title: 'POS Initialization Failed',
          message: `Initialization Failed: ${err.message || 'Check connection.'}`,
          priority: 'high'
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleViewInvoice = async (invoiceId: string) => {
    if (!invoiceId) return;
    try {
      setLoading(true);
      const invoice = await getInvoiceById(invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
        setShowInvoicePreview(true);
      }
    } catch (err: any) {
      console.error('StrategicPOS: Failed to view invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.genericName) return;
    const newProduct: Product = {
      id: isEditingProduct ? productForm.id! : `P-${Date.now()}`,
      name: productForm.name!,
      genericName: productForm.genericName!,
      manufacturer: productForm.manufacturer || 'Unknown',
      packing: productForm.packing || 'N/A',
      uom: productForm.uom || 'Unit',
      hsn: productForm.hsn || '',
      gst: productForm.gst || 12,
      minStockLevel: productForm.minStockLevel || 0,
      reorderLevel: productForm.reorderLevel || 0,
      therapeuticCategory: productForm.therapeuticCategory || 'General',
      totalStock: productForm.totalStock || 0,
      batches: [],
      source: 'TRADING',
      rack: 'A1',
      scheduleType: 'OTC'
    };

    const success = await saveProduct(newProduct);
    if (success) {
      const updatedList = await getAllProducts();
      setAvailableProducts(updatedList);
      setShowProductModal(false);
      addNotification({
        type: 'success',
        title: isEditingProduct ? 'Product Updated' : 'Product Added',
        message: `Product "${newProduct.name}" synchronized.`,
        priority: 'low'
      });
    }
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Product SKU',
      message: 'Are you sure you want to delete this product? All linked batches will be removed.',
      onConfirm: async () => {
        const success = await deleteProduct(id);
        if (success) {
          const updatedList = await getAllProducts();
          setAvailableProducts(updatedList);
          addNotification({
            type: 'success',
            title: 'Product Deleted',
            message: 'Product removed successfully.',
            priority: 'medium'
          });
        }
      }
    });
  };

  const handleDeleteInvoice = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Sales Invoice',
      message: 'Are you sure you want to delete this invoice? This action will restore batch stocks.',
      onConfirm: async () => {
        const success = await deleteInvoice(id);
        if (success) {
          setShowInvoicePreview(false);
          await loadPosDashboardSummary();
          addNotification({
            type: 'success',
            title: 'Invoice Deleted',
            message: 'Invoice deleted and stocks restored.',
            priority: 'high'
          });
        }
      }
    });
  };

  const renderLiveDashboard = () => (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">POS Dashboard Source</p>
          <p className="text-xs font-bold text-slate-700">Live from {posDashboardSummary.tables.join(' + ')}</p>
        </div>
        <button
          onClick={() => setStoreActiveTab(Tab.SALES_HISTORY)}
          className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline"
        >
          Open Sales Register
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 shrink-0">
        <button
          onClick={() => setStoreActiveTab(Tab.SALES_HISTORY)}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Today's Revenue</p>
            <h3 className="text-xl font-black text-[#1D3557]">{formatCurrency(posDashboardSummary.todayRevenue)}</h3>
            <p className={`mt-1 text-[10px] font-bold ${posDashboardSummary.revenueChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {posDashboardSummary.revenueChangePercent >= 0 ? 'Up' : 'Down'} {Math.abs(posDashboardSummary.revenueChangePercent)}% from yesterday
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-blue-600"><DollarSign size={20} /></div>
        </button>

        <button
          onClick={() => setStoreActiveTab(Tab.SALES_HISTORY)}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Invoices Generated</p>
            <h3 className="text-xl font-black text-slate-800">{posDashboardSummary.invoicesGenerated}</h3>
            <p className="mt-1 text-[10px] font-bold text-slate-400">Total items sold: {posDashboardSummary.itemsSoldToday}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-slate-600"><Receipt size={20} /></div>
        </button>

        <button
          onClick={() => setStoreActiveTab(Tab.SALES_HISTORY)}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-amber-200 hover:bg-amber-50/40"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending Drafts</p>
            <h3 className="text-xl font-black text-amber-600">{posDashboardSummary.pendingDrafts}</h3>
            <p className="mt-1 text-[10px] font-bold text-amber-600">Requires completion</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-amber-600"><Clock size={20} /></div>
        </button>

        <button
          onClick={() => setStoreActiveTab(Tab.SALES_HISTORY)}
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Revenue</p>
            <h3 className="text-xl font-black text-emerald-600">{formatCurrency(posDashboardSummary.monthlyRevenue)}</h3>
            <p className="mt-1 text-[10px] font-bold text-emerald-600">This month from billing</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600"><TrendingUp size={20} /></div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 flex-1 min-h-0">
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-3 shrink-0">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700">
              <History size={14} className="text-blue-600" />
              Recent Invoices (Live Feed)
            </h3>
            <button onClick={() => setStoreActiveTab(Tab.SALES_HISTORY)} className="text-[10px] font-black text-blue-600 hover:underline">VIEW ALL</button>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                <tr>
                  <th className="p-4">Invoice No</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posDashboardSummary.recentInvoices.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => handleViewInvoice(inv.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 group"
                  >
                    <td className="p-4 font-mono text-xs font-bold text-blue-700 group-hover:underline">{inv.invoice_number}</td>
                    <td className="p-4 text-xs font-bold text-slate-700">{inv.customer_name}</td>
                    <td className="p-4 text-xs text-slate-500">{formatDate(inv.invoice_date)}</td>
                    <td className="p-4 text-right text-xs font-black">{formatCurrency(inv.amount)}</td>
                    <td className="p-4 text-center">
                      <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${inv.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-1.5">
                        <button 
                          onClick={async () => {
                            try {
                              setLoading(true);
                              const fullInvoice = await getInvoiceById(inv.id);
                              setEditingInvoice(fullInvoice || inv);
                              setActiveMode('EDIT_INVOICE');
                            } catch (err) {
                              console.error('Failed to load invoice for editing:', err);
                              setEditingInvoice(inv);
                              setActiveMode('EDIT_INVOICE');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Edit Invoice"
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              setLoading(true);
                              const fullInvoice = await getInvoiceById(inv.id);
                              setEditingInvoice(fullInvoice || inv);
                              setActiveMode('VOUCHER_ENTRY_Return');
                            } catch (err) {
                              console.error('Failed to load invoice for return:', err);
                              setEditingInvoice(inv);
                              setActiveMode('VOUCHER_ENTRY_Return');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-all"
                          title="Sales Return"
                        >
                          <RefreshCcw size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Delete Invoice"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="relative overflow-hidden rounded-xl bg-[#1D3557] p-6 text-white shadow-xl flex-1 flex flex-col justify-center">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <ShoppingCart size={100} />
            </div>
            <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Quick Terminal</h4>
            <h2 className="mb-6 text-2xl font-black">Start New Billing</h2>
            <p className="mb-8 text-sm leading-relaxed text-blue-100/70">Fast-track retail counter sales with optimized search and batch selection.</p>
            <button
              onClick={() => setPosTerminalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/40 transition-all hover:bg-blue-400"
            >
              <Plus size={18} /> Open POS Terminal
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <Database size={14} className="text-blue-600" />
              Linked Master Data
            </h4>
            <div className="space-y-4 text-xs font-bold text-slate-600">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <span>Total Items Active</span>
                <span className="font-black text-blue-700">{availableProducts.length}</span>
              </div>
              <button 
                onClick={() => setStoreActiveTab(Tab.CUSTOMER_DATABASE)}
                className="w-full flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 hover:bg-blue-50 transition-colors"
              >
                <span>Go to Customer DB</span>
                <Users size={14} className="text-blue-600" />
              </button>
              <button 
                onClick={() => setStoreActiveTab(Tab.VOUCHER_SETUP)}
                className="w-full flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 hover:bg-blue-50 transition-colors"
              >
                <span>Go to Voucher Setup</span>
                <ShieldCheck size={14} className="text-blue-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVoucherEntry = (type: any) => (
    <TallyVoucherEntry 
      initialType={type} 
      initialItems={activeMode === 'NEW_INVOICE' ? cartItems : []}
      editingInvoice={activeMode === 'EDIT_INVOICE' || activeMode.startsWith('VOUCHER_ENTRY_Return') ? editingInvoice : null}
      onClose={() => {
        setActiveMode('POS_DASHBOARD');
        setEditingInvoice(null);
      }} 
      onSuccess={() => {
        setActiveMode('POS_DASHBOARD');
        setEditingInvoice(null);
        loadPosDashboardSummary();
      }}
    />
  );

  return (
    <EnterpriseLayout
      title="Strategic Point of Sale"
      subtitle="Enterprise Accounting & Billing Terminal"
      sidebarItems={[]}
      showSidebar={false}
      topActions={topActions}
    >
      {activeMode === 'POS_DASHBOARD' && renderLiveDashboard()}
      {(activeMode === 'NEW_INVOICE' || activeMode === 'EDIT_INVOICE') && renderVoucherEntry('Sales')}
      {activeMode === 'WHOLESALE_BILL' && renderVoucherEntry('Wholesale')}
      {activeMode === 'VOUCHER_ENTRY_Return' && renderVoucherEntry('Return')}
      {activeMode === 'DAY_BOOK' && <div className="p-8 text-center text-slate-400">Day Book Module is being synchronized...</div>}
      
      {showInvoicePreview && selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="bg-[#1D3557] p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg"><FileText size={20} /></div>
                <div>
                  <h3 className="font-black text-lg">Invoice Preview</h3>
                  <p className="text-xs text-blue-200 font-bold tracking-widest uppercase">{selectedInvoice.invoiceNumber || selectedInvoice.invoice_number}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowInvoicePreview(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-8 bg-slate-50">
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-8 relative overflow-hidden">
                <div className="flex justify-between items-start border-b border-dashed border-slate-100 pb-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#1D3557] rounded-xl flex items-center justify-center text-white font-black text-xl">M</div>
                      <div>
                        <h2 className="text-xl font-black text-[#1D3557]">Metapharsic Enterprise Hub</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enterprise Pharma Distribution</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-4xl font-black text-slate-200 uppercase tracking-tighter">Tax Invoice</h1>
                    <p className="text-xs font-black text-blue-700">{selectedInvoice.invoiceNumber || selectedInvoice.invoice_number}</p>
                    <p className="text-xs font-black text-slate-800">{formatDate(selectedInvoice.date || selectedInvoice.invoice_date)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12">
                  <div>
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Bill To</h4>
                    <h3 className="font-black text-slate-800">{selectedInvoice.customerName || selectedInvoice.customer_name}</h3>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-[#1D3557] text-white text-[10px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="p-3">Goods</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Rate</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-3 text-xs font-black text-slate-800">{item.product_name || item.productName}</td>
                          <td className="p-3 text-center text-xs font-black text-slate-800">{item.quantity}</td>
                          <td className="p-3 text-right text-xs font-bold">{formatCurrency(item.rate)}</td>
                          <td className="p-3 text-right text-xs font-black text-[#1D3557]">{formatCurrency(item.total_amount || item.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-6">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between items-center text-sm font-black text-[#1D3557] uppercase tracking-widest">
                      <span>Net Payable</span>
                      <span>{formatCurrency(selectedInvoice.netAmount || selectedInvoice.net_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 flex justify-end gap-3 border-t border-slate-200">
                <button 
                  onClick={() => {
                    setEditingInvoice(selectedInvoice);
                    setShowInvoicePreview(false);
                    setActiveMode('EDIT_INVOICE');
                  }}
                  className="px-6 py-2 bg-blue-600 text-white text-xs font-black uppercase hover:bg-blue-700 rounded shadow-sm"
                >
                  Edit Invoice
                </button>
                <button 
                  onClick={() => printPOSInvoice(selectedInvoice, null)}
                  className="px-6 py-2 bg-white border border-slate-400 text-slate-700 text-xs font-black uppercase rounded shadow-sm"
                >
                  Print
                </button>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[32px] max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
             <div className="flex items-center justify-between mb-6">
               <div>
                 <h3 className="font-black text-xl text-[#1D3557] uppercase tracking-tight">Manage Product SKU</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Product Master</p>
               </div>
               <button onClick={() => setShowProductModal(false)} aria-label="Close modal" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Product Name</label>
                    <input 
                      value={productForm.name} 
                      onChange={e => setProductForm({...productForm, name: e.target.value})}
                      placeholder="e.g. Paracetamol 500mg"
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Generic Name</label>
                    <input 
                      value={productForm.genericName} 
                      onChange={e => setProductForm({...productForm, genericName: e.target.value})}
                      placeholder="e.g. Acetaminophen"
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Manufacturer</label>
                    <input 
                      value={productForm.manufacturer} 
                      onChange={e => setProductForm({...productForm, manufacturer: e.target.value})}
                      placeholder="e.g. Cipla Ltd"
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Packing</label>
                    <input 
                      value={productForm.packing} 
                      onChange={e => setProductForm({...productForm, packing: e.target.value})}
                      placeholder="e.g. 10x15"
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">UOM</label>
                    <select 
                      value={productForm.uom} 
                      onChange={e => setProductForm({...productForm, uom: e.target.value})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    >
                      <option>Strip</option>
                      <option>Vial</option>
                      <option>Tablet</option>
                      <option>Capsule</option>
                      <option>Bottle</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">HSN Code</label>
                    <input 
                      value={productForm.hsn} 
                      onChange={e => setProductForm({...productForm, hsn: e.target.value})}
                      placeholder="e.g. 3004"
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">GST %</label>
                    <input 
                      type="number"
                      value={productForm.gst} 
                      onChange={e => setProductForm({...productForm, gst: Number(e.target.value)})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Category</label>
                    <select 
                      value={productForm.therapeuticCategory} 
                      onChange={e => setProductForm({...productForm, therapeuticCategory: e.target.value})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    >
                      <option>OTC</option>
                      <option>Antibiotic</option>
                      <option>Analgesic</option>
                      <option>Cardiology</option>
                      <option>Diabetology</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Min Stock Level</label>
                    <input 
                      type="number"
                      value={productForm.minStockLevel} 
                      onChange={e => setProductForm({...productForm, minStockLevel: Number(e.target.value)})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Reorder Level</label>
                    <input 
                      type="number"
                      value={productForm.reorderLevel} 
                      onChange={e => setProductForm({...productForm, reorderLevel: Number(e.target.value)})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
             </div>

             <div className="flex gap-3 pt-8 mt-4 border-t border-slate-100">
                <button onClick={() => setShowProductModal(false)} className="flex-1 h-12 bg-white border border-slate-300 rounded-xl font-black text-[11px] uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={handleSaveProduct} className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">Save Product SKU</button>
             </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="font-black text-base uppercase mb-4">{confirmDialog.title}</h3>
            <p className="text-xs font-bold text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-5 py-2 text-xs font-black uppercase">Cancel</button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }}
                className="px-6 py-2 bg-red-600 text-white text-xs font-black uppercase rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </EnterpriseLayout>
  );
};

export default StrategicPOS;
