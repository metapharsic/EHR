-- Migration: 20260612_hrms_ats.sql
-- Description: HRMS Phase 2 — Applicant Tracking System (ATS)

-- ============================================
-- 1. JOB REQUISITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_job_requisitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    requisition_number VARCHAR(30) UNIQUE,
    title VARCHAR(200) NOT NULL,
    department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES hr_designations(id) ON DELETE SET NULL,
    positions INTEGER NOT NULL DEFAULT 1,
    employment_type VARCHAR(30) DEFAULT 'Permanent',
    location VARCHAR(100),
    min_experience INTEGER DEFAULT 0,         -- years
    max_experience INTEGER,
    salary_min NUMERIC(12,2),
    salary_max NUMERIC(12,2),
    description TEXT,
    requirements TEXT,
    jd_url TEXT,
    status VARCHAR(50) DEFAULT 'Draft',       -- Draft, Pending Approval, Approved/Open, On Hold, Filled, Cancelled
    raised_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    target_date DATE,
    filled_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto-generate requisition number
CREATE SEQUENCE IF NOT EXISTS hr_req_seq START 1;
CREATE OR REPLACE FUNCTION fn_assign_req_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.requisition_number IS NULL OR NEW.requisition_number = '' THEN
        NEW.requisition_number := 'REQ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('hr_req_seq')::text,4,'0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_assign_req_number ON hr_job_requisitions;
CREATE TRIGGER trg_assign_req_number BEFORE INSERT ON hr_job_requisitions FOR EACH ROW EXECUTE FUNCTION fn_assign_req_number();

-- ============================================
-- 2. EXTEND hr_candidates
-- ============================================
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS requisition_id UUID REFERENCES hr_job_requisitions(id) ON DELETE SET NULL;
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS source VARCHAR(80) DEFAULT 'Portal'; -- LinkedIn, Referral, Portal, Walk-in, Agency, Campus
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS notice_period INTEGER DEFAULT 0;     -- days
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS current_ctc NUMERIC(14,2);
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS expected_ctc NUMERIC(14,2);
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS current_location VARCHAR(100);
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4,1) DEFAULT 0;
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';            -- ["Python","React","SQL"]
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS stage VARCHAR(80) DEFAULT 'Sourced';  -- Sourced, Screened, Interview 1, Interview 2, HR Round, Offered, Hired, Rejected, Withdrawn
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE hr_candidates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================
-- 3. CANDIDATE STAGE HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS hr_candidate_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisition_id UUID REFERENCES hr_job_requisitions(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES hr_candidates(id) ON DELETE CASCADE,
    stage VARCHAR(80) NOT NULL,
    notes TEXT,
    interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP,
    outcome VARCHAR(50),              -- Passed, Failed, No Show, Withdrawn
    feedback_score INTEGER,           -- 1-5 overall
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. INTERVIEW FEEDBACK
-- ============================================
CREATE TABLE IF NOT EXISTS hr_interview_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID REFERENCES hr_candidate_stages(id) ON DELETE CASCADE,
    interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    technical_score INTEGER CHECK (technical_score BETWEEN 1 AND 5),
    communication_score INTEGER CHECK (communication_score BETWEEN 1 AND 5),
    cultural_score INTEGER CHECK (cultural_score BETWEEN 1 AND 5),
    overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 5),
    recommendation VARCHAR(30),       -- Strongly Hire, Hire, Hold, No Hire
    strengths TEXT,
    areas_of_improvement TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. OFFER LETTERS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_offer_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    candidate_id UUID REFERENCES hr_candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES hr_job_requisitions(id) ON DELETE SET NULL,
    offered_ctc NUMERIC(14,2) NOT NULL,
    offered_designation VARCHAR(200),
    joining_date DATE,
    validity_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',  -- Pending, Accepted, Declined, Revoked
    letter_url TEXT,
    acceptance_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hr_req_status ON hr_job_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_hr_req_dept ON hr_job_requisitions(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_candidates_req ON hr_candidates(requisition_id);
CREATE INDEX IF NOT EXISTS idx_hr_candidates_stage ON hr_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_hr_cstages_candidate ON hr_candidate_stages(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hr_offers_candidate ON hr_offer_letters(candidate_id);
