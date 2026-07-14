-- Migration: 20260615_hrms_payroll_v2.sql
-- Description: HRMS Phase 5 — Payroll Engine v2, Statutory Registers, Increments, Bonuses, Benefits

-- ============================================
-- 1. EXTEND salary_slips
-- ============================================
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS lop_days NUMERIC(5,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS lop_deduction NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(6,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS leave_encashment_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS reimbursement_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS arrears NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS gratuity_provision NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS pf_employer NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS esic_employer NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS pt_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS working_days INTEGER DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS present_days INTEGER DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS leave_days NUMERIC(5,1) DEFAULT 0;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS tds_regime VARCHAR(10) DEFAULT 'New';    -- Old, New
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'Pending'; -- Pending, Paid, Failed
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS bank_transfer_ref VARCHAR(100);
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS form16_generated BOOLEAN DEFAULT FALSE;
ALTER TABLE salary_slips ADD COLUMN IF NOT EXISTS payslip_url TEXT;

-- ============================================
-- 2. PF REGISTER (ECR Format)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_pf_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    uan VARCHAR(20),
    wages NUMERIC(12,2) NOT NULL,               -- Capped at PF ceiling
    ee_epf_contribution NUMERIC(10,2) NOT NULL,  -- 12% EE
    er_epf_contribution NUMERIC(10,2) NOT NULL,  -- 3.67% ER
    er_eps_contribution NUMERIC(10,2) NOT NULL,  -- 8.33% ER
    edli_contribution NUMERIC(10,2) DEFAULT 0,   -- 0.5% ER
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, month, year)
);

-- ============================================
-- 3. ESIC REGISTER
-- ============================================
CREATE TABLE IF NOT EXISTS hr_esic_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    esic_ip_number VARCHAR(20),
    gross_wages NUMERIC(12,2) NOT NULL,
    ee_contribution NUMERIC(10,2) NOT NULL,      -- 0.75%
    er_contribution NUMERIC(10,2) NOT NULL,      -- 3.25%
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, month, year)
);

-- ============================================
-- 4. PROFESSIONAL TAX REGISTER
-- ============================================
CREATE TABLE IF NOT EXISTS hr_pt_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    state VARCHAR(50),
    gross_salary NUMERIC(12,2) NOT NULL,
    pt_amount NUMERIC(8,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, month, year)
);

-- ============================================
-- 5. TDS WORKINGS (Section 192)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_tds_workings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    fiscal_year VARCHAR(10) NOT NULL,          -- 2026-27
    regime VARCHAR(10) DEFAULT 'New',
    projected_gross NUMERIC(14,2) DEFAULT 0,
    hra_exemption NUMERIC(12,2) DEFAULT 0,
    standard_deduction NUMERIC(12,2) DEFAULT 75000,
    deductions_80c NUMERIC(12,2) DEFAULT 0,    -- PF, LIC, ELSS etc.
    deductions_80d NUMERIC(12,2) DEFAULT 0,    -- Health insurance
    other_deductions NUMERIC(12,2) DEFAULT 0,
    taxable_income NUMERIC(14,2) DEFAULT 0,
    tax_liability NUMERIC(12,2) DEFAULT 0,
    education_cess NUMERIC(10,2) DEFAULT 0,
    tds_monthly NUMERIC(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, fiscal_year)
);

-- ============================================
-- 6. INCREMENT CYCLES
-- ============================================
CREATE TABLE IF NOT EXISTS hr_increment_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    effective_date DATE NOT NULL,
    cycle_type VARCHAR(30) DEFAULT 'Annual',   -- Annual, Mid-Year, Special
    status VARCHAR(30) DEFAULT 'Draft',        -- Draft, Processing, Completed
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_employee_increments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES hr_increment_cycles(id) ON DELETE CASCADE,
    old_salary NUMERIC(14,2),
    new_salary NUMERIC(14,2),
    increment_amount NUMERIC(12,2) GENERATED ALWAYS AS (new_salary - old_salary) STORED,
    increment_pct NUMERIC(5,2),
    reason TEXT,
    effective_date DATE,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. BONUS SCHEMES
-- ============================================
CREATE TABLE IF NOT EXISTS hr_bonus_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    period VARCHAR(30),              -- Monthly, Quarterly, Annual, One-time
    bonus_type VARCHAR(50) DEFAULT 'Performance', -- Performance, Festival, Spot, Statutory
    formula JSONB,                   -- {"type":"percentage","base":"basic","value":10} or {"type":"fixed","value":5000}
    is_statutory BOOLEAN DEFAULT FALSE, -- True for Bonus Act compliance
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_employee_bonuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    scheme_id UUID REFERENCES hr_bonus_schemes(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    month VARCHAR(20),
    year INTEGER,
    status VARCHAR(30) DEFAULT 'Pending',   -- Pending, Approved, Processed
    approved_by UUID REFERENCES users(id),
    processed_in_payroll BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. BENEFITS PLANS & ENROLLMENT
-- ============================================
CREATE TABLE IF NOT EXISTS hr_benefits_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    benefit_type VARCHAR(50) NOT NULL, -- Insurance, Gratuity, NPS, Flexible, Meal Voucher, Club
    description TEXT,
    config JSONB,                      -- plan-specific config
    is_mandatory BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES hr_benefits_plans(id) ON DELETE CASCADE,
    enrolled_on DATE DEFAULT CURRENT_DATE,
    premium_employee NUMERIC(12,2) DEFAULT 0,
    premium_employer NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Active',
    unenrolled_on DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, plan_id)
);

-- ============================================
-- 9. REIMBURSEMENT CLAIMS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_reimbursement_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    category VARCHAR(80) NOT NULL,    -- Travel, Medical, Telephone, Internet, Meal, Misc
    amount NUMERIC(12,2) NOT NULL,
    receipts JSONB DEFAULT '[]',      -- [{name, url, amount}]
    description TEXT,
    claim_date DATE DEFAULT CURRENT_DATE,
    month VARCHAR(20),
    year INTEGER,
    status VARCHAR(30) DEFAULT 'Pending',   -- Pending, Approved, Rejected, Processed
    approved_by UUID REFERENCES users(id),
    processed_in_payroll BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. REWARDS & RECOGNITION
-- ============================================
CREATE TABLE IF NOT EXISTS hr_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    giver_id UUID REFERENCES employees(id) ON DELETE SET NULL,  -- NULL = system/management
    receiver_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    reward_type VARCHAR(50) DEFAULT 'Peer Recognition', -- Peer Recognition, Spot Award, Employee of Month, Points
    points INTEGER DEFAULT 0,
    message TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hr_pf_emp_period ON hr_pf_registers(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hr_esic_emp_period ON hr_esic_registers(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hr_pt_emp_period ON hr_pt_registers(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hr_tds_emp_fy ON hr_tds_workings(employee_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_hr_increments_cycle ON hr_employee_increments(cycle_id);
CREATE INDEX IF NOT EXISTS idx_hr_bonuses_employee ON hr_employee_bonuses(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_hr_reimb_employee ON hr_reimbursement_claims(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_rewards_receiver ON hr_rewards(receiver_id);
CREATE INDEX IF NOT EXISTS idx_salary_slips_status ON salary_slips(payment_status, year, month);
