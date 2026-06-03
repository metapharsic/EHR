import React, { useState, useMemo } from 'react';
import { 
 Building2, Calculator, Calendar, Download, Plus, Edit3, Trash2,
 TrendingDown, FileSpreadsheet, AlertCircle, CheckCircle, Search,
 Filter, DollarSign, Clock, Package, Truck, Computer, Factory,
 ChevronDown, ChevronUp, PieChart, BarChart3
} from 'lucide-react';

interface FixedAsset {
 id: string;
 assetCode: string;
 assetName: string;
 category: 'Building' | 'Plant & Machinery' | 'Furniture & Fixtures' | 'Computers' | 'Vehicles' | 'Office Equipment';
 subCategory: string;
 acquisitionDate: string;
 acquisitionCost: number;
 installationCost: number;
 totalCost: number;
 salvageValue: number;
 usefulLifeYears: number;
 depreciationMethod: 'SLM' | 'WDV';
 depreciationRate: number;
 openingWDV: number;
 currentYearDepreciation: number;
 accumulatedDepreciation: number;
 closingWDV: number;
 location: string;
 custodian: string;
 status: 'Active' | 'Disposed' | 'Sold' | 'Under Maintenance';
 disposalDate?: string;
 disposalValue?: number;
 gstInputCredit: number;
 insuranceDetails?: string;
 maintenanceSchedule: string;
}

interface DepreciationEntry {
 id: string;
 assetId: string;
 financialYear: string;
 openingWDV: number;
 depreciationAmount: number;
 closingWDV: number;
 method: 'SLM' | 'WDV';
 rate: number;
}

const FixedAssetRegister: React.FC = () => {
 const [activeTab, setActiveTab] = useState<'assets' | 'depreciation' | 'schedule'>('assets');
 const [selectedCategory, setSelectedCategory] = useState<string>('All');
 const [searchTerm, setSearchTerm] = useState('');
 const [showAssetModal, setShowAssetModal] = useState(false);

 // Sample Assets Data
 const assets: FixedAsset[] = [
 {
 id: '1', assetCode: 'BLDG-001', assetName: 'Factory Building - Unit 1', category: 'Building', subCategory: 'Industrial',
 acquisitionDate: '2020-04-01', acquisitionCost: 50000000, installationCost: 500000, totalCost: 50500000,
 salvageValue: 2500000, usefulLifeYears: 30, depreciationMethod: 'SLM', depreciationRate: 3.33,
 openingWDV: 45450000, currentYearDepreciation: 1681650, accumulatedDepreciation: 6721650, closingWDV: 43778350,
 location: 'Plot 45, Industrial Area, Baddi', custodian: 'Plant Manager', status: 'Active', gstInputCredit: 4500000,
 maintenanceSchedule: 'Annual'
 },
 {
 id: '2', assetCode: 'PM-001', assetName: 'Tablet Compression Machine', category: 'Plant & Machinery', subCategory: 'Manufacturing',
 acquisitionDate: '2021-06-15', acquisitionCost: 8500000, installationCost: 850000, totalCost: 9350000,
 salvageValue: 935000, usefulLifeYears: 15, depreciationMethod: 'WDV', depreciationRate: 18.1,
 openingWDV: 6800000, currentYearDepreciation: 1230800, accumulatedDepreciation: 3780800, closingWDV: 5569200,
 location: 'Production Floor A', custodian: 'Production Head', status: 'Active', gstInputCredit: 1530000,
 maintenanceSchedule: 'Quarterly'
 },
 {
 id: '3', assetCode: 'PM-002', assetName: 'Blister Packaging Line', category: 'Plant & Machinery', subCategory: 'Packaging',
 acquisitionDate: '2022-03-10', acquisitionCost: 12000000, installationCost: 1200000, totalCost: 13200000,
 salvageValue: 1320000, usefulLifeYears: 15, depreciationMethod: 'WDV', depreciationRate: 18.1,
 openingWDV: 10560000, currentYearDepreciation: 1911360, accumulatedDepreciation: 4551360, closingWDV: 8648640,
 location: 'Packaging Unit', custodian: 'Packaging Supervisor', status: 'Active', gstInputCredit: 2376000,
 maintenanceSchedule: 'Monthly'
 },
 {
 id: '4', assetCode: 'VEH-001', assetName: 'Tata Ace - Delivery Van', category: 'Vehicles', subCategory: 'Transport',
 acquisitionDate: '2023-01-20', acquisitionCost: 750000, installationCost: 0, totalCost: 750000,
 salvageValue: 75000, usefulLifeYears: 8, depreciationMethod: 'WDV', depreciationRate: 25,
 openingWDV: 562500, currentYearDepreciation: 140625, accumulatedDepreciation: 328125, closingWDV: 421875,
 location: 'Transport Yard', custodian: 'Logistics Manager', status: 'Active', gstInputCredit: 135000,
 maintenanceSchedule: 'Bi-Monthly'
 },
 {
 id: '5', assetCode: 'COMP-001', assetName: 'Dell Servers - ERP System', category: 'Computers', subCategory: 'IT Infrastructure',
 acquisitionDate: '2022-07-01', acquisitionCost: 2500000, installationCost: 250000, totalCost: 2750000,
 salvageValue: 275000, usefulLifeYears: 3, depreciationMethod: 'WDV', depreciationRate: 63.16,
 openingWDV: 1012125, currentYearDepreciation: 639257, accumulatedDepreciation: 2377925, closingWDV: 372075,
 location: 'Server Room', custodian: 'IT Manager', status: 'Active', gstInputCredit: 495000,
 maintenanceSchedule: 'Monthly'
 },
 {
 id: '6', assetCode: 'FURN-001', assetName: 'Office Furniture - HQ', category: 'Furniture & Fixtures', subCategory: 'Office',
 acquisitionDate: '2021-09-15', acquisitionCost: 850000, installationCost: 50000, totalCost: 900000,
 salvageValue: 90000, usefulLifeYears: 10, depreciationMethod: 'SLM', depreciationRate: 10,
 openingWDV: 720000, currentYearDepreciation: 90000, accumulatedDepreciation: 270000, closingWDV: 630000,
 location: 'Corporate Office', custodian: 'Admin Manager', status: 'Active', gstInputCredit: 162000,
 maintenanceSchedule: 'Annual'
 },
 ];

 const filteredAssets = useMemo(() => {
 return assets.filter(asset => {
 const matchesCategory = selectedCategory === 'All' || asset.category === selectedCategory;
 const matchesSearch = asset.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
 asset.assetCode.toLowerCase().includes(searchTerm.toLowerCase());
 return matchesCategory && matchesSearch;
 });
 }, [assets, selectedCategory, searchTerm]);

 const summaryStats = useMemo(() => {
 const totalGrossBlock = assets.reduce((sum, a) => sum + a.totalCost, 0);
 const totalAccumulatedDep = assets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0);
 const totalNetBlock = assets.reduce((sum, a) => sum + a.closingWDV, 0);
 const currentYearDep = assets.reduce((sum, a) => sum + a.currentYearDepreciation, 0);
 
 const byCategory: Record<string, { count: number; value: number }> = {};
 assets.forEach(asset => {
 if (!byCategory[asset.category]) {
 byCategory[asset.category] = { count: 0, value: 0 };
 }
 byCategory[asset.category].count++;
 byCategory[asset.category].value += asset.closingWDV;
 });

 return { totalGrossBlock, totalAccumulatedDep, totalNetBlock, currentYearDep, byCategory };
 }, [assets]);

 const formatCurrency = (amount: number) => {
 return new Intl.NumberFormat('en-IN', {
 style: 'currency',
 currency: 'INR',
 maximumFractionDigits: 0
 }).format(amount);
 };

 const getCategoryIcon = (category: string) => {
 switch (category) {
 case 'Building': return Building2;
 case 'Plant & Machinery': return Factory;
 case 'Vehicles': return Truck;
 case 'Computers': return Computer;
 default: return Package;
 }
 };

 return (
 <div className="h-full flex flex-col bg-slate-50">
 {/* Header */}
 <div className="bg-white border-b border-slate-200 px-6 py-4">
 <div className="flex justify-between items-center">
 <div>
 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
 <Building2 className="text-amber-600" size={24} />
 Fixed Asset Register
 </h3>
 <p className="text-slate-500 text-sm mt-1">Asset tracking, depreciation calculation, and compliance reporting</p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {}}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
 >
 <FileSpreadsheet size={18} />
 Export Schedule
 </button>
 <button
 onClick={() => setShowAssetModal(true)}
 className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2"
 >
 <Plus size={18} />
 Add Asset
 </button>
 </div>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-4 gap-4 mt-4">
 <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
 <div className="flex items-center justify-between">
 <span className="text-amber-700 text-sm font-medium">Gross Block</span>
 <Building2 size={18} className="text-amber-600" />
 </div>
 <div className="text-2xl font-bold text-amber-800 mt-1">
 {formatCurrency(summaryStats.totalGrossBlock)}
 </div>
 <div className="text-xs text-amber-600 mt-1">{assets.length} assets</div>
 </div>

 <div className="bg-red-50 p-4 rounded-lg border border-red-200">
 <div className="flex items-center justify-between">
 <span className="text-red-700 text-sm font-medium">Accumulated Depreciation</span>
 <TrendingDown size={18} className="text-red-600" />
 </div>
 <div className="text-2xl font-bold text-red-800 mt-1">
 {formatCurrency(summaryStats.totalAccumulatedDep)}
 </div>
 <div className="text-xs text-red-600 mt-1">Since acquisition</div>
 </div>

 <div className="bg-emerald-50 p-4 rounded-lg border border-green-200">
 <div className="flex items-center justify-between">
 <span className="text-green-700 text-sm font-medium">Net Block (WDV)</span>
 <DollarSign size={18} className="text-green-600" />
 </div>
 <div className="text-2xl font-bold text-green-800 mt-1">
 {formatCurrency(summaryStats.totalNetBlock)}
 </div>
 <div className="text-xs text-green-600 mt-1">Current book value</div>
 </div>

 <div className="bg-slate-50 p-4 rounded-lg border border-blue-200">
 <div className="flex items-center justify-between">
 <span className="text-accent text-sm font-medium">Current Year Dep.</span>
 <Calculator size={18} className="text-accent" />
 </div>
 <div className="text-2xl font-bold text-blue-800 mt-1">
 {formatCurrency(summaryStats.currentYearDep)}
 </div>
 <div className="text-xs text-accent mt-1">FY 2025-26</div>
 </div>
 </div>
 </div>

 {/* Tabs */}
 <div className="px-6 py-3 bg-white border-b border-slate-200">
 <div className="flex justify-between items-center">
 <div className="flex gap-4">
 {[
 { id: 'assets', label: 'Asset Register', icon: Building2 },
 { id: 'depreciation', label: 'Depreciation Schedule', icon: Calculator },
 { id: 'schedule', label: 'Category Summary', icon: PieChart },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeTab === tab.id 
 ? 'bg-amber-600 text-white' 
 : 'text-slate-600 hover:bg-slate-100'
 }`}
 >
 <tab.icon size={16} />
 {tab.label}
 </button>
 ))}
 </div>
 <div className="flex gap-2">
 <input
 type="text"
 placeholder="Search assets..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-64"
 />
 <select
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value)}
 className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
 >
 <option value="All">All Categories</option>
 <option value="Building">Building</option>
 <option value="Plant & Machinery">Plant & Machinery</option>
 <option value="Furniture & Fixtures">Furniture & Fixtures</option>
 <option value="Computers">Computers</option>
 <option value="Vehicles">Vehicles</option>
 <option value="Office Equipment">Office Equipment</option>
 </select>
 </div>
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 p-6 overflow-auto">
 {activeTab === 'assets' && (
 <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
 <table className="w-full">
 <thead className="bg-slate-50">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Asset Code</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Asset Name</th>
 <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Gross Block</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Acc. Dep.</th>
 <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Net Block</th>
 <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Method</th>
 <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Status</th>
 <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {filteredAssets.map((asset) => {
 const Icon = getCategoryIcon(asset.category);
 return (
 <tr key={asset.id} className="hover:bg-slate-50">
 <td className="px-4 py-3 font-medium text-slate-800">{asset.assetCode}</td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <Icon size={16} className="text-slate-400" />
 <div>
 <div className="font-medium text-slate-800">{asset.assetName}</div>
 <div className="text-xs text-slate-500">{asset.location}</div>
 </div>
 </div>
 </td>
 <td className="px-4 py-3">
 <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
 {asset.category}
 </span>
 </td>
 <td className="px-4 py-3 text-right font-medium">{formatCurrency(asset.totalCost)}</td>
 <td className="px-4 py-3 text-right text-red-600">{formatCurrency(asset.accumulatedDepreciation)}</td>
 <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(asset.closingWDV)}</td>
 <td className="px-4 py-3 text-center">
 <span className={`px-2 py-1 rounded text-xs ${
 asset.depreciationMethod === 'SLM' ? 'bg-blue-100 text-accent' : 'bg-purple-100 text-purple-700'
 }`}>
 {asset.depreciationMethod} ({asset.depreciationRate}%)
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <span className={`px-2 py-1 rounded-full text-xs ${
 asset.status === 'Active' ? 'bg-green-100 text-green-700' :
 asset.status === 'Disposed' ? 'bg-red-100 text-red-700' :
 'bg-yellow-100 text-yellow-700'
 }`}>
 {asset.status}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <button className="text-accent hover:text-blue-800 mr-2"><Edit3 size={16} /></button>
 <button className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}

 {activeTab === 'depreciation' && (
 <div className="space-y-4">
 <div className="bg-white rounded-lg border border-slate-200 p-4">
 <h4 className="font-semibold text-slate-800 mb-4">Depreciation Schedule - FY 2025-26</h4>
 <table className="w-full">
 <thead className="bg-slate-50">
 <tr>
 <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Asset</th>
 <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Opening WDV</th>
 <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Rate</th>
 <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Depreciation</th>
 <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Closing WDV</th>
 <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Days</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {filteredAssets.map((asset) => (
 <tr key={asset.id}>
 <td className="px-4 py-2">
 <div className="font-medium text-slate-800">{asset.assetName}</div>
 <div className="text-xs text-slate-500">{asset.assetCode}</div>
 </td>
 <td className="px-4 py-2 text-right">{formatCurrency(asset.openingWDV)}</td>
 <td className="px-4 py-2 text-right">{asset.depreciationRate}%</td>
 <td className="px-4 py-2 text-right font-medium text-red-600">{formatCurrency(asset.currentYearDepreciation)}</td>
 <td className="px-4 py-2 text-right font-bold">{formatCurrency(asset.closingWDV)}</td>
 <td className="px-4 py-2 text-center text-slate-500">365</td>
 </tr>
 ))}
 </tbody>
 <tfoot className="bg-slate-50 font-semibold">
 <tr>
 <td className="px-4 py-3">Total</td>
 <td className="px-4 py-3 text-right">{formatCurrency(assets.reduce((s, a) => s + a.openingWDV, 0))}</td>
 <td className="px-4 py-3"></td>
 <td className="px-4 py-3 text-right text-red-700">{formatCurrency(assets.reduce((s, a) => s + a.currentYearDepreciation, 0))}</td>
 <td className="px-4 py-3 text-right">{formatCurrency(assets.reduce((s, a) => s + a.closingWDV, 0))}</td>
 <td className="px-4 py-3"></td>
 </tr>
 </tfoot>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'schedule' && (
 <div className="grid grid-cols-2 gap-6">
 <div className="bg-white rounded-lg border border-slate-200 p-4">
 <h4 className="font-semibold text-slate-800 mb-4">Asset Value by Category</h4>
 <div className="space-y-3">
 {(Object.entries(summaryStats.byCategory) as [string, { count: number; value: number }][]).map(([category, data]) => (
 <div key={category} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
 <div className="flex items-center gap-3">
 {React.createElement(getCategoryIcon(category) as any, { size: 20, className: 'text-slate-400' })}
 <div>
 <div className="font-medium text-slate-800">{category}</div>
 <div className="text-xs text-slate-500">{data.count} assets</div>
 </div>
 </div>
 <div className="text-right">
 <div className="font-bold text-slate-800">{formatCurrency(data.value)}</div>
 <div className="text-xs text-slate-500">
 {((data.value / summaryStats.totalNetBlock) * 100).toFixed(1)}% of total
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-white rounded-lg border border-slate-200 p-4">
 <h4 className="font-semibold text-slate-800 mb-4">Compliance Notes</h4>
 <div className="space-y-3 text-sm">
 <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
 <div className="flex items-center gap-2 text-green-800 font-medium mb-1">
 <CheckCircle size={16} />
 Companies Act Compliance
 </div>
 <p className="text-green-700">Depreciation calculated as per Schedule II of Companies Act, 2013</p>
 </div>
 <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
 <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
 <Calendar size={16} />
 Financial Year
 </div>
 <p className="text-accent">All assets depreciated for full year FY 2025-26 (365 days)</p>
 </div>
 <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
 <div className="flex items-center gap-2 text-amber-800 font-medium mb-1">
 <AlertCircle size={16} />
 GST Input Credit
 </div>
 <p className="text-amber-700">ITC of {formatCurrency(assets.reduce((s, a) => s + a.gstInputCredit, 0))} claimed on asset purchases</p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default FixedAssetRegister;


