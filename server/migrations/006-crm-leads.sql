-- Migration: 006-crm-leads.sql
-- Description: Create tables for CRM module (leads and lead_activities)

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    email VARCHAR(255),
    contact VARCHAR(20) NOT NULL,
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'New', -- New, Contacted, Qualified, Proposal, Negotiation, Converted, Lost, On Hold
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High, Urgent
    source VARCHAR(100), -- Website, Referral, Cold Call, etc.
    next_follow_up DATE,
    estimated_value NUMERIC(15, 2) DEFAULT 0,
    assigned_to UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Lead Activities Table
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- Call, Email, Meeting, Demo, etc.
    description TEXT,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration INTEGER, -- in minutes
    outcome TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_performed_at ON lead_activities(performed_at);
