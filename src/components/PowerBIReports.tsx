import React, { useState, useEffect } from 'react';
import { BarChart3, Download, ExternalLink, Settings, CheckCircle, AlertTriangle, RefreshCw, FileSpreadsheet, Database, Eye, TrendingUp, Brain, Lightbulb } from 'lucide-react';
import { 
 getPowerBIConfig, 
 savePowerBIConfig, 
 testPowerBIConnection, 
 getReportTemplates,
 getDatasetSchema,
 PowerBIReportType,
 getForecastingTemplates,
 generateTimeSeriesForecast,
 generateInventoryForecast,
 generateFinancialForecast,
 generatePredictiveInsights,
 exportForecastToPowerBI,
 ForecastResult
} from '../services/powerBIService';
import { exportToPowerBIExcel } from '../services/powerBIService';
import { useCompany } from '../context/CompanyContext';

interface PowerBIReportsProps {
 data?: any[];
 reportType?: PowerBIReportType;
}

const PowerBIReports: React.FC<PowerBIReportsProps> = ({ data = [], reportType = 'overall' }) => {
 const { company } = useCompany();
 const [config, setConfig] = useState(getPowerBIConfig());
 const [showSettings, setShowSettings] = useState(false);
 const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
 const [isTesting, setIsTesting] = useState(false);
 const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
 const [exporting, setExporting] = useState(false);
 const [activeTab, setActiveTab] = useState<'reports' | 'forecasting' | 'insights'>('reports');
 const [forecastData, setForecastData] = useState<ForecastResult[] | null>(null);
 const [insights, setInsights] = useState<any[]>([]);
 const [generatingForecast, setGeneratingForecast] = useState(false);

 const templates = getReportTemplates();
 const forecastingTemplates = getForecastingTemplates();

 const handleSaveConfig = () => {
 savePowerBIConfig(config);
 alert('Power BI configuration saved!');
 };

 const handleTest = async () => {
 setIsTesting(true);
 setTestStatus(null);
 const result = await testPowerBIConnection();
 setTestStatus(result);
 setIsTesting(false);
 };

 const handleExportToExcel = (type: PowerBIReportType) => {
 setExporting(true);
 const schema = getDatasetSchema(type);
 
 // Generate sample data if no data provided
 const exportData = data.length > 0 ? data : generateSampleData(type);
 
 exportToPowerBIExcel(
 exportData,
 `Metapharsic_${type}_Report`,
 schema.tables[0].name,
 company
 );
 
 setTimeout(() => setExporting(false), 1000);
 };

 const generateSampleData = (type: PowerBIReportType): any[] => {
 switch (type) {
 case 'sales':
 return [
 { InvoiceID: 'INV001', Date: new Date(), CustomerName: 'ABC Pharmacy', ProductName: 'Paracetamol 500mg', Quantity: 100, UnitPrice: 25, TotalAmount: 2500, GSTAmount: 300, NetAmount: 2800, PaymentMode: 'Cash', SalesRep: 'Rajesh Kumar', Territory: 'Pune Central', ProductCategory: 'Analgesics', Month: 'Nov', Quarter: 'Q4', Year: 2024 },
 { InvoiceID: 'INV002', Date: new Date(), CustomerName: 'XYZ Medical', ProductName: 'Amoxicillin 250mg', Quantity: 50, UnitPrice: 45, TotalAmount: 2250, GSTAmount: 270, NetAmount: 2520, PaymentMode: 'Credit', SalesRep: 'Priya Sharma', Territory: 'Mumbai West', ProductCategory: 'Antibiotics', Month: 'Nov', Quarter: 'Q4', Year: 2024 }
 ];
 case 'inventory':
 return [
 { ProductID: 'P001', ProductName: 'Paracetamol 500mg', GenericName: 'Paracetamol', Manufacturer: 'Glenmark', Category: 'Analgesics', CurrentStock: 250, MinStockLevel: 50, ReorderLevel: 100, StockValue: 6250, ExpiryDate: '2025-06-30', DaysToExpiry: 220, BatchNumber: 'BT001', RackLocation: 'A1', StockStatus: 'Normal', LastPurchaseDate: '2024-10-15', LastSaleDate: '2024-11-15' },
 { ProductID: 'P002', ProductName: 'Amoxicillin 250mg', GenericName: 'Amoxicillin', Manufacturer: 'Cipla', Category: 'Antibiotics', CurrentStock: 30, MinStockLevel: 50, ReorderLevel: 100, StockValue: 1350, ExpiryDate: '2025-03-31', DaysToExpiry: 130, BatchNumber: 'BT002', RackLocation: 'B2', StockStatus: 'Low', LastPurchaseDate: '2024-09-20', LastSaleDate: '2024-11-14' }
 ];
 case 'employee':
 return [
 { EmployeeID: 'MR001', Name: 'Rajesh Kumar', Designation: 'Medical Representative', Department: 'Sales', Territory: 'Pune Central', JoinDate: '2022-03-15', Status: 'Active', BaseSalary: 35000, Incentives: 15000, TotalCompensation: 50000 },
 { EmployeeID: 'MR002', Name: 'Priya Sharma', Designation: 'Area Manager', Department: 'Sales', Territory: 'Mumbai West', JoinDate: '2021-06-20', Status: 'Active', BaseSalary: 40000, Incentives: 12000, TotalCompensation: 52000 }
 ];
 default:
 return [{ Metric: 'Sample', Value: 100, Target: 120, Variance: -20, Period: 'Nov 2024', Date: new Date() }];
 }
 };

 // Generate sample forecast
 const handleGenerateForecast = (templateId: string) => {
 setGeneratingForecast(true);
 
 // Sample historical data
 const historicalData = [
 { period: '2024-06', value: 450000 },
 { period: '2024-07', value: 480000 },
 { period: '2024-08', value: 520000 },
 { period: '2024-09', value: 490000 },
 { period: '2024-10', value: 550000 },
 { period: '2024-11', value: 580000 }
 ];
 
 try {
 const forecast = generateTimeSeriesForecast(historicalData, 6);
 setForecastData(forecast);
 } catch (error) {
 console.error('Forecast error:', error);
 }
 
 setGeneratingForecast(false);
 };

 // Generate predictive insights
 const handleGenerateInsights = () => {
 const sampleData = {
 sales: [
 { period: '2024-06', value: 450000 },
 { period: '2024-07', value: 480000 },
 { period: '2024-08', value: 520000 },
 { period: '2024-09', value: 490000 },
 { period: '2024-10', value: 550000 },
 { period: '2024-11', value: 580000 }
 ],
 inventory: [
 { product: 'P001', stock: 250, sales: 100 },
 { product: 'P002', stock: 30, sales: 80 },
 { product: 'P003', stock: 500, sales: 0 }
 ],
 employees: [
 { id: 'MR001', sales: 580000, target: 500000 },
 { id: 'MR002', sales: 320000, target: 600000 }
 ]
 };
 
 const generatedInsights = generatePredictiveInsights(sampleData);
 setInsights(generatedInsights);
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
 <BarChart3 className="text-primary" />
 Power BI Reports
 </h2>
 <p className="text-slate-500 text-sm mt-1">
 Generate Power BI-ready reports and connect to Microsoft Power BI for advanced analytics
 </p>
 </div>
 <button
 onClick={() => setShowSettings(!showSettings)}
 className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
 >
 <Settings size={18} />
 Configure
 </button>
 </div>

 {/* Configuration Panel */}
 {showSettings && (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
 <h3 className="font-bold text-slate-800 mb-4">Power BI Configuration</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Workspace ID</label>
 <input
 type="text"
 value={config.workspaceId}
 onChange={(e) => setConfig({ ...config, workspaceId: e.target.value })}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 placeholder="Enter Power BI Workspace ID"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Dataset ID</label>
 <input
 type="text"
 value={config.datasetId}
 onChange={(e) => setConfig({ ...config, datasetId: e.target.value })}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 placeholder="Enter Dataset ID"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Report ID</label>
 <input
 type="text"
 value={config.reportId}
 onChange={(e) => setConfig({ ...config, reportId: e.target.value })}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 placeholder="Enter Report ID"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-600 mb-1">Embed Token</label>
 <input
 type="password"
 value={config.embedToken}
 onChange={(e) => setConfig({ ...config, embedToken: e.target.value })}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
 placeholder="Enter Embed Token"
 />
 </div>
 </div>
 
 <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-slate-700">Enable Power BI</span>
 <button
 onClick={() => setConfig({ ...config, enabled: !config.enabled })}
 className={`relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full ${
 config.enabled ? 'bg-primary' : 'bg-slate-300'
 }`}
 >
 <span className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
 config.enabled ? 'translate-x-6' : 'translate-x-0'
 }`} />
 </button>
 </div>
 <div className="flex gap-2">
 {testStatus && (
 <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${
 testStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
 }`}>
 {testStatus.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
 {testStatus.message}
 </div>
 )}
 <button
 onClick={handleTest}
 disabled={isTesting}
 className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
 >
 {isTesting ? <RefreshCw size={16} className="animate-spin" /> : <ExternalLink size={16} />}
 Test Connection
 </button>
 <button
 onClick={handleSaveConfig}
 className="px-4 py-2 bg-primary hover:bg-sky-600 text-white rounded-lg text-sm font-medium"
 >
 Save
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Navigation Tabs */}
 <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 inline-flex">
 <button
 onClick={() => setActiveTab('reports')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
 activeTab === 'reports' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
 }`}
 >
 <BarChart3 size={16} />
 Reports
 </button>
 <button
 onClick={() => setActiveTab('forecasting')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
 activeTab === 'forecasting' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
 }`}
 >
 <TrendingUp size={16} />
 Forecasting
 </button>
 <button
 onClick={() => setActiveTab('insights')}
 className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
 activeTab === 'insights' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
 }`}
 >
 <Brain size={16} />
 AI Insights
 </button>
 </div>

 {/* Reports Tab */}
 {activeTab === 'reports' && (
 <>
 {/* Report Templates Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {templates.map((template) => (
 <div
 key={template.id}
 className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-none ${
 selectedTemplate === template.id ? 'border-primary bg-blue-50' : 'border-slate-200'
 }`}
 onClick={() => setSelectedTemplate(template.id)}
 >
 <div className="text-3xl mb-2">{template.icon}</div>
 <h4 className="font-bold text-slate-800 text-sm">{template.name}</h4>
 <p className="text-xs text-slate-500 mt-1">{template.description}</p>
 <div className="flex gap-2 mt-3">
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleExportToExcel(template.type);
 }}
 disabled={exporting}
 className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
 >
 <FileSpreadsheet size={12} />
 Excel
 </button>
 {config.enabled && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 window.open(`https://app.powerbi.com/groups/${config.workspaceId}/reports/${config.reportId}`, '_blank');
 }}
 className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-primary hover:bg-sky-600 text-white rounded text-xs font-medium transition-colors"
 >
 <Eye size={12} />
 View
 </button>
 )}
 </div>
 </div>
 ))}
 </div>

 {/* Instructions */}
 <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
 <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
 <Database size={18} />
 How to Use Power BI Integration
 </h4>
 <ol className="text-sm text-accent space-y-2 list-decimal list-inside">
 <li>Configure your Power BI Workspace ID, Dataset ID, and Embed Token above</li>
 <li>Click "Test Connection" to verify your credentials</li>
 <li>Select a report template and click "Excel" to download Power BI-ready data</li>
 <li>Import the Excel file into Power BI Desktop or upload to Power BI Service</li>
 <li>Use "View" button to open reports directly in Power BI (when configured)</li>
 </ol>
 <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
 <p className="text-xs text-slate-600">
 <strong>Note:</strong> For automated data refresh, configure Power BI Gateway and schedule refreshes in Power BI Service.
 All exported Excel files include metadata for seamless Power BI integration.
 </p>
 </div>
 </div>
 </>
 )}

 {/* Forecasting Tab */}
 {activeTab === 'forecasting' && (
 <div className="space-y-6">
 <div className="bg-slate-50 rounded-xl p-6 border border-blue-100">
 <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
 <TrendingUp className="text-accent" />
 ERP Forecasting & Predictive Analytics
 </h3>
 <p className="text-sm text-slate-600">
 Generate forecasts for sales, inventory, and financials using advanced time series analysis and machine learning models.
 </p>
 </div>

 {/* Forecasting Templates */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {forecastingTemplates.map((template) => (
 <div
 key={template.id}
 className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-none transition-all"
 >
 <div className="text-3xl mb-2">{template.icon}</div>
 <h4 className="font-bold text-slate-800 text-sm">{template.name}</h4>
 <p className="text-xs text-slate-500 mt-1">{template.description}</p>
 <div className="flex flex-wrap gap-1 mt-2">
 {template.models.map((model) => (
 <span key={model} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
 {model}
 </span>
 ))}
 </div>
 <button
 onClick={() => handleGenerateForecast(template.id)}
 disabled={generatingForecast}
 className="w-full mt-3 px-3 py-2 bg-accent hover:bg-accent text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {generatingForecast ? (
 <>
 <RefreshCw size={12} className="animate-spin" />
 Generating...
 </>
 ) : (
 <>
 <TrendingUp size={12} />
 Generate Forecast
 </>
 )}
 </button>
 </div>
 ))}
 </div>

 {/* Forecast Results */}
 {forecastData && (
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
 <h4 className="font-bold text-slate-800">6-Month Sales Forecast</h4>
 <button
 onClick={() => exportForecastToPowerBI(forecastData, 'Sales_Forecast', undefined, company)}
 className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
 >
 <Download size={14} />
 Export to Excel
 </button>
 </div>
 <div className="p-4">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-slate-50 text-slate-600">
 <tr>
 <th className="p-2 text-left">Period</th>
 <th className="p-2 text-right">Forecast</th>
 <th className="p-2 text-right">Lower Bound</th>
 <th className="p-2 text-right">Upper Bound</th>
 <th className="p-2 text-center">Trend</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {forecastData.map((row, idx) => (
 <tr key={idx}>
 <td className="p-2 font-medium">{row.period}</td>
 <td className="p-2 text-right font-bold text-accent">₹{row.forecast.toLocaleString()}</td>
 <td className="p-2 text-right text-slate-500">₹{row.lowerBound.toLocaleString()}</td>
 <td className="p-2 text-right text-slate-500">₹{row.upperBound.toLocaleString()}</td>
 <td className="p-2 text-center">
 <span className={`px-2 py-0.5 rounded-full text-xs ${
 row.trend === 'up' ? 'bg-green-100 text-green-700' :
 row.trend === 'down' ? 'bg-red-100 text-red-700' :
 'bg-slate-100 text-slate-700'
 }`}>
 {row.trend === 'up' ? '↗️ Up' : row.trend === 'down' ? '↘️ Down' : '➡️ Stable'}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* AI Insights Tab */}
 {activeTab === 'insights' && (
 <div className="space-y-6">
 <div className="bg-slate-50 rounded-xl p-6 border border-purple-100">
 <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
 <Brain className="text-purple-600" />
 AI-Powered Predictive Insights
 </h3>
 <p className="text-sm text-slate-600">
 Machine learning-powered analysis of your ERP data to identify trends, anomalies, and actionable recommendations.
 </p>
 </div>

 <button
 onClick={handleGenerateInsights}
 className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
 >
 <Lightbulb size={20} />
 Generate Insights
 </button>

 {insights.length > 0 && (
 <div className="grid gap-4">
 {insights.map((insight, idx) => (
 <div
 key={idx}
 className={`p-4 rounded-xl border-l-4 ${
 insight.severity === 'critical' ? 'bg-red-50 border-red-500' :
 insight.severity === 'warning' ? 'bg-orange-50 border-orange-500' :
 'bg-blue-50 border-accent'
 }`}
 >
 <div className="flex items-start gap-3">
 <div className={`p-2 rounded-lg ${
 insight.severity === 'critical' ? 'bg-red-100 text-red-600' :
 insight.severity === 'warning' ? 'bg-orange-100 text-orange-600' :
 'bg-blue-100 text-accent'
 }`}>
 {insight.severity === 'critical' ? <AlertTriangle size={20} /> :
 insight.severity === 'warning' ? <TrendingUp size={20} /> :
 <CheckCircle size={20} />}
 </div>
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 <span className="text-xs font-bold text-slate-500 uppercase">{insight.category}</span>
 <span className={`text-xs px-2 py-0.5 rounded-full ${
 insight.severity === 'critical' ? 'bg-red-200 text-red-800' :
 insight.severity === 'warning' ? 'bg-orange-200 text-orange-800' :
 'bg-blue-200 text-blue-800'
 }`}>
 {insight.severity}
 </span>
 </div>
 <h4 className="font-bold text-slate-800">{insight.title}</h4>
 <p className="text-sm text-slate-600 mt-1">{insight.description}</p>
 <div className="mt-3 p-3 bg-white rounded-lg">
 <p className="text-xs font-medium text-slate-700">💡 Recommendation:</p>
 <p className="text-sm text-slate-600">{insight.recommendation}</p>
 </div>
 <p className="text-xs text-slate-500 mt-2">Impact: {insight.impact}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 );
};

export default PowerBIReports;


