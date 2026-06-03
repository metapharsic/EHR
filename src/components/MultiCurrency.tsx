import React, { useState, useMemo } from 'react';
import { 
 DollarSign, Euro, PoundSterling, JapaneseYen, RefreshCw,
 TrendingUp, TrendingDown, Calendar, Download, Calculator,
 Globe, ArrowRightLeft, Wallet, Building2, FileSpreadsheet,
 AlertCircle, CheckCircle, Info, Search, Filter
} from 'lucide-react';

interface Currency {
 code: string;
 name: string;
 symbol: string;
 flag: string;
 exchangeRate: number; // Against INR
 inverseRate: number; // INR to foreign
 lastUpdated: string;
 trend: 'up' | 'down' | 'stable';
 changePercent: number;
}

interface ForexTransaction {
 id: string;
 date: string;
 type: 'Receipt' | 'Payment' | 'Transfer';
 foreignCurrency: string;
 foreignAmount: number;
 exchangeRate: number;
 inrAmount: number;
 counterparty: string;
 description: string;
 reference: string;
 status: 'Completed' | 'Pending' | 'Cancelled';
}

interface CurrencyExposure {
 currency: string;
 receivables: number;
 payables: number;
 netExposure: number;
 inrValue: number;
 riskLevel: 'Low' | 'Medium' | 'High';
}

const SUPPORTED_CURRENCIES: Currency[] = [
 { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', exchangeRate: 83.25, inverseRate: 0.012, lastUpdated: '2024-05-15 14:30', trend: 'up', changePercent: 0.15 },
 { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', exchangeRate: 90.45, inverseRate: 0.011, lastUpdated: '2024-05-15 14:30', trend: 'down', changePercent: -0.08 },
 { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', exchangeRate: 105.20, inverseRate: 0.0095, lastUpdated: '2024-05-15 14:30', trend: 'stable', changePercent: 0.02 },
 { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', exchangeRate: 0.55, inverseRate: 1.82, lastUpdated: '2024-05-15 14:30', trend: 'down', changePercent: -0.25 },
 { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', exchangeRate: 55.30, inverseRate: 0.018, lastUpdated: '2024-05-15 14:30', trend: 'up', changePercent: 0.35 },
 { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦', exchangeRate: 61.15, inverseRate: 0.016, lastUpdated: '2024-05-15 14:30', trend: 'stable', changePercent: 0.05 },
 { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', flag: '🇨🇭', exchangeRate: 92.80, inverseRate: 0.0108, lastUpdated: '2024-05-15 14:30', trend: 'up', changePercent: 0.12 },
 { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', exchangeRate: 11.55, inverseRate: 0.0866, lastUpdated: '2024-05-15 14:30', trend: 'down', changePercent: -0.18 },
 { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', exchangeRate: 61.85, inverseRate: 0.0162, lastUpdated: '2024-05-15 14:30', trend: 'up', changePercent: 0.22 },
 { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪', exchangeRate: 22.67, inverseRate: 0.0441, lastUpdated: '2024-05-15 14:30', trend: 'stable', changePercent: 0.01 },
];

const MultiCurrency: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'rates' | 'transactions' | 'exposure' | 'calculator'>('rates');
 const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
 const [amount, setAmount] = useState<string>('');
 const [conversionDirection, setConversionDirection] = useState<'toINR' | 'fromINR'>('toINR');

 // Demo Forex Transactions
 const forexTransactions: ForexTransaction[] = [
 {
 id: 'FX001',
 date: '2024-05-10',
 type: 'Receipt',
 foreignCurrency: 'USD',
 foreignAmount: 25000,
 exchangeRate: 83.15,
 inrAmount: 2078750,
 counterparty: 'Global Pharma Inc',
 description: 'Export Invoice #EXP/2024/001',
 reference: 'INV-EXP-001',
 status: 'Completed'
 },
 {
 id: 'FX002',
 date: '2024-05-12',
 type: 'Payment',
 foreignCurrency: 'EUR',
 foreignAmount: 15000,
 exchangeRate: 90.35,
 inrAmount: 1355250,
 counterparty: 'Bosch Packaging',
 description: 'Machinery Purchase',
 reference: 'PO-2024-015',
 status: 'Completed'
 },
 {
 id: 'FX003',
 date: '2024-05-14',
 type: 'Receipt',
 foreignCurrency: 'GBP',
 foreignAmount: 8000,
 exchangeRate: 105.10,
 inrAmount: 840800,
 counterparty: 'UK Distributors Ltd',
 description: 'Sales Commission',
 reference: 'COMM-001',
 status: 'Pending'
 },
 {
 id: 'FX004',
 date: '2024-05-15',
 type: 'Payment',
 foreignCurrency: 'USD',
 foreignAmount: 12000,
 exchangeRate: 83.25,
 inrAmount: 999000,
 counterparty: 'Sigma Aldrich',
 description: 'Raw Material Import',
 reference: 'PO-2024-018',
 status: 'Pending'
 }
 ];

 // Currency Exposure
 const exposures: CurrencyExposure[] = [
 { currency: 'USD', receivables: 45000, payables: 18000, netExposure: 27000, inrValue: 2247750, riskLevel: 'Medium' },
 { currency: 'EUR', receivables: 12000, payables: 25000, netExposure: -13000, inrValue: -1175850, riskLevel: 'Low' },
 { currency: 'GBP', receivables: 15000, payables: 5000, netExposure: 10000, inrValue: 1052000, riskLevel: 'Low' },
 { currency: 'JPY', receivables: 500000, payables: 200000, netExposure: 300000, inrValue: 165000, riskLevel: 'High' }
 ];

 const selectedCurrencyData = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);
 
 const convertedAmount = useMemo(() => {
 if (!amount || !selectedCurrencyData) return 0;
 const numAmount = parseFloat(amount);
 if (isNaN(numAmount)) return 0;
 
 if (conversionDirection === 'toINR') {
 return numAmount * selectedCurrencyData.exchangeRate;
 } else {
 return numAmount * selectedCurrencyData.inverseRate;
 }
 }, [amount, selectedCurrencyData, conversionDirection]);

 const totalForexReceivables = forexTransactions
 .filter(t => t.type === 'Receipt' && t.status === 'Completed')
 .reduce((sum, t) => sum + t.inrAmount, 0);
 
 const totalForexPayables = forexTransactions
 .filter(t => t.type === 'Payment' && t.status === 'Completed')
 .reduce((sum, t) => sum + t.inrAmount, 0);

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
 {/* Header */}
 <div className="p-4 border-b border-slate-100 bg-accent text-white">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Globe size={28} />
 <div>
 <h3 className="font-bold text-lg">Multi-Currency Management</h3>
 <p className="text-green-100 text-sm">Forex Transactions & Exchange Rates</p>
 </div>
 </div>
 <div className="flex gap-4">
 <div className="text-right">
 <div className="text-sm text-green-100">Forex Receivables</div>
 <div className="font-semibold">₹{totalForexReceivables.toLocaleString()}</div>
 </div>
 <div className="text-right">
 <div className="text-sm text-green-100">Forex Payables</div>
 <div className="font-semibold">₹{totalForexPayables.toLocaleString()}</div>
 </div>
 </div>
 </div>
 </div>

 {/* Navigation */}
 <div className="border-b border-slate-200 bg-slate-50">
 <div className="flex">
 {[
 { id: 'rates', label: 'Exchange Rates', icon: RefreshCw },
 { id: 'transactions', label: 'Forex Transactions', icon: ArrowRightLeft },
 { id: 'exposure', label: 'Currency Exposure', icon: Wallet },
 { id: 'calculator', label: 'FX Calculator', icon: Calculator }
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors ${
 activeTab === tab.id 
 ? 'bg-white text-green-600 border-b-2 border-green-600' 
 : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
 }`}
 >
 <tab.icon size={16} />
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* Exchange Rates Tab */}
 {activeTab === 'rates' && (
 <div className="flex-1 overflow-auto p-6">
 <div className="mb-4 flex justify-between items-center">
 <h4 className="text-lg font-semibold text-slate-800">Live Exchange Rates (vs INR)</h4>
 <div className="text-sm text-slate-500">
 Last Updated: {SUPPORTED_CURRENCIES[0].lastUpdated}
 <button className="ml-2 text-green-600 hover:text-green-700">
 <RefreshCw size={14} className="inline" /> Refresh
 </button>
 </div>
 </div>
 
 <div className="grid grid-cols-2 gap-4">
 {SUPPORTED_CURRENCIES.map(currency => (
 <div key={currency.code} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-none transition-shadow">
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-3">
 <span className="text-3xl">{currency.flag}</span>
 <div>
 <div className="font-bold text-slate-800">{currency.code}</div>
 <div className="text-sm text-slate-500">{currency.name}</div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-2xl font-bold text-slate-800">{currency.symbol}{currency.exchangeRate.toFixed(2)}</div>
 <div className={`text-sm flex items-center justify-end gap-1 ${
 currency.trend === 'up' ? 'text-green-600' :
 currency.trend === 'down' ? 'text-red-600' :
 'text-slate-500'
 }`}>
 {currency.trend === 'up' ? <TrendingUp size={14} /> :
 currency.trend === 'down' ? <TrendingDown size={14} /> :
 <RefreshCw size={14} />}
 {currency.changePercent > 0 ? '+' : ''}{currency.changePercent}%
 </div>
 </div>
 </div>
 <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm">
 <span className="text-slate-500">1 INR = {currency.symbol}{(1/currency.exchangeRate).toFixed(4)}</span>
 <span className="text-slate-400">Inverse Rate</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Transactions Tab */}
 {activeTab === 'transactions' && (
 <div className="flex-1 overflow-auto p-6">
 <div className="mb-4 flex justify-between items-center">
 <h4 className="text-lg font-semibold text-slate-800">Forex Transactions</h4>
 <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
 + New Transaction
 </button>
 </div>
 
 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-4 py-3 text-left">Date</th>
 <th className="px-4 py-3 text-left">Type</th>
 <th className="px-4 py-3 text-left">Counterparty</th>
 <th className="px-4 py-3 text-left">Currency</th>
 <th className="px-4 py-3 text-right">Foreign Amt</th>
 <th className="px-4 py-3 text-right">Rate</th>
 <th className="px-4 py-3 text-right">INR Value</th>
 <th className="px-4 py-3 text-center">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {forexTransactions.map(tx => (
 <tr key={tx.id} className="hover:bg-slate-50">
 <td className="px-4 py-3">{tx.date}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-1 rounded text-xs ${
 tx.type === 'Receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
 }`}>
 {tx.type}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="font-medium">{tx.counterparty}</div>
 <div className="text-xs text-slate-500">{tx.reference}</div>
 </td>
 <td className="px-4 py-3 font-medium">{tx.foreignCurrency}</td>
 <td className="px-4 py-3 text-right">
 {tx.foreignCurrency === 'USD' && '$'}
 {tx.foreignCurrency === 'EUR' && '€'}
 {tx.foreignCurrency === 'GBP' && '£'}
 {tx.foreignAmount.toLocaleString()}
 </td>
 <td className="px-4 py-3 text-right">{tx.exchangeRate.toFixed(2)}</td>
 <td className="px-4 py-3 text-right font-medium">₹{tx.inrAmount.toLocaleString()}</td>
 <td className="px-4 py-3 text-center">
 <span className={`px-2 py-1 rounded text-xs ${
 tx.status === 'Completed' ? 'bg-green-100 text-green-700' :
 tx.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
 'bg-red-100 text-red-700'
 }`}>
 {tx.status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Exposure Tab */}
 {activeTab === 'exposure' && (
 <div className="flex-1 overflow-auto p-6">
 <div className="mb-6">
 <h4 className="text-lg font-semibold text-slate-800 mb-4">Currency Exposure Analysis</h4>
 <div className="grid grid-cols-3 gap-4 mb-6">
 <div className="bg-green-50 rounded-xl p-4 border border-green-200">
 <div className="text-sm text-green-600 font-medium">Total Receivables</div>
 <div className="text-2xl font-bold text-slate-800">₹{exposures.reduce((sum, e) => sum + (e.netExposure > 0 ? e.inrValue : 0), 0).toLocaleString()}</div>
 </div>
 <div className="bg-red-50 rounded-xl p-4 border border-red-200">
 <div className="text-sm text-red-600 font-medium">Total Payables</div>
 <div className="text-2xl font-bold text-slate-800">₹{Math.abs(exposures.reduce((sum, e) => sum + (e.netExposure < 0 ? e.inrValue : 0), 0)).toLocaleString()}</div>
 </div>
 <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
 <div className="text-sm text-accent font-medium">Net Exposure</div>
 <div className="text-2xl font-bold text-slate-800">₹{exposures.reduce((sum, e) => sum + e.inrValue, 0).toLocaleString()}</div>
 </div>
 </div>
 </div>

 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="px-4 py-3 text-left">Currency</th>
 <th className="px-4 py-3 text-right">Receivables</th>
 <th className="px-4 py-3 text-right">Payables</th>
 <th className="px-4 py-3 text-right">Net Exposure</th>
 <th className="px-4 py-3 text-right">INR Value</th>
 <th className="px-4 py-3 text-center">Risk Level</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {exposures.map(exp => (
 <tr key={exp.currency} className="hover:bg-slate-50">
 <td className="px-4 py-3 font-bold">{exp.currency}</td>
 <td className="px-4 py-3 text-right text-green-600">{exp.receivables.toLocaleString()}</td>
 <td className="px-4 py-3 text-right text-red-600">{exp.payables.toLocaleString()}</td>
 <td className="px-4 py-3 text-right font-medium">{exp.netExposure.toLocaleString()}</td>
 <td className="px-4 py-3 text-right font-bold">₹{exp.inrValue.toLocaleString()}</td>
 <td className="px-4 py-3 text-center">
 <span className={`px-2 py-1 rounded text-xs ${
 exp.riskLevel === 'High' ? 'bg-red-100 text-red-700' :
 exp.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
 'bg-green-100 text-green-700'
 }`}>
 {exp.riskLevel}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {/* Calculator Tab */}
 {activeTab === 'calculator' && (
 <div className="flex-1 overflow-auto p-6">
 <div className="max-w-md mx-auto">
 <h4 className="text-lg font-semibold text-slate-800 mb-6 text-center">Currency Converter</h4>
 
 <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
 <select
 value={selectedCurrency}
 onChange={(e) => setSelectedCurrency(e.target.value)}
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
 >
 {SUPPORTED_CURRENCIES.map(c => (
 <option key={c.code} value={c.code}>{c.flag} {c.code} - {c.name}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Conversion</label>
 <div className="flex gap-2">
 <button
 onClick={() => setConversionDirection('toINR')}
 className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
 conversionDirection === 'toINR' 
 ? 'bg-green-600 text-white' 
 : 'bg-slate-200 text-slate-700'
 }`}
 >
 {selectedCurrency} → INR
 </button>
 <button
 onClick={() => setConversionDirection('fromINR')}
 className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
 conversionDirection === 'fromINR' 
 ? 'bg-green-600 text-white' 
 : 'bg-slate-200 text-slate-700'
 }`}
 >
 INR → {selectedCurrency}
 </button>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
 <input
 type="number"
 value={amount}
 onChange={(e) => setAmount(e.target.value)}
 placeholder="Enter amount"
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
 />
 </div>

 <div className="pt-4 border-t border-slate-200">
 <div className="text-sm text-slate-500 mb-1">Converted Amount</div>
 <div className="text-3xl font-bold text-green-600">
 {conversionDirection === 'toINR' ? '₹' : selectedCurrencyData?.symbol}
 {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
 </div>
 <div className="text-sm text-slate-400 mt-1">
 Rate: 1 {conversionDirection === 'toINR' ? selectedCurrency : 'INR'} = 
 {' '}{conversionDirection === 'toINR' 
 ? `₹${selectedCurrencyData?.exchangeRate}` 
 : `${selectedCurrencyData?.symbol}${selectedCurrencyData?.inverseRate.toFixed(4)}`}
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default MultiCurrency;


