-- Migration: Voucher Setup and Schema Unification
-- Date: 2026-04-20

-- 1. Create Voucher Types Table
CREATE TABLE IF NOT EXISTS voucher_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id INTEGER DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    type_of_voucher VARCHAR(50) NOT NULL, -- Sale, Purchase, Payment, Receipt, Contra, Journal
    abbreviation VARCHAR(20),
    method_of_voucher_numbering VARCHAR(50) DEFAULT 'Automatic',
    use_effective_dates BOOLEAN DEFAULT FALSE,
    make_optional_by_default BOOLEAN DEFAULT FALSE,
    allow_narration BOOLEAN DEFAULT TRUE,
    provide_narrations_for_each_ledger BOOLEAN DEFAULT FALSE,
    print_after_saving BOOLEAN DEFAULT FALSE,
    name_of_class TEXT[], -- Array of classes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Ensure Bank Reconciliation Table exists
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

-- 3. Unify sales_invoices columns
DO $$ 
BEGIN 
    -- Add company_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoices' AND column_name='company_id') THEN
        ALTER TABLE sales_invoices ADD COLUMN company_id INTEGER DEFAULT 1;
    END IF;

    -- Add missing columns from StrategicPOS/pos.js design
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoices' AND column_name='invoice_no') THEN
        ALTER TABLE sales_invoices ADD COLUMN invoice_no VARCHAR(50);
        UPDATE sales_invoices SET invoice_no = invoice_number WHERE invoice_no IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoices' AND column_name='invoice_date') THEN
        ALTER TABLE sales_invoices ADD COLUMN invoice_date DATE;
        UPDATE sales_invoices SET invoice_date = date WHERE invoice_date IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoices' AND column_name='net_payable') THEN
        ALTER TABLE sales_invoices ADD COLUMN net_payable NUMERIC(12, 2);
        UPDATE sales_invoices SET net_payable = net_amount WHERE net_payable IS NULL;
    END IF;
END $$;

-- 4. Unify sales_invoice_items columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='sales_invoice_id') THEN
        ALTER TABLE sales_invoice_items ADD COLUMN sales_invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE;
        UPDATE sales_invoice_items SET sales_invoice_id = invoice_id WHERE sales_invoice_id IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_invoice_items' AND column_name='selling_rate') THEN
        ALTER TABLE sales_invoice_items ADD COLUMN selling_rate NUMERIC(10, 2);
        UPDATE sales_invoice_items SET selling_rate = rate WHERE selling_rate IS NULL;
    END IF;
END $$;

-- Seed initial voucher types if empty
INSERT INTO voucher_types (name, type_of_voucher, abbreviation, method_of_voucher_numbering)
SELECT 'Sales', 'Sale', 'Sale', 'Automatic'
WHERE NOT EXISTS (SELECT 1 FROM voucher_types WHERE name = 'Sales');

INSERT INTO voucher_types (name, type_of_voucher, abbreviation, method_of_voucher_numbering)
SELECT 'Purchase', 'Purchase', 'Purc', 'Automatic'
WHERE NOT EXISTS (SELECT 1 FROM voucher_types WHERE name = 'Purchase');

INSERT INTO voucher_types (name, type_of_voucher, abbreviation, method_of_voucher_numbering, print_after_saving)
SELECT 'Point of Sales', 'Sale', 'POS', 'Automatic', TRUE
WHERE NOT EXISTS (SELECT 1 FROM voucher_types WHERE name = 'Point of Sales');
