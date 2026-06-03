-- Fix missing columns for HRMS module

-- 1. hr_candidates
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. hr_attendance
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hr_attendance ADD COLUMN IF NOT EXISTS attendance_date DATE;

-- Sync attendance_date with date if needed, or just allow both.
-- The code uses attendance_date in some places and date in others.
UPDATE hr_attendance SET attendance_date = date WHERE attendance_date IS NULL AND date IS NOT NULL;

-- 3. hr_job_requisitions / hr_requisitions
-- The code now uses hr_job_requisitions (fixed by subagent), so we are good.
-- But if any code still uses hr_requisitions, let's create a view.
CREATE OR REPLACE VIEW hr_requisitions AS SELECT * FROM hr_job_requisitions;

-- 4. hr_leave_types / hr_leave_policies
-- The code uses hr_leave_policies (fixed by subagent).
-- Let's create a view for hr_leave_types if needed.
CREATE OR REPLACE VIEW hr_leave_types AS SELECT * FROM hr_leave_policies;

-- 5. hr_reimbursements / hr_reimbursement_claims
-- Fixed by subagent to use hr_reimbursement_claims.
CREATE OR REPLACE VIEW hr_reimbursements AS SELECT * FROM hr_reimbursement_claims;

-- 6. hr_holidays / hr_holiday_calendars
CREATE OR REPLACE VIEW hr_holidays AS SELECT * FROM hr_holiday_calendars;
ALTER TABLE hr_holiday_calendars ADD COLUMN IF NOT EXISTS holiday_date DATE;
UPDATE hr_holiday_calendars SET holiday_date = date WHERE holiday_date IS NULL AND date IS NOT NULL;
