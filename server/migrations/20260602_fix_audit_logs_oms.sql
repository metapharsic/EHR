-- Migration: 20260602_fix_audit_logs_oms.sql
-- Description: Adds missing columns to audit_logs table required by OMS SLA service

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- Optionally, add indexes for the new columns if needed
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
