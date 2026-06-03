-- ============================================
-- PHASE 2: HR & EMPLOYEE MANAGEMENT
-- Date: April 15, 2026
-- Purpose: Add employees table for HR and sales performance tracking
-- ============================================

-- 1. CREATE EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(20),
    email VARCHAR(100),
    headquarters VARCHAR(100),
    assigned_area VARCHAR(100),
    
    -- Targets & Sales
    sales_target NUMERIC(15, 2) DEFAULT 0,
    total_sales NUMERIC(15, 2) DEFAULT 0,
    target_achievement NUMERIC(5, 2) DEFAULT 0,
    
    -- Salary & Payroll info
    base_salary NUMERIC(12, 2) DEFAULT 0,
    incentives NUMERIC(12, 2) DEFAULT 0,
    deductions NUMERIC(12, 2) DEFAULT 0,
    
    -- Status & Timeline
    status VARCHAR(50) DEFAULT 'Active', -- Active, On Leave, Resigned, Terminated
    join_date DATE DEFAULT CURRENT_DATE,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching and performance reporting
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);

-- 2. SEED SAMPLE DATA (Optional, for development)
INSERT INTO employees (name, contact, email, headquarters, assigned_area, sales_target, total_sales, target_achievement, base_salary, status)
VALUES 
('Rajesh Kumar', '9876543210', 'rajesh.kumar@metapharsic.com', 'Pune', 'Pune Central', 500000, 625000, 125.00, 35000, 'Active'),
('Priya Sharma', '9876543211', 'priya.sharma@metapharsic.com', 'Mumbai', 'Mumbai West', 600000, 540000, 90.00, 40000, 'Active'),
('Amit Patel', '9876543212', 'amit.patel@metapharsic.com', 'Nashik', 'Nashik Region', 400000, 280000, 70.00, 30000, 'Active'),
('Sneha Gupta', '9876543213', 'sneha.gupta@metapharsic.com', 'Pune', 'Pune East', 450000, 495000, 110.00, 38000, 'On Leave')
ON CONFLICT DO NOTHING;
