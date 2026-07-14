-- Migration: 20260614_hrms_attendance_v2.sql
-- Description: HRMS Phase 4 — Attendance v2, Leave Engine, Timesheets, OT, Comp-off

-- ============================================
-- 1. EXTEND hr_attendance
-- ============================================
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES hr_shifts(id) ON DELETE SET NULL;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS is_regularized BOOLEAN DEFAULT FALSE;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS regularized_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS regularized_at TIMESTAMP;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS work_from_home BOOLEAN DEFAULT FALSE;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS geofence_status VARCHAR(20);    -- Inside, Outside, Unknown
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS early_departure BOOLEAN DEFAULT FALSE;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS late_arrival BOOLEAN DEFAULT FALSE;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS total_hours NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL AND clock_in IS NOT NULL
         THEN ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600, 2)
         ELSE 0 END
) STORED;

-- ============================================
-- 2. LEAVE BALANCES (one row per employee per year per type)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    allocated NUMERIC(6,1) DEFAULT 0,
    used NUMERIC(6,1) DEFAULT 0,
    carried_forward NUMERIC(6,1) DEFAULT 0,
    pending_approval NUMERIC(6,1) DEFAULT 0,
    encashed NUMERIC(6,1) DEFAULT 0,
    lapsed NUMERIC(6,1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, year, leave_type)
);

-- Computed balance view
CREATE OR REPLACE VIEW vw_leave_balance AS
SELECT
    lb.*,
    GREATEST(lb.allocated + lb.carried_forward - lb.used - lb.pending_approval - lb.encashed, 0) AS available_balance
FROM hr_leave_balances lb;

-- ============================================
-- 3. LEAVE ENCASHMENT
-- ============================================
CREATE TABLE IF NOT EXISTS hr_leave_encashment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL,
    days NUMERIC(5,1) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    month VARCHAR(20),
    year INTEGER,
    status VARCHAR(30) DEFAULT 'Pending',   -- Pending, Processed, Rejected
    processed_in_payroll_month VARCHAR(20),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. COMPENSATORY OFF
-- ============================================
CREATE TABLE IF NOT EXISTS hr_compensatory_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    worked_date DATE NOT NULL,
    reason VARCHAR(255),
    hours_worked NUMERIC(5,2),
    comp_off_days NUMERIC(4,1) DEFAULT 1,
    expiry_date DATE,
    status VARCHAR(30) DEFAULT 'Pending',   -- Pending, Approved, Used, Expired
    approved_by UUID REFERENCES users(id),
    used_on DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, worked_date)
);

-- ============================================
-- 5. TIMESHEET ENTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS hr_timesheet_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    date DATE NOT NULL,
    project VARCHAR(200),
    task VARCHAR(255),
    hours NUMERIC(5,2) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'Draft',   -- Draft, Submitted, Approved, Rejected
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. OVERTIME REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_overtime_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    extra_hours NUMERIC(5,2) NOT NULL,
    reason TEXT,
    status VARCHAR(30) DEFAULT 'Pending',  -- Pending, Approved, Rejected
    approved_by UUID REFERENCES users(id),
    ot_amount NUMERIC(12,2),              -- Computed at approval
    added_to_payroll BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- ============================================
-- 7. EXTEND hr_leaves WITH APPROVAL CHAIN
-- ============================================
ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS leave_policy_id UUID REFERENCES hr_leave_policies(id);
ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS half_day BOOLEAN DEFAULT FALSE;
ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS half_day_session VARCHAR(10);  -- AM, PM
ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE hr_leaves ADD COLUMN IF NOT EXISTS balance_snapshot NUMERIC(6,1); -- Balance at time of apply

-- ============================================
-- 8. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hr_att_employee_date ON hr_attendance(employee_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_hr_leave_bal_emp_year ON hr_leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_hr_compoff_employee ON hr_compensatory_off(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_ot_employee ON hr_overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_timesheet_employee ON hr_timesheet_entries(employee_id, week_start);

-- ============================================
-- 9. AUTO-PROVISION LEAVE BALANCES FUNCTION
-- (Call this after employee creation to seed leave balances for current year)
-- ============================================
CREATE OR REPLACE FUNCTION fn_provision_leave_balances(p_employee_id UUID, p_company_id INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
    v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    pol RECORD;
BEGIN
    FOR pol IN SELECT * FROM hr_leave_policies WHERE company_id = p_company_id LOOP
        INSERT INTO hr_leave_balances (employee_id, year, leave_type, allocated, company_id)
        VALUES (p_employee_id, v_year, pol.leave_type, pol.annual_quota, p_company_id)
        ON CONFLICT (employee_id, year, leave_type) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
