/**
 * Cross-module Kafka consumers
 * Each consumer reacts to events from other modules and triggers
 * derived updates: balance recalc, stock decrement, analytics refresh, etc.
 */
const kafka = require('./kafka');
const db = require('../db');
const metrics = require('./metrics');
const accountingSync = require('./accountingSync');

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
      const companyId = payload.company_id || 1;
      const documentId = payload.entity_id || payload.response_summary?.id;

      if (partyId && netAmount) {
        if (eventType.includes('CREATED')) {
          await db.query(
            `UPDATE parties SET current_balance = COALESCE(current_balance,0) + $1, updated_at=NOW() WHERE id=$2`,
            [netAmount, partyId]
          ).catch(() => {});
          metrics.recordInvoice(payload.module || 'SALES', payload.request_body?.payment_mode || 'Credit', netAmount);
        }
        if (eventType.includes('CANCELLED')) {
          await db.query(
            `UPDATE parties SET current_balance = GREATEST(0, COALESCE(current_balance,0) - $1), updated_at=NOW() WHERE id=$2`,
            [netAmount, partyId]
          ).catch(() => {});
        }
      }

      // Auto-post GL entry for this invoice
      if (documentId && eventType.includes('CREATED')) {
        // POS invoices live in sales_invoices too (not pos_bills) and already post GL
        // in real time, so syncing them is a safe no-op guarded by the INV-* skip in accountingSync.
        const sourceTable = 'sales_invoices';
        accountingSync.syncDocument(companyId, sourceTable, documentId)
          .catch(e => console.error(`[EventConsumers] GL sync failed for ${sourceTable} ${documentId}:`, e.message));
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
        // Auto-post GL for purchase
        const companyId = payload.company_id || 1;
        const documentId = payload.entity_id || payload.response_summary?.id;
        if (documentId) {
          accountingSync.syncDocument(companyId, 'purchase_orders', documentId)
            .catch(e => console.error(`[EventConsumers] GL sync failed for purchase_orders ${documentId}:`, e.message));
        }
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

  // ── 6. AUDIT / BROADCAST / DMS consumer ─────────────────────────────────────
  // Generic audit events + broadcasts + document changes forwarded to clients
  await kafka.startConsumer(
    'erp-audit-logger',
    ['erp.audit', 'erp.notifications', 'erp.documents'],
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

      if (topic === 'erp.documents') {
        broadcastAll?.({
          type: 'CACHE_INVALIDATE',
          module: 'DMS',
          event_type: eventType,
          invalidate_keys: ['/api/dms'],
          timestamp: Date.now(),
        });
      }
    }
  );

  // ── 7. HR EVENTS consumer ─────────────────────────────────────────────────
  // Employee/attendance/leave/payroll changes → refresh HR views + notify
  // dependent modules (PCD medical reps derive from employees, Assets track
  // employee allocations, Accounting reflects payroll GL).
  await kafka.startConsumer(
    'erp-hr-sync',
    ['erp.hr'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-hr-sync', 'PROCESSED');

      if (eventType.includes('payroll')) {
        // Payroll run changes salary_slips + GL — refresh accounting too
        broadcastAll?.({
          type: 'CACHE_INVALIDATE',
          module: 'HR',
          event_type: eventType,
          invalidate_keys: ['/api/hr', '/api/accounting', '/api/reports'],
          timestamp: Date.now(),
        });
      } else {
        broadcastAll?.({
          type: 'CACHE_INVALIDATE',
          module: 'HR',
          event_type: eventType,
          invalidate_keys: ['/api/hr', '/api/pcd', '/api/assets'],
          timestamp: Date.now(),
        });
      }
    }
  );

  // ── 8. USER MANAGEMENT / RBAC consumer ──────────────────────────────────
  // Role/permission edits invalidate the in-process permission cache and push
  // a live CACHE_INVALIDATE so an affected user's sidebar/permissions refresh
  // without forcing a full logout.
  await kafka.startConsumer(
    'erp-user-sync',
    ['erp.users'],
    async (topic, eventType, payload) => {
      metrics.recordConsumed(topic, eventType, 'erp-user-sync', 'PROCESSED');
      const { invalidateRole } = require('../middleware/rbac');
      if (payload?.roleId) invalidateRole(payload.roleId);

      broadcastAll?.({
        type: 'CACHE_INVALIDATE',
        module: 'USER_MANAGEMENT',
        event_type: eventType,
        invalidate_keys: ['/api/admin', '/api/auth/me'],
        timestamp: Date.now(),
      });
    }
  );

  console.log('[EventConsumers] All 8 cross-module consumers started');
}

module.exports = { startAllConsumers };
