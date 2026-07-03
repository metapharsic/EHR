/**
 * Cross-module Kafka consumers
 * Each consumer reacts to events from other modules and triggers
 * derived updates: balance recalc, stock decrement, analytics refresh, etc.
 */
const kafka = require('./kafka');
const db = require('../db');
const metrics = require('./metrics');

async function startAllConsumers(app) {
  const broadcastAll = app.get('broadcastAll');

  // ── 1. PARTY EVENTS consumer ──────────────────────────────────────────────
  // When a party is created/updated → update related sales/OMS stats
  await kafka.startConsumer(
    'erp-party-sync',
    ['erp.party.events'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-party-sync', 'PROCESSED');

      if (eventType.endsWith('UPDATED') && payload.entity_id) {
        // Sync current_balance into party record if response contains it
        const balance = payload.response_summary?.balance ?? payload.request_body?.current_balance;
        if (balance !== undefined) {
          await db.query(
            `UPDATE parties SET current_balance=$1, updated_at=NOW() WHERE id=$2`,
            [balance, payload.entity_id]
          ).catch(() => {});
        }
      }

      // Broadcast to all UIs: refresh party-dependent views
      broadcastAll?.({
        type: 'CACHE_INVALIDATE',
        module: payload.module || 'PARTY',
        event_type: eventType,
        entity_id: payload.entity_id,
        entity_type: payload.entity_type,
        invalidate_keys: ['/api/pos/parties', '/api/customers', '/api/sales', '/api/oms', '/api/crm'],
        timestamp: Date.now(),
      });
    }
  );

  // ── 2. INVOICE EVENTS consumer ────────────────────────────────────────────
  // Invoice created/updated/cancelled → update party outstanding balance + analytics
  await kafka.startConsumer(
    'erp-invoice-accounting',
    ['erp.invoices'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-invoice-accounting', 'PROCESSED');

      const partyId = payload.request_body?.party_id;
      const netAmount = parseFloat(payload.request_body?.net_amount || payload.response_summary?.net_amount || 0);

      if (partyId && netAmount) {
        if (eventType.includes('CREATED')) {
          // Add to party outstanding
          await db.query(
            `UPDATE parties SET current_balance = COALESCE(current_balance,0) + $1, updated_at=NOW() WHERE id=$2`,
            [netAmount, partyId]
          ).catch(() => {});
          metrics.recordInvoice(payload.module || 'SALES', payload.request_body?.payment_mode || 'Credit', netAmount);
        }
        if (eventType.includes('CANCELLED')) {
          // Reverse outstanding
          await db.query(
            `UPDATE parties SET current_balance = GREATEST(0, COALESCE(current_balance,0) - $1), updated_at=NOW() WHERE id=$2`,
            [netAmount, partyId]
          ).catch(() => {});
        }
      }

      broadcastAll?.({
        type: 'CACHE_INVALIDATE',
        module: 'SALES',
        event_type: eventType,
        invalidate_keys: ['/api/sales', '/api/sales/stats', '/api/analytics', '/api/accounting', '/api/pos/parties', '/api/customers'],
        timestamp: Date.now(),
      });
    }
  );

  // ── 3. PURCHASE EVENTS consumer ───────────────────────────────────────────
  // PO received → update stock ledger entry, notify inventory module
  await kafka.startConsumer(
    'erp-purchase-inventory',
    ['erp.purchases'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-purchase-inventory', 'PROCESSED');

      if (eventType.includes('RECEIVED') || eventType.includes('CREATED')) {
        metrics.recordPurchaseOrder('CREATED');
      }

      broadcastAll?.({
        type: 'CACHE_INVALIDATE',
        module: 'PURCHASE',
        event_type: eventType,
        invalidate_keys: ['/api/purchase', '/api/inventory', '/api/analytics', '/api/accounting', '/api/sales/products'],
        timestamp: Date.now(),
      });
    }
  );

  // ── 4. INVENTORY EVENTS consumer ─────────────────────────────────────────
  // Stock change → update stock alerts gauge, push low-stock check
  await kafka.startConsumer(
    'erp-inventory-alerts',
    ['erp.inventory', 'erp.stock.alerts'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-inventory-alerts', 'PROCESSED');

      // Refresh low stock count into Prometheus gauge
      try {
        const { rows } = await db.query(
          `SELECT COUNT(*) FROM batches WHERE available_qty <= 10 AND available_qty > 0`
        );
        metrics.setStockAlert('LOW_STOCK', parseInt(rows[0].count));
      } catch {}

      try {
        const { rows } = await db.query(
          `SELECT COUNT(*) FROM batches WHERE expiry_date <= NOW() + INTERVAL '60 days' AND expiry_date > NOW() AND available_qty > 0`
        );
        metrics.setStockAlert('EXPIRY_SOON', parseInt(rows[0].count));
      } catch {}

      broadcastAll?.({
        type: 'CACHE_INVALIDATE',
        module: 'INVENTORY',
        event_type: eventType,
        invalidate_keys: ['/api/inventory', '/api/sales/products', '/api/pos', '/api/purchase', '/api/oms'],
        timestamp: Date.now(),
      });

      // Push stock alert notification for low stock events
      if (eventType === 'LOW_STOCK' || eventType === 'EXPIRY_SOON') {
        broadcastAll?.({
          type: 'STOCK_ALERT',
          event_type: eventType,
          payload,
          timestamp: Date.now(),
        });
      }
    }
  );

  // ── 5. ORDER EVENTS consumer ──────────────────────────────────────────────
  // Order status change → update logistics, inventory reservation
  await kafka.startConsumer(
    'erp-order-sync',
    ['erp.orders'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-order-sync', 'PROCESSED');

      if (eventType.includes('CREATED')) metrics.recordOrder('CREATED');
      if (eventType.includes('APPROVED')) metrics.recordOrder('APPROVED');
      if (eventType.includes('DISPATCHED')) metrics.recordOrder('DISPATCHED');

      broadcastAll?.({
        type: 'CACHE_INVALIDATE',
        module: 'OMS',
        event_type: eventType,
        invalidate_keys: ['/api/oms', '/api/logistics', '/api/inventory', '/api/analytics', '/api/sales/stats'],
        timestamp: Date.now(),
      });
    }
  );

  // ── 6. AUDIT / BROADCAST consumer ────────────────────────────────────────
  // Generic audit events + broadcasts forwarded to all WebSocket clients
  await kafka.startConsumer(
    'erp-audit-logger',
    ['erp.audit', 'erp.notifications'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-audit-logger', 'PROCESSED');

      if (topic === 'erp.notifications') {
        broadcastAll?.({
          type: 'NOTIFICATION',
          event_type: eventType,
          payload,
          timestamp: Date.now(),
        });
      }
    }
  );

  console.log('[EventConsumers] All 6 cross-module consumers started');
}

module.exports = { startAllConsumers };
