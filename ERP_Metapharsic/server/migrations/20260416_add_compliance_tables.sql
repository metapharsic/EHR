-- Migration: Add Compliance & Regulatory Tables

-- Drug Licenses Table
CREATE TABLE IF NOT EXISTS drug_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    expiry_date DATE,
    category VARCHAR(100), -- Retail, Wholesale, Manufacturing, Food Safety, Tax
    status VARCHAR(50) DEFAULT 'Valid', -- Valid, Expiring Soon, Expired, Suspended
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- H1 Drug Register Table (For Schedule H1 Drugs)
CREATE TABLE IF NOT EXISTS h1_register (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE DEFAULT CURRENT_DATE,
    invoice_no VARCHAR(50),
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    drug_name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(50),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cold Chain / Temperature Log Table
CREATE TABLE IF NOT EXISTS temperature_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_date DATE DEFAULT CURRENT_DATE,
    log_time TIME DEFAULT CURRENT_TIME,
    temperature NUMERIC(4, 2) NOT NULL,
    checked_by VARCHAR(255),
    equipment_name VARCHAR(255) DEFAULT 'Main Refrigerator',
    status VARCHAR(50), -- OK, Warning, Critical
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit / Self-Inspection Checklist Table
CREATE TABLE IF NOT EXISTS compliance_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_date DATE DEFAULT CURRENT_DATE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    score_percentage NUMERIC(5, 2),
    performed_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Completed',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default Audit Items (Template)
CREATE TABLE IF NOT EXISTS compliance_checklist_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_text TEXT NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_drug_licenses_expiry ON drug_licenses(expiry_date);
CREATE INDEX idx_h1_register_date ON h1_register(entry_date);
CREATE INDEX idx_h1_register_drug ON h1_register(drug_name);
CREATE INDEX idx_temp_logs_date ON temperature_logs(log_date);
