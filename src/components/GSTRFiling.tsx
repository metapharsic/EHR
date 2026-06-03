import React, { useState, useMemo } from 'react';
import { 
 FileText, Download, Calendar, Calculator, CheckCircle, 
 AlertCircle, Building2, Percent, TrendingUp, AlertTriangle,
 Printer, Save, RefreshCw, Search, Filter, ArrowRight,
 IndianRupee, Receipt, Truck, Package, FileSpreadsheet,
 ChevronDown, ChevronUp, Clock, CheckSquare, XCircle,
 Info, Copy, ExternalLink
} from 'lucide-react';

interface GSTInvoice {
 id: string;
 invoiceNo: string;
 invoiceDate: string;
 customerName: string;
 customerGSTIN: string;
 placeOfSupply: string;
 taxableValue: number;
 cgstRate: number;
 sgstRate: number;
 igstRate: number;
 cgstAmount: number;
 sgstAmount: number;
 igstAmount: number;
 totalAmount: number;
 invoiceType: 'B2B' | 'B2C' | 'Export' | 'SEZ';
 reverseCharge: boolean;
 eInvoiceStatus: 'Pending' | 'Generated' | 'Cancelled';
 eInvoiceNo?: string;
}

interface GSTR1Data {
 period: string;
 filingStatus: 'Pending' | 'Filed' | 'Late';
 filingDate?: string;
 b2bInvoices: GSTInvoice[];
 b2cLargeInvoices: GSTInvoice[];
 exports: GSTInvoice[];
 summary: {
 totalTaxableValue: number;
 totalCGST: number;
 totalSGST: number;
 totalIGST: number;
 totalInvoices: number;
 };
}

interface GSTR3BData {
 period: string;
 filingStatus: 'Pending' | 'Filed' | 'Late';
 filingDate?: string;
 
 // 3.1 Tax on outward and reverse charge inward supplies
 outwardSupplies: {
 taxableValue: number;
 integratedTax: number;
 centralTax: number;
 stateTax: number;
 cess: number;
 };
 
 // 3.2 Inter-state supplies
 interStateSupplies: {
 taxableValue: number;
 integratedTax: number;
 };
 
 // 4. Eligible ITC
 eligibleITC: {
 integratedTax: number;
 centralTax: number;
 stateTax: number;
 cess: number;
 };
 
 // 5. Values of exempt, nil-rated and non-GST inward supplies
 exemptSupplies: {
 interState: number;
 intraState: number;
 };
 
 // 5.1 Interest and late fee
 interestAndLateFee: {
 integratedTax: number;
 centralTax: number;
 stateTax: number;
 cess: number;
 };
 
 // Net tax payable
 netTaxPayable: {
 integratedTax: number;
 centralTax: number;
 stateTax: number;
 cess: number;
 };
}

interface GSTReturnPeriod {
 month: number;
 year: number;
 label: string;
 dueDate: string;
 gstr1Status: 'Pending' | 'Filed' | 'Late';
 gstr3bStatus: 'Pending' | 'Filed' | 'Late';
}

const GSTReturnFiling: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b' | 'history' | 'settings'>('gstr1');
 const [selectedPeriod, setSelectedPeriod] = useState<string>('');
 const [isGenerating, setIsGenerating] = useState(false);
 const [showJsonPreview, setShowJsonPreview] = useState(false);
 const [expandedSections, setExpandedSections] = useState<string[]>(['b2b']);

 // Generate GST return periods
 const returnPeriods: GSTReturnPeriod[] = useMemo(() => {
 const periods: GSTReturnPeriod[] = [];
 const currentDate = new Date();
 
 for (let i = 0; i < 12; i++) {
 const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
 const month = date.toLocaleString('default', { month: 'long' });
 const year = date.getFullYear();
 const monthNum = date.getMonth() + 1;
 
 // Due date is 11th of next month for GSTR-1, 20th for GSTR-3B
 const dueDate = new Date(year, monthNum, 11);
 const gstr3bDueDate = new Date(year, monthNum, 20);
 
 periods.push({
 month: monthNum,
 year,
 label: `${month} ${year}`,
 dueDate: dueDate.toISOString().split('T')[0],
 gstr1Status: i === 0 ? 'Pending' : i === 1 ? 'Filed' : 'Filed',
 gstr3bStatus: i === 0 ? 'Pending' : i === 1 ? 'Filed' : 'Filed'
 });
 }
 
 return periods;
 }, []);

 // Demo GST Invoices
 const demoInvoices: GSTInvoice[] = [
 {
 id: 'INV001',
 invoiceNo: 'MP/2024/0001',
 invoiceDate: '2024-04-05',
 customerName: 'MediCare Pharmacy Pvt Ltd',
 customerGSTIN: '27AABCU9603R1ZX',
 placeOfSupply: '27-Maharashtra',
 taxableValue: 85000,
 cgstRate: 6,
 sgstRate: 6,
 igstRate: 0,
 cgstAmount: 5100,
 sgstAmount: 5100,
 igstAmount: 0,
 totalAmount: 95200,
 invoiceType: 'B2B',
 reverseCharge: false,
 eInvoiceStatus: 'Generated',
 eInvoiceNo: 'e-Invoice-001'
 },
 {
 id: 'INV002',
 invoiceNo: 'MP/2024/0002',
 invoiceDate: '2024-04-08',
 customerName: 'HealthCare Distributors',
 customerGSTIN: '29AABCU9603R1ZY',
 placeOfSupply: '29-Karnataka',
 taxableValue: 120000,
 cgstRate: 0,
 sgstRate: 0,
 igstRate: 12,
 cgstAmount: 0,
 sgstAmount: 0,
 igstAmount: 14400,
 totalAmount: 134400,
 invoiceType: 'B2B',
 reverseCharge: false,
 eInvoiceStatus: 'Generated',
 eInvoiceNo: 'e-Invoice-002'
 },
 {
 id: 'INV003',
 invoiceNo: 'MP/2024/0003',
 invoiceDate: '2024-04-12',
 customerName: 'Walk-in Customer',
 customerGSTIN: '',
 placeOfSupply: '27-Maharashtra',
 taxableValue: 5500,
 cgstRate: 6,
 sgstRate: 6,
 igstRate: 0,
 cgstAmount: 330,
 sgstAmount: 330,
 igstAmount: 0,
 totalAmount: 6160,
 invoiceType: 'B2C',
 reverseCharge: false,
 eInvoiceStatus: 'Pending'
 },
 {
 id: 'INV004',
 invoiceNo: 'EXP/2024/0001',
 invoiceDate: '2024-04-15',
 customerName: 'Global Pharma Inc',
 customerGSTIN: 'UIN-EXP-001',
 placeOfSupply: '96-Export',
 taxableValue: 250000,
 cgstRate: 0,
 sgstRate: 0,
 igstRate: 0,
 cgstAmount: 0,
 sgstAmount: 0,
 igstAmount: 0,
 totalAmount: 250000,
 invoiceType: 'Export',
 reverseCharge: false,
 eInvoiceStatus: 'Generated',
 eInvoiceNo: 'e-Invoice-EXP-001'
 },
 {
 id: 'INV005',
 invoiceNo: 'MP/2024/0005',
 invoiceDate: '2024-04-18',
 customerName: 'City Hospital Trust',
 customerGSTIN: '27AAAAA0000A1Z5',
 placeOfSupply: '27-Maharashtra',
 taxableValue: 185000,
 cgstRate: 6,
 sgstRate: 6,
 igstRate: 0,
 cgstAmount: 11100,
 sgstAmount: 11100,
 igstAmount: 0,
 totalAmount: 207200,
 invoiceType: 'B2B',
 reverseCharge: false,
 eInvoiceStatus: 'Generated',
 eInvoiceNo: 'e-Invoice-005'
 }
 ];

 // Calculate GSTR-1 Summary
 const gstr1Summary = useMemo(() => {
 const b2b = demoInvoices.filter(inv => inv.invoiceType === 'B2B');
 const b2c = demoInvoices.filter(inv => inv.invoiceType === 'B2C');
 const exports = demoInvoices.filter(inv => inv.invoiceType === 'Export');
 
 return {
 b2b: {
 count: b2b.length,
 taxableValue: b2b.reduce((sum, inv) => sum + inv.taxableValue, 0),
 cgst: b2b.reduce((sum, inv) => sum + inv.cgstAmount, 0),
 sgst: b2b.reduce((sum, inv) => sum + inv.sgstAmount, 0),
 igst: b2b.reduce((sum, inv) => sum + inv.igstAmount, 0)
 },
 b2c: {
 count: b2c.length,
 taxableValue: b2c.reduce((sum, inv) => sum + inv.taxableValue, 0),
 cgst: b2c.reduce((sum, inv) => sum + inv.cgstAmount, 0),
 sgst: b2c.reduce((sum, inv) => sum + inv.sgstAmount, 0),
 igst: b2c.reduce((sum, inv) => sum + inv.igstAmount, 0)
 },
 exports: {
 count: exports.length,
 taxableValue: exports.reduce((sum, inv) => sum + inv.taxableValue, 0),
 cgst: 0,
 sgst: 0,
 igst: 0
 },
 total: {
 count: demoInvoices.length,
 taxableValue: demoInvoices.reduce((sum, inv) => sum + inv.taxableValue, 0),
 cgst: demoInvoices.reduce((sum, inv) => sum + inv.cgstAmount, 0),
 sgst: demoInvoices.reduce((sum, inv) => sum + inv.sgstAmount, 0),
 igst: demoInvoices.reduce((sum, inv) => sum + inv.igstAmount, 0)
 }
 };
 }, [demoInvoices]);

 // Generate GSTR-3B Data
 const gstr3bData: GSTR3BData = {
 period: selectedPeriod || 'April 2024',
 filingStatus: 'Pending',
 outwardSupplies: {
 taxableValue: gstr1Summary.total.taxableValue,
 integratedTax: gstr1Summary.total.igst,
 centralTax: gstr1Summary.total.cgst,
 stateTax: gstr1Summary.total.sgst,
 cess: 0
 },
 interStateSupplies: {
 taxableValue: 120000,
 integratedTax: 14400
 },
 eligibleITC: {
 integratedTax: 8500,
 centralTax: 6200,
 stateTax: 6200,
 cess: 0
 },
 exemptSupplies: {
 interState: 0,
 intraState: 0
 },
 interestAndLateFee: {
 integratedTax: 0,
 centralTax: 0,
 stateTax: 0,
 cess: 0
 },
 netTaxPayable: {
 integratedTax: gstr1Summary.total.igst - 8500,
 centralTax: gstr1Summary.total.cgst - 6200,
 stateTax: gstr1Summary.total.sgst - 6200,
 cess: 0
 }
 };

 const generateJSON = (type: 'gstr1' | 'gstr3b') => {
 const data = type === 'gstr1' ? {
 gstin: '27AABCU9603R1ZX',
 fp: selectedPeriod?.replace(' ', '') || '042024',
 b2b: demoInvoices.filter(inv => inv.invoiceType === 'B2B').map(inv => ({
 ctin: inv.customerGSTIN,
 inv: [{
 inum: inv.invoiceNo,
 idt: inv.invoiceDate,
 val: inv.totalAmount,
 pos: inv.placeOfSupply.split('-')[0],
 rchrg: inv.reverseCharge ? 'Y' : 'N',
 inv_typ: 'R',
 itms: [{
 num: 1,
 itm_det: {
 rt: inv.cgstRate + inv.sgstRate + inv.igstRate,
 txval: inv.taxableValue,
 iamt: inv.igstAmount,
 camt: inv.cgstAmount,
 samt: inv.sgstAmount
 }
 }]
 }]
 }))
 } : gstr3bData;
 
 return JSON.stringify(data, null, 2);
 };

 const downloadJSON = (type: 'gstr1' | 'gstr3b') => {
 const json = generateJSON(type);
 const blob = new Blob([json], { type: 'application/json' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `${type.toUpperCase()}_${selectedPeriod?.replace(' ', '_') || 'April_2024'}.json`;
 link.click();
 };

 const toggleSection = (section: string) => {
 if (expandedSections.includes(section)) {
 setExpandedSections(expandedSections.filter(s => s !== section));
 } else {
 setExpandedSections([...expandedSections, section]);
 }
 };

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
 {/* Header */}
 <div className="p-4 border-b border-slate-100 bg-accent text-white">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <IndianRupee size={28} />
 <div>
 <h3 className="font-bold text-lg">GST Return Filing</h3>
 <p className="text-blue-100 text-sm">GSTR-1 & GSTR-3B Compliance</p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-right">
 <div className="text-sm text-blue-100">GSTIN</div>
 <div className="font-mono font-semibold">27AABCU9603R1ZX</div>
 </div>
 <div className="text-right">
 <div className="text-sm text-blue-100">Business Name</div>
 <div className="font-semibold">Metapharsic Pharma Pvt Ltd</div>
 </div>
 </div>
 </div>
 </div>

 {/* Navigation Tabs */}
 <div className="border-b border-slate-200 bg-slate-50">
 <div className="flex">
 {[
 { id: 'gstr1', label: 'GSTR-1 (Outward Supplies)', icon: Truck },
 { id: 'gstr3b', label: 'GSTR-3B (Monthly Return)', icon: FileText },
 { id: 'history', label: 'Filing History', icon: Calendar },
 { id: 'settings', label: 'GST Settings', icon: Building2 }
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
 activeTab === tab.id 
 ? 'bg-white text-accent border-b-2 border-accent' 
 : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
 }`}
 >
 <tab.icon size={16} />
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* Period Selector */}
 <div className="p-4 border-b border-slate-200 bg-white">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <Calendar size={18} className="text-slate-400" />
 <span className="font-medium text-slate-700">Return Period:</span>
 </div>
 <select
 value={selectedPeriod}
 onChange={(e) => setSelectedPeriod(e.target.value)}
 className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
 >
 <option value="">Select Period</option>
 {returnPeriods.map(period => (
 <option key={period.label} value={period.label}>
 {period.label} (Due: {new Date(period.dueDate).toLocaleDateString()})
 </option>
 ))}
 </select>
 
 {selectedPeriod && (
 <div className="flex gap-2">
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${
 returnPeriods.find(p => p.label === selectedPeriod)?.gstr1Status === 'Filed' 
 ? 'bg-green-100 text-green-700' 
 : 'bg-yellow-100 text-yellow-700'
 }`}>
 GSTR-1: {returnPeriods.find(p => p.label === selectedPeriod)?.gstr1Status}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${
 returnPeriods.find(p => p.label === selectedPeriod)?.gstr3bStatus === 'Filed' 
 ? 'bg-green-100 text-green-700' 
 : 'bg-yellow-100 text-yellow-700'
 }`}>
 GSTR-3B: {returnPeriods.find(p => p.label === selectedPeriod)?.gstr3bStatus}
 </span>
 </div>
 )}
 </div>
 </div>

 {/* GSTR-1 Content */}
 {activeTab === 'gstr1' && (
 <div className="flex-1 overflow-auto p-6">
 {!selectedPeriod ? (
 <div className="text-center py-12 text-slate-400">
 <Calendar size={64} className="mx-auto mb-4 opacity-20" />
 <p className="text-lg">Select a return period to view GSTR-1 data</p>
 </div>
 ) : (
 <div className="space-y-6">
 {/* Summary Cards */}
 <div className="grid grid-cols-4 gap-4">
 <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
 <div className="text-sm text-accent font-medium">Total Invoices</div>
 <div className="text-2xl font-bold text-slate-800">{gstr1Summary.total.count}</div>
 </div>
 <div className="bg-green-50 rounded-xl p-4 border border-green-200">
 <div className="text-sm text-green-600 font-medium">Taxable Value</div>
 <div className="text-2xl font-bold text-slate-800">₹{gstr1Summary.total.taxableValue.toLocaleString()}</div>
 </div>
 <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
 <div className="text-sm text-purple-600 font-medium">CGST + SGST</div>
 <div className="text-2xl font-bold text-slate-800">₹{(gstr1Summary.total.cgst + gstr1Summary.total.sgst).toLocaleString()}</div>
 </div>
 <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
 <div className="text-sm text-orange-600 font-medium">IGST</div>
 <div className="text-2xl font-bold text-slate-800">₹{gstr1Summary.total.igst.toLocaleString()}</div>
 </div>
 </div>

 {/* B2B Invoices Section */}
 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <button
 onClick={() => toggleSection('b2b')}
 className="w-full px-6 py-4 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
 >
 <div className="flex items-center gap-3">
 <Building2 size={20} className="text-accent" />
 <div>
 <h4 className="font-semibold text-slate-800">4A - B2B Invoices (Registered)</h4>
 <p className="text-sm text-slate-500">{gstr1Summary.b2b.count} invoices • ₹{gstr1Summary.b2b.taxableValue.toLocaleString()}</p>
 </div>
 </div>
 {expandedSections.includes('b2b') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
 </button>
 
 {expandedSections.includes('b2b') && (
 <div className="p-6">
 <table className="w-full text-sm">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-4 py-3 text-left">Invoice No</th>
 <th className="px-4 py-3 text-left">Date</th>
 <th className="px-4 py-3 text-left">Customer</th>
 <th className="px-4 py-3 text-left">GSTIN</th>
 <th className="px-4 py-3 text-right">Taxable Value</th>
 <th className="px-4 py-3 text-right">CGST</th>
 <th className="px-4 py-3 text-right">SGST</th>
 <th className="px-4 py-3 text-right">IGST</th>
 <th className="px-4 py-3 text-center">e-Invoice</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {demoInvoices.filter(inv => inv.invoiceType === 'B2B').map(inv => (
 <tr key={inv.id} className="hover:bg-slate-50">
 <td className="px-4 py-3 font-mono">{inv.invoiceNo}</td>
 <td className="px-4 py-3">{inv.invoiceDate}</td>
 <td className="px-4 py-3">{inv.customerName}</td>
 <td className="px-4 py-3 font-mono text-xs">{inv.customerGSTIN}</td>
 <td className="px-4 py-3 text-right">₹{inv.taxableValue.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{inv.cgstAmount.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{inv.sgstAmount.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{inv.igstAmount.toLocaleString()}</td>
 <td className="px-4 py-3 text-center">
 <span className={`px-2 py-1 rounded text-xs ${
 inv.eInvoiceStatus === 'Generated' 
 ? 'bg-green-100 text-green-700' 
 : 'bg-yellow-100 text-yellow-700'
 }`}>
 {inv.eInvoiceStatus}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* B2C Section */}
 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <button
 onClick={() => toggleSection('b2c')}
 className="w-full px-6 py-4 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
 >
 <div className="flex items-center gap-3">
 <Receipt size={20} className="text-green-600" />
 <div>
 <h4 className="font-semibold text-slate-800">4B - B2C (Large) Invoices</h4>
 <p className="text-sm text-slate-500">{gstr1Summary.b2c.count} invoices • ₹{gstr1Summary.b2c.taxableValue.toLocaleString()}</p>
 </div>
 </div>
 {expandedSections.includes('b2c') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
 </button>
 </div>

 {/* Exports Section */}
 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <button
 onClick={() => toggleSection('exports')}
 className="w-full px-6 py-4 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition-colors"
 >
 <div className="flex items-center gap-3">
 <Package size={20} className="text-purple-600" />
 <div>
 <h4 className="font-semibold text-slate-800">6 - Exports</h4>
 <p className="text-sm text-slate-500">{gstr1Summary.exports.count} invoices • ₹{gstr1Summary.exports.taxableValue.toLocaleString()}</p>
 </div>
 </div>
 {expandedSections.includes('exports') ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
 </button>
 </div>

 {/* Action Buttons */}
 <div className="flex justify-end gap-3 pt-4">
 <button
 onClick={() => setShowJsonPreview(true)}
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
 >
 <Info size={16} /> Preview JSON
 </button>
 <button
 onClick={() => downloadJSON('gstr1')}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
 >
 <Download size={16} /> Download JSON
 </button>
 <button
 onClick={() => alert('This would initiate filing to GST Portal')}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
 >
 <CheckCircle size={16} /> File to GST Portal
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* GSTR-3B Content */}
 {activeTab === 'gstr3b' && (
 <div className="flex-1 overflow-auto p-6">
 {!selectedPeriod ? (
 <div className="text-center py-12 text-slate-400">
 <Calendar size={64} className="mx-auto mb-4 opacity-20" />
 <p className="text-lg">Select a return period to view GSTR-3B data</p>
 </div>
 ) : (
 <div className="max-w-4xl mx-auto space-y-6">
 {/* 3.1 Tax on outward supplies */}
 <div className="bg-white border border-slate-200 rounded-xl p-6">
 <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <span className="w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm">3.1</span>
 Tax on outward and reverse charge inward supplies
 </h4>
 <table className="w-full text-sm">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-4 py-3 text-left">Nature of Supplies</th>
 <th className="px-4 py-3 text-right">Taxable Value</th>
 <th className="px-4 py-3 text-right">Integrated Tax</th>
 <th className="px-4 py-3 text-right">Central Tax</th>
 <th className="px-4 py-3 text-right">State/UT Tax</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 <tr>
 <td className="px-4 py-3">(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
 <td className="px-4 py-3 text-right font-medium">₹{gstr3bData.outwardSupplies.taxableValue.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.integratedTax.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.centralTax.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.stateTax.toLocaleString()}</td>
 </tr>
 <tr className="bg-slate-50 font-semibold">
 <td className="px-4 py-3">Total</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.taxableValue.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.integratedTax.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.centralTax.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.outwardSupplies.stateTax.toLocaleString()}</td>
 </tr>
 </tbody>
 </table>
 </div>

 {/* 4. Eligible ITC */}
 <div className="bg-white border border-slate-200 rounded-xl p-6">
 <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">4</span>
 Eligible ITC
 </h4>
 <table className="w-full text-sm">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-4 py-3 text-left">Details</th>
 <th className="px-4 py-3 text-right">Integrated Tax</th>
 <th className="px-4 py-3 text-right">Central Tax</th>
 <th className="px-4 py-3 text-right">State/UT Tax</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 <tr>
 <td className="px-4 py-3">(A) ITC Available</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.eligibleITC.integratedTax.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.eligibleITC.centralTax.toLocaleString()}</td>
 <td className="px-4 py-3 text-right">₹{gstr3bData.eligibleITC.stateTax.toLocaleString()}</td>
 </tr>
 </tbody>
 </table>
 </div>

 {/* Net Tax Payable */}
 <div className="bg-amber-50 border border-orange-200 rounded-xl p-6">
 <h4 className="font-semibold text-slate-800 mb-4">Net Tax Payable (After ITC)</h4>
 <div className="grid grid-cols-4 gap-4">
 <div className="bg-white rounded-lg p-4 border border-orange-200">
 <div className="text-sm text-slate-500">Integrated Tax</div>
 <div className={`text-xl font-bold ${gstr3bData.netTaxPayable.integratedTax >= 0 ? 'text-red-600' : 'text-green-600'}`}>
 ₹{Math.abs(gstr3bData.netTaxPayable.integratedTax).toLocaleString()}
 {gstr3bData.netTaxPayable.integratedTax >= 0 ? ' (Pay)' : ' (Refund)'}
 </div>
 </div>
 <div className="bg-white rounded-lg p-4 border border-orange-200">
 <div className="text-sm text-slate-500">Central Tax</div>
 <div className={`text-xl font-bold ${gstr3bData.netTaxPayable.centralTax >= 0 ? 'text-red-600' : 'text-green-600'}`}>
 ₹{Math.abs(gstr3bData.netTaxPayable.centralTax).toLocaleString()}
 {gstr3bData.netTaxPayable.centralTax >= 0 ? ' (Pay)' : ' (Refund)'}
 </div>
 </div>
 <div className="bg-white rounded-lg p-4 border border-orange-200">
 <div className="text-sm text-slate-500">State/UT Tax</div>
 <div className={`text-xl font-bold ${gstr3bData.netTaxPayable.stateTax >= 0 ? 'text-red-600' : 'text-green-600'}`}>
 ₹{Math.abs(gstr3bData.netTaxPayable.stateTax).toLocaleString()}
 {gstr3bData.netTaxPayable.stateTax >= 0 ? ' (Pay)' : ' (Refund)'}
 </div>
 </div>
 <div className="bg-white rounded-lg p-4 border border-orange-200">
 <div className="text-sm text-slate-500">Total Payable</div>
 <div className="text-xl font-bold text-red-600">
 ₹{(gstr3bData.netTaxPayable.integratedTax + gstr3bData.netTaxPayable.centralTax + gstr3bData.netTaxPayable.stateTax).toLocaleString()}
 </div>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex justify-end gap-3">
 <button
 onClick={() => setShowJsonPreview(true)}
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
 >
 <Info size={16} /> Preview JSON
 </button>
 <button
 onClick={() => downloadJSON('gstr3b')}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
 >
 <Download size={16} /> Download JSON
 </button>
 <button
 onClick={() => alert('This would initiate filing to GST Portal')}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
 >
 <CheckCircle size={16} /> File to GST Portal
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {/* History Tab */}
 {activeTab === 'history' && (
 <div className="flex-1 overflow-auto p-6">
 <div className="max-w-4xl mx-auto">
 <h4 className="text-lg font-semibold text-slate-800 mb-4">GST Filing History</h4>
 <div className="space-y-3">
 {returnPeriods.map(period => (
 <div key={period.label} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-slate-100 rounded-lg">
 <Calendar size={20} className="text-slate-600" />
 </div>
 <div>
 <h5 className="font-semibold text-slate-800">{period.label}</h5>
 <p className="text-sm text-slate-500">Due Date: {new Date(period.dueDate).toLocaleDateString()}</p>
 </div>
 </div>
 <div className="flex gap-2">
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${
 period.gstr1Status === 'Filed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
 }`}>
 GSTR-1: {period.gstr1Status}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-medium ${
 period.gstr3bStatus === 'Filed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
 }`}>
 GSTR-3B: {period.gstr3bStatus}
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Settings Tab */}
 {activeTab === 'settings' && (
 <div className="flex-1 overflow-auto p-6">
 <div className="max-w-2xl mx-auto space-y-6">
 <div className="bg-white border border-slate-200 rounded-xl p-6">
 <h4 className="font-semibold text-slate-800 mb-4">GST Registration Details</h4>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
 <input type="text" value="27AABCU9603R1ZX" disabled className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg" />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Legal Name</label>
 <input type="text" value="Metapharsic Pharma Private Limited" disabled className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg" />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Trade Name</label>
 <input type="text" value="Metapharsic Lifesciences" disabled className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg" />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Constitution of Business</label>
 <input type="text" value="Private Limited Company" disabled className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg" />
 </div>
 </div>
 </div>

 <div className="bg-white border border-slate-200 rounded-xl p-6">
 <h4 className="font-semibold text-slate-800 mb-4">Filing Preferences</h4>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium text-slate-700">Auto-generate e-Invoices</div>
 <div className="text-sm text-slate-500">Automatically generate e-Invoices for B2B transactions</div>
 </div>
 <input type="checkbox" checked className="w-5 h-5 text-accent rounded" />
 </div>
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium text-slate-700">Filing Reminders</div>
 <div className="text-sm text-slate-500">Send email reminders 3 days before due date</div>
 </div>
 <input type="checkbox" checked className="w-5 h-5 text-accent rounded" />
 </div>
 <div className="flex items-center justify-between">
 <div>
 <div className="font-medium text-slate-700">Reconciliation Alerts</div>
 <div className="text-sm text-slate-500">Alert on GSTR-2B vs Purchase Register mismatch</div>
 </div>
 <input type="checkbox" checked className="w-5 h-5 text-accent rounded" />
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* JSON Preview Modal */}
 {showJsonPreview && (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center">
 <h4 className="font-semibold text-slate-800">JSON Preview - {activeTab.toUpperCase()}</h4>
 <button onClick={() => setShowJsonPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg">
 <XCircle size={20} className="text-slate-400" />
 </button>
 </div>
 <div className="flex-1 overflow-auto p-4 bg-slate-50">
 <pre className="text-sm text-slate-700 whitespace-pre-wrap">
 {generateJSON(activeTab as 'gstr1' | 'gstr3b')}
 </pre>
 </div>
 <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
 <button
 onClick={() => {
 navigator.clipboard.writeText(generateJSON(activeTab as 'gstr1' | 'gstr3b'));
 alert('JSON copied to clipboard!');
 }}
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
 >
 <Copy size={16} /> Copy JSON
 </button>
 <button
 onClick={() => downloadJSON(activeTab as 'gstr1' | 'gstr3b')}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
 >
 <Download size={16} /> Download
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default GSTReturnFiling;


