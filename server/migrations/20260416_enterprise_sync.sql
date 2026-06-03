-- 20260416_enterprise_sync.sql
-- Master sync for MFG, QC, R&D, and Multi-Branch Hub

-- 1. Multi-Branch Management
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Warehouse', -- Warehouse, Distribution, Retail
    location TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    manager VARCHAR(100),
    contact VARCHAR(20),
    is_hq BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Manufacturing (Production Orders & BOMs)
CREATE TABLE IF NOT EXISTS boms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id),
    version VARCHAR(20) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'Active', -- Active, Obsolete
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_no VARCHAR(50) UNIQUE NOT NULL,
    product_id UUID REFERENCES products(id),
    bom_id UUID REFERENCES boms(id),
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled', -- Scheduled, In Progress, Completed, Cancelled
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Quality Control (Testing & Parameters)
CREATE TABLE IF NOT EXISTS qc_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID REFERENCES production_orders(id),
    batch_number VARCHAR(50),
    test_date DATE DEFAULT CURRENT_DATE,
    tester_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Passed, Failed
    overall_result TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qc_report_id UUID REFERENCES qc_reports(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255), -- Assay, Dissolution, etc.
    specification VARCHAR(255),
    result_value VARCHAR(255),
    status VARCHAR(20) -- Pass, Fail
);

-- 4. R&D (Formulations & Experiments)
CREATE TABLE IF NOT EXISTS rnd_formulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(50), -- Tablet, Capsule, Liquid
    version VARCHAR(20) DEFAULT '1.0',
    stage VARCHAR(50) DEFAULT 'Ideation', -- Ideation, Lab Scale, Pilot, Stability, Ready for Mfg
    start_date DATE DEFAULT CURRENT_DATE,
    ingredients JSONB DEFAULT '[]', -- List of {material_id, name, qty_mg, cost_per_unit}
    target_cost NUMERIC(10, 4) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rnd_experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    formulation_id UUID REFERENCES rnd_formulations(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    assigned_to VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Scheduled', -- Scheduled, In Progress, Completed, Failed
    result_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_branches_name ON branches(name);
CREATE INDEX idx_mfg_order_no ON production_orders(order_no);
CREATE INDEX idx_qc_report_status ON qc_reports(status);
CREATE INDEX idx_rnd_form_name ON rnd_formulations(product_name);
