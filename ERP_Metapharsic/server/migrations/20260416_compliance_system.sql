-- Migration: Compliance System (Drug Licenses, H1 Register, Cold Chain, Audits)

-- 1. Drug Licenses
CREATE TABLE IF NOT EXISTS drug_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_name VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    category VARCHAR(100),
    issuing_authority VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Valid', -- Valid, Expiring Soon, Expired, Cancelled
    document_url TEXT,
    company_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. H1 Register (Schedule H1 Drugs Tracking)
CREATE TABLE IF NOT EXISTS h1_register (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    drug_name VARCHAR(255) NOT NULL,
    batch_no VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    invoice_no VARCHAR(100),
    sales_invoice_id UUID, -- Optional link to sales_invoices
    pharmacist_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cold Chain / Temperature Logs
CREATE TABLE IF NOT EXISTS temperature_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    log_time TIME NOT NULL DEFAULT CURRENT_TIME,
    temperature DECIMAL(5,2) NOT NULL,
    unit VARCHAR(5) DEFAULT '°C',
    equipment_name VARCHAR(255) DEFAULT 'Main Refrigerator',
    checked_by VARCHAR(255),
    status VARCHAR(50) DEFAULT 'OK', -- OK, Warning, Critical
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Compliance Audits / Self-Inspections
CREATE TABLE IF NOT EXISTS compliance_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    auditor_name VARCHAR(255),
    score_percentage DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Reviewed
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Checklist Items
CREATE TABLE IF NOT EXISTS compliance_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_id UUID REFERENCES compliance_audits(id) ON DELETE CASCADE,
    requirement_text TEXT NOT NULL,
    is_compliant BOOLEAN DEFAULT FALSE,
    observation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX idx_licenses_expiry ON drug_licenses(expiry_date);
CREATE INDEX idx_h1_date ON h1_register(entry_date);
CREATE INDEX idx_h1_drug ON h1_register(drug_name);
CREATE INDEX idx_temp_logs_date ON temperature_logs(log_date);
