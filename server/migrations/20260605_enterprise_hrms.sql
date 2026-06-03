-- Migration: 20260605_enterprise_hrms.sql
-- Description: Core tables for Enterprise HRMS (ATS, Leave, Attendance, Incidents)

-- 1. Recruitment & ATS
CREATE TABLE IF NOT EXISTS hr_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role_applied VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Sourced', -- Sourced, Interviewing, Offered, Hired, Rejected
    resume_url TEXT,
    ai_score INTEGER DEFAULT 0,
    ai_summary TEXT,
    interviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    interview_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Leave Management
CREATE TABLE IF NOT EXISTS hr_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL, -- Sick, Casual, Earned, Unpaid
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INTEGER NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Rejected
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Attendance & Time Management
CREATE TABLE IF NOT EXISTS hr_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    status VARCHAR(50) DEFAULT 'Present', -- Present, Absent, Half Day, Late
    location_in VARCHAR(255),
    location_out VARCHAR(255),
    overtime_hours NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

-- 4. Risk & Incident Management (Governance)
CREATE TABLE IF NOT EXISTS hr_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    involved_employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    incident_type VARCHAR(100), -- Grievance, Disciplinary, Safety
    severity VARCHAR(50) DEFAULT 'Low', -- Low, Medium, High, Critical
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Open', -- Open, Under Investigation, Resolved
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_hr_candidates_status ON hr_candidates(status);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_employee ON hr_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(date);
CREATE INDEX IF NOT EXISTS idx_hr_incidents_status ON hr_incidents(status);
