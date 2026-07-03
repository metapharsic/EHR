/**
 * Prometheus metrics — ERP logic flows, Kafka events, business KPIs
 * Scraped at GET /metrics (port 5000, same process)
 */
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'erp_node_' });

// ── HTTP ──────────────────────────────────────────────────────────────────────
const httpRequestDuration = new client.Histogram({
  name: 'erp_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status_code', 'module'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});
const httpRequestTotal = new client.Counter({
  name: 'erp_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'module'],
  registers: [register],
});

// ── Kafka producer ────────────────────────────────────────────────────────────
const kafkaProducedTotal = new client.Counter({
  name: 'erp_kafka_events_produced_total',
  help: 'Total Kafka events produced',
  labelNames: ['topic', 'event_type', 'module', 'status'],
  registers: [register],
});
const kafkaProduceDuration = new client.Histogram({
  name: 'erp_kafka_produce_duration_seconds',
  help: 'Kafka produce latency',
  labelNames: ['topic', 'event_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// ── Kafka consumer ────────────────────────────────────────────────────────────
const kafkaConsumedTotal = new client.Counter({
  name: 'erp_kafka_events_consumed_total',
  help: 'Total Kafka events consumed',
  labelNames: ['topic', 'event_type', 'consumer_group', 'status'],
  registers: [register],
});
const kafkaConsumeLag = new client.Gauge({
  name: 'erp_kafka_consumer_lag',
  help: 'Kafka consumer lag (pending events)',
  labelNames: ['topic', 'consumer_group'],
  registers: [register],
});

// ── Broadcasts ────────────────────────────────────────────────────────────────
const broadcastsTotal = new client.Counter({
  name: 'erp_broadcasts_total',
  help: 'Total broadcasts sent',
  labelNames: ['channel', 'type'],
  registers: [register],
});

// ── Business KPIs ─────────────────────────────────────────────────────────────
const invoicesCreated = new client.Counter({
  name: 'erp_invoices_created_total',
  help: 'Invoices created',
  labelNames: ['module', 'payment_mode'],
  registers: [register],
});
const invoiceAmount = new client.Histogram({
  name: 'erp_invoice_amount_inr',
  help: 'Invoice net amount in INR',
  labelNames: ['module', 'payment_mode'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});
const ordersCreated = new client.Counter({
  name: 'erp_orders_created_total',
  help: 'Orders created',
  labelNames: ['status'],
  registers: [register],
});
const purchaseOrdersTotal = new client.Counter({
  name: 'erp_purchase_orders_total',
  help: 'Purchase orders created',
  labelNames: ['status'],
  registers: [register],
});
const stockAlerts = new client.Gauge({
  name: 'erp_stock_alerts_active',
  help: 'Active stock alerts',
  labelNames: ['alert_type'],
  registers: [register],
});
const activeUsers = new client.Gauge({
  name: 'erp_active_sessions',
  help: 'Currently authenticated sessions',
  registers: [register],
});

// ── Logic flow traces ─────────────────────────────────────────────────────────
const flowDuration = new client.Histogram({
  name: 'erp_flow_duration_seconds',
  help: 'ERP logic flow step duration',
  labelNames: ['flow_name', 'module', 'step', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});
const flowsTotal = new client.Counter({
  name: 'erp_flows_total',
  help: 'ERP logic flow completions',
  labelNames: ['flow_name', 'module', 'status'],
  registers: [register],
});

// ── DB pool ───────────────────────────────────────────────────────────────────
const dbQueryDuration = new client.Histogram({
  name: 'erp_db_query_duration_seconds',
  help: 'PostgreSQL query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});
const dbPoolSize = new client.Gauge({
  name: 'erp_db_pool_size',
  help: 'DB pool connections',
  labelNames: ['state'],
  registers: [register],
});

// ── Express middleware ────────────────────────────────────────────────────────
function httpMiddleware(routeMap = {}) {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route   = routeMap[req.path] || req.route?.path || req.path.replace(/\/\d+/g, '/:id') || 'unknown';
      const module  = req.path.split('/')[2] || 'unknown';
      const labels  = { method: req.method, route, status_code: res.statusCode, module };
      httpRequestDuration.observe(labels, duration);
      httpRequestTotal.inc(labels);
    });
    next();
  };
}

// ── Kafka metric helpers (called from kafka.js) ───────────────────────────────
function recordProduced(topic, eventType, module, status, durationSec) {
  kafkaProducedTotal.inc({ topic, event_type: eventType, module, status });
  if (durationSec !== undefined) kafkaProduceDuration.observe({ topic, event_type: eventType }, durationSec);
}
function recordConsumed(topic, eventType, consumerGroup, status) {
  kafkaConsumedTotal.inc({ topic, event_type: eventType, consumer_group: consumerGroup, status });
}
function recordBroadcast(channel, type) {
  broadcastsTotal.inc({ channel, type });
}

// Business KPI helpers
function recordInvoice(module, paymentMode, amountInr) {
  invoicesCreated.inc({ module, payment_mode: paymentMode });
  if (amountInr) invoiceAmount.observe({ module, payment_mode: paymentMode }, amountInr);
}
function recordOrder(status) { ordersCreated.inc({ status }); }
function recordPurchaseOrder(status) { purchaseOrdersTotal.inc({ status }); }
function setStockAlert(alertType, count) { stockAlerts.set({ alert_type: alertType }, count); }
function setActiveSessions(count) { activeUsers.set(count); }
function recordFlow(flowName, module, step, status, durationSec) {
  flowDuration.observe({ flow_name: flowName, module, step, status }, durationSec);
  if (step === '__end__') flowsTotal.inc({ flow_name: flowName, module, status });
}
function recordDbQuery(operation, table, durationSec) {
  dbQueryDuration.observe({ operation, table }, durationSec);
}
function setDbPool(total, idle, waiting) {
  dbPoolSize.set({ state: 'total' }, total);
  dbPoolSize.set({ state: 'idle' }, idle);
  dbPoolSize.set({ state: 'waiting' }, waiting);
}

// Expose /metrics endpoint handler
async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  register, httpMiddleware, metricsHandler,
  recordProduced, recordConsumed, recordBroadcast,
  recordInvoice, recordOrder, recordPurchaseOrder,
  setStockAlert, setActiveSessions, recordFlow,
  recordDbQuery, setDbPool,
};
