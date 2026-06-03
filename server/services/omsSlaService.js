/**
 * server/services/omsSlaService.js
 * OMS SLA monitoring service — runs every 2 hours, checks orders against oms_sla_rules,
 * and logs breaches to audit_logs.
 */

'use strict';

const db = require('../db');
const logger = require('../utils/logger');

const SLA_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in ms
let slaInterval = null;

// Statuses that represent a completed / terminal order — excluded from SLA checks
const TERMINAL_STATUSES = ['Delivered', 'Invoiced', 'Rejected', 'Cancelled'];

/**
 * Queries all active SLA rules, finds orders that breach them, and logs each
 * breach to the audit_logs table.
 */
async function checkSlaBreaches() {
    logger.info('OMS SLA check started');

    let rulesResult;
    try {
        rulesResult = await db.query(
            `SELECT id, status, max_hours, escalate_to_role, severity, notification_message
             FROM oms_sla_rules
             WHERE is_active = TRUE`
        );
    } catch (err) {
        logger.error('OMS SLA: Failed to fetch SLA rules', { error: err.message });
        return;
    }

    const rules = rulesResult.rows;
    if (rules.length === 0) {
        logger.info('OMS SLA: No active SLA rules found');
        return;
    }

    let totalBreaches = 0;

    for (const rule of rules) {
        let breachedOrders;
        try {
            const result = await db.query(
                `SELECT
                    o.id,
                    o.order_number,
                    o.distributor_id,
                    o.distributor_name,
                    o.status,
                    o.priority,
                    o.created_at,
                    ROUND(EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600, 1) AS hours_open
                 FROM orders o
                 WHERE o.status = $1
                   AND o.status NOT IN (${TERMINAL_STATUSES.map((_, i) => `$${i + 2}`).join(', ')})
                   AND EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 > $${TERMINAL_STATUSES.length + 2}`,
                [rule.status, ...TERMINAL_STATUSES, rule.max_hours]
            );
            breachedOrders = result.rows;
        } catch (err) {
            logger.error('OMS SLA: Failed to query breached orders', { rule: rule.status, error: err.message });
            continue;
        }

        for (const order of breachedOrders) {
            totalBreaches++;
            const details = {
                ruleId: rule.id,
                orderId: order.id,
                orderNumber: order.order_number,
                distributorId: order.distributor_id,
                distributorName: order.distributor_name,
                status: order.status,
                priority: order.priority,
                hoursOpen: Number(order.hours_open),
                maxHours: rule.max_hours,
                severity: rule.severity,
                escalateTo: rule.escalate_to_role,
                message: rule.notification_message,
                checkedAt: new Date().toISOString()
            };

            // Log to audit_logs — gracefully handles missing optional columns
            try {
                await db.query(
                    `INSERT INTO audit_logs (action, entity_type, entity_id, details, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [
                        'OMS_SLA_BREACH',
                        'Order',
                        order.id,
                        JSON.stringify(details)
                    ]
                );
            } catch (auditErr) {
                // audit_logs schema may differ — attempt with fewer columns
                try {
                    await db.query(
                        `INSERT INTO audit_logs (action, details, created_at)
                         VALUES ($1, $2, NOW())`,
                        ['OMS_SLA_BREACH', JSON.stringify(details)]
                    );
                } catch (fallbackErr) {
                    // If audit_logs is not available at all, just log
                    logger.warn('OMS SLA: Could not write to audit_logs', { error: fallbackErr.message });
                }
            }

            logger.warn('OMS SLA breach detected', {
                orderNumber: order.order_number,
                status: order.status,
                hoursOpen: order.hours_open,
                maxHours: rule.max_hours,
                severity: rule.severity,
                escalateTo: rule.escalate_to_role
            });
        }
    }

    logger.info(`OMS SLA check complete — ${totalBreaches} breach(es) logged`);
}

/**
 * Starts the SLA cron — fires immediately then every SLA_CHECK_INTERVAL ms.
 * @returns {NodeJS.Timeout} the interval handle
 */
function startSlaCron() {
    logger.info('OMS SLA service started', { intervalMs: SLA_CHECK_INTERVAL });

    // Run once immediately at startup
    checkSlaBreaches().catch(e => logger.error('OMS SLA initial check failed', { error: e.message }));

    slaInterval = setInterval(() => {
        checkSlaBreaches().catch(e => logger.error('OMS SLA check failed', { error: e.message }));
    }, SLA_CHECK_INTERVAL);

    return slaInterval;
}

/**
 * Stops the SLA cron interval.
 */
function stopSlaCron() {
    if (slaInterval) {
        clearInterval(slaInterval);
        slaInterval = null;
        logger.info('OMS SLA service stopped');
    }
}

module.exports = { startSlaCron, stopSlaCron, checkSlaBreaches };
