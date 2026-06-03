-- Migration: Add CRM (Customer Relationship Management) Tables

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    source VARCHAR(100), -- Web, Referral, Trade Show, etc.
    status VARCHAR(50) DEFAULT 'New', -- New, Contacted, Qualified, Proposal, Won, Lost
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High
    assigned_to UUID REFERENCES users(id),
    last_contact_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interactions Table
CREATE TABLE IF NOT EXISTS lead_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50), -- Call, Email, Meeting, Note
    summary TEXT,
    next_follow_up DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_interactions_lead ON lead_interactions(lead_id);
