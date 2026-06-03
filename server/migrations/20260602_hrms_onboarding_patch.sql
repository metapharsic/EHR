-- Migration: 20260602_hrms_onboarding_patch.sql
-- Idempotent patches for onboarding: target_completion_date default, completed_by column, extra indexes

-- Ensure target_completion_date exists (older deploys may lack it)
ALTER TABLE hr_onboarding_checklists
  ADD COLUMN IF NOT EXISTS target_completion_date DATE;

-- Back-fill target_completion_date for existing In Progress rows
UPDATE hr_onboarding_checklists
   SET target_completion_date = start_date + INTERVAL '30 days'
 WHERE target_completion_date IS NULL
   AND status IN ('In Progress', 'Overdue');

-- Ensure completed_by column exists on tasks
ALTER TABLE hr_onboarding_tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast active-onboarding queries
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_status
  ON hr_onboarding_checklists(status)
  WHERE status IN ('In Progress', 'Overdue');
