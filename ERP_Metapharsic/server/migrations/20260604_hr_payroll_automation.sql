-- Migration: 20260604_hr_payroll_automation.sql
-- Description: Create salary_slips table for automated payroll processing

CREATE TABLE IF NOT EXISTS salary_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    
    basic_salary NUMERIC(12,2) DEFAULT 0,
    hra NUMERIC(12,2) DEFAULT 0,
    da NUMERIC(12,2) DEFAULT 0,
    special_allowance NUMERIC(12,2) DEFAULT 0,
    performance_incentive NUMERIC(12,2) DEFAULT 0,
    fixed_allowance NUMERIC(12,2) DEFAULT 0,
    gross_salary NUMERIC(12,2) DEFAULT 0,
    
    pf_employee NUMERIC(12,2) DEFAULT 0,
    pf_employer NUMERIC(12,2) DEFAULT 0,
    professional_tax NUMERIC(12,2) DEFAULT 0,
    tds NUMERIC(12,2) DEFAULT 0,
    other_deductions NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    
    net_pay NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Processed', -- Processed, Paid
    
    journal_voucher_id UUID REFERENCES journal_vouchers(id) ON DELETE SET NULL,
    
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_salary_slips_period ON salary_slips(month, year);
