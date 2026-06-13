import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, CreditCard, ArrowUpRight, ArrowDownLeft, FileText, Calendar, Wallet, Check, X, Plus, PieChart, TrendingUp, DollarSign, RefreshCcw, Filter, User, MapPin, Stethoscope, Pill, MapPinned, Briefcase, Printer, Download, Eye, Pencil, Trash2, Save, XCircle, Package, Layers, AlertCircle, ShoppingCart, Power, Minus, Gift, History, Calculator } from 'lucide-react';
import { MOCK_PRODUCTS } from '../constants';
import { Product, Batch, SalesInvoice, SalesInvoiceItem, Party } from '../types';
import { useAuth } from '../context/AuthContext';
import { saveInvoice, getAllInvoices, searchProducts, getAllParties, saveParty } from '../services/databaseService';
import { calculateLineItem, calculateInvoiceSummary, calculateBatchValuation, validateDiscount, applyScheme, calculateRates } from '../utils/tallyERP11Calculations';
import { numberToWords } from '../utils/numberToWords';


const POSInventoryStyle: React.FC = () => {
 // --- State: Tabs & Views ---
 const [activeTab, setActiveTab] = useState<'MASTER' | 'INVOICE' | 'HISTORY'>('MASTER');
 
 // --- State: Invoice Header ---
 const [invoiceNumber, setInvoiceNumber] = useState('');
 const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
 const [invoiceType, setInvoiceType] = useState<'Retail' | 'Wholesale' | 'Tax Invoice' | 'Bill of Supply' | 'Debit Note' | 'Credit Note'>('Retail');
 const [financialYear, setFinancialYear] = useState('2024-25');
 const [seriesPrefix, setSeriesPrefix] = useState('INV/2024-25/');
 
 // --- State: Customer Details ---
 const [customerName, setCustomerName] = useState('');
 const [customerCode, setCustomerCode] = useState('');
 const [billingAddress, setBillingAddress] = useState('');
 const [shippingAddress, setShippingAddress] = useState('');
 const [customerState, setCustomerState] = useState('');
 const [stateCode, setStateCode] = useState('');
 const [gstin, setGstin] = useState('');
 const [drugLicenseNo, setDrugLicenseNo] = useState('');
 const [contactNumber, setContactNumber] = useState('');
 const [email, setEmail] = useState('');
 const [routeArea, setRouteArea] = useState('');
 const [salesmanName, setSalesmanName] = useState('');
 const [existingParties, setExistingParties] = useState<Party[]>([]);
 const [showCustomerModal, setShowCustomerModal] = useState(false);
 
 // --- State: Payment Details ---
 const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Card' | 'Credit'>('Cash');
 const [creditDays, setCreditDays] = useState(0);
 const [dueDate, setDueDate] = useState('');
 const [outstandingBalance, setOutstandingBalance] = useState(0);
 const [creditLimit, setCreditLimit] = useState(0);
 const [transportMode, setTransportMode] = useState('');
 const [ewayBillNo, setEwayBillNo] = useState('');
 
 // --- State: Line Items ---
 const [cartItems, setCartItems] = useState<SalesInvoiceItem[]>([]);
 const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
 const [selectedProductId, setSelectedProductId] = useState<string>(''); // Track dropdown selection
 const [showBatchModal, setShowBatchModal] = useState(false);
 const [showProductModal, setShowProductModal] = useState(false);
 const [savedInvoices, setSavedInvoices] = useState<SalesInvoice[]>([]); // Store saved invoices for history
 const [loadingHistory, setLoadingHistory] = useState(false);
 
 // --- State: Search & Filter ---
 const [searchTerm, setSearchTerm] = useState('');
 const [searchResults, setSearchResults] = useState<Product[]>(MOCK_PRODUCTS);
 const [sourceFilter, setSourceFilter] = useState<'ALL' | 'PCD' | 'OWN_MANUFACTURING' | 'TRADING'>('ALL');
 
 // --- State: Invoice History Search & Filter ---
 const [invoiceHistorySearch, setInvoiceHistorySearch] = useState('');
 const [invoiceDateFilter, setInvoiceDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
 const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'Completed' | 'Pending' | 'Cancelled'>('all');
 const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState('');
 const [customStartDate, setCustomStartDate] = useState('');
 const [customEndDate, setCustomEndDate] = useState('');
 
 // --- State: Filtered Invoices ---
 const [filteredInvoices, setFilteredInvoices] = useState<SalesInvoice[]>([]);
 
 // --- State: Calculations ---
 const [totalTaxable, setTotalTaxable] = useState(0);
 const [totalCgst, setTotalCgst] = useState(0);
 const [totalSgst, setTotalSgst] = useState(0);
 const [totalIgst, setTotalIgst] = useState(0);
 const [roundOff, setRoundOff] = useState(0);
 const [freightCharges, setFreightCharges] = useState(0);
 const [otherCharges, setOtherCharges] = useState(0);
 const [tcs, setTcs] = useState(0);
 const [tds, setTds] = useState(0);
 const [netPayable, setNetPayable] = useState(0);
 const [amountInWords, setAmountInWords] = useState('');
 
 const { hasPermission } = useAuth();
 const canGiveDiscount = hasPermission(['ADMIN', 'PHARMACIST']);
 const canReturn = hasPermission(['ADMIN', 'PHARMACIST']);
 // Quick Calculator State
 const [calcValue, setCalcValue] = useState('0');
 const [calcExpression, setCalcExpression] = useState('');
 
 const handleCalcKeyPress = (key: string) => {
 if (key === '=') {
 try {
 // Simple evaluation logic
 const result = eval(calcExpression.replace(/×/g, '*').replace(/÷/g, '/'));
 setCalcValue(result.toString());
 setCalcExpression(result.toString());
 } catch (e) {
 setCalcValue('Error');
 }
 } else if (key === 'C') {
 setCalcValue('0');
 setCalcExpression('');
 } else {
 const newExpr = calcExpression + key;
 setCalcExpression(newExpr);
 // Update display with just the last number/operator
 setCalcValue(key);
 }
 };

 const QuickCalculator = () => (
 <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl p-4 text-white overflow-hidden relative group">
 <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all"></div>
 <div className="flex items-center justify-between mb-3 relative z-10">
 <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
 <Calculator size={14} className="text-blue-400" />
 Quick Calculator
 </h4>
 <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">MARG Standard</span>
 </div>
 
 <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-slate-700/50 relative z-10">
 <div className="text-[10px] text-slate-500 text-right h-4 mb-1 font-mono">{calcExpression || '0'}</div>
 <div className="text-2xl font-bold text-right font-mono truncate text-blue-100">{calcValue}</div>
 </div>
 
 <div className="grid grid-cols-4 gap-2 relative z-10">
 {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', 'C', '+'].map(k => (
 <button 
 key={k} 
 onClick={() => handleCalcKeyPress(k)}
 className="h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold border border-slate-700 active:scale-95 transition-all"
 >
 {k}
 </button>
 ))}
 <button 
 onClick={() => handleCalcKeyPress('=')}
 className="col-span-4 h-10 rounded-lg bg-accent hover:bg-accent text-white font-bold border border-accent shadow-none shadow-none active:scale-[0.98] transition-all"
 >
 =
 </button>
 </div>
 </div>
 );

 // Margin Analysis Logic (Tally ERP 11 Enhanced)
 const sessionMargin = useMemo(() => {
 if (cartItems.length === 0) return 0;
 
 const totalRevenue = cartItems.reduce((acc, item) => acc + item.totalAmount, 0);
 const totalCost = cartItems.reduce((acc, item) => {
 // Use actual purchase rate from batch data
 return acc + (item.quantity * (item.purchaseRate || item.mrp * 0.65));
 }, 0);
 
 if (totalRevenue === 0) return 0;
 return ((totalRevenue - totalCost) / totalRevenue) * 100;
 }, [cartItems]);

 const estimatedProfit = useMemo(() => {
 const totalRevenue = cartItems.reduce((acc, item) => acc + item.totalAmount, 0);
 const totalCost = cartItems.reduce((acc, item) => {
 // Use actual purchase rate with quantity
 return acc + (item.quantity * (item.purchaseRate || item.mrp * 0.65));
 }, 0);
 return totalRevenue - totalCost;
 }, [cartItems]);
 
 // Tally ERP 11 Profit Summary
 const profitSummary = useMemo(() => {
 if (cartItems.length === 0) return { avgMargin: 0, totalProfit: 0, highMarginCount: 0, lowMarginCount: 0 };
 
 const avgMargin = cartItems.reduce((sum, item) => sum + (item.profitPercent || 0), 0) / cartItems.length;
 const totalProfit = cartItems.reduce((sum, item) => sum + ((item.profitPercent || 0) * item.totalAmount / 100), 0);
 const highMarginCount = cartItems.filter(item => (item.profitPercent || 0) > 35).length;
 const lowMarginCount = cartItems.filter(item => (item.profitPercent || 0) < 15).length;
 
 return { avgMargin: Math.round(avgMargin * 100) / 100, totalProfit: Math.round(totalProfit * 100) / 100, highMarginCount, lowMarginCount };
 }, [cartItems]);

 const hasH1Drugs = cartItems.some(item => item.genericName?.toLowerCase().includes('h1') || item.productName?.toLowerCase().includes('h1'));
 const invoiceRef = useRef<HTMLDivElement>(null);
 const isSavingRef = useRef(false);

 // Debug effect to log cart items changes
 useEffect(() => {
 console.log('cartItems updated:', cartItems);
 }, [cartItems]);

 // Generate invoice number
 useEffect(() => {
 const generateInvoiceNumber = () => {
 const date = new Date();
 const year = date.getFullYear().toString().slice(-2);
 const month = (date.getMonth() + 1).toString().padStart(2, '0');
 const day = date.getDate().toString().padStart(2, '0');
 const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
 return `${seriesPrefix}${year}${month}${day}${random}`;
 };
 
 if (!invoiceNumber) {
 setInvoiceNumber(generateInvoiceNumber());
 }
 }, [seriesPrefix, invoiceNumber]);

 // Load data on component mount
 useEffect(() => {
 const loadData = async () => {
 try {
 // Initialize sample data
 const { initializeSampleData } = await import('../services/databaseService');
 initializeSampleData();
 
 const [products, parties] = await Promise.all([
 searchProducts(''),
 getAllParties()
 ]);
 
 if (products.length > 0) {
 setSearchResults(products);
 }
 setExistingParties(parties);
 } catch (error) {
 console.error('Error loading data:', error);
 setSearchResults(MOCK_PRODUCTS);
 }
 };
 
 loadData();
 }, []);

 // Load invoice history when history tab is activated
 useEffect(() => {
 const loadInvoiceHistory = async () => {
 if (activeTab === 'HISTORY') {
 setLoadingHistory(true);
 try {
 const invoices = await getAllInvoices();
 setSavedInvoices(invoices);
 console.log('Loaded invoices:', invoices);
 } catch (error) {
 console.error('Error loading invoice history:', error);
 setSavedInvoices([]);
 } finally {
 setLoadingHistory(false);
 }
 }
 };
 
 loadInvoiceHistory();
 }, [activeTab]);

 // Filter invoices based on search criteria
 useEffect(() => {
 let filtered = [...savedInvoices];
 
 // Text search filter
 if (invoiceHistorySearch) {
 const searchLower = invoiceHistorySearch.toLowerCase();
 filtered = filtered.filter(invoice => 
 invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
 invoice.customerName.toLowerCase().includes(searchLower) ||
 (invoice.customerMobile && invoice.customerMobile.includes(searchLower)) ||
 (invoice.customerEmail && invoice.customerEmail.toLowerCase().includes(searchLower))
 );
 }
 
 // Status filter
 if (invoiceStatusFilter !== 'all') {
 filtered = filtered.filter(invoice => invoice.status === invoiceStatusFilter);
 }
 
 // Customer filter
 if (invoiceCustomerFilter) {
 filtered = filtered.filter(invoice => 
 invoice.customerName.toLowerCase().includes(invoiceCustomerFilter.toLowerCase())
 );
 }
 
 // Date filter
 const now = new Date();
 const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
 const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
 
 switch (invoiceDateFilter) {
 case 'today':
 filtered = filtered.filter(invoice => {
 const invoiceDate = new Date(invoice.date);
 return invoiceDate >= startOfDay && invoiceDate <= endOfDay;
 });
 break;
 case 'week':
 const weekAgo = new Date();
 weekAgo.setDate(weekAgo.getDate() - 7);
 filtered = filtered.filter(invoice => new Date(invoice.date) >= weekAgo);
 break;
 case 'month':
 const monthAgo = new Date();
 monthAgo.setMonth(monthAgo.getMonth() - 1);
 filtered = filtered.filter(invoice => new Date(invoice.date) >= monthAgo);
 break;
 case 'custom':
 if (customStartDate && customEndDate) {
 const startDate = new Date(customStartDate);
 const endDate = new Date(customEndDate);
 endDate.setHours(23, 59, 59, 999);
 filtered = filtered.filter(invoice => {
 const invoiceDate = new Date(invoice.date);
 return invoiceDate >= startDate && invoiceDate <= endDate;
 });
 }
 break;
 }
 
 setFilteredInvoices(filtered);
 }, [savedInvoices, invoiceHistorySearch, invoiceDateFilter, invoiceStatusFilter, invoiceCustomerFilter, customStartDate, customEndDate]);

 // Filter Logic (similar to inventory)
 const filteredProducts = searchResults.filter(p =>
 (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 p.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
 p.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
 p.therapeuticCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
 p.alias?.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase())) ||
 p.alias?.join(', ').toLowerCase().includes(searchTerm.toLowerCase())) &&
 (sourceFilter === 'ALL' || p.source === sourceFilter)
 );

 // Calculate totals
 useEffect(() => {
 const taxable = cartItems.reduce((sum, item) => sum + item.taxableValue, 0);
 const cgst = cartItems.reduce((sum, item) => sum + item.cgstAmount, 0);
 const sgst = cartItems.reduce((sum, item) => sum + item.sgstAmount, 0);
 const igst = cartItems.reduce((sum, item) => sum + item.igstAmount, 0);
 const total = taxable + cgst + sgst + igst + freightCharges + otherCharges + tcs - tds + roundOff;
 
 setTotalTaxable(taxable);
 setTotalCgst(cgst);
 setTotalSgst(sgst);
 setTotalIgst(igst);
 setNetPayable(total);
 
 // Convert to words
 setAmountInWords(numberToWords(Math.round(total)));
 }, [cartItems, freightCharges, otherCharges, tcs, tds, roundOff]);

 // Update search results when search term changes
 useEffect(() => {
 const performSearch = async () => {
 if (searchTerm.trim() === '') {
 setSearchResults(MOCK_PRODUCTS);
 return;
 }
 
 try {
 const results = await searchProducts(searchTerm);
 setSearchResults(results.length > 0 ? results : MOCK_PRODUCTS);
 } catch (error) {
 console.error('Error searching products:', error);
 // Fallback to local search with alias support
 const term = searchTerm.toLowerCase();
 const localResults = MOCK_PRODUCTS.filter(p =>
 p.name.toLowerCase().includes(term) ||
 p.genericName?.toLowerCase().includes(term) ||
 p.manufacturer?.toLowerCase().includes(term) ||
 p.alias?.some(alias => alias.toLowerCase().includes(term)) ||
 p.therapeuticCategory?.toLowerCase().includes(term) ||
 p.hsn?.toLowerCase().includes(term)
 );
 setSearchResults(localResults);
 }
 };
 
 const timeoutId = setTimeout(performSearch, 300); // Debounce search
 return () => clearTimeout(timeoutId);
 }, [searchTerm]);

 // Number to words conversion
 // Helper function: Number to words

 // --- Cart Functions ---
 const handleProductClick = (product: Product) => {
 console.log('handleProductClick called with product:', product);
 const totalAvailableStock = product.batches?.reduce((acc, b) => acc + b.stock, 0) || 0;
 console.log('totalAvailableStock:', totalAvailableStock);
 
 if (totalAvailableStock <= 0) {
 alert("No stock available for this product. Please add stock in the Inventory tab.");
 return;
 }
 
 setSelectedProduct(product);
 console.log('setSelectedProduct called with:', product);
 setShowBatchModal(true);
 console.log('setShowBatchModal called with true');
 };

 const addBatchToCart = (batch: Batch) => {
 console.log('addBatchToCart called with batch:', batch);
 console.log('selectedProduct:', selectedProduct);
 
 if (!selectedProduct) {
 console.log('No selected product');
 return;
 }
 
 // Check batch expiry
 const batchValuation = calculateBatchValuation(batch.batchNumber, batch.expiryDate, batch.stock, batch.mrp);
 if (batchValuation.isExpiring && batchValuation.daysToExpiry < 0) {
 alert(`❌ ${batchValuation.expiryWarning} - Cannot add expired batch!`);
 return;
 }
 
 const existingIndex = cartItems.findIndex(item => 
 item.productId === selectedProduct.id && item.batchId === batch.id
 );
 
 console.log('existingIndex:', existingIndex);
 console.log('cartItems before:', cartItems);
 
 if (existingIndex >= 0) {
 // Update existing line with Tally ERP 11 calculations
 const updatedCart = [...cartItems];
 const existingItem = updatedCart[existingIndex];
 
 if (existingItem.quantity + 1 > batch.stock) {
 alert("Insufficient stock in batch.");
 return;
 }
 
 const newQty = existingItem.quantity + 1;
 
 // Use Tally ERP 11 calculation
 const lineCalc = calculateLineItem(
 selectedProduct.id,
 selectedProduct.name,
 newQty,
 existingItem.freeQuantity,
 existingItem.rate,
 existingItem.discountPercent,
 selectedProduct.gst,
 batch.mrp,
 batch.purchaseRate,
 selectedProduct.scheme,
 customerState !== stateCode, // isInterState
 stateCode,
 customerState
 );
 
 updatedCart[existingIndex] = {
 ...existingItem,
 quantity: newQty,
 discountAmount: lineCalc.discountAmount,
 taxableValue: lineCalc.taxableValue,
 cgstAmount: lineCalc.cgstAmount,
 sgstAmount: lineCalc.sgstAmount,
 igstAmount: lineCalc.igstAmount,
 totalAmount: lineCalc.totalAmount,
 // Add Tally ERP 11 fields
 ptr: lineCalc.ptr,
 pts: lineCalc.pts,
 profitPerUnit: lineCalc.profitPerUnit,
 profitPercent: lineCalc.profitPercent
 };
 
 setCartItems(updatedCart);
 console.log('Updated existing item with Tally ERP 11 calculations');
 } else {
 // Add new line with Tally ERP 11 calculations
 if (batch.stock <= 0) {
 alert("No stock available in this batch.");
 return;
 }
 
 // Calculate rates using Tally ERP 11 logic
 const rateCalc = calculateRates(batch.mrp, batch.purchaseRate);
 
 // Calculate line item with Tally ERP 11 logic
 const lineCalc = calculateLineItem(
 selectedProduct.id,
 selectedProduct.name,
 1,
 0,
 batch.mrp,
 0,
 selectedProduct.gst,
 batch.mrp,
 batch.purchaseRate,
 selectedProduct.scheme,
 customerState !== stateCode, // isInterState
 stateCode,
 customerState
 );
 
 const newItem: SalesInvoiceItem = {
 id: `item-${Date.now()}`,
 productId: selectedProduct.id,
 productName: selectedProduct.name,
 genericName: selectedProduct.genericName,
 hsn: selectedProduct.hsn,
 batchId: batch.id,
 batchNumber: batch.batchNumber,
 expiryDate: batch.expiryDate,
 quantity: 1,
 freeQuantity: 0,
 mrp: batch.mrp,
 rate: batch.mrp,
 discountPercent: 0,
 discountAmount: lineCalc.discountAmount,
 taxableValue: lineCalc.taxableValue,
 gstPercent: selectedProduct.gst,
 cgstAmount: lineCalc.cgstAmount,
 sgstAmount: lineCalc.sgstAmount,
 igstAmount: lineCalc.igstAmount,
 totalAmount: lineCalc.totalAmount,
 schemeApplied: selectedProduct.scheme,
 purchaseRate: batch.purchaseRate,
 maxStock: batch.stock,
 uom: selectedProduct.uom,
 // Add Tally ERP 11 fields
 ptr: rateCalc.ptr,
 pts: rateCalc.pts,
 profitPerUnit: rateCalc.profitPerUnit,
 profitPercent: rateCalc.profitPercent
 };
 
 setCartItems(prev => {
 const newCart = [...prev, newItem];
 console.log('Added new item with Tally ERP 11 calculations');
 return newCart;
 });
 }
 
 setShowBatchModal(false);
 };

 const updateLineItem = (index: number, updates: Partial<SalesInvoiceItem>) => {
 setCartItems(prev => {
 const updated = [...prev];
 const item = updated[index];
 
 // Validate discount if being updated
 if ('discountPercent' in updates && updates.discountPercent !== undefined) {
 const discountValidation = validateDiscount(updates.discountPercent, canGiveDiscount ? 30 : 10);
 if (!discountValidation.isValid) {
 alert(discountValidation.message);
 return prev; // Don't update if discount is invalid
 }
 if (discountValidation.message.includes('⚠️')) {
 console.warn(discountValidation.message);
 }
 }
 
 // Apply updates
 Object.assign(item, updates);
 
 // Recalculate if quantity or discount changed using Tally ERP 11 logic
 if ('quantity' in updates || 'discountPercent' in updates || 'rate' in updates) {
 const lineCalc = calculateLineItem(
 item.productId,
 item.productName,
 item.quantity,
 item.freeQuantity || 0,
 item.rate,
 item.discountPercent,
 item.gstPercent,
 item.mrp,
 item.purchaseRate,
 item.schemeApplied,
 customerState !== stateCode, // isInterState
 stateCode,
 customerState
 );
 
 item.discountAmount = lineCalc.discountAmount;
 item.taxableValue = lineCalc.taxableValue;
 item.cgstAmount = lineCalc.cgstAmount;
 item.sgstAmount = lineCalc.sgstAmount;
 item.igstAmount = lineCalc.igstAmount;
 item.totalAmount = lineCalc.totalAmount;
 
 // Add profit calculations (Tally ERP 11)
 if (!item.ptr) item.ptr = lineCalc.ptr;
 if (!item.pts) item.pts = lineCalc.pts;
 if (!item.profitPerUnit) item.profitPerUnit = lineCalc.profitPerUnit;
 if (!item.profitPercent) item.profitPercent = lineCalc.profitPercent;
 }
 
 return updated;
 });
 };

 const removeLineItem = (index: number) => {
 setCartItems(prev => prev.filter((_, i) => i !== index));
 };

 // Save invoice to database
 const handleSaveInvoice = async () => {
 if (cartItems.length === 0) {
 alert("Please add at least one item to the invoice.");
 return;
 }
 
 if (!customerName.trim()) {
 alert("Please enter customer name.");
 return;
 }
 
 // Prevent duplicate saves
 if (isSavingRef.current) {
 console.log('Save already in progress, skipping duplicate call');
 return;
 }
 
 isSavingRef.current = true;
 
 const invoice: SalesInvoice = {
 id: `inv-${Date.now()}`,
 invoiceNumber,
 date: invoiceDate,
 time: new Date().toLocaleTimeString(),
 customerName,
 customerMobile: contactNumber,
 customerGstin: gstin,
 billingAddress,
 doctorName: '',
 patientName: '',
 isH1: false,
 items: cartItems,
 totalItems: cartItems.length,
 totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity + item.freeQuantity, 0),
 subTotal: cartItems.reduce((sum, item) => sum + (item.rate * item.quantity), 0),
 taxableValue: totalTaxable,
 totalDiscount: cartItems.reduce((sum, item) => sum + item.discountAmount, 0),
 totalGst: totalCgst + totalSgst + totalIgst,
 roundOff,
 netAmount: netPayable,
 paymentMode,
 amountReceived: paymentMode === 'Credit' ? 0 : netPayable,
 balanceDue: paymentMode === 'Credit' ? netPayable : 0,
 status: 'Completed'
 };
 
 try {
 const success = await saveInvoice(invoice);
 if (success) {
 alert("Invoice saved successfully!");
 // Reset form
 setCartItems([]);
 setCustomerName('');
 setContactNumber('');
 setGstin('');
 setInvoiceNumber(`INV-${Date.now()}`);
 setInvoiceDate(new Date().toISOString().split('T')[0]);
 setActiveTab('HISTORY');
 } else {
 alert("Failed to save invoice. Please try again.");
 }
 } catch (error) {
 console.error("Error saving invoice:", error);
 alert("Error saving invoice. Please try again.");
 } finally {
 isSavingRef.current = false;
 }
 };

 // Print invoice
 const handlePrintInvoice = () => {
 if (!invoiceRef.current) return;
 
 const printContent = invoiceRef.current.innerHTML;
 const printWindow = window.open('', '_blank');
 if (printWindow) {
 printWindow.document.write(`
 <html>
 <head>
 <title>Invoice ${invoiceNumber}</title>
 <style>
 body { font-family: Arial, sans-serif; margin: 20px; }
 .invoice-header { text-align: center; margin-bottom: 20px; }
 .invoice-details { margin-bottom: 20px; }
 .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
 .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
 .items-table th { background-color: #f0f0f0; }
 .totals { margin-top: 20px; }
 .signature { margin-top: 40px; text-align: right; }
 </style>
 </head>
 <body>
 ${printContent}
 </body>
 </html>
 `);
 printWindow.document.close();
 printWindow.print();
 }
 };

 return (
 <div className="flex flex-col h-[calc(100vh-2rem)] gap-4 animate-fadeIn p-4">
 {/* Header Section */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <h2 className="text-2xl font-bold text-slate-800">Billing Terminal</h2>
 <div className="flex gap-2">
 <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm">
 <RefreshCcw size={16} className="inline mr-1" /> Refresh
 </button>
 </div>
 </div>

 {/* Tab Navigation */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="border-b border-slate-100">
 <div className="flex">
 <button 
 onClick={() => setActiveTab('MASTER')}
 className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'MASTER' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 Product Master
 </button>
 <button 
 onClick={() => setActiveTab('INVOICE')}
 className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'INVOICE' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 Create Invoice
 </button>
 <button 
 onClick={() => setActiveTab('HISTORY')}
 className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 Invoice History
 </button>
 </div>
 </div>

 {/* Product Master Tab */}
 {activeTab === 'MASTER' && (
 <div className="p-4">
 <div className="bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-lg mb-4">
 <div className="flex gap-4 flex-1 max-w-lg w-full">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Search by Brand, Generic, Manufacturer, Alias..."
 className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary outline-none shadow-sm"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <select 
 className="w-40 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary outline-none shadow-sm"
 value={sourceFilter}
 onChange={(e) => setSourceFilter(e.target.value as 'ALL' | 'PCD' | 'OWN_MANUFACTURING' | 'TRADING')}
 >
 <option value="ALL">All Sources</option>
 <option value="PCD">PCD Products</option>
 <option value="OWN_MANUFACTURING">Own Manufacturing</option>
 <option value="TRADING">Trading</option>
 </select>
 </div>
 <div className="flex gap-2">
 <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm" title="Filter">
 <Filter size={18} />
 </button>
 </div>
 </div>

 {/* Product Table */}
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10">
 <tr>
 <th className="p-4 border-b">Product</th>
 <th className="p-4 border-b">Source / Aliases</th>
 <th className="p-4 border-b">Category / Packing</th>
 <th className="p-4 border-b">Total Stock</th>
 <th className="p-4 border-b">MRP</th>
 <th className="p-4 border-b">Rack</th>
 <th className="p-4 border-b">Compliance</th>
 <th className="p-4 border-b text-center">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filteredProducts.map(product => {
 const totalStock = product.batches?.reduce((acc, b) => acc + b.stock, 0) || 0;
 const isLowStock = totalStock < product.minStockLevel;
 const hasExpiry = product.batches?.some(b => new Date(b.expiryDate) < new Date(new Date().setMonth(new Date().getMonth() + 3)));
 
 return (
 <tr key={product.id} className="hover:bg-slate-50">
 <td className="p-4">
 <div className="font-medium text-slate-800">{product.name}</div>
 <div className="text-sm text-slate-600">{product.genericName}</div>
 <div className="text-xs text-slate-500 mt-1">{product.manufacturer}</div>
 </td>
 <td className="p-4">
 <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
 product.source === 'PCD' ? 'bg-blue-100 text-accent' :
 product.source === 'OWN_MANUFACTURING' ? 'bg-green-100 text-green-700' :
 'bg-purple-100 text-purple-700'
 }`}>
 {product.source.replace('_', ' ')}
 </span>
 {product.alias && product.alias.length > 0 && (
 <div className="text-xs text-slate-500 mt-1">
 Aliases: {product.alias.join(', ')}
 </div>
 )}
 </td>
 <td className="p-4">
 <div className="text-sm text-slate-700">{product.therapeuticCategory}</div>
 <div className="text-xs text-slate-500">{product.packing}</div>
 </td>
 <td className="p-4">
 <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-slate-700'}`}>
 {totalStock}
 </span>
 {isLowStock && (
 <div className="text-xs text-red-500 mt-1">Low Stock</div>
 )}
 </td>
 <td className="p-4 text-slate-700 font-medium">
 ₹{product.batches?.[0]?.mrp || 0}
 </td>
 <td className="p-4 text-slate-600">
 {product.rack}
 </td>
 <td className="p-4">
 <div className="flex gap-1">
 <span className={`px-2 py-1 rounded-full text-xs font-bold ${
 product.scheduleType === 'H' ? 'bg-red-100 text-red-700' :
 product.scheduleType === 'H1' ? 'bg-orange-100 text-orange-700' :
 'bg-green-100 text-green-700'
 }`}>
 {product.scheduleType}
 </span>
 {hasExpiry && (
 <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
 Expiring
 </span>
 )}
 </div>
 </td>
 <td className="p-4 text-center">
 <button
 onClick={() => {
 setSelectedProductId(product.id);
 handleProductClick(product);
 }}
 className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1 mx-auto"
 >
 <Plus size={14} /> Add
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Create Invoice Tab */}
 {activeTab === 'INVOICE' && (
 <div className="p-4">
 {/* Invoice Form Content */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Left Column - Invoice Details */}
 <div className="lg:col-span-2 space-y-6">
 {/* Invoice Header */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <h3 className="text-lg font-bold text-slate-800 mb-4">Invoice Details</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
 <input
 type="text"
 value={invoiceNumber}
 onChange={(e) => setInvoiceNumber(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
 <input
 type="date"
 value={invoiceDate}
 onChange={(e) => setInvoiceDate(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Type</label>
 <select
 value={invoiceType}
 onChange={(e) => setInvoiceType(e.target.value as any)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 >
 <option value="Retail">Retail</option>
 <option value="Wholesale">Wholesale</option>
 <option value="Tax Invoice">Tax Invoice</option>
 <option value="Bill of Supply">Bill of Supply</option>
 <option value="Debit Note">Debit Note</option>
 <option value="Credit Note">Credit Note</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Financial Year</label>
 <input
 type="text"
 value={financialYear}
 onChange={(e) => setFinancialYear(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 </div>
 </div>

 {/* Customer Details */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
 <User size={20} />
 Customer Details
 </h3>
 <button
 onClick={() => setShowCustomerModal(true)}
 className="px-3 py-1 bg-accent text-white rounded-lg text-sm hover:bg-accent flex items-center gap-1"
 >
 <Plus size={16} />
 Select Customer
 </button>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name *</label>
 <input
 type="text"
 value={customerName}
 onChange={(e) => setCustomerName(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 placeholder="Enter customer name"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Customer Code</label>
 <input
 type="text"
 value={customerCode}
 onChange={(e) => setCustomerCode(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
 <input
 type="tel"
 value={contactNumber}
 onChange={(e) => setContactNumber(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
 <input
 type="text"
 value={gstin}
 onChange={(e) => setGstin(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Drug License No</label>
 <input
 type="text"
 value={drugLicenseNo}
 onChange={(e) => setDrugLicenseNo(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-slate-700 mb-1">Billing Address</label>
 <textarea
 value={billingAddress}
 onChange={(e) => setBillingAddress(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 rows={2}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
 <input
 type="text"
 value={customerState}
 onChange={(e) => setCustomerState(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 </div>
 </div>

 {/* Invoice Items Table */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-bold text-slate-800">Invoice Items</h3>
 <button
 onClick={() => setShowProductModal(true)}
 className="px-3 py-1 bg-accent text-white rounded-lg text-sm hover:bg-accent flex items-center gap-1"
 >
 <Plus size={16} />
 Add Product
 </button>
 </div>
 
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-slate-50">
 <tr>
 <th className="p-2 text-left">Product</th>
 <th className="p-2 text-left">HSN</th>
 <th className="p-2 text-left">Batch</th>
 <th className="p-2 text-left">Expiry</th>
 <th className="p-2 text-right">MRP</th>
 <th className="p-2 text-right">Rate</th>
 <th className="p-2 text-right">Qty</th>
 <th className="p-2 text-right">Free</th>
 <th className="p-2 text-right">Disc %</th>
 <th className="p-2 text-right">Taxable</th>
 <th className="p-2 text-right">GST %</th>
 <th className="p-2 text-right">Net</th>
 <th className="p-2 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {cartItems.map((item, index) => (
 <tr key={item.id} className="hover:bg-slate-50">
 <td className="p-2">
 <div className="font-medium text-slate-800">{item.productName}</div>
 <div className="text-xs text-slate-600">{item.genericName}</div>
 </td>
 <td className="p-2 text-slate-600">{item.hsn}</td>
 <td className="p-2 font-mono text-slate-700">{item.batchNumber}</td>
 <td className="p-2 text-slate-600">{item.expiryDate}</td>
 <td className="p-2 text-right">₹{item.mrp.toFixed(2)}</td>
 <td className="p-2 text-right">
 <input
 type="number"
 value={item.rate}
 onChange={(e) => updateLineItem(index, { rate: parseFloat(e.target.value) || 0 })}
 className="w-20 p-1 border border-slate-300 rounded text-right"
 />
 </td>
 <td className="p-2 text-right">
 <input
 type="number"
 value={item.quantity}
 onChange={(e) => updateLineItem(index, { quantity: parseInt(e.target.value) || 0 })}
 className="w-16 p-1 border border-slate-300 rounded text-right"
 />
 </td>
 <td className="p-2 text-right">
 <input
 type="number"
 value={item.freeQuantity}
 onChange={(e) => updateLineItem(index, { freeQuantity: parseInt(e.target.value) || 0 })}
 className="w-16 p-1 border border-slate-300 rounded text-right"
 />
 </td>
 <td className="p-2 text-right">
 <input
 type="number"
 value={item.discountPercent}
 onChange={(e) => updateLineItem(index, { discountPercent: parseFloat(e.target.value) || 0 })}
 className="w-16 p-1 border border-slate-300 rounded text-right"
 disabled={!canGiveDiscount}
 />
 </td>
 <td className="p-2 text-right text-slate-700">₹{item.taxableValue.toFixed(2)}</td>
 <td className="p-2 text-right text-slate-700">{item.gstPercent}%</td>
 <td className="p-2 text-right font-medium text-slate-800">₹{item.totalAmount.toFixed(2)}</td>
 <td className="p-2 text-center">
 <button
 onClick={() => removeLineItem(index)}
 className="p-1 text-red-600 hover:bg-red-50 rounded"
 >
 <Trash2 size={16} />
 </button>
 </td>
 </tr>
 ))}
 {cartItems.length === 0 && (
 <tr>
 <td colSpan={13} className="p-8 text-center text-slate-500">
 <Package size={32} className="mx-auto mb-2" />
 <p>No items added to invoice</p>
 <button
 onClick={() => setShowProductModal(true)}
 className="mt-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent text-sm"
 >
 Add Product
 </button>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* Right Column - Payment & Summary */}
 <div className="space-y-6">
 <QuickCalculator />

 {/* Margin Analysis Card */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden group">
 <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
 <TrendingUp size={48} className="text-green-600" />
 </div>
 <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
 <PieChart size={18} className="text-green-600" />
 Margin Analysis
 </h4>
 <div className="space-y-3 relative z-10">
 <div className="flex justify-between items-end">
 <span className="text-sm text-slate-500 font-medium">Est. Gross Margin</span>
 <span className={`text-xl font-bold ${sessionMargin >= 20 ? 'text-green-600' : 'text-orange-600'}`}>
 {sessionMargin.toFixed(1)}%
 </span>
 </div>
 <div className="w-full bg-slate-100 rounded-full h-2">
 <div 
 className={`h-2 rounded-full transition-all duration-1000 ${sessionMargin >= 20 ? 'bg-green-500' : 'bg-orange-500'}`}
 style={{ width: `${Math.min(sessionMargin, 100)}%` }}
 ></div>
 </div>
 <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 pt-1">
 <span>Est. Profit</span>
 <span className="text-slate-700">₹{estimatedProfit.toLocaleString()}</span>
 </div>
 </div>
 </div>

 {/* H1 Compliance Alert */}
 {hasH1Drugs && (
 <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-pulse">
 <AlertCircle className="text-red-600 shrink-0" size={24} />
 <div>
 <h5 className="font-bold text-red-800 text-sm">H1 Schedule Drugs Detected</h5>
 <p className="text-xs text-red-600 mt-1">Patient Name, Address and Dr. Details are mandatory for this invoice.</p>
 </div>
 </div>
 )}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <h4 className="font-bold text-slate-800 mb-3">Payment Details</h4>
 <div className="space-y-3">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
 <select
 value={paymentMode}
 onChange={(e) => setPaymentMode(e.target.value as any)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 >
 <option value="Cash">Cash</option>
 <option value="UPI">UPI</option>
 <option value="Card">Card</option>
 <option value="Credit">Credit</option>
 </select>
 </div>
 {paymentMode === 'Credit' && (
 <>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Credit Days</label>
 <input
 type="number"
 value={creditDays}
 onChange={(e) => setCreditDays(parseInt(e.target.value) || 0)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
 <input
 type="date"
 value={dueDate}
 onChange={(e) => setDueDate(e.target.value)}
 className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 </>
 )}
 </div>
 </div>

 {/* Invoice Summary */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <h4 className="font-bold text-slate-800 mb-3">Invoice Summary</h4>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span>Taxable Amount:</span>
 <span className="font-medium">₹{totalTaxable.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>CGST:</span>
 <span className="font-medium">₹{totalCgst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>SGST:</span>
 <span className="font-medium">₹{totalSgst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>IGST:</span>
 <span className="font-medium">₹{totalIgst.toFixed(2)}</span>
 </div>
 <div className="flex justify-between">
 <span>Freight Charges:</span>
 <span className="font-medium">₹{freightCharges.toFixed(2)}</span>
 </div>
 <div className="flex justify-between py-2 border-t border-slate-200">
 <span className="font-bold text-lg">Net Payable:</span>
 <span className="font-bold text-lg text-accent">₹{netPayable.toFixed(2)}</span>
 </div>
 <div className="pt-2 border-t border-slate-200">
 <span className="text-sm text-slate-600">Amount in Words: </span>
 <span className="text-sm font-medium text-slate-800">{amountInWords} Only</span>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
 <div className="space-y-3">
 <button
 onClick={() => {
 if (window.confirm('Clear all invoice items?')) {
 setCartItems([]);
 }
 }}
 className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
 >
 <Trash2 size={18} />
 Clear Invoice
 </button>
 <button
 onClick={handlePrintInvoice}
 disabled={cartItems.length === 0}
 className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 <Printer size={18} />
 Print Invoice
 </button>
 <button
 onClick={handleSaveInvoice}
 disabled={cartItems.length === 0}
 className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 <Save size={18} />
 Save Invoice
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Invoice History Tab */}
 {activeTab === 'HISTORY' && (
 <div className="p-4">
 {/* Enhanced Search and Filter Section */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4">
 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
 <Search size={20} className="text-accent" />
 Invoice Search & Filters
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
 {/* Search Input */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Search by invoice #, customer name, mobile..."
 value={invoiceHistorySearch}
 onChange={(e) => setInvoiceHistorySearch(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 />
 </div>
 
 {/* Status Filter */}
 <select
 value={invoiceStatusFilter}
 onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
 className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 >
 <option value="all">All Statuses</option>
 <option value="Completed">Completed</option>
 <option value="Pending">Pending</option>
 <option value="Cancelled">Cancelled</option>
 </select>
 
 {/* Date Filter */}
 <select
 value={invoiceDateFilter}
 onChange={(e) => setInvoiceDateFilter(e.target.value as any)}
 className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 >
 <option value="all">All Dates</option>
 <option value="today">Today</option>
 <option value="week">Last 7 Days</option>
 <option value="month">Last 30 Days</option>
 <option value="custom">Custom Range</option>
 </select>
 
 {/* Customer Filter */}
 <div className="relative">
 <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Filter by customer"
 value={invoiceCustomerFilter}
 onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 />
 </div>
 </div>
 
 {/* Custom Date Range */}
 {invoiceDateFilter === 'custom' && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
 <input
 type="date"
 value={customStartDate}
 onChange={(e) => setCustomStartDate(e.target.value)}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
 <input
 type="date"
 value={customEndDate}
 onChange={(e) => setCustomEndDate(e.target.value)}
 className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
 />
 </div>
 </div>
 )}
 
 {/* Filter Summary */}
 <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
 <span>Showing {filteredInvoices.length} of {savedInvoices.length} invoices</span>
 {invoiceHistorySearch && (
 <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
 Search: "{invoiceHistorySearch}"
 </span>
 )}
 {invoiceStatusFilter !== 'all' && (
 <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
 Status: {invoiceStatusFilter}
 </span>
 )}
 {invoiceDateFilter !== 'all' && (
 <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
 Date: {invoiceDateFilter}
 </span>
 )}
 {invoiceCustomerFilter && (
 <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
 Customer: "{invoiceCustomerFilter}"
 </span>
 )}
 <button
 onClick={() => {
 setInvoiceHistorySearch('');
 setInvoiceStatusFilter('all');
 setInvoiceDateFilter('all');
 setInvoiceCustomerFilter('');
 setCustomStartDate('');
 setCustomEndDate('');
 }}
 className="text-accent hover:text-blue-800 font-medium"
 >
 Clear All Filters
 </button>
 </div>
 </div>
 
 {/* Invoice History Header */}
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-xl font-bold text-slate-800">Invoice History</h3>
 <button
 onClick={() => {
 setLoadingHistory(true);
 getAllInvoices().then(invoices => {
 setSavedInvoices(invoices);
 setLoadingHistory(false);
 }).catch(error => {
 console.error('Error refreshing invoices:', error);
 setLoadingHistory(false);
 });
 }}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent flex items-center gap-2"
 disabled={loadingHistory}
 >
 <RefreshCcw size={16} className={loadingHistory ? 'animate-spin' : ''} />
 {loadingHistory ? 'Loading...' : 'Refresh'}
 </button>
 </div>
 
 {loadingHistory ? (
 <div className="text-center py-12">
 <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
 <p className="mt-4 text-slate-600">Loading invoice history...</p>
 </div>
 ) : filteredInvoices.length === 0 ? (
 <div className="text-center py-12 text-slate-500">
 <FileText size={48} className="mx-auto mb-4 opacity-50" />
 <h3 className="text-xl font-medium mb-2">No Invoices Found</h3>
 <p className="text-slate-400">
 {savedInvoices.length === 0 
 ? 'Create your first invoice to see it here' 
 : 'No invoices match your current search criteria'}
 </p>
 {filteredInvoices.length === 0 && savedInvoices.length > 0 && (
 <button
 onClick={() => {
 setInvoiceHistorySearch('');
 setInvoiceStatusFilter('all');
 setInvoiceDateFilter('all');
 setInvoiceCustomerFilter('');
 setCustomStartDate('');
 setCustomEndDate('');
 }}
 className="mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent"
 >
 Clear All Filters
 </button>
 )}
 {savedInvoices.length === 0 && (
 <button
 onClick={() => setActiveTab('INVOICE')}
 className="mt-4 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent"
 >
 Create New Invoice
 </button>
 )}
 </div>
 ) : (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider sticky top-0 z-10">
 <tr>
 <th className="p-4 border-b">Invoice No</th>
 <th className="p-4 border-b">Date</th>
 <th className="p-4 border-b">Customer</th>
 <th className="p-4 border-b">Items</th>
 <th className="p-4 border-b">Amount</th>
 <th className="p-4 border-b">Status</th>
 <th className="p-4 border-b">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filteredInvoices.map((invoice) => (
 <tr key={invoice.id} className="hover:bg-slate-50">
 <td className="p-4 font-mono font-medium text-accent">
 {invoice.invoiceNumber}
 </td>
 <td className="p-4 text-slate-700">
 {new Date(invoice.date).toLocaleDateString()}
 </td>
 <td className="p-4">
 <div className="font-medium text-slate-800">{invoice.customerName}</div>
 {invoice.customerMobile && (
 <div className="text-sm text-slate-600">{invoice.customerMobile}</div>
 )}
 </td>
 <td className="p-4 text-slate-700">
 {invoice.totalItems} items
 </td>
 <td className="p-4 font-bold text-slate-800">
 ₹{invoice.netAmount?.toFixed(2) || '0.00'}
 </td>
 <td className="p-4">
 <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
 invoice.status === 'Completed' 
 ? 'bg-green-100 text-green-700' 
 : 'bg-yellow-100 text-yellow-700'
 }`}>
 {invoice.status}
 </span>
 </td>
 <td className="p-4">
 <div className="flex gap-2">
 <button
 onClick={() => {
 // View invoice details
 alert(`Invoice Details:\n\nInvoice No: ${invoice.invoiceNumber}\nDate: ${invoice.date}\nCustomer: ${invoice.customerName}\nAmount: ₹${invoice.netAmount?.toFixed(2)}`);
 }}
 className="px-3 py-1 bg-accent text-white rounded-lg text-sm hover:bg-accent"
 >
 View
 </button>
 <button
 onClick={() => {
 // Print invoice
 const printContent = `
 <div style="font-family: Arial, sans-serif; padding: 20px;">
 <h1 style="text-align: center; margin-bottom: 20px;">MARG ERP - SALES INVOICE</h1>
 <div style="margin-bottom: 20px;">
 <p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
 <p><strong>Date:</strong> ${invoice.date}</p>
 <p><strong>Customer:</strong> ${invoice.customerName}</p>
 <p><strong>Payment Mode:</strong> ${invoice.paymentMode}</p>
 </div>
 <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
 <thead>
 <tr>
 <th style="border: 1px solid #000; padding: 8px; text-align: left;">Product</th>
 <th style="border: 1px solid #000; padding: 8px; text-align: right;">Qty</th>
 <th style="border: 1px solid #000; padding: 8px; text-align: right;">Rate</th>
 <th style="border: 1px solid #000; padding: 8px; text-align: right;">Amount</th>
 </tr>
 </thead>
 <tbody>
 ${invoice.items.map(item => `
 <tr>
 <td style="border: 1px solid #000; padding: 8px;">${item.productName}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: right;">${item.quantity}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: right;">₹${item.rate.toFixed(2)}</td>
 <td style="border: 1px solid #000; padding: 8px; text-align: right;">₹${item.totalAmount.toFixed(2)}</td>
 </tr>
 `).join('')}
 </tbody>
 </table>
 <div style="text-align: right; font-weight: bold; font-size: 18px;">
 Net Payable: ₹${invoice.netAmount?.toFixed(2)}
 </div>
 </div>
 `;
 
 const printWindow = window.open('', '_blank');
 if (printWindow) {
 printWindow.document.write(`
 <html>
 <head>
 <title>Invoice ${invoice.invoiceNumber}</title>
 </head>
 <body>
 ${printContent}
 </body>
 </html>
 `);
 printWindow.document.close();
 printWindow.print();
 }
 }}
 className="px-3 py-1 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700"
 >
 Print
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Hidden Printable Invoice */}
 <div ref={invoiceRef} className="hidden">
 <div className="invoice-header">
 <h1>MARG ERP - SALES INVOICE</h1>
 <p>Invoice No: {invoiceNumber}</p>
 <p>Date: {invoiceDate}</p>
 </div>
 
 <div className="invoice-details">
 <p><strong>Customer:</strong> {customerName}</p>
 <p><strong>Billing Address:</strong> {billingAddress}</p>
 {gstin && <p><strong>GSTIN:</strong> {gstin}</p>}
 </div>
 
 <table className="items-table">
 <thead>
 <tr>
 <th>Product</th>
 <th>Batch</th>
 <th>HSN</th>
 <th>Qty</th>
 <th>Rate</th>
 <th>Amount</th>
 <th>GST%</th>
 <th>Tax Amt</th>
 </tr>
 </thead>
 <tbody>
 {cartItems.map((item) => (
 <tr key={item.id}>
 <td>{item.productName}</td>
 <td>{item.batchNumber}</td>
 <td>{item.hsn}</td>
 <td>{item.quantity}</td>
 <td>₹{item.rate.toFixed(2)}</td>
 <td>₹{item.totalAmount.toFixed(2)}</td>
 <td>{item.gstPercent}%</td>
 <td>₹{(item.cgstAmount + item.sgstAmount).toFixed(2)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 
 <div className="totals">
 <p><strong>Net Payable:</strong> ₹{netPayable.toFixed(2)}</p>
 <p><strong>Amount in Words:</strong> {numberToWords(Math.round(netPayable))} Only</p>
 </div>
 
 <div className="signature">
 <p>Authorized Signatory</p>
 </div>
 </div>

 {/* Product Selection Modal */}
 {showProductModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2">
 <Package size={18} />
 Select Product
 </h3>
 <button onClick={() => setShowProductModal(false)} className="hover:bg-slate-700 p-1 rounded">
 <X size={18} />
 </button>
 </div>
 
 <div className="p-4">
 <div className="mb-4">
 <label className="block text-sm font-medium text-slate-700 mb-2">
 Search Product (by name, alias, generic, manufacturer)
 </label>
 <div className="relative">
 <Search className="absolute left-3 top-3 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Type product name, alias, or generic name..."
 className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 autoFocus
 />
 </div>
 </div>
 
 <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg">
 {filteredProducts.length > 0 ? (
 <div className="divide-y divide-slate-100">
 {filteredProducts.map(product => {
 const totalStock = product.batches?.reduce((acc, b) => acc + b.stock, 0) || 0;
 const isLowStock = totalStock < product.minStockLevel;
 
 return (
 <div 
 key={product.id}
 className="p-3 hover:bg-blue-50 cursor-pointer"
 onClick={() => {
 setSelectedProduct(product);
 setShowProductModal(false);
 setShowBatchModal(true);
 }}
 >
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="font-medium text-slate-800">{product.name}</div>
 <div className="text-sm text-slate-600">{product.genericName}</div>
 <div className="text-xs text-slate-500 mt-1">
 Manufacturer: {product.manufacturer}
 </div>
 {product.alias && product.alias.length > 0 && (
 <div className="text-xs text-accent mt-1">
 Aliases: {product.alias.join(', ')}
 </div>
 )}
 </div>
 <div className="text-right">
 <div className="text-sm font-bold text-slate-700">
 ₹{product.batches?.[0]?.mrp || 0}
 </div>
 <div className={`text-xs font-medium ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
 Stock: {totalStock}
 </div>
 <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold mt-1 ${
 product.source === 'PCD' ? 'bg-blue-100 text-accent' :
 product.source === 'OWN_MANUFACTURING' ? 'bg-green-100 text-green-700' :
 'bg-purple-100 text-purple-700'
 }`}>
 {product.source.replace('_', ' ')}
 </span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 ) : (
 <div className="p-8 text-center text-slate-500">
 <Package size={32} className="mx-auto mb-2" />
 <p>No products found</p>
 <p className="text-sm mt-1">Try different search terms or check inventory</p>
 </div>
 )}
 </div>
 </div>
 
 <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between">
 <button
 onClick={() => setShowProductModal(false)}
 className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
 >
 Cancel
 </button>
 <button
 onClick={() => setActiveTab('MASTER')}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent flex items-center gap-2"
 >
 <Layers size={16} />
 Browse Products
 </button>
 </div>
 </div>
 </div>
 )}
 
 {/* Batch Selection Modal */}
 {showBatchModal && selectedProduct && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <div>
 <h3 className="font-bold flex items-center gap-2">
 <Package size={18} />
 Select Batch
 </h3>
 <div className="flex items-center gap-2 mt-1">
 <p className="text-xs text-slate-400">{selectedProduct.name} - {selectedProduct.genericName}</p>
 {selectedProduct.scheme && (
 <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 rounded font-bold border border-yellow-500/50 flex items-center gap-1">
 <Gift size={8} /> {selectedProduct.scheme} Offer
 </span>
 )}
 </div>
 </div>
 <button onClick={() => setShowBatchModal(false)} className="hover:bg-slate-700 p-1 rounded">
 <X size={18} />
 </button>
 </div>
 
 <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex items-start gap-3">
 <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
 <p className="text-xs text-yellow-800">
 System automatically sorts batches by <strong>FEFO (First Expiry First Out)</strong>. 
 Please prioritize the top batch.
 </p>
 </div>

 <div className="max-h-[400px] overflow-y-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
 <tr>
 <th className="p-3">Batch No</th>
 <th className="p-3">Expiry</th>
 <th className="p-3 text-right">MRP</th>
 <th className="p-3 text-right">Stock</th>
 <th className="p-3 text-center">Status</th>
 <th className="p-3 text-center">Action</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {selectedProduct.batches?.sort((a,b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()).map((batch, idx) => {
 const daysToExpiry = Math.ceil((new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
 const isExpired = daysToExpiry < 0;
 const isNearExpiry = daysToExpiry < 90 && !isExpired;
 const hasStock = batch.stock > 0;

 return (
 <tr key={batch.id} className={`hover:bg-slate-50 ${idx === 0 && hasStock ? 'bg-green-50/50' : ''}`}>
 <td className="p-3 font-mono font-medium text-slate-700">
 {batch.batchNumber}
 {idx === 0 && hasStock && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 font-bold">FEFO</span>}
 </td>
 <td className="p-3">
 <span className={isExpired ? 'text-red-600 font-bold' : isNearExpiry ? 'text-orange-600 font-bold' : 'text-slate-600'}>
 {batch.expiryDate}
 </span>
 </td>
 <td className="p-3 text-right">₹{batch.mrp}</td>
 <td className="p-3 text-right font-bold">{batch.stock}</td>
 <td className="p-3 text-center">
 {isExpired ? (
 <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">EXPIRED</span>
 ) : !hasStock ? (
 <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">NO STOCK</span>
 ) : isNearExpiry ? (
 <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold">NEAR EXPIRY</span>
 ) : (
 <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">ACTIVE</span>
 )}
 </td>
 <td className="p-3 text-center">
 <button 
 onClick={() => addBatchToCart(batch)}
 disabled={!hasStock || isExpired}
 className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
 !hasStock || isExpired 
 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
 : 'bg-green-600 text-white hover:bg-green-700'
 }`}
 >
 Add
 </button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Customer Selection Modal */}
 {showCustomerModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2">
 <User size={18} />
 Select Customer
 </h3>
 <button onClick={() => setShowCustomerModal(false)} className="hover:bg-slate-700 p-1 rounded">
 <X size={18} />
 </button>
 </div>
 
 <div className="p-4 max-h-[400px] overflow-y-auto">
 <div className="space-y-2">
 {existingParties.map(party => (
 <div 
 key={party.id}
 className="p-3 border border-slate-200 rounded-lg hover:bg-blue-50 cursor-pointer"
 onClick={() => {
 setCustomerName(party.name);
 setContactNumber(party.mobile);
 setGstin(party.gstin || '');
 setShowCustomerModal(false);
 }}
 >
 <div className="font-medium text-slate-800">{party.name}</div>
 <div className="text-sm text-slate-600">{party.mobile}</div>
 {party.gstin && <div className="text-xs text-slate-500">GSTIN: {party.gstin}</div>}
 </div>
 ))}
 {existingParties.length === 0 && (
 <div className="text-center py-8 text-slate-500">
 <User size={32} className="mx-auto mb-2" />
 <p>No customers found</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Register keyboard shortcuts for POS */}
 {activeTab === 'INVOICE' && (
 <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm shadow-none">
 <div className="flex items-center gap-3">
 <span className="font-medium">Shortcuts:</span>
 <span>Ctrl+S = Save</span>
 <span>Ctrl+Shift+P = Print</span>
 <span>Ctrl+F = Search</span>
 </div>
 </div>
 )}
 </div>
 );

 // Register keyboard shortcuts for POS (after all functions are declared)
 useEffect(() => {
 const handleKeyDown = (event: KeyboardEvent) => {
 // Prevent shortcuts from triggering when typing in inputs
 if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
 return;
 }

 // Save invoice (Ctrl+S)
 if (event.ctrlKey && event.key === 's') {
 event.preventDefault();
 if (cartItems.length > 0 && customerName.trim() && activeTab === 'INVOICE') {
 handleSaveInvoice();
 }
 }
 
 // Print invoice (Ctrl+Shift+P)
 if (event.ctrlKey && event.shiftKey && event.key === 'P') {
 event.preventDefault();
 if (cartItems.length > 0 && activeTab === 'INVOICE') {
 handlePrintInvoice();
 }
 }
 
 // Focus search (Ctrl+F)
 if (event.ctrlKey && event.key === 'f') {
 event.preventDefault();
 if (activeTab === 'MASTER' || activeTab === 'INVOICE') {
 const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
 if (searchInput) {
 searchInput.focus();
 }
 }
 }
 
 // Clear invoice (Ctrl+Shift+C)
 if (event.ctrlKey && event.shiftKey && event.key === 'C') {
 event.preventDefault();
 if (activeTab === 'INVOICE') {
 if (window.confirm('Clear all invoice items?')) {
 setCartItems([]);
 }
 }
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => {
 window.removeEventListener('keydown', handleKeyDown);
 };
 }, [cartItems, customerName, activeTab]);

};

export default POSInventoryStyle;

