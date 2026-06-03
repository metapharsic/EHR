-- Migration: Advanced Purchase Management Features

-- 1. Goods Received Notes (GRN) - Part of 3-Way Matching
CREATE TABLE IF NOT EXISTS goods_received_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Inspected, Completed
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. GRN Items
CREATE TABLE IF NOT EXISTS grn_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_id UUID REFERENCES goods_received_notes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    po_item_id UUID REFERENCES purchase_order_items(id),
    ordered_qty INTEGER NOT NULL,
    received_qty INTEGER NOT NULL,
    accepted_qty INTEGER NOT NULL,
    rejected_qty INTEGER DEFAULT 0,
    unit_price NUMERIC(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Supplier Invoices - Part of 3-Way Matching
CREATE TABLE IF NOT EXISTS supplier_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id),
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    total_amount NUMERIC(15, 2) NOT NULL,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Verified, Paid, Disputed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, invoice_number)
);

-- 4. 3-Way Matching Results
CREATE TABLE IF NOT EXISTS three_way_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    grn_id UUID REFERENCES goods_received_notes(id),
    invoice_id UUID REFERENCES supplier_invoices(id),
    match_status VARCHAR(20) DEFAULT 'Matched', -- Matched, Mismatch, Partial
    variance_amount NUMERIC(15, 2) DEFAULT 0,
    remarks TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Vendor Performance Ratings
CREATE TABLE IF NOT EXISTS vendor_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) UNIQUE,
    quality_score NUMERIC(3, 2) DEFAULT 5.0, -- 1.0 to 5.0
    delivery_score NUMERIC(3, 2) DEFAULT 5.0,
    price_score NUMERIC(3, 2) DEFAULT 5.0,
    service_score NUMERIC(3, 2) DEFAULT 5.0,
    overall_rating NUMERIC(3, 2) DEFAULT 5.0,
    on_time_delivery_rate NUMERIC(5, 2) DEFAULT 100.0,
    total_transactions INTEGER DEFAULT 0,
    last_evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Purchase Budgets
CREATE TABLE IF NOT EXISTS purchase_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id VARCHAR(50) NOT NULL, -- e.g., 'RAW_MATERIALS', 'PACKAGING', 'LAB_EQUIPMENT'
    period_name VARCHAR(50) NOT NULL, -- e.g., 'FY2024-Q1'
    budgeted_amount NUMERIC(15, 2) NOT NULL,
    spent_amount NUMERIC(15, 2) DEFAULT 0,
    committed_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Under', -- Under, Near, Over
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, period_name)
);

-- 7. Approval Workflows (Enhanced)
CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type VARCHAR(20) NOT NULL, -- PO, GRN, INVOICE
    document_id UUID NOT NULL,
    current_level INTEGER DEFAULT 1,
    total_levels INTEGER DEFAULT 2,
    status VARCHAR(20) DEFAULT 'Pending', -- Pending, Approved, Rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_three_way_po ON three_way_matches(purchase_order_id);
CREATE INDEX idx_three_way_invoice ON three_way_matches(invoice_id);
CREATE INDEX idx_vendor_ratings_supplier ON vendor_ratings(supplier_id);
CREATE INDEX idx_budget_category ON purchase_budgets(category_id, period_name);
