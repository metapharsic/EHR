-- ============================================
-- PHASE 1: INVENTORY ENHANCEMENTS - MIGRATION
-- Date: March 19, 2026
-- Purpose: Add multi-location support, stock ledger, and reconciliation
-- ============================================

-- 1. CREATE GODOWNS TABLE (Warehouse/Location Management)
CREATE TABLE IF NOT EXISTS godowns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    manager_id UUID REFERENCES users(id),
    is_default BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'Active', -- Active, Inactive
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(company_id, name)
);

-- Insert default godown
INSERT INTO godowns (company_id, name, address, is_default, status) 
VALUES (1, 'Main Warehouse', 'Primary Storage Location', true, 'Active')
ON CONFLICT DO NOTHING;

-- Create index for company_id queries
CREATE INDEX IF NOT EXISTS idx_godowns_company_active ON godowns(company_id, status);

-- ============================================

-- 2. CREATE STOCK LEDGER ENTRIES TABLE (Complete Movement History)
CREATE TABLE IF NOT EXISTS stock_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    godown_id UUID REFERENCES godowns(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    
    -- Movement Classification
    movement_type VARCHAR(50) NOT NULL, -- Purchase, Sale, Production, Adjustment, Transfer, Return, Opening, Closing
    reference_type VARCHAR(50), -- PO, Invoice, JV, SO, ST, etc.
    reference_id UUID,
    reference_number VARCHAR(50),
    
    -- Quantities
    in_qty INTEGER DEFAULT 0,
    out_qty INTEGER DEFAULT 0,
    running_balance INTEGER,
    
    -- Valuation
    cost_per_unit NUMERIC(10, 2),
    total_cost NUMERIC(15, 2),
    
    -- Tracking & Audit
    movement_date DATE NOT NULL,
    narration TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_stock_ledger_product_batch (product_id, batch_id),
    INDEX idx_stock_ledger_godown_date (godown_id, movement_date),
    INDEX idx_stock_ledger_movement_date (movement_date),
    INDEX idx_stock_ledger_reference (reference_type, reference_number)
);

-- ============================================

-- 3. CREATE STOCK RECONCILIATION HEADER TABLE
CREATE TABLE IF NOT EXISTS stock_reconciliation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    godown_id UUID REFERENCES godowns(id) ON DELETE CASCADE,
    reconciliation_number VARCHAR(50) UNIQUE NOT NULL,
    reconciliation_date DATE NOT NULL,
    reconciliation_period_from DATE,
    reconciliation_period_to DATE,
    
    -- Status Workflow
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, InProgress, Completed, Approved, Cancelled
    
    -- Aggregated Totals
    total_system_qty INTEGER DEFAULT 0,
    total_physical_qty INTEGER DEFAULT 0,
    total_variance_qty INTEGER DEFAULT 0,
    total_variance_value NUMERIC(15, 2) DEFAULT 0,
    
    -- Approval & Sign-off
    created_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id), -- Physical count verifier
    approved_by UUID REFERENCES users(id), -- Finance approval
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    approved_at TIMESTAMP,
    
    UNIQUE(company_id, godown_id, reconciliation_date)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON stock_reconciliation(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_godown ON stock_reconciliation(godown_id, reconciliation_date);

-- ============================================

-- 4. CREATE STOCK RECONCILIATION ITEMS TABLE (Line Items)
CREATE TABLE IF NOT EXISTS stock_reconciliation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reconciliation_id UUID REFERENCES stock_reconciliation(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    
    -- Current System Quantities
    system_qty INTEGER DEFAULT 0,
    
    -- Physical Count
    physical_qty INTEGER DEFAULT 0,
    
    -- Variance Analysis
    variance_qty INTEGER DEFAULT 0, -- physical - system (can be +/-)
    variance_reason VARCHAR(100), -- Damage, Theft, Counting Error, Expiry Adjustment, Other
    variance_value NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_items_product ON stock_reconciliation_items(product_id, batch_id);

-- ============================================

-- 5. CREATE RETURN NOTES TABLE (Supplier & Customer Returns)
CREATE TABLE IF NOT EXISTS return_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    note_type VARCHAR(50) NOT NULL, -- Supplier Return (Credit from supplier), Customer Return (Debit to customer)
    party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
    reference_invoice VARCHAR(50),
    reference_invoice_date DATE,
    
    -- Timeline
    return_date DATE NOT NULL,
    approval_date DATE,
    received_date DATE,
    
    -- Totals
    total_qty INTEGER DEFAULT 0,
    total_value NUMERIC(15, 2) DEFAULT 0,
    
    -- Status & Workflow
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Submitted, Approved, Rejected, Received, Closed
    reason TEXT,
    rejection_reason TEXT,
    
    -- Linked Documents
    credit_note_id UUID,
    debit_note_id UUID,
    
    -- Approvals
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    received_at TIMESTAMP,
    
    UNIQUE(company_id, return_number)
);

CREATE INDEX IF NOT EXISTS idx_return_notes_status ON return_notes(status);
CREATE INDEX IF NOT EXISTS idx_return_notes_party ON return_notes(party_id, return_date);

-- ============================================

-- 6. CREATE RETURN NOTE ITEMS TABLE
CREATE TABLE IF NOT EXISTS return_note_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID REFERENCES return_notes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    
    -- Quantities & Pricing
    qty_returned INTEGER NOT NULL,
    mrp NUMERIC(10, 2),
    purchase_rate NUMERIC(10, 2),
    return_reason VARCHAR(100), -- Damage, Expiry, Overstocking, Defective, Wrong Item, Other
    return_value NUMERIC(15, 2),
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_return_items_product_batch ON return_note_items(product_id, batch_id);

-- ============================================

-- 7. ENHANCE PRODUCTS TABLE WITH VALUATION & TRACKING FIELDS
ALTER TABLE products ADD COLUMN IF NOT EXISTS
    valuation_method VARCHAR(50) DEFAULT 'FIFO'; -- FIFO, LIFO, Weighted Average

ALTER TABLE products ADD COLUMN IF NOT EXISTS
    default_godown_id UUID REFERENCES godowns(id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS
    enable_batch_tracking BOOLEAN DEFAULT TRUE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
    enable_serial_tracking BOOLEAN DEFAULT FALSE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
    is_fast_moving BOOLEAN DEFAULT FALSE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS
    min_shelf_life_months INTEGER;

-- ============================================

-- 8. ENHANCE BATCHES TABLE WITH STATUS & RESERVED QTY
ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    godown_id UUID REFERENCES godowns(id);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    status VARCHAR(50) DEFAULT 'In Stock'; -- In Stock, Reserved, Damaged, Scrap, Free Sample, Consignment, On Hold

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    reserved_qty INTEGER DEFAULT 0;

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    damaged_qty INTEGER DEFAULT 0;

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    ptr_rate NUMERIC(10, 2); -- Price to Retailer (explicit field)

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    margin_percent NUMERIC(5, 2) GENERATED ALWAYS AS (CASE WHEN ptr_rate > 0 THEN ROUND(((mrp - ptr_rate) / ptr_rate * 100)::NUMERIC, 2) ELSE 0 END) STORED;

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    landed_cost NUMERIC(10, 2); -- Cost including freight, duties

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    shelf_location VARCHAR(100); -- More specific location

ALTER TABLE batches ADD COLUMN IF NOT EXISTS
    available_qty INTEGER GENERATED ALWAYS AS (stock - COALESCE(reserved_qty, 0) - COALESCE(damaged_qty, 0)) STORED;

-- Indexes for enhanced batches
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_godown_product ON batches(godown_id, product_id);
CREATE INDEX IF NOT EXISTS idx_batches_available_qty ON batches(product_id, available_qty);

-- ============================================

-- 9. CREATE RESERVED STOCK TABLE (For SO/PO Allocation)
CREATE TABLE IF NOT EXISTS reserved_stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
    order_id UUID, -- Sales Order, Purchase Order
    order_type VARCHAR(50), -- SO, PO, Transfer
    order_number VARCHAR(50),
    qty_reserved INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(batch_id, order_id, order_type)
);

CREATE INDEX IF NOT EXISTS idx_reserved_batch_qty ON reserved_stock(batch_id, qty_reserved);
CREATE INDEX IF NOT EXISTS idx_reserved_order ON reserved_stock(order_id, order_type);

-- ============================================

-- 10. CREATE STOCK MOVEMENT REASONS LOOKUP
CREATE TABLE IF NOT EXISTS stock_movement_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reason_code VARCHAR(50) UNIQUE NOT NULL,
    reason_name VARCHAR(255) NOT NULL,
    movement_category VARCHAR(50), -- In, Out, Internal
    description TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert common reason codes
INSERT INTO stock_movement_reasons (reason_code, reason_name, movement_category, description) VALUES
('PURCHASE', 'Purchase Receipt', 'In', 'Stock received from supplier'),
('SALES', 'Sales/Dispatch', 'Out', 'Stock sold to customer'),
('RETURN_SUPPLIER', 'Return to Supplier', 'Out', 'Stock returned to supplier'),
('RETURN_CUSTOMER', 'Customer Return', 'In', 'Stock returned by customer'),
('PRODUCTION', 'Production Output', 'In', 'Finished goods from production'),
('RAW_MATERIAL', 'Raw Material Consumption', 'Out', 'Raw material used in production'),
('DAMAGE', 'Damage/Loss', 'Out', 'Stock damaged or lost'),
('EXPIRY', 'Expiry Adjustment', 'Out', 'Expired stock adjustment'),
('SCRAP', 'Scrap/Waste', 'Out', 'Stock written off as scrap'),
('TRANSFER', 'Inter-Godown Transfer', 'Internal', 'Transfer between locations'),
('SAMPLE', 'Free Sample', 'Out', 'Free samples distributed'),
('THEFT', 'Theft/Pilferage', 'Out', 'Stock lost due to theft'),
('COUNTING_ERROR', 'Counting Adjustment', 'Internal', 'Correction of counting errors'),
('OPENING', 'Opening Stock', 'In', 'Initial/Opening stock entry'),
('CLOSING', 'Closing Stock', 'Out', 'Period closing adjustment')
ON CONFLICT (reason_code) DO NOTHING;

-- ============================================

-- 11. GRANT NECESSARY PERMISSIONS (If needed)
-- ALTER TABLE stock_ledger_entries OWNER TO postgres;
-- ALTER TABLE stock_reconciliation OWNER TO postgres;
-- ALTER TABLE return_notes OWNER TO postgres;

-- ============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stock_ledger_company ON stock_ledger_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_company ON stock_reconciliation(company_id);
CREATE INDEX IF NOT EXISTS idx_return_notes_company ON return_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_reserved_stock_company ON reserved_stock(company_id);

-- ============================================
-- TRIGGERS FOR AUDIT (Optional but Recommended)
-- ============================================

-- Auto-update updated_at timestamp for godowns
CREATE OR REPLACE FUNCTION update_godowns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_godowns_timestamp
BEFORE UPDATE ON godowns
FOR EACH ROW
EXECUTE FUNCTION update_godowns_timestamp();

-- Auto-generate reconciliation number if not provided
CREATE OR REPLACE FUNCTION generate_reconciliation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reconciliation_number IS NULL THEN
        NEW.reconciliation_number := 'SR-' || TO_CHAR(NEW.created_at, 'YYYYMM') || '-' || LPAD(CAST(NEXTVAL('reconciliation_seq') AS TEXT), 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS reconciliation_seq START 1;

CREATE TRIGGER trigger_generate_reconciliation_number
BEFORE INSERT ON stock_reconciliation
FOR EACH ROW
EXECUTE FUNCTION generate_reconciliation_number();

-- ============================================
-- COMPLETION
-- ============================================

-- Verify migration
SELECT 'Migration 001 completed successfully' AS status;
SELECT COUNT(*) as godown_count FROM godowns;
SELECT COUNT(*) as reason_count FROM stock_movement_reasons;
