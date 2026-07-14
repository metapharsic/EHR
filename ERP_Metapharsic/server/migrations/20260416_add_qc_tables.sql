-- Migration: Add Quality Control (QC) Tables

-- QC Records Table
CREATE TABLE IF NOT EXISTS qc_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    batch_number VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    test_date DATE DEFAULT CURRENT_DATE,
    tested_by UUID REFERENCES users(id),
    final_status VARCHAR(20) DEFAULT 'Pending', -- Pending, Approved, Rejected
    coa_generated BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QC Parameters Table
CREATE TABLE IF NOT EXISTS qc_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID REFERENCES qc_records(id) ON DELETE CASCADE,
    parameter VARCHAR(255) NOT NULL,
    standard VARCHAR(255),
    result VARCHAR(255),
    status VARCHAR(20), -- Pass, Fail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_qc_records_batch ON qc_records(batch_id);
CREATE INDEX idx_qc_records_batch_number ON qc_records(batch_number);
CREATE INDEX idx_qc_records_status ON qc_records(final_status);
CREATE INDEX idx_qc_parameters_record ON qc_parameters(record_id);
