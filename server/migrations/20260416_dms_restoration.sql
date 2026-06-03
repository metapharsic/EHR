-- DMS Restoration Migration
-- Create tables for Document Management System

-- 1. Main Documents Table
CREATE TABLE IF NOT EXISTS dms_documents (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- SOP, License, Report, Compliance, Policy
    file_type VARCHAR(10) NOT NULL, -- PDF, DOCX, XLSX, etc.
    current_version VARCHAR(20) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'Active', -- Active, Draft, Expiring, Archived, Pending
    expiry_date DATE,
    author_id UUID REFERENCES users(id),
    author_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Document Versions Table
CREATE TABLE IF NOT EXISTS dms_versions (
    id BIGSERIAL PRIMARY KEY,
    document_id VARCHAR(50) REFERENCES dms_documents(id) ON DELETE CASCADE,
    version_label VARCHAR(20) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    change_log TEXT,
    uploaded_by UUID REFERENCES users(id),
    uploaded_name VARCHAR(100),
    approved_by VARCHAR(100),
    approval_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Document Workflows Table
CREATE TABLE IF NOT EXISTS dms_workflows (
    id BIGSERIAL PRIMARY KEY,
    document_id VARCHAR(50) REFERENCES dms_documents(id) ON DELETE CASCADE,
    current_step VARCHAR(50) NOT NULL, -- Drafting, Review, Approval, Published
    assigned_to VARCHAR(100),
    due_date DATE,
    status VARCHAR(20) DEFAULT 'In Progress',
    comments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Audit Trail for Compliance
CREATE TABLE IF NOT EXISTS dms_audit_trail (
    id BIGSERIAL PRIMARY KEY,
    document_id VARCHAR(50) REFERENCES dms_documents(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- View, Download, Create, Update, Delete
    user_id UUID REFERENCES users(id),
    user_name VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dms_doc_category ON dms_documents(category);
CREATE INDEX IF NOT EXISTS idx_dms_doc_status ON dms_documents(status);
CREATE INDEX IF NOT EXISTS idx_dms_audit_doc_id ON dms_audit_trail(document_id);
