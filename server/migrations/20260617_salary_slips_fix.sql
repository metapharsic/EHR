
-- Migration: 20260617_salary_slips_fix.sql
-- Description: Add missing columns to salary_slips for overtime, bonuses, and deductions.

ALTER TABLE salary_slips 
ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reimbursement_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS leave_encashment_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lop_days NUMERIC(4,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lop_deduction NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS esic_employer NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS esic_employee NUMERIC(12,2) DEFAULT 0;

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_salary_slips_emp_period ON salary_slips(employee_id, month, year);
