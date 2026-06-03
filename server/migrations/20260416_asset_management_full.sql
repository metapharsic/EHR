-- Asset Management Comprehensive Tables
-- Tracks Machinery, Vehicles, and IT Infrastructure

-- 1. Asset Categories (Machinery, Vehicle, IT, etc.)
CREATE TABLE IF NOT EXISTS asset_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- Lucide icon name
    useful_life_years INTEGER,
    depreciation_rate NUMERIC(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Categories
INSERT INTO asset_categories (name, description, icon, useful_life_years, depreciation_rate) VALUES
('Machinery', 'Production and plant machinery', 'Cog', 10, 15.00),
('Vehicle', 'Company owned transport and logistics', 'Truck', 8, 20.00),
('IT', 'Laptops, Servers, and Networking infrastructure', 'Monitor', 3, 40.00),
('Furniture', 'Office furniture and fixtures', 'Layout', 10, 10.00)
ON CONFLICT (name) DO NOTHING;

-- 2. Enhanced Assets Table (Migration from basic fixed_assets if necessary)
-- We will add missing columns to fixed_assets or create a new view/table. 
-- For Metapharsic ERP, we'll extend fixed_assets with more operational fields.

ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES asset_categories(id);
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS model_no VARCHAR(100);
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS serial_no VARCHAR(100) UNIQUE;
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES parties(id);
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}';
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS last_maintenance_date DATE;
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS next_maintenance_date DATE;

-- 3. Maintenance Logs
CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE,
    maintenance_date DATE NOT NULL,
    type VARCHAR(50) NOT NULL, -- Preventive, Repair, Overhaul
    description TEXT,
    cost NUMERIC(15, 2) DEFAULT 0,
    performed_by VARCHAR(255),
    vendor_id UUID REFERENCES parties(id),
    status VARCHAR(50) DEFAULT 'Completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Insurance Policies
CREATE TABLE IF NOT EXISTS asset_insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE,
    policy_number VARCHAR(100) NOT NULL,
    insurance_company VARCHAR(255) NOT NULL,
    coverage_amount NUMERIC(15, 2) NOT NULL,
    premium_amount NUMERIC(15, 2) NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    documents_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Asset Transfers
CREATE TABLE IF NOT EXISTS asset_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE,
    from_location VARCHAR(255),
    to_location VARCHAR(255) NOT NULL,
    transfer_date DATE NOT NULL,
    reason TEXT,
    approved_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Asset Alerts
CREATE TABLE IF NOT EXISTS asset_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES fixed_assets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- Maintenance, Insurance, Warranty
    priority VARCHAR(20) DEFAULT 'Medium', -- High, Medium, Low
    message TEXT NOT NULL,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'Active', -- Active, Resolved, Dismissed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_category ON fixed_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON asset_maintenance_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_insurance_expiry ON asset_insurance_policies(expiry_date);
CREATE INDEX IF NOT EXISTS idx_transfers_asset ON asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON asset_alerts(status);
