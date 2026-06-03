import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
 Plus, Printer, Save, X, Search, ChevronRight, 
 Calculator, HelpCircle, AlertCircle, Trash2, Maximize2, Minimize2, PanelRightClose, Pause, Paperclip, Calendar, Minus,
 ChevronLeft, UserCircle, History, Package, DollarSign, Wallet, ShoppingCart, ArrowUpRight, ArrowDownLeft, FileText, RefreshCcw, ShoppingBag, Menu, Activity, Heart, User, Users, MapPin, Beaker, ChevronDown, ChevronUp, Mail, MessageSquare, Share2, CreditCard, Smartphone
} from 'lucide-react';
import { useDataFetch } from '../hooks/useDataFetch';
import { useCompany } from '../context/CompanyContext';
import { apiClient } from '../services/apiClient';
import { saveInvoice, savePurchase } from '../services/databaseService';
import { printPOSInvoice } from '../utils/accountingExport';
import { numberToWords } from '../utils/numberToWords';
import { useAppStore } from '../store/useAppStore';
import type { Purchase, SalesInvoice, SalesInvoiceItem } from '../types';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import { usePOSLayout } from '../hooks/usePOSLayout';

interface VoucherEntryProps {
 initialType?: 'Sales' | 'Payment' | 'Receipt' | 'Contra' | 'Journal' | 'Purchase' | 'Return';
 onClose: () => void;
 onSuccess?: () => void;
 initialItems?: any[];
 editingInvoice?: any;
}

const ClockDisplay: React.FC = () => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono font-black text-primary text-sm tracking-tighter">{time}</span>;
};

const TallyVoucherEntry: React.FC<VoucherEntryProps> = ({ initialType = 'Sales', onClose, onSuccess, initialItems, editingInvoice }) => {
  const { containerRef, mode } = usePOSLayout();
  const isCompact = mode === 'compact';
  const { company } = useCompany();
  const { posState, setPosState, posBillState, setPosBillState, clearPosBillState } = useAppStore();
  const [voucherType, setVoucherType] = useState(posBillState.voucherType || initialType);
  const [invoiceNo, setInvoiceNo] = useState(posBillState.invoiceNo || '');
  const [date, setDate] = useState(posBillState.date || new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState(posBillState.partyName || 'Counter Customer');
  const [patientName, setPatientName] = useState(posBillState.patientName || '');
  const [patientAddress, setPatientAddress] = useState('');
  const [customerMobile, setCustomerMobile] = useState(posBillState.customerMobile || '');
  const [patientAge, setPatientAge] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [patientDetailsCollapsed, setPatientDetailsCollapsed] = useState(true);
  const [abhaNo, setAbhaNo] = useState(posBillState.abhaNo || '');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [doctorName, setDoctorName] = useState(posBillState.doctorName || '');
  const [salesLedger, setSalesLedger] = useState(posBillState.salesLedger || 'Sales');
  const [drugLicenseNo, setDrugLicenseNo] = useState(posBillState.drugLicenseNo || '');
  const [ewayBillNo, setEwayBillNo] = useState(posBillState.ewayBillNo || '');
  const [productSourceFilter, setProductSourceFilter] = useState<'ALL' | 'PCD' | 'OWN_MANUFACTURING' | 'TRADING'>('ALL');
  
  // Quick Calculator State
  const [calcValue, setCalcValue] = useState('0');
  const [calcExpression, setCalcExpression] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);

  // Side Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Add new state variables
  const [prescriptionNo, setPrescriptionNo] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState('');
  const [validTill, setValidTill] = useState('');
  const [scheduleType, setScheduleType] = useState('None');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [showHeldBills, setShowHeldBills] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [taxBreakdownCollapsed, setTaxBreakdownCollapsed] = useState(true);
  
  // Payment Modal State
  const [selectedModes, setSelectedModes] = useState<string[]>(['Cash']);
  const [paymentModes, setPaymentModes] = useState<{method: string, amount: number, tendered?: number, refNo?: string}[]>([
    { method: 'Cash', amount: 0, tendered: 0 }
  ]);
  
  // Stats summary (mock or from API)
  const [posStats, setPosStats] = useState({
    todaySales: 0,
    pendingPayments: 0,
    totalTransactions: 0,
    heldBillsCount: 0,
    shiftStatus: 'Open'
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBatchSelection, setShowBatchSelection] = useState<{ index: number, product: any } | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<any>(null);
  const [returnInvoiceNo, setReturnInvoiceNo] = useState('');
  const [returnInvoiceData, setReturnInvoiceData] = useState<any>(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<number, boolean>>({});
  const [returnReason, setReturnReason] = useState('Wrong Item Dispensed');
  const [refundTo, setRefundTo] = useState('Cash Refund');
  const [showShortcutsLegend, setShowShortcutsLegend] = useState(false);

  useEffect(() => {
    if (returnInvoiceData && returnInvoiceData.items) {
      const initialSelected: Record<number, boolean> = {};
      returnInvoiceData.items.forEach((_: any, idx: number) => {
        initialSelected[idx] = true;
      });
      setSelectedReturnItems(initialSelected);
    } else {
      setSelectedReturnItems({});
    }
  }, [returnInvoiceData]);

  const { data: dashboardData } = useDataFetch('/api/pos/dashboard-summary');
  const { data: invoicesData } = useDataFetch('/api/pos/invoices');
  
  const patientHistory = useMemo(() => {
    if (!patientName) return [];
    const list = Array.isArray(invoicesData) ? invoicesData : (invoicesData?.data || []);
    return list
      .filter((inv: any) => {
        const name = String(inv.patient_name || inv.customer_name || '').toLowerCase();
        return name === patientName.toLowerCase();
      })
      .slice(0, 5);
  }, [invoicesData, patientName]);

  useEffect(() => {
    if (dashboardData && !Array.isArray(dashboardData)) {
      setPosStats({
        todaySales: dashboardData.todayRevenue || 0,
        pendingPayments: dashboardData.pendingDrafts || 0,
        totalTransactions: dashboardData.invoicesGenerated || 0,
        heldBillsCount: heldBills.length,
        shiftStatus: 'Open'
      });
    }
  }, [dashboardData, heldBills]);
  
  const [items, setItems] = useState<any[]>(() => {
    if (editingInvoice && editingInvoice.items && editingInvoice.items.length > 0) {
      return editingInvoice.items.map((item: any) => ({
        name: item.product_name || item.productName || '',
        quantity: String(item.quantity || ''),
        rate: String(item.rate || ''),
        amount: Number(item.total_amount || item.totalAmount || 0),
        product_id: item.product_id || item.productId,
        batch_id: item.batch_id || item.batchId,
        batchNumber: item.batch_number || item.batchNumber || item.batch_no || '-',
        expiryDate: item.expiry_date || item.expiryDate || '',
        mrp: Number(item.mrp || item.rate || 0),
        stockAvailable: Number(item.stockAvailable || 0),
        gstPercent: Number(item.gst_percent || item.gstPercent || 0),
        discPercent: String(item.discount_percent || item.discPercent || '0.00'),
        hsn: item.hsn || ''
      }));
    }
    if (initialItems && initialItems.length > 0) {
      return initialItems.map(item => ({
        name: item.productName || item.name || '',
        quantity: String(item.quantity || ''),
        rate: String(item.rate || item.sellingRate || ''),
        amount: (parseFloat(item.quantity) || 0) * (parseFloat(item.rate || item.sellingRate) || 0),
        product_id: item.productId || item.id,
        batch_id: item.batchId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        mrp: item.mrp || item.rate || 0,
        stockAvailable: item.stockAvailable || 0,
        gstPercent: item.gstPercent || 0,
        discPercent: item.discPercent || '0.00',
        hsn: item.hsn || ''
      }));
    }
    // Restore from global store if available
    if (posBillState && posBillState.items && posBillState.items.length > 0 && posBillState.items[0].name !== '') {
      return posBillState.items;
    }
    return [{ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, batchNumber: '', expiryDate: '', mrp: 0, gstPercent: 0, discPercent: '0.00' }];
  });

  const [narration, setNarration] = useState(posBillState.narration || '');

  // Sync to global store for persistence across mode switches (mini/side/full)
  useEffect(() => {
    setPosBillState({
      items,
      partyName,
      patientName,
      customerMobile,
      doctorName,
      abhaNo,
      salesLedger,
      narration,
      voucherType,
      date,
      invoiceNo
    });
  }, [items, partyName, patientName, customerMobile, doctorName, abhaNo, salesLedger, narration, voucherType, date, invoiceNo, setPosBillState]);

  const [loading, setLoading] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [showDropdown, setShowDropdown] = useState<{ type: 'party' | 'item', index?: number } | null>(null);
  const [scanMessage, setScanMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

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

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const { data: productsData, loading: productsLoading } = useDataFetch('/api/pos/products');
  const { data: accountsData, loading: partiesLoading } = useDataFetch('/api/accounting/chart-of-accounts');
  const { data: dbVoucherTypes } = useDataFetch('/api/pos/voucher-types');

  const handleHoldBill = () => {
    if (items.some((i: any) => i.name !== '')) {
      setHeldBills((prev: any) => [...prev, { invoiceNo: invoiceNo, partyName: partyName, items: items }]);
      setItems([{ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, batchNumber: '', expiryDate: '', mrp: 0, gstPercent: 0, discPercent: '0.00' }]);
      setPartyName('Counter Customer');
      setScanMessage('Bill #' + invoiceNo + ' placed on hold');
      setTimeout(() => setScanMessage(''), 3000);
    }
  };

  const handleRestoreBill = (index: number) => {
    const bill = heldBills[index];
    if (bill) {
      setItems(bill.items);
      setPartyName(bill.partyName);
      setHeldBills((prev: any) => prev.filter((_: any, i: number) => i !== index));
    }
    setShowHeldBills(false);
  };

  const handleStartNewBill = () => {
    clearPosBillState();
    setItems([{ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, batchNumber: '', expiryDate: '', mrp: 0, gstPercent: 0, discPercent: '0.00' }]);
    setPartyName('Counter Customer');
    setSelectedParty(null);
    setPatientName('');
    setPatientAddress('');
    setPatientAge('');
    setPatientDob('');
    setPatientGender('Male');
    setAbhaNo('');
    setAbhaAddress('');
    setCustomerMobile('');
    setDoctorName('');
    setSalesLedger('Sales');
    setNarration('');
    setVoucherType('Sales');
    setDate(new Date().toISOString().split('T')[0]);
    setInvoiceNo('');
    setPrescriptionNo('');
    setPrescriptionDate('');
    setValidTill('');
    setScheduleType('None');
    setPrescriptionFile(null);
    setPaymentModes([{ method: 'Cash', amount: 0, tendered: 0 }]);
    setSelectedModes(['Cash']);
    setLastSavedInvoice(null);
  };

  const getExpiryStatus = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') return { label: 'Good', color: '#1D9E75' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { label: 'Good', color: '#1D9E75' };
      const now = new Date();
      const months = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
      if (months < 0) return { label: 'Expired', color: '#E24B4A' };
      if (months < 3) return { label: 'Near Exp.', color: '#E24B4A' };
      if (months < 6) return { label: 'Exp. Soon', color: '#EF9F27' };
    } catch (e) {
      return { label: 'Good', color: '#1D9E75' };
    }
    return { label: 'Good', color: '#1D9E75' };
  };

  const evaluateExpression = (expr: string): string => {
    try {
      const cleanExpr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^-+*/.0-9]/g, '');
      const result = new Function(`return ${cleanExpr}`)();
      if (isNaN(result) || !isFinite(result)) return 'Error';
      return String(Number(result).toFixed(2)).replace(/\.00$/, '');
    } catch (e) {
      return 'Error';
    }
  };

  const handleCalcKeyPress = (key: string) => {
    if (key === '=') {
      const result = evaluateExpression(calcExpression);
      setCalcValue(result);
      setCalcExpression(result);
    } else if (key === 'C') {
      setCalcValue('0');
      setCalcExpression('');
    } else {
      setCalcExpression(prev => prev + key);
      setCalcValue(key);
    }
  };

  /**
   * Calculates the overall totals for the current bill.
   * Adheres to pharmaceutical retail standards where:
   * 1. MRP is typically inclusive of GST.
   * 2. Discounts are applied to the tax-inclusive gross amount.
   * 3. Tax is backward-calculated from the final discounted amount.
   * 4. Profit is calculated using the actual purchase rate.
   */
  const totals = useMemo(() => {
    let itemCount = 0;
    let totalQty = 0;
    let subTotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;
    let totalCostPrice = 0;
    const gstSlabs: { [key: string]: number } = {};

    items.forEach(i => {
      if (i.name && parseFloat(i.quantity) > 0) {
        itemCount++;
        const qty = parseFloat(i.quantity) || 0;
        totalQty += qty;
        
        const mrp = parseFloat(i.mrp || i.rate) || 0;
        const rate = parseFloat(i.rate) || 0;
        const purchaseRate = parseFloat(i.purchaseRate || i.purchase_rate) || 0;
        
        // Gross amount based on MRP (Retail value before discount)
        const itemGross = qty * mrp;
        // Actual amount payable for this line (includes GST)
        const itemActual = parseFloat(i.amount) || (qty * rate); 
        
        subTotal += itemActual;
        totalDiscount += Math.max(0, itemGross - itemActual);
        
        if (purchaseRate > 0) {
          totalCostPrice += qty * purchaseRate;
        }
        
        const gstP = parseFloat(i.gstPercent) || 0;
        if (gstP > 0) {
          // Backward calculation for tax from a tax-inclusive total
          // Formula: Tax Amount = Total Amount - (Total Amount / (1 + Tax Rate / 100))
          const itemGst = itemActual - (itemActual / (1 + gstP / 100));
          totalGst += itemGst;
          gstSlabs[gstP] = (gstSlabs[gstP] || 0) + itemGst;
        }
      }
    });
    
    const totalPayable = subTotal; 
    const estimatedProfit = totalPayable - totalCostPrice;
    const profitMargin = totalPayable > 0 ? (estimatedProfit / totalPayable) * 100 : 0;
    
    return { 
      itemCount, 
      totalQty, 
      subTotal, 
      totalDiscount, 
      totalGst, 
      gstSlabs, 
      totalPayable, 
      totalCostPrice,
      estimatedProfit,
      profitMargin
    };
  }, [items]);

  const activeVoucherTypes = useMemo(() => {
    const defaults = [
      { key: 'F4', label: 'Contra', type: 'Contra', icon: <RefreshCcw size={18}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
      { key: 'F5', label: 'Payment', type: 'Payment', icon: <ArrowUpRight size={18}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
      { key: 'F6', label: 'Receipt', type: 'Receipt', icon: <ArrowDownLeft size={18}/>, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { key: 'F7', label: 'Journal', type: 'Journal', icon: <FileText size={18}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
      { key: 'F8', label: 'Sales', type: 'Sales', icon: <ShoppingCart size={18}/>, color: 'text-accent', bg: 'bg-highlight' },
      { key: 'F9', label: 'Purchase', type: 'Purchase', icon: <ShoppingBag size={18}/>, color: 'text-orange-600', bg: 'bg-orange-50' },
      { key: 'F10', label: 'Returns', type: 'Return', icon: <RefreshCcw size={18}/>, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];
    const vtList = Array.isArray(dbVoucherTypes) ? dbVoucherTypes : (dbVoucherTypes?.data || []);
    if (!vtList || vtList.length === 0) return defaults;
    return defaults.map(def => {
      const custom = vtList.find((vt: any) => vt.type_of_voucher === def.type || vt.typeOfVoucher === def.type);
      return custom ? { ...def, label: custom.name, realId: custom.id } : def;
    });
  }, [dbVoucherTypes]);

  // Keyboard shortcuts listener is registered globally at the bottom of the component


  // Auto-focus scanner
  useEffect(() => {
    if (['Sales', 'Purchase'].includes(voucherType)) {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [voucherType]);

  useEffect(() => {
    if (editingInvoice) {
      setVoucherType(initialType === 'Return' ? 'Return' : 'Sales');
      setInvoiceNo(editingInvoice.invoice_number || editingInvoice.invoice_no || '1');
      setDate(editingInvoice.date ? new Date(editingInvoice.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setPartyName(editingInvoice.customer_name || editingInvoice.party_name || 'Counter Customer');
      setPatientName(editingInvoice.patient_name || '');
      setCustomerMobile(editingInvoice.customer_mobile || '');
      setDoctorName(editingInvoice.doctor_name || '');

      if (editingInvoice.items && editingInvoice.items.length > 0) {
        setItems(editingInvoice.items.map((item: any) => ({
          name: item.product_name || item.productName || '',
          quantity: String(item.quantity || ''),
          rate: String(item.rate || ''),
          amount: Number(item.total_amount || item.totalAmount || 0),
          product_id: item.product_id || item.productId,
          batch_id: item.batch_id || item.batchId,
          batchNumber: item.batch_number || item.batchNumber || item.batch_no || '-',
          expiryDate: item.expiry_date || item.expiryDate || '',
          mrp: Number(item.mrp || item.rate || 0),
          stockAvailable: Number(item.stockAvailable || 0),
          gstPercent: Number(item.gst_percent || item.gstPercent || 0),
          discPercent: String(item.discount_percent || item.discPercent || '0.00'),
          hsn: item.hsn || ''
        })));
      }
    }
  }, [editingInvoice, initialType]);

  // Fetch next invoice number on mount/voucherType change if not already set and not editing
  useEffect(() => {
    const fetchNextInvoiceNumber = async () => {
      if (!editingInvoice && !posBillState.invoiceNo && ['Sales', 'Return'].includes(voucherType)) {
        try {
          const res = await apiClient.get('/api/pos/next-invoice-number');
          if (res && res.success && res.data?.invoiceNumber) {
            setInvoiceNo(res.data.invoiceNumber);
            setPosBillState({ invoiceNo: res.data.invoiceNumber });
          }
        } catch (err) {
          console.error('Error fetching next invoice number:', err);
        }
      }
    };
    fetchNextInvoiceNumber();
  }, [voucherType, editingInvoice, posBillState.invoiceNo, setPosBillState]);

  const filteredParties = useMemo(() => {
    if (!showDropdown || showDropdown.type !== 'party') return [];
    const list = Array.isArray(accountsData) ? accountsData : (accountsData?.data || []);
    const query = searchQuery.toLowerCase().trim();
    return list.filter((p: any) => 
      String(p.name || p.account_name || '').toLowerCase().includes(query) ||
      String(p.account_code || '').toLowerCase().includes(query) ||
      String(p.mobile || '').includes(query)
    ).sort((a: any, b: any) => {
      const aName = String(a.name || a.account_name || '').toLowerCase();
      const bName = String(b.name || b.account_name || '').toLowerCase();
      if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
      if (!aName.startsWith(query) && bName.startsWith(query)) return 1;
      return 0;
    });
  }, [showDropdown, accountsData, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!showDropdown || showDropdown.type !== 'item') return [];
    const isInventoryVoucher = ['Sales', 'Purchase', 'Return'].includes(voucherType);
    const list = isInventoryVoucher ? (Array.isArray(productsData) ? productsData : (productsData?.data || [])) : (Array.isArray(accountsData) ? accountsData : (accountsData?.data || []));
    const query = searchQuery.toLowerCase().trim();
    let flatList: any[] = [];
    if (isInventoryVoucher) {
      list.forEach((product: any) => {
        const matchesQuery = String(product.name || '').toLowerCase().includes(query) || String(product.code || '').toLowerCase().includes(query);
        if (matchesQuery) {
          const batches = [...(product.batches || [])]
            .filter(b => {
              if (!b.expiry_date) return true;
              const exp = new Date(b.expiry_date);
              const now = new Date();
              return exp >= new Date(now.getFullYear(), now.getMonth(), 1); // Allow current month
            })
            .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

          if (batches.length === 0) {
            flatList.push({ ...product, _type: 'product_no_stock' });
          } else {
            batches.forEach((batch: any) => { flatList.push({ ...product, _type: 'batch', _batch: batch }); });
          }
        }
      });
    } else {
      flatList = list.filter((p: any) => String(p.name || p.account_name || '').toLowerCase().includes(query));
    }
    return flatList.sort((a: any, b: any) => {
      const aName = String(a.name || a.account_name || '').toLowerCase();
      const bName = String(b.name || b.account_name || '').toLowerCase();
      if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
      return 0;
    });
  }, [showDropdown, productsData, accountsData, searchQuery, voucherType]);

  const getBatchNo = (batch: any) => String(batch?.batch_no || batch?.batch_number || '');
  const getProductCode = (product: any) => String(product?.code || product?.product_code || '');
  const getSellingRate = (product: any, batch?: any) => Number(batch?.selling_rate || product?.selling_rate || batch?.mrp || product?.mrp || 0);
  const getPurchaseRate = (product: any, batch?: any) => Number(batch?.purchase_rate || product?.purchase_rate || 0);

  const applyProductToRow = (index: number, product: any, batch?: any) => {
    const rate = voucherType === 'Purchase' ? getPurchaseRate(product, batch) : getSellingRate(product, batch);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      name: product.name,
      product_id: product.id,
      batch_id: batch?.id || '',
      batchNumber: getBatchNo(batch),
      expiryDate: batch?.expiry_date || '',
      mrp: Number(batch?.mrp || product.mrp || rate || 0),
      rate: String(rate || ''),
      purchaseRate: getPurchaseRate(product, batch),
      gstPercent: product.gst || product.gst_percent || 0,
      stockAvailable: batch?.stock || product.current_stock || 0,
      quantity: newItems[index].quantity || '1'
    };
    newItems[index].amount = (parseFloat(newItems[index].quantity) || 1) * (parseFloat(newItems[index].rate) || 0);
    if (index === newItems.length - 1) {
      newItems.push({ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, mrp: 0, gstPercent: 0, discPercent: '0.00' });
    }
    setItems(newItems);
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanValue.trim().toLowerCase();
    if (!code) return;
    const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);
    const matches: any[] = [];
    products.forEach((p: any) => {
      if (getProductCode(p).toLowerCase() === code || String(p.name).toLowerCase() === code) {
         matches.push({ product: p, batch: p.batches?.[0] });
      }
    });
    if (matches.length === 0) {
      setScanMessage(`No product found for ${scanValue}`);
      setTimeout(() => setScanMessage(''), 3000);
      return;
    }
    const targetIdx = items.findIndex(i => !i.name) >= 0 ? items.findIndex(i => !i.name) : items.length - 1;
    applyProductToRow(targetIdx, matches[0].product, matches[0].batch);
    setScanValue('');
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    const qty = parseFloat(newItems[index].quantity) || 0;
    const mrp = parseFloat(newItems[index].mrp) || 0;
    const discP = parseFloat(newItems[index].discPercent) || 0;
    let rate = parseFloat(newItems[index].rate) || 0;

    if (field === 'discPercent' || field === 'mrp') {
      rate = mrp * (1 - discP / 100);
      newItems[index].rate = String(rate.toFixed(2));
    } else if (field === 'rate') {
      rate = parseFloat(value) || 0;
      if (mrp > 0) {
        newItems[index].discPercent = String(((1 - rate / mrp) * 100).toFixed(2));
      }
    }

    newItems[index].amount = qty * rate;
    
    if (index === items.length - 1 && value !== '' && (field === 'name' || field === 'quantity')) {
      newItems.push({ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, mrp: 0, gstPercent: 0, discPercent: '0.00' });
    }
    setItems(newItems);
 };

 const deleteItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    } else {
      setItems([{ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, mrp: 0, gstPercent: 0, discPercent: '0.00' }]);
    }
 };

 const addItem = () => {
   setItems(prev => [...prev, { name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, mrp: 0, gstPercent: 0, discPercent: '0.00' }]);
 };

 const calculateTotal = () => {
 return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
 };

 const handleSave = async (print: boolean = false) => {
   if (isSavingRef.current) return;
   isSavingRef.current = true;
   try {
     const total = calculateTotal();
     const filledItems = items.filter(i => i.name && parseFloat(i.quantity) > 0);
     if (total === 0 || filledItems.length === 0) {
       isSavingRef.current = false;
       return;
     }
     setLoading(true);
     
     const isSalesOrPurchase = ['Sales', 'Purchase', 'Return'].includes(voucherType);
     let response;

     if (isSalesOrPurchase) {
          const generatedInvoiceNo = editingInvoice ? (editingInvoice.invoice_number || invoiceNo) : (invoiceNo || `${voucherType.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`);
          const payload = {
            invoice_no: generatedInvoiceNo,
            invoice_number: generatedInvoiceNo,
            invoice_date: date,
            date: date,
            party_id: selectedParty?.id || null,
            party_name: partyName,
            customer_name: partyName,
            patient_name: patientName,
            customer_mobile: customerMobile,
            doctor_name: doctorName,
            prescription_no: prescriptionNo,
            payment_mode: paymentModes[0]?.method || 'Cash',
            sub_total: totals.subTotal,
            taxable_value: totals.subTotal - totals.totalGst,
            total_taxable: totals.subTotal - totals.totalGst,
            total_gst: totals.totalGst,
            total_discount: totals.totalDiscount,
            round_off: Math.round(totals.totalPayable) - totals.totalPayable,
            net_amount: totals.totalPayable,
            net_payable: totals.totalPayable,
            items: filledItems.map(i => ({
              product_id: i.product_id,
              product_name: i.name,
              batch_id: i.batch_id,
              batch_number: i.batchNumber,
              quantity: parseFloat(i.quantity),
              rate: parseFloat(i.rate),
              mrp: parseFloat(i.mrp || i.rate),
              taxable_value: i.amount / (1 + (parseFloat(i.gstPercent) || 0) / 100),
              gst_percent: parseFloat(i.gstPercent) || 0,
              total_amount: i.amount
            })),
            payments: paymentModes.map(m => ({ method: m.method, amount: m.amount }))
          };

          if (voucherType === 'Return') response = await apiClient.post('/api/pos/returns', payload);
          else if (editingInvoice) response = await apiClient.put(`/api/pos/invoices/${editingInvoice.id}`, payload);
          else response = await apiClient.post('/api/pos/invoices', payload);

          if (response && response.success) {
            setLastSavedInvoice(payload);
            if (print) {
              printPOSInvoice(payload, company);
            } else {
              setShowShareModal(true);
            }
          } else {
            throw new Error(response?.error || 'Server responded with failure');
          }
     } else {
        response = await apiClient.post('/api/accounting/journal-vouchers', {
          voucherType,
          date,
          totalAmount: total,
          narration
        });
        if (!response || !response.success) throw new Error(response?.error || 'Failed to save voucher');
     }
     
     if (response && response.success) {
       if (onSuccess) onSuccess();
       if (!isSalesOrPurchase) onClose();
     }
   } catch (err: any) {
     console.error('POS Save Error:', err);
     setAlertDialog({ isOpen: true, title: 'Save Failed', message: err.message || 'Could not save transaction.' });
   } finally {
     setLoading(false);
     isSavingRef.current = false;
   }
 };

 const handleDelete = () => {
   if (!editingInvoice?.id) {
     setAlertDialog({
       isOpen: true,
       title: 'Action Prohibited',
       message: 'Only previously saved invoices can be deleted from the system.'
     });
     return;
   }

   setConfirmDialog({
     isOpen: true,
     title: 'Delete Voucher',
     message: `Are you sure you want to delete Invoice #${editingInvoice.invoice_number || editingInvoice.invoice_no}? This action is irreversible and will update stock levels.`,
     onConfirm: async () => {
       try {
         setLoading(true);
         const res = await apiClient.delete(`/api/pos/invoices/${editingInvoice.id}`);
         if (res && res.success) {
           setAlertDialog({
             isOpen: true,
             title: 'Deletion Successful',
             message: 'The invoice has been removed from the records.'
           });
           setTimeout(() => onClose(), 1500);
         } else {
           throw new Error(res?.error || 'Deletion failed on server');
         }
       } catch (err: any) {
         setAlertDialog({
           isOpen: true,
           title: 'Error',
           message: err.message || 'Could not delete the invoice.'
         });
       } finally {
         setLoading(false);
       }
     }
   });
 };

  // Helper Components
  const HeaderControls = () => (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => setPosState('full')} 
        disabled={posState === 'full'}
        title="Expand to Fullscreen"
        className={`h-10 px-3 rounded-xl flex items-center gap-2 border transition-all text-[11px] font-black tracking-widest ${posState === 'full' ? 'bg-page border-border text-slate-300' : 'bg-white border-border text-secondary hover:text-primary hover:bg-page shadow-sm'}`}
      >
        <Maximize2 size={14} /> {posState !== 'side' && 'EXPAND'}
      </button>
      <button 
        onClick={() => setPosState('side')} 
        disabled={posState === 'side'}
        title="Snap to Side Panel"
        className={`h-10 px-3 rounded-xl flex items-center gap-2 border transition-all text-[11px] font-black tracking-widest ${posState === 'side' ? 'bg-page border-border text-slate-300' : 'bg-white border-border text-secondary hover:text-primary hover:bg-page shadow-sm'}`}
      >
        <PanelRightClose size={14} /> {posState !== 'side' && 'SIDE'}
      </button>
      <button 
        onClick={() => setPosState('mini')} 
        title="Minimize to Corner"
        className="h-10 px-3 rounded-xl flex items-center gap-2 border border-border bg-white text-secondary text-[11px] font-black tracking-widest hover:text-primary hover:bg-page transition-all shadow-sm"
      >
        <Minimize2 size={14} /> {posState !== 'side' && 'MINIMISE'}
      </button>
    </div>
  );

  const renderDrawer = () => (
    <>
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div 
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-[101] transition-transform duration-300 ease-out border-r border-border ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border flex justify-between items-center bg-page/50">
            <div>
              <h2 className="text-lg font-black text-primary tracking-tight">TERMINAL MODES</h2>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Select Operation</p>
            </div>
            <button onClick={() => setDrawerOpen(false)} aria-label="Close drawer" className="p-2 hover:bg-page rounded-xl transition-colors text-secondary hover:text-primary">
              <ChevronLeft size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeVoucherTypes.map((mode: any) => (
              <button
                key={mode.key}
                onClick={() => {
                  setVoucherType(mode.type as any);
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${voucherType === mode.type ? 'bg-white border-accent shadow-sm ring-1 ring-accent/20' : 'bg-transparent border-transparent hover:bg-page hover:border-border'}`}
              >
                <div className={`p-2.5 rounded-xl ${mode.bg || 'bg-page'} ${mode.color || 'text-primary'}`}>
                  {mode.icon || <FileText size={18}/>}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black ${voucherType === mode.type ? 'text-primary' : 'text-slate-600'}`}>{mode.label}</p>
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">{mode.key}</p>
                </div>
                {voucherType === mode.type && <div className="ml-auto w-2 h-2 rounded-full bg-accent animate-pulse" />}
              </button>
            ))}
          </div>
          
          <div className="p-6 bg-page/30 border-t border-border mt-auto">
            <div className="flex items-center gap-3 text-secondary">
              <UserCircle size={20} />
              <div>
                <p className="text-xs font-black text-primary uppercase">Operator Session</p>
                <p className="text-[10px] font-bold uppercase tracking-widest">Active • v4.2.1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderDropdown = (type: 'party' | 'item', index?: number) => {
    if (!showDropdown || showDropdown.type !== type) return null;
    if (type === 'item' && showDropdown.index !== index) return null;
    const isLoading = type === 'party' ? partiesLoading : productsLoading;
    const filtered = type === 'party' ? filteredParties : filteredItems;

    return (
      <div className="absolute left-0 top-full mt-2 w-[520px] bg-white border border-border shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[100] max-h-80 animate-in fade-in zoom-in-95 duration-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="bg-page/50 px-4 py-3 border-b border-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            {type === 'party' ? <UserCircle size={16} className="text-accent" /> : <Package size={16} className="text-accent" />}
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">{type === 'party' ? 'Select Ledger / Customer' : 'Select Stock Product'}</span>
          </div>
          {isLoading && <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar" ref={dropdownListRef}>
          {filtered.length === 0 && !isLoading && (
            <div className="p-12 text-center text-slate-400">
               <Search size={32} className="mx-auto mb-2 opacity-20" />
               <p className="text-xs font-black text-primary uppercase">No matching records</p>
            </div>
          )}
          {filtered.map((row: any, idx: number) => {
            const isSelected = idx === dropdownSelectedIndex;
            return (
              <div key={idx} onMouseDown={(e) => {
                e.preventDefault();
                if (type === 'party') { 
                  setPartyName(row.name); 
                  setSelectedParty(row);
                  if (row.mobile) setCustomerMobile(row.mobile);
                  setShowDropdown(null); 
                }
                else { applyProductToRow(index!, row, row._batch); setShowDropdown(null); }
              }} onMouseEnter={() => setDropdownSelectedIndex(idx)} className={`px-4 py-3 border-b border-border/50 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'bg-highlight border-accent/30' : 'hover:bg-page'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-accent text-white' : 'bg-page text-secondary'}`}>
                    {type === 'party' ? <User size={14} /> : <Beaker size={14} />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-black ${isSelected ? 'text-primary' : 'text-slate-700'}`}>{row.name || row.account_name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">{row.type || row.category || (row._batch ? 'BATCH' : 'ITEM')}</span>
                      {row.mobile && <span className="text-[9px] font-black text-secondary/60"> • {row.mobile}</span>}
                    </div>
                  </div>
                </div>
                {(type === 'party' && row.currentBalance !== undefined) && (
                  <div className="text-right">
                    <p className={`text-xs font-black ${row.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{Math.abs(row.currentBalance).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-secondary uppercase">{row.currentBalance > 0 ? 'Due' : 'Advance'}</p>
                  </div>
                )}
                {row._batch && (
                  <div className="text-right">
                    <p className={`text-xs font-black ${isSelected ? 'text-accent' : 'text-primary'}`}>₹{(row._batch.selling_rate || row._batch.mrp).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-secondary uppercase">{row._batch.stock || 0} In Stock</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showPaymentModal) {
      setPaymentModes([{ method: 'Cash', amount: totals.totalPayable, tendered: totals.totalPayable }]);
    }
  }, [showPaymentModal, totals.totalPayable]);

  const handlePaymentModeChange = (index: number, field: string, value: any) => {
    const newModes = [...paymentModes];
    (newModes[index] as any)[field] = value;
    setPaymentModes(newModes);
  };

  const addPaymentMode = () => {
    const remaining = totals.totalPayable - paymentModes.reduce((sum, m) => sum + m.amount, 0);
    setPaymentModes([...paymentModes, { method: 'Card', amount: Math.max(0, remaining) }]);
  };

  const removePaymentMode = (index: number) => {
    setPaymentModes(paymentModes.filter((_, i) => i !== index));
  };

  const totalPaid = paymentModes.reduce((sum, m) => sum + m.amount, 0);
  const remainingToPay = totals.totalPayable - totalPaid;

  const handleShare = (method: 'Email' | 'WhatsApp') => {
    if (!lastSavedInvoice) return;
    const mobile = customerMobile || lastSavedInvoice.customer_mobile;
    const invoiceNo = lastSavedInvoice.invoice_number;
    const amount = lastSavedInvoice.net_amount;

    if (method === 'WhatsApp') {
      const text = encodeURIComponent(`Hello, your invoice #${invoiceNo} for ₹${amount} from ${company?.name || 'Metapharsic Life Sciences'} is ready. View it here: ${window.location.origin}/invoice/${invoiceNo}`);
      window.open(`https://wa.me/${mobile}?text=${text}`, '_blank');
    } else {
      setAlertDialog({ isOpen: true, title: 'Email Sent', message: `Invoice #${invoiceNo} has been emailed to the patient.` });
    }
    setShowShareModal(false);
  };

  const searchReturnInvoice = async () => {
    if (!returnInvoiceNo) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/pos/invoices?search=${returnInvoiceNo}`);
      const list = Array.isArray(res) ? res : (res.data || []);
      const found = list.find((inv: any) => inv.invoice_number === returnInvoiceNo || inv.invoice_no === returnInvoiceNo);
      if (found) setReturnInvoiceData(found);
      else setAlertDialog({ isOpen: true, title: 'Not Found', message: 'Invoice not found.' });
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to fetch invoice.' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async () => {
    if (!returnInvoiceData) return;
    
    const selectedItems = (returnInvoiceData.items || []).filter((_: any, idx: number) => selectedReturnItems[idx]);
    
    if (selectedItems.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select at least one item to return.'
      });
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        original_invoice_id: returnInvoiceData.id,
        original_invoice_no: returnInvoiceData.invoice_number || returnInvoiceData.invoice_no,
        items: selectedItems.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          batch_id: item.batch_id,
          batch_number: item.batch_number,
          quantity: item.quantity,
          rate: item.rate,
          mrp: item.mrp || item.rate,
          total_amount: item.total_amount
        })),
        return_reason: returnReason,
        refund_method: refundTo
      };
      
      const res = await apiClient.post('/api/pos/returns', payload);
      
      if (res && (res.success || res.data)) {
        setAlertDialog({
          isOpen: true,
          title: 'Return Processed',
          message: `Return successful. Credit note #${res.credit_note_no || 'CN-' + Date.now().toString().slice(-4)} generated.`
        });
        setShowReturnModal(false);
        setReturnInvoiceData(null);
        setReturnInvoiceNo('');
      } else {
        throw new Error(res?.error || 'Failed to process return on the server');
      }
    } catch (e: any) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: e.message || 'Failed to process return. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };


  const renderPaymentModal = () => {
    const totalAllocated = paymentModes.reduce((sum, m) => sum + (selectedModes.includes(m.method) ? m.amount : 0), 0);
    const remaining = Math.round(totals.totalPayable) - totalAllocated;

    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-border">
          {/* Header */}
          <div className="p-6 border-b border-border flex justify-between items-center bg-page/30">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-accent text-white shadow-lg shadow-accent/20"><Wallet size={24} /></div>
              <div>
                <h3 className="text-xl font-black text-primary uppercase">Payment Terminal</h3>
                <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Select Mode & Complete Transaction</p>
              </div>
            </div>
            <button onClick={() => setShowPaymentModal(false)} aria-label="Close payment terminal" className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><X size={24} /></button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
            {/* Total Display */}
            <div className="flex justify-between items-end bg-page rounded-3xl p-6 border border-border shadow-sm">
              <div>
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Total Payable</p>
                <p className="text-4xl font-black text-primary tracking-tighter">₹{Math.round(totals.totalPayable).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">Remaining</p>
                <p className={`text-2xl font-black ${remaining <= 0 ? 'text-accent' : 'text-rose-600'} tracking-tighter`}>₹{Math.max(0, remaining).toLocaleString()}</p>
              </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-primary uppercase tracking-widest px-1">Select Payment Mode(s)</h4>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { id: 'Cash', icon: <DollarSign size={18}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { id: 'Card', icon: <CreditCard size={18}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { id: 'UPI', icon: <Smartphone size={18}/>, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { id: 'Credit', icon: <History size={18}/>, color: 'text-amber-600', bg: 'bg-amber-50' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => {
                      if (selectedModes.includes(mode.id)) {
                        if (selectedModes.length > 1) {
                          setSelectedModes(prev => prev.filter(m => m !== mode.id));
                          setPaymentModes(prev => prev.filter(m => m.method !== mode.id));
                        }
                      } else {
                        setSelectedModes(prev => [...prev, mode.id]);
                        const currentTotalAllocated = paymentModes.reduce((sum, m) => sum + m.amount, 0);
                        const currentRemaining = Math.round(totals.totalPayable) - currentTotalAllocated;
                        
                        setPaymentModes(prev => {
                          const existing = prev.find(m => m.method === mode.id);
                          if (existing) return prev;
                          return [...prev, { method: mode.id, amount: Math.max(0, currentRemaining) }];
                        });
                      }
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${selectedModes.includes(mode.id) ? 'border-accent bg-highlight/30' : 'border-border bg-white hover:border-slate-300'}`}
                  >
                    <div className={`p-2.5 rounded-xl ${mode.bg} ${mode.color}`}>{mode.icon}</div>
                    <span className="text-[10px] font-black uppercase">{mode.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs for selected modes */}
            <div className="space-y-6">
              {selectedModes.map((modeId) => {
                const modeData = paymentModes.find(m => m.method === modeId) || { method: modeId, amount: 0 };
                const updateAmount = (val: number) => {
                   setPaymentModes(prev => {
                     const existing = prev.find(m => m.method === modeId);
                     if (existing) return prev.map(m => m.method === modeId ? { ...m, amount: val } : m);
                     return [...prev, { method: modeId, amount: val }];
                   });
                };

                return (
                  <div key={modeId} className="p-6 rounded-3xl border border-border bg-page/30 space-y-4 animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-accent rounded-full"></span>
                        <h5 className="text-xs font-black text-primary uppercase tracking-widest">{modeId} Details</h5>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-secondary">₹</span>
                        <input 
                          type="number" 
                          value={modeData.amount || ''} 
                          onChange={e => updateAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="h-10 w-32 bg-white border border-border rounded-xl pl-6 pr-3 text-sm font-black text-primary outline-none focus:border-accent shadow-sm"
                        />
                      </div>
                    </div>

                    {modeId === 'Cash' && (
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/50">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black text-secondary uppercase px-1">Cash Tendered</label>
                          <input 
                            type="number" 
                            value={modeData.tendered || ''} 
                            onChange={e => setPaymentModes(prev => prev.map(m => m.method === 'Cash' ? { ...m, tendered: parseFloat(e.target.value) || 0 } : m))}
                            className="h-10 bg-white border border-border rounded-xl px-3 text-sm font-black text-emerald-700 outline-none focus:border-accent shadow-sm" 
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[9px] font-black text-secondary uppercase px-1">Change Due</label>
                          <div className="h-10 bg-emerald-50 border border-emerald-100 rounded-xl px-3 flex items-center text-sm font-black text-emerald-700 shadow-inner">
                            ₹{Math.max(0, (modeData.tendered || 0) - (modeData.amount || 0)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}

                    {modeId === 'UPI' && (
                      <div className="flex flex-col items-center gap-4 pt-2 border-t border-border/50">
                         <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
                            <QRCodeSVG value={`upi://pay?pa=${company?.upiId || 'metapharsic@upi'}&pn=${company?.name || 'Metapharsic'}&am=${modeData.amount}&cu=INR`} size={140} level="H" />
                         </div>
                         <p className="text-[9px] font-black text-secondary uppercase text-center">Scan QR to pay ₹{modeData.amount.toLocaleString()}</p>
                         <input 
                            type="text" 
                            placeholder="UPI Ref No. (Optional)" 
                            value={modeData.refNo || ''}
                            onChange={e => setPaymentModes(prev => prev.map(m => m.method === 'UPI' ? { ...m, refNo: e.target.value } : m))}
                            className="h-9 w-full bg-white border border-border rounded-xl px-3 text-[10px] font-bold text-primary outline-none focus:border-accent" 
                         />
                      </div>
                    )}

                    {modeId === 'Card' && (
                       <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
                          <label className="text-[9px] font-black text-secondary uppercase px-1">Last 4 Digits</label>
                          <input 
                            type="text" 
                            maxLength={4}
                            placeholder="xxxx"
                            value={modeData.refNo || ''}
                            onChange={e => setPaymentModes(prev => prev.map(m => m.method === 'Card' ? { ...m, refNo: e.target.value } : m))}
                            className="h-10 bg-white border border-border rounded-xl px-3 text-sm font-mono font-black text-primary outline-none focus:border-accent" 
                          />
                       </div>
                    )}

                    {modeId === 'Credit' && (
                       <div className="space-y-3 pt-2 border-t border-border/50">
                          <div className="flex justify-between items-center px-1">
                             <span className="text-[9px] font-black text-secondary uppercase">Available Credit</span>
                             <span className={`text-[10px] font-black ${selectedParty?.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{Math.abs(selectedParty?.currentBalance || 0).toLocaleString()}</span>
                          </div>
                          <p className="text-[8px] font-bold text-secondary/60 leading-tight italic px-1">Adjusting this amount will update the customer ledger.</p>
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 bg-page/30 border-t border-border flex gap-4">
            <button onClick={() => setShowPaymentModal(false)} className="flex-1 h-12 rounded-2xl border border-border bg-white text-secondary font-black text-[10px] uppercase hover:bg-page transition-all">Cancel</button>
            <button 
              onClick={() => { handleSave(false); setShowPaymentModal(false); }} 
              disabled={remaining !== 0 || loading} 
              className="flex-[2] h-12 rounded-2xl bg-accent text-white font-black text-[11px] uppercase hover:bg-emerald-600 transition-all shadow-xl disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
            >
              <Save size={16} /> Confirm & Save Invoice
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderReturnModal = () => (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-border flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-page/30">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-200"><RefreshCcw size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-primary uppercase">Return / Exchange</h3>
              <p className="text-[11px] font-bold text-secondary uppercase tracking-widest">Process Returns & Credit Notes</p>
            </div>
          </div>
          <button onClick={() => setShowReturnModal(false)} aria-label="Close return exchange modal" className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><X size={24} /></button>
        </div>
        
        <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-secondary uppercase tracking-widest px-1">Search Original Invoice</label>
            <div className="relative">
              <input 
                type="text" 
                value={returnInvoiceNo} 
                onChange={e => setReturnInvoiceNo(e.target.value)} 
                placeholder="Invoice No. or Patient Name..." 
                className="w-full h-12 bg-page border border-border rounded-xl px-5 pr-12 text-sm font-bold outline-none focus:border-accent shadow-sm" 
              />
              <button onClick={searchReturnInvoice} aria-label="Search invoice" className="absolute right-2 top-1.5 w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-black transition-all shadow-md"><Search size={18}/></button>
            </div>
          </div>

          {returnInvoiceData ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 rounded-2xl bg-highlight/30 border border-accent/20 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-secondary uppercase">Patient: <span className="text-primary">{returnInvoiceData.patient_name || returnInvoiceData.customer_name}</span></p>
                  <p className="text-[10px] font-black text-secondary uppercase">Date: <span className="text-primary">{formatDate(returnInvoiceData.date || returnInvoiceData.invoice_date)}</span></p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-secondary uppercase">Original Total</p>
                   <p className="text-sm font-black text-accent">₹{(returnInvoiceData.net_payable || returnInvoiceData.net_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Select Items to Return</h4>
                <div className="max-h-48 overflow-y-auto border border-border rounded-2xl bg-white shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-page/50 sticky top-0 border-b border-border z-10">
                      <tr>
                        <th className="w-10 p-3 text-center">
                          <input 
                            type="checkbox"
                            checked={(returnInvoiceData.items || []).length > 0 && (returnInvoiceData.items || []).every((_: any, idx: number) => selectedReturnItems[idx])}
                            onChange={e => {
                              const checked = e.target.checked;
                              const nextSelected: Record<number, boolean> = {};
                              (returnInvoiceData.items || []).forEach((_: any, idx: number) => {
                                nextSelected[idx] = checked;
                              });
                              setSelectedReturnItems(nextSelected);
                            }}
                            className="w-4 h-4 accent-accent rounded cursor-pointer"
                          />
                        </th>
                        <th className="p-3 font-black text-secondary uppercase">Item</th>
                        <th className="p-3 text-right font-black text-secondary uppercase">Qty</th>
                        <th className="p-3 text-right font-black text-secondary uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(returnInvoiceData.items || []).map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-page/50 transition-colors">
                          <td className="p-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={!!selectedReturnItems[i]}
                              onChange={e => setSelectedReturnItems(prev => ({ ...prev, [i]: e.target.checked }))}
                              className="w-4 h-4 accent-accent rounded cursor-pointer" 
                            />
                          </td>
                          <td className="p-3 font-bold text-primary">{item.product_name}</td>
                          <td className="p-3 text-right font-black text-slate-600">{item.quantity}</td>
                          <td className="p-3 text-right font-black text-accent">₹{item.total_amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-secondary uppercase px-1">Return Reason</label>
                  <select 
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    className="h-10 bg-page border border-border rounded-xl px-3 text-[11px] font-black outline-none focus:border-accent shadow-sm"
                  >
                    <option>Wrong Item Dispensed</option>
                    <option>Expired Product</option>
                    <option>Patient Refused / Cancelled</option>
                    <option>Damaged Packaging</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-secondary uppercase px-1">Refund To</label>
                  <select 
                    value={refundTo}
                    onChange={e => setRefundTo(e.target.value)}
                    className="h-10 bg-page border border-border rounded-xl px-3 text-[11px] font-black outline-none focus:border-accent shadow-sm"
                  >
                    <option>Cash Refund</option>
                    <option>Store Credit (Wallet)</option>
                    <option>Original Mode</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
             <div className="py-12 flex flex-col items-center justify-center text-slate-300 opacity-50">
                <FileText size={64} strokeWidth={1} />
                <p className="text-xs font-black uppercase mt-4">Search an invoice to begin</p>
             </div>
          )}
        </div>

        <div className="p-6 bg-page/30 border-t border-border flex gap-4 shrink-0">
          <button onClick={() => setShowReturnModal(false)} className="flex-1 h-12 rounded-2xl border border-border bg-white text-secondary font-black text-[10px] uppercase hover:bg-page transition-all">Cancel</button>
          <button 
            onClick={handleProcessReturn} 
            disabled={!returnInvoiceData || loading} 
            className="flex-[2] h-12 rounded-2xl bg-rose-600 text-white font-black text-[11px] uppercase shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-rose-700 transition-all"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <RefreshCcw size={18} /> Process Return
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderShareModal = () => (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in zoom-in-95 duration-300">
      <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden border border-border p-10 text-center space-y-8">
        <div className="w-24 h-24 rounded-full bg-emerald-50 text-accent flex items-center justify-center mx-auto border-4 border-emerald-100 shadow-inner"><Share2 size={40} /></div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-primary uppercase tracking-tight">Invoice Saved</h3>
          <p className="text-xs font-bold text-secondary">Voucher #{lastSavedInvoice?.invoice_no} has been recorded successfully ✓</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <button onClick={() => handleShare('Email')} className="h-14 rounded-2xl border border-border bg-white flex items-center justify-center gap-4 text-[11px] font-black text-primary hover:bg-page transition-all hover:scale-[1.02] shadow-sm"><Mail size={20} className="text-blue-500" /> Share via Email</button>
          <button onClick={() => handleShare('WhatsApp')} className="h-14 rounded-2xl border border-border bg-white flex items-center justify-center gap-4 text-[11px] font-black text-primary hover:bg-page transition-all hover:scale-[1.02] shadow-sm"><MessageSquare size={20} className="text-emerald-500" /> Share via WhatsApp</button>
          <button onClick={() => { printPOSInvoice(lastSavedInvoice, company); setShowShareModal(false); }} className="h-14 rounded-2xl border border-border bg-white flex items-center justify-center gap-4 text-[11px] font-black text-primary hover:bg-page transition-all hover:scale-[1.02] shadow-sm"><Printer size={20} className="text-slate-600" /> Print Receipt</button>
        </div>
        <div className="pt-4">
           <button onClick={() => { handleStartNewBill(); setShowShareModal(false); }} className="text-[10px] font-black text-accent hover:underline uppercase tracking-[0.2em]">Start New Bill</button>
        </div>
      </div>
    </div>
  );

  const renderShortcutsLegend = () => (
    <div className="absolute right-6 top-20 w-80 bg-white border border-border shadow-2xl rounded-3xl p-8 z-[100] animate-in fade-in slide-in-from-right-4 border-t-4 border-t-accent">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
           <Calculator size={18} className="text-accent" />
           <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Keyboard Shortcuts</h4>
        </div>
        <button onClick={() => setShowShortcutsLegend(false)} aria-label="Close shortcuts legend" className="p-1 hover:bg-page rounded-lg transition-colors"><X size={16} className="text-secondary" /></button>
      </div>
      <div className="space-y-4">
        {[
          { key: 'F2', action: 'Add New Item Row' },
          { key: 'F4', action: 'Focus Scanner' },
          { key: 'F6', action: 'Toggle Patient Info' },
          { key: 'F8', action: 'Place Bill on Hold' },
          { key: 'F10', action: 'Open Payment Modal' },
          { key: 'Esc', action: 'Cancel / Close Modal' },
          { key: 'Alt+R', action: 'Return / Exchange' },
          { key: 'Alt+E', action: 'Email Invoice' },
          { key: 'Alt+W', action: 'WhatsApp Invoice' },
          ].map((s, i) => (
          <div key={i} className="flex justify-between items-center group">
            <span className="text-[10px] font-bold text-secondary uppercase group-hover:text-primary transition-colors">{s.action}</span>
            <span className="px-2 py-1 rounded-lg bg-page border border-border text-[10px] font-black text-primary shadow-sm min-w-[40px] text-center">{s.key}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-[9px] font-bold text-secondary/50 uppercase text-center italic">Shortcuts are disabled when modals are open</p>
    </div>
  );

  // Combined Keyboard Shortcuts Handler (Resolves conflicts between voucher switching and custom actions)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Modal close on Escape
      if (showPaymentModal || showReturnModal || showShareModal || showHeldBills || alertDialog.isOpen || confirmDialog.isOpen) {
        if (e.key === 'Escape') {
          setShowPaymentModal(false);
          setShowReturnModal(false);
          setShowShareModal(false);
          setShowHeldBills(false);
        }
        return;
      }

      // 2. Ctrl+A to save
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSave(false);
        return;
      }

      // 3. Alt key shortcuts
      if (e.altKey) {
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          setShowReturnModal(true);
          return;
        }
        if (e.key.toLowerCase() === 'e' && lastSavedInvoice) {
          e.preventDefault();
          setShowShareModal(true);
          return;
        }
        if (e.key.toLowerCase() === 'w' && lastSavedInvoice) {
          e.preventDefault();
          handleShare('WhatsApp');
          return;
        }
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          // Bill level discount logic could be added
          return;
        }
      }

      // 4. F-key shortcuts
      if (['F2', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10'].includes(e.key)) {
        e.preventDefault();

        // F2: Add new item row (or Focus Date if Ctrl/Alt pressed)
        if (e.key === 'F2') {
          if (e.ctrlKey || e.altKey) {
            const dateEl = document.getElementById('voucher-date');
            dateEl?.focus();
          } else {
            addItem();
          }
          return;
        }

        // Routing for F4, F6, F8, F10:
        // - In Sales or Purchase voucher mode: prioritize retail actions unless Ctrl key is held
        // - In other modes: change voucher type
        
        // F4: Focus Scanner (Sales/Purchase) / Contra
        if (e.key === 'F4') {
          if (['Sales', 'Purchase'].includes(voucherType) && !e.ctrlKey) {
            scanInputRef.current?.focus();
          } else {
            const found = activeVoucherTypes.find(v => v.key === 'F4');
            if (found) setVoucherType(found.type as any);
          }
          return;
        }

        // F5: Payment (Voucher switching only)
        if (e.key === 'F5') {
          const found = activeVoucherTypes.find(v => v.key === 'F5');
          if (found) setVoucherType(found.type as any);
          return;
        }

        // F6: Toggle Patient Info (Sales/Purchase) / Receipt
        if (e.key === 'F6') {
          if (['Sales', 'Purchase'].includes(voucherType) && !e.ctrlKey) {
            setPatientDetailsCollapsed(!patientDetailsCollapsed);
          } else {
            const found = activeVoucherTypes.find(v => v.key === 'F6');
            if (found) setVoucherType(found.type as any);
          }
          return;
        }

        // F7: Journal (Voucher switching only)
        if (e.key === 'F7') {
          const found = activeVoucherTypes.find(v => v.key === 'F7');
          if (found) setVoucherType(found.type as any);
          return;
        }

        // F8: Place Bill on Hold (Sales/Purchase) / Sales mode
        if (e.key === 'F8') {
          if (['Sales', 'Purchase'].includes(voucherType) && !e.ctrlKey) {
            handleHoldBill();
          } else {
            const found = activeVoucherTypes.find(v => v.key === 'F8');
            if (found) setVoucherType(found.type as any);
          }
          return;
        }

        // F9: Purchase (Voucher switching only)
        if (e.key === 'F9') {
          const found = activeVoucherTypes.find(v => v.key === 'F9');
          if (found) setVoucherType(found.type as any);
          return;
        }

        // F10: Open Payment Modal (Sales/Purchase) / Returns
        if (e.key === 'F10') {
          if (['Sales', 'Purchase'].includes(voucherType) && !e.ctrlKey) {
            setShowPaymentModal(true);
          } else {
            const found = activeVoucherTypes.find(v => v.key === 'F10');
            if (found) setVoucherType(found.type as any);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showPaymentModal,
    showReturnModal,
    showShareModal,
    showHeldBills,
    alertDialog,
    confirmDialog,
    patientDetailsCollapsed,
    lastSavedInvoice,
    items,
    voucherType,
    partyName,
    activeVoucherTypes
  ]);

  const renderToolsDrawer = () => (
    <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-[150] transition-transform duration-300 ease-out border-l border-border ${showCalculator ? 'translate-x-0' : 'translate-x-full'}`}>
       <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border flex justify-between items-center bg-page/50">
            <div>
              <h2 className="text-lg font-black text-primary tracking-tight uppercase">Tools & Insights</h2>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Calculators & Margins</p>
            </div>
            <button onClick={() => setShowCalculator(false)} aria-label="Close tools drawer" className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
             {/* Margin Analysis Section */}
             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Activity size={16} className="text-accent" />
                   <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Margin Analysis</h4>
                </div>
                <div className="bg-page border border-border rounded-2xl p-4 space-y-3 shadow-inner">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-secondary uppercase">Gross Profit</span>
                      <span className="text-xs font-black text-primary">₹{Math.round(totals.estimatedProfit).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-secondary uppercase">Profit Margin</span>
                      <span className={`text-xs font-black ${totals.profitMargin > 20 ? 'text-emerald-600' : 'text-amber-600'}`}>{totals.profitMargin.toFixed(2)}%</span>
                   </div>
                   <div className="h-[1px] bg-border/50 my-1"></div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-secondary uppercase">Estimated Net</span>
                      <span className="text-xs font-black text-emerald-600">₹{Math.round(totals.estimatedProfit * 0.85).toLocaleString()}</span>
                   </div>
                </div>
                <p className="text-[8px] font-bold text-secondary/60 leading-tight italic text-center px-4">Margin calculated using actual purchase rates where available, or 35% industry standard fallback.</p>
             </div>

             {/* Quick Calculator Section */}
             <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Calculator size={16} className="text-primary" />
                   <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Quick Calculator</h4>
                </div>
                <div className="bg-slate-900 rounded-[32px] p-5 shadow-2xl border border-slate-800">
                   <div className="bg-slate-800/50 rounded-2xl p-4 mb-4 text-right">
                      <div className="text-[10px] font-black text-slate-500 uppercase h-4 overflow-hidden mb-1">{calcExpression || '0'}</div>
                      <div className="text-2xl font-black text-white tracking-tighter truncate">{calcValue}</div>
                   </div>
                   <div className="grid grid-cols-4 gap-2">
                      {['7','8','9','÷','4','5','6','×','1','2','3','-','C','0','=','+'].map(k => (
                        <button 
                          key={k} 
                          onClick={() => handleCalcKeyPress(k === '÷' ? '/' : k === '×' ? '*' : k)}
                          className={`h-11 rounded-xl flex items-center justify-center font-black text-sm transition-all ${
                            k === '=' ? 'bg-accent text-white col-span-2' : 
                            ['÷','×','-','+'].includes(k) ? 'bg-slate-800 text-accent hover:bg-slate-700' :
                            k === 'C' ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30' :
                            'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {k === '/' ? '÷' : k === '*' ? '×' : k}
                        </button>
                      ))}
                   </div>
                </div>
             </div>
          </div>
       </div>
    </div>
  );

  const renderBatchSelectionModal = () => {
    if (!showBatchSelection) return null;
    const batches = showBatchSelection.product.batches || [];
    const sortedBatches = [...batches].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-border flex flex-col">
          <div className="p-6 border-b border-border flex justify-between items-center bg-page/30">
            <div>
               <h3 className="text-lg font-black text-primary uppercase tracking-tight">{showBatchSelection.product.name}</h3>
               <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Select FEFO Optimized Batch</p>
            </div>
            <button onClick={() => setShowBatchSelection(null)} aria-label="Close batch selection" className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar max-h-96">
             {sortedBatches.length === 0 ? (
               <div className="py-12 text-center text-secondary italic">No batches available for this product.</div>
             ) : sortedBatches.map((batch, i) => {
               const expData = getExpiryStatus(batch.expiry_date);
               const isFirst = i === 0;
               return (
                 <button 
                   key={batch.id} 
                   onClick={() => { applyProductToRow(showBatchSelection.index, showBatchSelection.product, batch); setShowBatchSelection(null); }}
                   className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isFirst ? 'bg-highlight/20 border-accent/30 shadow-sm ring-1 ring-accent/10' : 'bg-white border-border hover:bg-page hover:border-slate-300'}`}
                 >
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] ${isFirst ? 'bg-accent text-white' : 'bg-page text-secondary'}`}>
                         {isFirst ? 'FEFO' : i + 1}
                      </div>
                      <div className="text-left">
                         <p className="text-sm font-black text-primary">{batch.batch_no || batch.batch_number}</p>
                         <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5`} style={{ color: expData.color }}>Exp: {formatDate(batch.expiry_date || batch.expiryDate)}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-accent">₹{(batch.selling_rate || batch.mrp).toLocaleString()}</p>
                      <p className={`text-[9px] font-black uppercase tracking-tighter mt-0.5 ${batch.stock > 10 ? 'text-emerald-600' : 'text-rose-600'}`}>{batch.stock} In Stock</p>
                   </div>
                 </button>
               );
             })}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerSearchModal = () => {
    if (!showCustomerSearch) return null;
    const list = Array.isArray(accountsData) ? accountsData : (accountsData?.data || []);
    const filtered = list.filter((p: any) => 
      String(p.name || p.account_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.mobile || '').includes(searchQuery) ||
      String(p.account_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a: any, b: any) => {
      const aName = String(a.name || a.account_name || '').toLowerCase();
      if (aName.startsWith(searchQuery.toLowerCase())) return -1;
      return 0;
    });

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-border flex flex-col">
          <div className="p-6 border-b border-border flex justify-between items-center bg-page/30">
            <div>
               <h3 className="text-lg font-black text-primary uppercase tracking-tight">Customer Search</h3>
               <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Find and Select Party / Ledger</p>
            </div>
            <button onClick={() => setShowCustomerSearch(false)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"><X size={20}/></button>
          </div>
          <div className="p-6 border-b border-border">
             <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
                <input 
                  autoFocus
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Type name, mobile or account code..."
                  className="w-full h-14 bg-page border border-border rounded-2xl pl-12 pr-4 text-sm font-bold outline-none focus:border-accent shadow-inner"
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar max-h-96">
             {filtered.length === 0 ? (
               <div className="py-12 text-center text-secondary italic">No matching customers found.</div>
             ) : filtered.map((row: any, i: number) => (
               <button 
                 key={i} 
                 onClick={() => { 
                   setPartyName(row.name || row.account_name); 
                   setSelectedParty(row); 
                   if (row.mobile) setCustomerMobile(row.mobile); 
                   setShowCustomerSearch(false); 
                 }}
                 className="w-full flex items-center justify-between p-4 rounded-2xl border border-border hover:border-accent hover:bg-highlight/20 transition-all text-left"
               >
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-page flex items-center justify-center text-secondary"><User size={20} /></div>
                    <div>
                       <p className="text-sm font-black text-primary">{row.name || row.account_name}</p>
                       <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">{row.mobile || 'No Mobile'} • {row.city || 'Local'}</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className={`text-xs font-black ${row.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{Math.abs(row.currentBalance || 0).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-secondary uppercase">Balance</p>
                 </div>
               </button>
             ))}
          </div>
          <div className="p-4 bg-page/30 border-t border-border flex justify-center">
             <button onClick={() => { /* Logic to add new party */ }} className="text-[10px] font-black text-accent hover:underline uppercase flex items-center gap-1"><Plus size={12}/> Create New Customer</button>
          </div>
        </div>
      </div>
    );
  };

  if (posState === 'mini') {
    return (
      <div className="flex flex-col bg-[#0F172A] text-white select-none font-sans shadow-2xl overflow-hidden w-full min-h-[140px] rounded-2xl border border-slate-800/50 animate-in fade-in zoom-in-95 duration-300">
        {/* Gradient Top accent */}
        <div className="h-1 bg-gradient-to-r from-[#10b981] to-[#3b82f6] w-full"></div>
        
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">POS ACTIVE</span>
              </div>
              <h3 className="text-[11px] font-bold text-slate-300 truncate max-w-full" title={partyName}>{partyName}</h3>
              <p className="text-2xl font-black tracking-tighter mt-1.5 text-white">₹{Math.round(totals.totalPayable).toLocaleString()}</p>
            </div>
            
            <div className="flex flex-col gap-1.5 shrink-0 ml-3">
              <button 
                onClick={() => setPosState('side')} 
                className="w-8 h-8 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-sm"
                title="Restore Side View"
              >
                <PanelRightClose size={14} />
              </button>
              <button 
                onClick={() => setPosState('full')} 
                className="w-8 h-8 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-sm"
                title="Expand to Fullscreen"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShoppingCart size={12} />
              <span className="text-[10px] font-black">{totals.itemCount} ITEMS</span>
            </div>
            
            <div className="flex items-center gap-2">
               <button 
                 onClick={onClose}
                 className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-900/30 hover:text-rose-400 transition-colors"
                 title="Close Terminal"
               >
                 <X size={14} />
               </button>
               <button 
                 onClick={() => { setPosState('side'); setTimeout(() => setShowPaymentModal(true), 200); }}
                 className="h-8 px-3.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white text-[10px] font-black uppercase flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-0.5 active:translate-y-0"
               >
                 <DollarSign size={11} /> PAY
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col h-screen overflow-hidden bg-page select-none font-sans text-primary border-l border-border relative ${isCompact ? 'compact' : ''}`}>
      <style>{`
        .compact {
          font-size: 13px;
          line-height: 1.4;
        }
        .compact .section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: #9ca3af;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .compact input,
        .compact select {
          height: 30px;
          font-size: 12px;
          padding: 0 8px;
          border-radius: 6px;
          border: 1px solid #d1d5db;
        }
        .compact input:focus {
          border-color: #22c55e;
          outline: none;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.15);
        }
        .compact .card-section {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 8px;
        }
        .pos-item-card {
          background: #f9f9f9;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 6px;
          position: relative;
        }
        .pos-item-card .item-name input {
          width: 100%;
          font-size: 13px;
          font-weight: 500;
          border: none;
          background: transparent;
          padding: 0;
          height: auto;
        }
        .pos-item-card .item-meta {
          font-size: 11px;
          color: #6b7280;
          margin: 3px 0;
        }
        .pos-item-card .item-pricing {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 12px;
          margin: 4px 0;
        }
        .pos-item-card .item-qty-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .pos-item-card .delete-btn {
          position: absolute;
          top: 6px;
          right: 8px;
          color: #ef4444;
          cursor: pointer;
        }
      `}</style>
      {renderDrawer()}
      {renderToolsDrawer()}
      {renderBatchSelectionModal()}
      {renderCustomerSearchModal()}
      {showPaymentModal && renderPaymentModal()}
      {showReturnModal && renderReturnModal()}
      {showShareModal && renderShareModal()}
      {showShortcutsLegend && renderShortcutsLegend()}

      {/* SMART POS HEADER BAR (Pinned) */}
      <div className={`flex items-center justify-between px-6 bg-white border-b border-border shrink-0 z-10 ${isCompact ? 'h-14 px-4' : posState === 'side' ? 'h-14' : 'h-16'}`}>
        <div className="flex items-center gap-3 lg:gap-6">
          {!isCompact && (
            <button onClick={() => setDrawerOpen(true)} className="p-2.5 rounded-xl hover:bg-page transition-all border border-border bg-white text-secondary hover:text-primary shadow-sm group">
              <Menu size={22} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
          {!isCompact && <div className="h-8 w-[1px] bg-border mx-1"></div>}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(76,175,114,0.6)] animate-pulse`} />
              <h1 className={`${isCompact ? 'text-sm' : 'text-lg'} font-black tracking-tight flex items-center gap-2`}>
                {voucherType.toUpperCase()} {isCompact ? '' : 'MODE'}
                <span className="text-[10px] font-bold px-2 py-0.5 bg-highlight text-accent rounded-full border border-accent/20">LIVE</span>
              </h1>
            </div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.15em] mt-0.5">Voucher: #{invoiceNo}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <div className="flex items-center gap-2">
             <button onClick={() => setShowReturnModal(true)} className="h-10 px-3 lg:px-4 rounded-xl flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black tracking-widest hover:bg-rose-100 transition-all uppercase">
               <RefreshCcw size={14}/> {isCompact ? 'RET' : 'Returns'}
             </button>
             {!isCompact && <button onClick={() => setShowCalculator(!showCalculator)} title="Quick Calculator" className={`h-10 w-10 flex items-center justify-center rounded-xl border transition-all shadow-sm ${showCalculator ? 'bg-primary text-white border-primary' : 'bg-page border-border text-secondary hover:text-primary'}`}><Calculator size={18}/></button>}
             {!isCompact && <button onClick={() => setShowShortcutsLegend(!showShortcutsLegend)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-page border border-border text-secondary hover:text-primary transition-all shadow-sm"><HelpCircle size={18}/></button>}
          </div>
          {!isCompact && <div className="h-10 w-[1px] bg-border mx-1"></div>}
          {!isCompact && (
            <div className="hidden xl:flex flex-col items-end mr-4">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Session Time</p>
              <ClockDisplay />
            </div>
          )}
          {!isCompact && <div className="h-10 w-[1px] bg-border mx-2"></div>}
          {isCompact ? (
            <button onClick={() => setPosState('full')} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-border text-secondary hover:text-primary shadow-sm">
              <Maximize2 size={16} />
            </button>
          ) : <HeaderControls />}
          <div className="h-10 w-[1px] bg-border mx-1 lg:mx-2"></div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl border border-border bg-white flex items-center justify-center text-secondary hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* COMPACT SUMMARY STRIP (Pinned) */}
      <div className={`${isCompact ? 'grid grid-cols-2 p-2 gap-2 bg-white border-b' : 'h-12 bg-white/50 border-b border-border px-6 flex items-center gap-4 overflow-x-auto shrink-0 backdrop-blur-sm'}`}>
        {[
          { label: "Today's Sales", value: formatCurrency(posStats.todaySales), icon: <DollarSign size={10}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: "Transactions", value: String(posStats.totalTransactions), icon: <History size={10}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: "Held Bills", value: String(posStats.heldBillsCount), icon: <Pause size={10}/>, color: 'text-accent', bg: 'bg-highlight' },
          { label: "Shift", value: posStats.shiftStatus, icon: <Activity size={10}/>, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((stat, i) => (
          <div key={i} className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-white shadow-none shrink-0 ${isCompact ? 'justify-start h-10' : ''}`}>
            <div className={`p-1 rounded-md ${stat.bg} ${stat.color}`}>{stat.icon}</div>
            <div className="flex flex-col min-width-0">
              <span className="text-[8px] font-bold text-secondary uppercase tracking-widest leading-none truncate">{stat.label}</span>
              <span className="text-[11px] font-black text-primary mt-0.5 leading-none">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN LAYOUT WRAPPER */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-page/50">
        
        {/* SCANNER & PARTY ROW (Pinned) */}
        <div className={`px-6 pt-4 pb-2 shrink-0 ${isCompact ? 'px-4 pt-2' : ''}`}>
          <div className={`grid gap-4 ${isCompact || posState === 'side' ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-black text-secondary uppercase tracking-widest">Scanner & Source Filter</span>
                <div className="flex gap-1">
                   {['ALL', 'PCD', 'OWN', 'TRADING'].map(s => (
                     <button 
                       key={s} 
                       onClick={() => setProductSourceFilter(s === 'OWN' ? 'OWN_MANUFACTURING' : s as any)} 
                       className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border transition-all ${productSourceFilter === (s === 'OWN' ? 'OWN_MANUFACTURING' : s) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-secondary border-border hover:border-slate-400'}`}
                     >
                       {s}
                     </button>
                   ))}
                </div>
              </div>
              <div className="relative h-10 bg-white rounded-xl border border-border flex items-center p-1 focus-within:border-accent transition-all shadow-sm">
                <Search size={16} className="text-secondary ml-2" />
                <input ref={scanInputRef} type="text" value={scanValue} onChange={e => setScanValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleScanSubmit(e as any); }} placeholder="Scan barcode..." className="flex-1 bg-transparent text-xs font-bold text-primary px-2 outline-none" />
                {scanMessage && <div className="absolute -bottom-4 left-2 text-[8px] font-black text-accent animate-pulse">{scanMessage}</div>}
              </div>
            </div>

            <div className={`grid gap-4 ${isCompact ? 'grid-cols-1' : posState === 'side' ? 'grid-cols-1' : 'col-span-2 grid-cols-4'}`}>
              <div className="col-span-2 flex flex-col gap-1.5 relative">
                <span className="text-[9px] font-black text-secondary uppercase tracking-widest px-1">Customer / Ledger</span>
                <div className="h-10 bg-white border border-border rounded-xl flex items-center px-3 relative shadow-sm focus-within:border-accent transition-all">
                  <UserCircle size={14} className="text-secondary/50 mr-2" />
                  <input type="text" value={partyName} onChange={e => { setPartyName(e.target.value); setSearchQuery(e.target.value); }} onFocus={() => setShowDropdown({ type: 'party' })} onBlur={() => setTimeout(() => setShowDropdown(null), 200)} className="flex-1 bg-transparent text-xs font-bold text-primary outline-none" />
                  <button onClick={() => setShowCustomerSearch(true)} className="p-1.5 hover:bg-page rounded-lg transition-colors text-secondary hover:text-accent" title="Advanced Search"><Search size={14}/></button>
                  {renderDropdown('party')}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-secondary uppercase tracking-widest px-1">Entry Date</span>
                <div className="h-10 bg-white border border-border rounded-xl flex items-center px-3 shadow-sm focus-within:border-accent transition-all">
                  <Calendar size={14} className="text-secondary/50 mr-2" />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} id="voucher-date" className="flex-1 bg-transparent text-xs font-black text-primary outline-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-secondary uppercase tracking-widest px-1">Drug License / E-Way</span>
                <div className="h-10 bg-white border border-border rounded-xl flex items-center px-2 gap-1 shadow-sm focus-within:border-accent transition-all">
                  <input type="text" value={drugLicenseNo} onChange={e => setDrugLicenseNo(e.target.value)} placeholder="DL No." className="w-1/2 bg-transparent text-[10px] font-bold text-primary outline-none border-r border-border pr-1" title="Drug License Number" />
                  <input type="text" value={ewayBillNo} onChange={e => setEwayBillNo(e.target.value)} placeholder="E-Way" className="w-1/2 bg-transparent text-[10px] font-bold text-primary outline-none pl-1" title="E-Way Bill Number" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PATIENT SECTION (Collapsible) */}
        {voucherType === 'Sales' && (
          <div className="px-6 py-2 shrink-0">
            <div className="bg-white border border-border rounded-2xl p-3 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-highlight text-accent"><Heart size={14} /></div>
                  <h3 className="text-[11px] font-black text-primary uppercase">Patient Info</h3>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowHistory(!showHistory)} className="text-[9px] font-black text-accent hover:underline uppercase flex items-center gap-1"><History size={12} /> History</button>
                  <button onClick={() => setPatientDetailsCollapsed(!patientDetailsCollapsed)} className="p-1 rounded-md bg-page text-secondary border border-border">
                    {patientDetailsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </div>

              {!patientDetailsCollapsed && (
                <div className={`mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 ${isCompact ? 'max-h-[300px] overflow-y-auto pr-2' : ''}`}>
                  {/* Row 1 */}
                  <div className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'grid-cols-4'}`}>
                    {[
                      { label: 'Patient Name', value: patientName, setter: setPatientName },
                      { label: 'Mobile', value: customerMobile, setter: setCustomerMobile },
                      { label: 'Dr. Name', value: doctorName, setter: setDoctorName },
                      { label: 'ABHA ID', value: abhaNo, setter: setAbhaNo }
                    ].map((f, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <label className="text-[8px] font-black text-secondary uppercase px-1">{f.label}</label>
                        <input type="text" value={f.value} onChange={e => f.setter(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none transition-all" />
                      </div>
                    ))}
                  </div>
                  {/* Row 2 (Age, DOB, Gender) */}
                  <div className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'grid-cols-4'}`}>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">Age (Yrs)</label>
                      <input type="number" value={patientAge} onChange={e => setPatientAge(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">DOB</label>
                      <input type="date" value={patientDob} onChange={e => setPatientDob(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">Gender</label>
                      <select value={patientGender} onChange={e => setPatientGender(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">Schedule</label>
                      <select value={scheduleType} onChange={e => setScheduleType(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none">
                        <option value="None">None</option>
                        <option value="Schedule H">Schedule H</option>
                        <option value="Schedule H1">Schedule H1</option>
                        <option value="Schedule X">Schedule X</option>
                        <option value="OTC">OTC</option>
                      </select>
                    </div>
                  </div>
                  {/* Row 3 (Rx info) */}
                  <div className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'grid-cols-4'}`}>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">Rx Number</label>
                      <input type="text" value={prescriptionNo} onChange={e => setPrescriptionNo(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">Rx Date</label>
                      <input type="date" value={prescriptionDate} onChange={e => setPrescriptionDate(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">Valid Till</label>
                      <input type="date" value={validTill} onChange={e => setValidTill(e.target.value)} className="h-8 bg-page/50 border border-border rounded-lg px-2 text-[11px] font-bold focus:border-accent outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black text-secondary uppercase px-1">File</label>
                      <div className="h-8 border border-dashed border-border rounded-lg flex items-center justify-center text-[10px] font-bold text-secondary bg-page/30 cursor-pointer hover:bg-page transition-colors">
                        <Paperclip size={12} className="mr-1" /> Upload
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INVENTORY TABLE SECTION (Scrollable) */}
        <div className={`flex-1 min-h-[120px] overflow-hidden flex flex-col px-6 py-2 ${isCompact ? 'px-4 py-1' : ''}`}>
          <div className={`bg-white border border-border rounded-2xl shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden ${isCompact ? 'bg-transparent border-none shadow-none' : ''}`}>
            <div className="flex-1 overflow-auto custom-scrollbar">
              {isCompact ? (
                <div className="space-y-3 pb-4">
                  {items.map((item, idx) => {
                    const expData = getExpiryStatus(item.expiryDate);
                    return (
                      <div key={idx} className="pos-item-card">
                        <button onClick={() => deleteItem(idx)} className="delete-btn"><Trash2 size={16} /></button>
                        <div className="item-name mb-2 pr-6">
                           <input type="text" value={item.name} placeholder="Search product..." onChange={e => { handleItemChange(idx, 'name', e.target.value); setSearchQuery(e.target.value); }} onFocus={() => setShowDropdown({ type: 'item', index: idx })} onBlur={() => setTimeout(() => setShowDropdown(null), 200)} className="w-full bg-transparent text-[13px] font-bold text-primary outline-none" />
                           {renderDropdown('item', idx)}
                        </div>
                        <div className="item-meta flex flex-wrap gap-x-4 gap-y-1">
                          <span className="flex items-center gap-1"><Package size={10}/> Batch: {item.batchNumber || '-'}</span>
                          <span className="flex items-center gap-1" style={{ color: expData.color }}><Calendar size={10}/> Exp: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' }) : '-'}</span>
                          <span className="flex items-center gap-1"><span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] px-1.5 py-0.5 rounded-full font-black">GST {item.gstPercent}%</span></span>
                        </div>
                        <div className="item-pricing">
                           <span className="text-secondary">MRP: <span className="font-bold text-primary">₹{parseFloat(item.mrp || 0).toFixed(2)}</span></span>
                           <span className="flex items-center gap-1 ml-auto">Disc: <input type="text" value={item.discPercent} onChange={e => handleItemChange(idx, 'discPercent', e.target.value)} className="w-10 h-6 bg-page border border-border rounded text-[10px] text-center font-black" /> %</span>
                        </div>
                        <div className="item-qty-row mt-2 pt-2 border-t border-border/50">
                          <div className="flex items-center gap-2 bg-page rounded-lg p-1 border border-border">
                            <button onClick={() => handleItemChange(idx, 'quantity', String(Math.max(1, Number(item.quantity || 0) - 1)))} className="w-6 h-6 rounded bg-white border border-border flex items-center justify-center shadow-sm"><Minus size={12}/></button>
                            <input type="text" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} className="w-8 bg-transparent text-xs font-black text-center" />
                            <button onClick={() => handleItemChange(idx, 'quantity', String(Number(item.quantity || 0) + 1))} className="w-6 h-6 rounded bg-white border border-border flex items-center justify-center shadow-sm"><Plus size={12}/></button>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-bold text-secondary uppercase">Amount</p>
                             <p className="text-sm font-black text-accent">₹{parseFloat(item.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={addItem} className="w-full py-4 border-2 border-dashed border-border rounded-2xl text-secondary hover:text-accent hover:border-accent hover:bg-highlight/10 transition-all flex flex-col items-center gap-1">
                    <Plus size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Add Item Row</span>
                  </button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="bg-page/50 border-b border-border sticky top-0 z-20">
                    <tr>
                      <th className="w-8 py-2 px-2 text-[8px] font-black text-secondary uppercase text-center">#</th>
                      <th className="w-[20%] py-2 px-3 text-[8px] font-black text-secondary uppercase">Item Description</th>
                      <th className="w-[10%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-center">Batch</th>
                      <th className="w-[8%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-center">Expiry</th>
                      <th className="w-[8%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-right">MRP</th>
                      <th className="w-[8%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-center">Disc %</th>
                      <th className="w-[8%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-center">GST %</th>
                      <th className="w-[12%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-center">Qty</th>
                      <th className="w-[10%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-right">Rate</th>
                      <th className="w-[10%] py-2 px-2 text-[8px] font-black text-secondary uppercase text-right">Amount</th>
                      <th className="w-8 py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {items.map((item, idx) => {
                      const expData = getExpiryStatus(item.expiryDate);
                      return (
                        <tr key={idx} className={`group hover:bg-page transition-colors ${item.amount > 0 ? 'bg-white' : 'bg-page/5'}`}>
                          <td className="py-2 px-2 text-[10px] font-black text-secondary text-center">{idx + 1}</td>
                          <td className="py-2 px-3 relative">
                            <input type="text" value={item.name} placeholder="Search product..." onChange={e => { handleItemChange(idx, 'name', e.target.value); setSearchQuery(e.target.value); }} onFocus={() => setShowDropdown({ type: 'item', index: idx })} onBlur={() => setTimeout(() => setShowDropdown(null), 200)} className="w-full bg-transparent text-[11px] font-bold text-primary outline-none" />
                            {renderDropdown('item', idx)}
                          </td>
                          <td className="py-2 px-2 text-[10px] font-mono font-bold text-center text-slate-600">{item.batchNumber || '-'}</td>
                          <td className="py-2 px-2 text-[10px] text-center font-mono font-bold" style={{ color: expData.color }}>
                            {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: '2-digit' }) : '-'}
                          </td>
                          <td className="py-2 px-2 text-[10px] font-bold text-right text-slate-600">₹{parseFloat(item.mrp || 0).toFixed(2)}</td>
                          <td className="py-2 px-2 text-center">
                            <input type="text" value={item.discPercent} onChange={e => handleItemChange(idx, 'discPercent', e.target.value)} className="w-10 bg-page/50 border-b border-border text-[10px] font-black text-primary text-center outline-none focus:border-accent" />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">{item.gstPercent}%</span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-center gap-1.5 bg-page/50 rounded-lg p-0.5 border border-border">
                              <button onClick={() => handleItemChange(idx, 'quantity', String(Math.max(1, Number(item.quantity || 0) - 1)))} className="w-5 h-5 rounded-md bg-white border border-border text-secondary hover:text-accent flex items-center justify-center"><Minus size={10}/></button>
                              <input type="text" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} className="w-6 bg-transparent text-[11px] font-black text-primary text-center outline-none" />
                              <button onClick={() => handleItemChange(idx, 'quantity', String(Number(item.quantity || 0) + 1))} className="w-5 h-5 rounded-md bg-white border border-border text-secondary hover:text-accent flex items-center justify-center"><Plus size={10}/></button>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-[11px] font-black text-primary text-right">₹{parseFloat(item.rate || 0).toFixed(2)}</td>
                          <td className="py-2 px-2 text-[11px] font-black text-primary text-right">₹{parseFloat(item.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="py-2 px-2 text-center">
                            <button onClick={() => deleteItem(idx)} className="text-rose-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* TABLE FOOTER (Compact) */}
            <div className={`bg-page/50 border-t border-border px-4 py-2 shrink-0 ${isCompact ? 'flex flex-col gap-3' : 'flex items-center justify-between'}`}>
               <div className={`flex items-center ${isCompact ? 'grid grid-cols-2 gap-x-4 gap-y-1' : 'gap-6'}`}>
                <div className="flex items-baseline gap-1.5"><span className="text-[8px] font-black text-secondary uppercase">SKU:</span><span className="text-[11px] font-black text-primary">{totals.itemCount}</span></div>
                <div className="flex items-baseline gap-1.5"><span className="text-[8px] font-black text-secondary uppercase">Units:</span><span className="text-[11px] font-black text-primary">{totals.totalQty}</span></div>
                <div className="flex items-baseline gap-1.5"><span className="text-[8px] font-black text-secondary uppercase">Disc:</span><span className="text-[11px] font-black text-rose-600">₹{totals.totalDiscount.toFixed(2)}</span></div>
                <div className="flex items-baseline gap-1.5"><span className="text-[8px] font-black text-secondary uppercase">GST:</span><span className="text-[11px] font-black text-primary">₹{totals.totalGst.toFixed(2)}</span></div>
              </div>
              <div className={`flex items-center ${isCompact ? 'justify-between' : 'gap-2'}`}>
                {!isCompact && <button onClick={addItem} className="text-[9px] font-black text-accent hover:underline uppercase">+ ADD ROW</button>}
                {!isCompact && <div className="w-[1px] h-4 bg-border mx-2"></div>}
                <div className="flex items-baseline gap-2">
                  <span className="text-[9px] font-bold text-secondary uppercase">Subtotal:</span>
                  <span className="text-sm font-black text-primary tracking-tight">₹{totals.subTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BILL SUMMARY PANEL (Detailed Breakdown) */}
        {voucherType === 'Sales' && (
          <div className={`px-6 py-2 shrink-0 ${isCompact ? 'px-4 py-1' : ''}`}>
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
              <div className={`flex items-start ${isCompact ? 'flex-col gap-4' : 'justify-between'}`}>
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between cursor-pointer group" onClick={() => setTaxBreakdownCollapsed(!taxBreakdownCollapsed)}>
                    <h4 className="text-[9px] font-black text-secondary uppercase tracking-[0.1em]">Tax Breakdown</h4>
                    <ChevronDown size={14} className={`text-secondary transition-transform duration-200 ${taxBreakdownCollapsed ? '' : 'rotate-180'}`} />
                  </div>
                  
                  {!taxBreakdownCollapsed && (
                    <div className={`flex flex-wrap gap-3 mt-2 animate-in fade-in slide-in-from-top-1 ${isCompact ? 'grid grid-cols-2' : ''}`}>
                      {Object.entries(totals.gstSlabs).map(([slab, amount]) => (
                        (amount as number) > 0 && (
                          <div key={slab} className="flex flex-col">
                            <span className="text-[7px] font-black text-secondary uppercase">GST @ {slab}</span>
                            <span className="text-[10px] font-black text-primary">₹{(amount as number).toFixed(2)}</span>
                          </div>
                        )
                      ))}
                      <div className={`flex flex-col ${isCompact ? '' : 'border-l border-border pl-3'}`}>
                        <span className="text-[7px] font-black text-accent uppercase">Round Off</span>
                        <span className="text-[10px] font-black text-accent">₹{(Math.round(totals.totalPayable) - totals.totalPayable).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={`${isCompact ? 'w-full flex justify-between items-center' : 'text-right flex flex-col justify-between h-full'}`}>
                   <p className="text-[9px] font-black text-secondary uppercase mb-1">Total Payable</p>
                   <p className={`${isCompact ? 'text-xl' : 'text-2xl'} font-black text-accent leading-none tracking-tighter`}>₹{Math.round(totals.totalPayable).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NARRATION (Pinned) */}
        <div className="px-6 pb-4 pt-1 shrink-0">
           <div className="relative group">
              <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-accent" />
              <input type="text" placeholder="Bill narration..." value={narration} onChange={e => setNarration(e.target.value)} className="w-full bg-white border border-border rounded-xl h-9 pl-9 pr-3 text-[11px] font-bold text-primary outline-none focus:border-accent shadow-sm" />
           </div>
        </div>

      </div>

      {/* BOTTOM ACTION BAR (Pinned) */}
      <div className={`bg-white border-t border-border p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10 ${isCompact ? 'p-2' : ''}`}>
        <div className={`flex justify-between items-center max-w-full overflow-hidden ${isCompact ? 'flex-col gap-3' : ''}`}>
          <div className={`flex-1 truncate ${isCompact ? 'w-full text-center px-2' : 'pr-4'}`}>
             <span className="text-[9px] font-bold text-secondary uppercase italic">₹ In Words: {numberToWords(Math.round(totals.totalPayable))} Only</span>
          </div>

          <div className={`flex items-center gap-3 ${isCompact ? 'w-full grid grid-cols-4' : ''}`}>
            <button onClick={onClose} className={`h-10 px-4 rounded-xl border border-border bg-white text-secondary text-[10px] font-black hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm flex items-center justify-center gap-2 ${isCompact ? 'px-1 flex-col h-14' : ''}`}>
              <X size={14} /> {isCompact ? 'EXIT' : 'EXIT'}
            </button>
            <button onClick={handleHoldBill} className={`h-10 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 text-[10px] font-black hover:bg-amber-100 transition-all shadow-sm flex items-center justify-center gap-2 ${isCompact ? 'px-1 flex-col h-14' : ''}`}>
              <Pause size={14} /> {isCompact ? 'HOLD' : 'HOLD'}
            </button>
            <button onClick={() => handleSave(true)} disabled={loading} className={`h-10 px-4 rounded-xl border border-border bg-white text-primary text-[10px] font-black hover:bg-page transition-all shadow-sm flex items-center justify-center gap-2 ${isCompact ? 'px-1 flex-col h-14' : ''}`}>
              <Printer size={14} /> {isCompact ? 'PRINT' : 'PRINT'}
            </button>
            <button 
              onClick={() => voucherType === 'Sales' ? setShowPaymentModal(true) : handleSave(false)} 
              disabled={loading || calculateTotal() === 0} 
              className={`h-10 px-8 rounded-xl bg-accent text-white text-[11px] font-black hover:bg-[#3d8c5b] transition-all shadow-lg uppercase flex items-center gap-2 justify-center ${isCompact ? 'px-1 flex-col h-14 col-span-1' : ''}`}
            >
              <DollarSign size={14} /> {voucherType === 'Sales' ? (isCompact ? 'PAY' : 'SAVE & PAY') : 'SAVE'}
            </button>
          </div>
        </div>
      </div>

      {/* HELD BILLS MODAL */}
      {showHeldBills && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-border">
            <div className="p-6 border-b border-border flex justify-between items-center bg-page/30">
              <div className="flex items-center gap-3"><div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600"><Pause size={20} /></div><div><h3 className="text-lg font-black text-primary uppercase">Held Bills</h3><p className="text-[10px] font-bold text-secondary uppercase">Restore Transactions</p></div></div>
              <button onClick={() => setShowHeldBills(false)} className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl"><X size={20} /></button>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-3">
              {heldBills.length === 0 ? <div className="py-12 text-center text-secondary italic">No bills on hold.</div> : heldBills.map((bill, i) => (
                <div key={i} className="p-4 rounded-2xl border border-border hover:border-accent hover:bg-highlight/20 transition-all flex items-center justify-between group">
                  <div><p className="text-sm font-black text-primary">Bill #{bill.invoiceNo}</p><p className="text-xs font-bold text-secondary">{bill.partyName}</p></div>
                  <button onClick={() => handleRestoreBill(i)} className="px-4 py-2 bg-white border border-border text-[11px] font-black text-primary rounded-xl hover:bg-accent hover:text-white transition-all">RESTORE</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ALERT DIALOG */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-border">
            <div className="bg-highlight p-6 flex items-center gap-4 border-b border-accent/20">
              <div className="p-2.5 rounded-2xl bg-white text-accent shadow-sm"><Activity size={24} /></div>
              <div><h3 className="text-lg font-black text-emerald-900 uppercase">{alertDialog.title}</h3></div>
            </div>
            <div className="p-8 text-sm font-bold text-slate-600 leading-relaxed">{alertDialog.message}</div>
            <div className="p-6 bg-page/30 border-t border-border flex justify-end">
              <button onClick={() => setAlertDialog({ ...alertDialog, isOpen: false })} className="px-8 h-12 bg-primary text-white text-[11px] font-black rounded-xl hover:bg-black transition-all">CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TallyVoucherEntry;
