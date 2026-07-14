require('dotenv').config({ path: '../.env' });
const aiAgent = require('../server/services/aiOmsAgent');
const db = require('../server/db');

async function test() {
    const orders = await db.query(`
            SELECT id, order_number, distributor_name, status, priority, total_amount, ai_risk_level
            FROM orders WHERE status NOT IN ('Rejected','Cancelled') ORDER BY order_date DESC LIMIT 100`);
    const distributors = await db.query(
            `SELECT id, name, credit_limit, current_balance FROM parties WHERE type = 'Debtor' LIMIT 100`);
    const demand = { rows: [] };
    
    console.log("Orders:", orders.rows.length);
    console.log("Distributors:", distributors.rows.length);
    
    const insights = await aiAgent.generatePortfolioInsights(orders.rows, distributors.rows, demand.rows);
    console.log("Portfolio Insights:", JSON.stringify(insights, null, 2));

    const openOrdersRes = await db.query(`
        SELECT id, order_number, distributor_id, distributor_name, status
        FROM orders
        WHERE status NOT IN ('Delivered', 'Invoiced', 'Rejected', 'Cancelled')
    `);
    
    const inventoryRes = await db.query(`
        SELECT p.id as product_id, p.name as product_name, p.reorder_level,
               COALESCE((SELECT SUM(stock) FROM batches WHERE product_id = p.id), 0) as available_qty
        FROM products p
    `);
    const reorder = await aiAgent.suggestAutoReorder(openOrdersRes.rows, inventoryRes.rows);
    console.log("Reorder suggestions:", JSON.stringify(reorder, null, 2));
    
    const historicalOrdersRes = await db.query(`
        SELECT
            o.id, o.order_number, o.distributor_id, o.distributor_name,
            o.order_date, o.total_amount, o.status
        FROM orders o
        WHERE o.status IN ('Invoiced', 'Delivered')
          AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY o.order_date DESC
    `);
    const predictions = await aiAgent.predictNextOrders(historicalOrdersRes.rows, distributors.rows);
    console.log("Demand predictions:", JSON.stringify(predictions, null, 2));

}

test().catch(console.error).finally(() => process.exit(0));
