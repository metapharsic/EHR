
-- Migration: 20260616_leave_policies_fix.sql
-- Description: Seed hr_leave_policies using NOT EXISTS to avoid ownership/constraint issues.

INSERT INTO hr_leave_policies (name, leave_type, annual_quota, carry_forward_max, encashable)
SELECT 'Casual Leave', 'Casual', 12.0, 0.0, FALSE
WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies WHERE leave_type = 'Casual');

INSERT INTO hr_leave_policies (name, leave_type, annual_quota, carry_forward_max, encashable)
SELECT 'Sick Leave', 'Sick', 10.0, 0.0, FALSE
WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies WHERE leave_type = 'Sick');

INSERT INTO hr_leave_policies (name, leave_type, annual_quota, carry_forward_max, encashable)
SELECT 'Earned Leave', 'Earned', 18.0, 30.0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies WHERE leave_type = 'Earned');

INSERT INTO hr_leave_policies (name, leave_type, annual_quota, carry_forward_max, encashable)
SELECT 'Maternity Leave', 'Maternity', 180.0, 0.0, FALSE
WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies WHERE leave_type = 'Maternity');

INSERT INTO hr_leave_policies (name, leave_type, annual_quota, carry_forward_max, encashable)
SELECT 'Paternity Leave', 'Paternity', 15.0, 0.0, FALSE
WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies WHERE leave_type = 'Paternity');

INSERT INTO hr_leave_policies (name, leave_type, annual_quota, carry_forward_max, encashable)
SELECT 'Loss of Pay', 'LWP', 0.0, 0.0, FALSE
WHERE NOT EXISTS (SELECT 1 FROM hr_leave_policies WHERE leave_type = 'LWP');

-- Update the view if it exists
CREATE OR REPLACE VIEW hr_leave_types AS SELECT * FROM hr_leave_policies;
