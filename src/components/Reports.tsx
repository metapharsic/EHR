
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { FileBarChart, ArrowDown, ArrowUp, Download, AlertCircle, FileText, Calendar, ShoppingBag, Stethoscope, User, TrendingUp, Users, Map, Briefcase, Percent, BarChart3 } from 'lucide-react';
import { MOCK_SALES_DATA, MOCK_PRODUCTS, MOCK_PURCHASES, MOCK_SUPPLIERS, MOCK_TRANSACTIONS, MOCK_MRS, MOCK_GST_REPORT } from '../constants';
import PowerBIReports from './PowerBIReports';

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

// Mock Data for specific reports
const MOCK_DAILY_SALES = Array.from({ length: 15 }, (_, i) => ({
 date: `2023-10-${i + 1}`,
 cashSales: Math.floor(Math.random() * 10000) + 2000,
 upiSales: Math.floor(Math.random() * 15000) + 5000,
 invoices: Math.floor(Math.random() * 40) + 10
})).map(d => ({ ...d, total: d.cashSales + d.upiSales }));

const MOCK_PRODUCT_PERFORMANCE = [
 { id: '1', name: 'MetaMol 650', category: 'Analgesic', quantity: 1200, value: 36000, growth: 12 },
 { id: '2', name: 'Azithral 500', category: 'Antibiotic', quantity: 800, value: 96000, growth: 5 },
 { id: '3', name: 'MetaClav 625', category: 'Antibiotic', quantity: 450, value: 90000, growth: 15 },
 { id: '4', name: 'Shelcal 500', category: 'Supplement', quantity: 600, value: 66000, growth: -2 },
 { id: '5', name: 'Pan 40', category: 'Antacid', quantity: 900, value: 135000, growth: 8 },
].sort((a,b) => b.value - a.value);

const MOCK_DOCTOR_SALES = [
 { name: 'Dr. Smith', specialty: 'General Physician', prescriptions: 45, value: 125000 },
 { name: 'Dr. Adams', specialty: 'Orthopedic', prescriptions: 32, value: 98000 },
 { name: 'Dr. P. Kumar', specialty: 'Pediatrician', prescriptions: 55, value: 85000 },
 { name: 'Self / OTC', specialty: '-', prescriptions: 120, value: 45000 },
].sort((a,b) => b.value - a.value);

const MOCK_USER_SALES = [
 { name: 'Rahul Verma', role: 'Cashier', transactions: 150, value: 210000 },
 { name: 'Priya Sharma', role: 'Pharmacist', transactions: 120, value: 185000 },
 { name: 'Admin', role: 'Manager', transactions: 15, value: 45000 },
].sort((a,b) => b.value - a.value);

const Reports: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SALES' | 'SUPPLIER' | 'GST' | 'POWERBI' | 'AI_REPORT'>('OVERVIEW');
 const [salesReportType, setSalesReportType] = useState<'DAILY' | 'MONTHLY' | 'PRODUCT' | 'DOCTOR' | 'USER' | 'FIELD_FORCE'>('DAILY');
 const [employeeCategoryFilter, setEmployeeCategoryFilter] = useState<'All' | 'PCD' | 'Metapharsic'>('All');

 const [aiQuery, setAiQuery] = useState('');
 const [aiResult, setAiResult] = useState<any>(null);
 const [isAiLoading, setIsAiLoading] = useState(false);

 const handleAiSubmit = async (e: React.FormEvent) => {
   e.preventDefault();
   if (!aiQuery.trim()) return;
   setIsAiLoading(true);
   try {
     const res = await fetch('/api/reports/ai-generate', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
       body: JSON.stringify({ query: aiQuery })
     });
     const data = await res.json();
     if (data.success) {
       setAiResult(data.data);
     }
   } catch (error) {
     console.error('AI Report failed', error);
   } finally {
     setIsAiLoading(false);
   }
 };


 // Mock Category Data
 const categoryData = [
 { name: 'Tablets', value: 65 },
 { name: 'Syrups', value: 20 },
 { name: 'Injections', value: 10 },
 { name: 'Surgicals', value: 5 },
 ];

 const totalStockValue = MOCK_PRODUCTS.reduce((acc, curr) => acc + (curr.stock * curr.rate), 0);
 const totalSalesValue = MOCK_SALES_DATA.reduce((acc, curr) => acc + curr.sales, 0);
 const totalPurchaseValue = MOCK_PURCHASES.reduce((acc, curr) => acc + curr.totalAmount, 0);

 const outstandingSuppliers = MOCK_SUPPLIERS.filter(s => s.outstanding > 0);
 const totalOutstanding = outstandingSuppliers.reduce((acc, s) => acc + s.outstanding, 0);

 // Aggregate Employee Sales Data
 const employeeSalesData = MOCK_MRS.map(mr => {
 const txns = MOCK_TRANSACTIONS.filter(t => t.mrId === mr.id);
 const pcdSales = txns.filter(t => t.category === 'PCD').reduce((sum, t) => sum + t.amount, 0);
 const metaSales = txns.filter(t => t.category === 'Metapharsic').reduce((sum, t) => sum + t.amount, 0);
 return {
 name: mr.name,
 PCD: pcdSales,
 Metapharsic: metaSales,
 Total: pcdSales + metaSales
 };
 }).sort((a,b) => b.Total - a.Total);

 const ReportCard = ({ title, value, icon, trend }: any) => (
 <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
 <div className="flex justify-between items-start mb-4">
 <div className="p-2 bg-slate-50 rounded-lg text-slate-600">{icon}</div>
 {trend && (
 <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
 {trend > 0 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>} {Math.abs(trend)}%
 </span>
 )}
 </div>
 <p className="text-slate-500 text-sm mb-1">{title}</p>
 <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
 </div>
 );

 return (
 <div className="space-y-6 animate-fadeIn">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h2 className="text-2xl font-bold text-slate-800">Analytics & Reports</h2>
 <div className="flex gap-2 mt-2 bg-white p-1 rounded-lg border border-slate-200 inline-flex">
 <button 
 onClick={() => setActiveTab('OVERVIEW')}
 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'OVERVIEW' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 Overview
 </button>
 <button 
 onClick={() => setActiveTab('SALES')}
 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'SALES' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 Sales Reports
 </button>
 <button 
 onClick={() => setActiveTab('GST')}
 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'GST' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 GST & Statutory
 </button>
 <button 
 onClick={() => setActiveTab('SUPPLIER')}
 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'SUPPLIER' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 Outstanding
 </button>
 <button 
 onClick={() => setActiveTab('POWERBI')}
 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'POWERBI' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 <BarChart3 size={14} />
 Power BI
 </button>
 <button 
 onClick={() => setActiveTab('AI_REPORT')}
 className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${activeTab === 'AI_REPORT' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 hover:bg-blue-50'}`}
 >
 <FileText size={14} />
 Ask AI
 </button>
 </div>
 </div>
 <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm">
 <Download size={16}/> Export Report
 </button>
 </div>

 {activeTab === 'AI_REPORT' && (
   <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fadeIn min-h-[500px]">
     <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
       <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><FileText size={24} /></div>
       <div>
         <h3 className="text-lg font-bold text-slate-800">Agentic AI Reporting</h3>
         <p className="text-sm text-slate-500">Query ERP data using natural language</p>
       </div>
     </div>

     <form onSubmit={handleAiSubmit} className="flex gap-2 mb-8">
       <input 
         type="text" 
         placeholder="e.g., 'Show me Q2 revenue forecast' or 'Analyze recent expenses'"
         className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
         value={aiQuery}
         onChange={e => setAiQuery(e.target.value)}
         disabled={isAiLoading}
       />
       <button 
         type="submit" 
         disabled={isAiLoading || !aiQuery.trim()}
         className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-md"
       >
         {isAiLoading ? 'Analyzing...' : 'Generate'}
       </button>
     </form>

     {aiResult && (
       <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mt-6 animate-fadeIn">
         <h4 className="text-xl font-bold text-slate-800 mb-2">{aiResult.title}</h4>
         <p className="text-sm text-slate-600 mb-6 bg-white p-4 rounded-lg border border-slate-100 italic">" {aiResult.summary} "</p>
         
         <div className="bg-white p-4 rounded-lg border border-slate-100">
           <ResponsiveContainer width="100%" height={300}>
             <BarChart data={aiResult.chartData}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} />
               <XAxis dataKey="name" />
               <YAxis />
               <Tooltip />
               <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
             </BarChart>
           </ResponsiveContainer>
         </div>
       </div>
     )}
   </div>
 )}

 {activeTab === 'OVERVIEW' && (
 <>
 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <ReportCard title="Total Stock Value" value={`?${totalStockValue.toLocaleString()}`} icon={<FileBarChart size={20}/>} trend={5.2} />
 <ReportCard title="Total Sales (Oct)" value={`?${totalSalesValue.toLocaleString()}`} icon={<ArrowUp size={20}/>} trend={12.5} />
 <ReportCard title="Total Purchases" value={`?${totalPurchaseValue.toLocaleString()}`} icon={<ArrowDown size={20}/>} trend={-2.4} />
 <ReportCard title="Net Profit (Est)" value={`?${(totalSalesValue * 0.2).toLocaleString()}`} icon={<FileBarChart size={20}/>} trend={8.1} />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 
 {/* Sales vs Purchase Trend */}
 <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
 <h3 className="text-lg font-bold text-slate-800 mb-4">Sales vs Purchase Trend</h3>
 <div className="w-full">
 <ResponsiveContainer width="100%" height={280} debounce={50}>
 <BarChart data={MOCK_SALES_DATA} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10}/>
 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
 <Tooltip 
 cursor={{fill: '#f8fafc'}}
 contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
 />
 <Bar dataKey="sales" name="Sales" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} />
 <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>

 {/* Category Distribution */}
 <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
 <h3 className="text-lg font-bold text-slate-800 mb-4">Sales by Category</h3>
 <div className="w-full flex items-center justify-center">
 <ResponsiveContainer width="100%" height={280} debounce={50}>
 <PieChart>
 <Pie
 data={categoryData}
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={100}
 paddingAngle={5}
 dataKey="value"
 >
 {categoryData.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip />
 </PieChart>
 </ResponsiveContainer>
 </div>
 <div className="flex justify-center gap-4 mt-2">
 {categoryData.map((entry, index) => (
 <div key={index} className="flex items-center gap-1.5">
 <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
 <span className="text-xs text-slate-500">{entry.name}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </>
 )}

 {/* SALES REPORTS TAB */}
 {activeTab === 'SALES' && (
 <div className="space-y-6">
 {/* Sales Sub-Navigation */}
 <div className="flex overflow-x-auto gap-4 border-b border-slate-200 pb-1">
 <button onClick={() => setSalesReportType('DAILY')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${salesReportType === 'DAILY' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 <Calendar size={16}/> Daily Sales
 </button>
 <button onClick={() => setSalesReportType('MONTHLY')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${salesReportType === 'MONTHLY' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 <TrendingUp size={16}/> Monthly
 </button>
 <button onClick={() => setSalesReportType('PRODUCT')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${salesReportType === 'PRODUCT' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 <ShoppingBag size={16}/> Product Wise
 </button>
 <button onClick={() => setSalesReportType('DOCTOR')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${salesReportType === 'DOCTOR' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 <Stethoscope size={16}/> Doctor Wise
 </button>
 <button onClick={() => setSalesReportType('USER')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${salesReportType === 'USER' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 <User size={16}/> User Sales
 </button>
 <button onClick={() => setSalesReportType('FIELD_FORCE')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${salesReportType === 'FIELD_FORCE' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
 <Users size={16}/> Field Force (MR)
 </button>
 </div>

 {/* DAILY SALES VIEW */}
 {salesReportType === 'DAILY' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
 <h3 className="font-bold text-slate-800 mb-4">Daily Sales Trend (Last 15 Days)</h3>
 <div className="w-full">
   <ResponsiveContainer width="100%" height={300} debounce={50}>
 <AreaChart data={MOCK_DAILY_SALES}>
 <defs>
 <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
 <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}}/>
 <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}}/>
 <Tooltip formatter={(value) => [`?${value.toLocaleString()}`, 'Sales']}/>
 <Area type="monotone" dataKey="total" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorTotal)" />
 </AreaChart>
 </ResponsiveContainer>
 </div>
 </div>
 <div className="space-y-4">
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Avg Daily Sales</p>
 <h3 className="text-2xl font-bold text-slate-800">
 ?{(MOCK_DAILY_SALES.reduce((a,b) => a + b.total, 0) / MOCK_DAILY_SALES.length).toLocaleString(undefined, {maximumFractionDigits: 0})}
 </h3>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Best Day</p>
 <h3 className="text-2xl font-bold text-green-600">
 {MOCK_DAILY_SALES.reduce((prev, current) => (prev.total > current.total) ? prev : current).date}
 </h3>
 </div>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">Detailed Daily Ledger</div>
 <table className="w-full text-left">
 <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Date</th>
 <th className="p-4 text-center">Invoices</th>
 <th className="p-4 text-right">Cash Sales</th>
 <th className="p-4 text-right">UPI / Online</th>
 <th className="p-4 text-right">Total Revenue</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {MOCK_DAILY_SALES.slice().reverse().map((day, i) => (
 <tr key={i} className="hover:bg-slate-50">
 <td className="p-4 text-sm font-medium text-slate-800">{day.date}</td>
 <td className="p-4 text-sm text-center text-slate-600">{day.invoices}</td>
 <td className="p-4 text-sm text-right text-green-600 font-medium">?{day.cashSales.toLocaleString()}</td>
 <td className="p-4 text-sm text-right text-accent font-medium">?{day.upiSales.toLocaleString()}</td>
 <td className="p-4 text-sm text-right font-bold text-slate-800">?{day.total.toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* MONTHLY SALES VIEW */}
 {salesReportType === 'MONTHLY' && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <div className="flex justify-between items-center mb-6">
 <h3 className="font-bold text-slate-800">Monthly Sales Performance (FY 23-24)</h3>
 </div>
 <div className="w-full">
   <ResponsiveContainer width="100%" height={300} debounce={50}>
 <BarChart data={MOCK_SALES_DATA}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="date" />
 <YAxis />
 <Tooltip cursor={{fill: '#f8fafc'}}/>
 <Bar dataKey="sales" name="Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 <div className="mt-6 border-t border-slate-100 pt-4 grid grid-cols-3 gap-6 text-center">
 <div>
 <p className="text-xs text-slate-500 uppercase">Total Revenue</p>
 <p className="text-xl font-bold text-slate-800">?{MOCK_SALES_DATA.reduce((a,b) => a + b.sales, 0).toLocaleString()}</p>
 </div>
 <div>
 <p className="text-xs text-slate-500 uppercase">Total Profit</p>
 <p className="text-xl font-bold text-green-600">?{MOCK_SALES_DATA.reduce((a,b) => a + b.profit, 0).toLocaleString()}</p>
 </div>
 <div>
 <p className="text-xs text-slate-500 uppercase">Growth</p>
 <p className="text-xl font-bold text-accent">+12.5%</p>
 </div>
 </div>
 </div>
 )}

 {/* PRODUCT WISE VIEW */}
 {salesReportType === 'PRODUCT' && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
 <h3 className="font-bold text-slate-800">Top Selling Products</h3>
 <span className="text-xs text-slate-500 bg-white border px-2 py-1 rounded">Ranked by Value</span>
 </div>
 <table className="w-full text-left">
 <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Rank</th>
 <th className="p-4">Product Name</th>
 <th className="p-4">Category</th>
 <th className="p-4 text-center">Qty Sold</th>
 <th className="p-4 text-right">Sales Value</th>
 <th className="p-4 text-center">Growth</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {MOCK_PRODUCT_PERFORMANCE.map((prod, i) => (
 <tr key={prod.id} className="hover:bg-slate-50">
 <td className="p-4 text-sm text-slate-500 font-mono">#{i + 1}</td>
 <td className="p-4 text-sm font-bold text-slate-800">{prod.name}</td>
 <td className="p-4 text-sm text-slate-600">{prod.category}</td>
 <td className="p-4 text-sm text-center text-slate-700">{prod.quantity}</td>
 <td className="p-4 text-sm text-right font-bold text-slate-800">?{prod.value.toLocaleString()}</td>
 <td className="p-4 text-center">
 <span className={`text-xs font-bold px-2 py-1 rounded-full ${prod.growth > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
 {prod.growth > 0 ? '+' : ''}{prod.growth}%
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {/* DOCTOR WISE VIEW */}
 {salesReportType === 'DOCTOR' && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 bg-slate-50 border-b border-slate-100">
 <h3 className="font-bold text-slate-800">Sales by Doctor Prescription</h3>
 </div>
 <table className="w-full text-left">
 <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Doctor Name</th>
 <th className="p-4">Specialty</th>
 <th className="p-4 text-center">Prescriptions</th>
 <th className="p-4 text-right">Total Revenue</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {MOCK_DOCTOR_SALES.map((doc, i) => (
 <tr key={i} className="hover:bg-slate-50">
 <td className="p-4 text-sm font-bold text-slate-800">{doc.name}</td>
 <td className="p-4 text-sm text-slate-600">{doc.specialty}</td>
 <td className="p-4 text-sm text-center text-slate-700">{doc.prescriptions}</td>
 <td className="p-4 text-sm text-right font-bold text-primary">?{doc.value.toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
 <h3 className="font-bold text-slate-800 mb-6 text-center">Revenue Share</h3>
 <div className="w-full">
   <ResponsiveContainer width="100%" height={300} debounce={50}>
 <PieChart>
 <Pie
 data={MOCK_DOCTOR_SALES}
 dataKey="value"
 nameKey="name"
 cx="50%"
 cy="50%"
 innerRadius={60}
 outerRadius={80}
 paddingAngle={5}
 >
 {MOCK_DOCTOR_SALES.map((entry, index) => (
 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
 ))}
 </Pie>
 <Tooltip formatter={(val) => `?${Number(val).toLocaleString()}`}/>
 </PieChart>
 </ResponsiveContainer>
 </div>
 <div className="space-y-2 mt-4">
 {MOCK_DOCTOR_SALES.map((doc, i) => (
 <div key={i} className="flex justify-between text-xs text-slate-600">
 <span className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></span>
 {doc.name}
 </span>
 <span className="font-bold">?{doc.value.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* USER WISE VIEW */}
 {salesReportType === 'USER' && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
 <h3 className="font-bold text-slate-800">User Sales Performance</h3>
 <span className="text-xs text-slate-500 italic">Tracking counter staff performance</span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
 {MOCK_USER_SALES.map((user, i) => (
 <div key={i} className="p-6 text-center hover:bg-slate-50 transition-colors">
 <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center text-xl font-bold text-slate-600 mb-4 border border-slate-200">
 {user.name.charAt(0)}
 </div>
 <h4 className="font-bold text-slate-800 text-lg">{user.name}</h4>
 <p className="text-sm text-slate-500 mb-4">{user.role}</p>
 
 <div className="grid grid-cols-2 gap-4 text-left bg-white p-4 rounded-lg border border-slate-100">
 <div>
 <p className="text-xs text-slate-400 uppercase">Bills</p>
 <p className="font-bold text-slate-800">{user.transactions}</p>
 </div>
 <div>
 <p className="text-xs text-slate-400 uppercase">Revenue</p>
 <p className="font-bold text-green-600">?{(user.value/1000).toFixed(1)}k</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* FIELD FORCE VIEW (NEW) */}
 {salesReportType === 'FIELD_FORCE' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* Total Field Force Sales */}
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total Field Sales</p>
 <h3 className="text-2xl font-bold text-slate-800">
 ?{employeeSalesData.reduce((acc, curr) => acc + curr.Total, 0).toLocaleString()}
 </h3>
 </div>
 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={24}/></div>
 </div>
 
 {/* PCD Contribution */}
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">PCD Contribution</p>
 <h3 className="text-2xl font-bold text-purple-600">
 ?{employeeSalesData.reduce((acc, curr) => acc + curr.PCD, 0).toLocaleString()}
 </h3>
 </div>
 <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Map size={24}/></div>
 </div>

 {/* Metapharsic Direct */}
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Direct Sales</p>
 <h3 className="text-2xl font-bold text-sky-600">
 ?{employeeSalesData.reduce((acc, curr) => acc + curr.Metapharsic, 0).toLocaleString()}
 </h3>
 </div>
 <div className="p-3 bg-sky-50 text-sky-600 rounded-lg"><Briefcase size={24}/></div>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <div className="flex justify-between items-center mb-6">
 <div>
 <h3 className="font-bold text-slate-800">Field Force Sales Breakdown</h3>
 <p className="text-xs text-slate-500">Analysis of PCD vs Metapharsic Direct Sales by Employee</p>
 </div>
 
 <div className="flex bg-slate-100 rounded-lg p-1">
 <button onClick={() => setEmployeeCategoryFilter('All')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${employeeCategoryFilter === 'All' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>All Categories</button>
 <button onClick={() => setEmployeeCategoryFilter('Metapharsic')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${employeeCategoryFilter === 'Metapharsic' ? 'bg-white shadow text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}>Metapharsic</button>
 <button onClick={() => setEmployeeCategoryFilter('PCD')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${employeeCategoryFilter === 'PCD' ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}>PCD Only</button>
 </div>
 </div>

 <div className="w-full">
   <ResponsiveContainer width="100%" height={300} debounce={50}>
 <BarChart data={employeeSalesData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
 <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} />
 <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `?${val/1000}k`}/>
 <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value) => `?${Number(value).toLocaleString()}`}/>
 <Legend />
 {(employeeCategoryFilter === 'All' || employeeCategoryFilter === 'Metapharsic') && (
 <Bar dataKey="Metapharsic" name="Metapharsic (Direct)" stackId="a" fill="#0ea5e9" barSize={40} />
 )}
 {(employeeCategoryFilter === 'All' || employeeCategoryFilter === 'PCD') && (
 <Bar dataKey="PCD" name="PCD (Partner)" stackId="a" fill="#8b5cf6" barSize={40} radius={[4, 4, 0, 0]} />
 )}
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Employee Name</th>
 <th className="p-4 text-right">Metapharsic Sales</th>
 <th className="p-4 text-right">PCD Partner Sales</th>
 <th className="p-4 text-right">Total Revenue</th>
 <th className="p-4 w-48">Contribution</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {employeeSalesData.map((emp, i) => (
 <tr key={i} className="hover:bg-slate-50">
 <td className="p-4 font-bold text-slate-800">{emp.name}</td>
 <td className="p-4 text-right font-medium text-sky-600">?{emp.Metapharsic.toLocaleString()}</td>
 <td className="p-4 text-right font-medium text-purple-600">?{emp.PCD.toLocaleString()}</td>
 <td className="p-4 text-right font-bold text-slate-800">?{emp.Total.toLocaleString()}</td>
 <td className="p-4">
 <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 w-full">
 {emp.Total > 0 && (
 <>
 <div className="bg-sky-500 h-full" style={{width: `${(emp.Metapharsic / emp.Total) * 100}%`}}></div>
 <div className="bg-purple-500 h-full" style={{width: `${(emp.PCD / emp.Total) * 100}%`}}></div>
 </>
 )}
 </div>
 <div className="flex justify-between text-[10px] mt-1 text-slate-400">
 <span>Direct</span>
 <span>PCD</span>
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

 {activeTab === 'GST' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">GSTR-1 (Sales)</p>
 <h3 className="text-2xl font-bold text-slate-800">
 ?{MOCK_GST_REPORT.reduce((a,b) => a + b.totalTax, 0).toLocaleString()}
 </h3>
 <p className="text-xs text-slate-400 mt-1">Tax Liability</p>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">GSTR-2 (Input Credit)</p>
 <h3 className="text-2xl font-bold text-green-600">
 ?{(MOCK_GST_REPORT.reduce((a,b) => a + b.totalTax, 0) * 0.7).toLocaleString()}
 </h3>
 <p className="text-xs text-slate-400 mt-1">Available ITC</p>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">GSTR-3B (Payable)</p>
 <h3 className="text-2xl font-bold text-red-600">
 ?{(MOCK_GST_REPORT.reduce((a,b) => a + b.totalTax, 0) * 0.3).toLocaleString()}
 </h3>
 <p className="text-xs text-slate-400 mt-1">Net Payable</p>
 </div>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
 <h3 className="font-bold text-slate-800 flex items-center gap-2">
 <Percent size={18} className="text-primary"/> HSN Wise Summary
 </h3>
 <button className="text-sm text-primary font-medium hover:underline">Download GSTR-1 JSON</button>
 </div>
 <table className="w-full text-left text-sm">
 <thead className="bg-white text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">HSN Code</th>
 <th className="p-4">Description</th>
 <th className="p-4 text-right">Taxable Value</th>
 <th className="p-4 text-center">Rate</th>
 <th className="p-4 text-right">CGST</th>
 <th className="p-4 text-right">SGST</th>
 <th className="p-4 text-right">Total Tax</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {MOCK_GST_REPORT.map((row, i) => (
 <tr key={i} className="hover:bg-slate-50">
 <td className="p-4 font-mono text-slate-600">{row.hsn}</td>
 <td className="p-4 text-slate-800 font-medium">{row.description}</td>
 <td className="p-4 text-right text-slate-700">?{row.taxableValue.toLocaleString()}</td>
 <td className="p-4 text-center text-slate-600">{row.taxRate}%</td>
 <td className="p-4 text-right text-slate-600">?{row.cgst.toLocaleString()}</td>
 <td className="p-4 text-right text-slate-600">?{row.sgst.toLocaleString()}</td>
 <td className="p-4 text-right font-bold text-slate-800">?{row.totalTax.toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'SUPPLIER' && (
 <div className="space-y-6">
 <div className="bg-red-50 border border-red-100 p-6 rounded-xl flex items-center justify-between">
 <div>
 <h3 className="text-red-800 font-bold text-lg">Total Outstanding Liability</h3>
 <p className="text-red-600 text-sm">Amount payable to suppliers</p>
 </div>
 <div className="text-3xl font-bold text-red-700">?{totalOutstanding.toLocaleString()}</div>
 </div>

 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="p-4 border-b border-slate-100 bg-slate-50">
 <h3 className="font-bold text-slate-800 flex items-center gap-2">
 <AlertCircle size={18} className="text-primary"/> Outstanding Balance by Supplier
 </h3>
 </div>
 <div className="divide-y divide-slate-100">
 {outstandingSuppliers.length > 0 ? outstandingSuppliers.map(supplier => {
 // Find unpaid/partial invoices for this supplier
 const pendingInvoices = MOCK_PURCHASES.filter(p => 
 p.supplierId === supplier.id && 
 (p.paymentStatus === 'Unpaid' || p.paymentStatus === 'Partial')
 );

 return (
 <div key={supplier.id} className="p-6 hover:bg-slate-50 transition-colors">
 <div className="flex justify-between items-start mb-4">
 <div>
 <h4 className="text-lg font-bold text-slate-800">{supplier.name}</h4>
 <p className="text-sm text-slate-500">{supplier.contact} | {supplier.gstin}</p>
 </div>
 <div className="text-right">
 <p className="text-xs text-slate-500 font-bold uppercase">Total Due</p>
 <p className="text-xl font-bold text-red-600">?{supplier.outstanding.toLocaleString()}</p>
 </div>
 </div>

 {/* Nested Invoices Table */}
 <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-100 text-slate-600 font-semibold">
 <tr>
 <th className="p-3">Invoice No</th>
 <th className="p-3">Date</th>
 <th className="p-3">Total Amount</th>
 <th className="p-3">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {pendingInvoices.length > 0 ? pendingInvoices.map(inv => (
 <tr key={inv.id}>
 <td className="p-3 font-medium text-slate-700">{inv.invoiceNo}</td>
 <td className="p-3 text-slate-500">{inv.date}</td>
 <td className="p-3 font-medium">?{inv.totalAmount.toLocaleString()}</td>
 <td className="p-3">
 <span className={`text-xs px-2 py-0.5 rounded font-bold ${inv.paymentStatus === 'Unpaid' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
 {inv.paymentStatus}
 </span>
 </td>
 </tr>
 )) : (
 <tr>
 <td colSpan={4} className="p-3 text-center text-slate-400 italic">
 Outstanding balance not linked to specific recent mock invoices.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 );
 }) : (
 <div className="p-10 text-center text-slate-400">
 <FileText size={48} className="mx-auto mb-2 opacity-30"/>
 <p>No suppliers with outstanding balance.</p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {activeTab === 'POWERBI' && (
 <PowerBIReports />
 )}
 </div>
 );
};

export default Reports;

