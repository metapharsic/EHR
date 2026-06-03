-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users & Roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- In real app, store hashed passwords
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- ADMIN, PHARMACIST, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Master
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    source VARCHAR(50) DEFAULT 'TRADING', -- PCD, OWN_MANUFACTURING, TRADING
    therapeutic_category VARCHAR(100),
    packing VARCHAR(50),
    uom VARCHAR(20) DEFAULT 'Strip',
    hsn VARCHAR(20),
    gst NUMERIC(5, 2) DEFAULT 12.00,
    min_stock_level INTEGER DEFAULT 50,
    reorder_level INTEGER DEFAULT 100,
    rack VARCHAR(50),
    schedule_type VARCHAR(20) DEFAULT 'OTC',
    is_narcotic BOOLEAN DEFAULT FALSE,
    is_temperature_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Product Batches (Inventory)
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(50) NOT NULL,
    expiry_date DATE NOT NULL,
    manufacturing_date DATE,
    stock INTEGER DEFAULT 0,
    mrp NUMERIC(10, 2) NOT NULL,
    purchase_rate NUMERIC(10, 2) NOT NULL,
    selling_rate NUMERIC(10, 2) NOT NULL,
    location VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, batch_number)
);

-- 4. Parties (Suppliers & Customers / Distributors)
CREATE TABLE parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- Debtor (Customer) or Creditor (Supplier)
    gstin VARCHAR(20),
    mobile VARCHAR(15),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Active',
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    current_balance NUMERIC(12, 2) DEFAULT 0, -- +ve Receivable, -ve Payable
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sales Invoices
CREATE TABLE sales_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    time TIME DEFAULT CURRENT_TIME,
    customer_name VARCHAR(255),
    customer_mobile VARCHAR(15),
    doctor_name VARCHAR(255),
    payment_mode VARCHAR(20), -- Cash, UPI, Card, etc.
    sub_total NUMERIC(12, 2) DEFAULT 0,
    taxable_value NUMERIC(12, 2) DEFAULT 0,
    total_gst NUMERIC(12, 2) DEFAULT 0,
    total_discount NUMERIC(12, 2) DEFAULT 0,
    round_off NUMERIC(5, 2) DEFAULT 0,
    net_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Completed', -- Draft, Completed, Cancelled
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Sales Invoice Items
CREATE TABLE sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES batches(id),
    quantity INTEGER NOT NULL,
    free_quantity INTEGER DEFAULT 0,
    mrp NUMERIC(10, 2) NOT NULL,
    rate NUMERIC(10, 2) NOT NULL, -- Selling Price
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    taxable_value NUMERIC(10, 2) DEFAULT 0,
    gst_percent NUMERIC(5, 2) DEFAULT 0,
    cgst_amount NUMERIC(10, 2) DEFAULT 0,
    sgst_amount NUMERIC(10, 2) DEFAULT 0,
    igst_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL
);

-- 7. Purchases
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES parties(id),
    invoice_number VARCHAR(50),
    date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'Received',
    payment_status VARCHAR(20) DEFAULT 'Unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Purchase Items
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    batch_number VARCHAR(50),
    expiry_date DATE,
    quantity INTEGER NOT NULL,
    purchase_rate NUMERIC(10, 2) NOT NULL,
    mrp NUMERIC(10, 2),
    gst_percent NUMERIC(5, 2) DEFAULT 0,
    amount NUMERIC(12, 2) NOT NULL
);

-- 9. Expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL, -- Rent, Salary, etc.
    description TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL,
    paid_by VARCHAR(100),
    payment_mode VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_batches_product_expiry ON batches(product_id, expiry_date);
CREATE INDEX idx_invoices_date ON sales_invoices(date);
CREATE INDEX idx_parties_name ON parties(name);

-- ========================================
-- ACCOUNTING TABLES (Enterprise Features)
-- ========================================

-- Chart of Accounts (Master)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    account_code VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Income, Expense
    account_group VARCHAR(100), -- Current Assets, Fixed Assets, etc.
    opening_balance NUMERIC(15, 2) DEFAULT 0,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Active', -- Active, Inactive
    gst_applicable BOOLEAN DEFAULT FALSE,
    account_format VARCHAR(20) DEFAULT 'debit', -- debit or credit
    reconciliation_status VARCHAR(50) DEFAULT 'Pending',
    cost_center_id UUID,
    parent_account_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Journal Vouchers (Manual Entries)
CREATE TABLE IF NOT EXISTS journal_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    party_id UUID REFERENCES parties(id), -- Optional: Link to a specific party
    voucher_type VARCHAR(50) DEFAULT 'Journal', -- Sales, Purchase, Receipt, Payment, Contra, Journal
    voucher_no VARCHAR(50) UNIQUE NOT NULL,
    voucher_date DATE NOT NULL,
    narration TEXT,
    total_debit NUMERIC(15, 2) DEFAULT 0,
    total_credit NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Posted, Approved, Rejected
    created_by UUID REFERENCES users(id),
    posted_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMP,
    approved_at TIMESTAMP
);

-- Journal Voucher Entries (Detail)
CREATE TABLE IF NOT EXISTS journal_voucher_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID REFERENCES journal_vouchers(id) ON DELETE CASCADE,
    account_id UUID REFERENCES chart_of_accounts(id),
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    narration TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- General Ledger (All Transactions)
CREATE TABLE IF NOT EXISTS general_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES chart_of_accounts(id),
    voucher_id UUID REFERENCES journal_vouchers(id),
    party_id UUID REFERENCES parties(id), -- Link to party for subsidiary ledger
    voucher_type VARCHAR(50), -- JV, Invoice, CN, DN, Contra, etc.
    transaction_date DATE NOT NULL,
    debit NUMERIC(15, 2) DEFAULT 0,
    credit NUMERIC(15, 2) DEFAULT 0,
    running_balance NUMERIC(15, 2),
    is_reconciled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cost Centers
CREATE TABLE IF NOT EXISTS cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- Department, Location, Project, ProductLine, Region
    manager_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Budget Master
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    cost_center_id UUID REFERENCES cost_centers(id),
    account_id UUID REFERENCES chart_of_accounts(id),
    budget_amount NUMERIC(15, 2),
    period_from DATE,
    period_to DATE,
    actual_amount NUMERIC(15, 2) DEFAULT 0,
    variance NUMERIC(15, 2),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Reconciliation
CREATE TABLE IF NOT EXISTS bank_reconciliation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    bank_account_id UUID REFERENCES chart_of_accounts(id),
    bank_statement_date DATE,
    bank_balance NUMERIC(15, 2),
    gl_balance NUMERIC(15, 2),
    variance NUMERIC(15, 2),
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Completed
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TDS Entries
CREATE TABLE IF NOT EXISTS tds_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    invoice_id UUID,
    tds_section VARCHAR(50), -- 194C, 194H, etc.
    tds_rate NUMERIC(5, 2),
    tds_amount NUMERIC(15, 2),
    payment_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- E-Invoices (GST)
CREATE TABLE IF NOT EXISTS e_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    invoice_id UUID,
    irn VARCHAR(100), -- Invoice Reference Number
    ack_no VARCHAR(100),
    qr_code TEXT,
    status VARCHAR(50) DEFAULT 'Draft', -- Draft, Generated, Acknowledged, Cancelled
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log (Accounting)
CREATE TABLE IF NOT EXISTS audit_log_accounting (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    table_name VARCHAR(100),
    record_id UUID,
    action VARCHAR(50), -- Insert, Update, Delete
    old_value TEXT,
    new_value TEXT,
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voucher Types Master
CREATE TABLE IF NOT EXISTS voucher_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    alias VARCHAR(100),
    type_of_voucher VARCHAR(50), -- Sales, Purchase, Receipt, Payment, Contra, Journal
    abbreviation VARCHAR(20),
    method_of_voucher_numbering VARCHAR(50) DEFAULT 'Automatic',
    use_effective_dates BOOLEAN DEFAULT FALSE,
    make_optional_by_default BOOLEAN DEFAULT FALSE,
    allow_narration BOOLEAN DEFAULT TRUE,
    provide_narrations_for_each_ledger BOOLEAN DEFAULT FALSE,
    print_after_saving BOOLEAN DEFAULT FALSE,
    name_of_class VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Ledger Entries (Inventory Audit Trail)
CREATE TABLE IF NOT EXISTS stock_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    godown_id UUID,
    product_id UUID REFERENCES products(id),
    batch_id UUID REFERENCES batches(id),
    movement_type VARCHAR(10) NOT NULL, -- IN, OUT
    reference_type VARCHAR(50), -- Sale, Purchase, Return, Adjustment
    reference_id UUID,
    reference_number VARCHAR(50),
    in_qty INTEGER DEFAULT 0,
    out_qty INTEGER DEFAULT 0,
    running_balance INTEGER,
    cost_per_unit NUMERIC(15, 2),
    total_cost NUMERIC(15, 2),
    movement_date DATE NOT NULL,
    narration TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounting Indexes
CREATE INDEX idx_coa_company ON chart_of_accounts(company_id);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_jv_date ON journal_vouchers(voucher_date);
CREATE INDEX idx_jv_status ON journal_vouchers(status);
CREATE INDEX idx_gl_account ON general_ledger(account_id);
CREATE INDEX idx_gl_date ON general_ledger(transaction_date);
CREATE INDEX idx_gl_account_date ON general_ledger(account_id, transaction_date);
CREATE INDEX idx_audit_table ON audit_log_accounting(table_name);

-- Composite Indexes for Reporting (Optimization)
CREATE INDEX idx_gl_acc_date_debit ON general_ledger(account_id, transaction_date, debit);
CREATE INDEX idx_gl_acc_date_credit ON general_ledger(account_id, transaction_date, credit);

-- 10. Accounting Views for Fast Aggregation
CREATE OR REPLACE VIEW vw_trial_balance AS
SELECT 
    coa.id AS account_id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    coa.company_id,
    COALESCE(SUM(gl.debit), 0) AS total_debit,
    COALESCE(SUM(gl.credit), 0) AS total_credit,
    COALESCE(SUM(gl.debit - gl.credit), 0) AS net_balance
FROM chart_of_accounts coa
LEFT JOIN general_ledger gl ON coa.id = gl.account_id
GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.company_id;

CREATE OR REPLACE VIEW vw_profit_loss AS
SELECT 
    coa.account_type,
    coa.account_name,
    coa.company_id,
    COALESCE(SUM(gl.debit - gl.credit), 0) AS amount
FROM chart_of_accounts coa
JOIN general_ledger gl ON coa.id = gl.account_id
WHERE coa.account_type IN ('Income', 'Expense')
GROUP BY coa.account_type, coa.account_name, coa.company_id;
