-- Migration: 20260601_crm_ai_sync.sql
-- Description: Enhance CRM schema with AI features and cross-module synchronization

-- 1. Enhance Leads table with AI and Sync fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_sentiment VARCHAR(20) DEFAULT 'Neutral';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_party_id UUID REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100); -- Pharmacy, Hospital, Clinic, Distributor, PCD Partner
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;

-- 2. Create Lead Product Interests (Links CRM to Inventory)
CREATE TABLE IF NOT EXISTS lead_product_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    interest_level VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lead_id, product_id)
);

-- 3. Create Lead Sample Requests (Links CRM to Inventory & Godowns)
CREATE TABLE IF NOT EXISTS lead_sample_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    godown_id UUID REFERENCES godowns(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Requested', -- Requested, Approved, Dispatched, Delivered, Cancelled
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes for Synchronization Performance
CREATE INDEX IF NOT EXISTS idx_leads_converted_party ON leads(converted_party_id);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry_type);
CREATE INDEX IF NOT EXISTS idx_lpi_lead ON lead_product_interests(lead_id);
CREATE INDEX IF NOT EXISTS idx_lsr_lead ON lead_sample_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_lsr_status ON lead_sample_requests(status);

-- 5. Trigger to update last_activity_at in leads when an activity is logged
CREATE OR REPLACE FUNCTION fn_update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE leads SET last_activity_at = NEW.performed_at, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.lead_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_lead_activity ON lead_activities;
CREATE TRIGGER trg_update_lead_activity
AFTER INSERT ON lead_activities
FOR EACH ROW
EXECUTE FUNCTION fn_update_lead_last_activity();
