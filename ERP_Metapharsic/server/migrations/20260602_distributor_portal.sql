-- Migration: 20260602_distributor_portal.sql
-- Description: Adds distributor self-service portal authentication columns to the parties table.
-- Safe to re-run: all statements use IF NOT EXISTS.

-- ============================================
-- 1. PORTAL COLUMNS ON parties
-- ============================================
ALTER TABLE parties ADD COLUMN IF NOT EXISTS portal_username      VARCHAR(100);
ALTER TABLE parties ADD COLUMN IF NOT EXISTS portal_password_hash VARCHAR(255);
ALTER TABLE parties ADD COLUMN IF NOT EXISTS portal_enabled       BOOLEAN DEFAULT FALSE;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS last_portal_login    TIMESTAMP;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS portal_token_hash    VARCHAR(255); -- for session management

-- ============================================
-- 2. UNIQUE CONSTRAINT on portal_username
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'parties_portal_username_key'
    ) THEN
        ALTER TABLE parties ADD CONSTRAINT parties_portal_username_key UNIQUE (portal_username);
    END IF;
END$$;

-- ============================================
-- 3. INDEX
-- ============================================
CREATE INDEX IF NOT EXISTS idx_parties_portal_username
    ON parties (portal_username)
    WHERE portal_username IS NOT NULL;
