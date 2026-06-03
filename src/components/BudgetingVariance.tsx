import React, { useState, useMemo } from 'react';
import { 
 Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle,
 Calendar, DollarSign, PieChart, BarChart3, Download,
 Plus, Edit3, Trash2, Save, RefreshCw, Filter, Search,
 ArrowUpRight, ArrowDownRight, Percent, FileSpreadsheet,
 ChevronDown, ChevronUp, Building2, Layers
} from 'lucide-react';

interface BudgetAccount {
 id: string;
 accountCode: string;
 accountName: string;
 accountType: 'Revenue' | 'Expense' | 'Asset' | 'Liability';
 costCenter?: string;
}

interface BudgetPeriod {
 id: string;
 name: string;
 startDate: string;
 endDate: string;
 status: 'Draft' | 'Active' | 'Closed';
}

interface BudgetEntry {
 id: string;
 accountId: string;
 periodId: string;
 budgetedAmount: number;
 actualAmount: number;
 variance: number;
 variancePercent: number;
 notes?: string;
}

interface VarianceReport {
 account: BudgetAccount;
 budgeted: number;
 actual: number;
 variance: number;
 variancePercent: number;
 status: 'favorable' | 'unfavorable' | 'on_track';
 trend: 'improving' | 'declining' | 'stable';
}

const BudgetingVariance: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'budgets' | 'variance' | 'forecast'>('budgets');
 const [selectedPeriod, setSelectedPeriod] = useState<string>('FY2025-26');
 const [showBudgetModal, setShowBudgetModal] = useState(false);
 const [editingBudget, setEditingBudget] = useState<BudgetEntry | null>(null);

 // Sample Data
 const periods: BudgetPeriod[] = [
 { id: '1', name: 'FY 2024-25', startDate: '2024-04-01', endDate: '2025-03-31', status: 'Closed' },
 { id: '2', name: 'FY 2025-26', startDate: '2025-04-01', endDate: '2026-03-31', status: 'Active' },
 { id: '3', name: 'Q1 2025-26', startDate: '2025-04-01', endDate: '2025-06-30', status: 'Active' },
 ];

 const accounts: BudgetAccount[] = [
 { id: 'rev1', accountCode: '4001', accountName: 'Sales - Domestic', accountType: 'Revenue' },
 { id: 'rev2', accountCode: '4002', accountName: 'Sales - Export', accountType: 'Revenue' },
 { id: 'exp1', accountCode: '5001', accountName: 'Raw Materials', accountType: 'Expense', costCenter: 'Production' },
 { id: 'exp2', accountCode: '5002', accountName: 'Salaries & Wages', accountType: 'Expense', costCenter: 'HR' },
 { id: 'exp3', accountCode: '5003', accountName: 'Marketing Expenses', accountType: 'Expense', costCenter: 'Marketing' },
 { id: 'exp4', accountCode: '5004', accountName: 'Rent & Utilities', accountType: 'Expense', costCenter: 'Admin' },
 { id: 'exp5', accountCode: '5005', accountName: 'R&D Expenses', accountType: 'Expense', costCenter: 'R&D' },
 { id: 'exp6', accountCode: '5006', accountName: 'Logistics', accountType: 'Expense', costCenter: 'Operations' },
 ];

 const budgetEntries: BudgetEntry[] = [
 { id: '1', accountId: 'rev1', periodId: '2', budgetedAmount: 5000000, actualAmount: 4200000, variance: 800000, variancePercent: 16.0 },
 { id: '2', accountId: 'rev2', periodId: '2', budgetedAmount: 3000000, actualAmount: 2800000, variance: 200000, variancePercent: 6.7 },
 { id: '3', accountId: 'exp1', periodId: '2', budgetedAmount: 2000000, actualAmount: 1850000, variance: -150000, variancePercent: -7.5 },
 { id: '4', accountId: 'exp2', periodId: '2', budgetedAmount: 1500000, actualAmount: 1480000, variance: -20000, variancePercent: -1.3 },
 { id: '5', accountId: 'exp3', periodId: '2', budgetedAmount: 800000, actualAmount: 950000, variance: 150000, variancePercent: 18.8 },
 { id: '6', accountId: 'exp4', periodId: '2', budgetedAmount: 400000, actualAmount: 380000, variance: -20000, variancePercent: -5.0 },
 { id: '7', accountId: 'exp5', periodId: '2', budgetedAmount: 600000, actualAmount: 520000, variance: -80000, variancePercent: -13.3 },
 { id: '8', accountId: 'exp6', periodId: '2', budgetedAmount: 500000, actualAmount: 480000, variance: -20000, variancePercent: -4.0 },
 ];

 const varianceReports: VarianceReport[] = useMemo(() => {
 return budgetEntries.map(entry => {
 const account = accounts.find(a => a.id === entry.accountId)!;
 const isRevenue = account.accountType === 'Revenue';
 const isExpense = account.accountType === 'Expense';
 
 let status: 'favorable' | 'unfavorable' | 'on_track';
 if (Math.abs(entry.variancePercent) <= 5) {
 status = 'on_track';
 } else if ((isRevenue && entry.variance < 0) || (isExpense && entry.variance > 0)) {
 status = 'unfavorable';
 } else {
 status = 'favorable';
 }

 return {
 account,
 budgeted: entry.budgetedAmount,
 actual: entry.actualAmount,
 variance: entry.variance,
 variancePercent: entry.variancePercent,
 status,
 trend: entry.variancePercent > 10 ? 'declining' : entry.variancePercent < -10 ? 'improving' : 'stable'
 };
 });
 }, [budgetEntries, accounts]);

 const summaryStats = useMemo(() => {
 const revenue = varianceReports.filter(r => r.account.accountType === 'Revenue');
 const expenses = varianceReports.filter(r => r.account.accountType === 'Expense');
 
 const totalBudgetedRevenue = revenue.reduce((sum, r) => sum + r.budgeted, 0);
 const totalActualRevenue = revenue.reduce((sum, r) => sum + r.actual, 0);
 const totalBudgetedExpense = expenses.reduce((sum, r) => sum + r.budgeted, 0);
 const totalActualExpense = expenses.reduce((sum, r) => sum + r.actual, 0);
 
 const budgetedProfit = totalBudgetedRevenue - totalBudgetedExpense;
 const actualProfit = totalActualRevenue - totalActualExpense;
 const profitVariance = actualProfit - budgetedProfit;
 
 return {
 totalBudgetedRevenue,
 totalActualRevenue,
 totalBudgetedExpense,
 totalActualExpense,
 budgetedProfit,
 actualProfit,
 profitVariance,
 revenueAchievement: (totalActualRevenue / totalBudgetedRevenue) * 100,
 expenseControl: (totalActualExpense / totalBudgetedExpense) * 100,
 };
 }, [varianceReports]);

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('en-IN', {
 style: 'currency',
 currency: 'INR',
 maximumFractionDigits: 0
 }).format(amount);
 };

 const exportToExcel = () => {
 const data = varianceReports.map(r => ({
 'Account Code': r.account.accountCode,
 'Account Name': r.account.accountName,
 'Type': r.account.accountType,
 'Cost Center': r.account.costCenter || '-',
 'Budgeted': r.budgeted,
 'Actual': r.actual,
 'Variance': r.variance,
 'Variance %': r.variancePercent.toFixed(2) + '%',
 'Status': r.status
 }));
 
 const csv = [
 Object.keys(data[0]).join(','),
 ...data.map(row => Object.values(row).join(','))
 ].join('\n');
 
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `variance_report_${selectedPeriod}.csv`;
 a.click();
 };

 return (
 <div className="h-full flex flex-col bg-slate-50">
 {/* Header */}
 <div className="bg-white border-b border-slate-200 px-6 py-4">
 <div className="flex justify-between items-center">
 <div>
 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
 <Target className="text-purple-600" size={24} />
 Budgeting & Variance Analysis
 </h3>
 <p className="text-slate-500 text-sm mt-1">Financial planning, budget tracking, and variance reporting</p>
 </div>
 <div className="flex gap-2">
 <select
 value={selectedPeriod}
 onChange={(e) => setSelectedPeriod(e.target.value)}
 className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
 >
 {periods.map(p => (
 <option key={p.id} value={p.name}>{p.name}</option>
 ))}
 </select>
 <button
 onClick={exportToExcel}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
 >
 <FileSpreadsheet size={18} />
 Export
 </button>
 </div>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-4 gap-4 mt-4">
 <div className="bg-emerald-50 p-4 rounded-lg border border-green-200">
 <div className="flex items-center justify-between">
 <span className="text-green-700 text-sm font-medium">Revenue Achievement</span>
 <TrendingUp size={18} className="text-green-600" />
 </div>
 <div className="text-2xl font-bold text-green-800 mt-1">
 {summaryStats.revenueAchievement.toFixed(1)}%
 </div>
 <div className="text-xs text-green-600 mt-1">
 {formatCurrency(summaryStats.totalActualRevenue)} / {formatCurrency(summaryStats.totalBudgetedRevenue)}
 </div>
 </div>

 <div className="bg-slate-50 p-4 rounded-lg border border-blue-200">
 <div className="flex items-center justify-between">
 <span className="text-accent text-sm font-medium">Expense Control</span>
 <Percent size={18} className="text-accent" />
 </div>
 <div className="text-2xl font-bold text-blue-800 mt-1">
 {summaryStats.expenseControl.toFixed(1)}%
 </div>
 <div className="text-xs text-accent mt-1">
 {formatCurrency(summaryStats.totalActualExpense)} / {formatCurrency(summaryStats.totalBudgetedExpense)}
 </div>
 </div>

 <div className={`p-4 rounded-lg border ${
 summaryStats.profitVariance >= 0 
 ? 'bg-emerald-50 border-emerald-200' 
 : 'bg-red-50 border-red-200'
 }`}>
 <div className="flex items-center justify-between">
 <span className={`text-sm font-medium ${summaryStats.profitVariance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
 Profit Variance
 </span>
 {summaryStats.profitVariance >= 0 ? <ArrowUpRight size={18} className="text-emerald-600" /> : <ArrowDownRight size={18} className="text-red-600" />}
 </div>
 <div className={`text-2xl font-bold mt-1 ${summaryStats.profitVariance >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
 {formatCurrency(summaryStats.profitVariance)}
 </div>
 <div className={`text-xs mt-1 ${summaryStats.profitVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
 vs Budget: {formatCurrency(summaryStats.budgetedProfit)}
 </div>
 </div>

 <div className="bg-slate-50 p-4 rounded-lg border border-purple-200">
 <div className="flex items-center justify-between">
 <span className="text-purple-700 text-sm font-medium">Actual Profit</span>
 <DollarSign size={18} className="text-purple-600" />
 </div>
 <div className="text-2xl font-bold text-purple-800 mt-1">
 {formatCurrency(summaryStats.actualProfit)}
 </div>
 <div className="text-xs text-purple-600 mt-1">
 Margin: {((summaryStats.actualProfit / summaryStats.totalActualRevenue) * 100).toFixed(1)}%
 </div>
 </div>
 </div>
 </div>

 {/* Tabs */}
 <div className="px-6 py-3 bg-white border-b border-slate-200">
 <div className="flex gap-4">
 {[
 { id: 'budgets', label: 'Budget Setup', icon: Target },
 { id: 'variance', label: 'Variance Analysis', icon: BarChart3 },
 { id: 'forecast', label: 'Forecasting', icon: TrendingUp },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeTab === tab.id 
 ? 'bg-purple-600 text-white' 
 : 'text-slate-600 hover:bg-slate-100'
 }`}
 >
 <tab.icon size={16} />
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 p-6 overflow-auto">
 {activeTab === 'budgets' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <h4 className="text-lg font-semibold text-slate-800">Budget Entries - {selectedPeriod}</h4>
 <button
 onClick={() => setShowBudgetModal(true)}
 className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
 >
 <Plus size={18} />
 Add Budget Entry
 </button>
 </div>

 <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
 <table className="w-full">
 <thead className="bg-slate-50">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Account</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Budgeted</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actual</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Variance</th>
 <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Status</th>
 <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {varianceReports.map((report, idx) => (
 <tr key={idx} className="hover:bg-slate-50">
 <td className="px-4 py-3">
 <div className="font-medium text-slate-800">{report.account.accountName}</div>
 <div className="text-xs text-slate-500">{report.account.accountCode}</div>
 </td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded-full text-xs ${
 report.account.accountType === 'Revenue' 
 ? 'bg-green-100 text-green-700' 
 : 'bg-red-100 text-red-700'
 }`}>
 {report.account.accountType}
 </span>
 </td>
 <td className="px-4 py-3 text-right font-medium">{formatCurrency(report.budgeted)}</td>
 <td className="px-4 py-3 text-right font-medium">{formatCurrency(report.actual)}</td>
 <td className="px-4 py-3 text-right">
 <div className={`font-medium ${report.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
 {report.variance >= 0 ? '+' : ''}{formatCurrency(report.variance)}
 </div>
 <div className={`text-xs ${report.variancePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
 {report.variancePercent >= 0 ? '+' : ''}{report.variancePercent.toFixed(1)}%
 </div>
 </td>
 <td className="px-4 py-3 text-center">
 <span className={`px-2 py-1 rounded-full text-xs ${
 report.status === 'favorable' ? 'bg-green-100 text-green-700' :
 report.status === 'unfavorable' ? 'bg-red-100 text-red-700' :
 'bg-yellow-100 text-yellow-700'
 }`}>
 {report.status === 'on_track' ? 'On Track' : report.status}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <button className="text-accent hover:text-blue-800 mr-2">
 <Edit3 size={16} />
 </button>
 <button className="text-red-600 hover:text-red-800">
 <Trash2 size={16} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'variance' && (
 <div className="grid grid-cols-2 gap-6">
 {/* Variance by Account */}
 <div className="bg-white rounded-lg border border-slate-200 p-4">
 <h4 className="font-semibold text-slate-800 mb-4">Variance by Account</h4>
 <div className="space-y-3">
 {varianceReports.map((report, idx) => (
 <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
 <div>
 <div className="font-medium text-slate-800">{report.account.accountName}</div>
 <div className="text-xs text-slate-500">{report.account.accountCode}</div>
 </div>
 <div className="text-right">
 <div className={`font-bold ${report.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
 {report.variance >= 0 ? '+' : ''}{formatCurrency(report.variance)}
 </div>
 <div className="text-xs text-slate-500">{report.variancePercent.toFixed(1)}%</div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Variance Analysis Chart */}
 <div className="bg-white rounded-lg border border-slate-200 p-4">
 <h4 className="font-semibold text-slate-800 mb-4">Variance Distribution</h4>
 <div className="space-y-4">
 {[
 { label: 'Favorable', count: varianceReports.filter(r => r.status === 'favorable').length, color: 'bg-green-500' },
 { label: 'On Track', count: varianceReports.filter(r => r.status === 'on_track').length, color: 'bg-yellow-500' },
 { label: 'Unfavorable', count: varianceReports.filter(r => r.status === 'unfavorable').length, color: 'bg-red-500' },
 ].map((item, idx) => (
 <div key={idx}>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-slate-600">{item.label}</span>
 <span className="font-medium">{item.count} accounts</span>
 </div>
 <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
 <div 
 className={`h-full ${item.color} transition-all duration-500`}
 style={{ width: `${(item.count / varianceReports.length) * 100}%` }}
 />
 </div>
 </div>
 ))}
 </div>

 <div className="mt-6 p-4 bg-purple-50 rounded-lg">
 <h5 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
 <AlertCircle size={16} />
 Key Insights
 </h5>
 <ul className="text-sm text-purple-700 space-y-1">
 <li>• Marketing expenses exceeded budget by 18.8%</li>
 <li>• R&D expenses under budget by 13.3% (savings)</li>
 <li>• Domestic sales 16% below target</li>
 <li>• Raw material costs well controlled</li>
 </ul>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'forecast' && (
 <div className="text-center py-12 text-slate-400">
 <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
 <p>Forecasting module - Use Power BI Reports for advanced forecasting</p>
 <button 
 onClick={() => {}}
 className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
 >
 Go to Power BI Forecasting
 </button>
 </div>
 )}
 </div>
 </div>
 );
};

export default BudgetingVariance;


