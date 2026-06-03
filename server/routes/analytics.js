const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware, verify2FAMiddleware } = require('../utils/jwt');

/**
 * GET /api/analytics/inventory/comprehensive
 * High-performance inventory intelligence engine
 */
router.get('/inventory/comprehensive', verifyTokenMiddleware, verify2FAMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 1. Fetch products with batch summary
    const productsResult = await db.query(`
      SELECT 
        p.id, p.name, p.code, p.min_stock_level as "minStockLevel", p.reorder_level as "reorderLevel",
        p.schedule_type as "scheduleType", p.category,
        COALESCE(SUM(b.stock), 0) as "totalStock",
        COALESCE(SUM(b.stock * b.mrp), 0) as "stockValue"
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id
    `);

    const products = productsResult.rows;

    // 2. Optimized sales velocity (last 90 days)
    const salesResult = await db.query(`
      SELECT 
        sii.product_id, 
        COUNT(*) as "transactionCount",
        SUM(sii.quantity) as "totalUnitsSold"
      FROM sales_invoice_items sii
      JOIN sales_invoices si ON si.id = sii.invoice_id
      WHERE si.created_at > NOW() - INTERVAL '90 days'
      GROUP BY sii.product_id
    `);

    // FIX: velocity = units sold per day over 90-day window.
    // Previously used transactionCount / 3 (transaction frequency per month)
    // which is dimensionally wrong — FSN thresholds expect units/day.
    const salesMap = {};
    salesResult.rows.forEach(row => {
      const unitsSold = parseFloat(row.totalUnitsSold) || 0;
      salesMap[row.product_id] = {
        velocity: unitsSold / 90,          // units per day over 90-day window
        unitsSold,
      };
    });

    // 3. Expiry Analysis
    const expiryResult = await db.query(`
      SELECT 
        product_id,
        COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) as "expiredCount",
        COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '180 days') as "nearExpiryCount"
      FROM batches
      WHERE available_qty > 0
      GROUP BY product_id
    `);

    const expiryMap = {};
    expiryResult.rows.forEach(row => {
      expiryMap[row.product_id] = {
        expired: parseInt(row.expiredCount) > 0,
        nearExpiry: parseInt(row.nearExpiryCount) > 0
      };
    });

    // 4. Intelligence Processing
    const items = products.map(p => {
      const sales = salesMap[p.id] || { velocity: 0, unitsSold: 0 };
      const exp = expiryMap[p.id] || { expired: false, nearExpiry: false };
      
      let fsn = 'N';
      if (sales.velocity > 5) fsn = 'F';
      else if (sales.velocity > 0) fsn = 'S';

      let ved = 'D';
      if (p.scheduleType === 'H1' || p.category === 'CRITICAL_CARE') ved = 'V';
      else if (p.scheduleType === 'H' || p.category === 'ESSENTIAL') ved = 'E';

      return {
        productId: p.id,
        name: p.name,
        code: p.code,
        totalStock: parseFloat(p.totalStock),
        stockValue: parseFloat(p.stockValue),
        velocity: sales.velocity,
        status: parseFloat(p.totalStock) < parseFloat(p.minStockLevel) ? 'Critical' : 'Healthy',
        fsn, ved, expired: exp.expired, nearExpiry: exp.nearExpiry,
        abc: 'C'
      };
    });

    // ABC Calculation
    items.sort((a, b) => b.stockValue - a.stockValue);
    const totalValue = items.reduce((acc, curr) => acc + curr.stockValue, 0);
    let runningValue = 0;

    items.forEach(item => {
      runningValue += item.stockValue;
      const cumulativePercent = totalValue > 0 ? (runningValue / totalValue) * 100 : 100;
      if (cumulativePercent <= 80) item.abc = 'A';
      else if (cumulativePercent <= 95) item.abc = 'B';
      else item.abc = 'C';
    });

    const expiredItems = items.filter(i => i.expired);
    const nearExpiryItems = items.filter(i => i.nearExpiry && !i.expired);
    const deadStock = items.filter(i => i.fsn === 'N' && i.totalStock > 0);

    res.json({
      success: true,
      data: {
        abcAnalysis: {
          categoryA: items.filter(i => i.abc === 'A'),
          categoryB: items.filter(i => i.abc === 'B'),
          categoryC: items.filter(i => i.abc === 'C'),
          summary: {
            countA: items.filter(i => i.abc === 'A').length,
            valueA: items.filter(i => i.abc === 'A').reduce((s, i) => s + i.stockValue, 0),
            countB: items.filter(i => i.abc === 'B').length,
            valueB: items.filter(i => i.abc === 'B').reduce((s, i) => s + i.stockValue, 0),
            countC: items.filter(i => i.abc === 'C').length,
            valueC: items.filter(i => i.abc === 'C').reduce((s, i) => s + i.stockValue, 0),
          }
        },
        fsnAnalysis: {
          fast: items.filter(i => i.fsn === 'F'),
          slow: items.filter(i => i.fsn === 'S'),
          nonMoving: items.filter(i => i.fsn === 'N'),
        },
        vedAnalysis: {
          vital: items.filter(i => i.ved === 'V'),
          essential: items.filter(i => i.ved === 'E'),
          desirable: items.filter(i => i.ved === 'D'),
        },
        expiryLifecycle: {
          expired: expiredItems,
          nearExpiry: nearExpiryItems,
        },
        deadStock,
        metadata: {
          processingTimeMs: Date.now() - startTime,
          totalValue,
          totalProducts: items.length,
          expiredCount: expiredItems.length,
          nearExpiryCount: nearExpiryItems.length,
          deadStockCount: deadStock.length
        }
      }
    });
  } catch (error) {
    logger.error('Inventory Intelligence Engine Failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/financial/summary
 * Intelligence V4 Optimized: Predictive Cash Flow
 */
router.get('/financial/summary', verifyTokenMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    console.log(`[Analytics] Financial summary requested by User: ${req.user.userId}`);
    
    const coaResult = await db.query(`
      SELECT account_type, SUM(opening_balance) as balance 
      FROM chart_of_accounts 
      GROUP BY account_type
    `);
    
    const trendResult = await db.query(`
      WITH monthly_sales AS (
        SELECT 
          TO_CHAR(date, 'Mon YYYY') as month,
          TO_CHAR(date, 'YYYYMM') as month_sort,
          SUM(net_amount) as revenue
        FROM sales_invoices
        WHERE date::TIMESTAMP > NOW() - INTERVAL '24 months'
        GROUP BY month, month_sort
      ),
      monthly_expenses AS (
        SELECT 
          TO_CHAR(date, 'Mon YYYY') as month,
          SUM(amount) as expenses
        FROM expenses
        WHERE date::TIMESTAMP > NOW() - INTERVAL '24 months'
        GROUP BY month
      )
      SELECT 
        s.month,
        s.revenue,
        COALESCE(e.expenses, 0) as expenses,
        (s.revenue - COALESCE(e.expenses, 0)) as monthly_net
      FROM monthly_sales s
      LEFT JOIN monthly_expenses e ON s.month = e.month
      ORDER BY s.month_sort
    `);

    const last3Months = trendResult.rows.length > 0 ? trendResult.rows.slice(-3) : [];
    const avgMonthlyBurn = last3Months.length > 0 
      ? last3Months.reduce((s, r) => s + parseFloat(r.expenses || 0), 0) / last3Months.length 
      : 0;
    const avgMonthlyInflow = last3Months.length > 0 
      ? last3Months.reduce((s, r) => s + parseFloat(r.revenue || 0), 0) / last3Months.length 
      : 0;
    
    const coaMap = { 'Asset': 0, 'Liability': 0, 'Equity': 0, 'Income': 0, 'Expense': 0 };
    coaResult.rows.forEach(r => coaMap[r.account_type] = parseFloat(r.balance || 0));

    const currentCash = coaMap['Asset'] || 0; 
    const predicted30DayCash = currentCash + avgMonthlyInflow - avgMonthlyBurn;

    res.json({
      success: true,
      data: {
        kpis: {
          currentRatio: coaMap['Liability'] > 0 ? (coaMap['Asset'] / coaMap['Liability']).toFixed(2) : '∞',
          netProfitMargin: avgMonthlyInflow > 0 ? (((avgMonthlyInflow - avgMonthlyBurn) / avgMonthlyInflow) * 100).toFixed(1) + '%' : '0%',
          workingCapital: (coaMap['Asset'] || 0) - (coaMap['Liability'] || 0),
          burnRate: avgMonthlyBurn.toFixed(2),
          forecastedCash30d: predicted30DayCash.toFixed(2)
        },
        trends: trendResult.rows,
        intelligence: {
          status: predicted30DayCash < 0 ? 'LIQUIDITY_RISK' : 'HEALTHY',
          recommendation: predicted30DayCash < currentCash * 0.8 ? 'Improve collection velocity' : 'Stable'
        },
        metadata: { processingTimeMs: Date.now() - startTime }
      }
    });
  } catch (error) {
    logger.error('Financial Intelligence Engine Failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/customers/drift
 * Intelligence V4: Detects "Drifting" customers
 */
router.get('/customers/drift', verifyTokenMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    const driftResult = await db.query(`
      WITH customer_stats AS (
        SELECT 
          p.id, p.name,
          COALESCE(SUM(si.net_amount) FILTER (WHERE si.date > NOW() - INTERVAL '90 days'), 0) as recent_volume,
          COALESCE(SUM(si.net_amount) FILTER (WHERE si.date BETWEEN NOW() - INTERVAL '180 days' AND NOW() - INTERVAL '90 days'), 0) as previous_volume
        FROM parties p
        LEFT JOIN sales_invoices si ON si.party_id = p.id
        WHERE p.type = 'Customer'
        GROUP BY p.id, p.name
      )
      SELECT 
        *,
        CASE 
          WHEN previous_volume > 0 AND recent_volume = 0 THEN 'LOST'
          WHEN previous_volume > 0 AND (recent_volume / previous_volume) < 0.5 THEN 'DRIFTING'
          WHEN recent_volume > previous_volume THEN 'GROWING'
          ELSE 'STABLE'
        END as drift_status
      FROM customer_stats
      WHERE previous_volume > 0 OR recent_volume > 0
      ORDER BY recent_volume ASC
    `);

    res.json({
      success: true,
      data: {
        driftingCount: driftResult.rows.filter(r => r.drift_status === 'DRIFTING').length,
        lostCount: driftResult.rows.filter(r => r.drift_status === 'LOST').length,
        growingCount: driftResult.rows.filter(r => r.drift_status === 'GROWING').length,
        atRisk: driftResult.rows.filter(r => r.drift_status === 'DRIFTING' || r.drift_status === 'LOST').slice(0, 5)
      },
      metadata: { processingTimeMs: Date.now() - startTime }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/inventory/optimize
 * PERFORMANCE REFACTORED: Single-pass optimization engine
 */
router.post('/inventory/optimize', verifyTokenMiddleware, async (req, res) => {
  try {
    const startTime = Date.now();
    // FIX: monthly_demand was SUM(quantity) / 3.0 (3 months of transaction count).
    // Corrected to SUM(quantity) / 3.0 where SUM(quantity) is units sold, not transaction count.
    // Consistent with the GET /comprehensive velocity fix (totalUnitsSold / 90 = daily rate;
    // × 30 = monthly rate). We compute monthly_demand = totalUnitsSold / 90 * 30 = / 3.
    await db.query(`
      WITH velocity_calc AS (
        SELECT
          p.id,
          COALESCE(SUM(sii.quantity), 0) / 3.0 AS monthly_demand
        FROM products p
        LEFT JOIN sales_invoice_items sii ON sii.product_id = p.id
        LEFT JOIN sales_invoices si
          ON si.id = sii.invoice_id
          AND si.created_at > NOW() - INTERVAL '90 days'
        WHERE p.deleted_at IS NULL
        GROUP BY p.id
      )
      UPDATE products p
      SET
        min_stock_level = CASE
          WHEN v.monthly_demand > 0 THEN GREATEST(20, CEIL(v.monthly_demand * 0.5))
          ELSE 10
        END,
        reorder_level = CASE
          WHEN v.monthly_demand > 0 THEN GREATEST(50, CEIL(v.monthly_demand * 1.5))
          ELSE 25
        END,
        is_fast_moving = (v.monthly_demand > 50),
        updated_at = NOW()
      FROM velocity_calc v
      WHERE p.id = v.id
    `);

    res.json({ success: true, processingTime: Date.now() - startTime });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Background Reports
const { addReportJob, reportQueue } = require('../services/queueService');
router.post('/reports/generate', verifyTokenMiddleware, async (req, res) => {
  try {
    const { type, params } = req.body;
    const reportId = `RPT-${Date.now()}`;
    const job = await addReportJob({ reportId, type, params, userId: req.user.userId });
    res.json({ success: true, jobId: job.id, reportId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/status/:jobId', verifyTokenMiddleware, async (req, res) => {
  try {
    const job = await reportQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const state = await job.getState();
    res.json({ success: true, data: { id: req.params.jobId, state, progress: job.progress(), result: job.returnvalue } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
