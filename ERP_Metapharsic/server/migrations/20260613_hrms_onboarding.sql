-- Migration: 20260613_hrms_onboarding.sql
-- Description: HRMS Phase 3 — Onboarding, Offboarding, Assets, Policy Acknowledgments

-- ============================================
-- 1. ONBOARDING TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS hr_onboarding_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(150) NOT NULL,
    employment_type VARCHAR(30),       -- Permanent, Contract, Intern (NULL = all)
    department_id UUID REFERENCES hr_departments(id) ON DELETE SET NULL,
    tasks JSONB NOT NULL DEFAULT '[]', -- [{name, category, owner_type, due_day_offset}]
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. ONBOARDING CHECKLISTS (per employee)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_onboarding_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    template_id UUID REFERENCES hr_onboarding_templates(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'In Progress',  -- In Progress, Completed, Overdue
    start_date DATE DEFAULT CURRENT_DATE,
    target_completion_date DATE,
    completed_at TIMESTAMP,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,  -- HR buddy
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id)  -- one active onboarding per employee
);

-- ============================================
-- 3. ONBOARDING TASKS (individual items)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID REFERENCES hr_onboarding_checklists(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    category VARCHAR(80),              -- Documentation, IT Setup, Training, Orientation, Benefits, etc.
    owner_type VARCHAR(30) DEFAULT 'HR', -- HR, IT, Manager, Employee, Finance
    status VARCHAR(30) DEFAULT 'Pending', -- Pending, In Progress, Completed, Skipped
    due_date DATE,
    completed_at TIMESTAMP,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. ASSET ALLOCATIONS (linked to inventory)
-- ============================================
CREATE TABLE IF NOT EXISTS hr_asset_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,  -- Inventory integration
    asset_type VARCHAR(80) NOT NULL,        -- Laptop, Mobile, SIM Card, ID Card, Access Card, Vehicle, etc.
    asset_name VARCHAR(200) NOT NULL,
    serial_number VARCHAR(100),
    asset_tag VARCHAR(50),
    condition VARCHAR(30) DEFAULT 'Good',   -- New, Good, Fair, Damaged
    allocated_on DATE NOT NULL DEFAULT CURRENT_DATE,
    returned_on DATE,
    return_condition VARCHAR(30),
    notes TEXT,
    allocated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    inventory_decremented BOOLEAN DEFAULT FALSE,  -- Track if batch.stock was decremented
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. POLICY ACKNOWLEDGMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_policy_acknowledgments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    policy_name VARCHAR(200) NOT NULL,
    policy_version VARCHAR(20) DEFAULT '1.0',
    policy_doc_url TEXT,
    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    signature_data TEXT,              -- Base64 digital signature (optional)
    ip_address VARCHAR(50),
    UNIQUE(employee_id, policy_name, policy_version)
);

-- ============================================
-- 6. OFFBOARDING CHECKLISTS
-- ============================================
CREATE TABLE IF NOT EXISTS hr_offboarding_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    exit_date DATE NOT NULL,
    exit_type VARCHAR(50) DEFAULT 'Resignation', -- Resignation, Termination, Retirement, Contract End
    clearance_status JSONB DEFAULT '{
        "it_clearance": false,
        "finance_clearance": false,
        "asset_returned": false,
        "access_revoked": false,
        "knowledge_transfer": false,
        "noc_issued": false
    }',
    knowledge_transfer_doc_url TEXT,
    exit_interview_notes TEXT,
    notice_period_days INTEGER DEFAULT 30,
    last_working_day DATE,
    full_final_status VARCHAR(30) DEFAULT 'Pending',  -- Pending, In Progress, Settled
    full_final_amount NUMERIC(12,2),
    status VARCHAR(30) DEFAULT 'Initiated',  -- Initiated, In Progress, Completed
    initiated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id)
);

-- ============================================
-- 7. SEED DEFAULT ONBOARDING TEMPLATE
-- ============================================
INSERT INTO hr_onboarding_templates (company_id, name, is_default, tasks)
VALUES (1, 'Standard Onboarding', TRUE, '[
    {"name":"Send Welcome Email","category":"Communication","owner_type":"HR","due_day_offset":0},
    {"name":"Issue Employee ID & Access Card","category":"Documentation","owner_type":"HR","due_day_offset":1},
    {"name":"Complete Joining Formalities","category":"Documentation","owner_type":"HR","due_day_offset":1},
    {"name":"Laptop & Equipment Setup","category":"IT Setup","owner_type":"IT","due_day_offset":1},
    {"name":"Create Email & System Accounts","category":"IT Setup","owner_type":"IT","due_day_offset":1},
    {"name":"Acknowledge Employee Handbook","category":"Policy","owner_type":"Employee","due_day_offset":2},
    {"name":"Acknowledge Code of Conduct","category":"Policy","owner_type":"Employee","due_day_offset":2},
    {"name":"Payroll & Bank Details Submission","category":"Finance","owner_type":"Employee","due_day_offset":3},
    {"name":"PF & ESIC Enrollment","category":"Benefits","owner_type":"HR","due_day_offset":5},
    {"name":"Department & Team Orientation","category":"Orientation","owner_type":"Manager","due_day_offset":3},
    {"name":"Role & Responsibilities Briefing","category":"Training","owner_type":"Manager","due_day_offset":3},
    {"name":"Product Training","category":"Training","owner_type":"Manager","due_day_offset":7},
    {"name":"30-Day Check-in","category":"Review","owner_type":"HR","due_day_offset":30}
]'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_employee ON hr_onboarding_checklists(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_tasks_checklist ON hr_onboarding_tasks(checklist_id);
CREATE INDEX IF NOT EXISTS idx_hr_tasks_status ON hr_onboarding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hr_assets_employee ON hr_asset_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_policy_ack_employee ON hr_policy_acknowledgments(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_offboarding_employee ON hr_offboarding_checklists(employee_id);
