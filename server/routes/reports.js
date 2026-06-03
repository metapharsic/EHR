const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { verifyTokenMiddleware } = require('../utils/jwt');

const toNumber = (value) => Number(value || 0);

/**
 * GET /api/reports/dashboard-summary
 * Unified dashboard summary with live database totals
 */
router.get('/dashboard-summary', verifyTokenMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const companyId = req.user.companyId || req.user.company_id || 1;

    const [
      accountsResult,
      inventoryResult,
      pcdResult,
      crmResult,
      salesResult,
      dmsResult
    ] = await Promise.all([
      db.query(
        `
          WITH ledger_totals AS (
            SELECT
              account_id,
              COALESCE(SUM(debit), 0) AS total_debit,
              COALESCE(SUM(credit), 0) AS total_credit
            FROM general_ledger
            GROUP BY account_id
          ),
          balances AS (
            SELECT
              coa.account_type,
              coa.account_name,
              COALESCE(coa.opening_balance, 0) AS opening_balance,
              COALESCE(lt.total_debit, 0) AS total_debit,
              COALESCE(lt.total_credit, 0) AS total_credit,
              CASE
                WHEN coa.account_type IN ('Asset', 'Expense')
                  THEN COALESCE(coa.opening_balance, 0) + COALESCE(lt.total_debit, 0) - COALESCE(lt.total_credit, 0)
                ELSE COALESCE(coa.opening_balance, 0) + COALESCE(lt.total_credit, 0) - COALESCE(lt.total_debit, 0)
              END AS closing_balance
            FROM chart_of_accounts coa
            LEFT JOIN ledger_totals lt ON lt.account_id = coa.id
            WHERE coa.company_id = $1
          )
          SELECT
            COUNT(*)::int AS total_accounts,
            COUNT(*) FILTER (WHERE account_type = 'Asset')::int AS asset_accounts,
            COUNT(*) FILTER (WHERE account_type = 'Liability')::int AS liability_accounts,
            COUNT(*) FILTER (WHERE account_type = 'Income')::int AS income_accounts,
            COUNT(*) FILTER (WHERE account_type = 'Expense')::int AS expense_accounts,
            COALESCE(SUM(CASE WHEN account_type = 'Asset' THEN closing_balance ELSE 0 END), 0) AS total_assets, 
            COALESCE(SUM(CASE WHEN account_type = 'Liability' THEN closing_balance ELSE 0 END), 0) AS total_liabilities,
            COALESCE(SUM(CASE WHEN account_type = 'Income' THEN closing_balance ELSE 0 END), 0) AS total_income,
            COALESCE(SUM(CASE WHEN account_type = 'Expense' THEN closing_balance ELSE 0 END), 0) AS total_expense
          FROM balances
        `,
        [companyId]
      ),
      db.query(
        `
          SELECT
            COUNT(*)::int AS total_products,
            COALESCE(SUM(current_stock), 0) AS total_units,
            COALESCE(SUM(current_stock * COALESCE(mrp, 0)), 0) AS total_stock_value,
            COUNT(*) FILTER (WHERE current_stock <= COALESCE(reorder_level, 0))::int AS low_stock_products      
          FROM products
          WHERE deleted_at IS NULL AND COALESCE(is_active, true) = true
        `
      ),
      db.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE p.status = 'Active' OR p.status = 'ACTIVE')::int AS active_partners,
            COUNT(*)::int AS total_partners,
            COUNT(DISTINCT p.territory)::int AS total_territories,
            COALESCE(SUM(CASE WHEN t.order_status = 'Verified' OR t.order_status = 'VERIFIED' THEN t.amount ELSE 0 END), 0) AS verified_sales, 
            COUNT(*) FILTER (WHERE t.order_status = 'Verified' OR t.order_status = 'VERIFIED')::int AS verified_transactions
          FROM pcd_partners p
          LEFT JOIN pcd_transactions t
            ON t.partner_id = p.id AND t.company_id = p.company_id
          WHERE p.company_id = $1
        `,
        [companyId]
      ),
      db.query(
        `
          SELECT
            COUNT(*)::int AS total_leads,
            COUNT(*) FILTER (WHERE status = 'New')::int AS new_leads,
            COUNT(*) FILTER (WHERE status = 'Converted')::int AS converted_leads,
            COUNT(*) FILTER (WHERE priority = 'High' OR priority = 'Urgent')::int AS high_priority_leads        
          FROM leads
        `
      ),
      db.query(
        `
          SELECT
            COUNT(*)::int AS total_invoices,
            COUNT(*)::int AS wholesale_invoices, -- placeholder as invoice_type is missing
            COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN COALESCE(net_payable, net_amount, 0) ELSE 0 END), 0) AS today_sales,
            COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE)::date THEN COALESCE(net_payable, net_amount, 0) ELSE 0 END), 0) AS month_sales
          FROM sales_invoices
          WHERE COALESCE(company_id, $1) = $1
        `,
        [companyId]
      ),
      db.query(
        `
          SELECT
            COUNT(*)::int AS total_documents,
            COUNT(*) FILTER (WHERE status = 'Active')::int AS active_documents,
            COUNT(*) FILTER (
              WHERE status = 'Expiring'
                 OR (expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days')
            )::int AS expiring_documents,
            COUNT(*) FILTER (WHERE status = 'Draft')::int AS draft_documents
          FROM dms_documents
        `
      )
    ]);

    const accounts = accountsResult.rows[0] || {};
    const inventory = inventoryResult.rows[0] || {};
    const pcd = pcdResult.rows[0] || {};
    const crm = crmResult.rows[0] || {};
    const sales = salesResult.rows[0] || {};
    const dms = dmsResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        accounts: {
          totalAccounts: Number(accounts.total_accounts || 0),
          assetAccounts: Number(accounts.asset_accounts || 0),
          liabilityAccounts: Number(accounts.liability_accounts || 0),
          incomeAccounts: Number(accounts.income_accounts || 0),
          expenseAccounts: Number(accounts.expense_accounts || 0),
          totalAssets: toNumber(accounts.total_assets),
          totalLiabilities: toNumber(accounts.total_liabilities),
          totalIncome: toNumber(accounts.total_income),
          totalExpense: toNumber(accounts.total_expense),
          workingCapital: toNumber(accounts.total_assets) - toNumber(accounts.total_liabilities),
          netProfit: toNumber(accounts.total_income) - toNumber(accounts.total_expense)
        },
        inventory: {
          totalProducts: Number(inventory.total_products || 0),
          totalUnits: toNumber(inventory.total_units),
          totalStockValue: toNumber(inventory.total_stock_value),
          lowStockProducts: Number(inventory.low_stock_products || 0)
        },
        pcd: {
          activePartners: Number(pcd.active_partners || 0),
          totalPartners: Number(pcd.total_partners || 0),
          totalTerritories: Number(pcd.total_territories || 0),
          verifiedSales: toNumber(pcd.verified_sales),
          verifiedTransactions: Number(pcd.verified_transactions || 0)
        },
        crm: {
          totalLeads: Number(crm.total_leads || 0),
          newLeads: Number(crm.new_leads || 0),
          convertedLeads: Number(crm.converted_leads || 0),
          highPriorityLeads: Number(crm.high_priority_leads || 0)
        },
        sales: {
          totalInvoices: Number(sales.total_invoices || 0),
          wholesaleInvoices: Number(sales.wholesale_invoices || 0),
          todaySales: toNumber(sales.today_sales),
          monthSales: toNumber(sales.month_sales)
        },
        dms: {
          totalDocuments: Number(dms.total_documents || 0),
          activeDocuments: Number(dms.active_documents || 0),
          expiringDocuments: Number(dms.expiring_documents || 0),
          draftDocuments: Number(dms.draft_documents || 0)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to fetch unified dashboard summary', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/inventory
 * Dashboard summary for inventory
 */
router.get('/inventory', verifyTokenMiddleware, async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT
        COALESCE(SUM(current_stock * mrp), 0) as "totalStockValue",
        COALESCE(COUNT(*) FILTER (WHERE current_stock <= reorder_level), 0) as "lowStockProducts",
        COALESCE(COUNT(*), 0) as "totalProducts"
      FROM products
      WHERE deleted_at IS NULL AND is_active = true
    `);

    // Get some sample products for the AI assistant context if needed
    const productsResult = await db.query(`
      SELECT name, current_stock, mrp
      FROM products
      WHERE deleted_at IS NULL AND is_active = true
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        totalStockValue: parseFloat(statsResult.rows[0].totalStockValue),
        lowStockProducts: parseInt(statsResult.rows[0].lowStockProducts),
        totalProducts: parseInt(statsResult.rows[0].totalProducts),
        products: productsResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to fetch inventory reports', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/sales
 * Dashboard summary for sales
 */
router.get('/sales', verifyTokenMiddleware, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const statsResult = await db.query(`
      SELECT
        COALESCE(SUM(net_amount), 0) as "totalSales",
        COUNT(*) as "invoiceCount"
      FROM sales_invoices
      WHERE date = CURRENT_DATE
    `);

    const invoicesResult = await db.query(`
      SELECT id, invoice_number, customer_name, net_amount, status, date
      FROM sales_invoices
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      data: {
        totalSales: parseFloat(statsResult.rows[0].totalSales),
        invoiceCount: parseInt(statsResult.rows[0].invoiceCount),
        invoices: invoicesResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to fetch sales reports', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/purchase
 * Dashboard summary for purchases
 */
router.get('/purchase', verifyTokenMiddleware, async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const statsResult = await db.query(`
      SELECT
        COALESCE(SUM(poi.quantity * poi.purchase_rate), 0) as "totalPurchases",
        COALESCE(COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'Pending'), 0) as "pendingOrders"
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
      WHERE po.created_at >= CURRENT_DATE
    `);

    const recentPurchasesResult = await db.query(`
      SELECT
        po.id,
        po.invoice_no,
        s.name as supplier_name,
        COALESCE(SUM(poi.quantity * poi.purchase_rate), 0) as total_amount,
        po.status,
        po.order_date as date
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
      GROUP BY po.id, s.name
      ORDER BY po.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      data: {
        totalPurchases: parseFloat(statsResult.rows[0].totalPurchases),
        pendingOrders: parseInt(statsResult.rows[0].pendingOrders),
        purchases: recentPurchasesResult.rows
      }
    });
  } catch (error) {
    logger.error('Failed to fetch purchase reports', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/reports/kpi
 * Phase 3 Executive KPIs
 */
router.get('/kpi', verifyTokenMiddleware, async (req, res) => {
  try {
    // Fixed: Removed non-existent columns inventory_turnover_ratio and days_inventory_outstanding
    // These will be calculated dynamically in future Phase 3 updates
    const deadStockResult = await db.query(`
      SELECT
        COALESCE(COUNT(*), 0) as "deadStockCount",
        COALESCE(SUM(current_stock * mrp), 0) as "deadStockValue"
      FROM products
      WHERE (current_stock > 0 AND updated_at < CURRENT_DATE - INTERVAL '90 days')
    `);

    res.json({
      success: true,
      data: {
        turnoverRatio: 4.2, // Target/Calculated Placeholder
        dio: 45,            // Target/Calculated Placeholder
        deadStockPercentage: 12.5,
        serviceLevel: 98.5,
        deadStockValue: parseFloat(deadStockResult.rows[0].deadStockValue)
      }
    });
  } catch (error) {
    logger.error('Failed to fetch KPI reports', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AI ERA: NATURAL LANGUAGE REPORTING
// ============================================

router.post('/ai-generate', verifyTokenMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    const companyId = req.user.companyId || req.user.company_id || 1;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    // Simulate AI processing of natural language to chart data
    logger.info(`AI Report Request: "${query}"`);

    let chartData = [];
    let title = "Custom Report";
    let summary = "AI generated summary based on request.";

    const lowercaseQuery = query.toLowerCase();

    if (lowercaseQuery.includes("revenue") || lowercaseQuery.includes("sales")) {
      title = "Revenue Forecast (AI Generated)";
      summary = "Predicted upward trend based on recent Q2 conversions and seasonal cardiac drive.";
      chartData = [
        { name: 'Jan', value: 400000 },
        { name: 'Feb', value: 450000 },
        { name: 'Mar', value: 500000 },
        { name: 'Apr', value: 650000 },
        { name: 'May', value: 720000 },
        { name: 'Jun (Est)', value: 850000 }
      ];
    } else if (lowercaseQuery.includes("expense") || lowercaseQuery.includes("cost")) {
      title = "Expense Analysis (AI Generated)";
      summary = "Operational costs have spiked due to recent marketing campaigns.";
      chartData = [
        { name: 'Jan', value: 200000 },
        { name: 'Feb', value: 210000 },
        { name: 'Mar', value: 300000 },
        { name: 'Apr', value: 280000 },
        { name: 'May', value: 310000 },
        { name: 'Jun (Est)', value: 290000 }
      ];
    } else {
      title = `Analysis: ${query}`;
      summary = "General data aggregation based on your query parameters.";
      chartData = [
        { name: 'A', value: 100 },
        { name: 'B', value: 200 },
        { name: 'C', value: 150 }
      ];
    }

    res.json({
      success: true,
      data: {
        title,
        summary,
        chartData
      }
    });

  } catch (error) {
    logger.error('Failed to generate AI report', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
});

module.exports = router;
