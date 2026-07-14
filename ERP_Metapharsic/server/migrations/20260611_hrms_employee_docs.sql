-- Migration: 20260611_hrms_employee_docs.sql
-- Description: HRMS Phase 1 — Employee documents, custom fields, org chart support.

-- ============================================
-- 1. EMPLOYEE DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    doc_type VARCHAR(80) NOT NULL,   -- Offer Letter, ID Proof, PAN Card, Aadhar, Degree, Experience Letter, Appointment Letter, Resignation, etc.
    doc_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,               -- bytes
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMP,
    expiry_date DATE,
    remarks TEXT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. CUSTOM FIELDS MASTER
-- ============================================
CREATE TABLE IF NOT EXISTS hr_custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    entity_type VARCHAR(50) NOT NULL,   -- employee, candidate, department
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    field_type VARCHAR(30) NOT NULL,    -- text, number, date, select, boolean
    options JSONB,                      -- for select type: ["Option1","Option2"]
    is_required BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, entity_type, field_name)
);

-- ============================================
-- 3. CUSTOM FIELD VALUES
-- ============================================
CREATE TABLE IF NOT EXISTS hr_custom_field_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    field_id UUID REFERENCES hr_custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, field_id)
);

-- ============================================
-- 4. EMPLOYEE TIMELINE (Audit log for HR events)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_employee_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    event_type VARCHAR(80) NOT NULL,   -- Joined, Promoted, Department Transfer, Salary Revision, Warned, Terminated, etc.
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    old_value TEXT,
    new_value TEXT,
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hr_emp_docs_employee ON hr_employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_docs_type ON hr_employee_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_hr_cfv_entity ON hr_custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hr_timeline_employee ON hr_employee_timeline(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_timeline_event ON hr_employee_timeline(event_type);
