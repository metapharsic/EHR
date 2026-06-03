-- Migration: 20260610_hrms_foundation.sql
-- Description: HRMS Phase 0 — Core master tables + extend employees table.
--              Idempotent: safe to re-run.

-- ============================================
-- 1. DEPARTMENTS (Org Structure)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(30) UNIQUE,
    head_employee_id UUID,          -- FK added after employees extended
    parent_dept_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
    cost_center_id UUID REFERENCES cost_centers(id) ON DELETE SET NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. DESIGNATIONS (Job Titles + Grade Bands)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_designations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    grade VARCHAR(20),                 -- L1, L2 … L6, M1 … M3
    department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
    min_salary NUMERIC(12,2) DEFAULT 0,
    max_salary NUMERIC(12,2) DEFAULT 0,
    is_managerial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. SALARY STRUCTURES (CTC Templates)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_salary_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    grade VARCHAR(20),
    basic_pct NUMERIC(5,2) DEFAULT 50.00,     -- % of gross
    hra_pct NUMERIC(5,2) DEFAULT 20.00,        -- % of basic
    da_pct NUMERIC(5,2) DEFAULT 10.00,         -- % of basic
    special_allowance NUMERIC(12,2) DEFAULT 0, -- Fixed amount
    pf_applicable BOOLEAN DEFAULT TRUE,
    esic_applicable BOOLEAN DEFAULT TRUE,       -- auto-set based on gross ≤ 21000
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. LEAVE POLICIES
-- ============================================
CREATE TABLE IF NOT EXISTS hr_leave_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    leave_type VARCHAR(50) NOT NULL,      -- Sick, Casual, Earned, Unpaid, Maternity, Paternity, Compensatory
    annual_quota NUMERIC(5,1) DEFAULT 0,
    carry_forward_max NUMERIC(5,1) DEFAULT 0,
    encashable BOOLEAN DEFAULT FALSE,
    probation_blocked BOOLEAN DEFAULT TRUE, -- Cannot apply during probation
    gender_restricted VARCHAR(10),         -- M, F, NULL (for Maternity/Paternity)
    min_service_months INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. HOLIDAY CALENDARS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_holiday_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    year INTEGER NOT NULL,
    location VARCHAR(100) DEFAULT 'All',
    name VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    is_optional BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, year, location, date)
);

-- ============================================
-- 6. SHIFTS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INTEGER DEFAULT 10,
    weekly_off JSONB DEFAULT '["Sunday"]',   -- e.g. ["Saturday","Sunday"]
    is_night_shift BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. EMPLOYEE ↔ SHIFT ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_employee_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES hr_shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. EXTEND EMPLOYEES TABLE (Phase 0 additions)
-- ============================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_code VARCHAR(30);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_structure_id UUID REFERENCES hr_salary_structures(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'Permanent'; -- Permanent, Contract, Probation, Intern
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhar_last4 VARCHAR(4);     -- Store only last 4 digits
ALTER TABLE employees ADD COLUMN IF NOT EXISTS uan VARCHAR(20);              -- PF Universal Account Number
ALTER TABLE employees ADD COLUMN IF NOT EXISTS esic_ip_number VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account_encrypted TEXT;  -- Encrypted via app-level AES
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(15);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_location VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS probation_end_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS confirmation_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS exit_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS exit_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ctc NUMERIC(14,2) DEFAULT 0;

-- Add dept head FK now that hr_departments exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='hr_departments' AND column_name='head_employee_id'
    ) THEN
        ALTER TABLE hr_departments ADD COLUMN head_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
    ELSE
        -- Column exists but may not have FK yet; attempt silently
        BEGIN
            ALTER TABLE hr_departments ADD CONSTRAINT fk_dept_head
                FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END$$;

-- Unique employee_code per company
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_employee_code'
    ) THEN
        ALTER TABLE employees ADD CONSTRAINT uq_employee_code UNIQUE (employee_code);
    END IF;
END$$;

-- ============================================
-- 9. STATUTORY CONFIG (Tax Slabs — NEVER hardcode in code)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_statutory_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    config_type VARCHAR(50) NOT NULL,   -- PT_SLAB, PF_CEILING, ESIC_CEILING, TDS_SLAB
    state VARCHAR(50),
    fiscal_year VARCHAR(10),            -- e.g. 2026-27
    config_data JSONB NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, config_type, state, fiscal_year)
);

-- Seed default statutory configs for FY 2026-27
INSERT INTO hr_statutory_config (company_id, config_type, state, fiscal_year, config_data, effective_from)
VALUES
(1, 'PF_CEILING',  NULL, '2026-27', '{"wage_ceiling": 15000, "ee_rate": 12, "er_epf_rate": 3.67, "er_eps_rate": 8.33, "edli_rate": 0.5}', '2026-04-01'),
(1, 'ESIC_CEILING', NULL, '2026-27', '{"gross_ceiling": 21000, "ee_rate": 0.75, "er_rate": 3.25}', '2026-04-01'),
(1, 'PT_SLAB', 'Maharashtra', '2026-27', '{"slabs":[{"min":0,"max":7500,"pt":0},{"min":7501,"max":10000,"pt":175},{"min":10001,"max":null,"pt":200}]}', '2026-04-01'),
(1, 'PT_SLAB', 'Karnataka', '2026-27', '{"slabs":[{"min":0,"max":15000,"pt":0},{"min":15001,"max":null,"pt":200}]}', '2026-04-01'),
(1, 'TDS_SLAB', NULL, '2026-27', '{"new_regime":[{"min":0,"max":400000,"rate":0},{"min":400001,"max":800000,"rate":5},{"min":800001,"max":1200000,"rate":10},{"min":1200001,"max":1600000,"rate":15},{"min":1600001,"max":2000000,"rate":20},{"min":2000001,"max":2400000,"rate":25},{"min":2400001,"max":null,"rate":30}],"standard_deduction":75000}', '2026-04-01')
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. SEED DEFAULT SHIFT
-- ============================================
INSERT INTO hr_shifts (company_id, name, start_time, end_time, grace_minutes, weekly_off)
VALUES (1, 'General Shift', '09:00', '18:00', 15, '["Sunday"]')
ON CONFLICT DO NOTHING;

-- ============================================
-- 11. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hr_depts_company ON hr_departments(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_desig_dept ON hr_designations(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_manager ON employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_hr_shifts_company ON hr_shifts(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_shifts_emp ON hr_employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_holiday_year ON hr_holiday_calendars(company_id, year);
CREATE INDEX IF NOT EXISTS idx_hr_leave_policy_type ON hr_leave_policies(company_id, leave_type);

-- ============================================
-- 12. updated_at TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION fn_hrms_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_departments_updated_at ON hr_departments;
CREATE TRIGGER trg_hr_departments_updated_at BEFORE UPDATE ON hr_departments FOR EACH ROW EXECUTE FUNCTION fn_hrms_touch_updated_at();

DROP TRIGGER IF EXISTS trg_hr_salary_structures_updated_at ON hr_salary_structures;
CREATE TRIGGER trg_hr_salary_structures_updated_at BEFORE UPDATE ON hr_salary_structures FOR EACH ROW EXECUTE FUNCTION fn_hrms_touch_updated_at();
