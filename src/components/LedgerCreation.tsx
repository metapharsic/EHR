import React, { useState, useEffect, useMemo } from 'react';
import { 
 Save, X, ChevronRight, Search, BookOpen, 
 User, MapPin, CreditCard, FileText, Info,
 CheckCircle, AlertCircle, Printer
} from 'lucide-react';
import { ERPLayout, Badge, Modal } from './UniversalLayout';
import { ChartOfAccountsService } from '../services/accountingService';
import { useNotificationSystem } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';
import { ChartOfAccount, AccountType } from '../types';

// TALLY-STYLE ACCOUNT GROUPS
const TALLY_GROUPS = [
 { name: 'Bank Accounts', type: 'Asset' },
 { name: 'Bank OCC A/c', type: 'Asset' },
 { name: 'Bank OD A/c', type: 'Liability' },
 { name: 'Branch / Divisions', type: 'Asset' },
 { name: 'Capital Account', type: 'Equity' },
 { name: 'Cash-in-Hand', type: 'Asset' },
 { name: 'Current Assets', type: 'Asset' },
 { name: 'Current Liabilities', type: 'Liability' },
 { name: 'Deposits (Asset)', type: 'Asset' },
 { name: 'Direct Expenses', type: 'Expense' },
 { name: 'Direct Incomes', type: 'Income' },
 { name: 'Duties & Taxes', type: 'Liability' },
 { name: 'Expenses (Direct)', type: 'Expense' },
 { name: 'Expenses (Indirect)', type: 'Expense' },
 { name: 'Fixed Assets', type: 'Asset' },
 { name: 'Income (Direct)', type: 'Income' },
 { name: 'Income (Indirect)', type: 'Income' },
 { name: 'Indirect Expenses', type: 'Expense' },
 { name: 'Indirect Incomes', type: 'Income' },
 { name: 'Investments', type: 'Asset' },
 { name: 'Loans & Advances (Asset)', type: 'Asset' },
 { name: 'Loans (Liability)', type: 'Liability' },
 { name: 'Misc. Expenses (ASSET)', type: 'Asset' },
 { name: 'Provisions', type: 'Liability' },
 { name: 'Purchase Accounts', type: 'Expense' },
 { name: 'Reserves & Surplus', type: 'Equity' },
 { name: 'Retained Earnings', type: 'Equity' },
 { name: 'Sales Accounts', type: 'Income' },
 { name: 'Secured Loans', type: 'Liability' },
 { name: 'Stock-in-Hand', type: 'Asset' },
 { name: 'Sundry Creditors', type: 'Liability' },
 { name: 'Sundry Debtors', type: 'Asset' },
 { name: 'Suspense A/c', type: 'Asset' },
 { name: 'Unsecured Loans', type: 'Liability' }
];

// PRINT COMPONENT
const LedgerPrintView: React.FC<{ data: Partial<ChartOfAccount> }> = ({ data }) => (
 <div id="ledger-print-template" className="p-8 bg-white text-slate-900 font-serif border border-slate-300">
 <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
 <h1 className="text-xl font-bold uppercase tracking-tight">Metapharsic Lifesciences ERP</h1>
 <p className="text-xs uppercase font-bold text-slate-500 tracking-widest mt-1">Ledger Master Configuration</p>
 </div>

 <div className="grid grid-cols-2 gap-8 mb-6">
 <div className="space-y-2">
 <p className="text-sm"><span className="font-bold w-32 inline-block">Account Name:</span> {data.accountName}</p>
 <p className="text-sm"><span className="font-bold w-32 inline-block">Alias:</span> {data.alias || 'N/A'}</p>
 <p className="text-sm"><span className="font-bold w-32 inline-block">Under Group:</span> {data.group}</p>
 <p className="text-sm"><span className="font-bold w-32 inline-block">Account Type:</span> {data.accountType}</p>
 </div>
 <div className="space-y-2">
 <p className="text-sm"><span className="font-bold w-32 inline-block">Opening Bal:</span> ₹{data.openingBalance?.toLocaleString()} ({data.accountFormat})</p>
 <p className="text-sm"><span className="font-bold w-32 inline-block">GST Details:</span> {data.gstApplicable ? 'Applicable' : 'Not Applicable'}</p>
 <p className="text-sm"><span className="font-bold w-32 inline-block">PAN / IT No:</span> <span className="uppercase">{data.panItNo || 'N/A'}</span></p>
 <p className="text-sm"><span className="font-bold w-32 inline-block">Status:</span> {data.status}</p>
 </div>
 </div>

 <div className="border-t border-slate-200 pt-4 mb-8">
 <h3 className="text-xs font-bold uppercase mb-2">Mailing & Contact Details</h3>
 <div className="text-sm p-4 bg-slate-50 border border-slate-200 rounded">
 <p className="font-bold mb-1">{data.mailingName}</p>
 <p className="whitespace-pre-wrap">{data.mailingAddress || 'Address not specified'}</p>
 <p>{data.mailingState}, {data.mailingCountry}</p>
 </div>
 </div>

 <div className="flex justify-between items-end mt-12 text-[10px] font-bold text-slate-500 uppercase">
 <div>Report Generated on: {new Date().toLocaleString()}</div>
 <div className="border-t border-slate-400 pt-1 w-48 text-center">Authorized Signature</div>
 </div>
 </div>
);

const LedgerCreation: React.FC = () => {
 const { user } = useAuth();
 const { notifyAccounting } = useNotificationSystem();
 
 const [formData, setFormData] = useState<Partial<ChartOfAccount>>({
 accountName: '',
 alias: '',
 group: 'Indirect Expenses',
 accountType: 'Expense',
 inventoryAffected: false,
 ledgerType: 'Not Applicable',
 activateInterest: false,
 mailingName: '',
 mailingAddress: '',
 mailingCountry: 'India',
 mailingState: '',
 provideBankDetails: false,
 panItNo: '',
 openingBalance: 0,
 accountFormat: 'debit',
 status: 'Active',
 gstApplicable: false,
 accountCode: ''
 });

 const [searchTerm, setSearchTerm] = useState('');
 const [loading, setLoading] = useState(false);
 const [showPrintModal, setShowPrintModal] = useState(false);

 // Filter groups based on search
 const filteredGroups = useMemo(() => {
 return TALLY_GROUPS.filter(g => 
 g.name.toLowerCase().includes(searchTerm.toLowerCase())
 );
 }, [searchTerm]);

 // Update mailing name when account name changes
 useEffect(() => {
 if (!formData.mailingName || formData.mailingName === formData.accountName?.slice(0, -1)) {
 setFormData(prev => ({ ...prev, mailingName: prev.accountName }));
 }
 }, [formData.accountName]);

 const handleGroupSelect = (groupName: string) => {
 const group = TALLY_GROUPS.find(g => g.name === groupName);
 if (group) {
 setFormData(prev => ({ 
 ...prev, 
 group: groupName, 
 accountType: group.type as AccountType,
 accountFormat: (group.type === 'Asset' || group.type === 'Expense') ? 'debit' : 'credit'
 }));
 }
 };

 const triggerPrint = () => {
 const printContent = document.getElementById('ledger-print-template');
 if (!printContent) return;

 const windowPrint = window.open('', '', 'width=900,height=900');
 if (windowPrint) {
 windowPrint.document.write(`
 <html>
 <head>
 <title>Ledger Master - ${formData.accountName}</title>
 <style>
   *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
   body { font-family: Georgia, serif; color: #0f172a; background: #fff; padding: 2rem; }
   .p-8 { padding: 2rem; }
   .bg-white { background: #fff; }
   .text-slate-900 { color: #0f172a; }
   .font-serif { font-family: Georgia, serif; }
   .border { border: 1px solid; }
   .border-slate-300 { border-color: #cbd5e1; }
   .text-center { text-align: center; }
   .mb-6 { margin-bottom: 1.5rem; }
   .border-b-2 { border-bottom-width: 2px; }
   .border-slate-900 { border-color: #0f172a; }
   .pb-4 { padding-bottom: 1rem; }
   .text-xl { font-size: 1.25rem; }
   .font-bold { font-weight: 700; }
   .uppercase { text-transform: uppercase; }
   .tracking-tight { letter-spacing: -0.025em; }
   .text-xs { font-size: 0.75rem; }
   .text-slate-500 { color: #64748b; }
   .tracking-widest { letter-spacing: 0.1em; }
   .mt-1 { margin-top: 0.25rem; }
   .grid { display: grid; }
   .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   .gap-8 { gap: 2rem; }
   .space-y-2 > * + * { margin-top: 0.5rem; }
   .text-sm { font-size: 0.875rem; }
   .w-32 { width: 8rem; }
   .inline-block { display: inline-block; }
   .border-t { border-top: 1px solid; }
   .border-slate-200 { border-color: #e2e8f0; }
   .pt-4 { padding-top: 1rem; }
   .mb-8 { margin-bottom: 2rem; }
   .bg-slate-50 { background: #f8fafc; }
   .p-4 { padding: 1rem; }
   .rounded { border-radius: 0.25rem; }
   .whitespace-pre-wrap { white-space: pre-wrap; }
   .flex { display: flex; }
   .justify-between { justify-content: space-between; }
   .items-end { align-items: flex-end; }
   .mt-12 { margin-top: 3rem; }
   .border-slate-400 { border-color: #94a3b8; }
   .pt-1 { padding-top: 0.25rem; }
   .w-48 { width: 12rem; }
   h3 { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; }
   @media print { body { padding: 0; } }
 </style>
 </head>
 <body>
 ${printContent.innerHTML}
 <script>
 setTimeout(() => {
 window.print();
 window.close();
 }, 500);
 </script>
 </body>
 </html>
 `);
 windowPrint.document.close();
 windowPrint.focus();
 }
 };

 const handleSave = async () => {
 if (!formData.accountName || !formData.group) {
 notifyAccounting('Error', 'Account Name and Group are required', 'error');
 return;
 }

 setLoading(true);
 try {
 // accountCode is optional — backend auto-generates ACC-XXXX if omitted
 const finalData = { ...formData };

 await ChartOfAccountsService.createAccount(finalData as any);
 notifyAccounting('Success', `Ledger "${formData.accountName}" created successfully`, 'success');
 
 // Reset form
 setFormData({
 accountName: '',
 alias: '',
 group: 'Indirect Expenses',
 accountType: 'Expense',
 inventoryAffected: false,
 ledgerType: 'Not Applicable',
 activateInterest: false,
 mailingName: '',
 mailingAddress: '',
 mailingCountry: 'India',
 mailingState: '',
 provideBankDetails: false,
 panItNo: '',
 openingBalance: 0,
 accountFormat: 'debit',
 status: 'Active',
 gstApplicable: false,
 accountCode: ''
 });
 } catch (error) {
 notifyAccounting('Error', 'Failed to create ledger', 'error');
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 return (
 <ERPLayout 
 title="Ledger Creation" 
 subtitle="Standardized Accounting Ledger Management"
 actionButtons={[
 <button 
 key="print" 
 onClick={() => formData.accountName ? setShowPrintModal(true) : notifyAccounting('Alert', 'Enter a ledger name first', 'warning')}
 className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-900 transition-all shadow-none"
 >
 <Printer size={16} /> Print Master
 </button>
 ]}
 >
 <div className="flex h-[calc(100vh-180px)] overflow-hidden bg-slate-100 rounded-lg border border-slate-200 shadow-inner">
 
 {/* LEFT SECTION: FORM */}
 <div className="flex-1 overflow-y-auto p-6 bg-white border-r border-slate-300">
 <div className="max-w-4xl mx-auto space-y-8">
 
 {/* Header: Name and Alias */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
 <div className="space-y-2">
 <label className="text-sm font-bold text-slate-600 uppercase tracking-tight flex items-center gap-2">
 <BookOpen size={16} className="text-accent" /> Name
 </label>
 <input
 type="text"
 value={formData.accountName}
 onChange={e => setFormData({ ...formData, accountName: e.target.value })}
 className="w-full px-4 py-2 border-2 border-slate-200 rounded-md focus:border-accent focus:ring-0 outline-none text-lg font-bold text-slate-800 transition-all"
 placeholder="e.g. ICICI Credit Card"
 autoFocus
 />
 </div>
 <div className="space-y-2">
 <label className="text-sm font-bold text-slate-600 uppercase tracking-tight flex items-center gap-2">
 <FileText size={16} className="text-slate-400" /> (alias)
 </label>
 <input
 type="text"
 value={formData.alias}
 onChange={e => setFormData({ ...formData, alias: e.target.value })}
 className="w-full px-4 py-2 border-2 border-slate-200 rounded-md focus:border-accent focus:ring-0 outline-none text-lg text-slate-600 transition-all"
 />
 </div>
 </div>

 {/* Configuration */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
 <div className="space-y-6">
 <div className="space-y-4">
 <div className="flex items-center justify-between border-b border-slate-50 pb-2">
 <label className="text-sm font-semibold text-slate-700">Under Group</label>
 <span className="text-accent font-bold">{formData.group}</span>
 </div>
 
 <div className="space-y-4 pt-2">
 <div className="flex items-center justify-between group">
 <label className="text-sm text-slate-600">Inventory values affected?</label>
 <select 
 value={formData.inventoryAffected ? 'Yes' : 'No'}
 onChange={e => setFormData({ ...formData, inventoryAffected: e.target.value === 'Yes' })}
 className="text-sm font-bold text-accent bg-transparent outline-none cursor-pointer"
 >
 <option>No</option>
 <option>Yes</option>
 </select>
 </div>

 <div className="flex items-center justify-between group">
 <label className="text-sm text-slate-600">Type of Ledger</label>
 <select 
 value={formData.ledgerType}
 onChange={e => setFormData({ ...formData, ledgerType: e.target.value })}
 className="text-sm font-bold text-accent bg-transparent outline-none cursor-pointer"
 >
 <option>Not Applicable</option>
 <option>Discount</option>
 <option>Invoice Rounding</option>
 </select>
 </div>
 </div>
 </div>

 <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-3 mt-8">
 <label className="text-xs font-bold text-accent uppercase tracking-widest">Opening Balance</label>
 <div className="flex items-center gap-4">
 <div className="relative flex-1">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
 <input
 type="number"
 value={formData.openingBalance}
 onChange={e => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
 className="w-full pl-8 pr-4 py-2 bg-white border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xl font-bold text-slate-800"
 />
 </div>
 <select
 value={formData.accountFormat}
 onChange={e => setFormData({ ...formData, accountFormat: e.target.value as any })}
 className="px-4 py-2 bg-white border border-blue-200 rounded font-bold text-accent outline-none focus:ring-2 focus:ring-blue-500"
 >
 <option value="debit">Dr</option>
 <option value="credit">Cr</option>
 </select>
 </div>
 </div>
 </div>

 <div className="space-y-8">
 <div className="space-y-4">
 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
 <MapPin size={14} /> Mailing Details
 </h3>
 
 <div className="space-y-3">
 <div className="space-y-1">
 <label className="text-xs font-semibold text-slate-500">Mailing Name</label>
 <input
 type="text"
 value={formData.mailingName}
 onChange={e => setFormData({ ...formData, mailingName: e.target.value })}
 className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:bg-white outline-none"
 />
 </div>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-slate-500">Address</label>
 <textarea
 rows={3}
 value={formData.mailingAddress}
 onChange={e => setFormData({ ...formData, mailingAddress: e.target.value })}
 className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:bg-white outline-none resize-none"
 />
 </div>
 </div>
 </div>

 <div className="space-y-4">
 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
 <FileText size={14} /> Tax Details
 </h3>
 <div className="space-y-1">
 <label className="text-xs font-semibold text-slate-500">PAN/IT No.</label>
 <input
 type="text"
 value={formData.panItNo}
 onChange={e => setFormData({ ...formData, panItNo: e.target.value })}
 className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:bg-white outline-none font-mono uppercase"
 placeholder="ABCDE1234F"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex items-center gap-4 pt-8 border-t border-slate-100">
 <button
 onClick={handleSave}
 disabled={loading}
 className="flex-1 bg-accent hover:bg-accent text-white py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-none active:scale-[0.98] disabled:opacity-50"
 >
 {loading ? 'Processing...' : <><Save size={20} /> Create Ledger</>}
 </button>
 <button
 onClick={() => window.history.back()}
 className="px-8 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-lg font-bold text-lg transition-all"
 >
 Cancel
 </button>
 </div>
 </div>
 </div>

 {/* RIGHT SECTION: GROUPS */}
 <div className="w-80 bg-slate-50 flex flex-col shadow-2xl z-10">
 <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
 <h3 className="font-bold text-sm tracking-widest uppercase">List of Groups</h3>
 </div>
 
 <div className="p-3 bg-white border-b border-slate-200">
 <div className="relative">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
 <input
 type="text"
 value={searchTerm}
 onChange={e => setSearchTerm(e.target.value)}
 placeholder="Search Group..."
 className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border-none rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
 />
 </div>
 </div>

 <div className="flex-1 overflow-y-auto">
 {filteredGroups.map((g, idx) => (
 <button
 key={idx}
 onClick={() => handleGroupSelect(g.name)}
 className={`w-full text-left px-4 py-2.5 text-xs font-semibold border-b border-slate-100 transition-colors flex items-center justify-between group
 ${formData.group === g.name ? 'bg-accent text-white' : 'hover:bg-blue-50 text-slate-700'}`}
 >
 <span>{g.name}</span>
 <ChevronRight size={12} className={formData.group === g.name ? 'text-blue-200' : 'text-slate-300 group-hover:text-blue-400'} />
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* PRINT MODAL */}
 {showPrintModal && (
 <Modal 
 isOpen={showPrintModal} 
 onClose={() => setShowPrintModal(false)}
 title="Print Preview"
 size="lg"
 >
 <div className="space-y-6">
 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 max-h-[60vh] overflow-y-auto">
 <LedgerPrintView data={formData} />
 </div>
 <div className="flex justify-end gap-3">
 <button onClick={() => setShowPrintModal(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200">Close</button>
 <button onClick={triggerPrint} className="px-8 py-2 bg-accent text-white rounded-lg font-bold flex items-center gap-2 hover:bg-accent shadow-none">
 <Printer size={18} /> Print Now
 </button>
 </div>
 </div>
 </Modal>
 )}
 </ERPLayout>
 );
};

export default LedgerCreation;

