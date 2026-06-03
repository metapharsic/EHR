-- Migration: GSTR-2A/2B Reconciliation
CREATE TABLE IF NOT EXISTS gst_portal_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    gstin VARCHAR(20) NOT NULL, -- Supplier GSTIN
    trade_name VARCHAR(255),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_type VARCHAR(50), -- B2B, CDNR, etc.
    invoice_date DATE NOT NULL,
    taxable_value NUMERIC(15, 2) NOT NULL,
    igst NUMERIC(15, 2) DEFAULT 0,
    cgst NUMERIC(15, 2) DEFAULT 0,
    sgst NUMERIC(15, 2) DEFAULT 0,
    total_gst NUMERIC(15, 2) DEFAULT 0,
    total_value NUMERIC(15, 2) NOT NULL,
    filing_status VARCHAR(20), -- Y/N
    filing_date DATE,
    source VARCHAR(20), -- 2A or 2B
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gst_portal_period ON gst_portal_data(period_month, period_year);
CREATE INDEX idx_gst_portal_gstin ON gst_portal_data(gstin);
