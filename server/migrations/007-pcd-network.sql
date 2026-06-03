-- Migration: 007-pcd-network.sql
-- Description: Create tables for PCD (Propaganda Cum Distribution) Network Management

-- 1. PCD Partners Table (Stockists/Franchisees)
CREATE TABLE IF NOT EXISTS pcd_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    territory VARCHAR(100) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    drug_license_no VARCHAR(100),
    gstin VARCHAR(20),
    address TEXT,
    credit_limit NUMERIC(15, 2) DEFAULT 0,
    payment_terms VARCHAR(50) DEFAULT '30 Days',
    status VARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Blocked
    join_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Medical Representatives (MRs) Table
CREATE TABLE IF NOT EXISTS medical_representatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    headquarters VARCHAR(100),
    assigned_area VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Active', -- Active, On Leave, Inactive
    join_date DATE DEFAULT CURRENT_DATE,
    base_salary NUMERIC(15, 2) DEFAULT 0,
    fixed_allowances NUMERIC(15, 2) DEFAULT 0,
    sales_target NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PCD Partner - MR Assignment (Many-to-Many)
CREATE TABLE IF NOT EXISTS pcd_partner_mrs (
    partner_id UUID REFERENCES pcd_partners(id) ON DELETE CASCADE,
    mr_id UUID REFERENCES medical_representatives(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (partner_id, mr_id)
);

-- 4. PCD Schemes & Offers
CREATE TABLE IF NOT EXISTS pcd_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    scheme_code VARCHAR(50),
    description TEXT,
    type VARCHAR(50) NOT NULL, -- Volume, Value, Product
    valid_until DATE,
    minimum_order NUMERIC(15, 2) DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    free_products TEXT,
    eligibility_criteria TEXT,
    bonus_incentives TEXT,
    target_products TEXT,
    terms TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. PCD Performance Targets
CREATE TABLE IF NOT EXISTS pcd_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    partner_id UUID REFERENCES pcd_partners(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL, -- e.g., 'Q3 2023', 'Oct 2023'
    target_amount NUMERIC(15, 2) NOT NULL,
    achieved_amount NUMERIC(15, 2) DEFAULT 0,
    incentive_percentage NUMERIC(5, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Achieved, Failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. PCD Transactions (Field Force Reporting)
CREATE TABLE IF NOT EXISTS pcd_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    mr_id UUID REFERENCES medical_representatives(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES pcd_partners(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    chemist_name VARCHAR(255),
    area VARCHAR(100),
    product_name VARCHAR(255),
    quantity INTEGER DEFAULT 0,
    amount NUMERIC(15, 2) DEFAULT 0,
    category VARCHAR(50) DEFAULT 'PCD', -- PCD, Metapharsic
    status VARCHAR(20) DEFAULT 'Verified', -- Pending, Verified, Rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pcd_partners_status ON pcd_partners(status);
CREATE INDEX IF NOT EXISTS idx_pcd_partners_territory ON pcd_partners(territory);
CREATE INDEX IF NOT EXISTS idx_mrs_status ON medical_representatives(status);
CREATE INDEX IF NOT EXISTS idx_pcd_targets_partner ON pcd_targets(partner_id);
CREATE INDEX IF NOT EXISTS idx_pcd_targets_period ON pcd_targets(period);
CREATE INDEX IF NOT EXISTS idx_pcd_transactions_mr ON pcd_transactions(mr_id);
CREATE INDEX IF NOT EXISTS idx_pcd_transactions_date ON pcd_transactions(date);
