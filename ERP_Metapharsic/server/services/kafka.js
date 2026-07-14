/**
 * Kafka Service — ERP event bus
 * Topics: erp.invoices, erp.inventory, erp.orders, erp.purchases,
 *         erp.broadcasts, erp.audit, erp.notifications, erp.stock.alerts, erp.party.events
 */
const { Kafka, Partitioners, logLevel } = require('kafkajs');
const db = require('../db');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'metapharsic-erp';

const kafka = new Kafka({
  clientId: CLIENT_ID,
  brokers: BROKERS,
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 300, retries: 8 },
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
  allowAutoTopicCreation: false,
});

let producerConnected = false;

async function connectProducer() {
  if (producerConnected) return;
  await producer.connect();
  producerConnected = true;
}

/**
 * Publish event to Kafka + persist to kafka_events table.
 * @param {string} topic  - e.g. 'erp.invoices'
 * @param {string} eventType - e.g. 'INVOICE_CREATED'
 * @param {string} module - e.g. 'SALES'
 * @param {object} payload
 * @param {object} opts   - { entityId, entityType, producedBy, partitionKey }
 */
async function publish(topic, eventType, module, payload, opts = {}) {
  const { entityId, entityType, producedBy, partitionKey } = opts;
  const event = {
    event_id: undefined, // set after DB insert
    topic, event_type: eventType, module,
    entity_id: entityId || null, entity_type: entityType || null,
    payload, produced_by: producedBy || null,
    partition_key: partitionKey || entityId || null,
  };

  // Persist first (write-ahead)
  let dbRow;
  try {
    const res = await db.query(
      `INSERT INTO kafka_events (topic, event_type, module, entity_id, entity_type, payload, produced_by, partition_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING') RETURNING event_id, id`,
      [topic, eventType, module, event.entity_id, event.entity_type,
       JSON.stringify(payload), event.produced_by, event.partition_key]
    );
    dbRow = res.rows[0];
    event.event_id = dbRow.event_id;
  } catch (dbErr) {
    console.error('[Kafka] DB persist failed', dbErr.message);
    // Still try Kafka even if DB fails
  }

  // Send to Kafka
  let kafkaOffset = null, kafkaPartition = null;
  try {
    await connectProducer();
    const result = await producer.send({
      topic,
      messages: [{
        key: event.partition_key || eventType,
        value: JSON.stringify({ event_id: event.event_id, event_type: eventType, module, payload, ts: Date.now() }),
        headers: { eventType, module, producedBy: producedBy || 'system' },
      }],
    });
    kafkaOffset = result[0]?.baseOffset;
    kafkaPartition = result[0]?.partition;
  } catch (kafkaErr) {
    console.error('[Kafka] Produce failed', kafkaErr.message);
    if (dbRow) {
      await db.query(
        `UPDATE kafka_events SET status='FAILED', error_msg=$1 WHERE event_id=$2`,
        [kafkaErr.message, dbRow.event_id]
      ).catch(() => {});
    }
    return null;
  }

  // Update DB with Kafka offset
  if (dbRow) {
    await db.query(
      `UPDATE kafka_events SET status='PRODUCED', kafka_offset=$1, kafka_partition=$2 WHERE event_id=$3`,
      [kafkaOffset, kafkaPartition, dbRow.event_id]
    ).catch(() => {});
  }

  return event.event_id;
}

/**
 * Broadcast a message to all ERP users via Kafka + DB.
 */
async function broadcast(title, message, opts = {}) {
  const { type = 'INFO', channel = 'ALL', targetRoles = [], targetUsers = [], payload = {}, sentBy, expiresAt } = opts;

  const eventId = await publish('erp.broadcasts', 'BROADCAST_SENT', 'SYSTEM', { title, message, type, channel, targetRoles, targetUsers, payload }, { producedBy: sentBy });

  try {
    await db.query(
      `INSERT INTO kafka_broadcasts (channel, title, message, broadcast_type, target_roles, target_users, payload, sent_by, expires_at, kafka_event_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [channel, title, message, type, JSON.stringify(targetRoles), JSON.stringify(targetUsers),
       JSON.stringify(payload), sentBy || 'system', expiresAt || null, eventId]
    );
  } catch (e) {
    console.error('[Kafka] Broadcast DB persist failed', e.message);
  }

  return eventId;
}

/**
 * Module-specific publish helpers
 */
const events = {
  invoice: {
    created:   (inv, user) => publish('erp.invoices',   'INVOICE_CREATED',   'SALES',     inv, { entityId: String(inv.id), entityType: 'invoice', producedBy: user }),
    updated:   (inv, user) => publish('erp.invoices',   'INVOICE_UPDATED',   'SALES',     inv, { entityId: String(inv.id), entityType: 'invoice', producedBy: user }),
    cancelled: (inv, user) => publish('erp.invoices',   'INVOICE_CANCELLED', 'SALES',     inv, { entityId: String(inv.id), entityType: 'invoice', producedBy: user }),
  },
  inventory: {
    stockIn:     (item, user) => publish('erp.inventory', 'STOCK_IN',         'INVENTORY', item, { entityId: String(item.product_id), entityType: 'product', producedBy: user }),
    stockOut:    (item, user) => publish('erp.inventory', 'STOCK_OUT',        'INVENTORY', item, { entityId: String(item.product_id), entityType: 'product', producedBy: user }),
    lowStock:    (item)       => publish('erp.stock.alerts', 'LOW_STOCK',     'INVENTORY', item, { entityId: String(item.product_id), entityType: 'product' }),
    expirySoon:  (item)       => publish('erp.stock.alerts', 'EXPIRY_SOON',   'INVENTORY', item, { entityId: String(item.product_id), entityType: 'product' }),
  },
  order: {
    created:    (order, user) => publish('erp.orders',    'ORDER_CREATED',    'OMS',       order, { entityId: String(order.id), entityType: 'order', producedBy: user }),
    approved:   (order, user) => publish('erp.orders',    'ORDER_APPROVED',   'OMS',       order, { entityId: String(order.id), entityType: 'order', producedBy: user }),
    dispatched: (order, user) => publish('erp.orders',    'ORDER_DISPATCHED', 'OMS',       order, { entityId: String(order.id), entityType: 'order', producedBy: user }),
  },
  purchase: {
    created:    (po, user) => publish('erp.purchases',    'PO_CREATED',       'PURCHASE',  po, { entityId: String(po.id), entityType: 'purchase_order', producedBy: user }),
    received:   (po, user) => publish('erp.purchases',    'PO_RECEIVED',      'PURCHASE',  po, { entityId: String(po.id), entityType: 'purchase_order', producedBy: user }),
  },
  party: {
    created: (party, user) => publish('erp.party.events', 'PARTY_CREATED',   'CRM',       party, { entityId: String(party.id), entityType: 'party', producedBy: user }),
    updated: (party, user) => publish('erp.party.events', 'PARTY_UPDATED',   'CRM',       party, { entityId: String(party.id), entityType: 'party', producedBy: user }),
  },
  audit: {
    log: (action, module, user, meta) => publish('erp.audit', action, module, meta, { producedBy: user }),
  },
};

/**
 * Start a consumer group.
 * @param {string} groupId
 * @param {string[]} topics
 * @param {function} handler - async (topic, eventType, payload, rawMsg) => void
 */
async function startConsumer(groupId, topics, handler) {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  for (const t of topics) await consumer.subscribe({ topic: t, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let parsed;
      try {
        parsed = JSON.parse(message.value.toString());
      } catch {
        return;
      }
      const { event_id, event_type, payload } = parsed;

      // Log consumption
      let logId;
      try {
        const r = await db.query(
          `INSERT INTO kafka_consumer_log (event_id, consumer_group, topic, partition, kafka_offset, status)
           VALUES ($1,$2,$3,$4,$5,'CONSUMED') RETURNING id`,
          [event_id || null, groupId, topic, partition, message.offset]
        );
        logId = r.rows[0]?.id;
      } catch {}

      try {
        await handler(topic, event_type, payload || {}, parsed);
        if (logId) {
          await db.query(
            `UPDATE kafka_consumer_log SET status='PROCESSED', processed_at=NOW() WHERE id=$1`, [logId]
          ).catch(() => {});
        }
      } catch (err) {
        console.error(`[Kafka Consumer:${groupId}] Handler failed`, err.message);
        if (logId) {
          await db.query(
            `UPDATE kafka_consumer_log SET status='FAILED', error_msg=$1, retry_count=retry_count+1 WHERE id=$2`,
            [err.message, logId]
          ).catch(() => {});
        }
      }
    },
  });

  console.log(`[Kafka] Consumer "${groupId}" subscribed to: ${topics.join(', ')}`);
  return consumer;
}

async function disconnect() {
  if (producerConnected) await producer.disconnect().catch(() => {});
  producerConnected = false;
}

module.exports = { publish, broadcast, events, startConsumer, disconnect };
