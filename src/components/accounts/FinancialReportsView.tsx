import React, { useState } from 'react';
import { ERPLayout, FilterBar, DataTable, Tabs, Badge } from '../UniversalLayout';
import { useDataFetch } from '../../hooks/useDataFetch';
import { TrialBalanceEntry, BalanceSheetReport, ProfitLossReport } from '../../types';
import { FileText, TrendingUp, Scale, BarChart3 } from 'lucide-react';

const FinancialReportsView: React.FC = () => {
 const [activeReport, setActiveReport] = useState('TRIAL_BALANCE');
 const [asOnDate, setAsOnDate] = useState('2026-03-31');
 
 const trialBalanceFetch = useDataFetch<any>('/api/accounting/trial-balance');
 const balanceSheetFetch = useDataFetch<BalanceSheetReport>('/api/accounting/balance-sheet');
 const profitLossFetch = useDataFetch<ProfitLossReport>('/api/accounting/profit-loss');

 const reportTabs = [
 { id: 'TRIAL_BALANCE', label: 'Trial Balance' },
 { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
 { id: 'PROFIT_LOSS', label: 'P&L Statement' },
 ];

 const renderTrialBalance = () => {
 const { data, loading } = trialBalanceFetch;
 const columns = [
 { key: 'accountCode', label: 'Code', width: '15%' },
 { key: 'accountName', label: 'Account Name', width: '45%' },
 { key: 'totalDebit', label: 'Debit', width: '20%', align: 'right' as const, render: (val: number) => `₹${val.toLocaleString()}` },
 { key: 'totalCredit', label: 'Credit', width: '20%', align: 'right' as const, render: (val: number) => `₹${val.toLocaleString()}` }
 ];

 return (
 <DataTable 
 columns={columns} 
 data={data?.entries || []} 
 loading={loading} 
 emptyMessage="Run Trial Balance report to see data"
 />
 );
 };

 const renderBalanceSheet = () => {
 const { data, loading } = balanceSheetFetch;
 if (loading) return <div>Loading...</div>;
 if (!data) return <div>No report generated</div>;

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {/* Assets Section */}
 <div className="border border-slate-200 rounded-lg overflow-hidden">
 <div className="bg-accent text-white p-3 font-bold flex justify-between">
 <span>ASSETS</span>
 <span>₹{data.totalAssets.toLocaleString()}</span>
 </div>
 <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase">Fixed Assets</div>
 {data.assets.fixedItems.map(item => (
 <div key={item.accountId} className="p-3 border-b border-slate-100 flex justify-between bg-white">
 <span>{item.accountName}</span>
 <span>₹{item.currentYear.toLocaleString()}</span>
 </div>
 ))}
 <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase">Current Assets</div>
 {data.assets.currentItems.map(item => (
 <div key={item.accountId} className="p-3 border-b border-slate-100 flex justify-between bg-white">
 <span>{item.accountName}</span>
 <span>₹{item.currentYear.toLocaleString()}</span>
 </div>
 ))}
 </div>

 {/* Liabilities & Equity Section */}
 <div className="border border-slate-200 rounded-lg overflow-hidden">
 <div className="bg-slate-800 text-white p-3 font-bold flex justify-between">
 <span>LIABILITIES & EQUITY</span>
 <span>₹{(data.totalLiabilities + data.totalEquity).toLocaleString()}</span>
 </div>
 <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase">Liabilities</div>
 {data.liabilities.currentItems.map(item => (
 <div key={item.accountId} className="p-3 border-b border-slate-100 flex justify-between bg-white">
 <span>{item.accountName}</span>
 <span>₹{item.currentYear.toLocaleString()}</span>
 </div>
 ))}
 <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase">Equity</div>
 {data.equity.currentItems.map(item => (
 <div key={item.accountId} className="p-3 border-b border-slate-100 flex justify-between bg-white">
 <span>{item.accountName}</span>
 <span>₹{item.currentYear.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 );
 };

 const renderProfitLoss = () => {
 const { data, loading } = profitLossFetch;
 if (loading) return <div>Loading...</div>;
 if (!data) return <div>No report generated</div>;

 return (
 <div className="max-w-4xl mx-auto border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
 <div className="bg-slate-50 p-6 border-b border-slate-200">
 <h2 className="text-xl font-bold text-slate-900 text-center uppercase tracking-wider">Profit & Loss Account</h2>
 <p className="text-slate-500 text-center text-sm">{data.period}</p>
 </div>
 
 <div className="p-6">
 {/* Revenue */}
 <div className="mb-8">
 <h3 className="text-sm font-bold text-slate-900 uppercase border-b-2 border-slate-800 pb-1 mb-3 flex justify-between">
 <span>Revenue / Income</span>
 <span>₹{data.revenue.subtotal.toLocaleString()}</span>
 </h3>
 {data.revenue.items.map(item => (
 <div key={item.accountId} className="flex justify-between py-2 border-b border-slate-100 text-slate-700">
 <span>{item.accountName}</span>
 <span className="font-medium text-slate-900">₹{item.currentPeriod.toLocaleString()}</span>
 </div>
 ))}
 </div>

 {/* Expenses */}
 <div className="mb-8">
 <h3 className="text-sm font-bold text-slate-900 uppercase border-b-2 border-slate-800 pb-1 mb-3 flex justify-between">
 <span>Expenses</span>
 <span>₹{data.expenses.subtotal.toLocaleString()}</span>
 </h3>
 {data.expenses.items.map(item => (
 <div key={item.accountId} className="flex justify-between py-2 border-b border-slate-100 text-slate-700">
 <span>{item.accountName}</span>
 <span className="font-medium text-slate-900">₹{item.currentPeriod.toLocaleString()}</span>
 </div>
 ))}
 </div>

 {/* Bottom Line */}
 <div className={`p-4 rounded-lg flex justify-between items-center ${data.netProfit >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
 <span className="text-lg font-bold">NET PROFIT / LOSS</span>
 <span className="text-2xl font-bold">₹{data.netProfit.toLocaleString()}</span>
 </div>
 </div>
 </div>
 );
 };

 return (
 <ERPLayout
 title="Financial Statements"
 description="Detailed financial reports including Trial Balance, Balance Sheet, and P&L"
 onPrint={() => window.print()}
 >
 <div className="flex justify-between items-end mb-6">
 <Tabs tabs={reportTabs} activeTab={activeReport} onChange={setActiveReport} />
 <div className="pb-3">
 <FilterBar
 filters={[
 {
 id: 'asOn',
 label: 'Report Date',
 type: 'date',
 value: asOnDate,
 onChange: setAsOnDate
 }
 ]}
 />
 </div>
 </div>

 <div className="mt-4">
 {activeReport === 'TRIAL_BALANCE' && renderTrialBalance()}
 {activeReport === 'BALANCE_SHEET' && renderBalanceSheet()}
 {activeReport === 'PROFIT_LOSS' && renderProfitLoss()}
 </div>
 </ERPLayout>
 );
};

export default FinancialReportsView;

