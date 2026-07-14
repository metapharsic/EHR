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
    console.log(JSON.stringify(insights, null, 2));
}

test().catch(console.error).finally(() => process.exit(0));
