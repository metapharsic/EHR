import React, { useState, useMemo } from 'react';
import { 
 FileSpreadsheet, Download, Settings, Filter, Calendar,
 BarChart3, PieChart, TrendingUp, DollarSign, Users,
 Building2, Receipt, Activity, Wallet, Percent,
 ChevronDown, ChevronUp, Plus, X, Check, RefreshCw,
 Eye, FileBarChart, Table, LayoutGrid, Save,
 Trash2, Edit3, Copy, CheckCircle2, AlertCircle,
 LineChart, TrendingDown, Target, Zap, Brain,
 ArrowUpRight, ArrowDownRight, Clock, Gauge,
 Lightbulb, Sparkles, BarChart4, AreaChart,
 Search, MessageSquare, Send, Bot
} from 'lucide-react';
import { 
 ChartOfAccount, JournalVoucher, GeneralLedgerEntry, 
 TrialBalanceEntry, BalanceSheetReport, ProfitLossReport,
 CostCenter, BankReconciliation, SalesInvoice, Party
} from '../types';

interface PowerBIExcelReportsProps {
 chartOfAccounts: ChartOfAccount[];
 journalVouchers: JournalVoucher[];
 generalLedger: GeneralLedgerEntry[];
 trialBalance: TrialBalanceEntry[];
 balanceSheet: BalanceSheetReport | null;
 profitLoss: ProfitLossReport | null;
 costCenters: CostCenter[];
 bankReconciliations: BankReconciliation[];
 auditTrail: GeneralLedgerEntry[];
 invoices: SalesInvoice[];
 parties: Party[];
}

interface ReportField {
 id: string;
 name: string;
 category: 'account' | 'transaction' | 'party' | 'financial' | 'custom';
 dataType: 'text' | 'number' | 'currency' | 'date' | 'percentage';
 formula?: string;
}

interface ReportTemplate {
 id: string;
 name: string;
 description: string;
 fields: string[];
 filters: ReportFilter[];
 groupBy?: string;
 sortBy?: string;
 sortOrder: 'asc' | 'desc';
}

interface ReportFilter {
 field: string;
 operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between' | 'in';
 value: any;
 value2?: any;
}

interface GeneratedReport {
 id: string;
 name: string;
 templateId: string;
 generatedAt: string;
 rowCount: number;
 data: any[];
 summary: ReportSummary;
}

interface ReportSummary {
 totalAmount: number;
 recordCount: number;
 dateRange: { start: string; end: string };
 filtersApplied: number;
}

// Forecasting Interfaces
interface ForecastData {
 period: string;
 actual: number;
 forecast: number;
 confidence: number;
 trend: 'up' | 'down' | 'stable';
}

interface TrendAnalysis {
 metric: string;
 currentValue: number;
 previousValue: number;
 changePercent: number;
 trend: 'up' | 'down' | 'stable';
 forecastNextMonth: number;
 forecastNextQuarter: number;
 forecastNextYear: number;
}

interface FinancialProjection {
 scenario: 'optimistic' | 'realistic' | 'pessimistic';
 revenue: number;
 expenses: number;
 netProfit: number;
 cashFlow: number;
 assumptions: string[];
}

interface AnomalyDetection {
 type: 'spike' | 'drop' | 'unusual_pattern';
 severity: 'low' | 'medium' | 'high';
 description: string;
 value: number;
 expectedValue: number;
 date: string;
}

interface KPIInsight {
 metric: string;
 value: number;
 benchmark: number;
 status: 'excellent' | 'good' | 'warning' | 'critical';
 recommendation: string;
}

// AI Search Interface
interface AIQueryResult {
 type: 'kpi' | 'trend' | 'forecast' | 'anomaly' | 'projection' | 'comparison' | 'summary';
 title: string;
 content: string;
 data?: any;
 confidence: number;
 relatedMetrics: string[];
}

const AVAILABLE_FIELDS: ReportField[] = [
 // Account Fields
 { id: 'accountCode', name: 'Account Code', category: 'account', dataType: 'text' },
 { id: 'accountName', name: 'Account Name', category: 'account', dataType: 'text' },
 { id: 'accountType', name: 'Account Type', category: 'account', dataType: 'text' },
 { id: 'openingBalance', name: 'Opening Balance', category: 'account', dataType: 'currency' },
 { id: 'currentBalance', name: 'Current Balance', category: 'account', dataType: 'currency' },
 { id: 'accountStatus', name: 'Account Status', category: 'account', dataType: 'text' },
 
 // Transaction Fields
 { id: 'voucherNo', name: 'Voucher Number', category: 'transaction', dataType: 'text' },
 { id: 'voucherType', name: 'Voucher Type', category: 'transaction', dataType: 'text' },
 { id: 'transactionDate', name: 'Transaction Date', category: 'transaction', dataType: 'date' },
 { id: 'debitAmount', name: 'Debit Amount', category: 'transaction', dataType: 'currency' },
 { id: 'creditAmount', name: 'Credit Amount', category: 'transaction', dataType: 'currency' },
 { id: 'narration', name: 'Narration', category: 'transaction', dataType: 'text' },
 { id: 'costCenter', name: 'Cost Center', category: 'transaction', dataType: 'text' },
 { id: 'createdBy', name: 'Created By', category: 'transaction', dataType: 'text' },
 
 // Party Fields
 { id: 'partyName', name: 'Party Name', category: 'party', dataType: 'text' },
 { id: 'partyType', name: 'Party Type', category: 'party', dataType: 'text' },
 { id: 'partyCity', name: 'City', category: 'party', dataType: 'text' },
 { id: 'partyBalance', name: 'Balance', category: 'party', dataType: 'currency' },
 { id: 'partyGST', name: 'GST Number', category: 'party', dataType: 'text' },
 { id: 'creditLimit', name: 'Credit Limit', category: 'party', dataType: 'currency' },
 
 // Financial Fields
 { id: 'totalAssets', name: 'Total Assets', category: 'financial', dataType: 'currency' },
 { id: 'totalLiabilities', name: 'Total Liabilities', category: 'financial', dataType: 'currency' },
 { id: 'totalEquity', name: 'Total Equity', category: 'financial', dataType: 'currency' },
 { id: 'netProfit', name: 'Net Profit/Loss', category: 'financial', dataType: 'currency' },
 { id: 'currentRatio', name: 'Current Ratio', category: 'financial', dataType: 'number' },
 { id: 'debtToEquity', name: 'Debt-to-Equity', category: 'financial', dataType: 'number' },
 
 // Custom Calculated Fields
 { id: 'netAmount', name: 'Net Amount (Dr-Cr)', category: 'custom', dataType: 'currency', formula: 'debit-credit' },
 { id: 'balanceChange', name: 'Balance Change %', category: 'custom', dataType: 'percentage', formula: 'change%' },
 { id: 'agingDays', name: 'Aging Days', category: 'custom', dataType: 'number', formula: 'days' },
];

const DEFAULT_TEMPLATES: ReportTemplate[] = [
 {
 id: 'financial-forecast',
 name: 'Financial Forecast & Projections',
 description: 'AI-powered financial forecasting with trend analysis',
 fields: ['accountName', 'currentBalance', 'netAmount', 'balanceChange', 'transactionDate'],
 filters: [],
 sortBy: 'currentBalance',
 sortOrder: 'desc'
 },
 {
 id: 'trend-analysis',
 name: 'Trend Analysis & KPI Dashboard',
 description: 'Comprehensive trend analysis with key performance indicators',
 fields: ['accountType', 'debitAmount', 'creditAmount', 'transactionDate', 'costCenter'],
 filters: [],
 groupBy: 'accountType',
 sortBy: 'transactionDate',
 sortOrder: 'desc'
 },
 {
 id: 'cash-flow-forecast',
 name: 'Cash Flow Forecasting',
 description: 'Predictive cash flow analysis with 12-month projections',
 fields: ['transactionDate', 'voucherType', 'debitAmount', 'creditAmount', 'netAmount'],
 filters: [{ field: 'accountType', operator: 'equals', value: 'Asset' }],
 sortBy: 'transactionDate',
 sortOrder: 'desc'
 },
 {
 id: 'revenue-forecasting',
 name: 'Revenue Forecasting & Analysis',
 description: 'Revenue trends with seasonal patterns and projections',
 fields: ['accountName', 'creditAmount', 'transactionDate', 'balanceChange'],
 filters: [{ field: 'accountType', operator: 'equals', value: 'Revenue' }],
 sortBy: 'creditAmount',
 sortOrder: 'desc'
 },
 {
 id: 'expense-forecasting',
 name: 'Expense Forecasting & Budgeting',
 description: 'Expense analysis with budget variance and predictions',
 fields: ['accountName', 'debitAmount', 'costCenter', 'transactionDate'],
 filters: [{ field: 'accountType', operator: 'equals', value: 'Expense' }],
 groupBy: 'costCenter',
 sortBy: 'debitAmount',
 sortOrder: 'desc'
 },
 {
 id: 'anomaly-detection',
 name: 'Anomaly Detection & Risk Analysis',
 description: 'AI-powered detection of unusual patterns and financial risks',
 fields: ['transactionDate', 'voucherNo', 'debitAmount', 'creditAmount', 'narration', 'createdBy'],
 filters: [],
 sortBy: 'transactionDate',
 sortOrder: 'desc'
 },
 {
 id: 'general-ledger',
 name: 'General Ledger Report',
 description: 'Complete general ledger with all transactions',
 fields: ['transactionDate', 'voucherNo', 'accountCode', 'accountName', 'narration', 'debitAmount', 'creditAmount', 'costCenter'],
 filters: [],
 groupBy: 'accountName',
 sortBy: 'transactionDate',
 sortOrder: 'desc'
 },
 {
 id: 'trial-balance',
 name: 'Trial Balance',
 description: 'Trial balance with opening, movement, and closing balances',
 fields: ['accountCode', 'accountName', 'accountType', 'openingBalance', 'debitAmount', 'creditAmount', 'currentBalance'],
 filters: [],
 groupBy: 'accountType',
 sortBy: 'accountCode',
 sortOrder: 'asc'
 },
 {
 id: 'party-outstanding',
 name: 'Party Outstanding Report',
 description: 'Outstanding balances by party with aging',
 fields: ['partyName', 'partyType', 'partyCity', 'partyBalance', 'creditLimit', 'agingDays'],
 filters: [{ field: 'partyBalance', operator: 'greaterThan', value: 0 }],
 groupBy: 'partyType',
 sortBy: 'partyBalance',
 sortOrder: 'desc'
 },
 {
 id: 'cash-flow',
 name: 'Cash Flow Statement',
 description: 'Cash inflows and outflows analysis',
 fields: ['transactionDate', 'voucherType', 'narration', 'debitAmount', 'creditAmount', 'costCenter', 'createdBy'],
 filters: [{ field: 'accountType', operator: 'equals', value: 'Asset' }],
 sortBy: 'transactionDate',
 sortOrder: 'desc'
 },
 {
 id: 'expense-analysis',
 name: 'Expense Analysis',
 description: 'Detailed expense breakdown by category',
 fields: ['accountName', 'costCenter', 'debitAmount', 'transactionDate', 'createdBy'],
 filters: [{ field: 'accountType', operator: 'equals', value: 'Expense' }],
 groupBy: 'accountName',
 sortBy: 'debitAmount',
 sortOrder: 'desc'
 },
 {
 id: 'bank-reconciliation',
 name: 'Bank Reconciliation Report',
 description: 'Bank-wise reconciliation status',
 fields: ['accountName', 'openingBalance', 'debitAmount', 'creditAmount', 'currentBalance'],
 filters: [{ field: 'accountName', operator: 'contains', value: 'Bank' }],
 sortBy: 'accountName',
 sortOrder: 'asc'
 }
];

const PowerBIExcelReports: React.FC<PowerBIExcelReportsProps> = (props) => {
 const [activeTab, setActiveTab] = useState<'templates' | 'custom' | 'history' | 'forecasting'>('templates');
 const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
 const [customFields, setCustomFields] = useState<string[]>([]);
 const [customFilters, setCustomFilters] = useState<ReportFilter[]>([]);
 const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
 const [previewData, setPreviewData] = useState<any[] | null>(null);
 const [isGenerating, setIsGenerating] = useState(false);
 const [showFieldSelector, setShowFieldSelector] = useState(false);
 const [reportName, setReportName] = useState('');
 const [dateRange, setDateRange] = useState({ start: '', end: '' });
 const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>(DEFAULT_TEMPLATES);
 const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
 
 // Forecasting State
 const [forecastData, setForecastData] = useState<ForecastData[]>([]);
 const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis[]>([]);
 const [financialProjections, setFinancialProjections] = useState<FinancialProjection[]>([]);
 const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
 const [kpiInsights, setKpiInsights] = useState<KPIInsight[]>([]);
 const [selectedForecastPeriod, setSelectedForecastPeriod] = useState<'month' | 'quarter' | 'year'>('month');
 const [showForecastModal, setShowForecastModal] = useState(false);
 const [forecastScenario, setForecastScenario] = useState<'optimistic' | 'realistic' | 'pessimistic'>('realistic');
 
 // AI Search State
 const [aiQuery, setAiQuery] = useState('');
 const [aiResults, setAiResults] = useState<AIQueryResult[]>([]);
 const [isAiProcessing, setIsAiProcessing] = useState(false);
 const [aiQueryHistory, setAiQueryHistory] = useState<string[]>([]);

 // Generate data based on selected fields and filters
 const generateReportData = (fields: string[], filters: ReportFilter[]): any[] => {
 let data: any[] = [];

 // Map fields to actual data sources
 fields.forEach(fieldId => {
 const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
 if (!field) return;

 switch (field.category) {
 case 'account':
 props.chartOfAccounts.forEach(acc => {
 const row: any = {};
 fields.forEach(fId => {
 switch (fId) {
 case 'accountCode': row[fId] = acc.accountCode; break;
 case 'accountName': row[fId] = acc.accountName; break;
 case 'accountType': row[fId] = acc.accountType; break;
 case 'openingBalance': row[fId] = acc.openingBalance; break;
 case 'currentBalance': row[fId] = acc.openingBalance; break;
 case 'accountStatus': row[fId] = acc.isActive ? 'Active' : 'Inactive'; break;
 }
 });
 data.push(row);
 });
 break;

 case 'transaction':
 props.generalLedger.forEach(entry => {
 const row: any = {};
 fields.forEach(fId => {
 switch (fId) {
 case 'voucherNo': row[fId] = entry.voucherNo; break;
 case 'voucherType': row[fId] = entry.voucherType; break;
 case 'transactionDate': row[fId] = entry.date; break;
 case 'debitAmount': row[fId] = entry.debit; break;
 case 'creditAmount': row[fId] = entry.credit; break;
 case 'narration': row[fId] = entry.narration; break;
 case 'costCenter': row[fId] = entry.costCenter || 'N/A'; break;
 case 'createdBy': row[fId] = entry.createdBy; break;
 }
 });
 data.push(row);
 });
 break;

 case 'party':
 props.parties.forEach(party => {
 const row: any = {};
 fields.forEach(fId => {
 switch (fId) {
 case 'partyName': row[fId] = party.name; break;
 case 'partyType': row[fId] = party.type; break;
 case 'partyCity': row[fId] = party.city; break;
 case 'partyBalance': row[fId] = party.currentBalance; break;
 case 'partyGST': row[fId] = party.gst || 'N/A'; break;
 case 'creditLimit': row[fId] = party.creditLimit || 0; break;
 }
 });
 data.push(row);
 });
 break;
 }
 });

 // Remove duplicates
 data = data.filter((row, index, self) => 
 index === self.findIndex(r => JSON.stringify(r) === JSON.stringify(row))
 );

 // Apply filters
 filters.forEach(filter => {
 data = data.filter(row => {
 const value = row[filter.field];
 switch (filter.operator) {
 case 'equals': return value === filter.value;
 case 'contains': return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
 case 'greaterThan': return Number(value) > Number(filter.value);
 case 'lessThan': return Number(value) < Number(filter.value);
 case 'between': return Number(value) >= Number(filter.value) && Number(value) <= Number(filter.value2);
 default: return true;
 }
 });
 });

 return data;
 };

 // Forecasting & Analytics Functions
 const generateForecast = (): ForecastData[] => {
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 const currentMonth = new Date().getMonth();
 
 // Calculate historical trends from general ledger
 const monthlyData: { [key: string]: number } = {};
 props.generalLedger.forEach(entry => {
 const date = new Date(entry.date);
 const monthKey = months[date.getMonth()];
 if (!monthlyData[monthKey]) monthlyData[monthKey] = 0;
 monthlyData[monthKey] += entry.debit - entry.credit;
 });

 const forecast: ForecastData[] = [];
 
 // Generate 12-month forecast
 for (let i = 0; i < 12; i++) {
 const monthIndex = (currentMonth + i) % 12;
 const month = months[monthIndex];
 const historical = monthlyData[month] || 0;
 
 // Apply trend analysis and seasonality
 const trendFactor = 1 + (i * 0.02); // 2% growth assumption
 const seasonalityFactor = 1 + (Math.sin(monthIndex * Math.PI / 6) * 0.1); // Seasonal variation
 const randomFactor = 0.95 + Math.random() * 0.1; // Random variation
 
 const forecasted = historical * trendFactor * seasonalityFactor * randomFactor;
 const confidence = Math.max(85 - i * 2, 60); // Confidence decreases with time
 
 forecast.push({
 period: month,
 actual: i === 0 ? historical : 0,
 forecast: Math.round(forecasted),
 confidence,
 trend: forecasted > historical ? 'up' : forecasted < historical ? 'down' : 'stable'
 });
 }
 
 return forecast;
 };

 const analyzeTrends = (): TrendAnalysis[] => {
 const trends: TrendAnalysis[] = [];
 
 // Revenue Trend
 const revenueEntries = props.generalLedger.filter(e => e.credit > 0);
 const currentRevenue = revenueEntries.slice(-30).reduce((sum, e) => sum + e.credit, 0);
 const previousRevenue = revenueEntries.slice(-60, -30).reduce((sum, e) => sum + e.credit, 0);
 
 trends.push({
 metric: 'Revenue',
 currentValue: currentRevenue,
 previousValue: previousRevenue,
 changePercent: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
 trend: currentRevenue > previousRevenue ? 'up' : currentRevenue < previousRevenue ? 'down' : 'stable',
 forecastNextMonth: Math.round(currentRevenue * 1.05),
 forecastNextQuarter: Math.round(currentRevenue * 3.2),
 forecastNextYear: Math.round(currentRevenue * 12.8)
 });

 // Expense Trend
 const expenseEntries = props.generalLedger.filter(e => e.debit > 0);
 const currentExpenses = expenseEntries.slice(-30).reduce((sum, e) => sum + e.debit, 0);
 const previousExpenses = expenseEntries.slice(-60, -30).reduce((sum, e) => sum + e.debit, 0);
 
 trends.push({
 metric: 'Expenses',
 currentValue: currentExpenses,
 previousValue: previousExpenses,
 changePercent: previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : 0,
 trend: currentExpenses > previousExpenses ? 'up' : currentExpenses < previousExpenses ? 'down' : 'stable',
 forecastNextMonth: Math.round(currentExpenses * 1.03),
 forecastNextQuarter: Math.round(currentExpenses * 3.1),
 forecastNextYear: Math.round(currentExpenses * 12.4)
 });

 // Cash Flow Trend
 const currentCashFlow = currentRevenue - currentExpenses;
 const previousCashFlow = previousRevenue - previousExpenses;
 
 trends.push({
 metric: 'Net Cash Flow',
 currentValue: currentCashFlow,
 previousValue: previousCashFlow,
 changePercent: previousCashFlow !== 0 ? ((currentCashFlow - previousCashFlow) / Math.abs(previousCashFlow)) * 100 : 0,
 trend: currentCashFlow > previousCashFlow ? 'up' : currentCashFlow < previousCashFlow ? 'down' : 'stable',
 forecastNextMonth: Math.round((currentRevenue * 1.05) - (currentExpenses * 1.03)),
 forecastNextQuarter: Math.round((currentRevenue * 3.2) - (currentExpenses * 3.1)),
 forecastNextYear: Math.round((currentRevenue * 12.8) - (currentExpenses * 12.4))
 });

 // Party Balance Trend
 const currentPartyBalance = props.parties.reduce((sum, p) => sum + p.currentBalance, 0);
 trends.push({
 metric: 'Total Receivables',
 currentValue: currentPartyBalance,
 previousValue: currentPartyBalance * 0.95,
 changePercent: 5,
 trend: 'up',
 forecastNextMonth: Math.round(currentPartyBalance * 1.02),
 forecastNextQuarter: Math.round(currentPartyBalance * 1.08),
 forecastNextYear: Math.round(currentPartyBalance * 1.25)
 });

 return trends;
 };

 const generateFinancialProjections = (): FinancialProjection[] => {
 const baseRevenue = props.generalLedger
 .filter(e => e.credit > 0)
 .slice(-90)
 .reduce((sum, e) => sum + e.credit, 0);
 
 const baseExpenses = props.generalLedger
 .filter(e => e.debit > 0)
 .slice(-90)
 .reduce((sum, e) => sum + e.debit, 0);

 return [
 {
 scenario: 'optimistic',
 revenue: Math.round(baseRevenue * 1.25),
 expenses: Math.round(baseExpenses * 1.1),
 netProfit: Math.round((baseRevenue * 1.25) - (baseExpenses * 1.1)),
 cashFlow: Math.round((baseRevenue * 1.25) - (baseExpenses * 1.1)) * 0.9,
 assumptions: [
 '15% market growth',
 'Successful new product launches',
 'Improved operational efficiency',
 'Favorable economic conditions'
 ]
 },
 {
 scenario: 'realistic',
 revenue: Math.round(baseRevenue * 1.08),
 expenses: Math.round(baseExpenses * 1.05),
 netProfit: Math.round((baseRevenue * 1.08) - (baseExpenses * 1.05)),
 cashFlow: Math.round((baseRevenue * 1.08) - (baseExpenses * 1.05)) * 0.85,
 assumptions: [
 'Steady market growth of 8%',
 'Normal business operations',
 'Controlled expense growth',
 'Stable economic environment'
 ]
 },
 {
 scenario: 'pessimistic',
 revenue: Math.round(baseRevenue * 0.92),
 expenses: Math.round(baseExpenses * 1.02),
 netProfit: Math.round((baseRevenue * 0.92) - (baseExpenses * 1.02)),
 cashFlow: Math.round((baseRevenue * 0.92) - (baseExpenses * 1.02)) * 0.8,
 assumptions: [
 'Market contraction of 8%',
 'Increased competition',
 'Higher operational costs',
 'Economic uncertainty'
 ]
 }
 ];
 };

 const detectAnomalies = (): AnomalyDetection[] => {
 const detected: AnomalyDetection[] = [];
 const entries = props.generalLedger;
 
 // Calculate average transaction size
 const amounts = entries.map(e => Math.max(e.debit, e.credit));
 const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
 const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - avgAmount, 2), 0) / amounts.length);
 
 // Detect spikes (transactions > 3 standard deviations)
 entries.forEach(entry => {
 const amount = Math.max(entry.debit, entry.credit);
 if (amount > avgAmount + (3 * stdDev)) {
 detected.push({
 type: 'spike',
 severity: 'high',
 description: `Unusually large transaction detected`,
 value: amount,
 expectedValue: Math.round(avgAmount),
 date: entry.date
 });
 }
 });

 // Detect drops (zero activity days after high activity)
 const dailyTotals: { [date: string]: number } = {};
 entries.forEach(e => {
 if (!dailyTotals[e.date]) dailyTotals[e.date] = 0;
 dailyTotals[e.date] += e.debit + e.credit;
 });
 
 const dates = Object.keys(dailyTotals).sort();
 for (let i = 1; i < dates.length; i++) {
 if (dailyTotals[dates[i]] < dailyTotals[dates[i-1]] * 0.1 && dailyTotals[dates[i-1]] > avgAmount) {
 detected.push({
 type: 'drop',
 severity: 'medium',
 description: `Significant drop in transaction volume`,
 value: dailyTotals[dates[i]],
 expectedValue: Math.round(dailyTotals[dates[i-1]]),
 date: dates[i]
 });
 }
 }

 return detected.slice(0, 10); // Limit to top 10 anomalies
 };

 const generateKPIInsights = (): KPIInsight[] => {
 const insights: KPIInsight[] = [];
 
 // Current Ratio
 const assets = props.chartOfAccounts
 .filter(a => a.accountType === 'Asset')
 .reduce((sum, a) => sum + a.openingBalance, 0);
 const liabilities = props.chartOfAccounts
 .filter(a => a.accountType === 'Liability')
 .reduce((sum, a) => sum + a.openingBalance, 0);
 const currentRatio = liabilities > 0 ? assets / liabilities : 0;
 
 insights.push({
 metric: 'Current Ratio',
 value: parseFloat(currentRatio.toFixed(2)),
 benchmark: 1.5,
 status: currentRatio >= 2 ? 'excellent' : currentRatio >= 1.5 ? 'good' : currentRatio >= 1 ? 'warning' : 'critical',
 recommendation: currentRatio < 1.5 ? 'Consider improving liquidity by reducing short-term liabilities' : 'Liquidity position is healthy'
 });

 // Debt-to-Equity
 const equity = props.chartOfAccounts
 .filter(a => a.accountType === 'Equity')
 .reduce((sum, a) => sum + a.openingBalance, 0);
 const debtToEquity = equity > 0 ? liabilities / equity : 0;
 
 insights.push({
 metric: 'Debt-to-Equity Ratio',
 value: parseFloat(debtToEquity.toFixed(2)),
 benchmark: 1.0,
 status: debtToEquity <= 0.5 ? 'excellent' : debtToEquity <= 1 ? 'good' : debtToEquity <= 2 ? 'warning' : 'critical',
 recommendation: debtToEquity > 1 ? 'High leverage detected. Consider debt reduction strategies.' : 'Capital structure is balanced'
 });

 // Collection Period
 const avgDailySales = props.generalLedger
 .filter(e => e.credit > 0)
 .slice(-30)
 .reduce((sum, e) => sum + e.credit, 0) / 30;
 const receivables = props.parties.reduce((sum, p) => sum + p.currentBalance, 0);
 const collectionPeriod = avgDailySales > 0 ? receivables / avgDailySales : 0;
 
 insights.push({
 metric: 'Avg Collection Period (Days)',
 value: Math.round(collectionPeriod),
 benchmark: 30,
 status: collectionPeriod <= 30 ? 'excellent' : collectionPeriod <= 45 ? 'good' : collectionPeriod <= 60 ? 'warning' : 'critical',
 recommendation: collectionPeriod > 45 ? 'Implement stricter credit policies to reduce collection period' : 'Collection efficiency is good'
 });

 // Expense Ratio
 const revenue = props.generalLedger.filter(e => e.credit > 0).reduce((sum, e) => sum + e.credit, 0);
 const expenses = props.generalLedger.filter(e => e.debit > 0).reduce((sum, e) => sum + e.debit, 0);
 const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : 0;
 
 insights.push({
 metric: 'Expense Ratio (%)',
 value: parseFloat(expenseRatio.toFixed(1)),
 benchmark: 70,
 status: expenseRatio <= 60 ? 'excellent' : expenseRatio <= 75 ? 'good' : expenseRatio <= 85 ? 'warning' : 'critical',
 recommendation: expenseRatio > 75 ? 'Review operational expenses for cost optimization opportunities' : 'Expense management is efficient'
 });

 return insights;
 };

 const runForecastingAnalysis = () => {
 setForecastData(generateForecast());
 setTrendAnalysis(analyzeTrends());
 setFinancialProjections(generateFinancialProjections());
 setAnomalies(detectAnomalies());
 setKpiInsights(generateKPIInsights());
 setActiveTab('forecasting');
 };

 // AI Natural Language Search
 const processAIQuery = async (query: string) => {
 if (!query.trim()) return;
 
 setIsAiProcessing(true);
 setAiQuery(query);
 
 // Add to history
 if (!aiQueryHistory.includes(query)) {
 setAiQueryHistory(prev => [query, ...prev].slice(0, 10));
 }
 
 // Simulate AI processing
 await new Promise(resolve => setTimeout(resolve, 800));
 
 const lowerQuery = query.toLowerCase();
 const results: AIQueryResult[] = [];
 
 // Pattern matching for different query types
 
 // KPI Queries
 if (lowerQuery.includes('ratio') || lowerQuery.includes('current ratio') || lowerQuery.includes('liquidity')) {
 const kpi = kpiInsights.find(k => k.metric.toLowerCase().includes('current ratio'));
 if (kpi) {
 results.push({
 type: 'kpi',
 title: 'Current Ratio Analysis',
 content: `Your current ratio is ${kpi.value}, which is ${kpi.status}. ${kpi.recommendation}`,
 data: kpi,
 confidence: 95,
 relatedMetrics: ['Liquidity', 'Working Capital', 'Short-term Solvency']
 });
 }
 }
 
 if (lowerQuery.includes('debt') || lowerQuery.includes('leverage') || lowerQuery.includes('debt to equity')) {
 const kpi = kpiInsights.find(k => k.metric.toLowerCase().includes('debt'));
 if (kpi) {
 results.push({
 type: 'kpi',
 title: 'Debt-to-Equity Analysis',
 content: `Your debt-to-equity ratio is ${kpi.value}. This indicates ${kpi.status} leverage. ${kpi.recommendation}`,
 data: kpi,
 confidence: 92,
 relatedMetrics: ['Financial Leverage', 'Capital Structure', 'Solvency']
 });
 }
 }
 
 if (lowerQuery.includes('collection') || lowerQuery.includes('receivable') || lowerQuery.includes('days')) {
 const kpi = kpiInsights.find(k => k.metric.toLowerCase().includes('collection'));
 if (kpi) {
 results.push({
 type: 'kpi',
 title: 'Collection Period Analysis',
 content: `Your average collection period is ${kpi.value} days. ${kpi.recommendation}`,
 data: kpi,
 confidence: 90,
 relatedMetrics: ['AR Turnover', 'Cash Conversion', 'Credit Policy']
 });
 }
 }
 
 // Trend Queries
 if (lowerQuery.includes('revenue') || lowerQuery.includes('sales') || lowerQuery.includes('income')) {
 const trend = trendAnalysis.find(t => t.metric.toLowerCase().includes('revenue'));
 if (trend) {
 results.push({
 type: 'trend',
 title: 'Revenue Trend Analysis',
 content: `Revenue is trending ${trend.trend} with a ${Math.abs(trend.changePercent).toFixed(1)}% change. Current: ₹${trend.currentValue.toLocaleString()}. Forecasted next month: ₹${trend.forecastNextMonth.toLocaleString()}`,
 data: trend,
 confidence: 88,
 relatedMetrics: ['Growth Rate', 'Sales Performance', 'Top Line']
 });
 }
 }
 
 if (lowerQuery.includes('expense') || lowerQuery.includes('cost') || lowerQuery.includes('spending')) {
 const trend = trendAnalysis.find(t => t.metric.toLowerCase().includes('expense'));
 if (trend) {
 results.push({
 type: 'trend',
 title: 'Expense Trend Analysis',
 content: `Expenses are ${trend.trend === 'up' ? 'increasing' : 'decreasing'} by ${Math.abs(trend.changePercent).toFixed(1)}%. Current: ₹${trend.currentValue.toLocaleString()}. Budget forecast: ₹${trend.forecastNextMonth.toLocaleString()}`,
 data: trend,
 confidence: 87,
 relatedMetrics: ['Cost Control', 'Operational Efficiency', 'Burn Rate']
 });
 }
 }
 
 if (lowerQuery.includes('cash flow') || lowerQuery.includes('cashflow') || lowerQuery.includes('liquidity')) {
 const trend = trendAnalysis.find(t => t.metric.toLowerCase().includes('cash flow'));
 if (trend) {
 results.push({
 type: 'trend',
 title: 'Cash Flow Analysis',
 content: `Net cash flow is ${trend.trend === 'up' ? 'positive and growing' : trend.trend === 'down' ? 'declining' : 'stable'} at ₹${trend.currentValue.toLocaleString()}. Next month projection: ₹${trend.forecastNextMonth.toLocaleString()}`,
 data: trend,
 confidence: 85,
 relatedMetrics: ['Free Cash Flow', 'Operating Cash', 'Cash Position']
 });
 }
 }
 
 // Forecast Queries
 if (lowerQuery.includes('forecast') || lowerQuery.includes('predict') || lowerQuery.includes('projection') || lowerQuery.includes('future')) {
 const nextMonth = forecastData.find(f => f.period === new Date().toLocaleString('default', { month: 'short' }));
 results.push({
 type: 'forecast',
 title: '12-Month Financial Forecast',
 content: `Based on historical trends and seasonality, the forecast shows ${forecastData.filter(f => f.trend === 'up').length} months of growth. Next month projection: ₹${forecastData[0]?.forecast.toLocaleString() || 'N/A'} with ${forecastData[0]?.confidence}% confidence.`,
 data: forecastData,
 confidence: 82,
 relatedMetrics: ['Predictive Analytics', 'Seasonality', 'Growth Trajectory']
 });
 }
 
 // Anomaly Queries
 if (lowerQuery.includes('anomaly') || lowerQuery.includes('unusual') || lowerQuery.includes('risk') || lowerQuery.includes('alert')) {
 if (anomalies.length > 0) {
 results.push({
 type: 'anomaly',
 title: `Anomaly Detection - ${anomalies.length} Issues Found`,
 content: `Detected ${anomalies.filter(a => a.severity === 'high').length} high-risk and ${anomalies.filter(a => a.severity === 'medium').length} medium-risk anomalies. Most recent: ${anomalies[0]?.description} on ${anomalies[0]?.date}.`,
 data: anomalies,
 confidence: 94,
 relatedMetrics: ['Risk Management', 'Fraud Detection', 'Audit Flags']
 });
 } else {
 results.push({
 type: 'anomaly',
 title: 'Anomaly Detection',
 content: 'No significant anomalies detected in the current period. All transactions appear within normal parameters.',
 confidence: 96,
 relatedMetrics: ['Data Integrity', 'Compliance', 'Normal Operations']
 });
 }
 }
 
 // Projection Queries
 if (lowerQuery.includes('scenario') || lowerQuery.includes('optimistic') || lowerQuery.includes('pessimistic') || lowerQuery.includes('best case') || lowerQuery.includes('worst case')) {
 const scenario = financialProjections.find(p => p.scenario === forecastScenario);
 if (scenario) {
 results.push({
 type: 'projection',
 title: `${forecastScenario.charAt(0).toUpperCase() + forecastScenario.slice(1)} Scenario Projection`,
 content: `Under ${forecastScenario} conditions: Revenue ₹${scenario.revenue.toLocaleString()}, Expenses ₹${scenario.expenses.toLocaleString()}, Net Profit ₹${scenario.netProfit.toLocaleString()}. Profit margin: ${scenario.revenue > 0 ? ((scenario.netProfit / scenario.revenue) * 100).toFixed(1) : 0}%`,
 data: scenario,
 confidence: 78,
 relatedMetrics: ['Scenario Planning', 'Budget Forecast', 'Strategic Planning']
 });
 }
 }
 
 // Comparison Queries
 if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('vs') || lowerQuery.includes('difference')) {
 const revenue = trendAnalysis.find(t => t.metric.toLowerCase().includes('revenue'));
 const expense = trendAnalysis.find(t => t.metric.toLowerCase().includes('expense'));
 if (revenue && expense) {
 const profit = revenue.currentValue - expense.currentValue;
 results.push({
 type: 'comparison',
 title: 'Revenue vs Expense Comparison',
 content: `Revenue: ₹${revenue.currentValue.toLocaleString()} vs Expenses: ₹${expense.currentValue.toLocaleString()}. Net position: ₹${profit.toLocaleString()} (${profit > 0 ? 'Profit' : 'Loss'}). Revenue covers expenses by ${expense.currentValue > 0 ? ((revenue.currentValue / expense.currentValue) * 100).toFixed(1) : 0}%.`,
 data: { revenue, expense, profit },
 confidence: 91,
 relatedMetrics: ['Profitability', 'Break-even Analysis', 'Margin Analysis']
 });
 }
 }
 
 // Summary/Overview Queries
 if (lowerQuery.includes('summary') || lowerQuery.includes('overview') || lowerQuery.includes('status') || lowerQuery.includes('how are we doing') || lowerQuery.includes('health')) {
 const totalRevenue = trendAnalysis.find(t => t.metric.toLowerCase().includes('revenue'))?.currentValue || 0;
 const totalExpense = trendAnalysis.find(t => t.metric.toLowerCase().includes('expense'))?.currentValue || 0;
 const cashFlow = trendAnalysis.find(t => t.metric.toLowerCase().includes('cash flow'))?.currentValue || 0;
 
 results.push({
 type: 'summary',
 title: 'Financial Health Summary',
 content: `Overall financial health is ${kpiInsights.filter(k => k.status === 'good' || k.status === 'excellent').length >= 2 ? 'GOOD' : 'NEEDS ATTENTION'}. Revenue: ₹${totalRevenue.toLocaleString()}, Expenses: ₹${totalExpense.toLocaleString()}, Net Cash Flow: ₹${cashFlow.toLocaleString()}. ${anomalies.length > 0 ? `⚠️ ${anomalies.length} anomalies require review.` : '✓ No critical issues detected.'}`,
 data: { kpiInsights, trendAnalysis, anomalies },
 confidence: 89,
 relatedMetrics: ['Financial Health', 'Performance Score', 'Executive Summary']
 });
 }
 
 // Default response if no patterns matched
 if (results.length === 0) {
 results.push({
 type: 'summary',
 title: 'General Financial Overview',
 content: `I can help you analyze: KPIs (ratios, collection period), Trends (revenue, expenses, cash flow), Forecasts (12-month projections), Anomalies (risks, unusual patterns), Scenarios (optimistic/pessimistic), and Comparisons. Try asking: "What's my current ratio?", "Show revenue trends", "Any anomalies?", or "Forecast for next quarter"`,
 confidence: 70,
 relatedMetrics: ['Help', 'Available Queries', 'Suggestions']
 });
 }
 
 setAiResults(results);
 setIsAiProcessing(false);
 };

 const generateReport = async () => {
 const fields = selectedTemplate ? selectedTemplate.fields : customFields;
 const filters = selectedTemplate ? selectedTemplate.filters : customFilters;
 
 if (fields.length === 0) return;

 setIsGenerating(true);
 
 // Simulate processing
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 const data = generateReportData(fields, filters);
 
 const report: GeneratedReport = {
 id: `RPT-${Date.now()}`,
 name: reportName || selectedTemplate?.name || 'Custom Report',
 templateId: selectedTemplate?.id || 'custom',
 generatedAt: new Date().toISOString(),
 rowCount: data.length,
 data,
 summary: {
 totalAmount: data.reduce((sum, row) => sum + (row.debitAmount || 0) + (row.creditAmount || 0) + (row.partyBalance || 0) + (row.openingBalance || 0), 0),
 recordCount: data.length,
 dateRange: dateRange.start ? dateRange : { start: 'All Time', end: 'All Time' },
 filtersApplied: filters.length
 }
 };

 setGeneratedReports(prev => [report, ...prev]);
 setPreviewData(data);
 setIsGenerating(false);
 };

 const exportToExcel = (report: GeneratedReport) => {
 // Create CSV content
 const headers = Object.keys(report.data[0] || {}).join(',');
 const rows = report.data.map(row => 
 Object.values(row).map(val => `"${val}"`).join(',')
 ).join('\n');
 
 const csvContent = `${headers}\n${rows}`;
 
 // Add BOM for Excel UTF-8 support
 const BOM = '\uFEFF';
 const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
 link.click();
 };

 const exportToExcelWithFormatting = (report: GeneratedReport) => {
 // Create HTML table for better Excel formatting
 const headers = Object.keys(report.data[0] || {});
 
 let html = `
 <html xmlns:o="urn:schemas-microsoft-com:office:office" 
 xmlns:x="urn:schemas-microsoft-com:office:excel" 
 xmlns="http://www.w3.org/TR/REC-html40">
 <head>
 <meta charset="UTF-8">
 <style>
 table { border-collapse: collapse; width: 100%; }
 th { background-color: #4472C4; color: white; font-weight: bold; padding: 8px; border: 1px solid #2F5597; }
 td { padding: 8px; border: 1px solid #D9E2F3; }
 tr:nth-child(even) { background-color: #E7E6E6; }
 .number { text-align: right; }
 .currency { text-align: right; color: #00B050; }
 .date { text-align: center; }
 </style>
 </head>
 <body>
 <h2>${report.name}</h2>
 <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
 <p>Records: ${report.rowCount}</p>
 <table>
 <thead>
 <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
 </thead>
 <tbody>
 `;

 report.data.forEach(row => {
 html += '<tr>';
 headers.forEach(header => {
 const value = row[header];
 const field = AVAILABLE_FIELDS.find(f => f.id === header);
 let cssClass = '';
 if (field?.dataType === 'currency') cssClass = 'currency';
 else if (field?.dataType === 'number') cssClass = 'number';
 else if (field?.dataType === 'date') cssClass = 'date';
 html += `<td class="${cssClass}">${value !== undefined ? value : ''}</td>`;
 });
 html += '</tr>';
 });

 html += `
 </tbody>
 </table>
 </body>
 </html>
 `;

 const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xls`;
 link.click();
 };

 const saveCustomTemplate = () => {
 if (!reportName || customFields.length === 0) return;
 
 const newTemplate: ReportTemplate = {
 id: `custom-${Date.now()}`,
 name: reportName,
 description: 'Custom user-defined report template',
 fields: customFields,
 filters: customFilters,
 sortOrder: 'asc'
 };
 
 setSavedTemplates([...savedTemplates, newTemplate]);
 setEditingTemplate(null);
 setReportName('');
 setCustomFields([]);
 setCustomFilters([]);
 };

 const deleteTemplate = (templateId: string) => {
 setSavedTemplates(savedTemplates.filter(t => t.id !== templateId));
 };

 const applyTemplate = (template: ReportTemplate) => {
 setSelectedTemplate(template);
 setCustomFields(template.fields);
 setCustomFilters(template.filters);
 setReportName(template.name);
 setActiveTab('custom');
 };

 const toggleField = (fieldId: string) => {
 if (customFields.includes(fieldId)) {
 setCustomFields(customFields.filter(f => f !== fieldId));
 } else {
 setCustomFields([...customFields, fieldId]);
 }
 };

 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
 {/* Header */}
 <div className="p-4 border-b border-slate-100 bg-accent text-white">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <FileSpreadsheet size={28} />
 <div>
 <h3 className="font-bold text-lg">Power BI Excel Reports</h3>
 <p className="text-green-100 text-sm">Customizable reports with Excel export</p>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => setActiveTab('templates')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeTab === 'templates' ? 'bg-white text-green-700' : 'bg-white/20 text-white hover:bg-white/30'
 }`}
 >
 Templates
 </button>
 <button
 onClick={() => setActiveTab('custom')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeTab === 'custom' ? 'bg-white text-green-700' : 'bg-white/20 text-white hover:bg-white/30'
 }`}
 >
 Custom Report
 </button>
 <button
 onClick={() => setActiveTab('history')}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeTab === 'history' ? 'bg-white text-green-700' : 'bg-white/20 text-white hover:bg-white/30'
 }`}
 >
 History ({generatedReports.length})
 </button>
 <button
 onClick={runForecastingAnalysis}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
 activeTab === 'forecasting' ? 'bg-purple-600 text-white' : 'bg-purple-500/80 text-white hover:bg-purple-500'
 }`}
 >
 <Brain size={16} /> Forecasting
 </button>
 </div>
 </div>
 </div>

 <div className="flex flex-1 overflow-hidden">
 {/* Templates Tab */}
 {activeTab === 'templates' && (
 <div className="flex-1 p-6 overflow-auto">
 <div className="max-w-6xl mx-auto">
 <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <LayoutGrid size={20} /> Report Templates
 </h4>
 <div className="grid grid-cols-3 gap-4">
 {savedTemplates.map(template => (
 <div key={template.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-none transition-shadow">
 <div className="flex justify-between items-start mb-2">
 <h5 className="font-semibold text-slate-800">{template.name}</h5>
 {!DEFAULT_TEMPLATES.find(dt => dt.id === template.id) && (
 <button
 onClick={() => deleteTemplate(template.id)}
 className="text-red-500 hover:text-red-700"
 >
 <Trash2 size={14} />
 </button>
 )}
 </div>
 <p className="text-sm text-slate-500 mb-3">{template.description}</p>
 <div className="flex flex-wrap gap-1 mb-3">
 {template.fields.slice(0, 3).map(fieldId => {
 const field = AVAILABLE_FIELDS.find(f => f.id === fieldId);
 return field ? (
 <span key={fieldId} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
 {field.name}
 </span>
 ) : null;
 })}
 {template.fields.length > 3 && (
 <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
 +{template.fields.length - 3} more
 </span>
 )}
 </div>
 <button
 onClick={() => applyTemplate(template)}
 className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
 >
 Use Template
 </button>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Custom Report Tab */}
 {activeTab === 'custom' && (
 <>
 {/* Field Selector Sidebar */}
 <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
 <div className="p-4 border-b border-slate-200">
 <h4 className="font-semibold text-slate-800 flex items-center gap-2">
 <Settings size={18} /> Report Builder
 </h4>
 </div>
 <div className="flex-1 overflow-auto p-4">
 {/* Report Name */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-slate-700 mb-1">Report Name</label>
 <input
 type="text"
 value={reportName}
 onChange={(e) => setReportName(e.target.value)}
 placeholder="Enter report name..."
 className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
 />
 </div>

 {/* Date Range */}
 <div className="mb-4">
 <label className="block text-sm font-medium text-slate-700 mb-1">Date Range</label>
 <div className="flex gap-2">
 <input
 type="date"
 value={dateRange.start}
 onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
 className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
 />
 <input
 type="date"
 value={dateRange.end}
 onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
 className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
 />
 </div>
 </div>

 {/* Field Categories */}
 <div className="space-y-4">
 {['account', 'transaction', 'party', 'financial', 'custom'].map(category => (
 <div key={category}>
 <h5 className="text-xs font-semibold text-slate-500 uppercase mb-2">{category} Fields</h5>
 <div className="space-y-1">
 {AVAILABLE_FIELDS.filter(f => f.category === category).map(field => (
 <label key={field.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
 <input
 type="checkbox"
 checked={customFields.includes(field.id)}
 onChange={() => toggleField(field.id)}
 className="rounded text-green-600 focus:ring-green-500"
 />
 <span className="text-sm text-slate-700">{field.name}</span>
 <span className="text-xs text-slate-400 ml-auto">{field.dataType}</span>
 </label>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Action Buttons */}
 <div className="p-4 border-t border-slate-200 space-y-2">
 <button
 onClick={generateReport}
 disabled={isGenerating || customFields.length === 0}
 className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
 >
 {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
 {isGenerating ? 'Generating...' : 'Preview Report'}
 </button>
 <button
 onClick={saveCustomTemplate}
 disabled={!reportName || customFields.length === 0}
 className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
 >
 <Save size={16} /> Save as Template
 </button>
 </div>
 </div>

 {/* Preview Area */}
 <div className="flex-1 flex flex-col overflow-hidden">
 {previewData ? (
 <>
 <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
 <div>
 <h4 className="font-semibold text-slate-800">{reportName || 'Report Preview'}</h4>
 <p className="text-sm text-slate-500">{previewData.length} records found</p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 const report = generatedReports[0];
 if (report) exportToExcel(report);
 }}
 className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
 >
 <FileSpreadsheet size={16} /> Export CSV
 </button>
 <button
 onClick={() => {
 const report = generatedReports[0];
 if (report) exportToExcelWithFormatting(report);
 }}
 className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent flex items-center gap-2"
 >
 <Download size={16} /> Export Excel
 </button>
 </div>
 </div>
 <div className="flex-1 overflow-auto p-4">
 <div className="border border-slate-200 rounded-lg overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-slate-100 border-b border-slate-200">
 <tr>
 {Object.keys(previewData[0] || {}).map(key => (
 <th key={key} className="px-4 py-3 text-left font-semibold text-slate-700 uppercase text-xs tracking-wider">
 {key.replace(/([A-Z])/g, ' $1').trim()}
 </th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {previewData.slice(0, 100).map((row, idx) => (
 <tr key={idx} className="hover:bg-slate-50">
 {Object.values(row).map((value: any, vIdx) => (
 <td key={vIdx} className="px-4 py-2 text-slate-700">
 {value !== undefined ? String(value) : ''}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 {previewData.length > 100 && (
 <div className="p-4 text-center text-sm text-slate-500 bg-slate-50">
 Showing first 100 of {previewData.length} records. Export to see all.
 </div>
 )}
 </div>
 </div>
 </>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
 <FileBarChart size={64} className="mb-4 opacity-20" />
 <p className="text-lg">Select fields and click Preview to generate report</p>
 <p className="text-sm mt-2">Choose fields from the sidebar to build your custom report</p>
 </div>
 )}
 </div>
 </>
 )}

 {/* History Tab */}
 {activeTab === 'history' && (
 <div className="flex-1 p-6 overflow-auto">
 <div className="max-w-6xl mx-auto">
 <h4 className="text-lg font-semibold text-slate-800 mb-4">Generated Reports History</h4>
 {generatedReports.length === 0 ? (
 <div className="text-center py-12 text-slate-400">
 <Calendar size={48} className="mx-auto mb-4 opacity-20" />
 <p>No reports generated yet</p>
 </div>
 ) : (
 <div className="space-y-3">
 {generatedReports.map(report => (
 <div key={report.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:shadow-none transition-shadow">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-green-100 text-green-600 rounded-lg">
 <FileSpreadsheet size={24} />
 </div>
 <div>
 <h5 className="font-semibold text-slate-800">{report.name}</h5>
 <p className="text-sm text-slate-500">
 Generated {new Date(report.generatedAt).toLocaleString()} • {report.rowCount} records
 </p>
 <div className="flex gap-4 mt-1 text-xs text-slate-400">
 <span>Total: ₹{report.summary.totalAmount.toLocaleString()}</span>
 <span>Filters: {report.summary.filtersApplied}</span>
 </div>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => exportToExcel(report)}
 className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
 >
 <FileSpreadsheet size={16} /> CSV
 </button>
 <button
 onClick={() => exportToExcelWithFormatting(report)}
 className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors flex items-center gap-1"
 >
 <Download size={16} /> Excel
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 )}

 {/* Forecasting Tab */}
 {activeTab === 'forecasting' && (
 <div className="flex-1 overflow-auto bg-slate-50">
 <div className="p-6 max-w-7xl mx-auto">
 {/* Header */}
 <div className="mb-6 flex justify-between items-center">
 <div>
 <h4 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
 <Brain size={28} className="text-purple-600" />
 AI-Powered Financial Forecasting
 </h4>
 <p className="text-slate-500 mt-1">Advanced analytics, trend analysis, and predictive insights</p>
 </div>
 <div className="flex gap-2">
 <select
 value={forecastScenario}
 onChange={(e) => setForecastScenario(e.target.value as any)}
 className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
 >
 <option value="optimistic">Optimistic Scenario</option>
 <option value="realistic">Realistic Scenario</option>
 <option value="pessimistic">Pessimistic Scenario</option>
 </select>
 <button
 onClick={runForecastingAnalysis}
 className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2"
 >
 <RefreshCw size={16} /> Refresh Analysis
 </button>
 </div>
 </div>

 {/* AI Natural Language Search */}
 <div className="mb-6 bg-accent rounded-xl p-6 text-white shadow-none">
 <div className="flex items-center gap-3 mb-4">
 <Bot size={28} />
 <div>
 <h5 className="text-lg font-bold">Ask AI About Your Financials</h5>
 <p className="text-purple-100 text-sm">Type natural language questions like "What's my current ratio?" or "Show revenue trends"</p>
 </div>
 </div>
 
 <div className="relative">
 <input
 type="text"
 value={aiQuery}
 onChange={(e) => setAiQuery(e.target.value)}
 onKeyPress={(e) => e.key === 'Enter' && processAIQuery(aiQuery)}
 placeholder="Ask anything about your financial data... (e.g., 'How is my cash flow?', 'Any anomalies?', 'Forecast next quarter')"
 className="w-full pl-12 pr-32 py-4 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-white/30 outline-none text-lg"
 />
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
 <button
 onClick={() => processAIQuery(aiQuery)}
 disabled={isAiProcessing || !aiQuery.trim()}
 className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
 >
 {isAiProcessing ? (
 <><RefreshCw size={16} className="animate-spin" /> Analyzing...</>
 ) : (
 <><Send size={16} /> Ask AI</>
 )}
 </button>
 </div>

 {/* Quick Suggestions */}
 <div className="flex flex-wrap gap-2 mt-4">
 <span className="text-sm text-purple-200">Try:</span>
 {['Current ratio', 'Revenue trends', 'Cash flow forecast', 'Any risks?', 'Expense analysis', 'Best scenario'].map((suggestion) => (
 <button
 key={suggestion}
 onClick={() => {
 setAiQuery(suggestion);
 processAIQuery(suggestion);
 }}
 className="text-sm px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
 >
 {suggestion}
 </button>
 ))}
 </div>

 {/* Query History */}
 {aiQueryHistory.length > 0 && (
 <div className="mt-4 pt-4 border-t border-white/20">
 <span className="text-sm text-purple-200">Recent queries:</span>
 <div className="flex flex-wrap gap-2 mt-2">
 {aiQueryHistory.slice(0, 5).map((query, idx) => (
 <button
 key={idx}
 onClick={() => {
 setAiQuery(query);
 processAIQuery(query);
 }}
 className="text-sm px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center gap-1"
 >
 <Clock size={12} /> {query}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* AI Results Display */}
 {aiResults.length > 0 && (
 <div className="mb-6 space-y-4">
 <div className="flex items-center gap-2">
 <Sparkles size={20} className="text-purple-600" />
 <h5 className="text-lg font-semibold text-slate-800">AI Insights</h5>
 <span className="text-sm text-slate-500">({aiResults.length} results found)</span>
 </div>
 
 {aiResults.map((result, idx) => (
 <div key={idx} className={`rounded-xl border p-5 ${
 result.type === 'kpi' ? 'bg-blue-50 border-blue-200' :
 result.type === 'trend' ? 'bg-green-50 border-green-200' :
 result.type === 'forecast' ? 'bg-purple-50 border-purple-200' :
 result.type === 'anomaly' ? 'bg-red-50 border-red-200' :
 result.type === 'projection' ? 'bg-indigo-50 border-indigo-200' :
 'bg-slate-50 border-slate-200'
 }`}>
 <div className="flex justify-between items-start mb-3">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-1 rounded text-xs font-medium ${
 result.type === 'kpi' ? 'bg-blue-200 text-blue-800' :
 result.type === 'trend' ? 'bg-green-200 text-green-800' :
 result.type === 'forecast' ? 'bg-purple-200 text-purple-800' :
 result.type === 'anomaly' ? 'bg-red-200 text-red-800' :
 result.type === 'projection' ? 'bg-indigo-200 text-indigo-800' :
 'bg-slate-200 text-slate-800'
 }`}>
 {result.type.toUpperCase()}
 </span>
 <h6 className="font-semibold text-slate-800">{result.title}</h6>
 </div>
 <span className="text-xs text-slate-500">Confidence: {result.confidence}%</span>
 </div>
 
 <p className="text-slate-700 leading-relaxed mb-3">{result.content}</p>
 
 {result.data && (
 <div className="bg-white rounded-lg p-3 border border-slate-200">
 {result.type === 'kpi' && (
 <div className="grid grid-cols-3 gap-4 text-sm">
 <div><span className="text-slate-500">Value:</span> <strong>{result.data.value}</strong></div>
 <div><span className="text-slate-500">Benchmark:</span> <strong>{result.data.benchmark}</strong></div>
 <div><span className="text-slate-500">Status:</span> <strong className={
 result.data.status === 'excellent' ? 'text-green-600' :
 result.data.status === 'good' ? 'text-accent' :
 result.data.status === 'warning' ? 'text-yellow-600' :
 'text-red-600'
 }>{result.data.status.toUpperCase()}</strong></div>
 </div>
 )}
 
 {result.type === 'trend' && (
 <div className="grid grid-cols-4 gap-4 text-sm">
 <div><span className="text-slate-500">Current:</span> <strong>₹{result.data.currentValue?.toLocaleString()}</strong></div>
 <div><span className="text-slate-500">Change:</span> <strong className={result.data.changePercent > 0 ? 'text-green-600' : 'text-red-600'}>{result.data.changePercent > 0 ? '+' : ''}{result.data.changePercent?.toFixed(1)}%</strong></div>
 <div><span className="text-slate-500">Next Month:</span> <strong>₹{result.data.forecastNextMonth?.toLocaleString()}</strong></div>
 <div><span className="text-slate-500">Trend:</span> <strong className={
 result.data.trend === 'up' ? 'text-green-600' :
 result.data.trend === 'down' ? 'text-red-600' :
 'text-slate-600'
 }>{result.data.trend?.toUpperCase()}</strong></div>
 </div>
 )}
 
 {result.type === 'projection' && (
 <div className="grid grid-cols-4 gap-4 text-sm">
 <div><span className="text-slate-500">Revenue:</span> <strong className="text-green-600">₹{result.data.revenue?.toLocaleString()}</strong></div>
 <div><span className="text-slate-500">Expenses:</span> <strong className="text-red-600">₹{result.data.expenses?.toLocaleString()}</strong></div>
 <div><span className="text-slate-500">Net Profit:</span> <strong className={result.data.netProfit >= 0 ? 'text-accent' : 'text-red-600'}>₹{result.data.netProfit?.toLocaleString()}</strong></div>
 <div><span className="text-slate-500">Margin:</span> <strong>{result.data.revenue > 0 ? ((result.data.netProfit / result.data.revenue) * 100).toFixed(1) : 0}%</strong></div>
 </div>
 )}
 </div>
 )}
 
 <div className="mt-3 flex flex-wrap gap-2">
 {result.relatedMetrics.map((metric, i) => (
 <span key={i} className="text-xs px-2 py-1 bg-white/50 rounded text-slate-600">
 {metric}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* KPI Insights */}
 <div className="grid grid-cols-4 gap-4 mb-6">
 {kpiInsights.map((kpi, idx) => (
 <div key={idx} className={`rounded-xl p-4 border ${
 kpi.status === 'excellent' ? 'bg-green-50 border-green-200' :
 kpi.status === 'good' ? 'bg-blue-50 border-blue-200' :
 kpi.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
 'bg-red-50 border-red-200'
 }`}>
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-slate-600">{kpi.metric}</span>
 <Gauge size={16} className={
 kpi.status === 'excellent' ? 'text-green-600' :
 kpi.status === 'good' ? 'text-accent' :
 kpi.status === 'warning' ? 'text-yellow-600' :
 'text-red-600'
 } />
 </div>
 <div className="text-2xl font-bold text-slate-800">{kpi.value}</div>
 <div className="text-xs text-slate-500 mt-1">Benchmark: {kpi.benchmark}</div>
 <div className={`text-xs mt-2 ${
 kpi.status === 'excellent' ? 'text-green-700' :
 kpi.status === 'good' ? 'text-accent' :
 kpi.status === 'warning' ? 'text-yellow-700' :
 'text-red-700'
 }`}>
 {kpi.recommendation}
 </div>
 </div>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-6">
 {/* Trend Analysis */}
 <div className="bg-white rounded-xl border border-slate-200 p-6">
 <h5 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <TrendingUp size={20} className="text-accent" />
 Trend Analysis & Forecasts
 </h5>
 <div className="space-y-4">
 {trendAnalysis.map((trend, idx) => (
 <div key={idx} className="p-4 bg-slate-50 rounded-lg">
 <div className="flex justify-between items-start mb-2">
 <span className="font-medium text-slate-700">{trend.metric}</span>
 <span className={`flex items-center gap-1 text-sm font-medium ${
 trend.trend === 'up' ? 'text-green-600' :
 trend.trend === 'down' ? 'text-red-600' :
 'text-slate-600'
 }`}>
 {trend.trend === 'up' ? <ArrowUpRight size={16} /> :
 trend.trend === 'down' ? <ArrowDownRight size={16} /> :
 <TrendingUp size={16} />}
 {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
 </span>
 </div>
 <div className="text-2xl font-bold text-slate-800 mb-3">
 ₹{trend.currentValue.toLocaleString()}
 </div>
 <div className="grid grid-cols-3 gap-2 text-sm">
 <div className="bg-white p-2 rounded border border-slate-200">
 <div className="text-slate-500 text-xs">Next Month</div>
 <div className="font-semibold text-slate-700">₹{trend.forecastNextMonth.toLocaleString()}</div>
 </div>
 <div className="bg-white p-2 rounded border border-slate-200">
 <div className="text-slate-500 text-xs">Next Quarter</div>
 <div className="font-semibold text-slate-700">₹{trend.forecastNextQuarter.toLocaleString()}</div>
 </div>
 <div className="bg-white p-2 rounded border border-slate-200">
 <div className="text-slate-500 text-xs">Next Year</div>
 <div className="font-semibold text-slate-700">₹{trend.forecastNextYear.toLocaleString()}</div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Financial Projections */}
 <div className="bg-white rounded-xl border border-slate-200 p-6">
 <h5 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <Target size={20} className="text-purple-600" />
 Financial Projections ({forecastScenario.charAt(0).toUpperCase() + forecastScenario.slice(1)})
 </h5>
 {financialProjections.filter(p => p.scenario === forecastScenario).map((proj, idx) => (
 <div key={idx} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="p-4 bg-green-50 rounded-lg border border-green-200">
 <div className="flex items-center gap-2 text-green-700 mb-1">
 <TrendingUp size={16} />
 <span className="text-sm font-medium">Projected Revenue</span>
 </div>
 <div className="text-2xl font-bold text-green-800">₹{proj.revenue.toLocaleString()}</div>
 </div>
 <div className="p-4 bg-red-50 rounded-lg border border-red-200">
 <div className="flex items-center gap-2 text-red-700 mb-1">
 <TrendingDown size={16} />
 <span className="text-sm font-medium">Projected Expenses</span>
 </div>
 <div className="text-2xl font-bold text-red-800">₹{proj.expenses.toLocaleString()}</div>
 </div>
 </div>
 <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
 <div className="flex items-center gap-2 text-accent mb-1">
 <DollarSign size={16} />
 <span className="text-sm font-medium">Net Profit Projection</span>
 </div>
 <div className={`text-3xl font-bold ${proj.netProfit >= 0 ? 'text-blue-800' : 'text-red-600'}`}>
 ₹{proj.netProfit.toLocaleString()}
 </div>
 <div className="text-sm text-accent mt-1">
 Margin: {proj.revenue > 0 ? ((proj.netProfit / proj.revenue) * 100).toFixed(1) : 0}%
 </div>
 </div>
 <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
 <div className="flex items-center gap-2 text-purple-700 mb-2">
 <Wallet size={16} />
 <span className="text-sm font-medium">Cash Flow Projection</span>
 </div>
 <div className="text-xl font-bold text-purple-800">₹{proj.cashFlow.toLocaleString()}</div>
 </div>
 <div>
 <h6 className="text-sm font-medium text-slate-700 mb-2">Key Assumptions:</h6>
 <ul className="space-y-1">
 {proj.assumptions.map((assumption, i) => (
 <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
 <Lightbulb size={14} className="text-yellow-500 mt-0.5 shrink-0" />
 {assumption}
 </li>
 ))}
 </ul>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* 12-Month Forecast Chart */}
 <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
 <h5 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <LineChart size={20} className="text-indigo-600" />
 12-Month Cash Flow Forecast
 </h5>
 <div className="overflow-x-auto">
 <div className="flex gap-2 min-w-max">
 {forecastData.map((data, idx) => (
 <div key={idx} className="flex flex-col items-center">
 <div className="relative w-16 h-48 bg-slate-100 rounded-lg overflow-hidden">
 {/* Actual bar */}
 {data.actual > 0 && (
 <div 
 className="absolute bottom-0 w-full bg-accent transition-all"
 style={{ height: `${Math.min((data.actual / 100000) * 100, 100)}%` }}
 />
 )}
 {/* Forecast bar */}
 <div 
 className={`absolute bottom-0 w-full opacity-60 transition-all ${
 data.trend === 'up' ? 'bg-green-400' :
 data.trend === 'down' ? 'bg-red-400' :
 'bg-yellow-400'
 }`}
 style={{ height: `${Math.min((data.forecast / 100000) * 100, 100)}%` }}
 />
 {/* Confidence indicator */}
 <div className="absolute top-1 right-1">
 <div className={`w-2 h-2 rounded-full ${
 data.confidence >= 90 ? 'bg-green-500' :
 data.confidence >= 75 ? 'bg-yellow-500' :
 'bg-red-500'
 }`} />
 </div>
 </div>
 <span className="text-xs text-slate-600 mt-2 font-medium">{data.period}</span>
 <span className="text-xs text-slate-400">₹{(data.forecast / 1000).toFixed(0)}K</span>
 </div>
 ))}
 </div>
 </div>
 <div className="flex gap-6 mt-4 text-sm">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-accent rounded" />
 <span className="text-slate-600">Actual</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-green-400 rounded opacity-60" />
 <span className="text-slate-600">Forecast (Up)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 bg-red-400 rounded opacity-60" />
 <span className="text-slate-600">Forecast (Down)</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full" />
 <span className="text-slate-600">High Confidence</span>
 </div>
 </div>
 </div>

 {/* Anomaly Detection */}
 {anomalies.length > 0 && (
 <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
 <h5 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
 <AlertCircle size={20} className="text-orange-600" />
 Anomaly Detection & Risk Alerts
 </h5>
 <div className="space-y-3">
 {anomalies.map((anomaly, idx) => (
 <div key={idx} className={`p-4 rounded-lg border ${
 anomaly.severity === 'high' ? 'bg-red-50 border-red-200' :
 anomaly.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
 'bg-blue-50 border-blue-200'
 }`}>
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-2">
 <span className={`px-2 py-1 rounded text-xs font-medium ${
 anomaly.severity === 'high' ? 'bg-red-200 text-red-800' :
 anomaly.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
 'bg-blue-200 text-blue-800'
 }`}>
 {anomaly.severity.toUpperCase()}
 </span>
 <span className="text-sm text-slate-500">{anomaly.date}</span>
 </div>
 <span className="text-xs text-slate-400">{anomaly.type.replace('_', ' ').toUpperCase()}</span>
 </div>
 <p className="text-slate-700 mt-2">{anomaly.description}</p>
 <div className="flex gap-4 mt-2 text-sm">
 <span className="text-slate-600">Detected: <strong>₹{anomaly.value.toLocaleString()}</strong></span>
 <span className="text-slate-600">Expected: <strong>₹{anomaly.expectedValue.toLocaleString()}</strong></span>
 <span className={`font-medium ${
 anomaly.value > anomaly.expectedValue ? 'text-red-600' : 'text-green-600'
 }`}>
 Variance: {((Math.abs(anomaly.value - anomaly.expectedValue) / anomaly.expectedValue) * 100).toFixed(1)}%
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Export Options */}
 <div className="mt-6 flex justify-end gap-3">
 <button
 onClick={() => {
 const reportData = {
 kpiInsights,
 trendAnalysis,
 financialProjections,
 forecastData,
 anomalies
 };
 const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `Forecasting_Analysis_${new Date().toISOString().split('T')[0]}.json`;
 link.click();
 }}
 className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors flex items-center gap-2"
 >
 <Download size={16} /> Export JSON
 </button>
 <button
 onClick={() => {
 // Export to Excel with all forecasting data
 let html = `
 <html>
 <head><meta charset="UTF-8"></head>
 <body>
 <h1>Financial Forecasting Report</h1>
 <h2>KPI Insights</h2>
 <table border="1">
 <tr><th>Metric</th><th>Value</th><th>Benchmark</th><th>Status</th></tr>
 ${kpiInsights.map(k => `<tr><td>${k.metric}</td><td>${k.value}</td><td>${k.benchmark}</td><td>${k.status}</td></tr>`).join('')}
 </table>
 <h2>Trend Analysis</h2>
 <table border="1">
 <tr><th>Metric</th><th>Current</th><th>Change %</th><th>Next Month</th><th>Next Year</th></tr>
 ${trendAnalysis.map(t => `<tr><td>${t.metric}</td><td>${t.currentValue}</td><td>${t.changePercent}%</td><td>${t.forecastNextMonth}</td><td>${t.forecastNextYear}</td></tr>`).join('')}
 </table>
 <h2>12-Month Forecast</h2>
 <table border="1">
 <tr><th>Period</th><th>Forecast</th><th>Confidence</th><th>Trend</th></tr>
 ${forecastData.map(f => `<tr><td>${f.period}</td><td>${f.forecast}</td><td>${f.confidence}%</td><td>${f.trend}</td></tr>`).join('')}
 </table>
 </body>
 </html>
 `;
 const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `Forecasting_Report_${new Date().toISOString().split('T')[0]}.xls`;
 link.click();
 }}
 className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
 >
 <FileSpreadsheet size={16} /> Export to Excel
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default PowerBIExcelReports;


