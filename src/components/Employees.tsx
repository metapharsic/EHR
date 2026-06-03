
import React, { useState } from 'react';
import { Briefcase, Plus, MapPin, BarChart2, DollarSign, X, ArrowLeft, Edit, Trash2, Save, Target, UserCheck, TrendingUp, PieChart, Filter, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend } from 'recharts';
import { MOCK_MRS, MOCK_TRANSACTIONS, MOCK_PRODUCTS } from '../constants';
import { MedicalRepresentative, SaleTransaction } from '../types';
import { useAuth } from '../context/AuthContext';

const Employees: React.FC = () => {
 const { hasPermission } = useAuth();
 const canManage = hasPermission(['ADMIN']);

 // --- State ---
 const [mrs, setMrs] = useState<MedicalRepresentative[]>(MOCK_MRS);
 const [transactions, setTransactions] = useState<SaleTransaction[]>(MOCK_TRANSACTIONS);
 const [selectedMR, setSelectedMR] = useState<MedicalRepresentative | null>(null);
 const [txnFilter, setTxnFilter] = useState<'All' | 'PCD' | 'Metapharsic'>('All');
 const [txnSearch, setTxnSearch] = useState('');
 
 // Modals
 const [showMRModal, setShowMRModal] = useState(false);
 const [showSaleModal, setShowSaleModal] = useState(false);
 
 // Forms
 const [isEditing, setIsEditing] = useState(false);
 const [mrForm, setMrForm] = useState<Partial<MedicalRepresentative>>({
 name: '', contact: '', email: '', headquarters: '', assignedArea: '', salesTarget: 0, status: 'Active'
 });
 
 const [saleForm, setSaleForm] = useState({
 date: new Date().toISOString().split('T')[0],
 chemist: '',
 productId: '',
 productName: '',
 quantity: '',
 amount: '',
 category: 'Metapharsic' as 'PCD' | 'Metapharsic'
 });

 // --- Logic & Helpers ---

 const handleOpenAddMR = () => {
 setMrForm({ name: '', contact: '', email: '', headquarters: '', assignedArea: '', salesTarget: 0, status: 'Active' });
 setIsEditing(false);
 setShowMRModal(true);
 };

 const handleOpenEditMR = (mr: MedicalRepresentative, e?: React.MouseEvent) => {
 e?.stopPropagation();
 setMrForm({ ...mr });
 setIsEditing(true);
 setShowMRModal(true);
 };

 const handleDeleteMR = (id: string, e?: React.MouseEvent) => {
 e?.stopPropagation();
 if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
 setMrs(mrs.filter(m => m.id !== id));
 if (selectedMR?.id === id) setSelectedMR(null);
 }
 };

 const handleSaveMR = (e: React.FormEvent) => {
 e.preventDefault();
 if (isEditing && mrForm.id) {
 // Update
 const updated = { ...mrForm } as MedicalRepresentative;
 setMrs(mrs.map(m => m.id === mrForm.id ? updated : m));
 if (selectedMR?.id === mrForm.id) setSelectedMR(updated);
 } else {
 // Add
 const newMR: MedicalRepresentative = {
 id: `MR-${Date.now()}`,
 name: mrForm.name!,
 contact: mrForm.contact!,
 email: mrForm.email!,
 headquarters: mrForm.headquarters!,
 assignedArea: mrForm.assignedArea!,
 salesTarget: Number(mrForm.salesTarget),
 status: mrForm.status as any,
 totalSales: 0,
 targetAchievement: 0,
 joinDate: new Date().toISOString().split('T')[0]
 };
 setMrs([...mrs, newMR]);
 }
 setShowMRModal(false);
 };

 const handleProductSelect = (id: string) => {
 const product = MOCK_PRODUCTS.find(p => p.id === id);
 if (product) {
 const qty = Number(saleForm.quantity) || 1;
 const price = product.rate || product.mrp;
 setSaleForm({
 ...saleForm,
 productId: product.id,
 productName: product.name,
 amount: (price * qty).toFixed(2)
 });
 } else {
 setSaleForm({ ...saleForm, productId: '', productName: id });
 }
 };

 const handleLogSale = (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedMR || !saleForm.amount || !saleForm.productName || !saleForm.quantity) return;

 const amount = Number(saleForm.amount);
 const quantity = Number(saleForm.quantity);

 const newTxn: SaleTransaction = {
 id: `TXN-${Date.now()}`,
 mrId: selectedMR.id,
 date: saleForm.date,
 chemist: saleForm.chemist,
 area: selectedMR.assignedArea,
 productId: saleForm.productId,
 productName: saleForm.productName,
 quantity: quantity,
 amount: amount,
 category: saleForm.category,
 status: 'Pending'
 };

 setTransactions([newTxn, ...transactions]);

 const updatedTotalSales = selectedMR.totalSales + amount;
 const updatedAchievement = Math.round((updatedTotalSales / selectedMR.salesTarget) * 100);

 const updatedMR = { ...selectedMR, totalSales: updatedTotalSales, targetAchievement: updatedAchievement };
 
 setMrs(mrs.map(m => m.id === selectedMR.id ? updatedMR : m));
 setSelectedMR(updatedMR);

 setShowSaleModal(false);
 setSaleForm({ date: new Date().toISOString().split('T')[0], chemist: '', productId: '', productName: '', quantity: '', amount: '', category: 'Metapharsic' });
 };

 const getSalesDistribution = (mrId: string) => {
 const mrTxns = transactions.filter(t => t.mrId === mrId);
 const pcdSales = mrTxns.filter(t => t.category === 'PCD').reduce((sum, t) => sum + t.amount, 0);
 const metaSales = mrTxns.filter(t => t.category === 'Metapharsic').reduce((sum, t) => sum + t.amount, 0);
 
 return [
 { name: 'PCD Partner Sales', value: pcdSales, color: '#8b5cf6' }, // Violet
 { name: 'Metapharsic Direct', value: metaSales, color: '#0ea5e9' } // Sky
 ].filter(d => d.value > 0);
 };

 // --- Render Details View ---
 if (selectedMR) {
 const mrTransactions = transactions.filter(t => 
 t.mrId === selectedMR.id && 
 (txnFilter === 'All' || t.category === txnFilter) &&
 (t.chemist.toLowerCase().includes(txnSearch.toLowerCase()) || t.productName.toLowerCase().includes(txnSearch.toLowerCase()))
 );
 
 const distributionData = getSalesDistribution(selectedMR.id);
 const incentiveEarned = selectedMR.targetAchievement > 100 
 ? (selectedMR.totalSales * 0.05) 
 : (selectedMR.targetAchievement > 80 ? selectedMR.totalSales * 0.02 : 0);

 return (
 <div className="space-y-6 animate-fadeIn">
 {/* Header */}
 <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2 justify-between">
 <div className="flex items-center gap-4">
 <button 
 onClick={() => setSelectedMR(null)}
 className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
 >
 <ArrowLeft size={24} />
 </button>
 <div>
 <div className="flex items-center gap-3">
 <h2 className="text-2xl font-bold text-slate-800">{selectedMR.name}</h2>
 <span className={`px-2 py-0.5 rounded text-xs font-bold border ${selectedMR.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
 {selectedMR.status}
 </span>
 </div>
 <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
 <MapPin size={14}/> {selectedMR.assignedArea} ({selectedMR.headquarters})
 </p>
 </div>
 </div>
 
 {canManage && (
 <div className="flex gap-2">
 <button 
 onClick={() => handleOpenEditMR(selectedMR)}
 className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
 >
 <Edit size={16} /> Edit Profile
 </button>
 <button 
 onClick={() => setShowSaleModal(true)}
 className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium shadow-sm"
 >
 <Plus size={16} /> Log Sale
 </button>
 </div>
 )}
 </div>

 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-2"><Target size={14}/> Monthly Target</p>
 <h3 className="text-2xl font-bold text-slate-800">₹{selectedMR.salesTarget.toLocaleString()}</h3>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-2"><TrendingUp size={14}/> Total Achieved</p>
 <h3 className={`text-2xl font-bold ${selectedMR.targetAchievement >= 100 ? 'text-green-600' : 'text-primary'}`}>
 ₹{selectedMR.totalSales.toLocaleString()}
 </h3>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex justify-between items-center mb-1">
 <p className="text-slate-500 text-xs font-bold uppercase">Achievement</p>
 <span className={`text-xs font-bold ${selectedMR.targetAchievement >= 100 ? 'text-green-600' : 'text-primary'}`}>{selectedMR.targetAchievement}%</span>
 </div>
 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
 <div className={`h-full rounded-full transition-all duration-500 ${selectedMR.targetAchievement >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{width: `${Math.min(100, selectedMR.targetAchievement)}%`}}></div>
 </div>
 <p className="text-xs text-slate-400 mt-2">
 {selectedMR.targetAchievement >= 100 ? 'Target Exceeded!' : `${100 - selectedMR.targetAchievement}% to go`}
 </p>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-2"><DollarSign size={14}/> Est. Incentive</p>
 <h3 className="text-2xl font-bold text-orange-600">₹{incentiveEarned.toLocaleString()}</h3>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Performance Chart */}
 <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
 <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
 <BarChart2 size={20} className="text-primary"/> Monthly Performance vs Target
 </h3>
 <div className="w-full">
  <ResponsiveContainer width="100%" height={300} debounce={50}>
 <BarChart data={[
 { month: 'Jul', target: selectedMR.salesTarget, achieved: selectedMR.totalSales * 0.7 },
 { month: 'Aug', target: selectedMR.salesTarget, achieved: selectedMR.totalSales * 0.8 },
 { month: 'Sep', target: selectedMR.salesTarget, achieved: selectedMR.totalSales * 0.9 },
 { month: 'Oct', target: selectedMR.salesTarget, achieved: selectedMR.totalSales },
 ]} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(val) => `₹${val/1000}k`} />
 <Tooltip cursor={{fill: '#f8fafc'}}/>
 <Legend />
 <Bar dataKey="achieved" name="Achieved Sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={30} />
 <Bar dataKey="target" name="Target" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={30} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Sales Distribution */}
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
 <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
 <PieChart size={20} className="text-purple-500"/> Product Mix
 </h3>
 {distributionData.length > 0 ? (
 <div className="w-full relative">
  <ResponsiveContainer width="100%" height={300} debounce={50}>
 <RePieChart>
 <Pie
 data={distributionData}
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 dataKey="value"
 >
 {distributionData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip formatter={(val: number) => `₹${val.toLocaleString()}`} />
 </RePieChart>
 </ResponsiveContainer>
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 <div className="text-center">
 <p className="text-xs text-slate-400 font-medium">Total Sales</p>
 <p className="text-xl font-bold text-slate-800">₹{selectedMR.totalSales.toLocaleString()}</p>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No sales data yet</div>
 )}
 <div className="mt-4 space-y-3">
 {distributionData.map((d, i) => (
 <div key={i} className="flex justify-between text-sm items-center p-2 bg-slate-50 rounded-lg">
 <span className="flex items-center gap-2 text-slate-600 font-medium">
 <span className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></span>
 {d.name}
 </span>
 <span className="font-bold text-slate-800">₹{d.value.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Transaction History Table */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50 gap-4">
 <div className="flex items-center gap-4 flex-1">
 <h3 className="font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
 <DollarSign size={20} className="text-primary"/> Transaction History
 </h3>
 <div className="relative w-full max-w-md">
 <Search className="absolute left-3 top-2 text-slate-400" size={14} />
 <input 
 type="text" 
 placeholder="Search by Chemist or Product..." 
 className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary outline-none"
 value={txnSearch}
 onChange={(e) => setTxnSearch(e.target.value)}
 />
 </div>
 </div>
 <div className="flex bg-white rounded-lg border border-slate-200 p-1">
 {['All', 'Metapharsic', 'PCD'].map(filter => (
 <button 
 key={filter}
 onClick={() => setTxnFilter(filter as any)}
 className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txnFilter === filter ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 {filter}
 </button>
 ))}
 </div>
 </div>
 <table className="w-full text-left">
 <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Date</th>
 <th className="p-4">Chemist / Party</th>
 <th className="p-4">Category</th>
 <th className="p-4">Product</th>
 <th className="p-4 text-center">Qty</th>
 <th className="p-4 text-right">Amount</th>
 <th className="p-4 text-center">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {mrTransactions.length > 0 ? (
 mrTransactions.map(txn => (
 <tr key={txn.id} className="hover:bg-slate-50">
 <td className="p-4 text-sm text-slate-600">{txn.date}</td>
 <td className="p-4 text-sm font-medium text-slate-800">{txn.chemist}</td>
 <td className="p-4">
 <span className={`px-2 py-1 rounded text-[10px] font-bold border ${txn.category === 'PCD' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
 {txn.category === 'PCD' ? 'PCD PARTNER' : 'METAPHARSIC'}
 </span>
 </td>
 <td className="p-4 text-sm text-slate-500">{txn.productName}</td>
 <td className="p-4 text-sm text-slate-700 text-center">{txn.quantity}</td>
 <td className="p-4 text-right font-bold text-slate-700">₹{txn.amount.toLocaleString()}</td>
 <td className="p-4 text-center">
 <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Verified</span>
 </td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan={7} className="p-8 text-center text-slate-400">
 No transactions found.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 );
 }

 // --- Render Main List View ---
 return (
 <div className="space-y-6">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h2 className="text-2xl font-bold text-slate-800">Field Force (Employee) Management</h2>
 <p className="text-slate-500 text-sm">Track Medical Representatives, Sales Targets & Performance</p>
 </div>
 {canManage && (
 <button 
 onClick={handleOpenAddMR}
 className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors shadow-sm"
 >
 <Plus size={18} /> Add Employee
 </button>
 )}
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
 <tr>
 <th className="p-4">Name</th>
 <th className="p-4">Region</th>
 <th className="p-4">Target (Monthly)</th>
 <th className="p-4">Actual Sales</th>
 <th className="p-4 w-48">Progress</th>
 <th className="p-4 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {mrs.map(mr => (
 <tr key={mr.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => setSelectedMR(mr)}>
 <td className="p-4">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200">
 {mr.name.charAt(0)}
 </div>
 <div>
 <span className="font-medium text-slate-800 block">{mr.name}</span>
 <span className="text-xs text-slate-500">{mr.contact}</span>
 </div>
 </div>
 </td>
 <td className="p-4 text-sm text-slate-600">
 <p className="font-medium text-slate-800">{mr.assignedArea}</p>
 <p className="text-xs text-slate-400">{mr.headquarters}</p>
 </td>
 <td className="p-4 text-sm text-slate-600">₹{mr.salesTarget.toLocaleString()}</td>
 <td className="p-4 text-sm font-bold text-slate-700">₹{mr.totalSales.toLocaleString()}</td>
 <td className="p-4">
 <div className="flex flex-col gap-1">
 <div className="flex justify-between text-xs">
 <span className="font-bold text-slate-700">{mr.targetAchievement}%</span>
 <span className="text-slate-400">Target</span>
 </div>
 <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
 <div className={`h-full rounded-full transition-all duration-500 ${mr.targetAchievement >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{width: `${Math.min(100, mr.targetAchievement)}%`}}></div>
 </div>
 </div>
 </td>
 <td className="p-4 text-center">
 <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
 {canManage && (
 <>
 <button 
 onClick={(e) => handleOpenEditMR(mr, e)}
 className="text-slate-500 hover:text-accent hover:bg-blue-50 p-1.5 rounded transition-colors"
 title="Edit"
 >
 <Edit size={16} />
 </button>
 <button 
 onClick={(e) => handleDeleteMR(mr.id, e)}
 className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
 title="Delete"
 >
 <Trash2 size={16} />
 </button>
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Add/Edit Employee Modal */}
 {showMRModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2">
 <Briefcase size={18}/> {isEditing ? 'Edit Employee' : 'Add Regional Employee'}
 </h3>
 <button onClick={() => setShowMRModal(false)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
 </div>
 <form onSubmit={handleSaveMR} className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Employee Name</label>
 <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={mrForm.name} onChange={e => setMrForm({...mrForm, name: e.target.value})} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Headquarters</label>
 <input required type="text" placeholder="e.g. Pune" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={mrForm.headquarters} onChange={e => setMrForm({...mrForm, headquarters: e.target.value})} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
 <select className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary bg-white" value={mrForm.status} onChange={e => setMrForm({...mrForm, status: e.target.value as any})}>
 <option>Active</option>
 <option>On Leave</option>
 <option>Inactive</option>
 </select>
 </div>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Region / Area</label>
 <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={mrForm.assignedArea} onChange={e => setMrForm({...mrForm, assignedArea: e.target.value})} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Sales Target (₹)</label>
 <input required type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={mrForm.salesTarget} onChange={e => setMrForm({...mrForm, salesTarget: Number(e.target.value)})} />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Contact No</label>
 <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={mrForm.contact} onChange={e => setMrForm({...mrForm, contact: e.target.value})} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
 <input required type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={mrForm.email} onChange={e => setMrForm({...mrForm, email: e.target.value})} />
 </div>
 </div>
 
 <div className="pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setShowMRModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
 <button type="submit" className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-sky-600 flex items-center gap-2">
 <Save size={18}/> {isEditing ? 'Update Employee' : 'Add Employee'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Log Sale Modal */}
 {showSaleModal && selectedMR && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2">
 <Plus size={18}/> Log New Sale
 </h3>
 <button onClick={() => setShowSaleModal(false)} className="hover:bg-slate-700 p-1 rounded"><X size={18} /></button>
 </div>
 <form onSubmit={handleLogSale} className="p-6 space-y-4">
 <div>
 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Employee</label>
 <p className="font-bold text-slate-800">{selectedMR.name}</p>
 </div>
 
 <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
 <label className="block text-sm font-medium text-slate-700 mb-2">Sales Category</label>
 <div className="flex gap-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <input 
 type="radio" 
 name="category" 
 className="text-primary focus:ring-primary"
 checked={saleForm.category === 'Metapharsic'}
 onChange={() => setSaleForm({...saleForm, category: 'Metapharsic'})}
 />
 <span className="text-sm font-medium text-slate-700">Metapharsic (Direct)</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input 
 type="radio" 
 name="category" 
 className="text-primary focus:ring-primary"
 checked={saleForm.category === 'PCD'}
 onChange={() => setSaleForm({...saleForm, category: 'PCD'})}
 />
 <span className="text-sm font-medium text-slate-700">PCD Partner</span>
 </label>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
 <input required type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={saleForm.date} onChange={e => setSaleForm({...saleForm, date: e.target.value})} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
 <input required type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary font-bold" value={saleForm.amount} onChange={e => setSaleForm({...saleForm, amount: e.target.value})} placeholder="0.00" />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Chemist / Party Name</label>
 <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={saleForm.chemist} onChange={e => setSaleForm({...saleForm, chemist: e.target.value})} placeholder="e.g. Wellness Pharmacy" />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
 <select 
 required
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary bg-white" 
 value={saleForm.productId || saleForm.productName} 
 onChange={e => handleProductSelect(e.target.value)}
 >
 <option value="">Select Product...</option>
 {MOCK_PRODUCTS.map(p => (
 <option key={p.id} value={p.id}>{p.name}</option>
 ))}
 <option value="Other">Other / Manual</option>
 </select>
 {(!saleForm.productId && saleForm.productName === 'Other') && (
 <input 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-2 text-sm outline-none focus:ring-2 focus:ring-primary"
 placeholder="Enter Product Name"
 onChange={e => setSaleForm({...saleForm, productName: e.target.value})}
 />
 )}
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
 <input required type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary" value={saleForm.quantity} onChange={e => setSaleForm({...saleForm, quantity: e.target.value})} placeholder="e.g. 50" />
 </div>
 </div>

 <div className="pt-4 flex justify-end gap-3">
 <button type="button" onClick={() => setShowSaleModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
 <button type="submit" className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-sky-600 flex items-center gap-2">
 <Save size={18}/> Save Transaction
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
};

export default Employees;

