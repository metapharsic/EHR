-- Migration: 20260602_oms_sla.sql
-- Description: Creates the oms_sla_rules configuration table and seeds default rules.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING.

-- ============================================
-- 1. oms_sla_rules TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS oms_sla_rules (
    id                   UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    status               VARCHAR(50)  NOT NULL,
    max_hours            INTEGER      NOT NULL,
    escalate_to_role     VARCHAR(50),
    severity             VARCHAR(20)  NOT NULL DEFAULT 'warning'
                                      CHECK (severity IN ('warning', 'critical', 'info')),
    notification_message TEXT,
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. UNIQUE CONSTRAINT on status (one rule per status)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'oms_sla_rules_status_key'
    ) THEN
        ALTER TABLE oms_sla_rules ADD CONSTRAINT oms_sla_rules_status_key UNIQUE (status);
    END IF;
END$$;

-- ============================================
-- 3. SEED DEFAULT RULES
-- ============================================
INSERT INTO oms_sla_rules (status, max_hours, escalate_to_role, severity, notification_message)
VALUES
    ('Pending Approval', 24,  'SALES_MANAGER',     'warning',  'Order has been pending approval for over 24 hours'),
    ('Approved',         48,  'INVENTORY_MANAGER', 'warning',  'Approved order has not been dispatched for over 48 hours'),
    ('Processing',       24,  'INVENTORY_MANAGER', 'critical', 'Order has been in Processing for over 24 hours without dispatch'),
    ('Partially Shipped',72,  'SALES_MANAGER',     'warning',  'Partial shipment is pending completion for over 72 hours')
ON CONFLICT (status) DO NOTHING;

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_oms_sla_rules_status
    ON oms_sla_rules (status);

CREATE INDEX IF NOT EXISTS idx_oms_sla_rules_active
    ON oms_sla_rules (is_active);
