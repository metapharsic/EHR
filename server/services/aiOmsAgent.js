/**
 * server/services/aiOmsAgent.js
 * Agentic AI service for the Order Management System (OMS) using Google GenAI (Gemini).
 * Handles order credit/fulfillment risk scoring, fulfillment feasibility forecasting,
 * confirmation drafting, and portfolio-level demand/reorder insights.
 *
 * Mirrors the pattern of services/aiCrmAgent.js: every function degrades gracefully to a
 * deterministic heuristic when GEMINI_API_KEY is not configured, so the module is fully
 * functional without an API key.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

/**
 * Safely parse a JSON object from a Gemini response that may be fenced with ```json.
 */
function parseJsonResponse(text) {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
}

/**
 * Order Risk Agent: scores an order for credit + fulfillment risk.
 * @returns {{ riskScore:number, riskLevel:'Low'|'Medium'|'High', recommendation:'Approve'|'Review'|'Hold', reason:string }}
 */
async function analyzeOrderRisk(order, items = [], distributor = {}, stockSummary = []) {
    const total = num(order.total_amount);
    const creditLimit = num(distributor.credit_limit);
    const currentBalance = num(distributor.current_balance); // +ve = receivable owed to us
    const projectedExposure = currentBalance + total;

    // Heuristic fallback (also used as a base if AI fails)
    const heuristic = () => {
        let risk = 20;
        let reasons = [];

        // Credit exposure
        if (creditLimit > 0) {
            const utilization = projectedExposure / creditLimit;
            if (utilization > 1) { risk += 45; reasons.push(`projected exposure ₹${projectedExposure.toFixed(0)} exceeds credit limit ₹${creditLimit.toFixed(0)}`); }
            else if (utilization > 0.8) { risk += 25; reasons.push(`credit utilization at ${(utilization * 100).toFixed(0)}%`); }
            else if (utilization > 0.5) { risk += 10; }
        } else {
            risk += 15; reasons.push('no credit limit on record');
        }

        // Order value
        if (total > 500000) { risk += 15; reasons.push('high-value order'); }
        else if (total > 100000) { risk += 8; }

        // Stock shortfall
        const shortfalls = (stockSummary || []).filter(s => num(s.available) < num(s.required));
        if (shortfalls.length > 0) { risk += 15; reasons.push(`${shortfalls.length} line item(s) short on stock`); }

        const riskScore = Math.max(0, Math.min(risk, 100));
        const riskLevel = riskScore >= 65 ? 'High' : riskScore >= 35 ? 'Medium' : 'Low';
        const recommendation = riskScore >= 65 ? 'Hold' : riskScore >= 35 ? 'Review' : 'Approve';
        const reason = reasons.length
            ? `Heuristic: ${reasons.join('; ')}.`
            : 'Heuristic: healthy credit position and stock available.';
        return { riskScore, riskLevel, recommendation, reason };
    };

    if (!genAI) return heuristic();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a B2B pharmaceutical order risk officer. Assess the credit and fulfillment
            risk of this distributor order.

            Order: ${JSON.stringify({ total_amount: total, priority: order.priority, items_count: items.length })}
            Distributor: ${JSON.stringify({ name: distributor.name, credit_limit: creditLimit, current_balance: currentBalance, status: distributor.status })}
            Projected credit exposure after this order: ${projectedExposure}
            Stock availability per line: ${JSON.stringify(stockSummary)}

            Provide:
            1. riskScore 0-100 (higher = riskier).
            2. riskLevel ('Low','Medium','High').
            3. recommendation ('Approve','Review','Hold').
            4. reason (1 concise sentence).

            Return ONLY a valid JSON object:
            {"riskScore": number, "riskLevel": "string", "recommendation": "string", "reason": "string"}
        `;
        const result = await model.generateContent(prompt);
        const parsed = parseJsonResponse((await result.response).text());
        return {
            riskScore: Math.max(0, Math.min(Math.round(num(parsed.riskScore)), 100)),
            riskLevel: parsed.riskLevel || 'Medium',
            recommendation: parsed.recommendation || 'Review',
            reason: parsed.reason || 'AI assessment complete.'
        };
    } catch (error) {
        logger.error("AI Order Risk Error", { error: error.message });
        return heuristic();
    }
}

/**
 * Fulfillment Agent: predicts whether an order can be fulfilled on time given stock.
 * @returns {{ feasible:boolean, fillRate:number, shortages:Array, eta:string, note:string }}
 */
async function forecastFulfillment(order, items = [], stockLevels = []) {
    // stockLevels: [{ productId, productName, required, available }]
    const lines = (stockLevels && stockLevels.length) ? stockLevels : items.map(i => ({
        productId: i.product_id,
        productName: i.product_name,
        required: num(i.quantity),
        available: num(i.available)
    }));

    const heuristic = () => {
        const totalRequired = lines.reduce((s, l) => s + num(l.required), 0);
        const totalFillable = lines.reduce((s, l) => s + Math.min(num(l.required), num(l.available)), 0);
        const shortages = lines
            .filter(l => num(l.available) < num(l.required))
            .map(l => ({ productName: l.productName, required: num(l.required), available: num(l.available) }));
        const fillRate = totalRequired > 0 ? Math.round((totalFillable / totalRequired) * 100) : 100;
        const feasible = shortages.length === 0;
        return {
            feasible,
            fillRate,
            shortages,
            eta: feasible ? '1-3 business days' : 'Partial / pending restock',
            note: feasible
                ? 'Heuristic: all lines have sufficient available stock.'
                : `Heuristic: ${shortages.length} line(s) short; can fulfill ${fillRate}% immediately.`
        };
    };

    if (!genAI) return heuristic();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a pharmaceutical fulfillment planner. Given the order lines and current
            available stock, assess fulfillment feasibility.

            Lines (required vs available): ${JSON.stringify(lines)}

            Return ONLY a valid JSON object:
            {"feasible": boolean, "fillRate": number (0-100), "shortages": [{"productName":"string","required":number,"available":number}], "eta": "string", "note": "string"}
        `;
        const result = await model.generateContent(prompt);
        const parsed = parseJsonResponse((await result.response).text());
        return {
            feasible: !!parsed.feasible,
            fillRate: Math.max(0, Math.min(Math.round(num(parsed.fillRate)), 100)),
            shortages: Array.isArray(parsed.shortages) ? parsed.shortages : [],
            eta: parsed.eta || 'N/A',
            note: parsed.note || 'AI fulfillment assessment complete.'
        };
    } catch (error) {
        logger.error("AI Fulfillment Error", { error: error.message });
        return heuristic();
    }
}

/**
 * Communication Agent: drafts a professional order confirmation / dispatch email.
 * @returns {string} email body text
 */
async function draftOrderConfirmation(order, items = [], distributor = {}) {
    const itemLines = items.map(i => `- ${i.product_name} x ${i.approved_quantity || i.quantity} @ ₹${num(i.rate)}`).join("\n");

    const fallback = () =>
`Dear ${distributor.name || 'Partner'},

Thank you for your order ${order.order_number || ''} placed with Metapharsic Lifesciences.

We are pleased to confirm the following:
${itemLines}

Order Total: ₹${num(order.total_amount).toLocaleString('en-IN')}
Status: ${order.status}
${order.expected_delivery_date ? `Expected Delivery: ${order.expected_delivery_date}` : ''}

Our team is processing your order and will share dispatch details shortly. Please reach out for any clarifications.

Warm regards,
Metapharsic Lifesciences — Order Management`;

    if (!genAI) return fallback();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            Draft a professional B2B order confirmation email for a pharmaceutical distributor order.
            Distributor: ${distributor.name || 'Partner'}
            Order Number: ${order.order_number || 'N/A'}
            Status: ${order.status}
            Items:
            ${itemLines}
            Order Total: ₹${num(order.total_amount)}
            Expected Delivery: ${order.expected_delivery_date || 'TBD'}

            Tone: Professional, warm, pharmaceutical industry standard. Include a clear next step.
            Return ONLY the email body text (no subject line, no markdown).
        `;
        const result = await model.generateContent(prompt);
        return (await result.response).text();
    } catch (error) {
        logger.error("AI Confirmation Drafting Error", { error: error.message });
        return fallback();
    }
}

/**
 * Strategy Agent: portfolio-level insights — priority orders, market insight,
 * reorder suggestions, and recommended actions.
 */
async function generatePortfolioInsights(orders = [], distributors = [], demand = []) {
    const heuristic = () => {
        const open = orders.filter(o => !['Delivered', 'Invoiced', 'Rejected', 'Cancelled'].includes(o.status));
        const priorityOrders = open
            .slice()
            .sort((a, b) => num(b.total_amount) - num(a.total_amount))
            .slice(0, 5)
            .map(o => ({
                id: o.id,
                orderNumber: o.order_number,
                reason: `${o.priority === 'Urgent' || o.priority === 'High' ? 'High priority' : 'High value'} order worth ₹${num(o.total_amount).toLocaleString('en-IN')} in '${o.status}'.`
            }));
        const pendingCount = orders.filter(o => o.status === 'Pending Approval').length;
        const atRisk = orders.filter(o => o.ai_risk_level === 'High').length;
        return {
            priorityOrders,
            marketInsight: `Heuristic: ${open.length} open orders, ${pendingCount} awaiting approval${atRisk ? `, ${atRisk} flagged high-risk` : ''}. Prioritized by value and urgency.`,
            reorderSuggestions: [],
            recommendedActions: [
                pendingCount ? `Clear ${pendingCount} pending approval(s) to unblock fulfillment.` : 'No pending approvals — pipeline is flowing.',
                atRisk ? `Review ${atRisk} high-risk order(s) before shipping.` : 'Credit exposure is within healthy bounds.',
                'Confirm stock for top-value orders to protect SLAs.'
            ]
        };
    };

    if (!genAI) return heuristic();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a Pharmaceutical Order Operations Strategy Agent. Analyze the open order book,
            distributor credit positions, and regional demand to produce an actionable weekly plan.

            Orders: ${JSON.stringify(orders.slice(0, 50))}
            Distributors: ${JSON.stringify(distributors.slice(0, 50))}
            Regional Demand: ${JSON.stringify(demand)}

            Provide:
            1. Top 5 priority orders to action (with a specific agentic reason each).
            2. A brief overall market/order-book insight.
            3. Reorder suggestions (products to restock based on demand vs open orders).
            4. 3 high-level recommended actions.

            Return ONLY a valid JSON object:
            {
                "priorityOrders": [{"id":"uuid","orderNumber":"string","reason":"string"}],
                "marketInsight": "string",
                "reorderSuggestions": [{"product":"string","reason":"string"}],
                "recommendedActions": ["string","string","string"]
            }
        `;
        const result = await model.generateContent(prompt);
        const parsed = parseJsonResponse((await result.response).text());
        return {
            priorityOrders: Array.isArray(parsed.priorityOrders) ? parsed.priorityOrders : [],
            marketInsight: parsed.marketInsight || 'AI insight generated.',
            reorderSuggestions: Array.isArray(parsed.reorderSuggestions) ? parsed.reorderSuggestions : [],
            recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : []
        };
    } catch (error) {
        logger.error("AI Portfolio Insights Error", { error: error.message });
        return heuristic();
    }
}

/**
 * Demand Prediction Agent: predicts which distributors are likely to reorder soon
 * based on their historical order intervals.
 *
 * @param {Array} historicalOrders  Orders with status Invoiced/Delivered, including distributor_id,
 *                                   distributor_name, order_date, total_amount, and items array
 * @param {Array} distributors      List of { id, name } distributor records
 * @returns {{ predictions: Array, insight: string }}
 */
async function predictNextOrders(historicalOrders = [], distributors = []) {
    // ---- Heuristic ----
    const heuristic = () => {
        // Group completed/invoiced orders by distributor
        const byDist = {};
        for (const o of historicalOrders) {
            const did = o.distributor_id;
            if (!did) continue;
            if (!byDist[did]) {
                byDist[did] = {
                    distributorId: did,
                    distributorName: o.distributor_name,
                    orders: [],
                    products: {}
                };
            }
            byDist[did].orders.push(new Date(o.order_date));
            // Accumulate product quantities
            if (Array.isArray(o.items)) {
                for (const item of o.items) {
                    const key = item.product_name || item.productName || 'Unknown';
                    if (!byDist[did].products[key]) byDist[did].products[key] = [];
                    byDist[did].products[key].push(Number(item.quantity || item.approved_quantity || 0));
                }
            }
        }

        const today = new Date();
        const predictions = [];

        for (const [, dist] of Object.entries(byDist)) {
            if (dist.orders.length < 2) continue;

            // Sort order dates ascending
            dist.orders.sort((a, b) => a - b);

            // Calculate average interval between orders in days
            let totalIntervalDays = 0;
            for (let i = 1; i < dist.orders.length; i++) {
                totalIntervalDays += (dist.orders[i] - dist.orders[i - 1]) / (1000 * 60 * 60 * 24);
            }
            const avgIntervalDays = Math.round(totalIntervalDays / (dist.orders.length - 1));
            const lastOrderDate = dist.orders[dist.orders.length - 1];
            const daysSinceLastOrder = Math.round((today - lastOrderDate) / (1000 * 60 * 60 * 24));
            const daysOverdue = daysSinceLastOrder - Math.round(avgIntervalDays * 0.8);

            if (daysOverdue <= 0) continue; // Not yet due

            // Average quantities per product
            const products = Object.entries(dist.products).map(([productName, qtys]) => ({
                productName,
                avgQty: Math.round(qtys.reduce((s, q) => s + q, 0) / qtys.length)
            }));

            // Predict order value (average of historical)
            const orderAmounts = historicalOrders
                .filter(o => o.distributor_id === dist.distributorId)
                .map(o => Number(o.total_amount || 0));
            const predictedValue = orderAmounts.length
                ? Math.round(orderAmounts.reduce((s, a) => s + a, 0) / orderAmounts.length)
                : 0;

            const confidence = daysOverdue > avgIntervalDays * 0.5
                ? 'High'
                : daysOverdue > avgIntervalDays * 0.2
                    ? 'Medium'
                    : 'Low';

            predictions.push({
                distributorId: dist.distributorId,
                distributorName: dist.distributorName,
                lastOrderDate: lastOrderDate.toISOString().slice(0, 10),
                avgIntervalDays,
                daysOverdue,
                predictedValue,
                confidence,
                products
            });
        }

        // Sort by daysOverdue descending, return top 5
        predictions.sort((a, b) => b.daysOverdue - a.daysOverdue);
        const top5 = predictions.slice(0, 5);

        const insight = top5.length
            ? `Heuristic: ${top5.length} distributor(s) are overdue for reorder. Top candidate: ${top5[0].distributorName} (${top5[0].daysOverdue} days overdue, avg interval ${top5[0].avgIntervalDays} days).`
            : 'Heuristic: No distributors are currently flagged as overdue for reorder based on historical patterns.';

        return { predictions: top5, insight };
    };

    if (!genAI) return heuristic();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a pharmaceutical B2B demand forecasting agent.
            Analyze the historical order data and predict which distributors are most likely
            to place a new order soon.

            Historical Orders (last 90 days, Invoiced/Delivered):
            ${JSON.stringify(historicalOrders.slice(0, 100))}

            Distributors: ${JSON.stringify(distributors.slice(0, 50))}

            For each distributor with at least 2 completed orders:
            - Calculate average order interval in days.
            - Identify those where days since last order > (avgInterval * 0.8).
            - Estimate predicted order value and product quantities based on history.
            - Assign confidence: 'High' if significantly overdue, 'Medium' if mildly, 'Low' otherwise.

            Return ONLY a valid JSON object:
            {
                "predictions": [
                    {
                        "distributorId": "string",
                        "distributorName": "string",
                        "lastOrderDate": "YYYY-MM-DD",
                        "avgIntervalDays": number,
                        "daysOverdue": number,
                        "predictedValue": number,
                        "confidence": "High|Medium|Low",
                        "products": [{"productName": "string", "avgQty": number}]
                    }
                ],
                "insight": "string"
            }
            Return top 5 distributors by daysOverdue descending.
        `;
        const result = await model.generateContent(prompt);
        const parsed = parseJsonResponse((await result.response).text());
        return {
            predictions: Array.isArray(parsed.predictions) ? parsed.predictions.slice(0, 5) : [],
            insight: parsed.insight || 'AI demand prediction complete.'
        };
    } catch (error) {
        logger.error("AI Predict Next Orders Error", { error: error.message });
        return heuristic();
    }
}

/**
 * Auto-Reorder Suggestion Agent: analyzes open order demand vs current inventory
 * to identify products that need urgent purchase orders.
 *
 * @param {Array} openOrders       Orders with items: [{ productId, productName, quantity }]
 * @param {Array} currentInventory [{ productId, productName, availableQty, reorderLevel }]
 * @returns {{ suggestions: Array, summary: string }}
 */
async function suggestAutoReorder(openOrders = [], currentInventory = []) {
    // ---- Heuristic ----
    const heuristic = () => {
        // Build product demand map from open orders
        const demandMap = {};
        for (const order of openOrders) {
            if (!Array.isArray(order.items)) continue;
            for (const item of order.items) {
                const pid = item.productId || item.product_id;
                const pname = item.productName || item.product_name || 'Unknown';
                const qty = Number(item.quantity || item.approved_quantity || 0);
                if (!pid) continue;
                if (!demandMap[pid]) demandMap[pid] = { productId: pid, productName: pname, totalDemand: 0 };
                demandMap[pid].totalDemand += qty;
            }
        }

        const suggestions = [];
        for (const inv of currentInventory) {
            const pid = inv.productId || inv.product_id;
            const availableQty = Number(inv.availableQty || inv.available_qty || 0);
            const reorderLevel = Number(inv.reorderLevel || inv.reorder_level || 0);
            const demand = demandMap[pid] ? demandMap[pid].totalDemand : 0;
            const netAvailable = availableQty - demand;

            if (netAvailable < reorderLevel) {
                const shortfall = reorderLevel - netAvailable;
                const suggestedPurchaseQty = (reorderLevel * 2) - netAvailable;
                const urgency = netAvailable < 0
                    ? 'Critical'
                    : netAvailable < reorderLevel * 0.5
                        ? 'High'
                        : 'Normal';

                suggestions.push({
                    productId: pid,
                    productName: inv.productName || inv.product_name,
                    availableQty,
                    totalOpenDemand: demand,
                    reorderLevel,
                    shortfall: Math.max(0, shortfall),
                    suggestedPurchaseQty: Math.max(1, suggestedPurchaseQty),
                    urgency
                });
            }
        }

        // Sort by urgency weight
        const urgencyWeight = { Critical: 3, High: 2, Normal: 1 };
        suggestions.sort((a, b) => (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0));

        const criticalCount = suggestions.filter(s => s.urgency === 'Critical').length;
        const highCount = suggestions.filter(s => s.urgency === 'High').length;
        const summary = suggestions.length
            ? `Heuristic: ${suggestions.length} product(s) need reorder. ${criticalCount} critical (demand exceeds stock), ${highCount} high priority.`
            : 'Heuristic: All products have sufficient stock to fulfill open orders.';

        return { suggestions, summary };
    };

    if (!genAI) return heuristic();

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
            You are a pharmaceutical inventory optimization agent.
            Analyze the current open orders demand versus available inventory and suggest
            which products need to be purchased urgently.

            Open Orders with Items: ${JSON.stringify(openOrders.slice(0, 50))}
            Current Inventory: ${JSON.stringify(currentInventory.slice(0, 100))}

            For each product where (availableQty - totalOpenDemand) < reorderLevel:
            - Calculate shortfall = reorderLevel - (availableQty - totalOpenDemand)
            - Suggest purchase qty = (reorderLevel * 2) - (availableQty - totalOpenDemand)
            - Set urgency: 'Critical' if netAvailable < 0, 'High' if < 50% of reorderLevel, 'Normal' otherwise

            Return ONLY a valid JSON object:
            {
                "suggestions": [
                    {
                        "productId": "string",
                        "productName": "string",
                        "availableQty": number,
                        "totalOpenDemand": number,
                        "reorderLevel": number,
                        "shortfall": number,
                        "suggestedPurchaseQty": number,
                        "urgency": "Critical|High|Normal"
                    }
                ],
                "summary": "string"
            }
        `;
        const result = await model.generateContent(prompt);
        const parsed = parseJsonResponse((await result.response).text());
        return {
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
            summary: parsed.summary || 'AI auto-reorder analysis complete.'
        };
    } catch (error) {
        logger.error("AI Auto-Reorder Error", { error: error.message });
        return heuristic();
    }
}

module.exports = {
    analyzeOrderRisk,
    forecastFulfillment,
    draftOrderConfirmation,
    generatePortfolioInsights,
    predictNextOrders,
    suggestAutoReorder
};
