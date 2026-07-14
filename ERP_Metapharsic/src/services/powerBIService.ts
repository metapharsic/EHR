// Power BI Integration Service for ERP System
// Generates Power BI-ready datasets and provides embedding capabilities
// Includes Advanced Forecasting & Predictive Analytics

import { utils, writeFile } from 'xlsx';
import { addExcelBranding } from '../utils/accountingExport';

// Power BI Configuration
interface PowerBIConfig {
  workspaceId: string;
  datasetId: string;
  reportId: string;
  embedToken: string;
  enabled: boolean;
}

// Report Types
export type PowerBIReportType = 
  | 'sales'
  | 'inventory'
  | 'finance'
  | 'employee'
  | 'pcd'
  | 'logistics'
  | 'compliance'
  | 'assets'
  | 'crm'
  | 'overall';

// Default configuration
let powerBIConfig: PowerBIConfig = {
  workspaceId: localStorage.getItem('powerbi_workspace_id') || '',
  datasetId: localStorage.getItem('powerbi_dataset_id') || '',
  reportId: localStorage.getItem('powerbi_report_id') || '',
  embedToken: localStorage.getItem('powerbi_embed_token') || '',
  enabled: localStorage.getItem('powerbi_enabled') === 'true'
};

// Save configuration
export const savePowerBIConfig = (config: Partial<PowerBIConfig>) => {
  powerBIConfig = { ...powerBIConfig, ...config };
  localStorage.setItem('powerbi_workspace_id', powerBIConfig.workspaceId);
  localStorage.setItem('powerbi_dataset_id', powerBIConfig.datasetId);
  localStorage.setItem('powerbi_report_id', powerBIConfig.reportId);
  localStorage.setItem('powerbi_embed_token', powerBIConfig.embedToken);
  localStorage.setItem('powerbi_enabled', powerBIConfig.enabled.toString());
};

// Get configuration
export const getPowerBIConfig = (): PowerBIConfig => {
  return { ...powerBIConfig };
};

// Power BI Dataset Schema Definitions
export const getDatasetSchema = (reportType: PowerBIReportType) => {
  const schemas: Record<PowerBIReportType, any> = {
    sales: {
      name: 'Sales Analytics Dataset',
      tables: [
        {
          name: 'Sales',
          columns: [
            { name: 'InvoiceID', dataType: 'string' },
            { name: 'Date', dataType: 'dateTime' },
            { name: 'CustomerName', dataType: 'string' },
            { name: 'ProductName', dataType: 'string' },
            { name: 'Quantity', dataType: 'int64' },
            { name: 'UnitPrice', dataType: 'double' },
            { name: 'TotalAmount', dataType: 'double' },
            { name: 'GSTAmount', dataType: 'double' },
            { name: 'NetAmount', dataType: 'double' },
            { name: 'PaymentMode', dataType: 'string' },
            { name: 'SalesRep', dataType: 'string' },
            { name: 'Territory', dataType: 'string' },
            { name: 'ProductCategory', dataType: 'string' },
            { name: 'Month', dataType: 'string' },
            { name: 'Quarter', dataType: 'string' },
            { name: 'Year', dataType: 'int64' }
          ]
        },
        {
          name: 'SalesTargets',
          columns: [
            { name: 'RepID', dataType: 'string' },
            { name: 'RepName', dataType: 'string' },
            { name: 'TargetAmount', dataType: 'double' },
            { name: 'AchievedAmount', dataType: 'double' },
            { name: 'AchievementPercent', dataType: 'double' },
            { name: 'Month', dataType: 'string' },
            { name: 'Year', dataType: 'int64' }
          ]
        }
      ]
    },
    inventory: {
      name: 'Inventory Analytics Dataset',
      tables: [
        {
          name: 'Inventory',
          columns: [
            { name: 'ProductID', dataType: 'string' },
            { name: 'ProductName', dataType: 'string' },
            { name: 'GenericName', dataType: 'string' },
            { name: 'Manufacturer', dataType: 'string' },
            { name: 'Category', dataType: 'string' },
            { name: 'CurrentStock', dataType: 'int64' },
            { name: 'MinStockLevel', dataType: 'int64' },
            { name: 'ReorderLevel', dataType: 'int64' },
            { name: 'StockValue', dataType: 'double' },
            { name: 'ExpiryDate', dataType: 'dateTime' },
            { name: 'DaysToExpiry', dataType: 'int64' },
            { name: 'BatchNumber', dataType: 'string' },
            { name: 'RackLocation', dataType: 'string' },
            { name: 'StockStatus', dataType: 'string' },
            { name: 'LastPurchaseDate', dataType: 'dateTime' },
            { name: 'LastSaleDate', dataType: 'dateTime' }
          ]
        },
        {
          name: 'StockMovements',
          columns: [
            { name: 'MovementID', dataType: 'string' },
            { name: 'ProductID', dataType: 'string' },
            { name: 'Date', dataType: 'dateTime' },
            { name: 'Type', dataType: 'string' },
            { name: 'Quantity', dataType: 'int64' },
            { name: 'Reference', dataType: 'string' },
            { name: 'Month', dataType: 'string' },
            { name: 'Year', dataType: 'int64' }
          ]
        }
      ]
    },
    finance: {
      name: 'Financial Analytics Dataset',
      tables: [
        {
          name: 'Transactions',
          columns: [
            { name: 'TransactionID', dataType: 'string' },
            { name: 'Date', dataType: 'dateTime' },
            { name: 'Type', dataType: 'string' },
            { name: 'PartyName', dataType: 'string' },
            { name: 'Debit', dataType: 'double' },
            { name: 'Credit', dataType: 'double' },
            { name: 'Balance', dataType: 'double' },
            { name: 'Narration', dataType: 'string' },
            { name: 'Month', dataType: 'string' },
            { name: 'Quarter', dataType: 'string' },
            { name: 'Year', dataType: 'int64' }
          ]
        },
        {
          name: 'GSTSummary',
          columns: [
            { name: 'Month', dataType: 'string' },
            { name: 'Year', dataType: 'int64' },
            { name: 'TaxableValue', dataType: 'double' },
            { name: 'CGST', dataType: 'double' },
            { name: 'SGST', dataType: 'double' },
            { name: 'IGST', dataType: 'double' },
            { name: 'TotalGST', dataType: 'double' }
          ]
        }
      ]
    },
    employee: {
      name: 'Employee Performance Dataset',
      tables: [
        {
          name: 'Employees',
          columns: [
            { name: 'EmployeeID', dataType: 'string' },
            { name: 'Name', dataType: 'string' },
            { name: 'Designation', dataType: 'string' },
            { name: 'Department', dataType: 'string' },
            { name: 'Territory', dataType: 'string' },
            { name: 'JoinDate', dataType: 'dateTime' },
            { name: 'Status', dataType: 'string' },
            { name: 'BaseSalary', dataType: 'double' },
            { name: 'Incentives', dataType: 'double' },
            { name: 'TotalCompensation', dataType: 'double' }
          ]
        },
        {
          name: 'Performance',
          columns: [
            { name: 'EmployeeID', dataType: 'string' },
            { name: 'Month', dataType: 'string' },
            { name: 'Year', dataType: 'int64' },
            { name: 'SalesTarget', dataType: 'double' },
            { name: 'ActualSales', dataType: 'double' },
            { name: 'AchievementPercent', dataType: 'double' },
            { name: 'VisitsCompleted', dataType: 'int64' },
            { name: 'NewCustomers', dataType: 'int64' }
          ]
        }
      ]
    },
    pcd: {
      name: 'PCD Network Dataset',
      tables: [
        {
          name: 'Partners',
          columns: [
            { name: 'PartnerID', dataType: 'string' },
            { name: 'PartnerName', dataType: 'string' },
            { name: 'Territory', dataType: 'string' },
            { name: 'JoinDate', dataType: 'dateTime' },
            { name: 'Status', dataType: 'string' },
            { name: 'CreditLimit', dataType: 'double' },
            { name: 'CurrentBalance', dataType: 'double' },
            { name: 'TotalPurchases', dataType: 'double' },
            { name: 'LastOrderDate', dataType: 'dateTime' }
          ]
        },
        {
          name: 'Targets',
          columns: [
            { name: 'PartnerID', dataType: 'string' },
            { name: 'Month', dataType: 'string' },
            { name: 'Year', dataType: 'int64' },
            { name: 'TargetAmount', dataType: 'double' },
            { name: 'AchievedAmount', dataType: 'double' },
            { name: 'AchievementPercent', dataType: 'double' },
            { name: 'IncentiveEarned', dataType: 'double' }
          ]
        }
      ]
    },
    logistics: {
      name: 'Logistics Dataset',
      tables: [
        {
          name: 'Shipments',
          columns: [
            { name: 'ShipmentID', dataType: 'string' },
            { name: 'Date', dataType: 'dateTime' },
            { name: 'Transporter', dataType: 'string' },
            { name: 'Destination', dataType: 'string' },
            { name: 'Packages', dataType: 'int64' },
            { name: 'Weight', dataType: 'double' },
            { name: 'FreightCost', dataType: 'double' },
            { name: 'Status', dataType: 'string' },
            { name: 'DeliveryDate', dataType: 'dateTime' },
            { name: 'OnTime', dataType: 'boolean' }
          ]
        }
      ]
    },
    compliance: {
      name: 'Compliance Dataset',
      tables: [
        {
          name: 'Licenses',
          columns: [
            { name: 'LicenseID', dataType: 'string' },
            { name: 'Type', dataType: 'string' },
            { name: 'IssueDate', dataType: 'dateTime' },
            { name: 'ExpiryDate', dataType: 'dateTime' },
            { name: 'DaysRemaining', dataType: 'int64' },
            { name: 'Status', dataType: 'string' },
            { name: 'Authority', dataType: 'string' }
          ]
        }
      ]
    },
    assets: {
      name: 'Asset Management Dataset',
      tables: [
        {
          name: 'Assets',
          columns: [
            { name: 'AssetID', dataType: 'string' },
            { name: 'Name', dataType: 'string' },
            { name: 'Category', dataType: 'string' },
            { name: 'PurchaseDate', dataType: 'dateTime' },
            { name: 'PurchaseCost', dataType: 'double' },
            { name: 'CurrentValue', dataType: 'double' },
            { name: 'Depreciation', dataType: 'double' },
            { name: 'Location', dataType: 'string' },
            { name: 'Status', dataType: 'string' },
            { name: 'NextMaintenance', dataType: 'dateTime' }
          ]
        }
      ]
    },
    crm: {
      name: 'CRM Analytics Dataset',
      tables: [
        {
          name: 'Leads',
          columns: [
            { name: 'LeadID', dataType: 'string' },
            { name: 'Name', dataType: 'string' },
            { name: 'Company', dataType: 'string' },
            { name: 'Source', dataType: 'string' },
            { name: 'Status', dataType: 'string' },
            { name: 'Priority', dataType: 'string' },
            { name: 'AssignedTo', dataType: 'string' },
            { name: 'CreatedDate', dataType: 'dateTime' },
            { name: 'ExpectedValue', dataType: 'double' },
            { name: 'Probability', dataType: 'double' }
          ]
        }
      ]
    },
    overall: {
      name: 'Executive Dashboard Dataset',
      tables: [
        {
          name: 'KPIs',
          columns: [
            { name: 'Metric', dataType: 'string' },
            { name: 'Value', dataType: 'double' },
            { name: 'Target', dataType: 'double' },
            { name: 'Variance', dataType: 'double' },
            { name: 'Period', dataType: 'string' },
            { name: 'Date', dataType: 'dateTime' }
          ]
        }
      ]
    }
  };

  return schemas[reportType];
};

// Generate Power BI Embedded URL
export const getPowerBIEmbedUrl = (reportType: PowerBIReportType): string => {
  if (!powerBIConfig.enabled || !powerBIConfig.workspaceId || !powerBIConfig.reportId) {
    return '';
  }
  
  // In production, this would generate a proper embed URL with token
  return `https://app.powerbi.com/reportEmbed?reportId=${powerBIConfig.reportId}&groupId=${powerBIConfig.workspaceId}`;
};

// Export data to Excel for Power BI import
export const exportToPowerBIExcel = (
  data: any[],
  filename: string,
  sheetName: string = 'Data',
  company?: any
) => {
  const ws = utils.aoa_to_sheet([[]]);
  if (company) {
    addExcelBranding(ws, filename.replace(/_/g, ' '), company);
    utils.sheet_add_json(ws, data, { origin: 'A6' });
  } else {
    utils.sheet_add_json(ws, data, { origin: 'A1' });
  }
  
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  
  // Add metadata sheet
  const metadata = [
    { Property: 'Export Date', Value: new Date().toISOString() },
    { Property: 'ERP System', Value: 'Metapharsic Enterprise Hub' },
    { Property: 'Version', Value: '2.1.0' },
    { Property: 'Power BI Ready', Value: 'Yes' },
    { Property: 'Data Source', Value: filename }
  ];
  const metaWs = utils.json_to_sheet(metadata);
  utils.book_append_sheet(wb, metaWs, '_Metadata');
  
  writeFile(wb, `${filename}_PowerBI_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Generate Power BI Push Dataset JSON
export const generatePushDataset = (reportType: PowerBIReportType, data: any[]) => {
  const schema = getDatasetSchema(reportType);
  
  return {
    name: schema.name,
    tables: schema.tables.map((table: any) => ({
      name: table.name,
      columns: table.columns,
      rows: data.map(row => table.columns.map((col: any) => row[col.name]))
    }))
  };
};

// Push data to Power BI REST API
export const pushDataToPowerBI = async (
  datasetId: string,
  tableName: string,
  rows: any[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(
      `https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/tables/${tableName}/rows`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${powerBIConfig.embedToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rows })
      }
    );

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (error) {
    return { success: false, error: 'Failed to push data to Power BI' };
  }
};

// Test Power BI connection
export const testPowerBIConnection = async (): Promise<{ success: boolean; message: string }> => {
  if (!powerBIConfig.enabled) {
    return { success: false, message: 'Power BI integration is disabled' };
  }

  if (!powerBIConfig.workspaceId || !powerBIConfig.datasetId) {
    return { success: false, message: 'Workspace ID and Dataset ID are required' };
  }

  try {
    const response = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${powerBIConfig.workspaceId}/datasets`,
      {
        headers: {
          'Authorization': `Bearer ${powerBIConfig.embedToken}`
        }
      }
    );

    if (response.ok) {
      return { success: true, message: 'Successfully connected to Power BI!' };
    } else {
      return { success: false, message: 'Failed to connect. Check your credentials.' };
    }
  } catch (error) {
    return { success: false, message: 'Connection error. Please try again.' };
  }
};

// Get sample Power BI report templates
export const getReportTemplates = () => {
  return [
    {
      id: 'sales-dashboard',
      name: 'Sales Performance Dashboard',
      description: 'Comprehensive sales analytics with trends, targets, and territory performance',
      type: 'sales' as PowerBIReportType,
      icon: '📊'
    },
    {
      id: 'inventory-dashboard',
      name: 'Inventory Intelligence',
      description: 'Stock levels, expiry tracking, and reorder analysis',
      type: 'inventory' as PowerBIReportType,
      icon: '📦'
    },
    {
      id: 'finance-dashboard',
      name: 'Financial Analytics',
      description: 'Revenue, expenses, GST compliance, and profitability',
      type: 'finance' as PowerBIReportType,
      icon: '💰'
    },
    {
      id: 'employee-dashboard',
      name: 'HR & Performance',
      description: 'Employee metrics, sales performance, and compensation',
      type: 'employee' as PowerBIReportType,
      icon: '👥'
    },
    {
      id: 'pcd-dashboard',
      name: 'PCD Network Analysis',
      description: 'Partner performance, territory coverage, and incentive tracking',
      type: 'pcd' as PowerBIReportType,
      icon: '🏢'
    },
    {
      id: 'logistics-dashboard',
      name: 'Logistics & Dispatch',
      description: 'Shipment tracking, transporter performance, and cost analysis',
      type: 'logistics' as PowerBIReportType,
      icon: '🚚'
    },
    {
      id: 'compliance-dashboard',
      name: 'Compliance Monitor',
      description: 'License tracking, expiry alerts, and regulatory status',
      type: 'compliance' as PowerBIReportType,
      icon: '✅'
    },
    {
      id: 'executive-dashboard',
      name: 'Executive Summary',
      description: 'High-level KPIs and business intelligence overview',
      type: 'overall' as PowerBIReportType,
      icon: '📈'
    }
  ];
};

// ==================== ADVANCED FORECASTING & PREDICTIVE ANALYTICS ====================

// Forecasting Models
export interface ForecastResult {
  period: string;
  actual?: number;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  seasonality?: number;
}

// Time Series Forecasting using Moving Average with Trend
export const generateTimeSeriesForecast = (
  historicalData: { period: string; value: number }[],
  periodsToForecast: number = 6,
  confidenceLevel: number = 0.95
): ForecastResult[] => {
  if (historicalData.length < 3) {
    throw new Error('Insufficient data for forecasting (minimum 3 periods required)');
  }

  const values = historicalData.map(d => d.value);
  const n = values.length;
  
  // Calculate trend using linear regression
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  
  // Calculate standard error
  const residuals = values.map((v, i) => v - (slope * i + intercept));
  const mse = residuals.reduce((a, b) => a + b ** 2, 0) / n;
  const stdError = Math.sqrt(mse);
  
  // Generate forecasts
  const forecasts: ForecastResult[] = [];
  const lastDate = new Date(historicalData[n - 1].period);
  
  for (let i = 1; i <= periodsToForecast; i++) {
    const forecastValue = slope * (n + i - 1) + intercept;
    const marginOfError = stdError * 1.96; // 95% confidence
    
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + i);
    
    forecasts.push({
      period: nextDate.toISOString().slice(0, 7), // YYYY-MM
      forecast: Math.max(0, Math.round(forecastValue)),
      lowerBound: Math.max(0, Math.round(forecastValue - marginOfError)),
      upperBound: Math.round(forecastValue + marginOfError),
      confidence: confidenceLevel,
      trend: slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'stable',
      seasonality: calculateSeasonality(values)
    });
  }
  
  return forecasts;
};

// Calculate seasonality index
const calculateSeasonality = (values: number[]): number => {
  if (values.length < 12) return 1;
  
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const last12Avg = values.slice(-12).reduce((a, b) => a + b, 0) / 12;
  
  return avg !== 0 ? last12Avg / avg : 1;
};

// Inventory Demand Forecasting
export const generateInventoryForecast = (
  productHistory: { month: string; sales: number; stock: number }[],
  leadTimeDays: number = 30,
  safetyStockPercent: number = 20
) => {
  const salesValues = productHistory.map(h => h.sales);
  const avgSales = salesValues.reduce((a, b) => a + b, 0) / salesValues.length;
  const maxSales = Math.max(...salesValues);
  
  // Calculate demand variability
  const variance = salesValues.reduce((acc, val) => acc + (val - avgSales) ** 2, 0) / salesValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Forecast next 3 months
  const forecast = generateTimeSeriesForecast(
    productHistory.map(h => ({ period: h.month, value: h.sales })),
    3
  );
  
  // Calculate reorder point
  const dailyDemand = avgSales / 30;
  const reorderPoint = Math.round((dailyDemand * leadTimeDays) + (avgSales * safetyStockPercent / 100));
  
  // Calculate economic order quantity (EOQ)
  const orderingCost = 100; // Fixed cost per order
  const holdingCost = 0.15; // 15% of item cost per year
  const annualDemand = avgSales * 12;
  const eoq = Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost));
  
  return {
    forecast,
    reorderPoint,
    eoq,
    safetyStock: Math.round(avgSales * safetyStockPercent / 100),
    maxStockLevel: Math.round(reorderPoint + eoq),
    avgMonthlyDemand: Math.round(avgSales),
    demandVariability: Math.round(stdDev),
    stockoutRisk: forecast[0].forecast > productHistory[productHistory.length - 1].stock ? 'high' : 'low'
  };
};

// Financial Forecasting
export const generateFinancialForecast = (
  monthlyRevenue: { month: string; revenue: number; expenses: number }[],
  growthRate: number = 0.05
) => {
  const revenues = monthlyRevenue.map(m => m.revenue);
  const expenses = monthlyRevenue.map(m => m.expenses);
  
  const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const avgExpenses = expenses.reduce((a, b) => a + b, 0) / expenses.length;
  const avgProfit = avgRevenue - avgExpenses;
  
  // Generate 12-month forecast
  const forecast: Array<{
    month: string;
    projectedRevenue: number;
    projectedExpenses: number;
    projectedProfit: number;
    cumulativeRevenue: number;
    cumulativeProfit: number;
  }> = [];
  
  let cumRevenue = 0;
  let cumProfit = 0;
  
  const lastDate = new Date(monthlyRevenue[monthlyRevenue.length - 1].month);
  
  for (let i = 1; i <= 12; i++) {
    const growthFactor = Math.pow(1 + growthRate, i / 12);
    const projRevenue = Math.round(avgRevenue * growthFactor);
    const projExpenses = Math.round(avgExpenses * (1 + (growthRate * 0.5))); // Expenses grow slower
    const projProfit = projRevenue - projExpenses;
    
    cumRevenue += projRevenue;
    cumProfit += projProfit;
    
    const nextDate = new Date(lastDate);
    nextDate.setMonth(nextDate.getMonth() + i);
    
    forecast.push({
      month: nextDate.toISOString().slice(0, 7),
      projectedRevenue: projRevenue,
      projectedExpenses: projExpenses,
      projectedProfit: projProfit,
      cumulativeRevenue: cumRevenue,
      cumulativeProfit: cumProfit
    });
  }
  
  // Calculate financial health indicators
  const profitMargin = avgRevenue > 0 ? (avgProfit / avgRevenue) * 100 : 0;
  const revenueGrowth = revenues.length > 1 
    ? ((revenues[revenues.length - 1] - revenues[0]) / revenues[0]) * 100 
    : 0;
  
  return {
    forecast,
    annualProjection: {
      totalRevenue: forecast.reduce((a, b) => a + b.projectedRevenue, 0),
      totalExpenses: forecast.reduce((a, b) => a + b.projectedExpenses, 0),
      totalProfit: forecast.reduce((a, b) => a + b.projectedProfit, 0),
      avgProfitMargin: Math.round(profitMargin * 100) / 100,
      revenueGrowthRate: Math.round(revenueGrowth * 100) / 100
    },
    breakEvenAnalysis: {
      monthlyBreakEven: Math.round(avgExpenses),
      daysToBreakEven: avgRevenue > 0 ? Math.round(avgExpenses / (avgRevenue / 30)) : 0
    }
  };
};

// Sales Territory Forecasting
export const generateTerritoryForecast = (
  territoryData: { territory: string; currentSales: number; target: number; growthHistory: number[] }[]
) => {
  return territoryData.map(t => {
    const avgGrowth = t.growthHistory.reduce((a, b) => a + b, 0) / t.growthHistory.length;
    const growthTrend = avgGrowth > 0 ? 'accelerating' : avgGrowth < 0 ? 'declining' : 'stable';
    
    // Project next quarter
    const q1Projected = Math.round(t.currentSales * (1 + avgGrowth / 100));
    const q2Projected = Math.round(q1Projected * (1 + avgGrowth / 100));
    const q3Projected = Math.round(q2Projected * (1 + avgGrowth / 100));
    const q4Projected = Math.round(q3Projected * (1 + avgGrowth / 100));
    
    const annualProjected = q1Projected + q2Projected + q3Projected + q4Projected;
    const gapToTarget = t.target - annualProjected;
    
    return {
      territory: t.territory,
      currentPerformance: t.currentSales,
      target: t.target,
      projectedAnnual: annualProjected,
      gapToTarget: gapToTarget,
      achievementProbability: annualProjected >= t.target ? 100 : Math.round((annualProjected / t.target) * 100),
      quarterlyForecast: [q1Projected, q2Projected, q3Projected, q4Projected],
      growthTrend,
      recommendedAction: gapToTarget > 0 
        ? `Increase focus by ${Math.round((gapToTarget / t.target) * 100)}% to meet target`
        : 'On track to exceed target'
    };
  });
};

// Predictive Analytics for ERP
export const generatePredictiveInsights = (
  data: {
    sales?: { period: string; value: number }[];
    inventory?: { product: string; stock: number; sales: number }[];
    employees?: { id: string; sales: number; target: number }[];
  }
) => {
  const insights: Array<{
    category: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
    recommendation: string;
    impact: string;
  }> = [];
  
  // Sales predictions
  if (data.sales && data.sales.length >= 6) {
    const recentSales = data.sales.slice(-6).map(s => s.value);
    const avgRecent = recentSales.reduce((a, b) => a + b, 0) / recentSales.length;
    const previousSales = data.sales.slice(-12, -6).map(s => s.value);
    const avgPrevious = previousSales.reduce((a, b) => a + b, 0) / previousSales.length;
    
    const trend = ((avgRecent - avgPrevious) / avgPrevious) * 100;
    
    if (trend < -10) {
      insights.push({
        category: 'Sales',
        severity: 'critical',
        title: 'Sales Declining',
        description: `Sales have dropped by ${Math.abs(trend).toFixed(1)}% compared to previous period`,
        recommendation: 'Review pricing strategy and increase marketing efforts',
        impact: 'High - Revenue at risk'
      });
    } else if (trend > 20) {
      insights.push({
        category: 'Sales',
        severity: 'info',
        title: 'Strong Growth',
        description: `Sales increased by ${trend.toFixed(1)}% compared to previous period`,
        recommendation: 'Ensure inventory can meet increased demand',
        impact: 'Positive - Consider expansion'
      });
    }
  }
  
  // Inventory predictions
  if (data.inventory) {
    const lowStock = data.inventory.filter(i => i.stock < i.sales * 0.5);
    if (lowStock.length > 0) {
      insights.push({
        category: 'Inventory',
        severity: 'warning',
        title: 'Low Stock Alert',
        description: `${lowStock.length} products below safety stock levels`,
        recommendation: 'Place urgent purchase orders for affected products',
        impact: 'Medium - Stockout risk'
      });
    }
    
    const slowMoving = data.inventory.filter(i => i.sales === 0 && i.stock > 100);
    if (slowMoving.length > 0) {
      insights.push({
        category: 'Inventory',
        severity: 'info',
        title: 'Slow Moving Stock',
        description: `${slowMoving.length} products with no sales but high stock`,
        recommendation: 'Consider promotional discounts or returns to suppliers',
        impact: 'Low - Working capital tied up'
      });
    }
  }
  
  // Employee performance predictions
  if (data.employees) {
    const underperformers = data.employees.filter(e => e.sales < e.target * 0.7);
    if (underperformers.length > 0) {
      insights.push({
        category: 'HR',
        severity: 'warning',
        title: 'Performance Gap',
        description: `${underperformers.length} employees below 70% of target`,
        recommendation: 'Schedule performance reviews and provide additional training',
        impact: 'Medium - Sales target risk'
      });
    }
  }
  
  return insights;
};

// Export Forecast to Power BI
export const exportForecastToPowerBI = (
  forecastData: ForecastResult[],
  filename: string,
  historicalData?: { period: string; value: number }[],
  company?: any
) => {
  // Combine historical and forecast data
  const combinedData = [
    ...(historicalData || []).map(h => ({
      Period: h.period,
      Type: 'Historical',
      Value: h.value,
      Forecast: null,
      LowerBound: null,
      UpperBound: null,
      Confidence: null
    })),
    ...forecastData.map(f => ({
      Period: f.period,
      Type: 'Forecast',
      Value: null,
      Forecast: f.forecast,
      LowerBound: f.lowerBound,
      UpperBound: f.upperBound,
      Confidence: f.confidence
    }))
  ];
  
  const ws = utils.aoa_to_sheet([[]]);
  if (company) {
    addExcelBranding(ws, filename.replace(/_/g, ' '), company);
    utils.sheet_add_json(ws, combinedData, { origin: 'A6' });
  } else {
    utils.sheet_add_json(ws, combinedData, { origin: 'A1' });
  }
  
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Forecast');
  
  // Add forecast parameters sheet
  const params = [
    { Parameter: 'Generated At', Value: new Date().toISOString() },
    { Parameter: 'Model', Value: 'Time Series with Linear Trend' },
    { Parameter: 'Confidence Level', Value: '95%' },
    { Parameter: 'Forecast Periods', Value: forecastData.length.toString() },
    { Parameter: 'System', Value: 'Metapharsic ERP Forecasting Engine' }
  ];
  const paramWs = utils.json_to_sheet(params);
  utils.book_append_sheet(wb, paramWs, '_ForecastParams');
  
  writeFile(wb, `${filename}_Forecast_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// Get Forecasting Report Templates
export const getForecastingTemplates = () => {
  return [
    {
      id: 'sales-forecast',
      name: 'Sales Forecasting',
      description: 'Predict future sales with trend analysis and seasonality',
      type: 'forecasting',
      icon: '📈',
      models: ['Time Series', 'Moving Average', 'Trend Analysis']
    },
    {
      id: 'inventory-forecast',
      name: 'Inventory Demand Planning',
      description: 'Optimize stock levels with demand forecasting and reorder points',
      type: 'forecasting',
      icon: '📦',
      models: ['Demand Forecasting', 'EOQ', 'Safety Stock']
    },
    {
      id: 'financial-forecast',
      name: 'Financial Projections',
      description: 'Revenue, expense and profit forecasting with break-even analysis',
      type: 'forecasting',
      icon: '💰',
      models: ['Revenue Projection', 'Cash Flow', 'Break-even']
    },
    {
      id: 'territory-forecast',
      name: 'Territory Performance',
      description: 'Sales territory projections and achievement probability',
      type: 'forecasting',
      icon: '🗺️',
      models: ['Growth Projection', 'Target Gap', 'Probability']
    },
    {
      id: 'predictive-insights',
      name: 'Predictive Insights',
      description: 'AI-powered insights and recommendations for business optimization',
      type: 'predictive',
      icon: '🤖',
      models: ['Anomaly Detection', 'Trend Analysis', 'Recommendations']
    }
  ];
};

export default {
  savePowerBIConfig,
  getPowerBIConfig,
  getDatasetSchema,
  getPowerBIEmbedUrl,
  exportToPowerBIExcel,
  generatePushDataset,
  pushDataToPowerBI,
  testPowerBIConnection,
  getReportTemplates,
  // Forecasting exports
  generateTimeSeriesForecast,
  generateInventoryForecast,
  generateFinancialForecast,
  generateTerritoryForecast,
  generatePredictiveInsights,
  exportForecastToPowerBI,
  getForecastingTemplates
};
