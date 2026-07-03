/**
 * Universal ERP Event Middleware
 * Intercepts every mutating request (POST/PUT/PATCH/DELETE),
 * captures the route + body, fires Kafka event after response commits.
 *
 * Topic routing:
 *   /api/customers, /api/pos/parties   → erp.party.events
 *   /api/sales                         → erp.invoices
 *   /api/purchase                      → erp.purchases
 *   /api/oms                           → erp.orders
 *   /api/inventory*, /api/products     → erp.inventory
 *   /api/pos (non-party)               → erp.invoices  (POS sale)
 *   /api/crm                           → erp.party.events
 *   /api/accounting, /api/vouchers     → erp.audit
 *   /api/hr                            → erp.audit
 *   everything else                    → erp.audit
 */
const kafka = require('../services/kafka');
const metrics = require('../services/metrics');

// Map URL prefix → { topic, module }
const ROUTE_MAP = [
  { prefix: '/api/customers',       topic: 'erp.party.events', module: 'CUSTOMER' },
  { prefix: '/api/pos/parties',     topic: 'erp.party.events', module: 'PARTY' },
  { prefix: '/api/crm',             topic: 'erp.party.events', module: 'CRM' },
  { prefix: '/api/pcd',             topic: 'erp.party.events', module: 'PCD' },
  { prefix: '/api/sales',           topic: 'erp.invoices',     module: 'SALES' },
  { prefix: '/api/pos',             topic: 'erp.invoices',     module: 'POS' },
  { prefix: '/api/purchase',        topic: 'erp.purchases',    module: 'PURCHASE' },
  { prefix: '/api/oms',             topic: 'erp.orders',       module: 'OMS' },
  { prefix: '/api/inventory',       topic: 'erp.inventory',    module: 'INVENTORY' },
  { prefix: '/api/inventory-full',  topic: 'erp.inventory',    module: 'INVENTORY' },
  { prefix: '/api/inventory-enterprise', topic: 'erp.inventory', module: 'INVENTORY' },
  { prefix: '/api/products',        topic: 'erp.inventory',    module: 'PRODUCTS' },
  { prefix: '/api/manufacturing',   topic: 'erp.inventory',    module: 'MANUFACTURING' },
  { prefix: '/api/logistics',       topic: 'erp.orders',       module: 'LOGISTICS' },
  { prefix: '/api/accounting',      topic: 'erp.audit',        module: 'ACCOUNTS' },
  { prefix: '/api/vouchers',        topic: 'erp.audit',        module: 'ACCOUNTS' },
  { prefix: '/api/hr',              topic: 'erp.audit',        module: 'HR' },
  { prefix: '/api/assets',          topic: 'erp.audit',        module: 'ASSETS' },
  { prefix: '/api/compliance',      topic: 'erp.audit',        module: 'COMPLIANCE' },
  { prefix: '/api/qc',              topic: 'erp.audit',        module: 'QC' },
  { prefix: '/api/rnd',             topic: 'erp.audit',        module: 'RND' },
  { prefix: '/api/tds',             topic: 'erp.audit',        module: 'TDS' },
  { prefix: '/api/gst',             topic: 'erp.audit',        module: 'GST' },
];

function resolveRoute(path) {
  for (const r of ROUTE_MAP) {
    if (path.startsWith(r.prefix)) return r;
  }
  return { topic: 'erp.audit', module: 'SYSTEM' };
}

// Map HTTP method → event action suffix
const METHOD_ACTION = {
  POST:   'CREATED',
  PUT:    'UPDATED',
  PATCH:  'UPDATED',
  DELETE: 'DELETED',
};

function extractEntityId(path) {
  // Last numeric/uuid segment of path
  const parts = path.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && /^[\d-a-f]{1,36}$/i.test(last) && last !== 'api') return last;
  return null;
}

/**
 * Middleware factory. Call once in server/index.js after body parsing.
 * Uses res.json interception to capture response + fire event post-commit.
 */
function universalEventMiddleware(app) {
  return (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

    const { topic, module } = resolveRoute(req.path);
    const entityId = req.params?.id || extractEntityId(req.path);
    const entityType = req.path.split('/')[2] || 'unknown';
    const action = METHOD_ACTION[method];
    const eventType = `${module}.${action}`;

    // Intercept res.json to fire event after response
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      const result = originalJson(body);

      // Only emit on success responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payload = {
          method,
          path: req.path,
          entity_id: entityId,
          entity_type: entityType,
          request_body: sanitizeBody(req.body),
          response_summary: summarizeResponse(body),
          user_id: req.user?.userId,
          username: req.user?.username,
          role: req.user?.role,
          timestamp: Date.now(),
        };

        setImmediate(async () => {
          try {
            const start = Date.now();
            await kafka.publish(topic, eventType, module, payload, {
              entityId: entityId || String(req.user?.userId || 'sys'),
              entityType,
              producedBy: req.user?.username || 'system',
              partitionKey: entityId || module,
            });
            const dur = (Date.now() - start) / 1000;
            metrics.recordProduced(topic, eventType, module, 'PRODUCED', dur);

            // Push CACHE_INVALIDATE via WebSocket so all frontends refresh
            const broadcastAll = app.get('broadcastAll');
            if (broadcastAll) {
              broadcastAll({
                type: 'CACHE_INVALIDATE',
                module,
                topic,
                event_type: eventType,
                entity_id: entityId,
                entity_type: entityType,
                invalidate_keys: resolveInvalidateKeys(module, req.path, method),
                timestamp: Date.now(),
              });
            }
          } catch (e) {
            // Non-fatal: Kafka errors must not break the response
          }
        });
      }

      return result;
    };

    next();
  };
}

/**
 * Map module → which frontend cache keys to invalidate
 * Frontend uses these as prefixes for invalidateCache()
 */
function resolveInvalidateKeys(module, path, method) {
  const MAP = {
    CUSTOMER:      ['/api/customers', '/api/pos/parties', '/api/sales', '/api/oms', '/api/crm'],
    PARTY:         ['/api/pos/parties', '/api/customers', '/api/sales', '/api/oms'],
    CRM:           ['/api/crm', '/api/customers', '/api/pos/parties'],
    PCD:           ['/api/pcd', '/api/customers'],
    SALES:         ['/api/sales', '/api/sales/stats', '/api/analytics', '/api/accounting'],
    POS:           ['/api/pos', '/api/inventory', '/api/sales/products'],
    PURCHASE:      ['/api/purchase', '/api/inventory', '/api/analytics', '/api/accounting'],
    OMS:           ['/api/oms', '/api/logistics', '/api/inventory', '/api/analytics'],
    INVENTORY:     ['/api/inventory', '/api/sales/products', '/api/pos', '/api/purchase'],
    PRODUCTS:      ['/api/products', '/api/sales/products', '/api/inventory', '/api/pos'],
    MANUFACTURING: ['/api/manufacturing', '/api/inventory'],
    LOGISTICS:     ['/api/logistics', '/api/oms'],
    ACCOUNTS:      ['/api/accounting', '/api/reports', '/api/analytics'],
    HR:            ['/api/hr'],
    ASSETS:        ['/api/assets'],
    COMPLIANCE:    ['/api/compliance', '/api/customers'],
    QC:            ['/api/qc', '/api/inventory'],
    RND:           ['/api/rnd'],
    TDS:           ['/api/tds', '/api/accounting'],
    GST:           ['/api/gst', '/api/accounting'],
    SYSTEM:        [],
  };
  return MAP[module] || [];
}

// Strip sensitive fields before storing in Kafka
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};
  const SENSITIVE = ['password', 'token', 'secret', 'pin', 'otp', 'card'];
  const clean = { ...body };
  SENSITIVE.forEach(k => { if (k in clean) clean[k] = '[REDACTED]'; });
  // Truncate large arrays (e.g. invoice items) to first 3 for readability
  Object.keys(clean).forEach(k => {
    if (Array.isArray(clean[k]) && clean[k].length > 3) {
      clean[k] = [...clean[k].slice(0, 3), `...+${clean[k].length - 3} more`];
    }
  });
  return clean;
}

function summarizeResponse(body) {
  if (!body || typeof body !== 'object') return {};
  const { success, data, error, message } = body;
  return { success, error, message, id: data?.id || data?.invoice_number || data?.order_number };
}

module.exports = { universalEventMiddleware };
