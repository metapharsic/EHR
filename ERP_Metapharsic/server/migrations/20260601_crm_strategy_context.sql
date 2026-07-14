-- Migration: 20260601_crm_strategy_context.sql
-- Description: Add regional demand context for Agentic AI Strategy Generator

CREATE TABLE IF NOT EXISTS regional_pharmaceutical_demand (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g., 'Antibiotics', 'Vaccines', 'Cardiovascular'
    demand_index INTEGER CHECK (demand_index BETWEEN 1 AND 100),
    growth_trend VARCHAR(20), -- 'Rising', 'Stable', 'Declining'
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some initial demand data for the AI to analyze against
INSERT INTO regional_pharmaceutical_demand (region, category, demand_index, growth_trend) VALUES
('North', 'Antibiotics', 85, 'Rising'),
('North', 'Vaccines', 40, 'Stable'),
('South', 'Cardiovascular', 90, 'Rising'),
('East', 'General Wellness', 65, 'Stable'),
('West', 'Antibiotics', 70, 'Rising'),
('Central', 'Dermatology', 55, 'Declining')
ON CONFLICT DO NOTHING;
