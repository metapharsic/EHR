-- Migration: 20260619_fix_crm_schema_final.sql
-- Description: Add missing CRM tables referenced by backend and seed scripts

-- 1. Create CRM Contacts Table (used in server/routes/crm.js)
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    designation VARCHAR(100),
    department VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    preferred_channel VARCHAR(50), -- EMAIL, PHONE, WHATSAPP, IN_PERSON
    is_decision_maker BOOLEAN DEFAULT FALSE,
    company_id INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create CRM Opportunities Table (used in seed scripts)
CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    stage VARCHAR(50) DEFAULT 'DISCOVERY', -- DISCOVERY, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
    value NUMERIC(15, 2) DEFAULT 0,
    probability INTEGER DEFAULT 0, -- 0 to 100
    expected_close_date DATE,
    source VARCHAR(100),
    company_id INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Views for backward compatibility (optional)
CREATE OR REPLACE VIEW crm_leads AS SELECT * FROM leads;
CREATE OR REPLACE VIEW crm_activities AS SELECT * FROM lead_activities;

-- 4. Ensure industry_type exists in leads (used in routes/crm.js)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100);
