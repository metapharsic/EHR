const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyTokenMiddleware } = require('../utils/jwt');

// ─── Data Fetchers ─────────────────────────────────────────────────────────────

async function fetchRealContext() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [todaySales, weeklySales, lowStock, nearExpiry, topProducts] = await Promise.all([
    // Today's sales
    db.query(`
      SELECT
        COUNT(*)::int                           AS invoice_count,
        COALESCE(SUM(net_amount),0)::numeric    AS revenue,
        COALESCE(SUM(total_gst),0)::numeric     AS gst,
        COALESCE(SUM(sub_total),0)::numeric     AS subtotal
      FROM sales_invoices
      WHERE DATE(created_at) = $1
        AND status NOT IN ('Cancelled','Returned')
    `, [today]),

    // Last 7 days daily trend
    db.query(`
      SELECT
        DATE(created_at)::text                  AS date,
        COUNT(*)::int                           AS invoices,
        COALESCE(SUM(net_amount),0)::numeric    AS revenue
      FROM sales_invoices
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND status NOT IN ('Cancelled','Returned')
      GROUP BY DATE(created_at)
      ORDER BY 1
    `),

    // Low-stock products
    db.query(`
      SELECT p.name, p.code,
        COALESCE(SUM(b.stock),0)::int AS stock,
        p.min_stock_level
      FROM products p
      LEFT JOIN batches b ON b.product_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.code, p.min_stock_level
      HAVING COALESCE(SUM(b.stock),0) < p.min_stock_level
      ORDER BY stock ASC
      LIMIT 10
    `),

    // Near-expiry batches (next 60 days)
    db.query(`
      SELECT p.name, b.batch_number, b.expiry_date::text, b.stock
      FROM batches b
      JOIN products p ON p.id = b.product_id
      WHERE b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
        AND b.stock > 0
      ORDER BY b.expiry_date
      LIMIT 10
    `),

    // Top-selling products (last 30 days)
    db.query(`
      SELECT p.name,
        SUM(sii.quantity)::int     AS units_sold,
        SUM(sii.total_amount)::numeric AS revenue
      FROM sales_invoice_items sii
      JOIN products p ON p.id = sii.product_id
      JOIN sales_invoices si ON si.id = sii.invoice_id
      WHERE si.created_at >= NOW() - INTERVAL '30 days'
        AND si.status NOT IN ('Cancelled','Returned')
      GROUP BY p.name
      ORDER BY units_sold DESC
      LIMIT 5
    `),
  ]);

  return {
    today,
    todaySales: todaySales.rows[0],
    weeklySales: weeklySales.rows,
    lowStock: lowStock.rows,
    nearExpiry: nearExpiry.rows,
    topProducts: topProducts.rows,
  };
}

// ─── Rule-Based Fallback (works without API key) ───────────────────────────────

function ruleBasedAnswer(query, ctx) {
  const q = query.toLowerCase();
  const ts = ctx.todaySales;
  const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Today's sales
  if (/today.*sale|sale.*today|today.*revenue|revenue.*today|daily.*sale/.test(q)) {
    return [
      `**Today's Sales (${ctx.today})**`,
      `- Invoices: **${ts.invoice_count}**`,
      `- Revenue: **${fmt(ts.revenue)}**`,
      `- GST Collected: ${fmt(ts.gst)}`,
      `- Subtotal (pre-tax): ${fmt(ts.subtotal)}`,
    ].join('\n');
  }

  // Low stock
  if (/low.?stock|stock.?low|out.?of.?stock|reorder|which.*stock|items.*stock|stock.*items/.test(q)) {
    if (ctx.lowStock.length === 0)
      return '✅ All products are above minimum stock levels.';
    const list = ctx.lowStock.map(p => `- **${p.name}** (${p.code}): ${p.stock} units (min ${p.min_stock_level})`).join('\n');
    return `**${ctx.lowStock.length} products below minimum stock:**\n${list}`;
  }

  // Expiry
  if (/expir|near.?expiry|expiry/.test(q)) {
    if (ctx.nearExpiry.length === 0)
      return '✅ No batches expiring in the next 60 days.';
    const list = ctx.nearExpiry.map(b => `- **${b.name}** | Batch: ${b.batch_number} | Expires: ${b.expiry_date} | Qty: ${b.stock}`).join('\n');
    return `**${ctx.nearExpiry.length} batches expiring within 60 days:**\n${list}`;
  }

  // Top products
  if (/top|best.?sell|best.?product|fast.?mov/.test(q)) {
    if (ctx.topProducts.length === 0)
      return 'No sales data available for the last 30 days.';
    const list = ctx.topProducts.map((p, i) => `${i + 1}. **${p.name}** — ${p.units_sold} units | ${fmt(p.revenue)}`).join('\n');
    return `**Top-selling products (last 30 days):**\n${list}`;
  }

  // Weekly trend
  if (/week|7.?day|trend/.test(q)) {
    if (ctx.weeklySales.length === 0) return 'No sales data for the last 7 days.';
    const list = ctx.weeklySales.map(r => `- ${r.date}: ${r.invoices} invoices | ${fmt(r.revenue)}`).join('\n');
    const total = ctx.weeklySales.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);
    return `**Last 7 days sales:**\n${list}\n\n**Total: ${fmt(total)}**`;
  }

  // Summary / overview
  if (/summary|overview|how.*doing|performance/.test(q)) {
    return [
      `**Business Snapshot — ${ctx.today}**`,
      `- Today's Revenue: **${fmt(ts.revenue)}** (${ts.invoice_count} invoices)`,
      `- Low Stock Alerts: **${ctx.lowStock.length}** products`,
      `- Near-Expiry Batches (60d): **${ctx.nearExpiry.length}**`,
      `- Top Product Today: ${ctx.topProducts[0]?.name || 'N/A'}`,
    ].join('\n');
  }

  return (
    `I can answer questions about:\n` +
    `- **Today's sales** — revenue, invoice count, GST\n` +
    `- **Low stock** — products below reorder level\n` +
    `- **Expiry alerts** — batches expiring within 60 days\n` +
    `- **Top products** — best sellers (last 30 days)\n` +
    `- **Weekly trend** — last 7 days revenue\n\n` +
    `Try: *"How are today's sales?"* or *"Which items are low on stock?"*`
  );
}

// ─── Gemini AI Answer ──────────────────────────────────────────────────────────

async function geminiAnswer(query, ctx) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const ts = ctx.todaySales;

  const dataContext = [
    `Date: ${ctx.today}`,
    `Today's Sales: ${ts.invoice_count} invoices, Revenue ${fmt(ts.revenue)}, GST ${fmt(ts.gst)}`,
    `Weekly Trend: ${ctx.weeklySales.map(r => `${r.date}: ${fmt(r.revenue)}`).join(' | ')}`,
    `Low Stock (${ctx.lowStock.length}): ${ctx.lowStock.map(p => `${p.name} (${p.stock} left)`).join(', ') || 'None'}`,
    `Near Expiry (${ctx.nearExpiry.length}): ${ctx.nearExpiry.map(b => `${b.name} exp ${b.expiry_date}`).join(', ') || 'None'}`,
    `Top 5 Products (30d): ${ctx.topProducts.map(p => `${p.name} ${p.units_sold}u`).join(', ') || 'No data'}`,
  ].join('\n');

  const systemInstruction =
    'You are a smart AI assistant for Metapharsic Lifesciences pharmacy ERP. ' +
    'Answer the user\'s question using ONLY the provided real-time store data. ' +
    'Be concise (under 80 words). Use Markdown bold and lists. ' +
    'Always quote exact numbers from the data. Never guess or hallucinate figures.';

  const prompt = `${systemInstruction}\n\nLive Store Data:\n${dataContext}\n\nUser: ${query}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── POST /api/ai/ask ──────────────────────────────────────────────────────────

router.post('/ask', verifyTokenMiddleware, async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'query is required' });
  }
  if (query.length > 500) {
    return res.status(400).json({ success: false, error: 'query too long (max 500 chars)' });
  }

  try {
    const ctx = await fetchRealContext();

    let answer;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10) {
      try {
        answer = await geminiAnswer(query.trim(), ctx);
      } catch (aiErr) {
        console.error('[AI] Gemini failed, falling back to rule-based:', aiErr.message);
        answer = ruleBasedAnswer(query.trim(), ctx);
      }
    } else {
      answer = ruleBasedAnswer(query.trim(), ctx);
    }

    res.json({ success: true, answer });
  } catch (error) {
    console.error('[AI] /api/ai/ask error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch store data' });
  }
});

module.exports = router;
