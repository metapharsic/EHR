-- Migration: 20260601_pcd_geospatial_intelligence.sql
-- Description: Add geospatial coordinates for mapping network coverage and overlap

-- 1. Add coordinates to PCD Partners
ALTER TABLE pcd_partners ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8);
ALTER TABLE pcd_partners ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

-- 2. Add coordinates to Regional Demand
ALTER TABLE regional_pharmaceutical_demand ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8);
ALTER TABLE regional_pharmaceutical_demand ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);
ALTER TABLE regional_pharmaceutical_demand ADD COLUMN IF NOT EXISTS radius_km INTEGER DEFAULT 50;

-- 3. Update existing demand data with coordinates (Centroids for AI logic)
UPDATE regional_pharmaceutical_demand SET latitude = 21.1458, longitude = 79.0882, radius_km = 150 WHERE region = 'North'; -- Simulating Vidarbha center
UPDATE regional_pharmaceutical_demand SET latitude = 18.5204, longitude = 73.8567, radius_km = 40 WHERE region = 'West';   -- Simulating Pune center
UPDATE regional_pharmaceutical_demand SET latitude = 20.0059, longitude = 73.7898, radius_km = 60 WHERE region = 'Central'; -- Simulating Nashik center

-- 4. Create a table for AI Geospatial Insights (to persist detected issues)
CREATE TABLE IF NOT EXISTS pcd_geospatial_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- 'UNDERSERVED', 'CANNIBALIZATION', 'OPTIMAL'
    region_name VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20), -- 'CRITICAL', 'WARNING', 'STABLE'
    metadata JSONB, -- Store partner IDs, specific distances, etc.
    last_analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
