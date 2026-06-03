import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePowerBIConfig,
  getPowerBIConfig,
  getDatasetSchema,
  generateTimeSeriesForecast,
  generateInventoryForecast,
  generateFinancialForecast,
  getReportTemplates,
  getForecastingTemplates
} from '../powerBIService';

describe('PowerBI Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Configuration', () => {
    it('should save and retrieve Power BI config', () => {
      const config = {
        workspaceId: 'test-workspace-123',
        datasetId: 'test-dataset-456',
        reportId: 'test-report-789',
        embedToken: 'test-token',
        enabled: true
      };
      
      savePowerBIConfig(config);
      const retrieved = getPowerBIConfig();
      
      expect(retrieved.workspaceId).toBe(config.workspaceId);
      expect(retrieved.datasetId).toBe(config.datasetId);
      expect(retrieved.enabled).toBe(true);
    });

    it('should update partial config', () => {
      savePowerBIConfig({ workspaceId: 'initial' });
      savePowerBIConfig({ enabled: true });
      
      const config = getPowerBIConfig();
      expect(config.workspaceId).toBe('initial');
      expect(config.enabled).toBe(true);
    });
  });

  describe('Dataset Schemas', () => {
    it('should return sales dataset schema', () => {
      const schema = getDatasetSchema('sales');
      expect(schema.name).toBe('Sales Analytics Dataset');
      expect(schema.tables).toHaveLength(2);
      expect(schema.tables[0].name).toBe('Sales');
    });

    it('should return inventory dataset schema', () => {
      const schema = getDatasetSchema('inventory');
      expect(schema.name).toBe('Inventory Analytics Dataset');
      expect(schema.tables[0].columns).toContainEqual(
        expect.objectContaining({ name: 'CurrentStock', dataType: 'int64' })
      );
    });

    it('should return employee dataset schema', () => {
      const schema = getDatasetSchema('employee');
      expect(schema.name).toBe('Employee Performance Dataset');
      expect(schema.tables[0].columns).toContainEqual(
        expect.objectContaining({ name: 'BaseSalary', dataType: 'double' })
      );
    });
  });

  describe('Time Series Forecasting', () => {
    it('should generate forecast with trend', () => {
      const historicalData = [
        { period: '2024-01', value: 100 },
        { period: '2024-02', value: 110 },
        { period: '2024-03', value: 120 },
        { period: '2024-04', value: 130 },
        { period: '2024-05', value: 140 },
        { period: '2024-06', value: 150 }
      ];
      
      const forecast = generateTimeSeriesForecast(historicalData, 3);
      
      expect(forecast).toHaveLength(3);
      expect(forecast[0]).toHaveProperty('period');
      expect(forecast[0]).toHaveProperty('forecast');
      expect(forecast[0]).toHaveProperty('lowerBound');
      expect(forecast[0]).toHaveProperty('upperBound');
      expect(forecast[0]).toHaveProperty('confidence');
      expect(forecast[0]).toHaveProperty('trend');
      
      // With upward trend, forecast should be higher than last value
      expect(forecast[0].forecast).toBeGreaterThan(150);
    });

    it('should throw error for insufficient data', () => {
      const insufficientData = [
        { period: '2024-01', value: 100 },
        { period: '2024-02', value: 110 }
      ];
      
      expect(() => generateTimeSeriesForecast(insufficientData, 3)).toThrow();
    });
  });

  describe('Inventory Forecasting', () => {
    it('should calculate reorder point and EOQ', () => {
      const productHistory = [
        { month: '2024-06', sales: 100, stock: 200 },
        { month: '2024-07', sales: 120, stock: 180 },
        { month: '2024-08', sales: 110, stock: 170 },
        { month: '2024-09', sales: 130, stock: 140 },
        { month: '2024-10', sales: 125, stock: 115 },
        { month: '2024-11', sales: 140, stock: 75 }
      ];
      
      const result = generateInventoryForecast(productHistory, 30, 20);
      
      expect(result).toHaveProperty('reorderPoint');
      expect(result).toHaveProperty('eoq');
      expect(result).toHaveProperty('safetyStock');
      expect(result).toHaveProperty('maxStockLevel');
      expect(result).toHaveProperty('stockoutRisk');
      expect(result).toHaveProperty('forecast');
      
      expect(result.reorderPoint).toBeGreaterThan(0);
      expect(result.eoq).toBeGreaterThan(0);
      expect(result.safetyStock).toBeGreaterThan(0);
    });
  });

  describe('Financial Forecasting', () => {
    it('should project annual revenue and expenses', () => {
      const monthlyData = [
        { month: '2024-06', revenue: 500000, expenses: 350000 },
        { month: '2024-07', revenue: 520000, expenses: 360000 },
        { month: '2024-08', revenue: 550000, expenses: 370000 },
        { month: '2024-09', revenue: 530000, expenses: 355000 },
        { month: '2024-10', revenue: 580000, expenses: 380000 },
        { month: '2024-11', revenue: 600000, expenses: 390000 }
      ];
      
      const result = generateFinancialForecast(monthlyData, 0.05);
      
      expect(result.forecast).toHaveLength(12);
      expect(result).toHaveProperty('annualProjection');
      expect(result).toHaveProperty('breakEvenAnalysis');
      
      expect(result.annualProjection.totalRevenue).toBeGreaterThan(0);
      expect(result.annualProjection.totalExpenses).toBeGreaterThan(0);
      expect(result.annualProjection.totalProfit).toBeDefined();
      expect(result.annualProjection.avgProfitMargin).toBeDefined();
    });
  });

  describe('Report Templates', () => {
    it('should return 8 standard report templates', () => {
      const templates = getReportTemplates();
      expect(templates).toHaveLength(8);
      expect(templates.map(t => t.id)).toContain('sales-dashboard');
      expect(templates.map(t => t.id)).toContain('inventory-dashboard');
      expect(templates.map(t => t.id)).toContain('employee-dashboard');
    });

    it('should return 5 forecasting templates', () => {
      const templates = getForecastingTemplates();
      expect(templates).toHaveLength(5);
      expect(templates.map(t => t.id)).toContain('sales-forecast');
      expect(templates.map(t => t.id)).toContain('inventory-forecast');
      expect(templates.map(t => t.id)).toContain('predictive-insights');
    });
  });
});
